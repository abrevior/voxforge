import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { Recording } from "./components/Recording";
import { Settings } from "./components/Settings";
import { History } from "./components/History";
import { RecordingState } from "./types/api";
import "./App.css";

type Page = "recording" | "settings" | "history";

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("recording");
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [rmsLevel, setRmsLevel] = useState(0);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    const appWindow = getCurrentWindow();

    // Listen for hotkey events
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

    // Cleanup
    return () => {
      unlistenStart.then((f) => f());
      unlistenStop.then((f) => f());
      unlistenHistory.then((f) => f());
      unlistenShowHistory.then((f) => f());
      unlistenShowSettings.then((f) => f());
    };
  }, []);

  // Poll RMS level while recording
  useEffect(() => {
    if (recordingState !== "recording") return;

    const interval = setInterval(async () => {
      try {
        const level = await invoke<number>("get_rms_level");
        setRmsLevel(level);
      } catch (err) {
        console.error("Failed to get RMS level:", err);
      }
    }, 33); // ~30 Hz

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

      const duration = audio.length / 16000; // 16kHz sample rate
      await invoke("save_to_history", {
        text,
        duration,
      });

      setRecordingState("idle");
    } catch (err) {
      console.error("Failed to transcribe:", err);
      setRecordingState("idle");
    }
  };

  return (
    <div className="w-full h-full bg-white">
      {/* Header with tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setCurrentPage("recording")}
          className={`flex-1 px-4 py-3 font-medium text-center border-b-2 transition-colors ${
            currentPage === "recording"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          Record
        </button>
        <button
          onClick={() => setCurrentPage("history")}
          className={`flex-1 px-4 py-3 font-medium text-center border-b-2 transition-colors ${
            currentPage === "history"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          History
        </button>
        <button
          onClick={() => setCurrentPage("settings")}
          className={`flex-1 px-4 py-3 font-medium text-center border-b-2 transition-colors ${
            currentPage === "settings"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          Settings
        </button>
      </div>

      {/* Content */}
      <div className="overflow-auto" style={{ height: "calc(100% - 53px)" }}>
        {currentPage === "recording" && (
          <Recording
            state={recordingState}
            rmsLevel={rmsLevel}
          />
        )}
        {currentPage === "history" && <History />}
        {currentPage === "settings" && (
          <Settings onClose={() => setCurrentPage("recording")} />
        )}
      </div>
    </div>
  );
}
