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
      const history = await invoke<HistoryEntry[]>("get_history");
      setEntries(history);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await invoke("delete_history_entry", { id });
      setEntries(entries.filter((e) => e.id !== id));
    } catch (err) {
      alert(`Failed to delete entry: ${err}`);
    }
  };

  const handleClear = async () => {
    if (!confirm("Clear all history? This cannot be undone.")) return;
    try {
      await invoke("clear_history");
      setEntries([]);
    } catch (err) {
      alert(`Failed to clear history: ${err}`);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return <div className="p-8">Loading history...</div>;
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">History</h2>
        {entries.length > 0 && (
          <button
            onClick={handleClear}
            className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
          >
            Clear All
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No transcriptions yet</p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="p-4 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <p className="text-gray-800 break-words">{entry.text}</p>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleCopy(entry.text)}
                    className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>{entry.language.toUpperCase()}</span>
                <span>{entry.duration.toFixed(1)}s</span>
                <span>{new Date(entry.timestamp).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
