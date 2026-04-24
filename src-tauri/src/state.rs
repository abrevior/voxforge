use crate::audio::AudioRecorder;
use crate::config::Config;
use crate::history::HistoryManager;
use std::sync::{Arc, Mutex};

#[derive(Clone, Debug, PartialEq, serde::Serialize)]
pub enum RecordingState {
    #[serde(rename = "idle")]
    Idle,
    #[serde(rename = "recording")]
    Recording,
    #[serde(rename = "processing")]
    Processing,
}

pub struct AppState {
    pub config: Arc<Mutex<Config>>,
    pub recorder: Arc<Mutex<AudioRecorder>>,
    pub history: Arc<Mutex<HistoryManager>>,
    pub state: Arc<Mutex<RecordingState>>,
}

impl AppState {
    pub fn new(config: Config) -> Self {
        Self {
            config: Arc::new(Mutex::new(config)),
            recorder: Arc::new(Mutex::new(AudioRecorder::new())),
            history: Arc::new(Mutex::new(HistoryManager::new())),
            state: Arc::new(Mutex::new(RecordingState::Idle)),
        }
    }

    pub fn get_state(&self) -> RecordingState {
        self.state.lock().unwrap().clone()
    }

    pub fn set_state(&self, state: RecordingState) {
        *self.state.lock().unwrap() = state;
    }
}
