import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { Recording } from "./components/Recording";
import { Settings } from "./components/Settings";
import { History } from "./components/History";
import { RecordingState } from "./types/api";

type Page = "recording" | "settings" | "history";

const stateLabels: Record<RecordingState, string> = {
  idle: "READY",
  recording: "RECORDING",
  processing: "PROCESSING",
};

const stateBadgeClass: Record<RecordingState, string> = {
  idle: "badge",
  recording: "badge badge-recording",
  processing: "badge badge-processing",
};

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("recording");
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [rmsLevel, setRmsLevel] = useState(0);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    const appWindow = getCurrentWindow();

    const unlistenStart = appWindow.listen("hotkey:start", () => {
      handleStartRecording();
    });
    const unlistenStop = appWindow.listen("hotkey:stop", () => {
      handleStopRecording();
    });
    const unlistenHistory = appWindow.listen("hotkey:history", () => {
      setCurrentPage("history");
      appWindow.show();
      appWindow.setFocus();
    });
    const unlistenShowHistory = appWindow.listen("show-history", () => {
      setCurrentPage("history");
    });
    const unlistenShowSettings = appWindow.listen("show-settings", () => {
      setCurrentPage("settings");
    });

    return () => {
      unlistenStart.then((f) => f());
      unlistenStop.then((f) => f());
      unlistenHistory.then((f) => f());
      unlistenShowHistory.then((f) => f());
      unlistenShowSettings.then((f) => f());
    };
  }, []);

  useEffect(() => {
    if (recordingState !== "recording") return;
    const interval = setInterval(async () => {
      try {
        const level = await invoke<number>("get_rms_level");
        setRmsLevel(level);
      } catch (err) {
        console.error("Failed to get RMS level:", err);
      }
    }, 33);
    return () => clearInterval(interval);
  }, [recordingState]);

  const handleStartRecording = async () => {
    try {
      const appWindow = getCurrentWindow();
      setRecordingState("recording");
      setIsRecording(true);
      await invoke("start_recording");
      appWindow.show();
      appWindow.setFocus();
    } catch (err) {
      console.error("Failed to start recording:", err);
      setRecordingState("idle");
      setIsRecording(false);
    }
  };

  const handleStopRecording = async () => {
    if (!isRecording) return;
    setIsRecording(false);

    try {
      setRecordingState("processing");
      const audioBytes = await invoke<number[]>("stop_recording");
      const audio = new Uint8Array(audioBytes);

      const text = await invoke<string>("transcribe", {
        audioBytes: Array.from(audio),
      });

      await invoke("inject_or_copy", { text });

      const duration = audio.length / 16000;
      await invoke("save_to_history", { text, duration });

      setRecordingState("idle");
    } catch (err) {
      console.error("Failed to transcribe:", err);
      setRecordingState("idle");
    }
  };

  return (
    <div className="app">
      <div className="tabs">
        <button
          className={`tab ${currentPage === "recording" ? "tab-active" : ""}`}
          onClick={() => setCurrentPage("recording")}
        >
          <span className="tab-icon">●</span>
          Record
        </button>
        <button
          className={`tab ${currentPage === "history" ? "tab-active" : ""}`}
          onClick={() => setCurrentPage("history")}
        >
          <span className="tab-icon">≡</span>
          History
        </button>
        <button
          className={`tab ${currentPage === "settings" ? "tab-active" : ""}`}
          onClick={() => setCurrentPage("settings")}
        >
          <span className="tab-icon">⚙</span>
          Settings
        </button>
      </div>

      <div className="page">
        {currentPage === "recording" && (
          <Recording state={recordingState} rmsLevel={rmsLevel} />
        )}
        {currentPage === "history" && <History />}
        {currentPage === "settings" && (
          <Settings onClose={() => setCurrentPage("recording")} />
        )}
      </div>

      <div className="statusbar">
        <div className="statusbar-left">
          <span className={stateBadgeClass[recordingState]}>
            {stateLabels[recordingState]}
          </span>
          <span>VoxForge</span>
        </div>
        <div className="statusbar-right">
          <span className="kbd">Ctrl</span>
          <span className="kbd-sep">+</span>
          <span className="kbd">Shift</span>
          <span className="kbd-sep">+</span>
          <span className="kbd">Space</span>
          <span style={{ marginLeft: 4 }}>to record</span>
        </div>
      </div>
    </div>
  );
}
