use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Notebook {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub trashed: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub title: String,
    #[serde(rename = "type")]
    pub note_type: String,
    pub body: String,
    pub notebook_id: String,
    pub updated_at: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
#[allow(dead_code)]
pub enum Scope {
    All,
    Notebook(String),
    Trash,
    TrashedNotebook(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Workspace {
    pub inbox_id: String,
    pub notebooks: Vec<Notebook>,
    pub notes: Vec<Note>,
}

#[derive(Debug, Clone, thiserror::Error, PartialEq, Eq)]
pub enum DomainError {
    #[error("{0}")]
    Message(String),
}

impl Workspace {
    pub fn new_empty() -> Self {
        Self {
            inbox_id: String::new(),
            notebooks: Vec::new(),
            notes: Vec::new(),
        }
    }

    pub fn active_notebooks(&self) -> impl Iterator<Item = &Notebook> {
        self.notebooks.iter().filter(|n| !n.trashed)
    }

    pub fn first_active_id(&self) -> Option<&str> {
        self.active_notebooks().next().map(|n| n.id.as_str())
    }

    pub fn notebook(&self, id: &str) -> Option<&Notebook> {
        self.notebooks.iter().find(|n| n.id == id)
    }

    pub fn notebook_mut(&mut self, id: &str) -> Option<&mut Notebook> {
        self.notebooks.iter_mut().find(|n| n.id == id)
    }

    pub fn note(&self, id: &str) -> Option<&Note> {
        self.notes.iter().find(|n| n.id == id)
    }

    pub fn note_mut(&mut self, id: &str) -> Option<&mut Note> {
        self.notes.iter_mut().find(|n| n.id == id)
    }

    pub fn normalize_inbox(&mut self) {
        let inbox_ok = !self.inbox_id.is_empty()
            && self
                .notebook(&self.inbox_id)
                .is_some_and(|n| !n.trashed);
        if !inbox_ok {
            self.inbox_id = self.first_active_id().unwrap_or("").to_string();
        }
    }

    pub fn create_notebook(&mut self, id: String, name: String) -> Result<&Notebook, DomainError> {
        if self.notebook(&id).is_some() {
            return Err(DomainError::Message("笔记本已存在".into()));
        }
        self.notebooks.push(Notebook {
            id,
            name,
            trashed: false,
        });
        self.normalize_inbox();
        Ok(self.notebooks.last().unwrap())
    }

    pub fn rename_notebook(&mut self, id: &str, name: String) -> Result<(), DomainError> {
        let notebook = self
            .notebook_mut(id)
            .ok_or_else(|| DomainError::Message("笔记本不存在".into()))?;
        notebook.name = name;
        Ok(())
    }

    pub fn trash_notebook(&mut self, id: &str) -> Result<(), DomainError> {
        let notebook = self
            .notebook_mut(id)
            .ok_or_else(|| DomainError::Message("笔记本不存在".into()))?;
        if notebook.trashed {
            return Err(DomainError::Message("笔记本已在回收站".into()));
        }
        notebook.trashed = true;
        self.normalize_inbox();
        Ok(())
    }

    pub fn restore_notebook(&mut self, id: &str) -> Result<(), DomainError> {
        let notebook = self
            .notebook_mut(id)
            .ok_or_else(|| DomainError::Message("笔记本不存在".into()))?;
        if !notebook.trashed {
            return Err(DomainError::Message("笔记本不在回收站".into()));
        }
        notebook.trashed = false;
        self.normalize_inbox();
        Ok(())
    }

    pub fn permanently_delete_notebook(&mut self, id: &str) -> Result<Vec<Note>, DomainError> {
        let trashed = self
            .notebook(id)
            .ok_or_else(|| DomainError::Message("笔记本不存在".into()))?
            .trashed;
        if !trashed {
            return Err(DomainError::Message("只能永久删除回收站中的笔记本".into()));
        }
        self.notebooks.retain(|n| n.id != id);
        let removed: Vec<Note> = self
            .notes
            .iter()
            .filter(|n| n.notebook_id == id)
            .cloned()
            .collect();
        self.notes.retain(|n| n.notebook_id != id);
        self.normalize_inbox();
        Ok(removed)
    }

    pub fn resolve_create_notebook_id(&mut self, requested: Option<&str>) -> Result<String, DomainError> {
        if let Some(id) = requested {
            let notebook = self
                .notebook(id)
                .ok_or_else(|| DomainError::Message("笔记本不存在".into()))?;
            if notebook.trashed {
                return Err(DomainError::Message("不能在回收站中新建笔记".into()));
            }
            return Ok(id.to_string());
        }
        self.normalize_inbox();
        if self.inbox_id.is_empty() {
            return Err(DomainError::Message("请先创建笔记本".into()));
        }
        Ok(self.inbox_id.clone())
    }

    pub fn create_note(
        &mut self,
        id: String,
        notebook_id: Option<&str>,
        title: String,
        body: String,
        updated_at: u64,
    ) -> Result<&Note, DomainError> {
        let notebook_id = self.resolve_create_notebook_id(notebook_id)?;
        if self.note(&id).is_some() {
            return Err(DomainError::Message("笔记已存在".into()));
        }
        self.notes.push(Note {
            id,
            title: sanitize_title(&title),
            note_type: "markdown".into(),
            body,
            notebook_id,
            updated_at,
        });
        Ok(self.notes.last().unwrap())
    }

    pub fn update_note(
        &mut self,
        id: &str,
        title: String,
        body: String,
        updated_at: u64,
    ) -> Result<(), DomainError> {
        let note = self
            .note_mut(id)
            .ok_or_else(|| DomainError::Message("笔记不存在".into()))?;
        note.title = sanitize_title(&title);
        note.body = body;
        note.updated_at = updated_at;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn notes_in_scope(&self, scope: &Scope) -> Vec<&Note> {
        let mut notes: Vec<&Note> = self
            .notes
            .iter()
            .filter(|note| match scope {
                Scope::All => self.notebook(&note.notebook_id).is_some_and(|n| !n.trashed),
                Scope::Notebook(id) => {
                    note.notebook_id == *id
                        && self.notebook(id).is_some_and(|n| !n.trashed)
                }
                Scope::Trash => self.notebook(&note.notebook_id).is_some_and(|n| n.trashed),
                Scope::TrashedNotebook(id) => {
                    note.notebook_id == *id && self.notebook(id).is_some_and(|n| n.trashed)
                }
            })
            .collect();
        notes.sort_by(|a, b| b.updated_at.cmp(&a.updated_at).then_with(|| a.id.cmp(&b.id)));
        notes
    }
}

pub fn sanitize_title(title: &str) -> String {
    title.replace(['\r', '\n'], " ")
}

pub fn now_nanos() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(0)
}

pub fn new_notebook_id(now: u64) -> String {
    format!("notebook-{now}")
}

pub fn new_note_id(now: u64) -> String {
    format!("note-{now}")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ws_with_two_notebooks() -> Workspace {
        let mut ws = Workspace::new_empty();
        ws.create_notebook("notebook-1".into(), "工作".into()).unwrap();
        ws.create_notebook("notebook-2".into(), "生活".into()).unwrap();
        ws
    }

    #[test]
    fn empty_workspace_has_empty_inbox() {
        let ws = Workspace::new_empty();
        assert_eq!(ws.inbox_id, "");
        assert!(ws.notebooks.is_empty());
    }

    #[test]
    fn first_notebook_becomes_inbox() {
        let mut ws = Workspace::new_empty();
        ws.create_notebook("notebook-1".into(), "工作".into()).unwrap();
        assert_eq!(ws.inbox_id, "notebook-1");
    }

    #[test]
    fn trashing_inbox_moves_to_another_active_notebook() {
        let mut ws = ws_with_two_notebooks();
        assert_eq!(ws.inbox_id, "notebook-1");
        ws.trash_notebook("notebook-1").unwrap();
        assert_eq!(ws.inbox_id, "notebook-2");
        assert!(ws.notebook("notebook-1").unwrap().trashed);
    }

    #[test]
    fn trashing_last_active_notebook_clears_inbox() {
        let mut ws = Workspace::new_empty();
        ws.create_notebook("notebook-1".into(), "工作".into()).unwrap();
        ws.trash_notebook("notebook-1").unwrap();
        assert_eq!(ws.inbox_id, "");
    }

    #[test]
    fn restoring_only_notebook_becomes_inbox() {
        let mut ws = Workspace::new_empty();
        ws.create_notebook("notebook-1".into(), "工作".into()).unwrap();
        ws.trash_notebook("notebook-1").unwrap();
        ws.restore_notebook("notebook-1").unwrap();
        assert_eq!(ws.inbox_id, "notebook-1");
        assert!(!ws.notebook("notebook-1").unwrap().trashed);
    }

    #[test]
    fn all_scope_hides_trashed_notebook_notes() {
        let mut ws = ws_with_two_notebooks();
        ws.create_note("note-1".into(), Some("notebook-1"), "A".into(), "a".into(), 2)
            .unwrap();
        ws.create_note("note-2".into(), Some("notebook-2"), "B".into(), "b".into(), 1)
            .unwrap();
        ws.trash_notebook("notebook-1").unwrap();
        let all: Vec<&str> = ws
            .notes_in_scope(&Scope::All)
            .iter()
            .map(|n| n.id.as_str())
            .collect();
        assert_eq!(all, vec!["note-2"]);
        let trash: Vec<&str> = ws
            .notes_in_scope(&Scope::Trash)
            .iter()
            .map(|n| n.id.as_str())
            .collect();
        assert_eq!(trash, vec!["note-1"]);
    }

    #[test]
    fn notes_sort_by_updated_at_desc() {
        let mut ws = ws_with_two_notebooks();
        ws.create_note("note-old".into(), Some("notebook-1"), "old".into(), "".into(), 1)
            .unwrap();
        ws.create_note("note-new".into(), Some("notebook-1"), "new".into(), "".into(), 9)
            .unwrap();
        let ids: Vec<&str> = ws
            .notes_in_scope(&Scope::Notebook("notebook-1".into()))
            .iter()
            .map(|n| n.id.as_str())
            .collect();
        assert_eq!(ids, vec!["note-new", "note-old"]);
    }

    #[test]
    fn note_belongs_to_one_notebook() {
        let mut ws = ws_with_two_notebooks();
        ws.create_note("note-1".into(), Some("notebook-1"), "A".into(), "".into(), 1)
            .unwrap();
        assert_eq!(ws.note("note-1").unwrap().notebook_id, "notebook-1");
        assert_eq!(ws.notes_in_scope(&Scope::Notebook("notebook-2".into())).len(), 0);
    }

    #[test]
    fn create_note_uses_inbox_when_unspecified() {
        let mut ws = ws_with_two_notebooks();
        ws.create_note("note-1".into(), None, "A".into(), "".into(), 1).unwrap();
        assert_eq!(ws.note("note-1").unwrap().notebook_id, "notebook-1");
    }

    #[test]
    fn cannot_permanently_delete_active_notebook() {
        let mut ws = ws_with_two_notebooks();
        assert!(ws.permanently_delete_notebook("notebook-1").is_err());
    }

    #[test]
    fn permanent_delete_removes_notes() {
        let mut ws = ws_with_two_notebooks();
        ws.create_note("note-1".into(), Some("notebook-1"), "A".into(), "".into(), 1)
            .unwrap();
        ws.trash_notebook("notebook-1").unwrap();
        ws.permanently_delete_notebook("notebook-1").unwrap();
        assert!(ws.notebook("notebook-1").is_none());
        assert!(ws.note("note-1").is_none());
    }

    #[test]
    fn sanitize_title_strips_newlines() {
        assert_eq!(sanitize_title("a\nb\r"), "a b ");
    }
}
