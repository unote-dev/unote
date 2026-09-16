mod auth;
mod commands;
mod constants;
mod content;
mod git;
mod sharing;
mod state;
mod workspace;

use tauri::Manager;

use crate::state::{start_periodic_sync, AppState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let app_data = app.path().app_data_dir().expect("missing app data dir");
            std::fs::create_dir_all(&app_data).ok();
            app.manage(AppState::new(app_data));
            app.manage(sharing::ShareState::new());
            start_periodic_sync(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::bootstrap,
            commands::debug_open_temp_workspace,
            commands::get_snapshot,
            commands::full_sync,
            commands::get_content_tree,
            commands::get_trash_tree,
            commands::create_content,
            commands::trash_content,
            commands::read_document,
            commands::write_document,
            commands::start_share,
            commands::stop_share,
            commands::stop_all_shares,
            commands::list_shares,
            commands::start_oauth,
            commands::logout,
            commands::open_workspace_folder,
            commands::save_image_cmd,
            commands::read_asset_data_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
