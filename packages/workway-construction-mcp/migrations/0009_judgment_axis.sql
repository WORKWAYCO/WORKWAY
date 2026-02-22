-- Migration 0009: Construction MCP Hub + Judgment Axis
--
-- Adds tenant-isolated governance and execution schema:
-- - Tenant identity and membership
-- - Judgment policies, versions, decisions, approvals
-- - Curated tool access packs/rules
-- - Provider connections (Composio + first-party)
-- - Append-only execution ledger with hash chaining

-- ---------------------------------------------------------------------------
-- Tenant model
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tenant_memberships (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'disabled')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, user_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- Judgment policies and versions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS judgment_policies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  policy_type TEXT NOT NULL DEFAULT 'default',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, policy_type, name),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS judgment_policy_versions (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  policy_json TEXT NOT NULL,
  trust_profile_json TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'deprecated')),
  effective_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(policy_id, version),
  FOREIGN KEY (policy_id) REFERENCES judgment_policies(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- Judgment decisions and approvals
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS judgment_decisions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  policy_id TEXT,
  policy_version_id TEXT,
  user_id TEXT NOT NULL,
  project_id TEXT,
  toolkit_slug TEXT,
  tool_slug TEXT NOT NULL,
  provider TEXT NOT NULL,
  arguments_json TEXT,
  risk_score REAL NOT NULL DEFAULT 0,
  required_approval_tier TEXT,
  status TEXT NOT NULL CHECK (status IN ('approved', 'pending_approval', 'denied', 'executed', 'failed', 'expired')),
  reason TEXT,
  decided_by TEXT,
  decided_at TEXT,
  evidence_r2_key TEXT,
  execution_result_json TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (policy_id) REFERENCES judgment_policies(id) ON DELETE SET NULL,
  FOREIGN KEY (policy_version_id) REFERENCES judgment_policy_versions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS judgment_approvals (
  id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  approver_user_id TEXT NOT NULL,
  approval_tier TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('approved', 'rejected', 'commented')),
  note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (decision_id) REFERENCES judgment_decisions(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- Curated toolkit allowlist
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tool_access_packs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, slug),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tool_access_rules (
  id TEXT PRIMARY KEY,
  pack_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  toolkit_slug TEXT NOT NULL,
  tool_slug TEXT,
  rule_type TEXT NOT NULL DEFAULT 'allow' CHECK (rule_type IN ('allow', 'deny')),
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (pack_id) REFERENCES tool_access_packs(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- Provider connection state
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS provider_connections (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  toolkit_slug TEXT,
  auth_config_id TEXT,
  connected_account_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'revoked', 'expired', 'error')),
  metadata_json TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  last_checked_at TEXT,
  UNIQUE(tenant_id, user_id, provider, toolkit_slug),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- Execution ledger (append-only, hash-chain)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS execution_ledger (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  decision_id TEXT,
  user_id TEXT NOT NULL,
  toolkit_slug TEXT,
  tool_slug TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('executed', 'denied', 'pending_approval', 'failed')),
  input_hash TEXT,
  output_hash TEXT,
  previous_hash TEXT,
  entry_hash TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (decision_id) REFERENCES judgment_decisions(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_user ON tenant_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant_status ON tenant_memberships(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_judgment_policies_tenant ON judgment_policies(tenant_id, policy_type, status);
CREATE INDEX IF NOT EXISTS idx_judgment_policy_versions_policy ON judgment_policy_versions(policy_id, status, effective_at DESC);

CREATE INDEX IF NOT EXISTS idx_judgment_decisions_tenant_status ON judgment_decisions(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_judgment_decisions_tenant_user ON judgment_decisions(tenant_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_judgment_decisions_tool ON judgment_decisions(toolkit_slug, tool_slug, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_judgment_approvals_decision ON judgment_approvals(decision_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_judgment_approvals_tenant ON judgment_approvals(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tool_access_packs_tenant_status ON tool_access_packs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tool_access_rules_pack ON tool_access_rules(pack_id, rule_type);
CREATE INDEX IF NOT EXISTS idx_tool_access_rules_tenant_toolkit ON tool_access_rules(tenant_id, toolkit_slug, tool_slug);

CREATE INDEX IF NOT EXISTS idx_provider_connections_tenant_user ON provider_connections(tenant_id, user_id, provider, toolkit_slug);
CREATE INDEX IF NOT EXISTS idx_provider_connections_account ON provider_connections(connected_account_id);

CREATE INDEX IF NOT EXISTS idx_execution_ledger_tenant_time ON execution_ledger(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_ledger_tenant_hash ON execution_ledger(tenant_id, entry_hash);
CREATE INDEX IF NOT EXISTS idx_execution_ledger_decision ON execution_ledger(decision_id);
