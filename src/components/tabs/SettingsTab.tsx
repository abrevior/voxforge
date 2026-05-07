import { ReactNode, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Config } from "../../types/api";
import { MicStyle } from "../MicIcon";
import { Kbd } from "../Kbd";
import { Chevron } from "../icons";

interface Props {
  onConfigChange: (cfg: Config) => void;
}

export function SettingsTab({ onConfigChange }: Props) {
  const [cfg, setCfg] = useState<Config | null>(null);

  useEffect(() => {
    (async () => {
      const c = await invoke<Config>("get_config");
      setCfg(c);
    })();
  }, []);

  if (!cfg) return <div className="settings-tab">Loading…</div>;

  const update = async (patch: Partial<Config>) => {
    const next = { ...cfg, ...patch };
    setCfg(next);
    onConfigChange(next);
    try {
      await invoke("save_config", { config: next });
    } catch (e) {
      console.error("save_config failed", e);
    }
  };

  return (
    <div className="settings-tab">
      <Section title="Transcription">
        <Row
          label="Model"
          hint="Whisper model used by the API"
          control={
            <Select
              value={cfg.model}
              options={["whisper-1"]}
              onChange={(v) => update({ model: v })}
            />
          }
        />
        <Row
          label="Language"
          hint="Auto-detect or specify a language"
          control={
            <Select
              value={cfg.language || "auto"}
              options={["auto", "uk", "en", "de", "fr", "es", "pl"]}
              onChange={(v) => update({ language: v === "auto" ? "" : v })}
            />
          }
        />
        <Row
          label="Punctuation"
          hint="Add punctuation and capitalization automatically"
          control={
            <Toggle
              on={cfg.punctuation}
              onChange={(on) => update({ punctuation: on })}
            />
          }
          last
        />
      </Section>

      <Section title="Hotkeys">
        <Row
          label="Start recording"
          control={<KeyRow keys={["Ctrl", "Shift", "Space"]} />}
        />
        <Row
          label="Open history"
          control={<KeyRow keys={["Ctrl", "Shift", "H"]} />}
          last
        />
      </Section>

      <Section title="Appearance">
        <Row
          label="Theme"
          hint="Follow system or pick manually"
          control={
            <Select
              value={cfg.theme}
              options={["system", "dark", "light"]}
              onChange={(v) =>
                update({ theme: v as Config["theme"] })
              }
            />
          }
        />
        <Row
          label="Mic icon"
          hint="Style of the hero microphone"
          control={
            <Select
              value={cfg.mic_style}
              options={["classic", "minimal", "wave"]}
              onChange={(v) => update({ mic_style: v as MicStyle })}
            />
          }
        />
        <Row
          label="Show overlay"
          hint="Floating recorder pill while recording"
          control={
            <Toggle
              on={cfg.show_overlay}
              onChange={(on) => update({ show_overlay: on })}
            />
          }
        />
        <Row
          label="Show status bar"
          hint="Bottom bar with READY / hotkey hint"
          control={
            <Toggle
              on={cfg.show_statusbar}
              onChange={(on) => update({ show_statusbar: on })}
            />
          }
        />
        <Row
          label="Auto-paste"
          hint="Inject transcription into the focused window"
          control={
            <Toggle
              on={cfg.auto_paste}
              onChange={(on) => update({ auto_paste: on })}
            />
          }
          last
        />
      </Section>

      <Section title="OpenAI API">
        <Row
          label="API key"
          hint="Stored locally in ~/.config/voxforge/config.json"
          control={
            <input
              className="settings-input"
              type="password"
              value={cfg.openai_api_key}
              onChange={(e) => update({ openai_api_key: e.target.value })}
              placeholder="sk-…"
            />
          }
        />
        <Row
          label="API base URL"
          control={
            <input
              className="settings-input"
              value={cfg.openai_api_base}
              onChange={(e) => update({ openai_api_base: e.target.value })}
            />
          }
          last
        />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="settings-section">
      <div className="settings-section-title">{title}</div>
      <div className="settings-card">{children}</div>
    </div>
  );
}

function Row({
  label,
  hint,
  control,
  last,
}: {
  label: string;
  hint?: string;
  control: ReactNode;
  last?: boolean;
}) {
  return (
    <div className={`settings-row ${last ? "settings-row-last" : ""}`}>
      <div>
        <div className="settings-row-label">{label}</div>
        {hint && <div className="settings-row-hint">{hint}</div>}
      </div>
      <div className="settings-row-control">{control}</div>
    </div>
  );
}

function Select({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="settings-select">
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <span className="settings-select-chevron">
        <Chevron />
      </span>
    </label>
  );
}

function Toggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`settings-toggle ${on ? "settings-toggle-on" : ""}`}
      aria-pressed={on}
    >
      <span className="settings-toggle-thumb" />
    </button>
  );
}

function KeyRow({ keys }: { keys: string[] }) {
  return (
    <div className="settings-keyrow">
      {keys.map((k) => (
        <Kbd key={k}>{k}</Kbd>
      ))}
    </div>
  );
}
