#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{
    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
};
use voxforge::{config::Config, AppState};

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}

fn main() {
    env_logger::init();

    let config = Config::load().unwrap_or_default();
    let app_state = AppState::new(config);

    let start_shortcut =
        Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space);
    let history_shortcut =
        Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyH);

    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if shortcut == &start_shortcut {
                        match event.state() {
                            ShortcutState::Pressed => {
                                let _ = app.emit("hotkey:start", ());
                            }
                            ShortcutState::Released => {
                                let _ = app.emit("hotkey:stop", ());
                            }
                        }
                    } else if shortcut == &history_shortcut
                        && event.state() == ShortcutState::Pressed
                    {
                        let _ = app.emit("hotkey:history", ());
                    }
                })
                .build(),
        )
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
        .setup(move |app| {
            // Register global hotkeys
            if let Err(e) = app.global_shortcut().register(start_shortcut) {
                log::warn!("failed to register start hotkey: {e}");
            }
            if let Err(e) = app.global_shortcut().register(history_shortcut) {
                log::warn!("failed to register history hotkey: {e}");
            }

            // Tray menu
            let show_i = MenuItem::with_id(app, "show", "Показати", true, None::<&str>)?;
            let settings_i =
                MenuItem::with_id(app, "settings", "Налаштування", true, None::<&str>)?;
            let history_i =
                MenuItem::with_id(app, "history", "Історія", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Вийти", true, None::<&str>)?;
            let menu = Menu::with_items(
                app,
                &[&show_i, &settings_i, &history_i, &quit_i],
            )?;

            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(tauri::include_image!("icons/tray-icon.png"))
                .icon_as_template(false)
                .tooltip("VoxForge")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "settings" => {
                        show_main_window(app);
                        let _ = app.emit("show-settings", ());
                    }
                    "history" => {
                        show_main_window(app);
                        let _ = app.emit("show-history", ());
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            // Show window on startup so the user has visible feedback.
            // Open Settings tab so the API key can be entered before first use.
            show_main_window(app.handle());
            let _ = app.emit("show-settings", ());

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
