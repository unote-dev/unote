use std::path::PathBuf;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::auth::{self, PublicSession, Session};
use crate::domain::{new_note_id, new_notebook_id, now_nanos, Workspace};
use crate::git::{self, HistoryRelation};
use crate::workspace::{
    debug_workspace_root, init_empty_workspace, load_workspace, repo_root,
    save_workspace,
};

pub const EVENT_SNAPSHOT: &str = "unote://snapshot";
pub const SAVE_DEBOUNCE_MS: u64 = 600;
pub const IDLE_PUSH_MS: u64 = 1500;
pub const FULL_SYNC_INTERVAL_MS: u64 = 120_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SyncStatus {
    Idle,
    Saved,
    Syncing,
    Synced,
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SaveStatus {
    Saved,
    Dirty,
    Saving,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub opened: bool,
    pub debug: bool,
    pub is_debug_build: bool,
    pub workspace_root: Option<String>,
    pub inbox_id: String,
    pub notebooks: Vec<crate::domain::Notebook>,
    pub notes: Vec<crate::domain::Note>,
    pub sync_status: SyncStatus,
    pub save_status: SaveStatus,
    pub error_message: Option<String>,
    pub session: Option<PublicSession>,
    pub last_sync_at: Option<u64>,
}

pub struct Inner {
    pub app_data_dir: PathBuf,
    pub workspace_root: Option<PathBuf>,
    pub debug_workspace: bool,
    pub data: Workspace,
    pub save_generation: u64,
    pub push_generation: u64,
    pub sync_status: SyncStatus,
    pub save_status: SaveStatus,
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
            data: Workspace::new_empty(),
            save_generation: 0,
            push_generation: 0,
            sync_status: SyncStatus::Idle,
            save_status: SaveStatus::Saved,
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
            inbox_id: self.data.inbox_id.clone(),
            notebooks: self.data.notebooks.clone(),
            notes: self.data.notes.clone(),
            sync_status: self.sync_status,
            save_status: self.save_status,
            error_message: self.error_message.clone(),
            session: self.session.as_ref().map(|s| s.public()),
            last_sync_at: self.last_sync_at,
        }
    }

    pub fn set_error(&mut self, message: String) {
        self.sync_status = SyncStatus::Error;
        self.error_message = Some(message);
    }

    pub fn clear_error(&mut self) {
        if self.sync_status == SyncStatus::Error {
            self.sync_status = SyncStatus::Saved;
        }
        self.error_message = None;
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

pub fn is_current_generation(task: u64, current: u64) -> bool {
    task == current
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
    inner.data = load_workspace(&root).map_err(|e| e.to_string())?;
    inner.last_sync_at = load_meta(&root);
    inner.workspace_root = Some(root);
    inner.debug_workspace = true;
    inner.sync_status = SyncStatus::Synced;
    inner.save_status = SaveStatus::Saved;
    inner.error_message = None;
    Ok(())
}

fn persist_disk(inner: &mut Inner) -> Result<(), String> {
    let root = inner
        .workspace_root
        .as_ref()
        .ok_or_else(|| "尚未打开工作区".to_string())?;
    inner.save_status = SaveStatus::Saving;
    save_workspace(root, &inner.data).map_err(|e| e.to_string())?;
    inner.save_status = SaveStatus::Saved;
    if inner.sync_status != SyncStatus::Syncing {
        inner.sync_status = SyncStatus::Saved;
    }
    Ok(())
}

pub fn persist_structural(app: &AppHandle) -> Result<Snapshot, String> {
    let (push_gen, snapshot) = {
        let state = app.state::<AppState>();
        let mut inner = state.inner.lock().unwrap();
        persist_disk(&mut inner)?;
        inner.push_generation += 1;
        let gen = inner.push_generation;
        (gen, inner.snapshot())
    };
    emit_snapshot(app);
    schedule_idle_push(app.clone(), push_gen);
    Ok(snapshot)
}

pub fn schedule_save(app: AppHandle, gen: u64) {
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(SAVE_DEBOUNCE_MS));
        let state = app.state::<AppState>();
        {
            let mut inner = state.inner.lock().unwrap();
            if !is_current_generation(gen, inner.save_generation) {
                return;
            }
            if let Err(e) = persist_disk(&mut inner) {
                inner.set_error(e);
                drop(inner);
                emit_snapshot(&app);
                return;
            }
            inner.push_generation += 1;
            let push_gen = inner.push_generation;
            drop(inner);
            emit_snapshot(&app);
            schedule_idle_push(app, push_gen);
        }
    });
}

