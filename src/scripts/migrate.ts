import { initSchema, closeDb } from '@models/promptmetrics-sqlite';

async function main(): Promise<void> {
  try {
    console.log('Running migrations...');
    await initSchema();
    console.log('Migrations complete.');
    await closeDb();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
