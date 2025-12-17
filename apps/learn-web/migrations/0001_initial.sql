-- Migration: Initial schema for learn.workway.co
-- Date: 2024-12-17
-- Purpose: Set up learner progress tracking and analytics

-- Learners (linked to unified identity)
CREATE TABLE learners (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_learners_user_id ON learners(user_id);
CREATE INDEX idx_learners_email ON learners(email);

-- Path progress tracking
CREATE TABLE path_progress (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL,
  path_id TEXT NOT NULL,
  status TEXT DEFAULT 'not_started',
  started_at TEXT,
  completed_at TEXT,
  UNIQUE(learner_id, path_id),
  FOREIGN KEY (learner_id) REFERENCES learners(id) ON DELETE CASCADE
);

CREATE INDEX idx_path_progress_learner ON path_progress(learner_id);
CREATE INDEX idx_path_progress_path ON path_progress(path_id);

-- Lesson progress (hermeneutic spiral - tracks revisits)
CREATE TABLE lesson_progress (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL,
  path_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  status TEXT DEFAULT 'not_started',
  visits INTEGER DEFAULT 0,
  time_spent_seconds INTEGER DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  UNIQUE(learner_id, path_id, lesson_id),
  FOREIGN KEY (learner_id) REFERENCES learners(id) ON DELETE CASCADE
);

CREATE INDEX idx_lesson_progress_learner ON lesson_progress(learner_id);
CREATE INDEX idx_lesson_progress_lesson ON lesson_progress(path_id, lesson_id);

-- Praxis exercise attempts
CREATE TABLE praxis_attempts (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL,
  praxis_id TEXT NOT NULL,
  submission TEXT,
  feedback TEXT,
  score INTEGER,
  submitted_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (learner_id) REFERENCES learners(id) ON DELETE CASCADE
);

CREATE INDEX idx_praxis_attempts_learner ON praxis_attempts(learner_id);
CREATE INDEX idx_praxis_attempts_praxis ON praxis_attempts(praxis_id);

-- Analytics events
CREATE TABLE analytics_events (
  id TEXT PRIMARY KEY,
  learner_id TEXT,
  event_type TEXT NOT NULL,
  event_data TEXT,
  page_path TEXT,
  referrer TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_analytics_learner ON analytics_events(learner_id);
CREATE INDEX idx_analytics_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_created ON analytics_events(created_at);
