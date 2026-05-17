import { DatabaseAdapter } from '../src/models/database.interface';

export async function up(db: DatabaseAdapter): Promise<void> {
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
        status TEXT CHECK(status IN ('unset', 'ok', 'error', 'running')) NOT NULL DEFAULT 'unset',
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

      PRAGMA foreign_keys = ON;
    `);
  } else {
    await db.exec(`
      ALTER TABLE spans DROP CONSTRAINT IF EXISTS spans_status_check;
      ALTER TABLE spans ADD CONSTRAINT spans_status_check CHECK(status IN ('unset', 'ok', 'error', 'running'));

      ALTER TABLE spans ALTER COLUMN status SET DEFAULT 'unset';
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
        FOREIGN KEY (trace_id) REFERENCES traces(trace_id) ON DELETE CASCADE
      );
      INSERT INTO spans SELECT * FROM spans_old WHERE status IN ('ok', 'error');
      DROP TABLE spans_old;
      CREATE INDEX IF NOT EXISTS idx_spans_trace ON spans(trace_id);
      CREATE INDEX IF NOT EXISTS idx_spans_span_id ON spans(span_id);

      PRAGMA foreign_keys = ON;
    `);
  } else {
    await db.exec(`
      ALTER TABLE spans DROP CONSTRAINT IF EXISTS spans_status_check;
      ALTER TABLE spans ADD CONSTRAINT spans_status_check CHECK(status IN ('ok', 'error'));
    `);
  }
}