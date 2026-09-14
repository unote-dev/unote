use tauri::{AppHandle, Manager, State};
use tauri_plugin_opener::OpenerExt;

use crate::auth;
use crate::domain::{now_nanos, Workspace};
use serde::Serialize;

use crate::state::{
    bootstrap_inner, create_notebook, create_note, emit_snapshot, ensure_session_workspace,
    full_sync_locked, open_debug_workspace, persist_structural, schedule_save, AppState, Snapshot,
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNoteResult {
    pub snapshot: Snapshot,
    pub note_id: String,
}
use crate::workspace::remove_notebook_dir;

fn snap(app: &AppHandle) -> Snapshot {
    let state = app.state::<AppState>();
    let inner = state.inner.lock().unwrap();
    inner.snapshot()
}

fn lock_state(app: &AppHandle) -> tauri::State<'_, AppState> {
    app.state::<AppState>()
}

#[tauri::command]
pub fn bootstrap(state: State<AppState>) -> Result<Snapshot, String> {
    let mut inner = state.inner.lock().unwrap();
    bootstrap_inner(&mut inner)?;
    Ok(inner.snapshot())
}

#[tauri::command]
pub fn debug_open_temp_workspace(state: State<AppState>) -> Result<Snapshot, String> {
    if !cfg!(debug_assertions) {
        return Err("发行版不提供临时工作区".into());
    }
    let mut inner = state.inner.lock().unwrap();
    open_debug_workspace(&mut inner)?;
    Ok(inner.snapshot())
}

#[tauri::command]
pub fn get_snapshot(state: State<AppState>) -> Snapshot {
    state.inner.lock().unwrap().snapshot()
}

#[tauri::command]
pub fn create_notebook_cmd(app: AppHandle, name: String) -> Result<Snapshot, String> {
    {
        let state = lock_state(&app);
        let mut inner = state.inner.lock().unwrap();
        create_notebook(&mut inner, name)?;
    }
    persist_structural(&app)
}

#[tauri::command]
pub fn rename_notebook_cmd(app: AppHandle, id: String, name: String) -> Result<Snapshot, String> {
    {
        let state = lock_state(&app);
        let mut inner = state.inner.lock().unwrap();
        inner.data.rename_notebook(&id, name).map_err(|e| e.to_string())?;
    }
    persist_structural(&app)
}

#[tauri::command]
pub fn trash_notebook_cmd(app: AppHandle, id: String) -> Result<Snapshot, String> {
    {
        let state = lock_state(&app);
        let mut inner = state.inner.lock().unwrap();
        inner.data.trash_notebook(&id).map_err(|e| e.to_string())?;
    }
    persist_structural(&app)
}

#[tauri::command]
pub fn restore_notebook_cmd(app: AppHandle, id: String) -> Result<Snapshot, String> {
    {
        let state = lock_state(&app);
        let mut inner = state.inner.lock().unwrap();
        inner.data.restore_notebook(&id).map_err(|e| e.to_string())?;
    }
    persist_structural(&app)
}

#[tauri::command]
pub fn permanently_delete_notebook_cmd(app: AppHandle, id: String) -> Result<Snapshot, String> {
    {
        let state = lock_state(&app);
        let mut inner = state.inner.lock().unwrap();
        let root = inner
            .workspace_root
            .clone()
            .ok_or_else(|| "尚未打开工作区".to_string())?;
        inner
            .data
            .permanently_delete_notebook(&id)
            .map_err(|e| e.to_string())?;
        remove_notebook_dir(&root, &id).map_err(|e| e.to_string())?;
    }
    persist_structural(&app)
}

#[tauri::command]
pub fn create_note_cmd(app: AppHandle, notebook_id: Option<String>) -> Result<CreateNoteResult, String> {
    let note_id = {
        let state = lock_state(&app);
        let mut inner = state.inner.lock().unwrap();
        create_note(&mut inner, notebook_id)?
    };
    let snapshot = persist_structural(&app)?;
    Ok(CreateNoteResult { snapshot, note_id })
}

