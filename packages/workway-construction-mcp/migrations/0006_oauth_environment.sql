-- ============================================================================
-- Add environment column to oauth_tokens
-- Allows users to connect to either production or sandbox Procore
-- ============================================================================

ALTER TABLE oauth_tokens ADD COLUMN environment TEXT DEFAULT 'production';

-- Add index for environment lookups
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_environment ON oauth_tokens(environment);
