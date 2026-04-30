import { getDb, closeDb, initSchema } from '@models/promptmetrics-sqlite';
import fs from 'fs';
import path from 'path';

const testDbPath = path.resolve(__dirname, '../../data/test-cascade.db');

describe('ON DELETE CASCADE', () => {
  beforeAll(async () => {
    process.env.SQLITE_PATH = testDbPath;
    process.env.DRIVER = 'filesystem';
    process.env.API_KEY_SALT = 'test-cascade-salt';
    await closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
    await initSchema();
  });

  afterAll(async () => {
    await closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
  });

  it('should cascade delete ab_test_results when ab_tests row is deleted', async () => {
    const db = getDb();
    const testInsert = await db
      .prepare('INSERT INTO ab_tests (prompt_name, version_a, version_b, workspace_id) VALUES (?, ?, ?, ?)')
      .run('test-prompt', 'v1', 'v2', 'default');
    const testId = Number(testInsert.lastInsertRowid);

    await db.prepare('INSERT INTO ab_test_results (ab_test_id, workspace_id) VALUES (?, ?)').run(testId, 'default');

    await db.prepare('DELETE FROM ab_tests WHERE id = ?').run(testId);

    const remaining = (await db
      .prepare('SELECT COUNT(*) as c FROM ab_test_results WHERE ab_test_id = ?')
      .get(testId)) as { c: number };
    expect(remaining.c).toBe(0);
  });

  it('should cascade delete dataset_rows when datasets row is deleted', async () => {
    const db = getDb();
    const dsInsert = await db
      .prepare('INSERT INTO datasets (name, workspace_id, row_count) VALUES (?, ?, ?)')
      .run('test-dataset', 'default', 0);
    const dsId = Number(dsInsert.lastInsertRowid);

    await db
      .prepare('INSERT INTO dataset_rows (dataset_id, input_json, workspace_id) VALUES (?, ?, ?)')
      .run(dsId, JSON.stringify({ hello: 'world' }), 'default');

    await db.prepare('DELETE FROM datasets WHERE id = ?').run(dsId);

    const remaining = (await db.prepare('SELECT COUNT(*) as c FROM dataset_rows WHERE dataset_id = ?').get(dsId)) as {
      c: number;
    };
    expect(remaining.c).toBe(0);
  });

  it('should cascade delete eval_runs when evaluation is deleted', async () => {
    const db = getDb();
    const evalInsert = await db
      .prepare('INSERT INTO evaluations (name, prompt_name, workspace_id) VALUES (?, ?, ?)')
      .run('test-eval', 'test-prompt', 'default');
    const evalId = Number(evalInsert.lastInsertRowid);

    await db
      .prepare('INSERT INTO eval_runs (evaluation_id, status, workspace_id) VALUES (?, ?, ?)')
      .run(evalId, 'running', 'default');

    await db.prepare('DELETE FROM evaluations WHERE id = ?').run(evalId);

    const remaining = (await db.prepare('SELECT COUNT(*) as c FROM eval_runs WHERE evaluation_id = ?').get(evalId)) as {
      c: number;
    };
    expect(remaining.c).toBe(0);
  });

  it('should cascade delete eval_runs when dataset is deleted', async () => {
    const db = getDb();
    const dsInsert = await db
      .prepare('INSERT INTO datasets (name, workspace_id, row_count) VALUES (?, ?, ?)')
      .run('test-dataset-for-eval', 'default', 0);
    const dsId = Number(dsInsert.lastInsertRowid);

    const evalInsert = await db
      .prepare('INSERT INTO evaluations (name, prompt_name, workspace_id) VALUES (?, ?, ?)')
      .run('test-eval-ds', 'test-prompt', 'default');
    const evalId = Number(evalInsert.lastInsertRowid);

    await db
      .prepare('INSERT INTO eval_runs (evaluation_id, dataset_id, status, workspace_id) VALUES (?, ?, ?, ?)')
      .run(evalId, dsId, 'running', 'default');

    await db.prepare('DELETE FROM datasets WHERE id = ?').run(dsId);

    const remaining = (await db.prepare('SELECT COUNT(*) as c FROM eval_runs WHERE dataset_id = ?').get(dsId)) as {
      c: number;
    };
    expect(remaining.c).toBe(0);
  });
});