#[tauri::command]
pub fn update_note_cmd(
    app: AppHandle,
    id: String,
    title: String,
    body: String,
) -> Result<Snapshot, String> {
    let gen = {
        let state = lock_state(&app);
        let mut inner = state.inner.lock().unwrap();
        inner
            .data
            .update_note(&id, title, body, now_nanos())
            .map_err(|e| e.to_string())?;
        inner.save_status = crate::state::SaveStatus::Dirty;
        inner.save_generation += 1;
        inner.save_generation
    };
    schedule_save(app.clone(), gen);
    Ok(snap(&app))
}

#[tauri::command]
pub fn save_workspace_now(app: AppHandle) -> Result<Snapshot, String> {
    persist_structural(&app)
}

#[tauri::command]
pub fn full_sync(app: AppHandle) -> Result<Snapshot, String> {
    {
        let state = lock_state(&app);
        let mut inner = state.inner.lock().unwrap();
        full_sync_locked(&mut inner)?;
    }
    emit_snapshot(&app);
    Ok(snap(&app))
}

#[tauri::command]
pub fn start_oauth(app: AppHandle) -> Result<Snapshot, String> {
    let handle = app.clone();
    let session = auth::complete_login(move |url| {
        handle
            .opener()
            .open_url(url, None::<&str>)
            .map_err(|_| auth::AuthError::Message("无法打开浏览器".into()))
    })
    .map_err(|e| e.to_string())?;
    {
        let state = lock_state(&app);
        let mut inner = state.inner.lock().unwrap();
        auth::save_session(&session).map_err(|e| e.to_string())?;
        inner.session = Some(session);
        ensure_session_workspace(&mut inner)?;
    }
    emit_snapshot(&app);
    Ok(snap(&app))
}

#[tauri::command]
pub fn logout(app: AppHandle) -> Result<Snapshot, String> {
    {
        let state = lock_state(&app);
        let mut inner = state.inner.lock().unwrap();
        auth::delete_session().map_err(|e| e.to_string())?;
        inner.session = None;
        inner.workspace_root = None;
        inner.data = Workspace::new_empty();
        inner.debug_workspace = false;
        inner.sync_status = crate::state::SyncStatus::Idle;
        inner.save_status = crate::state::SaveStatus::Saved;
        inner.error_message = None;
    }
    emit_snapshot(&app);
    Ok(snap(&app))
}

#[tauri::command]
pub fn open_workspace_folder(app: AppHandle) -> Result<(), String> {
    let path = {
        let state = lock_state(&app);
        let inner = state.inner.lock().unwrap();
        inner
            .workspace_root
            .clone()
            .ok_or_else(|| "尚未打开工作区".to_string())?
    };
    app.opener()
        .open_path(path.to_string_lossy().as_ref(), None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_image_cmd(
    app: AppHandle,
    data: String,
    filename: String,
) -> Result<String, String> {
    let state = lock_state(&app);
    let inner = state.inner.lock().unwrap();
    let root = inner
        .workspace_root
        .clone()
        .ok_or_else(|| "尚未打开工作区".to_string())?;
    drop(inner);

    let assets_dir = root.join(".assets");
    std::fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;

    // Strip data URL prefix if present (e.g. "data:image/png;base64,")
    let raw = if data.contains(',') {
        data.split(',').last().unwrap_or(&data)
    } else {
        &data
    };

    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(raw)
        .map_err(|e| format!("解码失败: {e}"))?;

    // Generate unique filename with timestamp
    let ext = filename.split('.').last().unwrap_or("png");
    let ts = crate::domain::now_nanos();
    let save_name = format!("img-{ts}.{ext}");
    let save_path = assets_dir.join(&save_name);

    std::fs::write(&save_path, &bytes).map_err(|e| e.to_string())?;

    // Return absolute path for convertFileSrc
    Ok(save_path.to_string_lossy().into_owned())
}
