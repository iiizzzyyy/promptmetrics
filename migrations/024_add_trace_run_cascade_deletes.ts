import { DatabaseAdapter } from '../src/models/database.interface';

export async function up(db: DatabaseAdapter): Promise<void> {
  if (db.dialect === 'sqlite') {
    await db.exec(`
      PRAGMA foreign_keys = OFF;

      DELETE FROM spans WHERE trace_id NOT IN (SELECT trace_id FROM traces);
      ALTER TABLE spans RENAME TO spans_old;
      CREATE TABLE spans (
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
        workspace_id TEXT NOT NULL DEFAULT 'default',
        FOREIGN KEY (trace_id) REFERENCES traces(trace_id) ON DELETE CASCADE
      );
      INSERT INTO spans SELECT * FROM spans_old;
      DROP TABLE spans_old;
      CREATE INDEX IF NOT EXISTS idx_spans_trace ON spans(trace_id);
      CREATE INDEX IF NOT EXISTS idx_spans_span_id ON spans(span_id);

      DELETE FROM runs WHERE trace_id IS NOT NULL AND trace_id NOT IN (SELECT trace_id FROM traces);
      ALTER TABLE runs RENAME TO runs_old;
      CREATE TABLE runs (
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
        workspace_id TEXT NOT NULL DEFAULT 'default',
        FOREIGN KEY (trace_id) REFERENCES traces(trace_id) ON DELETE SET NULL
      );
      INSERT INTO runs SELECT * FROM runs_old;
      DROP TABLE runs_old;
      CREATE INDEX IF NOT EXISTS idx_runs_run_id ON runs(run_id);
      CREATE INDEX IF NOT EXISTS idx_runs_workflow ON runs(workflow_name);
      CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
      CREATE INDEX IF NOT EXISTS idx_runs_created ON runs(created_at);

      PRAGMA foreign_keys = ON;
    `);
  } else {
    await db.exec(`
      DELETE FROM spans WHERE trace_id NOT IN (SELECT trace_id FROM traces);
      ALTER TABLE spans DROP CONSTRAINT IF EXISTS spans_trace_id_fkey;
      ALTER TABLE spans ADD CONSTRAINT spans_trace_id_fkey
        FOREIGN KEY (trace_id) REFERENCES traces(trace_id) ON DELETE CASCADE;

      DELETE FROM runs WHERE trace_id IS NOT NULL AND trace_id NOT IN (SELECT trace_id FROM traces);
      ALTER TABLE runs DROP CONSTRAINT IF EXISTS runs_trace_id_fkey;
      ALTER TABLE runs ADD CONSTRAINT runs_trace_id_fkey
        FOREIGN KEY (trace_id) REFERENCES traces(trace_id) ON DELETE SET NULL;
    `);
  }
}

export async function down(db: DatabaseAdapter): Promise<void> {
  if (db.dialect === 'sqlite') {
    await db.exec(`
      PRAGMA foreign_keys = OFF;

      ALTER TABLE spans RENAME TO spans_old;
      CREATE TABLE spans (
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
        workspace_id TEXT NOT NULL DEFAULT 'default',
        FOREIGN KEY (trace_id) REFERENCES traces(trace_id)
      );
      INSERT INTO spans SELECT * FROM spans_old;
      DROP TABLE spans_old;
      CREATE INDEX IF NOT EXISTS idx_spans_trace ON spans(trace_id);
      CREATE INDEX IF NOT EXISTS idx_spans_span_id ON spans(span_id);

      ALTER TABLE runs RENAME TO runs_old;
      CREATE TABLE runs (
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
        workspace_id TEXT NOT NULL DEFAULT 'default',
        FOREIGN KEY (trace_id) REFERENCES traces(trace_id)
      );
      INSERT INTO runs SELECT * FROM runs_old;
      DROP TABLE runs_old;
      CREATE INDEX IF NOT EXISTS idx_runs_run_id ON runs(run_id);
      CREATE INDEX IF NOT EXISTS idx_runs_workflow ON runs(workflow_name);
      CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
      CREATE INDEX IF NOT EXISTS idx_runs_created ON runs(created_at);

      PRAGMA foreign_keys = ON;
    `);
  } else {
    await db.exec(`
      ALTER TABLE spans DROP CONSTRAINT IF EXISTS spans_trace_id_fkey;
      ALTER TABLE spans ADD CONSTRAINT spans_trace_id_fkey
        FOREIGN KEY (trace_id) REFERENCES traces(trace_id);

      ALTER TABLE runs DROP CONSTRAINT IF EXISTS runs_trace_id_fkey;
      ALTER TABLE runs ADD CONSTRAINT runs_trace_id_fkey
        FOREIGN KEY (trace_id) REFERENCES traces(trace_id);
    `);
  }
}