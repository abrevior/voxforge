import React, { useState, useEffect } from "react";
import { RecordingState } from "../types/api";

interface RecordingProps {
  state: RecordingState;
  rmsLevel: number;
  onTranscriptionComplete?: (text: string) => void;
}

export const Recording: React.FC<RecordingProps> = ({
  state,
  rmsLevel,
  onTranscriptionComplete: _onTranscriptionComplete,
}) => {
  const [displayText, setDisplayText] = useState("");

  useEffect(() => {
    if (state === "idle") {
      setDisplayText("");
    }
  }, [state]);

  const stateColor = {
    idle: "bg-gray-400",
    recording: "bg-red-500",
    processing: "bg-yellow-500",
  };

  const stateLabel = {
    idle: "Ready",
    recording: "Recording...",
    processing: "Processing...",
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 gap-6">
      {/* Status Indicator */}
      <div className="flex flex-col items-center gap-4">
        <div
          className={`w-16 h-16 rounded-full ${stateColor[state]} transition-colors shadow-lg`}
        />
        <span className="text-xl font-semibold text-gray-700">
          {stateLabel[state]}
        </span>
      </div>

      {/* RMS Level Visualization */}
      {state === "recording" && (
        <div className="w-full max-w-xs">
          <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-green-500 h-full transition-all"
              style={{ width: `${rmsLevel * 100}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2 text-center">
            Volume: {Math.round(rmsLevel * 100)}%
          </p>
        </div>
      )}

      {/* Transcription Result */}
      {displayText && (
        <div className="w-full max-w-md p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm font-semibold text-gray-700 mb-2">
            Transcription:
          </p>
          <p className="text-gray-800 break-words">{displayText}</p>
        </div>
      )}

      {/* Instructions */}
      {state === "idle" && (
        <div className="text-center text-gray-600">
          <p className="text-sm">Press your hotkey to start recording</p>
        </div>
      )}
    </div>
  );
};
