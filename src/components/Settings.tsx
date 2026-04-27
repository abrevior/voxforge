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

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const cfg = await invoke<Config>("get_config");
      setConfig(cfg);
    } catch (err) {
      console.error("Failed to load config:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await invoke("save_config", { config });
      alert("Settings saved successfully");
      onClose?.();
    } catch (err) {
      alert(`Failed to save settings: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading settings...</div>;
  }

  if (!config) {
    return <div className="p-8">Failed to load settings</div>;
  }

  return (
    <div className="p-8 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6">Settings</h2>

      <div className="space-y-4">
        {/* API Key */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            OpenAI API Key
          </label>
          <input
            type="password"
            value={config.openai_api_key}
            onChange={(e) =>
              setConfig({ ...config, openai_api_key: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            placeholder="sk-..."
          />
          <p className="text-xs text-gray-500 mt-1">
            Get your API key at platform.openai.com
          </p>
        </div>

        {/* Language */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Transcription Language
          </label>
          <select
            value={config.language}
            onChange={(e) => setConfig({ ...config, language: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="uk">Ukrainian</option>
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="zh">Chinese</option>
          </select>
        </div>

        {/* Start Hotkey */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Start Recording Hotkey
          </label>
          <input
            type="text"
            value={config.hotkey_start}
            onChange={(e) =>
              setConfig({ ...config, hotkey_start: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            placeholder="ctrl+shift+space"
          />
          <p className="text-xs text-gray-500 mt-1">
            E.g. ctrl+shift+space, super+v, ctrl+alt+r
          </p>
        </div>

        {/* Output Mode */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Output Mode
          </label>
          <select
            value={config.output_mode}
            onChange={(e) =>
              setConfig({ ...config, output_mode: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="inject">Inject Text (xdotool)</option>
            <option value="clipboard">Copy to Clipboard</option>
          </select>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 mt-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};
