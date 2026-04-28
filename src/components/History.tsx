import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { HistoryEntry } from "../types/api";

export const History: React.FC = () => {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setEntries(await invoke<HistoryEntry[]>("get_history"));
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await invoke("delete_history_entry", { id });
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error("Failed to delete entry:", err);
    }
  };

  const handleClear = async () => {
    if (!confirm("Clear all history? This cannot be undone.")) return;
    try {
      await invoke("clear_history");
      setEntries([]);
    } catch (err) {
      console.error("Failed to clear history:", err);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return <div className="loading">Loading history…</div>;
  }

  return (
    <div className="page-wide">
      <div className="page-header">
        <h1>History</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="page-subtitle">{entries.length} entries</span>
          {entries.length > 0 && (
            <button className="btn btn-danger" onClick={handleClear}>
              Clear all
            </button>
          )}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="empty">
          <span className="empty-icon">∅</span>
          <span>No transcriptions yet</span>
          <span style={{ fontSize: 11, color: "var(--fgSubtle)" }}>
            Hold the record hotkey to capture your first one.
          </span>
        </div>
      ) : (
        <ul className="history-list">
          {entries.map((entry) => (
            <li key={entry.id} className="history-item">
              <div className="history-text">{entry.text}</div>
              <div className="history-meta">
                <div className="history-meta-left">
                  <span style={{ color: "var(--accentFg)" }}>
                    {entry.language.toUpperCase()}
                  </span>
                  <span>{entry.duration.toFixed(1)}s</span>
                  <span>{new Date(entry.timestamp).toLocaleString()}</span>
                </div>
                <div className="history-actions">
                  <button
                    className="btn btn-ghost"
                    onClick={() => handleCopy(entry.text)}
                  >
                    Copy
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => handleDelete(entry.id)}
                    style={{ color: "var(--danger)" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