pub fn schedule_idle_push(app: AppHandle, gen: u64) {
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(IDLE_PUSH_MS));
        let state = app.state::<AppState>();
        let mut inner = state.inner.lock().unwrap();
        if !is_current_generation(gen, inner.push_generation) {
            return;
        }
        if inner.syncing {
            return;
        }
        match idle_push_locked(&mut inner) {
            Ok(()) => {}
            Err(e) => inner.set_error(e),
        }
        drop(inner);
        emit_snapshot(&app);
    });
}

fn idle_push_locked(inner: &mut Inner) -> Result<(), String> {
    let root = inner
        .workspace_root
        .as_ref()
        .ok_or_else(|| "尚未打开工作区".to_string())?
        .clone();
    persist_disk(inner)?;
    git::commit_if_changed(&root, "unote: 同步笔记").map_err(|e| e.to_string())?;
    if let Some(session) = inner.session.clone() {
        if git::has_origin(&root) {
            git::push_current(&root, &session.token.access_token).map_err(|e| e.to_string())?;
        }
    }
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
        persist_disk(inner)?;
        git::commit_if_changed(&root, "unote: 同步笔记").map_err(|e| e.to_string())?;
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
                return Err("本地与远端已分叉，已停止同步。两端提交均保留，请手动处理后再同步。".into());
            }
            HistoryRelation::FastForward => {
                let branch = git::current_branch(&root)
                    .map_err(|e| e.to_string())?
                    .or_else(|| git::preferred_remote_branch(&root))
                    .ok_or_else(|| "无法确定分支".to_string())?;
                git::fast_forward(&root, &branch).map_err(|e| e.to_string())?;
                inner.data = load_workspace(&root).map_err(|e| e.to_string())?;
            }
            HistoryRelation::Same | HistoryRelation::Ahead | HistoryRelation::NoRemote => {}
        }
        git::push_current(&root, &session.token.access_token).map_err(|e| e.to_string())?;
        inner.data = load_workspace(&root).map_err(|e| e.to_string())?;
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
    let mut session = inner
        .session
        .clone()
        .ok_or_else(|| "未登录".to_string())?;
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
                if !root.join("notebooks.json").exists() {
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
    inner.data = load_workspace(&root).map_err(|e| {
        format!("本地仓库读取失败，原文件已保留：{e}")
    })?;
    inner.last_sync_at = load_meta(&root);
    if inner.sync_status != SyncStatus::Error {
        inner.sync_status = SyncStatus::Synced;
    }
    inner.save_status = SaveStatus::Saved;
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
    inner.data = load_workspace(root).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn create_notebook(inner: &mut Inner, name: String) -> Result<(), String> {
    let id = new_notebook_id(now_nanos());
    inner.data.create_notebook(id, name).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn create_note(inner: &mut Inner, notebook_id: Option<String>) -> Result<String, String> {
    let id = new_note_id(now_nanos());
    let now = now_nanos();
    inner
        .data
        .create_note(id.clone(), notebook_id.as_deref(), String::new(), String::new(), now)
        .map_err(|e| e.to_string())?;
    Ok(id)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stale_save_generation_is_skipped() {
        assert!(is_current_generation(3, 3));
        assert!(!is_current_generation(2, 3));
    }
}
