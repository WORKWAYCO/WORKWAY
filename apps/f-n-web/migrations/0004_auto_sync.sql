-- Auto-sync feature: sync new transcripts automatically
-- Adds auto_sync_enabled flag and tracks last sync time

ALTER TABLE property_mappings ADD COLUMN auto_sync_enabled INTEGER DEFAULT 0;
ALTER TABLE property_mappings ADD COLUMN last_auto_sync_at TEXT;

-- Index for efficient cron queries
CREATE INDEX IF NOT EXISTS idx_property_mappings_auto_sync 
ON property_mappings(auto_sync_enabled) WHERE auto_sync_enabled = 1;
