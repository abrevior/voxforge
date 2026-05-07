//! Local IPC over a Unix domain socket.
//!
//! Lets a tiny `voxforge-ctl` helper send commands ("toggle", "start",
//! "stop", "show") into the running app. This is what the user binds in
//! GNOME Settings → Custom Shortcut so a global hotkey works on Wayland
//! without needing the GlobalShortcuts portal or evdev access.

use std::path::PathBuf;

use anyhow::Result;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::net::{UnixListener, UnixStream};

use crate::state::{AppState, RecordingState};

fn hide_main_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.hide();
    }
}

pub fn socket_path() -> PathBuf {
    // Prefer XDG_RUNTIME_DIR (auto-cleaned, single-user-only on Linux);
    // fall back to a per-user data dir.
    if let Some(dirs) = directories::ProjectDirs::from("", "", "voxforge") {
        if let Some(runtime) = dirs.runtime_dir() {
            return runtime.join("voxforge.sock");
        }
        return dirs.data_local_dir().join("voxforge.sock");
    }
    PathBuf::from("/tmp/voxforge.sock")
}

pub async fn start_listener(app: AppHandle) -> Result<()> {
    let path = socket_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    // If a socket file exists, see whether something's actually listening.
    if path.exists() {
        if UnixStream::connect(&path).await.is_ok() {
            anyhow::bail!("another VoxForge instance is already listening on {}", path.display());
        }
        let _ = std::fs::remove_file(&path);
    }

    let listener = UnixListener::bind(&path)?;
    log::info!("ipc: listening on {}", path.display());

    loop {
        match listener.accept().await {
            Ok((stream, _)) => {
                let app = app.clone();
                tokio::spawn(async move { handle(app, stream).await });
            }
            Err(e) => log::warn!("ipc accept failed: {e}"),
        }
    }
}

async fn handle(app: AppHandle, stream: UnixStream) {
    let mut reader = BufReader::new(stream);
    let mut line = String::new();
    if reader.read_line(&mut line).await.is_err() {
        return;
    }
    let cmd = line.trim();
    log::debug!("ipc command: {cmd}");

    match cmd {
        "toggle" => {
            let state = app.state::<AppState>();
            match state.get_state() {
                RecordingState::Idle => {
                    hide_main_window(&app);
                    let _ = app.emit("hotkey:start", ());
                }
                RecordingState::Recording => {
                    let _ = app.emit("hotkey:stop", ());
                }
                RecordingState::Processing => {
                    log::debug!("ipc: toggle ignored — currently processing");
                }
            }
        }
        "start" => {
            hide_main_window(&app);
            let _ = app.emit("hotkey:start", ());
        }
        "stop" => {
            let _ = app.emit("hotkey:stop", ());
        }
        "history" => {
            let _ = app.emit("hotkey:history", ());
        }
        "show" => {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.unminimize();
                let _ = win.set_focus();
            }
        }
        "overlay-show" | "overlay-recording" => {
            if let Err(e) = crate::overlay::set_state(&app, crate::overlay::OverlayState::Recording) {
                log::warn!("ipc overlay-show failed: {e}");
            }
        }
        "overlay-transcribing" => {
            if let Err(e) = crate::overlay::set_state(&app, crate::overlay::OverlayState::Transcribing) {
                log::warn!("ipc overlay-transcribing failed: {e}");
            }
        }
        "overlay-done" => {
            if let Err(e) = crate::overlay::set_state(
                &app,
                crate::overlay::OverlayState::Done("Transcribed: hello world".to_string()),
            ) {
                log::warn!("ipc overlay-done failed: {e}");
            }
        }
        "overlay-hide" => {
            if let Err(e) = crate::overlay::set_state(&app, crate::overlay::OverlayState::Hidden) {
                log::warn!("ipc overlay-hide failed: {e}");
            }
        }
        other => log::warn!("ipc: unknown command: {other:?}"),
    }
}
