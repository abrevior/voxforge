#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use voxforge::{config::Config, hotkey::HotkeyManager, AppState};

fn main() {
    env_logger::init();

    let config = Config::load().unwrap_or_default();
    let app_state = AppState::new(config.clone());

    tauri::Builder::default()
        .setup(move |app| {
            let app_handle = app.handle().clone();

            // Register hotkeys
            let _ = HotkeyManager::register(
                &app_handle,
                &config.hotkey_start,
                &config.hotkey_stop,
                &config.hotkey_history,
            );

            // Create main window (done by Tauri automatically from config)

            Ok(())
        })
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            voxforge::commands::start_recording,
            voxforge::commands::stop_recording,
            voxforge::commands::transcribe,
            voxforge::commands::inject_or_copy,
            voxforge::commands::save_to_history,
            voxforge::commands::get_history,
            voxforge::commands::delete_history_entry,
            voxforge::commands::clear_history,
            voxforge::commands::get_config,
            voxforge::commands::save_config,
            voxforge::commands::get_recording_state,
            voxforge::commands::get_rms_level,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
