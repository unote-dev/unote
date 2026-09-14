use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};

use serde::Serialize;

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
}
