import { Kbd } from "./Kbd";
import { RecordingState } from "../types/api";

interface Props {
  state: RecordingState;
  visible: boolean;
}

const PILL_LABEL: Record<RecordingState, string> = {
  idle: "READY",
  recording: "REC",
  processing: "BUSY",
};

export function StatusBar({ state, visible }: Props) {
  if (!visible) return null;
  return (
    <div className="statusbar2">
      <div className={`status-pill status-pill-${state}`}>
        <span className="status-dot" />
        {PILL_LABEL[state]}
      </div>
      <span className="status-name">VoxForge</span>
      <span className="status-hint">
        <Kbd>Ctrl</Kbd>
        <span className="kbd-sep2">+</span>
        <Kbd>Shift</Kbd>
        <span className="kbd-sep2">+</span>
        <Kbd>Space</Kbd>
        <span className="status-hint-text">to record</span>
      </span>
    </div>
  );
}
