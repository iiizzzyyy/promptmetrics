import { closeDb, getDb } from '@models/promptmetrics-sqlite';

afterAll(async () => {
  if (process.env.DATABASE_URL) {
    try {
      const db = getDb();
      const tables = (await db
        .prepare("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'migrations'")
        .all()) as Array<{ tablename: string }>;
      for (const row of tables) {
        await db.exec(`TRUNCATE TABLE "${row.tablename}" RESTART IDENTITY CASCADE`);
      }
    } catch {
      // ignore cleanup errors (e.g., connection already closed)
    }
  }
  await closeDb();
});
