-- 001_initial.sql
-- Original JobRunner schema (extracted from db.ts for migration tracking)
-- This migration is marked as applied automatically since the tables already exist.

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  schedule TEXT NOT NULL,
  goal TEXT NOT NULL,
  policies TEXT,
  boundaries TEXT,
  tools TEXT,
  file_path TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  last_run TEXT,
  next_run TEXT
);

CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL CHECK(status IN ('running','completed','failed','awaiting-approval')),
  summary TEXT,
  error TEXT
);

CREATE TABLE IF NOT EXISTS actions (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES executions(id),
  description TEXT NOT NULL,
  tool TEXT,
  status TEXT NOT NULL CHECK(status IN ('executed','pending-approval','approved','vetoed')),
  boundary_violation TEXT,
  result TEXT,
  created_at TEXT NOT NULL
);
