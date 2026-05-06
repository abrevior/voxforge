import { useEffect, useRef, useState } from "react";
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
  const [statusMsg, setStatusMsg] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const isRecordingRef = useRef(false);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    if (!statusMsg) return;
    const id = setTimeout(() => setStatusMsg(null), 6000);
    return () => clearTimeout(id);
  }, [statusMsg]);

  // Drive the floating overlay window (native GTK on Linux): visible only
  // while recording or during the brief processing tail.
  useEffect(() => {
    (async () => {
      try {
        await invoke("set_overlay_visible", {
          visible: recordingState !== "idle",
        });
      } catch (err) {
        console.warn("overlay show/hide failed:", err);
      }
    })();
  }, [recordingState]);

  useEffect(() => {
    const appWindow = getCurrentWindow();

    const unlistenStart = appWindow.listen("hotkey:start", () => {
      setCurrentPage("recording");
      appWindow.hide();
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

  // While recording, plain Space (or Esc) anywhere in the window stops it.
  useEffect(() => {
    if (recordingState !== "recording") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === " " || e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handleStopRecording();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true } as any);
  }, [recordingState]);

  const handleStartRecording = async () => {
    if (isRecordingRef.current) return; // already recording
    isRecordingRef.current = true;
    try {
      setRecordingState("recording");
      setIsRecording(true);
      setStatusMsg(null);
      await invoke("start_recording");
    } catch (err) {
      console.error("Failed to start recording:", err);
      setRecordingState("idle");
      setIsRecording(false);
      isRecordingRef.current = false;
      setStatusMsg({ kind: "error", text: `Mic error: ${err}` });
    }
  };

  const handleStopRecording = async () => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    setIsRecording(false);

    try {
      setRecordingState("processing");
      const audioBytes = await invoke<number[]>("stop_recording");
      const audio = new Uint8Array(audioBytes);

      const text = await invoke<string>("transcribe", {
        audioBytes: Array.from(audio),
      });

      if (!text || !text.trim()) {
        setStatusMsg({ kind: "info", text: "Empty transcription" });
      } else {
        try {
          await invoke("inject_or_copy", { text });
        } catch (err) {
          setStatusMsg({ kind: "error", text: `Inject failed: ${err}` });
        }
        const duration = audio.length / 16000;
        await invoke("save_to_history", { text, duration });
        setStatusMsg({
          kind: "info",
          text: `Transcribed: "${text.length > 60 ? text.slice(0, 57) + "…" : text}"`,
        });
      }

      setRecordingState("idle");
    } catch (err) {
      console.error("Failed to transcribe:", err);
      setRecordingState("idle");
      const msg = String(err);
      const friendly =
        msg.includes("api_key") || msg.includes("API key") || msg.toLowerCase().includes("unauthorized")
          ? "Transcription failed — check OpenAI API key in Settings."
          : `Transcription failed: ${err}`;
      setStatusMsg({ kind: "error", text: friendly });
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
          <Recording
            state={recordingState}
            rmsLevel={rmsLevel}
            onToggle={() => {
              if (recordingState === "recording") handleStopRecording();
              else if (recordingState === "idle") handleStartRecording();
            }}
          />
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
          {statusMsg && (
            <span
              style={{
                color: statusMsg.kind === "error" ? "var(--danger)" : "var(--accentFg)",
                marginLeft: 8,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 480,
              }}
              title={statusMsg.text}
            >
              {statusMsg.text}
            </span>
          )}
        </div>
        <div className="statusbar-right">
          {recordingState === "recording" ? (
            <>
              <span className="kbd">Space</span>
              <span style={{ marginLeft: 4 }}>to stop</span>
            </>
          ) : (
            <>
              <span className="kbd">Ctrl</span>
              <span className="kbd-sep">+</span>
              <span className="kbd">Shift</span>
              <span className="kbd-sep">+</span>
              <span className="kbd">Space</span>
              <span style={{ marginLeft: 4 }}>to record</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
