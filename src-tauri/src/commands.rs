use base64::Engine;
use std::io::Write;
use std::path::{Component, Path};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_opener::OpenerExt;

use crate::auth;
use crate::domain::{now_nanos, Workspace};
use serde::Serialize;

use crate::state::{
    bootstrap_inner, create_note, create_notebook, emit_snapshot, ensure_session_workspace,
    full_sync_locked, open_debug_workspace, persist_structural, schedule_save, AppState, Snapshot,
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNoteResult {
    pub snapshot: Snapshot,
    pub note_id: String,
}
use crate::workspace::remove_notebook_dir;

fn workspace_root(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let state = lock_state(app);
    let root = state
        .inner
        .lock()
        .unwrap()
        .workspace_root
        .clone()
        .ok_or_else(|| "尚未打开工作区".to_string());
    root
}

#[tauri::command]
pub fn get_content_tree(app: AppHandle) -> Result<Vec<crate::content::ContentEntry>, String> {
    crate::content::scan(&workspace_root(&app)?)
}

#[tauri::command]
pub fn read_document(app: AppHandle, path: String) -> Result<String, String> {
    crate::content::read(&workspace_root(&app)?, &path)
}

#[tauri::command]
pub fn write_document(app: AppHandle, path: String, content: String) -> Result<(), String> {
    crate::content::write(&workspace_root(&app)?, &path, &content)
}

#[tauri::command]
pub fn create_content(
    app: AppHandle,
    parent: String,
    name: String,
    kind: crate::content::CreateKind,
) -> Result<String, String> {
    crate::content::create(&workspace_root(&app)?, &parent, &name, kind)
}

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
        inner
            .data
            .rename_notebook(&id, name)
            .map_err(|e| e.to_string())?;
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
        inner
            .data
            .restore_notebook(&id)
            .map_err(|e| e.to_string())?;
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
pub fn create_note_cmd(
    app: AppHandle,
    notebook_id: Option<String>,
) -> Result<CreateNoteResult, String> {
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
pub fn save_image_cmd(app: AppHandle, data: String, filename: String) -> Result<String, String> {
    let state = lock_state(&app);
    let inner = state.inner.lock().unwrap();
    let root = inner
        .workspace_root
        .clone()
        .ok_or_else(|| "尚未打开工作区".to_string())?;
    drop(inner);

    let assets_dir = root.join(".assets");
    if std::fs::symlink_metadata(&assets_dir)
        .map(|metadata| metadata.file_type().is_symlink())
        .unwrap_or(false)
    {
        return Err("资源目录不能是符号链接".into());
    }
    std::fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;
    let canonical_root = root.canonicalize().map_err(|error| error.to_string())?;
    let canonical_assets = assets_dir
        .canonicalize()
        .map_err(|error| error.to_string())?;
    if !canonical_assets.starts_with(canonical_root) {
        return Err("资源目录超出仓库".into());
    }

    // Strip data URL prefix if present (e.g. "data:image/png;base64,")
    let raw = if data.contains(',') {
        data.split(',').last().unwrap_or(&data)
    } else {
        &data
    };

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(raw)
        .map_err(|e| format!("解码失败: {e}"))?;

    let requested_ext = Path::new(&filename)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("png")
        .to_ascii_lowercase();
    let ext = match requested_ext.as_str() {
        "png" | "jpg" | "jpeg" | "gif" | "webp" => requested_ext,
        _ => "png".into(),
    };
    let requested_stem = Path::new(&filename)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("image");
    let stem: String = requested_stem
        .chars()
        .map(|character| {
            if character.is_control() || "<>:\"/\\|?*".contains(character) {
                '-'
            } else {
                character
            }
        })
        .collect();
    let stem = stem.trim().trim_matches('.');
    let stem = if stem.is_empty() { "image" } else { stem };

    for number in 1.. {
        let save_name = if number == 1 {
            format!("{stem}.{ext}")
        } else {
            format!("{stem} ({number}).{ext}")
        };
        let save_path = canonical_assets.join(&save_name);
        let mut temporary = tempfile::NamedTempFile::new_in(&canonical_assets)
            .map_err(|error| error.to_string())?;
        temporary
            .write_all(&bytes)
            .map_err(|error| error.to_string())?;
        temporary
            .as_file()
            .sync_all()
            .map_err(|error| error.to_string())?;
        match temporary.persist_noclobber(&save_path) {
            Ok(_) => return Ok(format!(".assets/{save_name}")),
            Err(error) if error.error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error.error.to_string()),
        }
    }
    unreachable!()
}

#[tauri::command]
pub fn read_asset_data_url(app: AppHandle, path: String) -> Result<String, String> {
    let root = workspace_root(&app)?;
    let relative = Path::new(&path);
    let mut components = relative.components();
    if components.next() != Some(Component::Normal(std::ffi::OsStr::new(".assets")))
        || components.clone().count() != 1
        || !matches!(components.next(), Some(Component::Normal(_)))
    {
        return Err("无效的资源路径".into());
    }
    let assets = root
        .join(".assets")
        .canonicalize()
        .map_err(|error| error.to_string())?;
    let resolved = root
        .join(relative)
        .canonicalize()
        .map_err(|error| error.to_string())?;
    if !resolved.starts_with(assets) || !resolved.is_file() {
        return Err("资源不存在".into());
    }
    let mime = match resolved
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        _ => "image/png",
    };
    let bytes = std::fs::read(resolved).map_err(|error| error.to_string())?;
    Ok(format!(
        "data:{mime};base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    ))
}
