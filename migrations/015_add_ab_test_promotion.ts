import { DatabaseAdapter } from '../src/models/database.interface';

export async function up(db: DatabaseAdapter): Promise<void> {
  await db.exec(`
    ALTER TABLE ab_tests ADD COLUMN promoted_version TEXT;
    ALTER TABLE ab_tests ADD COLUMN promoted_at INTEGER;
  `);
}

export async function down(db: DatabaseAdapter): Promise<void> {
  if (db.dialect === 'sqlite') {
    await db.exec(`
      ALTER TABLE ab_tests DROP COLUMN promoted_version;
      ALTER TABLE ab_tests DROP COLUMN promoted_at;
    `);
  } else {
    await db.exec(`
      ALTER TABLE ab_tests DROP COLUMN IF EXISTS promoted_version;
      ALTER TABLE ab_tests DROP COLUMN IF EXISTS promoted_at;
    `);
  }
}
