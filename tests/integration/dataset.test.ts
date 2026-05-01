process.env.RATE_LIMIT_MAX_REQUESTS = '10000';

import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '@app';
import { getDb, closeDb, initSchema } from '@models/promptmetrics-sqlite';
import { hashApiKey } from '@middlewares/promptmetrics-auth.middleware';
import { FilesystemDriver } from '@drivers/promptmetrics-filesystem-driver';

const testDbPath = path.resolve(__dirname, '../../data/test-datasets.db');
const testPromptsPath = path.resolve(__dirname, '../../data/test-datasets-prompts');

describe('Dataset API', () => {
  let app: ReturnType<typeof createApp>;
  let apiKey: string;

  beforeAll(async () => {
    process.env.SQLITE_PATH = testDbPath;
    if (fs.existsSync(testPromptsPath)) fs.rmSync(testPromptsPath, { recursive: true });
    process.env.DRIVER = 'filesystem';
    process.env.API_KEY_SALT = 'test-dataset-salt';

    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');

    await closeDb();
    await initSchema();
    const db = getDb();
    apiKey = 'pm_test_dataset_key';
    await db.prepare('INSERT INTO api_keys (key_hash, name, scopes) VALUES (?, ?, ?)').run(
      hashApiKey(apiKey),
      'dataset-test',
      'read,write',
    );
    const driver = new FilesystemDriver(testPromptsPath);
    app = createApp(driver);
  });

  afterAll(async () => {
    await closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
  });

  it('should create a dataset with rows', async () => {
    const res = await request(app)
      .post('/v1/datasets')
      .set('X-API-Key', apiKey)
      .send({
        name: 'test-dataset',
        rows: [{ input: { message: 'hello' }, expectedOutput: { response: 'hi' } }, { input: { message: 'world' } }],
      });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('test-dataset');
    expect(res.body.row_count).toBe(2);
    expect(res.body.id).toBeDefined();
  });

  it('should reject dataset exceeding max rows', async () => {
    const rows = Array.from({ length: 10001 }, () => ({ input: { key: 'value' } }));
    const res = await request(app).post('/v1/datasets').set('X-API-Key', apiKey).send({ name: 'too-big', rows });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });

  it('should reject invalid dataset payload with 422', async () => {
    const res = await request(app).post('/v1/datasets').set('X-API-Key', apiKey).send({ name: 'invalid' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('should list datasets with pagination', async () => {
    const res = await request(app).get('/v1/datasets?page=1&limit=10').set('X-API-Key', apiKey);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(10);
  });

  it('should get a dataset by id with preview', async () => {
    const createRes = await request(app)
      .post('/v1/datasets')
      .set('X-API-Key', apiKey)
      .send({
        name: 'preview-dataset',
        rows: [
          { input: { a: 1 }, expectedOutput: { b: 2 } },
          { input: { a: 2 } },
          { input: { a: 3 } },
          { input: { a: 4 } },
          { input: { a: 5 } },
          { input: { a: 6 } },
        ],
      });
    const id = createRes.body.id;

    const res = await request(app).get(`/v1/datasets/${id}`).set('X-API-Key', apiKey);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body.name).toBe('preview-dataset');
    expect(res.body.row_count).toBe(6);
    expect(res.body.preview).toHaveLength(5);
    expect(res.body.preview[0].input).toEqual({ a: 1 });
    expect(res.body.preview[0].expectedOutput).toEqual({ b: 2 });
    expect(res.body.preview[1].expectedOutput).toBeUndefined();
  });

  it('should return 404 for non-existent dataset', async () => {
    const res = await request(app).get('/v1/datasets/99999').set('X-API-Key', apiKey);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('should delete a dataset', async () => {
    const createRes = await request(app)
      .post('/v1/datasets')
      .set('X-API-Key', apiKey)
      .send({
        name: 'to-delete',
        rows: [{ input: { x: 1 } }],
      });
    const id = createRes.body.id;

    const delRes = await request(app).delete(`/v1/datasets/${id}`).set('X-API-Key', apiKey);
    expect(delRes.status).toBe(204);

    const getRes = await request(app).get(`/v1/datasets/${id}`).set('X-API-Key', apiKey);
    expect(getRes.status).toBe(404);
  });

  it('should return 404 when deleting non-existent dataset', async () => {
    const res = await request(app).delete('/v1/datasets/99999').set('X-API-Key', apiKey);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('should isolate datasets per workspace', async () => {
    const db = getDb();
    const workspaceKey = 'pm_workspace_dataset_key';
    await db.prepare('INSERT INTO api_keys (key_hash, name, scopes, workspace_id) VALUES (?, ?, ?, ?) ON CONFLICT(key_hash) DO UPDATE SET name = excluded.name, scopes = excluded.scopes, workspace_id = excluded.workspace_id').run(
      hashApiKey(workspaceKey),
      'workspace-dataset-key',
      'read,write',
      'workspace-ds',
    );

    const createRes = await request(app)
      .post('/v1/datasets')
      .set('X-API-Key', workspaceKey)
      .set('X-Workspace-Id', 'workspace-ds')
      .send({
        name: 'workspace-dataset',
        rows: [{ input: { q: 1 } }],
      });
    expect(createRes.status).toBe(201);
    const id = createRes.body.id;

    const getDefault = await request(app).get(`/v1/datasets/${id}`).set('X-API-Key', apiKey);
    expect(getDefault.status).toBe(404);

    const getWs = await request(app)
      .get(`/v1/datasets/${id}`)
      .set('X-API-Key', workspaceKey)
      .set('X-Workspace-Id', 'workspace-ds');
    expect(getWs.status).toBe(200);
    expect(getWs.body.name).toBe('workspace-dataset');
  });

  it('should create dataset and rows atomically via transaction', async () => {
    const createRes = await request(app)
      .post('/v1/datasets')
      .set('X-API-Key', apiKey)
      .send({
        name: 'atomic-dataset',
        rows: [{ input: { a: 1 }, expectedOutput: { b: 2 } }, { input: { a: 2 } }],
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.row_count).toBe(2);

    const id = createRes.body.id;
    const getRes = await request(app).get(`/v1/datasets/${id}`).set('X-API-Key', apiKey);
    expect(getRes.status).toBe(200);
    expect(getRes.body.row_count).toBe(2);
    expect(getRes.body.preview).toHaveLength(2);
    expect(getRes.body.preview[0].input).toEqual({ a: 1 });
    expect(getRes.body.preview[1].input).toEqual({ a: 2 });
  });
});
