import { DatabaseAdapter } from './dialect-helpers';

export async function up(db: DatabaseAdapter): Promise<void> {
  db.exec(`CREATE INDEX IF NOT EXISTS idx_traces_created ON traces(created_at);`);
}

export async function down(db: DatabaseAdapter): Promise<void> {
  db.exec(`DROP INDEX IF EXISTS idx_traces_created;`);
}
