mod auth;
mod codec;
mod commands;
mod content;
mod domain;
mod git;
mod state;
mod workspace;

use tauri::Manager;

use crate::state::{start_periodic_sync, AppState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data = app
                .path()
                .app_data_dir()
                .expect("missing app data dir");
            std::fs::create_dir_all(&app_data).ok();
            app.manage(AppState::new(app_data));
            start_periodic_sync(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::bootstrap,
            commands::debug_open_temp_workspace,
            commands::get_snapshot,
            commands::create_notebook_cmd,
            commands::rename_notebook_cmd,
            commands::trash_notebook_cmd,
            commands::restore_notebook_cmd,
            commands::permanently_delete_notebook_cmd,
            commands::create_note_cmd,
            commands::update_note_cmd,
            commands::save_workspace_now,
            commands::full_sync,
            commands::get_content_tree,
            commands::read_document,
            commands::write_document,
            commands::start_oauth,
            commands::logout,
            commands::open_workspace_folder,
            commands::save_image_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
