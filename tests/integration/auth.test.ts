import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '@app';
import { getDb, closeDb, initSchema } from '@models/promptmetrics-sqlite';
import { hashApiKey } from '@middlewares/promptmetrics-auth.middleware';

describe('Auth Integration', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test-auth.db');
  let app: ReturnType<typeof createApp>;
  let validKey: string;
  let expiredKey: string;
  let masterKey: string;
  let defaultWorkspaceKey: string;

  beforeAll(async () => {
    process.env.SQLITE_PATH = testDbPath;
    process.env.API_KEY_SALT = 'test-salt';

    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');

    closeDb();
    await initSchema();

    const db = getDb();
    validKey = 'pm_valid_key_123';
    expiredKey = 'pm_expired_key_456';
    masterKey = 'pm_master_key_789';
    defaultWorkspaceKey = 'pm_default_workspace_key_abc';

    await db
      .prepare('INSERT OR REPLACE INTO api_keys (key_hash, name, scopes, workspace_id) VALUES (?, ?, ?, ?)')
      .run(hashApiKey(validKey), 'valid-key', 'read,write', 'default');

    await db
      .prepare(
        'INSERT OR REPLACE INTO api_keys (key_hash, name, scopes, expires_at, workspace_id) VALUES (?, ?, ?, ?, ?)',
      )
      .run(hashApiKey(expiredKey), 'expired-key', 'read,write', Math.floor(Date.now() / 1000) - 1, 'default');

    await db
      .prepare('INSERT OR REPLACE INTO api_keys (key_hash, name, scopes, workspace_id) VALUES (?, ?, ?, ?)')
      .run(hashApiKey(masterKey), 'master-key', 'read,write,admin', '*');

    await db
      .prepare('INSERT OR REPLACE INTO api_keys (key_hash, name, scopes, workspace_id) VALUES (?, ?, ?, ?)')
      .run(hashApiKey(defaultWorkspaceKey), 'default-workspace-key', 'read,write', 'default');

    app = createApp();
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
  });

  it('valid API key allows access', async () => {
    const res = await request(app).get('/v1/prompts').set('X-API-Key', validKey);
    expect(res.status).toBe(200);
  });

  it('expired API key returns 401 with "API key expired"', async () => {
    const res = await request(app).get('/v1/prompts').set('X-API-Key', expiredKey);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('API key expired');
  });

  it('master key can access default workspace', async () => {
    const res = await request(app).get('/v1/prompts').set('X-API-Key', masterKey).set('X-Workspace-Id', 'default');
    expect(res.status).toBe(200);
  });

  it('master key can access custom workspace', async () => {
    const res = await request(app)
      .get('/v1/prompts')
      .set('X-API-Key', masterKey)
      .set('X-Workspace-Id', 'custom-workspace');
    expect(res.status).toBe(200);
  });

  it('normal key fails with mismatched workspace', async () => {
    const res = await request(app)
      .get('/v1/prompts')
      .set('X-API-Key', defaultWorkspaceKey)
      .set('X-Workspace-Id', 'other');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('API key does not belong to this workspace');
  });
});
