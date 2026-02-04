-- ============================================================================
-- WORKWAY Construction MCP - Usage Metering
-- ============================================================================

-- Users table with tier-based usage limits
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('anonymous', 'free', 'pro', 'enterprise')),
  runs_this_month INTEGER DEFAULT 0,
  monthly_run_limit INTEGER DEFAULT 500,
  billing_cycle_start TEXT DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for usage queries
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);
CREATE INDEX IF NOT EXISTS idx_users_billing_cycle ON users(billing_cycle_start);

-- Update oauth_tokens to reference users table
-- (user_id in oauth_tokens will reference users.id)
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user ON oauth_tokens(user_id);
