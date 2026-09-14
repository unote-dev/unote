use std::fs;
use std::path::{Path, PathBuf};

use crate::codec::{parse_note_markdown, parse_notebooks_json, serialize_note_markdown, serialize_notebooks_json};
use crate::domain::Workspace;

#[derive(Debug, thiserror::Error)]
pub enum WorkspaceError {
    #[error("{0}")]
    Message(String),
}

pub fn repo_root(app_data: &Path, host: &str, login: &str, repo: &str) -> PathBuf {
    app_data.join("repos").join(host).join(login).join(repo)
}

pub fn debug_workspace_root(app_data: &Path) -> PathBuf {
    app_data.join("debug-workspace")
}

pub fn init_empty_workspace(root: &Path) -> Result<(), WorkspaceError> {
    fs::create_dir_all(root).map_err(|e| WorkspaceError::Message(e.to_string()))?;
    let notebooks = root.join("notebooks.json");
    if !notebooks.exists() {
        let ws = Workspace::new_empty();
        let json = serialize_notebooks_json(&ws)
            .map_err(|e| WorkspaceError::Message(e.to_string()))?;
        fs::write(&notebooks, json).map_err(|e| WorkspaceError::Message(e.to_string()))?;
    }
    Ok(())
}

pub fn load_workspace(root: &Path) -> Result<Workspace, WorkspaceError> {
    let meta_path = root.join("notebooks.json");
    let text = fs::read_to_string(&meta_path).map_err(|e| {
        WorkspaceError::Message(format!("读取 notebooks.json 失败：{e}"))
    })?;
    let (inbox_id, notebooks) = parse_notebooks_json(&text)
        .map_err(|e| WorkspaceError::Message(e.to_string()))?;
    let mut notes = Vec::new();
    for notebook in &notebooks {
        let dir = root.join(&notebook.id);
        if !dir.is_dir() {
            continue;
        }
        let entries = fs::read_dir(&dir).map_err(|e| WorkspaceError::Message(e.to_string()))?;
        for entry in entries {
            let entry = entry.map_err(|e| WorkspaceError::Message(e.to_string()))?;
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) != Some("md") {
                continue;
            }
            let id = path
                .file_stem()
                .and_then(|s| s.to_str())
                .ok_or_else(|| WorkspaceError::Message("无效的笔记文件名".into()))?
                .to_string();
            let file_text = fs::read_to_string(&path).map_err(|e| {
                WorkspaceError::Message(format!("读取笔记失败：{e}"))
            })?;
            let note = parse_note_markdown(&id, &notebook.id, &file_text)
                .map_err(|e| WorkspaceError::Message(e.to_string()))?;
            notes.push(note);
        }
    }
    let mut workspace = Workspace {
        inbox_id,
        notebooks,
        notes,
    };
    workspace.normalize_inbox();
    Ok(workspace)
}

pub fn save_workspace(root: &Path, workspace: &Workspace) -> Result<(), WorkspaceError> {
    fs::create_dir_all(root).map_err(|e| WorkspaceError::Message(e.to_string()))?;
    let json = serialize_notebooks_json(workspace)
        .map_err(|e| WorkspaceError::Message(e.to_string()))?;
    fs::write(root.join("notebooks.json"), json)
        .map_err(|e| WorkspaceError::Message(e.to_string()))?;

    for notebook in &workspace.notebooks {
        fs::create_dir_all(root.join(&notebook.id))
            .map_err(|e| WorkspaceError::Message(e.to_string()))?;
    }

    for note in &workspace.notes {
        let path = root
            .join(&note.notebook_id)
            .join(format!("{}.md", note.id));
        fs::write(path, serialize_note_markdown(note))
            .map_err(|e| WorkspaceError::Message(e.to_string()))?;
    }

    for notebook in &workspace.notebooks {
        let dir = root.join(&notebook.id);
        if !dir.is_dir() {
            continue;
        }
        let entries = fs::read_dir(&dir).map_err(|e| WorkspaceError::Message(e.to_string()))?;
        for entry in entries {
            let entry = entry.map_err(|e| WorkspaceError::Message(e.to_string()))?;
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) != Some("md") {
                continue;
            }
            let id = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or_default();
            let still_present = workspace
                .notes
                .iter()
                .any(|n| n.id == id && n.notebook_id == notebook.id);
            if !still_present {
                fs::remove_file(&path).map_err(|e| WorkspaceError::Message(e.to_string()))?;
            }
        }
    }
    Ok(())
}

