import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { HistoryEntry, Config } from "../../types/api";
import { Search, Copy, Play, More } from "../icons";

type Group = "Today" | "Yesterday" | "Earlier";

function bucket(ts: number): Group {
  const now = new Date();
  const d = new Date(ts);
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return "Today";
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (
    d.getFullYear() === y.getFullYear() &&
    d.getMonth() === y.getMonth() &&
    d.getDate() === y.getDate()
  ) {
    return "Yesterday";
  }
  return "Earlier";
}

function fmtDur(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function timeAgo(ms: number): string {
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 60) return `${sec} sec ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} hour ago`;
  return `${Math.floor(sec / 86400)} day ago`;
}

export function HistoryTab() {
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [model, setModel] = useState("whisper-1");
  const [lang, setLang] = useState("Auto");

  useEffect(() => {
    (async () => {
      try {
        const list = await invoke<HistoryEntry[]>("get_history");
        setItems(list);
        if (list.length) setSelectedId(list[0].id);
      } catch {
        /* ignore */
      }
      try {
        const cfg = await invoke<Config>("get_config");
        setModel(cfg.model);
        setLang(cfg.language || "Auto");
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.text.toLowerCase().includes(q));
  }, [items, query]);

  const groups: Record<Group, HistoryEntry[]> = useMemo(() => {
    const out: Record<Group, HistoryEntry[]> = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };
    for (const it of filtered) {
      out[bucket(new Date(it.timestamp).getTime())].push(it);
    }
    return out;
  }, [filtered]);

  const sel = items.find((it) => it.id === selectedId) ?? null;

  return (
    <div className="history-tab">
      <div className="history-list">
        <div className="history-search-wrap">
          <div className="history-search">
            <Search />
            <input
              className="history-search-input"
              placeholder="Search transcriptions"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        {(["Today", "Yesterday", "Earlier"] as Group[]).map((g) =>
          groups[g].length === 0 ? null : (
            <div key={g}>
              <div className="history-group">{g}</div>
              {groups[g].map((it) => {
                const isSel = it.id === selectedId;
                return (
                  <div
                    key={it.id}
                    onClick={() => setSelectedId(it.id)}
                    className={`history-item ${isSel ? "history-item-sel" : ""}`}
                  >
                    <div className="history-item-meta">
                      <span>{timeAgo(new Date(it.timestamp).getTime())}</span>
                      <span className="history-item-dur">{fmtDur(it.duration)}</span>
                    </div>
                    <div className="history-item-text">{it.text}</div>
                  </div>
                );
              })}
            </div>
          ),
        )}
      </div>

      <div className="history-detail">
        {sel ? (
          <>
            <div className="history-detail-meta">
              <div className="history-detail-meta-left">
                <div>{timeAgo(new Date(sel.timestamp).getTime())}</div>
                <span className="history-dot" />
                <div className="history-detail-mono">{fmtDur(sel.duration)}</div>
                <span className="history-dot" />
                <div>{sel.text.split(/\s+/).filter(Boolean).length} words</div>
              </div>
              <div className="history-detail-actions">
                <IconButton title="Copy">
                  <Copy />
                </IconButton>
                <IconButton title="Play">
                  <Play />
                </IconButton>
                <IconButton title="More">
                  <More />
                </IconButton>
              </div>
            </div>
            <div className="history-detail-body">{sel.text}</div>
            <div className="history-detail-footer">
              <span>
                Model: <span className="history-detail-mono">{model}</span>
              </span>
              <span>
                Language: <span className="history-detail-fgmuted">{lang}</span>
              </span>
            </div>
          </>
        ) : (
          <div className="history-detail-empty">Select a transcription</div>
        )}
      </div>
    </div>
  );
}

function IconButton({ title, children }: { title: string; children: JSX.Element }) {
  return (
    <button type="button" className="history-icon-btn" title={title}>
      {children}
    </button>
  );
}
