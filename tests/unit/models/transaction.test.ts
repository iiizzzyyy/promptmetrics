import fs from 'fs';
import path from 'path';
import { getDb, initSchema, closeDb, withTransaction } from '@models/promptmetrics-sqlite';

describe('withTransaction', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test-transaction.db');

  beforeEach(async () => {
    process.env.SQLITE_PATH = testDbPath;
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
    await closeDb();
    await initSchema();
  });

  afterEach(async () => {
    await closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
  });

  it('should commit on success', async () => {
    await withTransaction((db) => {
      db.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run('foo', 'bar');
    });

    const db = getDb();
    const row = (await db.prepare('SELECT value FROM config WHERE key = ?').get('foo')) as { value: string } | undefined;
    expect(row?.value).toBe('bar');
  });

  it('should rollback on error', async () => {
    await expect(
      withTransaction((db) => {
        db.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run('rollback-key', 'before');
        throw new Error('forced failure');
      }),
    ).rejects.toThrow('forced failure');

    const db = getDb();
    const row = await db.prepare('SELECT value FROM config WHERE key = ?').get('rollback-key');
    expect(row).toBeUndefined();
  });

  it('should return the callback result', async () => {
    const result = await withTransaction((db) => {
      db.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run('return-key', 'return-value');
      return 42;
    });
    expect(result).toBe(42);
  });

  it('should support nested reads inside transaction', async () => {
    await withTransaction((db) => {
      db.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run('nested', 'val');
      const row = db.prepare('SELECT value FROM config WHERE key = ?').get('nested') as { value: string } | undefined;
      expect(row?.value).toBe('val');
    });
  });
});
