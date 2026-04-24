#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Manager, SystemTray, SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem};
use voxforge::{config::Config, hotkey::HotkeyManager, AppState};

fn main() {
    env_logger::init();

    let config = Config::load().unwrap_or_default();
    let app_state = AppState::new(config.clone());

    let system_tray_menu = SystemTrayMenu::new()
        .add_item(SystemTrayMenuItem::new("Open", "open"))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(SystemTrayMenuItem::new("History", "history"))
        .add_item(SystemTrayMenuItem::new("Settings", "settings"))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(SystemTrayMenuItem::new("Quit", "quit"));

    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle();

            // Register hotkeys
            HotkeyManager::register(
                &app_handle,
                &config.hotkey_start,
                &config.hotkey_stop,
                &config.hotkey_history,
            )
            .expect("Failed to register hotkeys");

            // Create main window
            let _main_window = tauri::WindowBuilder::new(
                app,
                "main",
                tauri::WindowUrl::App("index.html".into()),
            )
            .title("VoxForge")
            .inner_size(900.0, 700.0)
            .min_inner_size(400.0, 300.0)
            .visible(false)
            .build()?;

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
        .system_tray(SystemTray::new().with_menu(system_tray_menu))
        .on_system_tray_event(|app, event| {
            match event {
                SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                    "open" => {
                        let window = app.get_window("main").unwrap();
                        window.show().unwrap();
                        window.set_focus().unwrap();
                    }
                    "history" => {
                        let window = app.get_window("main").unwrap();
                        window.show().unwrap();
                        window.set_focus().unwrap();
                        let _ = window.emit("show-history", ());
                    }
                    "settings" => {
                        let window = app.get_window("main").unwrap();
                        window.show().unwrap();
                        window.set_focus().unwrap();
                        let _ = window.emit("show-settings", ());
                    }
                    "quit" => {
                        std::process::exit(0);
                    }
                    _ => {}
                },
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
