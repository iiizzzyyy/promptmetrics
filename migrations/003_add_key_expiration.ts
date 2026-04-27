import { DatabaseAdapter } from '../src/models/database.interface';

export async function up(db: DatabaseAdapter): Promise<void> {
  await db.exec(`ALTER TABLE api_keys ADD COLUMN expires_at INTEGER;`);
}

export async function down(db: DatabaseAdapter): Promise<void> {
  await db.exec(`ALTER TABLE api_keys DROP COLUMN IF EXISTS expires_at;`);
}
