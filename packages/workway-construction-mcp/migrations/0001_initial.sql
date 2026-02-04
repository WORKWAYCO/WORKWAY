-- ============================================================================
-- WORKWAY Construction MCP - Initial Schema
-- ============================================================================

-- Workflows table
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  project_id TEXT,  -- Procore project ID
  trigger_type TEXT CHECK (trigger_type IN ('webhook', 'cron', 'manual')),
  trigger_config TEXT,  -- JSON
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'error')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Workflow actions (steps)
CREATE TABLE IF NOT EXISTS workflow_actions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_config TEXT,  -- JSON
  sequence INTEGER NOT NULL,
  condition TEXT,  -- Optional condition expression
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

-- Execution history
CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  input_data TEXT,  -- JSON
  output_data TEXT,  -- JSON
  error TEXT,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

-- Execution steps (detailed trace for observability)
CREATE TABLE IF NOT EXISTS execution_steps (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  started_at TEXT,
  completed_at TEXT,
  input_data TEXT,  -- JSON
  output_data TEXT,  -- JSON
  error TEXT,
  -- Atlas observability fields
  task_type TEXT CHECK (task_type IN ('ai', 'human', 'system')),
  ai_task TEXT,  -- classify, generate, verify, etc.
  token_usage_input INTEGER,
  token_usage_output INTEGER,
  confidence REAL,
  human_override INTEGER DEFAULT 0,
  FOREIGN KEY (execution_id) REFERENCES executions(id) ON DELETE CASCADE,
  FOREIGN KEY (action_id) REFERENCES workflow_actions(id) ON DELETE CASCADE
);

-- OAuth tokens
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  user_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TEXT,
  scopes TEXT,  -- JSON array
  company_id TEXT,  -- Provider-specific (e.g., Procore company ID)
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- RFI outcomes (for learning and improving AI responses)
CREATE TABLE IF NOT EXISTS rfi_outcomes (
  id TEXT PRIMARY KEY,
  rfi_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  question_text TEXT,
  response_text TEXT,
  response_time_days REAL,
  was_accepted INTEGER,  -- 1 = accepted, 0 = rejected/revised
  ai_confidence REAL,
  human_edited INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_project ON workflows(project_id);
CREATE INDEX IF NOT EXISTS idx_executions_workflow ON executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
CREATE INDEX IF NOT EXISTS idx_execution_steps_execution ON execution_steps(execution_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_provider ON oauth_tokens(provider);
CREATE INDEX IF NOT EXISTS idx_rfi_outcomes_project ON rfi_outcomes(project_id);
