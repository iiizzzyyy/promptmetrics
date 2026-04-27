import { DatabaseAdapter } from '../src/models/database.interface';
import { idColumn, nowFn } from './dialect-helpers';

export async function up(db: DatabaseAdapter): Promise<void> {
  const d = db.dialect;

  await db.exec(`
    CREATE TABLE IF NOT EXISTS evaluations (
      id ${idColumn(d)},
      name TEXT NOT NULL,
      description TEXT,
      prompt_name TEXT NOT NULL,
      version_tag TEXT,
      criteria_json TEXT,
      created_at INTEGER NOT NULL DEFAULT (${nowFn(d)})
    );

    CREATE INDEX IF NOT EXISTS idx_evaluations_prompt ON evaluations(prompt_name);
    CREATE INDEX IF NOT EXISTS idx_evaluations_created ON evaluations(created_at);

    CREATE TABLE IF NOT EXISTS evaluation_results (
      id ${idColumn(d)},
      evaluation_id INTEGER NOT NULL,
      run_id TEXT,
      score REAL,
      metadata_json TEXT,
      created_at INTEGER NOT NULL DEFAULT (${nowFn(d)}),
      FOREIGN KEY (evaluation_id) REFERENCES evaluations(id)
    );

    CREATE INDEX IF NOT EXISTS idx_evaluation_results_evaluation ON evaluation_results(evaluation_id);
    CREATE INDEX IF NOT EXISTS idx_evaluation_results_run ON evaluation_results(run_id);
  `);
}

export async function down(db: DatabaseAdapter): Promise<void> {
  await db.transaction(async (trx) => {
    await trx.exec(`
      DROP TABLE IF EXISTS evaluation_results;
      DROP TABLE IF EXISTS evaluations;
    `);
  });
}
