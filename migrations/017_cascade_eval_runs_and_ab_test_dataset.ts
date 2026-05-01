import { DatabaseAdapter } from '../src/models/database.interface';

export async function up(db: DatabaseAdapter): Promise<void> {
  if (db.dialect === 'sqlite') {
    await db.exec(`
      PRAGMA foreign_keys = OFF;

      DELETE FROM eval_runs WHERE evaluation_id NOT IN (SELECT id FROM evaluations);
      DELETE FROM eval_runs WHERE dataset_id IS NOT NULL AND dataset_id NOT IN (SELECT id FROM datasets);

      ALTER TABLE eval_runs RENAME TO eval_runs_old;
      CREATE TABLE eval_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        evaluation_id INTEGER NOT NULL,
        dataset_id INTEGER,
        status TEXT CHECK(status IN ('running', 'completed', 'failed')) NOT NULL DEFAULT 'running',
        score REAL,
        results_json TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        workspace_id TEXT NOT NULL DEFAULT 'default',
        FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE CASCADE,
        FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
      );
      INSERT INTO eval_runs SELECT * FROM eval_runs_old;
      DROP TABLE eval_runs_old;
      CREATE INDEX IF NOT EXISTS idx_eval_runs_evaluation ON eval_runs(evaluation_id, status);

      PRAGMA foreign_keys = ON;
    `);
  } else {
    await db.exec(`
      DELETE FROM eval_runs WHERE evaluation_id NOT IN (SELECT id FROM evaluations);
      DELETE FROM eval_runs WHERE dataset_id IS NOT NULL AND dataset_id NOT IN (SELECT id FROM datasets);

      ALTER TABLE eval_runs DROP CONSTRAINT IF EXISTS eval_runs_evaluation_id_fkey;
      ALTER TABLE eval_runs ADD CONSTRAINT eval_runs_evaluation_id_fkey
        FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE CASCADE;

      ALTER TABLE eval_runs DROP CONSTRAINT IF EXISTS eval_runs_dataset_id_fkey;
      ALTER TABLE eval_runs ADD CONSTRAINT eval_runs_dataset_id_fkey
        FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE;
    `);
  }
}

export async function down(db: DatabaseAdapter): Promise<void> {
  if (db.dialect === 'sqlite') {
    await db.exec(`
      PRAGMA foreign_keys = OFF;

      ALTER TABLE eval_runs RENAME TO eval_runs_old;
      CREATE TABLE eval_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        evaluation_id INTEGER NOT NULL,
        dataset_id INTEGER,
        status TEXT CHECK(status IN ('running', 'completed', 'failed')) NOT NULL DEFAULT 'running',
        score REAL,
        results_json TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        workspace_id TEXT NOT NULL DEFAULT 'default'
      );
      INSERT INTO eval_runs SELECT * FROM eval_runs_old;
      DROP TABLE eval_runs_old;
      CREATE INDEX IF NOT EXISTS idx_eval_runs_evaluation ON eval_runs(evaluation_id, status);

      PRAGMA foreign_keys = ON;
    `);
  } else {
    await db.exec(`
      ALTER TABLE eval_runs DROP CONSTRAINT IF EXISTS eval_runs_evaluation_id_fkey;
      ALTER TABLE eval_runs DROP CONSTRAINT IF EXISTS eval_runs_dataset_id_fkey;
    `);
  }
}
