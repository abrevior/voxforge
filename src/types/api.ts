export interface Config {
  openai_api_key: string;
  hotkey_start: string;
  hotkey_stop: string;
  hotkey_history: string;
  language: string;
  model: string;
  ui_language: string;
  openai_api_base: string;
  output_mode: string;
  theme: "system" | "dark" | "light";
  mic_style: "classic" | "minimal" | "wave";
  show_statusbar: boolean;
  show_overlay: boolean;
  auto_paste: boolean;
  punctuation: boolean;
  overlay_x: number | null;
  overlay_y: number | null;
}

export interface HistoryEntry {
  id: string;
  text: string;
  language: string;
  duration: number;
  timestamp: string;
}

export type RecordingState = "idle" | "recording" | "processing";
