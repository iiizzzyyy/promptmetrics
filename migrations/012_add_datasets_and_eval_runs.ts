import { DatabaseAdapter } from '../src/models/database.interface';
import { idColumn, nowFn } from './dialect-helpers';

export async function up(db: DatabaseAdapter): Promise<void> {
  const d = db.dialect;

  await db.exec(`
    CREATE TABLE IF NOT EXISTS datasets (
      id ${idColumn(d)},
      name TEXT NOT NULL,
      workspace_id TEXT NOT NULL DEFAULT 'default',
      row_count INTEGER NOT NULL DEFAULT 0,
      schema_json TEXT,
      created_at INTEGER NOT NULL DEFAULT (${nowFn(d)})
    );

    CREATE INDEX IF NOT EXISTS idx_datasets_workspace ON datasets(workspace_id, created_at);

    CREATE TABLE IF NOT EXISTS dataset_rows (
      id ${idColumn(d)},
      dataset_id INTEGER NOT NULL,
      input_json TEXT NOT NULL,
      expected_output_json TEXT,
      created_at INTEGER NOT NULL DEFAULT (${nowFn(d)}),
      workspace_id TEXT NOT NULL DEFAULT 'default',
      FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_dataset_rows_dataset ON dataset_rows(dataset_id);

    CREATE TABLE IF NOT EXISTS eval_runs (
      id ${idColumn(d)},
      evaluation_id INTEGER NOT NULL,
      dataset_id INTEGER,
      status TEXT CHECK(status IN ('running', 'completed', 'failed')) NOT NULL DEFAULT 'running',
      score REAL,
      results_json TEXT,
      created_at INTEGER NOT NULL DEFAULT (${nowFn(d)}),
      workspace_id TEXT NOT NULL DEFAULT 'default',
      FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE CASCADE,
      FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_eval_runs_evaluation ON eval_runs(evaluation_id, status);
  `);
}

export async function down(db: DatabaseAdapter): Promise<void> {
  await db.transaction(async (trx) => {
    await trx.exec(`
      DROP TABLE IF EXISTS eval_runs;
      DROP TABLE IF EXISTS dataset_rows;
      DROP TABLE IF EXISTS datasets;
    `);
  });
}
