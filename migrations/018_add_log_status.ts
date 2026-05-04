import { DatabaseAdapter } from '../src/models/database.interface';

export async function up(db: DatabaseAdapter): Promise<void> {
  await db.exec(`
    ALTER TABLE logs ADD COLUMN status TEXT NOT NULL DEFAULT 'ok' CHECK(status IN ('ok','error'));
    ALTER TABLE logs ADD COLUMN error_code TEXT;
    CREATE INDEX IF NOT EXISTS idx_logs_workspace_status_created ON logs(workspace_id, status, created_at);
  `);
}

export async function down(db: DatabaseAdapter): Promise<void> {
  if (db.dialect === 'postgres') {
    await db.exec(`
      DROP INDEX IF EXISTS idx_logs_workspace_status_created;
      ALTER TABLE logs DROP COLUMN IF EXISTS status;
      ALTER TABLE logs DROP COLUMN IF EXISTS error_code;
    `);
  } else {
    try {
      await db.exec(`
        ALTER TABLE logs DROP COLUMN status;
        ALTER TABLE logs DROP COLUMN error_code;
      `);
    } catch {
      console.warn('SQLite <3.35 does not support DROP COLUMN; skipping status/error_code removal');
    }
    await db.exec(`
      DROP INDEX IF EXISTS idx_logs_workspace_status_created;
    `);
  }
}
