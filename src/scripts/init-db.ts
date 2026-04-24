import { getDb, initSchema, closeDb } from '@models/promptmetrics-sqlite';

async function main(): Promise<void> {
  try {
    console.log('Initializing PromptMetrics database...');
    await initSchema();

    const db = getDb();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    console.log('Created tables:', tables.map((t) => t.name).join(', '));

    const journalMode = db.pragma('journal_mode');
    console.log('Journal mode:', journalMode);

    closeDb();
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
