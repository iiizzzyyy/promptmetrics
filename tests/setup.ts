import { closeDb, getDb } from '@models/promptmetrics-sqlite';

beforeEach(async () => {
  if (process.env.DATABASE_URL) {
    try {
      const db = getDb();
      const rows = (await db
        .prepare("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'migrations'")
        .all()) as Array<{ tablename: string }>;
      const tableList = rows.map((r) => `"${r.tablename}"`).join(', ');
      if (tableList) {
        await db.exec(`TRUNCATE TABLE ${tableList} CASCADE`);
      }
    } catch {
      // ignore cleanup errors (e.g., connection not yet initialized)
    }
  }
});

afterAll(async () => {
  if (process.env.DATABASE_URL) {
    try {
      const db = getDb();
      const tables = (await db
        .prepare("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'migrations'")
        .all()) as Array<{ tablename: string }>;
      for (const row of tables) {
        await db.exec(`TRUNCATE TABLE "${row.tablename}" CASCADE`);
      }
    } catch {
      // ignore cleanup errors (e.g., connection already closed)
    }
  }
  await closeDb();
});
