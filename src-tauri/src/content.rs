use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CreateKind {
    Markdown,
    Canvas,
    Mindmap,
    Folder,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentEntry {
    pub kind: String,
    pub name: String,
    pub path: String,
    pub updated_at: u64,
    pub children: Vec<ContentEntry>,
}

fn supported_kind(path: &Path) -> Option<&'static str> {
    match path.extension()?.to_str()?.to_ascii_lowercase().as_str() {
        "md" => Some("markdown"),
        "excalidraw" => Some("canvas"),
        "mindmap" => Some("mindmap"),
        _ => None,
    }
}

fn relative_string(path: &Path) -> String {
    path.components()
        .filter_map(|part| match part {
            Component::Normal(value) => value.to_str(),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

fn scan_dir(root: &Path, relative: &Path) -> Result<Vec<ContentEntry>, String> {
    let directory = root.join(relative);
    let mut entries = Vec::new();
    for item in fs::read_dir(&directory).map_err(|error| error.to_string())? {
        let item = item.map_err(|error| error.to_string())?;
        let file_type = item.file_type().map_err(|error| error.to_string())?;
        if file_type.is_symlink() {
            continue;
        }
        let name = item.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        let child_relative = relative.join(&name);
        if file_type.is_dir() {
            entries.push(ContentEntry {
                kind: "folder".into(),
                name,
                path: relative_string(&child_relative),
                updated_at: 0,
                children: scan_dir(root, &child_relative)?,
            });
        } else if let Some(kind) = supported_kind(&item.path()) {
            let updated_at = item
                .metadata()
                .ok()
                .and_then(|metadata| metadata.modified().ok())
                .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|duration| duration.as_nanos() as u64)
                .unwrap_or(0);
            entries.push(ContentEntry {
                kind: kind.into(),
                name: item.path().file_stem().unwrap_or_default().to_string_lossy().into_owned(),
                path: relative_string(&child_relative),
                updated_at,
                children: Vec::new(),
            });
        }
    }
    entries.sort_by(|left, right| {
        let left_file = left.kind != "folder";
        let right_file = right.kind != "folder";
        left_file.cmp(&right_file).then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });
    Ok(entries)
}

pub fn scan(root: &Path) -> Result<Vec<ContentEntry>, String> {
    scan_dir(root, Path::new(""))
}

fn resolve_document(root: &Path, relative: &str) -> Result<PathBuf, String> {
    let path = Path::new(relative);
    if path.is_absolute()
        || path.components().any(|part| !matches!(part, Component::Normal(_)))
        || supported_kind(path).is_none()
    {
        return Err("无效的文档路径".into());
    }
    let resolved = root.join(path);
    let canonical_root = root.canonicalize().map_err(|error| error.to_string())?;
    let canonical_path = resolved.canonicalize().map_err(|error| error.to_string())?;
    if !canonical_path.starts_with(canonical_root) {
        return Err("文档路径超出仓库".into());
    }
    Ok(canonical_path)
}

pub fn read(root: &Path, relative: &str) -> Result<String, String> {
    fs::read_to_string(resolve_document(root, relative)?).map_err(|error| error.to_string())
}

pub fn write(root: &Path, relative: &str, content: &str) -> Result<(), String> {
    let path = resolve_document(root, relative)?;
    if !path.is_file() {
        return Err("文档不存在".into());
    }
    let parent = path.parent().ok_or_else(|| "文档没有父目录".to_string())?;
    let mut temporary = tempfile::NamedTempFile::new_in(parent).map_err(|error| error.to_string())?;
    temporary.write_all(content.as_bytes()).map_err(|error| error.to_string())?;
    temporary.as_file().sync_all().map_err(|error| error.to_string())?;
    temporary.persist(&path).map_err(|error| error.error.to_string())?;
    Ok(())
}

fn validate_name(name: &str) -> Result<(), String> {
    if name.is_empty() {
        return Err("名称不能为空".into());
    }
    if name.starts_with('.') {
        return Err("名称不能以点开头".into());
    }
    if name.ends_with([' ', '.']) {
        return Err("名称不能以空格或点结尾".into());
    }
    if name.chars().any(|character| character.is_control() || "<>:\"/\\|?*".contains(character)) {
        return Err("名称包含系统不允许的字符".into());
    }
    let upper = name.split('.').next().unwrap_or(name).to_ascii_uppercase();
    let reserved = matches!(upper.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || (upper.len() == 4 && (upper.starts_with("COM") || upper.starts_with("LPT")) && matches!(upper.as_bytes()[3], b'1'..=b'9'));
    if reserved {
        return Err("名称是系统保留名称".into());
    }
    Ok(())
}

pub fn create(root: &Path, parent: &str, name: &str, kind: CreateKind) -> Result<String, String> {
    validate_name(name)?;
    if Path::new(parent).components().any(|component| match component {
        Component::Normal(value) => value.to_string_lossy().starts_with('.'),
        _ => true,
    }) {
        return Err("不能在系统目录中创建内容".into());
    }
    let parent_path = if parent.is_empty() { root.to_path_buf() } else { root.join(parent) };
    let mut checked = root.to_path_buf();
    for component in Path::new(parent).components() {
        if let Component::Normal(value) = component {
            checked.push(value);
            if fs::symlink_metadata(&checked).map(|metadata| metadata.file_type().is_symlink()).unwrap_or(false) {
                return Err("不能通过符号链接创建内容".into());
            }
        }
    }
    let canonical_root = root.canonicalize().map_err(|error| error.to_string())?;
    let canonical_parent = parent_path.canonicalize().map_err(|_| "目标文件夹不存在".to_string())?;
    if !canonical_parent.starts_with(&canonical_root) || !canonical_parent.is_dir() {
        return Err("目标文件夹无效".into());
    }
    let (extension, initial) = match kind {
        CreateKind::Markdown => (Some("md"), String::new()),
        CreateKind::Canvas => (Some("excalidraw"), "{\n  \"type\": \"excalidraw\",\n  \"version\": 2,\n  \"source\": \"unote\",\n  \"elements\": [],\n  \"appState\": {},\n  \"files\": {}\n}\n".into()),
        CreateKind::Mindmap => (Some("mindmap"), format!("{{\n  \"nodeData\": {{\n    \"id\": \"root\",\n    \"topic\": {},\n    \"children\": []\n  }},\n  \"direction\": 2\n}}\n", serde_json::to_string(name).unwrap())),
        CreateKind::Folder => (None, String::new()),
    };
    let mut temporary = if extension.is_some() {
        let mut file = tempfile::NamedTempFile::new_in(&canonical_parent).map_err(|error| error.to_string())?;
        file.write_all(initial.as_bytes()).map_err(|error| error.to_string())?;
        file.as_file().sync_all().map_err(|error| error.to_string())?;
        Some(file)
    } else {
        None
    };
    let mut number = 1;
    loop {
        let visible_name = if number == 1 { name.to_string() } else { format!("{name} ({number})") };
        let file_name = extension.map_or_else(|| visible_name.clone(), |ext| format!("{visible_name}.{ext}"));
        let path = canonical_parent.join(&file_name);
        let created = if let Some(file) = temporary.take() {
            match file.persist_noclobber(&path) {
                Ok(_) => true,
                Err(error) if error.error.kind() == std::io::ErrorKind::AlreadyExists => {
                    temporary = Some(error.file);
                    false
                }
                Err(error) => return Err(error.error.to_string()),
            }
        } else {
            match fs::create_dir(&path) {
                Ok(()) => true,
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => false,
                Err(error) => return Err(error.to_string()),
            }
        };
        if created {
            return path.strip_prefix(&canonical_root).map(relative_string).map_err(|error| error.to_string());
        }
        number += 1;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn scans_nested_supported_documents_and_ignores_system_paths() {
        let dir = tempdir().unwrap();
        fs::create_dir_all(dir.path().join("工作/项目")).unwrap();
        fs::create_dir_all(dir.path().join(".assets")).unwrap();
        fs::write(dir.path().join("工作/项目/计划.md"), "hello").unwrap();
        fs::write(dir.path().join("工作/readme.txt"), "ignore").unwrap();
        fs::write(dir.path().join(".assets/image.md"), "ignore").unwrap();

        let roots = scan(dir.path()).unwrap();
        assert_eq!(roots.len(), 1);
        assert_eq!(roots[0].path, "工作");
        assert_eq!(roots[0].children[0].children[0].path, "工作/项目/计划.md");
    }

    #[test]
    fn rejects_paths_outside_the_repository() {
        let dir = tempdir().unwrap();
        assert!(read(dir.path(), "../secret.md").is_err());
        assert!(write(dir.path(), ".unote/settings.json", "{}").is_err());
    }

    #[test]
    fn creates_nested_documents_and_numbers_conflicts() {
        let dir = tempdir().unwrap();
        fs::create_dir(dir.path().join("工作")).unwrap();
        assert_eq!(create(dir.path(), "工作", "计划", CreateKind::Markdown).unwrap(), "工作/计划.md");
        assert_eq!(create(dir.path(), "工作", "计划", CreateKind::Markdown).unwrap(), "工作/计划 (2).md");
        assert_eq!(create(dir.path(), "工作", "草图", CreateKind::Canvas).unwrap(), "工作/草图.excalidraw");
        assert_eq!(create(dir.path(), "工作", "结构", CreateKind::Mindmap).unwrap(), "工作/结构.mindmap");
        let mindmap: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(dir.path().join("工作/结构.mindmap")).unwrap(),
        )
        .unwrap();
        assert_eq!(mindmap["nodeData"]["topic"], "结构");
        assert_eq!(mindmap["direction"], 2);
        assert_eq!(create(dir.path(), "工作", "归档", CreateKind::Folder).unwrap(), "工作/归档");
        assert!(create(dir.path(), "工作", ".secret", CreateKind::Folder).is_err());
        assert!(create(dir.path(), "工作", "CON.txt", CreateKind::Folder).is_err());
        assert!(create(dir.path(), ".assets", "bad", CreateKind::Markdown).is_err());
    }
}
