use std::fs;
use std::path::{Path, PathBuf};

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
    let system_dir = root.join(".unote");
    fs::create_dir_all(&system_dir).map_err(|e| WorkspaceError::Message(e.to_string()))?;
    let settings = system_dir.join("settings.json");
    if !settings.exists() {
        fs::write(&settings, "{\n  \"schemaVersion\": 1\n}\n")
            .map_err(|e| WorkspaceError::Message(e.to_string()))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn repo_path_is_scoped_by_host_and_login() {
        let app_data = PathBuf::from("/tmp/unote-app");
        let repo = repo_root(&app_data, "gitee", "alice", "alice.gitee.unote");
        assert!(repo.starts_with(app_data.join("repos").join("gitee").join("alice")));
    }

    #[test]
    fn init_empty_writes_settings_only() {
        let dir = tempdir().unwrap();
        init_empty_workspace(dir.path()).unwrap();
        assert_eq!(
            fs::read_to_string(dir.path().join(".unote/settings.json")).unwrap(),
            "{\n  \"schemaVersion\": 1\n}\n"
        );
        assert!(!dir.path().join("notebooks.json").exists());
        assert!(!dir.path().join("session.json").exists());
    }
}