pub fn remove_notebook_dir(root: &Path, notebook_id: &str) -> Result<(), WorkspaceError> {
    let dir = root.join(notebook_id);
    if dir.exists() {
        fs::remove_dir_all(&dir).map_err(|e| WorkspaceError::Message(e.to_string()))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::Workspace;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn load_ignores_unregistered_directories() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let mut ws = Workspace::new_empty();
        ws.create_notebook("notebook-1".into(), "工作".into()).unwrap();
        ws.create_note(
            "note-1".into(),
            Some("notebook-1"),
            "A".into(),
            "hello".into(),
            1,
        )
        .unwrap();
        save_workspace(root, &ws).unwrap();

        fs::create_dir_all(root.join("unregistered")).unwrap();
        fs::write(
            root.join("unregistered").join("note-hidden.md"),
            "---\ntitle: hidden\ntype: markdown\nupdated_at: 1\n---\n\nhidden\n",
        )
        .unwrap();
        fs::write(root.join("notebook-1").join("keep.txt"), "not markdown").unwrap();

        let loaded = load_workspace(root).unwrap();
        assert_eq!(loaded.notes.len(), 1);
        assert_eq!(loaded.notes[0].id, "note-1");
        assert!(root.join("unregistered").join("note-hidden.md").exists());
    }

    #[test]
    fn save_writes_frontmatter_and_deletes_stale_md_only() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let mut ws = Workspace::new_empty();
        ws.create_notebook("notebook-1".into(), "工作".into()).unwrap();
        ws.create_note(
            "note-1".into(),
            Some("notebook-1"),
            "A".into(),
            "hello".into(),
            1,
        )
        .unwrap();
        ws.create_note(
            "note-2".into(),
            Some("notebook-1"),
            "B".into(),
            "bye".into(),
            2,
        )
        .unwrap();
        save_workspace(root, &ws).unwrap();

        fs::create_dir_all(root.join("unregistered")).unwrap();
        fs::write(root.join("unregistered").join("x.md"), "keep").unwrap();
        fs::write(root.join("notebook-1").join("extra.bin"), "bin").unwrap();

        ws.notes.retain(|n| n.id != "note-2");
        save_workspace(root, &ws).unwrap();

        assert!(!root.join("notebook-1").join("note-2.md").exists());
        assert!(root.join("notebook-1").join("note-1.md").exists());
        assert!(root.join("unregistered").join("x.md").exists());
        assert!(root.join("notebook-1").join("extra.bin").exists());

        let text = fs::read_to_string(root.join("notebook-1").join("note-1.md")).unwrap();
        assert!(text.starts_with("---\n"));
        assert!(text.contains("title: A"));
        assert!(text.contains("hello"));
    }

    #[test]
    fn load_bad_json_does_not_overwrite() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let original = "{not-json";
        fs::write(root.join("notebooks.json"), original).unwrap();
        assert!(load_workspace(root).is_err());
        let after = fs::read_to_string(root.join("notebooks.json")).unwrap();
        assert_eq!(after, original);
    }

    #[test]
    fn repo_path_is_scoped_by_host_and_login() {
        let app_data = PathBuf::from("/tmp/unote-app");
        let repo = repo_root(&app_data, "gitee", "alice", "alice.gitee.unote");
        assert!(repo.starts_with(app_data.join("repos").join("gitee").join("alice")));
    }

    #[test]
    fn init_empty_has_no_preset_notebooks() {
        let dir = tempdir().unwrap();
        init_empty_workspace(dir.path()).unwrap();
        let ws = load_workspace(dir.path()).unwrap();
        assert!(ws.notebooks.is_empty());
        assert!(!dir.path().join("session.json").exists());
    }
}
