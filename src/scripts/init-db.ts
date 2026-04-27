import { getDb, initSchema, closeDb } from '@models/promptmetrics-sqlite';

async function main(): Promise<void> {
  try {
    console.log('Initializing PromptMetrics database...');
    await initSchema();

    const db = getDb();
    let tables: string[];
    if (db.dialect === 'postgres') {
      const rows = (await db.prepare("SELECT tablename FROM pg_tables WHERE schemaname = 'public'").all()) as {
        tablename: string;
      }[];
      tables = rows.map((r) => r.tablename);
    } else {
      const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
      tables = rows.map((r) => r.name);
    }
    console.log('Created tables:', tables.join(', '));

    console.log('Journal mode: WAL');

    await closeDb();
    console.log('Database initialized successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
