use crate::config::Config;
use crate::history::HistoryEntry;
use crate::inject::{copy_to_clipboard, inject_text};
use crate::state::{AppState, RecordingState};
use crate::transcribe::TranscribeClient;
use tauri::{AppHandle, Emitter, Manager, Runtime, State};

fn set_tray_recording<R: Runtime>(app: &tauri::AppHandle<R>, recording: bool) {
    if let Some(tray) = app.tray_by_id("main-tray") {
        let icon = if recording {
            tauri::include_image!("icons/tray-icon-recording.png")
        } else {
            tauri::include_image!("icons/tray-icon.png")
        };
        let _ = tray.set_icon(Some(icon));
    }
}

#[tauri::command]
pub fn start_recording(state: State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    state.set_state(RecordingState::Recording);
    let mut recorder = state.recorder.lock();
    recorder.start().map_err(|e| e.to_string())?;
    let _ = crate::overlay::set_state(&app, crate::overlay::OverlayState::Recording);
    set_tray_recording(&app, true);
    Ok(())
}

#[tauri::command]
pub fn stop_recording(state: State<'_, AppState>, app: AppHandle) -> Result<Vec<u8>, String> {
    let mut recorder = state.recorder.lock();
    recorder.stop().map_err(|e| e.to_string())?;
    let _ = crate::overlay::set_state(&app, crate::overlay::OverlayState::Transcribing);
    set_tray_recording(&app, false);
    recorder.get_wav_bytes().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn transcribe(
    audio_bytes: Vec<u8>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<String, String> {
    state.set_state(RecordingState::Processing);

    let config = state.config.lock();
    let client = TranscribeClient::new(
        config.openai_api_key.clone(),
        config.openai_api_base.clone(),
        config.model.clone(),
    );
    let language = config.language.clone();

    drop(config);

    let result =
        tauri::async_runtime::block_on(async { client.transcribe(audio_bytes, &language).await });

    state.set_state(RecordingState::Idle);

    match result {
        Ok(text) => {
            let preview = if text.trim().is_empty() {
                "Empty transcription".to_string()
            } else if text.chars().count() > 60 {
                let cut: String = text.chars().take(58).collect();
                format!("{}…", cut)
            } else {
                text.clone()
            };
            let _ = crate::overlay::set_state(&app, crate::overlay::OverlayState::Done(preview));
            Ok(text)
        }
        Err(e) => {
            let msg = e.to_string();
            let _ = crate::overlay::set_state(
                &app,
                crate::overlay::OverlayState::Done(format!("Failed: {}", msg)),
            );
            Err(msg)
        }
    }
}

#[tauri::command]
pub fn inject_or_copy(text: String, state: State<'_, AppState>) -> Result<(), String> {
    let config = state.config.lock();
    let output_mode = config.output_mode.clone();
    drop(config);

    if output_mode == "clipboard" {
        copy_to_clipboard(&text).map_err(|e| e.to_string())?;
    } else {
        inject_text(&text).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn save_to_history(
    text: String,
    duration: f32,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let config = state.config.lock();
    let language = config.language.clone();
    drop(config);

    let history = state.history.lock();
    history
        .save(text, language, duration)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_history(state: State<'_, AppState>) -> Result<Vec<HistoryEntry>, String> {
    let history = state.history.lock();
    history.get_all().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_history_entry(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let history = state.history.lock();
    history.delete(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_history(state: State<'_, AppState>) -> Result<(), String> {
    let history = state.history.lock();
    history.clear().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_config(state: State<'_, AppState>) -> Result<Config, String> {
    let config = state.config.lock();
    Ok(config.clone())
}

#[tauri::command]
pub fn save_config(config: Config, state: State<'_, AppState>) -> Result<(), String> {
    config.save().map_err(|e| e.to_string())?;
    let mut state_config = state.config.lock();
    *state_config = config;
    Ok(())
}

#[tauri::command]
pub fn get_recording_state(state: State<'_, AppState>) -> Result<String, String> {
    serde_json::to_string(&state.get_state()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_rms_level(state: State<'_, AppState>) -> Result<f32, String> {
    let recorder = state.recorder.lock();
    Ok(recorder.get_rms_level())
}

/// Broadcast a hotkey-style event according to current state. Used by the
/// overlay window's orb click and any other "single button → toggle" path.
#[tauri::command]
pub fn toggle_recording(state: State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    match state.get_state() {
        RecordingState::Idle => {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.hide();
            }
            let _ = app.emit("hotkey:start", ());
        }
        RecordingState::Recording => {
            let _ = app.emit("hotkey:stop", ());
        }
        RecordingState::Processing => {}
    }
    Ok(())
}

#[tauri::command]
pub fn set_overlay_visible(visible: bool, app: AppHandle) -> Result<(), String> {
    crate::overlay::set_overlay_visible(&app, visible)
}
