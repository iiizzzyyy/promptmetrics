import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '@config/index';
import { createMigrator } from '@migrations/migrator';
import { DatabaseAdapter } from './database.interface';
import { SqliteAdapter } from './sqlite.adapter';
import { PostgresAdapter } from './postgres.adapter';

let dbInstance: DatabaseAdapter | null = null;

export function getDb(): DatabaseAdapter {
  if (dbInstance) return dbInstance;

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    dbInstance = new PostgresAdapter(databaseUrl);
    return dbInstance;
  }

  const dbPath = path.resolve(process.env.SQLITE_PATH || config.sqlitePath);
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const rawDb = new Database(dbPath);
  rawDb.pragma('journal_mode = WAL');
  rawDb.pragma('foreign_keys = ON');
  rawDb.pragma('busy_timeout = 5000');

  dbInstance = new SqliteAdapter(rawDb);
  return dbInstance;
}

export async function closeDb(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}

export async function initSchema(): Promise<void> {
  const migrator = createMigrator();
  await migrator.up();
}

export async function withTransaction<T>(fn: (db: DatabaseAdapter) => T | Promise<T>): Promise<T> {
  const db = getDb();
  return await db.transaction(fn);
}
