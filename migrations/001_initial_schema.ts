import { DatabaseAdapter, idColumn, nowFn } from './dialect-helpers';

export async function up(db: DatabaseAdapter): Promise<void> {
  const d = db.dialect;

  db.exec(`
    CREATE TABLE IF NOT EXISTS prompts (
      id ${idColumn(d)},
      name TEXT NOT NULL,
      version_tag TEXT NOT NULL,
      commit_sha TEXT,
      fs_path TEXT,
      driver TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (${nowFn(d)}),
      author TEXT,
      UNIQUE(name, version_tag)
    );

    CREATE INDEX IF NOT EXISTS idx_prompts_name ON prompts(name);
    CREATE INDEX IF NOT EXISTS idx_prompts_driver ON prompts(driver);

    CREATE TABLE IF NOT EXISTS api_keys (
      id ${idColumn(d)},
      key_hash TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      scopes TEXT NOT NULL DEFAULT 'read,write',
      created_at INTEGER NOT NULL DEFAULT (${nowFn(d)}),
      last_used_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS logs (
      id ${idColumn(d)},
      prompt_name TEXT,
      version_tag TEXT,
      metadata_json TEXT,
      provider TEXT,
      model TEXT,
      tokens_in INTEGER,
      tokens_out INTEGER,
      latency_ms INTEGER,
      cost_usd REAL,
      created_at INTEGER NOT NULL DEFAULT (${nowFn(d)})
    );

    CREATE INDEX IF NOT EXISTS idx_logs_prompt ON logs(prompt_name, version_tag);
    CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at);

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id ${idColumn(d)},
      action TEXT NOT NULL,
      prompt_name TEXT,
      version_tag TEXT,
      api_key_name TEXT,
      ip_address TEXT,
      timestamp INTEGER NOT NULL DEFAULT (${nowFn(d)})
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_prompt ON audit_logs(prompt_name);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);

    CREATE TABLE IF NOT EXISTS traces (
      id ${idColumn(d)},
      trace_id TEXT NOT NULL UNIQUE,
      prompt_name TEXT,
      version_tag TEXT,
      metadata_json TEXT,
      created_at INTEGER NOT NULL DEFAULT (${nowFn(d)})
    );

    CREATE INDEX IF NOT EXISTS idx_traces_trace_id ON traces(trace_id);
    CREATE INDEX IF NOT EXISTS idx_traces_prompt ON traces(prompt_name, version_tag);

    CREATE TABLE IF NOT EXISTS spans (
      id ${idColumn(d)},
      trace_id TEXT NOT NULL,
      span_id TEXT NOT NULL UNIQUE,
      parent_id TEXT,
      name TEXT NOT NULL,
      status TEXT CHECK(status IN ('ok', 'error')),
      start_time INTEGER,
      end_time INTEGER,
      metadata_json TEXT,
      created_at INTEGER NOT NULL DEFAULT (${nowFn(d)}),
      FOREIGN KEY (trace_id) REFERENCES traces(trace_id)
    );

    CREATE INDEX IF NOT EXISTS idx_spans_trace ON spans(trace_id);
    CREATE INDEX IF NOT EXISTS idx_spans_span_id ON spans(span_id);

    CREATE TABLE IF NOT EXISTS runs (
      id ${idColumn(d)},
      run_id TEXT NOT NULL UNIQUE,
      workflow_name TEXT NOT NULL,
      status TEXT CHECK(status IN ('running', 'completed', 'failed')) NOT NULL DEFAULT 'running',
      input_json TEXT,
      output_json TEXT,
      trace_id TEXT,
      metadata_json TEXT,
      created_at INTEGER NOT NULL DEFAULT (${nowFn(d)}),
      updated_at INTEGER NOT NULL DEFAULT (${nowFn(d)}),
      FOREIGN KEY (trace_id) REFERENCES traces(trace_id)
    );

    CREATE INDEX IF NOT EXISTS idx_runs_run_id ON runs(run_id);
    CREATE INDEX IF NOT EXISTS idx_runs_workflow ON runs(workflow_name);
    CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
    CREATE INDEX IF NOT EXISTS idx_runs_created ON runs(created_at);

    CREATE TABLE IF NOT EXISTS prompt_labels (
      id ${idColumn(d)},
      prompt_name TEXT NOT NULL,
      name TEXT NOT NULL,
      version_tag TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (${nowFn(d)}),
      UNIQUE(prompt_name, name)
    );

    CREATE INDEX IF NOT EXISTS idx_prompt_labels_prompt ON prompt_labels(prompt_name);
    CREATE INDEX IF NOT EXISTS idx_prompt_labels_name ON prompt_labels(name);

    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      window_start INTEGER NOT NULL,
      count INTEGER NOT NULL DEFAULT 0
    );
  `);
}

export async function down(db: DatabaseAdapter): Promise<void> {
  db.exec(`
    DROP TABLE IF EXISTS rate_limits;
    DROP TABLE IF EXISTS prompt_labels;
    DROP TABLE IF EXISTS runs;
    DROP TABLE IF EXISTS spans;
    DROP TABLE IF EXISTS traces;
    DROP TABLE IF EXISTS audit_logs;
    DROP TABLE IF EXISTS config;
    DROP TABLE IF EXISTS logs;
    DROP TABLE IF EXISTS api_keys;
    DROP TABLE IF EXISTS prompts;
  `);
}
