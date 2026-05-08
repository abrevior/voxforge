import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { Tabs, TabId } from "./components/Tabs";
import { StatusBar } from "./components/StatusBar";
import { RecordTab } from "./components/tabs/RecordTab";
import { HistoryTab } from "./components/tabs/HistoryTab";
import { SettingsTab } from "./components/tabs/SettingsTab";
import { applyTheme, detectSystemTheme, ThemeName } from "./theme";
import { Config, RecordingState } from "./types/api";
import { MicStyle } from "./components/MicIcon";

export default function App() {
  const [tab, setTab] = useState<TabId>("record");
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [statusMsg, setStatusMsg] = useState<{
    kind: "info" | "error";
    text: string;
  } | null>(null);

  // Theme: follows config (system/dark/light); reactive to OS changes when "system".
  const [themePref, setThemePref] = useState<"system" | ThemeName>("system");
  const [resolvedTheme, setResolvedTheme] =
    useState<ThemeName>(detectSystemTheme());
  useEffect(() => applyTheme(resolvedTheme), [resolvedTheme]);
  useEffect(() => {
    if (themePref === "system") {
      setResolvedTheme(detectSystemTheme());
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = () => setResolvedTheme(detectSystemTheme());
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
    setResolvedTheme(themePref);
  }, [themePref]);

  // Config-derived UI prefs.
  const [micStyle, setMicStyle] = useState<MicStyle>("classic");
  const [showStatusbar, setShowStatusbar] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await invoke<Config>("get_config");
        setMicStyle(cfg.mic_style);
        setShowStatusbar(cfg.show_statusbar);
        setThemePref(cfg.theme);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const onConfigChange = (cfg: Config) => {
    setMicStyle(cfg.mic_style);
    setShowStatusbar(cfg.show_statusbar);
    setThemePref(cfg.theme);
  };

  // Recording flow.
  const isRecordingRef = useRef(false);
  useEffect(() => {
    const w = getCurrentWindow();
    const u1 = w.listen("hotkey:start", () => {
      setTab("record");
      w.hide();
      handleStart();
    });
    const u2 = w.listen("hotkey:stop", () => handleStop());
    const u3 = w.listen("hotkey:history", () => {
      setTab("history");
      w.show();
      w.setFocus();
    });
    const u4 = w.listen("show-history", () => setTab("history"));
    const u5 = w.listen("show-settings", () => setTab("settings"));
    return () => {
      u1.then((f) => f());
      u2.then((f) => f());
      u3.then((f) => f());
      u4.then((f) => f());
      u5.then((f) => f());
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await invoke("set_overlay_visible", {
          visible: recordingState !== "idle",
        });
      } catch {
        /* ignore */
      }
    })();
  }, [recordingState]);

  useEffect(() => {
    if (!statusMsg) return;
    const t = setTimeout(() => setStatusMsg(null), 6000);
    return () => clearTimeout(t);
  }, [statusMsg]);

  const handleStart = async () => {
    if (isRecordingRef.current) return;
    isRecordingRef.current = true;
    setRecordingState("recording");
    try {
      await invoke("start_recording");
    } catch (e) {
      setRecordingState("idle");
      isRecordingRef.current = false;
      setStatusMsg({ kind: "error", text: `Mic error: ${e}` });
    }
  };

  const handleStop = async () => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    try {
      setRecordingState("processing");
      const audio = await invoke<number[]>("stop_recording");
      const text = await invoke<string>("transcribe", {
        audioBytes: Array.from(new Uint8Array(audio)),
      });
      if (text && text.trim()) {
        try {
          await invoke("inject_or_copy", { text });
        } catch (e) {
          setStatusMsg({ kind: "error", text: `Inject failed: ${e}` });
        }
        const dur = audio.length / 16000;
        await invoke("save_to_history", { text, duration: dur });
        setStatusMsg({
          kind: "info",
          text: `Transcribed: "${
            text.length > 60 ? text.slice(0, 57) + "…" : text
          }"`,
        });
      } else {
        setStatusMsg({ kind: "info", text: "Empty transcription" });
      }
      setRecordingState("idle");
    } catch (e) {
      setRecordingState("idle");
      setStatusMsg({ kind: "error", text: `Transcription failed: ${e}` });
    }
  };

  return (
    <div className="app">
      <WindowChrome />
      <Tabs active={tab} onChange={setTab} />
      <div className="app-page">
        {tab === "record" && <RecordTab micStyle={micStyle} />}
        {tab === "history" && <HistoryTab />}
        {tab === "settings" && <SettingsTab onConfigChange={onConfigChange} />}
      </div>
      <StatusBar state={recordingState} visible={showStatusbar} />
      {statusMsg && (
        <div
          className={`toast toast-${statusMsg.kind}`}
          title={statusMsg.text}
          onClick={() => setStatusMsg(null)}
        >
          {statusMsg.text}
        </div>
      )}
    </div>
  );
}

function WindowChrome() {
  const w = getCurrentWindow();
  return (
    <div className="window-chrome" data-tauri-drag-region>
      <div className="window-title" data-tauri-drag-region>
        VoxForge
      </div>
      <div className="window-buttons">
        <button
          className="winbtn"
          aria-label="Minimize"
          onClick={() => w.minimize()}
          type="button"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path
              d="M2 5h6"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <button
          className="winbtn"
          aria-label="Maximize"
          onClick={() => w.toggleMaximize()}
          type="button"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect
              x="2"
              y="2"
              width="6"
              height="6"
              rx="1.2"
              stroke="currentColor"
              strokeWidth="1.4"
              fill="none"
            />
          </svg>
        </button>
        <button
          className="winbtn winbtn-close"
          aria-label="Close"
          onClick={() => w.close()}
          type="button"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path
              d="M2.5 2.5l5 5M7.5 2.5l-5 5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
