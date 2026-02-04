-- ============================================================================
-- WORKWAY Construction MCP - Performance Indexes
-- ============================================================================

-- Index for listing workflows sorted by updated_at
CREATE INDEX IF NOT EXISTS idx_workflows_updated_at ON workflows(updated_at DESC);

-- Index for workflow actions lookup and JOIN operations
CREATE INDEX IF NOT EXISTS idx_workflow_actions_workflow_id ON workflow_actions(workflow_id);

-- Index for ordering workflow actions
CREATE INDEX IF NOT EXISTS idx_workflow_actions_sequence ON workflow_actions(workflow_id, sequence);

-- Index for executions sorted by started_at (for status resource)
CREATE INDEX IF NOT EXISTS idx_executions_started_at ON executions(workflow_id, started_at DESC);

-- Index for OAuth token expiration checks
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires_at ON oauth_tokens(provider, expires_at);

-- Index for OAuth token lookup by user
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user ON oauth_tokens(provider, user_id);
