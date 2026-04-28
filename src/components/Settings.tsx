import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Config } from "../types/api";

interface SettingsProps {
  onClose?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setConfig(await invoke<Config>("get_config"));
      } catch (err) {
        console.error("Failed to load config:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setStatus(null);
    try {
      await invoke("save_config", { config });
      setStatus("Saved");
      setTimeout(() => setStatus(null), 2000);
    } catch (err) {
      setStatus(`Error: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading settings…</div>;
  }
  if (!config) {
    return <div className="loading">Failed to load settings</div>;
  }

  return (
    <div className="page-narrow">
      <div className="page-header">
        <h1>Settings</h1>
        <span className="page-subtitle">~/.config/voxforge</span>
      </div>

      <div className="form">
        <div className="form-group">
          <label className="form-label">OpenAI API key</label>
          <input
            type="password"
            className="input"
            value={config.openai_api_key}
            onChange={(e) =>
              setConfig({ ...config, openai_api_key: e.target.value })
            }
            placeholder="sk-…"
          />
          <span className="form-help">
            platform.openai.com → API keys. Stored locally only.
          </span>
        </div>

        <div className="form-group">
          <label className="form-label">API base URL</label>
          <input
            type="text"
            className="input"
            value={config.openai_api_base}
            onChange={(e) =>
              setConfig({ ...config, openai_api_base: e.target.value })
            }
            placeholder="https://api.openai.com/v1"
          />
          <span className="form-help">
            Override for self-hosted Whisper-compatible endpoints.
          </span>
        </div>

        <div className="form-group">
          <label className="form-label">Transcription language</label>
          <select
            className="select"
            value={config.language}
            onChange={(e) =>
              setConfig({ ...config, language: e.target.value })
            }
          >
            <option value="uk">Ukrainian (uk)</option>
            <option value="en">English (en)</option>
            <option value="es">Spanish (es)</option>
            <option value="fr">French (fr)</option>
            <option value="de">German (de)</option>
            <option value="zh">Chinese (zh)</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Output mode</label>
          <select
            className="select"
            value={config.output_mode}
            onChange={(e) =>
              setConfig({ ...config, output_mode: e.target.value })
            }
          >
            <option value="inject">Inject text via xdotool</option>
            <option value="clipboard">Copy to clipboard</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Record hotkey</label>
          <input
            type="text"
            className="input"
            value={config.hotkey_start}
            onChange={(e) =>
              setConfig({ ...config, hotkey_start: e.target.value })
            }
            placeholder="ctrl+shift+space"
          />
          <span className="form-help">
            E.g. ctrl+shift+space, super+v. Hold to record, release to stop.
            Restart the app after changing.
          </span>
        </div>

        <div className="form-group">
          <label className="form-label">History hotkey</label>
          <input
            type="text"
            className="input"
            value={config.hotkey_history}
            onChange={(e) =>
              setConfig({ ...config, hotkey_history: e.target.value })
            }
            placeholder="ctrl+shift+h"
          />
        </div>
      </div>

      <div className="btn-row">
        {status && (
          <span
            className="form-help"
            style={{
              alignSelf: "center",
              color: status.startsWith("Error")
                ? "var(--danger)"
                : "var(--success)",
            }}
          >
            {status}
          </span>
        )}
        {onClose && (
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        )}
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
};
