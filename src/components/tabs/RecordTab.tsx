import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MicIcon, MicStyle } from "../MicIcon";
import { Kbd } from "../Kbd";
import { HistoryEntry } from "../../types/api";

interface Props {
  micStyle: MicStyle;
}

interface Recent {
  time: string;
  text: string;
  dur: string;
}

function timeAgo(ms: number): string {
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 60) return `${sec} sec ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} hour ago`;
  return `${Math.floor(sec / 86400)} day ago`;
}

function fmtDur(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function RecordTab({ micStyle }: Props) {
  const [recents, setRecents] = useState<Recent[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const all = await invoke<HistoryEntry[]>("get_history");
        const top3 = all.slice(0, 3).map((h) => ({
          time: timeAgo(new Date(h.timestamp).getTime()),
          text: h.text,
          dur: fmtDur(h.duration),
        }));
        setRecents(top3);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  return (
    <div className="record-tab">
      <div className="record-hero">
        <div className="mic-surround">
          <div className="mic-halo" />
          <div className="mic-ring" />
          <div className="mic-tile">
            <MicIcon style={micStyle} size={48} color="var(--accent)" />
          </div>
        </div>
        <div className="hero-text">
          <div className="hero-title">Ready</div>
          <div className="hero-subtitle">Press the hotkey to start recording</div>
        </div>
        <div className="hotkey-card">
          <HotkeyRow keys={["Ctrl", "Shift", "Space"]} label="Record" />
          <div className="hotkey-divider" />
          <HotkeyRow keys={["Ctrl", "Shift", "H"]} label="History" />
        </div>
      </div>

      <div className="recents">
        <div className="recents-header">
          <div className="recents-label">Recent</div>
          <div className="recents-link">View all →</div>
        </div>
        <div className="recents-list">
          {recents.length === 0 && (
            <div className="recents-empty">No recordings yet.</div>
          )}
          {recents.map((r, i) => (
            <div key={i} className="recent-row">
              <div className="recent-time">{r.time}</div>
              <div className="recent-text">{r.text}</div>
              <div className="recent-dur">{r.dur}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HotkeyRow({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="hotkey-row">
      <div className="hotkey-keys">
        {keys.map((k, i) => (
          <span key={i} className="hotkey-key-wrap">
            <Kbd>{k}</Kbd>
            {i < keys.length - 1 && <span className="kbd-sep2">+</span>}
          </span>
        ))}
      </div>
      <span className="hotkey-label">{label}</span>
    </div>
  );
}
