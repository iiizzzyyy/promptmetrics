-- Add workspace_id for multi-tenancy support
-- Created: 2026-04-25

ALTER TABLE api_keys ADD COLUMN workspace_id TEXT DEFAULT 'default';
ALTER TABLE prompts ADD COLUMN workspace_id TEXT DEFAULT 'default';
ALTER TABLE logs ADD COLUMN workspace_id TEXT DEFAULT 'default';
ALTER TABLE traces ADD COLUMN workspace_id TEXT DEFAULT 'default';
ALTER TABLE spans ADD COLUMN workspace_id TEXT DEFAULT 'default';
ALTER TABLE runs ADD COLUMN workspace_id TEXT DEFAULT 'default';
ALTER TABLE prompt_labels ADD COLUMN workspace_id TEXT DEFAULT 'default';
ALTER TABLE evaluations ADD COLUMN workspace_id TEXT DEFAULT 'default';
ALTER TABLE evaluation_results ADD COLUMN workspace_id TEXT DEFAULT 'default';
ALTER TABLE audit_logs ADD COLUMN workspace_id TEXT DEFAULT 'default';

CREATE INDEX IF NOT EXISTS idx_prompts_workspace ON prompts(workspace_id, name);
CREATE INDEX IF NOT EXISTS idx_logs_workspace ON logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_traces_workspace ON traces(workspace_id);
CREATE INDEX IF NOT EXISTS idx_spans_workspace ON spans(workspace_id);
CREATE INDEX IF NOT EXISTS idx_runs_workspace ON runs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_prompt_labels_workspace ON prompt_labels(workspace_id, prompt_name);
CREATE INDEX IF NOT EXISTS idx_evaluations_workspace ON evaluations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_results_workspace ON evaluation_results(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace ON audit_logs(workspace_id);
