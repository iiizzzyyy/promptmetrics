import fs from 'fs';
import path from 'path';
import { getDb, initSchema, closeDb } from '@models/promptmetrics-sqlite';

describe('SQLite Database', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test-promptmetrics.db');

  beforeEach(() => {
    process.env.SQLITE_PATH = testDbPath;
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    const walPath = testDbPath + '-wal';
    const shmPath = testDbPath + '-shm';
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
    closeDb();
  });

  afterEach(() => {
    closeDb();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    const walPath = testDbPath + '-wal';
    const shmPath = testDbPath + '-shm';
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  });

  it('should create database with WAL mode', () => {
    initSchema();
    const db = getDb();
    const journalMode = db.pragma('journal_mode');
    expect(journalMode).toEqual([{ journal_mode: 'wal' }]);
  });

  it('should create all required tables', () => {
    initSchema();
    const db = getDb();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((t: any) => t.name);

    expect(tables).toContain('prompts');
    expect(tables).toContain('api_keys');
    expect(tables).toContain('logs');
    expect(tables).toContain('config');
    expect(tables).toContain('audit_logs');
  });

  it('should create indexes', () => {
    initSchema();
    const db = getDb();
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'")
      .all()
      .map((i: any) => i.name);

    expect(indexes).toContain('idx_prompts_name');
    expect(indexes).toContain('idx_logs_prompt');
    expect(indexes).toContain('idx_audit_logs_timestamp');
  });
});
