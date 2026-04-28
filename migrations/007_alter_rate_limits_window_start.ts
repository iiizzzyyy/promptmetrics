import { DatabaseAdapter } from '../src/models/database.interface';

export async function up(db: DatabaseAdapter): Promise<void> {
  if (db.dialect === 'sqlite') return;
  await db.exec('ALTER TABLE rate_limits ALTER COLUMN window_start TYPE BIGINT');
}

export async function down(db: DatabaseAdapter): Promise<void> {
  if (db.dialect === 'sqlite') return;
  await db.exec('ALTER TABLE rate_limits ALTER COLUMN window_start TYPE INTEGER');
}
