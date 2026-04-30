import { DatabaseAdapter } from '../src/models/database.interface';
import { idColumn, nowFn } from './dialect-helpers';

export async function up(db: DatabaseAdapter): Promise<void> {
  const d = db.dialect;

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ab_tests (
      id ${idColumn(d)},
      prompt_name TEXT NOT NULL,
      version_a TEXT NOT NULL,
      version_b TEXT NOT NULL,
      dataset_id INTEGER,
      status TEXT CHECK(status IN ('running', 'completed', 'cancelled')) NOT NULL DEFAULT 'running',
      metric TEXT NOT NULL DEFAULT 'latency',
      created_at INTEGER NOT NULL DEFAULT (${nowFn(d)}),
      updated_at INTEGER NOT NULL DEFAULT (${nowFn(d)}),
      workspace_id TEXT NOT NULL DEFAULT 'default'
    );

    CREATE INDEX IF NOT EXISTS idx_ab_tests_workspace ON ab_tests(workspace_id, created_at);

    CREATE TABLE IF NOT EXISTS ab_test_results (
      id ${idColumn(d)},
      ab_test_id INTEGER NOT NULL,
      version_a_score REAL,
      version_b_score REAL,
      p_value REAL,
      winner TEXT,
      created_at INTEGER NOT NULL DEFAULT (${nowFn(d)}),
      workspace_id TEXT NOT NULL DEFAULT 'default',
      FOREIGN KEY (ab_test_id) REFERENCES ab_tests(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_ab_test_results_test ON ab_test_results(ab_test_id);
  `);
}

export async function down(db: DatabaseAdapter): Promise<void> {
  await db.transaction(async (trx) => {
    await trx.exec(`
      DROP TABLE IF EXISTS ab_test_results;
      DROP TABLE IF EXISTS ab_tests;
    `);
  });
}
