-- Webhook subscriptions table for Procore event triggers
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id),
  project_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  procore_hook_id TEXT,
  callback_url TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for webhook lookups
CREATE INDEX IF NOT EXISTS idx_webhook_subs_workflow 
ON webhook_subscriptions(workflow_id);

CREATE INDEX IF NOT EXISTS idx_webhook_subs_project 
ON webhook_subscriptions(project_id, event_type);

CREATE INDEX IF NOT EXISTS idx_webhook_subs_active 
ON webhook_subscriptions(is_active, event_type);

-- Webhook events log for debugging
CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  subscription_id TEXT REFERENCES webhook_subscriptions(id),
  workflow_id TEXT REFERENCES workflows(id),
  event_type TEXT NOT NULL,
  payload TEXT,
  processed INTEGER DEFAULT 0,
  execution_id TEXT,
  received_at TEXT DEFAULT (datetime('now')),
  processed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_workflow 
ON webhook_events(workflow_id, received_at DESC);
