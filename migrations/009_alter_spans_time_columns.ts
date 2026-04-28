import { DatabaseAdapter } from '../src/models/database.interface';

export async function up(db: DatabaseAdapter): Promise<void> {
  if (db.dialect === 'sqlite') return;
  await db.exec('ALTER TABLE spans ALTER COLUMN start_time TYPE BIGINT');
  await db.exec('ALTER TABLE spans ALTER COLUMN end_time TYPE BIGINT');
}

export async function down(db: DatabaseAdapter): Promise<void> {
  if (db.dialect === 'sqlite') return;
  await db.exec('ALTER TABLE spans ALTER COLUMN end_time TYPE INTEGER');
  await db.exec('ALTER TABLE spans ALTER COLUMN start_time TYPE INTEGER');
}
