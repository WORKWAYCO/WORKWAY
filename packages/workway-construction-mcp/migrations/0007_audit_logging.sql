-- Migration 0007: Audit Logging
-- 
-- Creates audit_logs table for security compliance and tracking
-- of all sensitive operations including tool executions, OAuth events,
-- data access, and token refreshes.

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,  -- 'tool_execution', 'oauth_callback', 'data_access', 'token_refresh', 'rate_limit_exceeded'
  user_id TEXT NOT NULL,
  connection_id TEXT,  -- WORKWAY connection ID
  tool_name TEXT,  -- e.g., 'workway_get_procore_rfis'
  resource_type TEXT,  -- 'rfi', 'daily_log', 'submittal', 'project', 'company', 'document', 'photo'
  resource_id TEXT,  -- The specific resource ID accessed
  project_id TEXT,  -- Procore project ID if applicable
  ip_address TEXT,  -- Client IP address
  user_agent TEXT,  -- Client user agent string
  request_method TEXT,  -- HTTP method
  request_path TEXT,  -- API path called
  response_status INTEGER,  -- HTTP status code
  duration_ms INTEGER,  -- Request duration in milliseconds
  details TEXT,  -- JSON with additional context
  error_message TEXT,  -- Error message if failed
  created_at TEXT DEFAULT (datetime('now'))
);

-- Index for querying by user
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);

-- Index for querying by connection
CREATE INDEX IF NOT EXISTS idx_audit_logs_connection_id ON audit_logs(connection_id);

-- Index for querying by event type
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);

-- Index for querying by timestamp
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Index for querying by tool
CREATE INDEX IF NOT EXISTS idx_audit_logs_tool_name ON audit_logs(tool_name);

-- Index for querying by resource type
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);

-- Composite index for common query pattern: user + event_type + time
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_event_time ON audit_logs(user_id, event_type, created_at);

-- Composite index for project-based queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_project_time ON audit_logs(project_id, created_at);
