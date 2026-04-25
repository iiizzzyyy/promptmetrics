-- Add prompt evaluation framework
-- Created: 2026-04-25

CREATE TABLE IF NOT EXISTS evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  prompt_name TEXT NOT NULL,
  version_tag TEXT,
  criteria_json TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_evaluations_prompt ON evaluations(prompt_name);
CREATE INDEX IF NOT EXISTS idx_evaluations_created ON evaluations(created_at);

CREATE TABLE IF NOT EXISTS evaluation_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evaluation_id INTEGER NOT NULL,
  run_id TEXT,
  score REAL,
  metadata_json TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (evaluation_id) REFERENCES evaluations(id)
);

CREATE INDEX IF NOT EXISTS idx_evaluation_results_evaluation ON evaluation_results(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_results_run ON evaluation_results(run_id);
