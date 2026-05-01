import { DatabaseAdapter } from '../src/models/database.interface';
import { idColumn, nowFn } from './dialect-helpers';

export async function up(db: DatabaseAdapter): Promise<void> {
  const d = db.dialect;

  await db.exec(`
    CREATE TABLE IF NOT EXISTS compliance_rules (
      id ${idColumn(d)},
      name TEXT NOT NULL,
      pattern TEXT NOT NULL,
      severity TEXT CHECK(severity IN ('critical', 'high', 'medium', 'low', 'info')) NOT NULL,
      category TEXT CHECK(category IN ('pii', 'security', 'toxicity', 'bias', 'transparency', 'custom')) NOT NULL,
      workspace_id TEXT NOT NULL DEFAULT 'default',
      created_at INTEGER NOT NULL DEFAULT (${nowFn(d)})
    );

    CREATE INDEX IF NOT EXISTS idx_compliance_rules_workspace ON compliance_rules(workspace_id, category);

    CREATE TABLE IF NOT EXISTS compliance_scores (
      id ${idColumn(d)},
      prompt_name TEXT NOT NULL,
      version_tag TEXT,
      score REAL NOT NULL,
      violations_json TEXT,
      workspace_id TEXT NOT NULL DEFAULT 'default',
      created_at INTEGER NOT NULL DEFAULT (${nowFn(d)})
    );

    CREATE INDEX IF NOT EXISTS idx_compliance_scores_prompt ON compliance_scores(workspace_id, prompt_name, created_at);
  `);
}

export async function down(db: DatabaseAdapter): Promise<void> {
  await db.transaction(async (trx) => {
    await trx.exec(`
      DROP TABLE IF EXISTS compliance_scores;
      DROP TABLE IF EXISTS compliance_rules;
    `);
  });
}
