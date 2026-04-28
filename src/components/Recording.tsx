import React from "react";
import { RecordingState } from "../types/api";

interface RecordingProps {
  state: RecordingState;
  rmsLevel: number;
}

const stateText: Record<RecordingState, string> = {
  idle: "Ready",
  recording: "Listening…",
  processing: "Transcribing…",
};

export const Recording: React.FC<RecordingProps> = ({ state, rmsLevel }) => {
  const orbClass = `rec-orb rec-orb-${state}`;
  const orbIcon = state === "processing" ? "⏳" : "🎙";

  return (
    <div className="page-narrow">
      <div className="rec-stage">
        <div className={orbClass}>
          <span className="rec-orb-icon">{orbIcon}</span>
        </div>

        <div className="rec-state">{stateText[state]}</div>

        {state === "recording" && (
          <div className="rec-meter">
            <div className="rec-meter-track">
              <div
                className="rec-meter-fill"
                style={{ width: `${Math.min(100, rmsLevel * 100)}%` }}
              />
            </div>
            <div className="rec-meter-label">
              {Math.round(rmsLevel * 100).toString().padStart(2, "0")}%
            </div>
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
