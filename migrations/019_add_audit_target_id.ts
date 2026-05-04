import { DatabaseAdapter } from '../src/models/database.interface';

export async function up(db: DatabaseAdapter): Promise<void> {
  if (db.dialect === 'postgres') {
    await db.exec(`
      DO $$
      BEGIN
        ALTER TABLE audit_logs ADD COLUMN target_id TEXT;
      EXCEPTION WHEN duplicate_column THEN
        NULL;
      END $$;

      CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(workspace_id, action, target_id);
    `);
  } else {
    await db.exec(`
      ALTER TABLE audit_logs ADD COLUMN target_id TEXT;
      CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(workspace_id, action, target_id);
    `);
  }
}

export async function down(db: DatabaseAdapter): Promise<void> {
  await db.exec(`
    DROP INDEX IF EXISTS idx_audit_logs_target;
  `);

  if (db.dialect === 'postgres') {
    await db.exec(`
      ALTER TABLE audit_logs DROP COLUMN IF EXISTS target_id;
    `);
  } else {
    try {
      await db.exec(`
        ALTER TABLE audit_logs DROP COLUMN target_id;
      `);
    } catch {
      console.warn('SQLite <3.35 does not support DROP COLUMN; skipping target_id removal');
    }
  }
}
