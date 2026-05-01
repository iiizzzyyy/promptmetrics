process.env.RATE_LIMIT_MAX_REQUESTS = '10000';

import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '@app';
import { getDb, closeDb, initSchema } from '@models/promptmetrics-sqlite';
import { hashApiKey } from '@middlewares/promptmetrics-auth.middleware';
import { FilesystemDriver } from '@drivers/promptmetrics-filesystem-driver';

describe('Compliance API Integration', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test-compliance-integration.db');
  const testPromptsPath = path.resolve(__dirname, '../../data/test-compliance-integration-prompts');
  let app: ReturnType<typeof createApp>;
  let apiKey: string;

  beforeAll(async () => {
    process.env.SQLITE_PATH = testDbPath;
    process.env.DRIVER = 'filesystem';
    process.env.API_KEY_SALT = 'test-salt';
    process.env.RATE_LIMIT_MAX_REQUESTS = '10000';

    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');

    await closeDb();
    await initSchema();

    const db = getDb();
    apiKey = 'pm_testkey_compliance';
    const keyHash = hashApiKey(apiKey);
    db.prepare(
      'INSERT INTO api_keys (key_hash, name, scopes, workspace_id) VALUES (?, ?, ?, ?) ON CONFLICT(key_hash) DO UPDATE SET name = excluded.name, scopes = excluded.scopes, workspace_id = excluded.workspace_id',
    ).run(keyHash, 'test-key-compliance', 'read,write', '*');

    const driver = new FilesystemDriver(testPromptsPath);
    app = createApp(driver);
  });

  afterAll(async () => {
    await closeDb();
    if (fs.existsSync(testPromptsPath)) fs.rmSync(testPromptsPath, { recursive: true });
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
  });

  beforeEach(async () => {
    if (process.env.DATABASE_URL) {
      const db = getDb();
      await db.exec('TRUNCATE TABLE compliance_scores CASCADE');
    }
  });

  it('POST /v1/compliance/scan without API key returns 401', async () => {
    const res = await request(app).post('/v1/compliance/scan').send({
      prompt_name: 'test',
      version_tag: 'v1.0',
      text: 'Hello',
    });
    expect(res.status).toBe(401);
  });

  it('scan returns score and violations for text with PII', async () => {
    const res = await request(app).post('/v1/compliance/scan').set('X-API-Key', apiKey).send({
      prompt_name: 'pii-test',
      version_tag: 'v1.0',
      text: 'Contact john.doe@example.com or call (555) 234-5678. SSN: 123-45-6789',
    });

    expect(res.status).toBe(200);
    expect(typeof res.body.score).toBe('number');
    expect(res.body.score).toBeLessThan(100);
    expect(res.body.riskLevel).toBeDefined();
    expect(Array.isArray(res.body.violations)).toBe(true);
    expect(res.body.violations.length).toBeGreaterThan(0);
    const ruleNames = res.body.violations.map((v: any) => v.rule);
    expect(ruleNames).toContain('Email Detection');
    expect(ruleNames).toContain('SSN Detection');
  });

  it('scan returns clean score for safe text', async () => {
    const res = await request(app).post('/v1/compliance/scan').set('X-API-Key', apiKey).send({
      prompt_name: 'safe-test',
      version_tag: 'v1.0',
      text: 'This is completely safe text with no personal information.',
    });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(100);
    expect(res.body.riskLevel).toBe('low');
    expect(res.body.violations).toEqual([]);
  });

  it('list scores paginated', async () => {
    const db = getDb();
    await db
      .prepare(
        `INSERT INTO compliance_scores (prompt_name, version_tag, score, violations_json, workspace_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run('paginated-a', 'v1.0', 85, '[]', 'default', Math.floor(Date.now() / 1000));
    await db
      .prepare(
        `INSERT INTO compliance_scores (prompt_name, version_tag, score, violations_json, workspace_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run('paginated-b', 'v1.1', 90, '[]', 'default', Math.floor(Date.now() / 1000) - 1);

    const res = await request(app).get('/v1/compliance/scores?page=1&limit=10').set('X-API-Key', apiKey);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThanOrEqual(2);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(10);
    expect(typeof res.body.total).toBe('number');
    expect(typeof res.body.totalPages).toBe('number');
    expect(res.body.items[0].prompt_name).toBe('paginated-a');
  });

  it('get score by id', async () => {
    const db = getDb();
    const result = await db
      .prepare(
        `INSERT INTO compliance_scores (prompt_name, version_tag, score, violations_json, workspace_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'by-id-test',
        'v2.0',
        75,
        '[{"rule":"Email Detection","severity":"high","category":"pii","matchedText":"a@b.com"}]',
        'default',
        Math.floor(Date.now() / 1000),
      );
    const id = result.lastInsertRowid as number;

    const res = await request(app).get(`/v1/compliance/scores/${id}`).set('X-API-Key', apiKey);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body.prompt_name).toBe('by-id-test');
    expect(res.body.score).toBe(75);
    expect(Array.isArray(res.body.violations)).toBe(true);
    expect(res.body.violations[0].rule).toBe('Email Detection');
  });

  it('returns 404 for missing score', async () => {
    const res = await request(app).get('/v1/compliance/scores/999999').set('X-API-Key', apiKey);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Compliance score not found/);
  });

  it('workspace isolation', async () => {
    const db = getDb();
    await db
      .prepare(
        `INSERT INTO compliance_scores (prompt_name, version_tag, score, violations_json, workspace_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run('ws-isolated', 'v1.0', 60, '[]', 'other-workspace', Math.floor(Date.now() / 1000));

    const resDefault = await request(app)
      .get('/v1/compliance/scores')
      .set('X-API-Key', apiKey)
      .set('X-Workspace-Id', 'default');
    expect(resDefault.status).toBe(200);
    const namesDefault = resDefault.body.items.map((i: any) => i.prompt_name);
    expect(namesDefault).not.toContain('ws-isolated');

    const resOther = await request(app)
      .get('/v1/compliance/scores')
      .set('X-API-Key', apiKey)
      .set('X-Workspace-Id', 'other-workspace');
    expect(resOther.status).toBe(200);
    const namesOther = resOther.body.items.map((i: any) => i.prompt_name);
    expect(namesOther).toContain('ws-isolated');
  });
});
