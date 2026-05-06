import React, { useEffect, useRef, useState } from "react";
import { RecordingState } from "../types/api";

interface RecordingProps {
  state: RecordingState;
  rmsLevel: number;
  onToggle: () => void;
}

const stateText: Record<RecordingState, string> = {
  idle: "Ready",
  recording: "Listening…",
  processing: "Transcribing…",
};

const BARS = 36;
const emptyHistory = () => new Array(BARS).fill(0) as number[];

export const Recording: React.FC<RecordingProps> = ({ state, rmsLevel, onToggle }) => {
  const orbClass = `rec-orb rec-orb-${state}`;
  const orbIcon = state === "processing" ? "⏳" : "🎙";
  const orbLabel =
    state === "recording"
      ? "Stop recording"
      : state === "processing"
        ? "Transcribing"
        : "Start recording";

  const [history, setHistory] = useState<number[]>(emptyHistory);
  const startedAt = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Slide RMS samples left like an oscilloscope.
  useEffect(() => {
    if (state !== "recording") {
      setHistory(emptyHistory());
      return;
    }
    setHistory((prev) => {
      const next = prev.slice(1);
      next.push(rmsLevel);
      return next;
    });
  }, [rmsLevel, state]);

  // Recording timer.
  useEffect(() => {
    if (state !== "recording") {
      startedAt.current = null;
      setElapsed(0);
      return;
    }
    startedAt.current = performance.now();
    const id = setInterval(() => {
      if (startedAt.current != null) {
        setElapsed((performance.now() - startedAt.current) / 1000);
      }
    }, 100);
    return () => clearInterval(id);
  }, [state]);

  return (
    <div className="page-narrow">
      <div className="rec-stage">
        <button
          type="button"
          className={orbClass}
          onClick={onToggle}
          disabled={state === "processing"}
          aria-label={orbLabel}
          title={orbLabel}
        >
          <span className="rec-orb-icon">{orbIcon}</span>
        </button>

        <div className="rec-state">{stateText[state]}</div>

        {state === "recording" && (
          <>
            <div className="rec-wave" aria-label="audio waveform">
              {history.map((v, i) => {
                const pct = Math.max(4, Math.min(100, v * 220));
                const fade = 0.25 + 0.75 * (i / (BARS - 1));
                return (
                  <span
                    key={i}
                    className="rec-wave-bar"
                    style={{ height: `${pct}%`, opacity: fade }}
                  />
                );
              })}
            </div>
            <div className="rec-wave-meta">
              <span className="rec-wave-time">
                {formatElapsed(elapsed)}
              </span>
              <span className="rec-wave-rms">
                RMS {Math.round(rmsLevel * 100).toString().padStart(2, "0")}
              </span>
            </div>
            <div className="rec-hint" style={{ marginTop: 8 }}>
              <div className="rec-hint-row">
                <span>Press</span>
                <span className="kbd">Space</span>
                <span>to stop</span>
              </div>
            </div>
          </>
        )}

        {state === "processing" && (
          <div className="rec-wave rec-wave-processing">
            {Array.from({ length: BARS }).map((_, i) => (
              <span
                key={i}
                className="rec-wave-bar rec-wave-bar-pulse"
                style={{ animationDelay: `${(i / BARS) * 1.2}s` }}
              />
            ))}
          </div>
        )}

        {state === "idle" && (
          <div className="rec-hint">
            <div className="rec-hint-row">
              <span>Hold</span>
              <span className="kbd">Ctrl</span>
              <span className="kbd-sep">+</span>
              <span className="kbd">Shift</span>
              <span className="kbd-sep">+</span>
              <span className="kbd">Space</span>
              <span>to record</span>
            </div>
            <div className="rec-hint-row">
              <span>Press</span>
              <span className="kbd">Ctrl</span>
              <span className="kbd-sep">+</span>
              <span className="kbd">Shift</span>
              <span className="kbd-sep">+</span>
              <span className="kbd">H</span>
              <span>for history</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ds = Math.floor((seconds * 10) % 10);
  return `${m.toString().padStart(2, "0")}:${s
    .toString()
    .padStart(2, "0")}.${ds}`;
}
