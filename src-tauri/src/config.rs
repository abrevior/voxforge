use anyhow::Result;
use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub openai_api_key: String,
    pub hotkey_start: String,
    pub hotkey_stop: String,
    pub hotkey_history: String,
    pub language: String,
    pub model: String,
    pub ui_language: String,
    pub openai_api_base: String,
    pub output_mode: String,

    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_mic_style")]
    pub mic_style: String,
    #[serde(default = "default_true")]
    pub show_statusbar: bool,
    #[serde(default = "default_true")]
    pub show_overlay: bool,
    #[serde(default = "default_true")]
    pub auto_paste: bool,
    #[serde(default = "default_true")]
    pub punctuation: bool,

    #[serde(default)]
    pub overlay_x: Option<i32>,
    #[serde(default)]
    pub overlay_y: Option<i32>,
}

fn default_theme() -> String {
    "system".into()
}
fn default_mic_style() -> String {
    "classic".into()
}
fn default_true() -> bool {
    true
}

impl Default for Config {
    fn default() -> Self {
        Self {
            openai_api_key: std::env::var("OPENAI_API_KEY").unwrap_or_default(),
            hotkey_start: "ctrl+shift+space".to_string(),
            hotkey_stop: "ctrl+shift+space".to_string(),
            hotkey_history: "ctrl+shift+h".to_string(),
            language: "uk".to_string(),
            model: "whisper-1".to_string(),
            ui_language: "uk".to_string(),
            openai_api_base: "https://api.openai.com/v1".to_string(),
            output_mode: "inject".to_string(),
            theme: default_theme(),
            mic_style: default_mic_style(),
            show_statusbar: true,
            show_overlay: true,
            auto_paste: true,
            punctuation: true,
            overlay_x: None,
            overlay_y: None,
        }
    }
}

impl Config {
    pub fn load() -> Result<Self> {
        if let Ok(path) = Self::config_path() {
            if path.exists() {
                let content = fs::read_to_string(&path)?;
                return Ok(serde_json::from_str(&content)?);
            }
        }
        Ok(Self::default())
    }

    pub fn save(&self) -> Result<()> {
        let path = Self::config_path()?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let content = serde_json::to_string_pretty(self)?;
        fs::write(path, content)?;
        Ok(())
    }

    fn config_path() -> Result<PathBuf> {
        let proj_dirs = ProjectDirs::from("", "", "voxforge")
            .ok_or_else(|| anyhow::anyhow!("Could not determine config directory"))?;
        Ok(proj_dirs.config_dir().join("config.json"))
    }

    pub fn history_db_path() -> Result<PathBuf> {
        let proj_dirs = ProjectDirs::from("", "", "voxforge")
            .ok_or_else(|| anyhow::anyhow!("Could not determine data directory"))?;
        Ok(proj_dirs.data_dir().join("history.db"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const MINIMAL_JSON: &str = r#"{
        "openai_api_key":"","hotkey_start":"","hotkey_stop":"","hotkey_history":"",
        "language":"","model":"","ui_language":"","openai_api_base":"","output_mode":"inject"
    }"#;

    #[test]
    fn config_without_overlay_pos_defaults_to_none() {
        let cfg: Config = serde_json::from_str(MINIMAL_JSON).unwrap();
        assert_eq!(cfg.overlay_x, None);
        assert_eq!(cfg.overlay_y, None);
    }

    #[test]
    fn config_with_overlay_pos_parses() {
        let json = r#"{
            "openai_api_key":"","hotkey_start":"","hotkey_stop":"","hotkey_history":"",
            "language":"","model":"","ui_language":"","openai_api_base":"","output_mode":"inject",
            "overlay_x":120,"overlay_y":640
        }"#;
        let cfg: Config = serde_json::from_str(json).unwrap();
        assert_eq!(cfg.overlay_x, Some(120));
        assert_eq!(cfg.overlay_y, Some(640));
    }
}
