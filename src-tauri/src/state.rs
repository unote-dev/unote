use std::path::PathBuf;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::auth::{self, PublicSession, Session};
use crate::git::{self, HistoryRelation};
use crate::workspace::{debug_workspace_root, init_empty_workspace, repo_root};

pub const EVENT_SNAPSHOT: &str = "unote://snapshot";
pub const FULL_SYNC_INTERVAL_MS: u64 = 120_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SyncStatus {
    Idle,
    Syncing,
    Synced,
    Error,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub opened: bool,
    pub debug: bool,
    pub is_debug_build: bool,
    pub workspace_root: Option<String>,
    pub sync_status: SyncStatus,
    pub error_message: Option<String>,
    pub session: Option<PublicSession>,
    pub last_sync_at: Option<u64>,
}

pub struct Inner {
    pub app_data_dir: PathBuf,
    pub workspace_root: Option<PathBuf>,
    pub debug_workspace: bool,
    pub sync_status: SyncStatus,
    pub syncing: bool,
    pub session: Option<Session>,
    pub error_message: Option<String>,
    pub last_sync_at: Option<u64>,
}

impl Inner {
    pub fn new(app_data_dir: PathBuf) -> Self {
        Self {
            app_data_dir,
            workspace_root: None,
            debug_workspace: false,
            sync_status: SyncStatus::Idle,
            syncing: false,
            session: None,
            error_message: None,
            last_sync_at: None,
        }
    }

    pub fn snapshot(&self) -> Snapshot {
        Snapshot {
            opened: self.workspace_root.is_some(),
            debug: self.debug_workspace,
            is_debug_build: cfg!(debug_assertions),
            workspace_root: self
                .workspace_root
                .as_ref()
                .map(|p| p.to_string_lossy().into_owned()),
            sync_status: self.sync_status,
            error_message: self.error_message.clone(),
            session: self.session.as_ref().map(|s| s.public()),
            last_sync_at: self.last_sync_at,
        }
    }

    pub fn set_error(&mut self, message: String) {
        self.sync_status = SyncStatus::Error;
        self.error_message = Some(message);
    }
}

pub struct AppState {
    pub inner: Mutex<Inner>,
}

impl AppState {
    pub fn new(app_data_dir: PathBuf) -> Self {
        Self {
            inner: Mutex::new(Inner::new(app_data_dir)),
        }
    }
}

pub fn emit_snapshot(app: &AppHandle) {
    let payload = {
        let state = app.state::<AppState>();
        let Ok(inner) = state.inner.lock() else {
            return;
        };
        inner.snapshot()
    };
    let _ = app.emit(EVENT_SNAPSHOT, payload);
}

pub fn open_debug_workspace(inner: &mut Inner) -> Result<(), String> {
    let root = debug_workspace_root(&inner.app_data_dir);
    init_empty_workspace(&root).map_err(|e| e.to_string())?;
    git::ensure_repo(&root).map_err(|e| e.to_string())?;
    inner.last_sync_at = load_meta(&root);
    inner.workspace_root = Some(root);
    inner.debug_workspace = true;
    inner.sync_status = SyncStatus::Synced;
    inner.error_message = None;
    Ok(())
}

pub fn full_sync_locked(inner: &mut Inner) -> Result<(), String> {
    if inner.syncing {
        return Err("同步进行中".into());
    }
    let root = inner
        .workspace_root
        .as_ref()
        .ok_or_else(|| "尚未打开工作区".to_string())?
        .clone();
    inner.syncing = true;
    inner.sync_status = SyncStatus::Syncing;
    inner.error_message = None;
    let result = (|| {
        git::commit_if_changed(&root, "unote: 同步文档").map_err(|e| e.to_string())?;
        let Some(session) = inner.session.clone() else {
            inner.sync_status = SyncStatus::Synced;
            return Ok(());
        };
        if !git::has_origin(&root) {
            git::set_origin(&root, &session.git_https_url()).map_err(|e| e.to_string())?;
        }
        if let Err(e) = git::fetch(&root, &session.token.access_token) {
            return Err(format!("获取远端失败（本地数据已保留）：{e}"));
        }
        match git::analyze_history(&root).map_err(|e| e.to_string())? {
            HistoryRelation::Diverged => {
                return Err(
                    "本地与远端已分叉，已停止同步。两端提交均保留，请手动处理后再同步。".into(),
                );
            }
            HistoryRelation::FastForward => {
                let branch = git::current_branch(&root)
                    .map_err(|e| e.to_string())?
                    .or_else(|| git::preferred_remote_branch(&root))
                    .ok_or_else(|| "无法确定分支".to_string())?;
                git::fast_forward(&root, &branch).map_err(|e| e.to_string())?;
            }
            HistoryRelation::Same | HistoryRelation::Ahead | HistoryRelation::NoRemote => {}
        }
        git::push_current(&root, &session.token.access_token).map_err(|e| e.to_string())?;
        inner.last_sync_at = Some(now_nanos());
        save_meta(&root, inner.last_sync_at);
        inner.sync_status = SyncStatus::Synced;
        Ok(())
    })();
    inner.syncing = false;
    if let Err(e) = &result {
        inner.set_error(e.clone());
    }
    result
}

