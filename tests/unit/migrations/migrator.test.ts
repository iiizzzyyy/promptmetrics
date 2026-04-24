import fs from 'fs';
import path from 'path';
import { getDb, initSchema, closeDb } from '@models/promptmetrics-sqlite';
import { createMigrator } from '@migrations/migrator';

describe('createMigrator', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test-migrator.db');

  beforeEach(async () => {
    process.env.SQLITE_PATH = testDbPath;
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
    closeDb();
    await initSchema();
  });

  afterEach(() => {
    closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
  });

  it('should return an Umzug instance', () => {
    const migrator = createMigrator();
    expect(migrator).toBeDefined();
    expect(typeof migrator.up).toBe('function');
    expect(typeof migrator.down).toBe('function');
  });

  it('should run migrations and create tables', async () => {
    const migrator = createMigrator();
    await migrator.up();

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
    expect(tables).toContain('traces');
    expect(tables).toContain('spans');
    expect(tables).toContain('runs');
    expect(tables).toContain('prompt_labels');
  });

  it('should track executed migrations', async () => {
    const migrator = createMigrator();
    await migrator.up();

    const executed = await migrator.executed();
    expect(executed.length).toBeGreaterThanOrEqual(1);
    expect(executed.map((m) => m.name)).toContain('001_initial_schema.sql');
  });

  it('should be idempotent on subsequent up() calls', async () => {
    const migrator = createMigrator();
    await migrator.up();
    await migrator.up();

    const executed = await migrator.executed();
    expect(executed.length).toBeGreaterThanOrEqual(1);
  });
});
