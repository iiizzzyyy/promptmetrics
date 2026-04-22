import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '@config/index';

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dbPath = path.resolve(process.env.SQLITE_PATH || config.sqlitePath);
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  dbInstance = new Database(dbPath);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');

  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function initSchema(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      version_tag TEXT NOT NULL,
      commit_sha TEXT,
      fs_path TEXT,
      driver TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      author TEXT,
      UNIQUE(name, version_tag)
    );

    CREATE INDEX IF NOT EXISTS idx_prompts_name ON prompts(name);
    CREATE INDEX IF NOT EXISTS idx_prompts_driver ON prompts(driver);

    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_hash TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      scopes TEXT NOT NULL DEFAULT 'read,write',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      last_used_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prompt_name TEXT,
      version_tag TEXT,
      metadata_json TEXT,
      provider TEXT,
      model TEXT,
      tokens_in INTEGER,
      tokens_out INTEGER,
      latency_ms INTEGER,
      cost_usd REAL,
      ollama_options TEXT,
      ollama_keep_alive TEXT,
      ollama_format TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_logs_prompt ON logs(prompt_name, version_tag);
    CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at);

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      prompt_name TEXT,
      version_tag TEXT,
      api_key_name TEXT,
      ip_address TEXT,
      timestamp INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_prompt ON audit_logs(prompt_name);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);

    CREATE TABLE IF NOT EXISTS traces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trace_id TEXT NOT NULL UNIQUE,
      prompt_name TEXT,
      version_tag TEXT,
      metadata_json TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_traces_trace_id ON traces(trace_id);
    CREATE INDEX IF NOT EXISTS idx_traces_prompt ON traces(prompt_name, version_tag);

    CREATE TABLE IF NOT EXISTS spans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trace_id TEXT NOT NULL,
      span_id TEXT NOT NULL UNIQUE,
      parent_id TEXT,
      name TEXT NOT NULL,
      status TEXT CHECK(status IN ('ok', 'error')),
      start_time INTEGER,
      end_time INTEGER,
      metadata_json TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (trace_id) REFERENCES traces(trace_id)
    );

    CREATE INDEX IF NOT EXISTS idx_spans_trace ON spans(trace_id);
    CREATE INDEX IF NOT EXISTS idx_spans_span_id ON spans(span_id);

    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL UNIQUE,
      workflow_name TEXT NOT NULL,
      status TEXT CHECK(status IN ('running', 'completed', 'failed')) NOT NULL DEFAULT 'running',
      input_json TEXT,
      output_json TEXT,
      trace_id TEXT,
      metadata_json TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (trace_id) REFERENCES traces(trace_id)
    );

    CREATE INDEX IF NOT EXISTS idx_runs_run_id ON runs(run_id);
    CREATE INDEX IF NOT EXISTS idx_runs_workflow ON runs(workflow_name);
    CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
    CREATE INDEX IF NOT EXISTS idx_runs_created ON runs(created_at);

    CREATE TABLE IF NOT EXISTS prompt_labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prompt_name TEXT NOT NULL,
      name TEXT NOT NULL,
      version_tag TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(prompt_name, name)
    );

    CREATE INDEX IF NOT EXISTS idx_prompt_labels_prompt ON prompt_labels(prompt_name);
    CREATE INDEX IF NOT EXISTS idx_prompt_labels_name ON prompt_labels(name);
  `);

  const columns = db.prepare(`PRAGMA table_info(logs)`).all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((c) => c.name));

  if (!columnNames.has('ollama_options')) {
    db.exec(`ALTER TABLE logs ADD COLUMN ollama_options TEXT;`);
  }
  if (!columnNames.has('ollama_keep_alive')) {
    db.exec(`ALTER TABLE logs ADD COLUMN ollama_keep_alive TEXT;`);
  }
  if (!columnNames.has('ollama_format')) {
    db.exec(`ALTER TABLE logs ADD COLUMN ollama_format TEXT;`);
  }
}
