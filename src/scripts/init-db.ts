import { getDb, initSchema, closeDb } from '@models/promptmetrics-sqlite';

function main(): void {
  try {
    console.log('Initializing PromptMetrics database...');
    initSchema();

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

main();
