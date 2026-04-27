import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RecordingState } from "../types/api";

export function useRecording() {
  const [state, setState] = useState<RecordingState>("idle");
  const [rmsLevel, setRmsLevel] = useState(0);

  const start = useCallback(async () => {
    try {
      setState("recording");
      await invoke("start_recording");
    } catch (err) {
      console.error("Failed to start recording:", err);
      setState("idle");
    }
  }, []);

  const stop = useCallback(async (): Promise<Uint8Array | null> => {
    try {
      setState("processing");
      const audioBytes = await invoke<number[]>("stop_recording");
      setState("idle");
      return new Uint8Array(audioBytes);
    } catch (err) {
      console.error("Failed to stop recording:", err);
      setState("idle");
      return null;
    }
  }, []);

  const transcribe = useCallback(
    async (audioBytes: Uint8Array): Promise<string | null> => {
      try {
        setState("processing");
        const result = await invoke<string>("transcribe", {
          audioBytes: Array.from(audioBytes),
        });
        setState("idle");
        return result;
      } catch (err) {
        console.error("Transcription failed:", err);
        setState("idle");
        return null;
      }
    },
    []
  );

  const getRmsLevel = useCallback(async () => {
    try {
      const level = await invoke<number>("get_rms_level");
      setRmsLevel(level);
    } catch (err) {
      console.error("Failed to get RMS level:", err);
    }
  }, []);

  return {
    state,
    rmsLevel,
    start,
    stop,
    transcribe,
    getRmsLevel,
  };
}
