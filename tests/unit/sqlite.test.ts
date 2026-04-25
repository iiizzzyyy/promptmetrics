import fs from 'fs';
import path from 'path';
import { getDb, initSchema, closeDb } from '@models/promptmetrics-sqlite';

describe('SQLite Database', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test-promptmetrics.db');

  beforeEach(async () => {
    process.env.SQLITE_PATH = testDbPath;
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    const walPath = testDbPath + '-wal';
    const shmPath = testDbPath + '-shm';
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
    await closeDb();
  });

  afterEach(async () => {
    await closeDb();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    const walPath = testDbPath + '-wal';
    const shmPath = testDbPath + '-shm';
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  });

  it('should create database with WAL mode', async () => {
    await initSchema();
    const db = getDb();
    const journalMode = await db.prepare("PRAGMA journal_mode").get();
    expect(journalMode).toEqual({ journal_mode: 'wal' });
  });

  it('should create all required tables', async () => {
    await initSchema();
    const db = getDb();
    const tables = (await db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all())
      .map((t: any) => t.name);

    expect(tables).toContain('prompts');
    expect(tables).toContain('api_keys');
    expect(tables).toContain('logs');
    expect(tables).toContain('config');
    expect(tables).toContain('audit_logs');
    expect(tables).toContain('traces');
    expect(tables).toContain('spans');
  });

  it('should create indexes', async () => {
    await initSchema();
    const db = getDb();
    const indexes = (await db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'")
      .all())
      .map((i: any) => i.name);

    expect(indexes).toContain('idx_prompts_name');
    expect(indexes).toContain('idx_logs_prompt');
    expect(indexes).toContain('idx_audit_logs_timestamp');
    expect(indexes).toContain('idx_traces_trace_id');
    expect(indexes).toContain('idx_spans_trace');
  });
});
