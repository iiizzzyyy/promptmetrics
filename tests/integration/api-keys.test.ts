import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '@app';
import { getDb, closeDb, initSchema } from '@models/promptmetrics-sqlite';
import { hashApiKey } from '@middlewares/promptmetrics-auth.middleware';

describe('API Key Management', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test-api-keys.db');
  let app: ReturnType<typeof createApp>;
  let adminKey: string;
  let readWriteKey: string;

  beforeAll(async () => {
    process.env.SQLITE_PATH = testDbPath;
    process.env.API_KEY_SALT = 'test-salt';

    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');

    closeDb();
    await initSchema();

    const db = getDb();
    adminKey = 'pm_admin_key_123';
    readWriteKey = 'pm_rw_key_456';

    db.prepare('INSERT OR REPLACE INTO api_keys (key_hash, name, scopes, workspace_id) VALUES (?, ?, ?, ?)').run(
      hashApiKey(adminKey),
      'admin-key',
      'read,write,admin',
      'default',
    );

    db.prepare('INSERT OR REPLACE INTO api_keys (key_hash, name, scopes, workspace_id) VALUES (?, ?, ?, ?)').run(
      hashApiKey(readWriteKey),
      'rw-key',
      'read,write',
      'default',
    );

    app = createApp();
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
  });

  it('POST /v1/api-keys with admin key creates a new key', async () => {
    const res = await request(app)
      .post('/v1/api-keys')
      .set('X-API-Key', adminKey)
      .send({ name: 'test-key', scopes: 'read' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('name', 'test-key');
    expect(res.body).toHaveProperty('scopes', 'read');
    expect(res.body).toHaveProperty('workspace_id', 'default');
    expect(res.body).toHaveProperty('key');
    expect(res.body.key).toMatch(/^pm_[a-f0-9]{64}$/);
    expect(res.body).toHaveProperty('created_at');
  });

  it('GET /v1/api-keys with admin key returns paginated list', async () => {
    const res = await request(app).get('/v1/api-keys?page=1&limit=10').set('X-API-Key', adminKey);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('limit', 10);
    expect(res.body).toHaveProperty('totalPages');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items[0]).not.toHaveProperty('key_hash');
  });

  it('DELETE /v1/api-keys/:id with admin key returns 204', async () => {
    const createRes = await request(app).post('/v1/api-keys').set('X-API-Key', adminKey).send({ name: 'delete-me' });

    expect(createRes.status).toBe(201);
    const id = createRes.body.id;

    const deleteRes = await request(app).delete(`/v1/api-keys/${id}`).set('X-API-Key', adminKey);

    expect(deleteRes.status).toBe(204);
  });

  it('POST /v1/api-keys with non-admin key returns 403', async () => {
    const res = await request(app).post('/v1/api-keys').set('X-API-Key', readWriteKey).send({ name: 'should-fail' });

    expect(res.status).toBe(403);
  });

  it('master key can create keys for any workspace', async () => {
    const masterKey = 'pm_master_key_789';
    const db = getDb();
    db.prepare('INSERT OR REPLACE INTO api_keys (key_hash, name, scopes, workspace_id) VALUES (?, ?, ?, ?)').run(
      hashApiKey(masterKey),
      'master-key',
      'read,write,admin',
      '*',
    );

    const res = await request(app)
      .post('/v1/api-keys')
      .set('X-API-Key', masterKey)
      .set('X-Workspace-Id', 'custom-workspace')
      .send({ name: 'custom-ws-key', scopes: 'read,write' });

    expect(res.status).toBe(201);
    expect(res.body.workspace_id).toBe('custom-workspace');
  });
});
