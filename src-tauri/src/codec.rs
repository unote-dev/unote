use serde::{Deserialize, Serialize};

use crate::domain::{Note, Notebook, Workspace};

#[derive(Debug, Clone, thiserror::Error, PartialEq, Eq)]
pub enum CodecError {
    #[error("无法解析 notebooks.json：{0}")]
    Notebooks(String),
    #[error("无法解析笔记文件：{0}")]
    Note(String),
}

#[derive(Debug, Serialize, Deserialize)]
struct NotebooksFile {
    #[serde(default)]
    inbox_id: String,
    #[serde(default)]
    notebooks: Vec<NotebookJson>,
}

#[derive(Debug, Serialize, Deserialize)]
struct NotebookJson {
    id: String,
    name: String,
    #[serde(default)]
    trashed: bool,
}

pub fn parse_notebooks_json(text: &str) -> Result<(String, Vec<Notebook>), CodecError> {
    let file: NotebooksFile =
        serde_json::from_str(text).map_err(|e| CodecError::Notebooks(e.to_string()))?;
    let notebooks = file
        .notebooks
        .into_iter()
        .map(|n| Notebook {
            id: n.id,
            name: n.name,
            trashed: n.trashed,
        })
        .collect();
    Ok((file.inbox_id, notebooks))
}

pub fn serialize_notebooks_json(workspace: &Workspace) -> Result<String, CodecError> {
    let file = NotebooksFile {
        inbox_id: workspace.inbox_id.clone(),
        notebooks: workspace
            .notebooks
            .iter()
            .map(|n| NotebookJson {
                id: n.id.clone(),
                name: n.name.clone(),
                trashed: n.trashed,
            })
            .collect(),
    };
    serde_json::to_string_pretty(&file).map_err(|e| CodecError::Notebooks(e.to_string()))
}

pub fn parse_note_markdown(id: &str, notebook_id: &str, text: &str) -> Result<Note, CodecError> {
    let text = text.replace("\r\n", "\n").replace('\r', "\n");
    if !text.starts_with("---\n") {
        return Err(CodecError::Note("文件必须以 --- 开头".into()));
    }
    let rest = &text[4..];
    let Some(end) = rest.find("\n---") else {
        return Err(CodecError::Note("缺少结束的 ---".into()));
    };
    let header = &rest[..end];
    let mut after = &rest[end + 4..];
    if after.starts_with('\n') {
        after = &after[1..];
    }
    if after.starts_with('\n') {
        after = &after[1..];
    }
    let body = after.to_string();

    let mut title = String::new();
    let mut note_type = String::from("markdown");
    let mut updated_at: u64 = 0;
    for line in header.lines() {
        let Some((key, value)) = line.split_once(':') else {
            continue;
        };
        let key = key.trim();
        let value = value.trim();
        match key {
            "title" => title = value.to_string(),
            "type" => {
                if value.is_empty() {
                    note_type = "markdown".into();
                } else {
                    note_type = value.to_string();
                }
            }
            "updated_at" => updated_at = value.parse().unwrap_or(0),
            _ => {}
        }
    }

    Ok(Note {
        id: id.to_string(),
        title,
        note_type,
        body,
        notebook_id: notebook_id.to_string(),
        updated_at,
    })
}

pub fn serialize_note_markdown(note: &Note) -> String {
    let title = crate::domain::sanitize_title(&note.title);
    let note_type = if note.note_type.is_empty() {
        "markdown"
    } else {
        &note.note_type
    };
    format!(
        "---\ntitle: {title}\ntype: {note_type}\nupdated_at: {}\n---\n\n{}",
        note.updated_at, note.body
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::Workspace;

    #[test]
    fn parses_spec_notebooks_json() {
        let json = r#"{
  "inbox_id": "notebook-1730000000000000000",
  "notebooks": [
    {
      "id": "notebook-1730000000000000000",
      "name": "工作",
      "trashed": false
    },
    {
      "id": "notebook-1730000000000000003",
      "name": "旧项目",
      "trashed": true
    }
  ]
}"#;
        let (inbox, notebooks) = parse_notebooks_json(json).unwrap();
        assert_eq!(inbox, "notebook-1730000000000000000");
        assert_eq!(notebooks[0].name, "工作");
        assert!(!notebooks[0].trashed);
        assert!(notebooks[1].trashed);
    }

    #[test]
    fn missing_trashed_defaults_false() {
        let json = r#"{"inbox_id":"n1","notebooks":[{"id":"n1","name":"A"}]}"#;
        let (_, notebooks) = parse_notebooks_json(json).unwrap();
        assert!(!notebooks[0].trashed);
    }

    #[test]
    fn unknown_fields_are_ignored() {
        let json = r#"{"inbox_id":"","notebooks":[],"future":true}"#;
        let (inbox, notebooks) = parse_notebooks_json(json).unwrap();
        assert_eq!(inbox, "");
        assert!(notebooks.is_empty());
    }

    #[test]
    fn bad_json_is_error() {
        let err = parse_notebooks_json("{not json").unwrap_err();
        assert!(matches!(err, CodecError::Notebooks(_)));
    }

    #[test]
    fn parses_spec_markdown() {
        let text = "---\ntitle: 一条示例笔记\ntype: markdown\nupdated_at: 1730000000000000000\n---\n\n这里是 **Markdown** 正文。\n";
        let note = parse_note_markdown("note-1", "notebook-1", text).unwrap();
        assert_eq!(note.title, "一条示例笔记");
        assert_eq!(note.note_type, "markdown");
        assert_eq!(note.updated_at, 1730000000000000000);
        assert_eq!(note.body, "这里是 **Markdown** 正文。\n");
        assert_eq!(note.id, "note-1");
        assert_eq!(note.notebook_id, "notebook-1");
    }

    #[test]
    fn missing_type_defaults_markdown() {
        let text = "---\ntitle: t\nupdated_at: 1\n---\n\nbody";
        let note = parse_note_markdown("note-1", "nb", text).unwrap();
        assert_eq!(note.note_type, "markdown");
        assert_eq!(note.body, "body");
    }

    #[test]
    fn invalid_updated_at_becomes_zero() {
        let text = "---\ntitle: t\ntype: markdown\nupdated_at: nope\n---\n\nx";
        let note = parse_note_markdown("note-1", "nb", text).unwrap();
        assert_eq!(note.updated_at, 0);
    }

    #[test]
    fn malformed_note_is_error() {
        assert!(parse_note_markdown("n", "b", "no frontmatter").is_err());
    }

    #[test]
    fn roundtrip_preserves_fields_and_body() {
        let note = Note {
            id: "note-1".into(),
            title: "标题".into(),
            note_type: "markdown".into(),
            body: "第一行\n\n特殊 *字符* <tag>\n".into(),
            notebook_id: "nb".into(),
            updated_at: 42,
        };
        let text = serialize_note_markdown(&note);
        let parsed = parse_note_markdown(&note.id, &note.notebook_id, &text).unwrap();
        assert_eq!(parsed.title, note.title);
        assert_eq!(parsed.body, note.body);
        assert_eq!(parsed.updated_at, note.updated_at);
        assert_eq!(parsed.note_type, "markdown");
    }

    #[test]
    fn notebooks_json_roundtrip() {
        let mut ws = Workspace::new_empty();
        ws.create_notebook("notebook-1".into(), "工作".into()).unwrap();
        let text = serialize_notebooks_json(&ws).unwrap();
        let (inbox, notebooks) = parse_notebooks_json(&text).unwrap();
        assert_eq!(inbox, "notebook-1");
        assert_eq!(notebooks[0].name, "工作");
    }
}
