import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '@config/index';
import { createMigrator } from '@migrations/migrator';

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dbPath = path.resolve(process.env.SQLITE_PATH || config.sqlitePath);
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  dbInstance = new Database(dbPath);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');

  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export async function initSchema(): Promise<void> {
  const migrator = createMigrator();
  await migrator.up();
}

export function withTransaction<T>(fn: (db: Database.Database) => T): T {
  const db = getDb();
  return db.transaction(fn)(db);
}
