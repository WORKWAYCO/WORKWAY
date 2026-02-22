-- Migration 0010: Tenant Runtime Controls
--
-- Adds tenant-scoped feature flags and circuit breaker policy configuration
-- for controlled rollout and failure isolation in the MCP hub.

CREATE TABLE IF NOT EXISTS tenant_feature_flags (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  flag_key TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  metadata_json TEXT,
  updated_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, flag_key),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tenant_circuit_policies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  toolkit_slug TEXT NOT NULL,
  tool_slug TEXT,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  failure_threshold INTEGER NOT NULL DEFAULT 3,
  cooldown_seconds INTEGER NOT NULL DEFAULT 120,
  metadata_json TEXT,
  updated_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, toolkit_slug, tool_slug),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tenant_feature_flags_lookup
ON tenant_feature_flags(tenant_id, flag_key);

CREATE INDEX IF NOT EXISTS idx_tenant_circuit_policies_lookup
ON tenant_circuit_policies(tenant_id, toolkit_slug, tool_slug);
