import { DatabaseAdapter } from '../src/models/database.interface';

export async function up(db: DatabaseAdapter): Promise<void> {
  if (db.dialect === 'postgres') {
    // PostgreSQL: idempotent ADD COLUMN using DO blocks
    const tables = [
      'api_keys',
      'prompts',
      'logs',
      'traces',
      'spans',
      'runs',
      'prompt_labels',
      'evaluations',
      'evaluation_results',
      'audit_logs',
    ];
    for (const table of tables) {
      await db.exec(`
        DO $$
        BEGIN
          ALTER TABLE ${table} ADD COLUMN workspace_id TEXT DEFAULT 'default';
        EXCEPTION WHEN duplicate_column THEN
          NULL;
        END $$;
      `);
    }
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_prompts_workspace ON prompts(workspace_id, name);
      CREATE INDEX IF NOT EXISTS idx_logs_workspace ON logs(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_traces_workspace ON traces(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_spans_workspace ON spans(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_runs_workspace ON runs(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_prompt_labels_workspace ON prompt_labels(workspace_id, prompt_name);
      CREATE INDEX IF NOT EXISTS idx_evaluations_workspace ON evaluations(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_evaluation_results_workspace ON evaluation_results(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace ON audit_logs(workspace_id);
    `);
  } else {
    // SQLite
    await db.exec(`
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
    `);
  }
}

export async function down(db: DatabaseAdapter): Promise<void> {
  await db.exec(`
    DROP INDEX IF EXISTS idx_prompts_workspace;
    DROP INDEX IF EXISTS idx_logs_workspace;
    DROP INDEX IF EXISTS idx_traces_workspace;
    DROP INDEX IF EXISTS idx_spans_workspace;
    DROP INDEX IF EXISTS idx_runs_workspace;
    DROP INDEX IF EXISTS idx_prompt_labels_workspace;
    DROP INDEX IF EXISTS idx_evaluations_workspace;
    DROP INDEX IF EXISTS idx_evaluation_results_workspace;
    DROP INDEX IF EXISTS idx_audit_logs_workspace;

    ALTER TABLE api_keys DROP COLUMN IF EXISTS workspace_id;
    ALTER TABLE prompts DROP COLUMN IF EXISTS workspace_id;
    ALTER TABLE logs DROP COLUMN IF EXISTS workspace_id;
    ALTER TABLE traces DROP COLUMN IF EXISTS workspace_id;
    ALTER TABLE spans DROP COLUMN IF EXISTS workspace_id;
    ALTER TABLE runs DROP COLUMN IF EXISTS workspace_id;
    ALTER TABLE prompt_labels DROP COLUMN IF EXISTS workspace_id;
    ALTER TABLE evaluations DROP COLUMN IF EXISTS workspace_id;
    ALTER TABLE evaluation_results DROP COLUMN IF EXISTS workspace_id;
    ALTER TABLE audit_logs DROP COLUMN IF EXISTS workspace_id;
  `);
}
