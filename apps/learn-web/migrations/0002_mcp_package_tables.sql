-- Migration: Tables for MCP package support
-- Date: 2024-12-17
-- Purpose: Add praxis completions and ethos tables for @workway/learn MCP package

-- Praxis completions (evidence-based, not scored)
-- Praxis exercises are about doing, not perfection
CREATE TABLE IF NOT EXISTS praxis_completions (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL,
  path_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  evidence TEXT NOT NULL,
  reflection TEXT,
  time_spent_minutes INTEGER,
  completed_at TEXT DEFAULT (datetime('now')),
  UNIQUE(learner_id, lesson_id),
  FOREIGN KEY (learner_id) REFERENCES learners(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_praxis_completions_learner ON praxis_completions(learner_id);
CREATE INDEX IF NOT EXISTS idx_praxis_completions_lesson ON praxis_completions(lesson_id);

-- Learner ethos (personal workflow principles)
-- Five categories: zuhandenheit, outcome_focus, simplicity, resilience, honesty
CREATE TABLE IF NOT EXISTS learner_ethos (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  context TEXT,
  set_at TEXT DEFAULT (datetime('now')),
  UNIQUE(learner_id, category),
  FOREIGN KEY (learner_id) REFERENCES learners(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_learner_ethos_learner ON learner_ethos(learner_id);
CREATE INDEX IF NOT EXISTS idx_learner_ethos_category ON learner_ethos(category);

-- Add badges table for achievement tracking
CREATE TABLE IF NOT EXISTS learner_badges (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL,
  badge_id TEXT NOT NULL,
  earned_at TEXT DEFAULT (datetime('now')),
  context TEXT,
  UNIQUE(learner_id, badge_id),
  FOREIGN KEY (learner_id) REFERENCES learners(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_learner_badges_learner ON learner_badges(learner_id);
CREATE INDEX IF NOT EXISTS idx_learner_badges_badge ON learner_badges(badge_id);
