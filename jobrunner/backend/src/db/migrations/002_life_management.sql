-- 002_life_management.sql
-- Life management system tables

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  raw_text TEXT,
  structured_data TEXT,
  urgency_score REAL DEFAULT 0,
  importance_score REAL DEFAULT 0,
  composite_score REAL DEFAULT 0,
  status TEXT DEFAULT 'open',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  due_date TEXT,
  last_touched TEXT,
  snoozed_until TEXT,
  parent_id TEXT,
  thread_id TEXT
);

CREATE TABLE IF NOT EXISTS knowledge_log (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  subject TEXT,
  category TEXT,
  entry_date TEXT NOT NULL,
  content TEXT NOT NULL,
  structured_tags TEXT,
  source_item_id TEXT
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  domain TEXT NOT NULL,
  action TEXT NOT NULL,
  item_id TEXT,
  metadata TEXT
);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  domain TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  next_due TEXT NOT NULL,
  item_template TEXT NOT NULL,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  description TEXT NOT NULL,
  target_date TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_profile (
  id INTEGER PRIMARY KEY,
  content TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  top_five TEXT NOT NULL,
  domain_health TEXT NOT NULL,
  summary TEXT
);

CREATE TABLE IF NOT EXISTS nudges (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  reasoning TEXT,
  domain TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL,
  source TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_items_domain ON items(domain);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_due_date ON items(due_date);
CREATE INDEX IF NOT EXISTS idx_items_source ON items(source);
CREATE INDEX IF NOT EXISTS idx_items_thread_id ON items(thread_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_domain ON knowledge_log(domain);
CREATE INDEX IF NOT EXISTS idx_knowledge_subject ON knowledge_log(subject);
CREATE INDEX IF NOT EXISTS idx_activity_domain ON activity_log(domain);
CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_templates_domain ON templates(domain);
CREATE INDEX IF NOT EXISTS idx_templates_next_due ON templates(next_due);
CREATE INDEX IF NOT EXISTS idx_goals_domain ON goals(domain);
CREATE INDEX IF NOT EXISTS idx_nudges_status ON nudges(status);
CREATE INDEX IF NOT EXISTS idx_daily_snapshots_date ON daily_snapshots(date);

-- Migration tracking table
CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL
);
