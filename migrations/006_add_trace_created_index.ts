import { DatabaseAdapter } from '../src/models/database.interface';

export async function up(db: DatabaseAdapter): Promise<void> {
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_traces_created ON traces(created_at);`);
}

export async function down(db: DatabaseAdapter): Promise<void> {
  await db.exec(`DROP INDEX IF EXISTS idx_traces_created;`);
}
