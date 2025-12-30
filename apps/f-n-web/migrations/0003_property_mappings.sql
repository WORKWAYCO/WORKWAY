-- Property mappings for Fireflies → Notion sync
-- Allows users to map Fireflies fields (duration, participants, keywords) to Notion database properties

CREATE TABLE IF NOT EXISTS property_mappings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  database_id TEXT NOT NULL,                -- Notion database ID
  mappings TEXT NOT NULL,                   -- JSON: {"duration": "Duration (mins)", "participants": "Attendees", "keywords": "Topics", "date": "Meeting Date"}
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, database_id),             -- One mapping per user per database
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Index for fast lookup by user + database
CREATE INDEX IF NOT EXISTS idx_property_mappings_user_db ON property_mappings(user_id, database_id);
