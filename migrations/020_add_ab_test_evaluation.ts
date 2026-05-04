import { DatabaseAdapter } from '../src/models/database.interface';
import { idColumn, nowFn } from './dialect-helpers';

export async function up(db: DatabaseAdapter): Promise<void> {
  if (db.dialect === 'postgres') {
    await db.exec(`
      DO $$
      BEGIN
        ALTER TABLE ab_tests ADD COLUMN evaluation_id INTEGER NULL REFERENCES evaluations(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_column THEN
        NULL;
      END $$;
    `);
  } else {
    await db.exec(`
      ALTER TABLE ab_tests ADD COLUMN evaluation_id INTEGER NULL REFERENCES evaluations(id) ON DELETE SET NULL;
    `);
  }
}

export async function down(db: DatabaseAdapter): Promise<void> {
  if (db.dialect === 'postgres') {
    await db.exec(`
      ALTER TABLE ab_tests DROP COLUMN IF EXISTS evaluation_id;
    `);
  } else {
    try {
      await db.exec(`
        ALTER TABLE ab_tests DROP COLUMN evaluation_id;
      `);
    } catch {
      console.warn('SQLite <3.35 does not support DROP COLUMN; skipping evaluation_id removal');
    }
  }
}
