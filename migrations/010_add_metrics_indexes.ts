import { DatabaseAdapter } from '../src/models/database.interface';

export async function up(db: DatabaseAdapter): Promise<void> {
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_logs_workspace_created ON logs(workspace_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_logs_workspace_prompt_created ON logs(workspace_id, prompt_name, version_tag, created_at);
    CREATE INDEX IF NOT EXISTS idx_runs_workspace_created ON runs(workspace_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_spans_workspace_created ON spans(workspace_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_evaluation_results_workspace_created ON evaluation_results(workspace_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_traces_workspace_created ON traces(workspace_id, created_at);
  `);
}

export async function down(db: DatabaseAdapter): Promise<void> {
  await db.exec(`
    DROP INDEX IF EXISTS idx_logs_workspace_created;
    DROP INDEX IF EXISTS idx_logs_workspace_prompt_created;
    DROP INDEX IF EXISTS idx_runs_workspace_created;
    DROP INDEX IF EXISTS idx_spans_workspace_created;
    DROP INDEX IF EXISTS idx_evaluation_results_workspace_created;
    DROP INDEX IF EXISTS idx_traces_workspace_created;
  `);
}