pub fn ensure_session_workspace(inner: &mut Inner) -> Result<(), String> {
    let mut session = inner.session.clone().ok_or_else(|| "未登录".to_string())?;
    if session.token_needs_refresh() {
        let _ = auth::refresh_token(&mut session);
        inner.session = Some(session.clone());
        let _ = auth::save_session(&session);
    }
    auth::ensure_remote_repo(&session).map_err(|e| e.to_string())?;
    let root = repo_root(
        &inner.app_data_dir,
        &session.host,
        &session.login,
        &session.repo,
    );
    if !root.join(".git").exists() {
        match git::clone_repo(&session.git_https_url(), &root, &session.token.access_token) {
            Ok(()) => {
                if !root.join(".unote/settings.json").exists() {
                    init_empty_workspace(&root).map_err(|e| e.to_string())?;
                }
            }
            Err(_) => {
                init_empty_workspace(&root).map_err(|e| e.to_string())?;
                git::ensure_repo(&root).map_err(|e| e.to_string())?;
                git::set_origin(&root, &session.git_https_url()).map_err(|e| e.to_string())?;
            }
        }
    } else if !git::has_origin(&root) {
        git::set_origin(&root, &session.git_https_url()).map_err(|e| e.to_string())?;
    }
    inner.workspace_root = Some(root.clone());
    inner.debug_workspace = false;
    let _ = git::fetch(&root, &session.token.access_token);
    if let Ok(HistoryRelation::FastForward) = git::analyze_history(&root) {
        if let Some(branch) = git::current_branch(&root)
            .ok()
            .flatten()
            .or_else(|| git::preferred_remote_branch(&root))
        {
            let _ = git::fast_forward(&root, &branch);
        }
    } else if let Ok(HistoryRelation::Diverged) = git::analyze_history(&root) {
        inner.set_error("本地与远端已分叉，已停止自动同步。".into());
    }
    inner.last_sync_at = load_meta(&root);
    if inner.sync_status != SyncStatus::Error {
        inner.sync_status = SyncStatus::Synced;
    }
    Ok(())
}

pub fn bootstrap_inner(inner: &mut Inner) -> Result<(), String> {
    match auth::load_session().map_err(|e| e.to_string())? {
        Some(session) => {
            inner.session = Some(session);
            match ensure_session_workspace(inner) {
                Ok(()) => Ok(()),
                Err(e) => {
                    if inner.workspace_root.is_some() && load_fallback(inner).is_ok() {
                        inner.set_error(format!("离线模式：{e}"));
                        Ok(())
                    } else {
                        Err(e)
                    }
                }
            }
        }
        None => Ok(()),
    }
}

fn load_fallback(inner: &mut Inner) -> Result<(), String> {
    let root = inner
        .workspace_root
        .as_ref()
        .ok_or_else(|| "无本地工作区".to_string())?;
    if !root.exists() {
        return Err("无本地工作区".into());
    }
    Ok(())
}

fn meta_path(root: &std::path::Path) -> std::path::PathBuf {
    root.join(".unote-meta.json")
}

fn load_meta(root: &std::path::Path) -> Option<u64> {
    let path = meta_path(root);
    let data = std::fs::read_to_string(&path).ok()?;
    let v: serde_json::Value = serde_json::from_str(&data).ok()?;
    v.get("lastSyncAt").and_then(|v| v.as_u64())
}

fn save_meta(root: &std::path::Path, last_sync_at: Option<u64>) {
    let path = meta_path(root);
    let v = serde_json::json!({ "lastSyncAt": last_sync_at });
    let _ = std::fs::write(&path, serde_json::to_string_pretty(&v).unwrap_or_default());
}

pub fn start_periodic_sync(app: AppHandle) {
    thread::spawn(move || loop {
        thread::sleep(Duration::from_millis(FULL_SYNC_INTERVAL_MS));
        let state = app.state::<AppState>();
        let mut inner = state.inner.lock().unwrap();
        if inner.workspace_root.is_none() || inner.session.is_none() {
            continue;
        }
        let _ = full_sync_locked(&mut inner);
        drop(inner);
        emit_snapshot(&app);
    });
}

fn now_nanos() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn snapshot_omits_notebook_model() {
        let inner = Inner::new(PathBuf::from("/tmp/unote"));
        let json = serde_json::to_value(inner.snapshot()).unwrap();
        assert!(json.get("notebooks").is_none());
        assert!(json.get("notes").is_none());
        assert!(json.get("inboxId").is_none());
        assert!(json.get("saveStatus").is_none());
        assert_eq!(json["opened"], false);
        assert_eq!(json["syncStatus"], "idle");
    }
}
