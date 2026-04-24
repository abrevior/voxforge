use tauri::AppHandle;
use tauri::GlobalShortcutManager;
use anyhow::Result;

pub struct HotkeyManager;

impl HotkeyManager {
    pub fn register(
        app: &AppHandle,
        hotkey_start: &str,
        hotkey_stop: &str,
        hotkey_history: &str,
    ) -> Result<()> {
        let mut shortcut_manager = app.global_shortcut_manager();

        // Register start hotkey
        shortcut_manager.register(hotkey_start, move || {
            let _ = app.emit_all("hotkey:start", ());
        })?;

        // Register stop hotkey (usually same as start)
        if hotkey_stop != hotkey_start {
            shortcut_manager.register(hotkey_stop, move || {
                let _ = app.emit_all("hotkey:stop", ());
            })?;
        }

        // Register history hotkey
        shortcut_manager.register(hotkey_history, move || {
            let _ = app.emit_all("hotkey:history", ());
        })?;

        Ok(())
    }

    pub fn unregister_all(app: &AppHandle) -> Result<()> {
        let mut shortcut_manager = app.global_shortcut_manager();
        shortcut_manager.unregister_all()?;
        Ok(())
    }
}
