//! Global shortcuts via the freedesktop XDG portal.
//!
//! Uses `org.freedesktop.portal.GlobalShortcuts` so the compositor
//! (Mutter / KWin / wlroots) owns the binding. Push-to-talk works on
//! Wayland because the portal emits both `Activated` (key down) and
//! `Deactivated` (key up).
//!
//! Returns `Err` if the portal is unavailable; main.rs falls back to
//! the in-process X11 grab provided by `tauri-plugin-global-shortcut`.

use ashpd::desktop::{
    CreateSessionOptions,
    global_shortcuts::{BindShortcutsOptions, GlobalShortcuts, NewShortcut},
};
use futures_util::StreamExt;
use tauri::{AppHandle, Emitter};

pub const START_ID: &str = "voxforge.start";
pub const HISTORY_ID: &str = "voxforge.history";

pub async fn run(app: AppHandle) -> ashpd::Result<()> {
    let proxy = GlobalShortcuts::new().await?;
    let session = proxy
        .create_session(CreateSessionOptions::default())
        .await?;

    let shortcuts = [
        NewShortcut::new(START_ID, "VoxForge — hold to record")
            .preferred_trigger(Some("CTRL+SHIFT+space")),
        NewShortcut::new(HISTORY_ID, "VoxForge — show transcription history")
            .preferred_trigger(Some("CTRL+SHIFT+h")),
    ];

    let bound = proxy
        .bind_shortcuts(&session, &shortcuts, None, BindShortcutsOptions::default())
        .await?
        .response()?;

    log::info!(
        "Portal global shortcuts bound: {}",
        bound
            .shortcuts()
            .iter()
            .map(|s| format!("{} -> {}", s.id(), s.trigger_description()))
            .collect::<Vec<_>>()
            .join(", ")
    );

    let mut activated = proxy.receive_activated().await?;
    let mut deactivated = proxy.receive_deactivated().await?;

    loop {
        tokio::select! {
            Some(event) = activated.next() => {
                match event.shortcut_id() {
                    START_ID => {
                        log::debug!("portal: start activated");
                        let _ = app.emit("hotkey:start", ());
                    }
                    HISTORY_ID => {
                        log::debug!("portal: history activated");
                        let _ = app.emit("hotkey:history", ());
                    }
                    other => log::debug!("portal: unknown shortcut activated: {other}"),
                }
            }
            Some(event) = deactivated.next() => {
                if event.shortcut_id() == START_ID {
                    log::debug!("portal: start deactivated");
                    let _ = app.emit("hotkey:stop", ());
                }
            }
            else => {
                log::warn!("portal: shortcut signal streams ended");
                break;
            }
        }
    }

    Ok(())
}
