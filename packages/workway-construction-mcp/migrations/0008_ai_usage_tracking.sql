-- Migration 0008: AI Usage Tracking
-- 
-- Adds dedicated columns to audit_logs for AI/LLM usage tracking.
-- This enables efficient querying of token usage, costs, and cache metrics
-- without parsing the JSON details column.
--
-- Benefits:
-- - Direct aggregation queries for billing/cost reports
-- - Efficient filtering by model, cache status
-- - Index support for AI usage analytics
-- - AI Gateway integration metadata

-- Add AI-specific columns to audit_logs
ALTER TABLE audit_logs ADD COLUMN model TEXT;
ALTER TABLE audit_logs ADD COLUMN prompt_tokens INTEGER;
ALTER TABLE audit_logs ADD COLUMN completion_tokens INTEGER;
ALTER TABLE audit_logs ADD COLUMN total_tokens INTEGER;
ALTER TABLE audit_logs ADD COLUMN cost_usd REAL;
ALTER TABLE audit_logs ADD COLUMN cached INTEGER DEFAULT 0;

-- Index for AI usage queries by event type and model
-- Partial index on ai_usage events for efficient cost/token aggregations
CREATE INDEX IF NOT EXISTS idx_audit_logs_ai_usage 
ON audit_logs(event_type, model) 
WHERE event_type = 'ai_usage';

-- Index for AI usage by user (for per-user cost tracking)
CREATE INDEX IF NOT EXISTS idx_audit_logs_ai_user 
ON audit_logs(user_id, event_type, created_at) 
WHERE event_type = 'ai_usage';

-- Index for AI usage by project (for per-project cost tracking)
CREATE INDEX IF NOT EXISTS idx_audit_logs_ai_project 
ON audit_logs(project_id, event_type, created_at) 
WHERE event_type = 'ai_usage';

-- Index for cache hit analysis
CREATE INDEX IF NOT EXISTS idx_audit_logs_ai_cache 
ON audit_logs(event_type, cached, created_at) 
WHERE event_type = 'ai_usage';
