use crate::config::Config;
use anyhow::Result;
use chrono::Utc;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: String,
    pub text: String,
    pub language: String,
    pub duration: f32,
    pub timestamp: String,
}

pub struct HistoryManager {
    conn: Option<Connection>,
}

impl HistoryManager {
    pub fn new() -> Self {
        let conn = match Config::history_db_path() {
            Ok(path) => {
                if let Some(parent) = path.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
                Connection::open(&path).ok()
            }
            Err(_) => None,
        };

        let manager = Self { conn };
        let _ = manager.init_db();
        manager
    }

    fn init_db(&self) -> Result<()> {
        if let Some(conn) = &self.conn {
            conn.execute(
                "CREATE TABLE IF NOT EXISTS history (
                    id TEXT PRIMARY KEY,
                    text TEXT NOT NULL,
                    language TEXT NOT NULL,
                    duration REAL NOT NULL,
                    timestamp TEXT NOT NULL
                )",
                [],
            )?;
        }
        Ok(())
    }

    pub fn save(&self, text: String, language: String, duration: f32) -> Result<()> {
        if let Some(conn) = &self.conn {
            let id = Uuid::new_v4().to_string();
            let timestamp = Utc::now().to_rfc3339();

            conn.execute(
                "INSERT INTO history (id, text, language, duration, timestamp) VALUES (?, ?, ?, ?, ?)",
                rusqlite::params![&id, &text, &language, duration, &timestamp],
            )?;
        }
        Ok(())
    }

    pub fn get_all(&self) -> Result<Vec<HistoryEntry>> {
        let mut entries = Vec::new();

        if let Some(conn) = &self.conn {
            let mut stmt = conn.prepare(
                "SELECT id, text, language, duration, timestamp FROM history ORDER BY timestamp DESC LIMIT 100"
            )?;

            let mut rows = stmt.query([])?;
            while let Some(row) = rows.next()? {
                entries.push(HistoryEntry {
                    id: row.get(0)?,
                    text: row.get(1)?,
                    language: row.get(2)?,
                    duration: row.get(3)?,
                    timestamp: row.get(4)?,
                });
            }
        }

        Ok(entries)
    }

    pub fn delete(&self, id: &str) -> Result<()> {
        if let Some(conn) = &self.conn {
            conn.execute("DELETE FROM history WHERE id = ?", rusqlite::params![id])?;
        }
        Ok(())
    }

    pub fn clear(&self) -> Result<()> {
        if let Some(conn) = &self.conn {
            conn.execute("DELETE FROM history", [])?;
        }
        Ok(())
    }
}

impl Default for HistoryManager {
    fn default() -> Self {
        Self::new()
    }
}
