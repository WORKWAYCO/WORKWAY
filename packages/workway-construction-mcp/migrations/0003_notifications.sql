-- Add notification configuration to workflows
ALTER TABLE workflows ADD COLUMN notification_config TEXT;

-- Create notifications log table
CREATE TABLE IF NOT EXISTS notification_logs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT REFERENCES workflows(id),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'slack', 'webhook')),
  recipient TEXT NOT NULL,
  subject TEXT,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  error TEXT,
  sent_at TEXT DEFAULT (datetime('now')),
  metadata TEXT -- JSON for additional data
);

-- Index for notification history lookups
CREATE INDEX IF NOT EXISTS idx_notification_logs_workflow 
ON notification_logs(workflow_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_logs_status 
ON notification_logs(status, sent_at DESC);
