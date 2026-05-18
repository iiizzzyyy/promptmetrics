import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '@app';
import { getDb, closeDb, initSchema } from '@models/promptmetrics-sqlite';
import { hashApiKey } from '@middlewares/promptmetrics-auth.middleware';
import { FilesystemDriver } from '@drivers/promptmetrics-filesystem-driver';

describe('Label API Integration', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test-labels.db');
  const testPromptsPath = path.resolve(__dirname, '../../data/test-labels-prompts');
  let app: ReturnType<typeof createApp>;
  let apiKey: string;

  beforeEach(async () => {
    process.env.SQLITE_PATH = testDbPath;
    process.env.DRIVER = 'filesystem';
    process.env.API_KEY_SALT = 'test-salt';

    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
    if (fs.existsSync(testPromptsPath)) fs.rmSync(testPromptsPath, { recursive: true });

    await closeDb();
    await initSchema();

    const db = getDb();
    apiKey = 'pm_testlabel789';
    const keyHash = hashApiKey(apiKey);
    await db
      .prepare(
        'INSERT INTO api_keys (key_hash, name, scopes) VALUES (?, ?, ?) ON CONFLICT(key_hash) DO UPDATE SET name = excluded.name, scopes = excluded.scopes',
      )
      .run(keyHash, 'test-label-key', 'read,write');

    await db
      .prepare(
        'INSERT INTO api_keys (key_hash, name, scopes) VALUES (?, ?, ?) ON CONFLICT(key_hash) DO UPDATE SET name = excluded.name, scopes = excluded.scopes',
      )
      .run(hashApiKey('pm_testlabel_readonly'), 'test-label-readonly', 'read');

    const driver = new FilesystemDriver(testPromptsPath);
    app = createApp(driver);

    // Seed prompts so label creation can validate them
    const now = Math.floor(Date.now() / 1000);
    await db
      .prepare(
        `INSERT INTO prompts (name, version_tag, status, driver, created_at) VALUES (?, ?, 'active', 'filesystem', ?)`,
      )
      .run('welcome', '1.0.0', now);
  });

  afterEach(async () => {
    await closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
    if (fs.existsSync(testPromptsPath)) fs.rmSync(testPromptsPath, { recursive: true });
  });

  it('POST /v1/prompts/:name/labels creates a label', async () => {
    const res = await request(app)
      .post('/v1/prompts/welcome/labels')
      .set('X-API-Key', apiKey)
      .send({ name: 'production', version_tag: '1.0.0' });

    expect(res.status).toBe(201);
    expect(res.body.prompt_name).toBe('welcome');
    expect(res.body.name).toBe('production');
    expect(res.body.version_tag).toBe('1.0.0');
  });

  it('POST /v1/prompts/:name/labels updates existing label (upsert)', async () => {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    // Add a second version for the upsert target
    await db
      .prepare(
        `INSERT INTO prompts (name, version_tag, status, driver, created_at) VALUES (?, ?, 'active', 'filesystem', ?)`,
      )
      .run('welcome', '1.1.0', now);
    await db
      .prepare('INSERT INTO prompt_labels (prompt_name, name, version_tag) VALUES (?, ?, ?)')
      .run('welcome', 'production', '1.0.0');

    const res = await request(app)
      .post('/v1/prompts/welcome/labels')
      .set('X-API-Key', apiKey)
      .send({ name: 'production', version_tag: '1.1.0' });

    expect(res.status).toBe(201);
    expect(res.body.version_tag).toBe('1.1.0');
  });

  it('POST /v1/prompts/:name/labels auto-populates version_tag from latest version', async () => {
    const res = await request(app)
      .post('/v1/prompts/welcome/labels')
      .set('X-API-Key', apiKey)
      .send({ name: 'staging' });

    expect(res.status).toBe(201);
    expect(res.body.prompt_name).toBe('welcome');
    expect(res.body.name).toBe('staging');
    expect(res.body.version_tag).toBe('1.0.0');
  });

  it('POST /v1/prompts/:name/labels returns 404 for nonexistent prompt', async () => {
    const res = await request(app)
      .post('/v1/prompts/nonexistent/labels')
      .set('X-API-Key', apiKey)
      .send({ name: 'production', version_tag: '1.0.0' });

    expect(res.status).toBe(404);
  });

  it('POST /v1/prompts/:name/labels returns 400 for nonexistent version', async () => {
    const res = await request(app)
      .post('/v1/prompts/welcome/labels')
      .set('X-API-Key', apiKey)
      .send({ name: 'canary', version_tag: '9.9.9' });

    expect(res.status).toBe(400);
  });

  it('GET /v1/prompts/:name/labels lists labels', async () => {
    const db = getDb();
    await db
      .prepare('INSERT INTO prompt_labels (prompt_name, name, version_tag) VALUES (?, ?, ?)')
      .run('welcome', 'production', '1.0.0');
    await db
      .prepare('INSERT INTO prompt_labels (prompt_name, name, version_tag) VALUES (?, ?, ?)')
      .run('welcome', 'staging', '1.1.0');

    const res = await request(app).get('/v1/prompts/welcome/labels').set('X-API-Key', apiKey);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(2);
    expect(res.body.total).toBe(2);
  });

  it('GET /v1/prompts/:name/labels/:label_name returns a label', async () => {
    const db = getDb();
    await db
      .prepare('INSERT INTO prompt_labels (prompt_name, name, version_tag) VALUES (?, ?, ?)')
      .run('welcome', 'production', '1.0.0');

    const res = await request(app).get('/v1/prompts/welcome/labels/production').set('X-API-Key', apiKey);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('production');
    expect(res.body.version_tag).toBe('1.0.0');
  });

  it('GET /v1/prompts/:name/labels/:label_name returns 404 for missing', async () => {
    const res = await request(app).get('/v1/prompts/welcome/labels/missing').set('X-API-Key', apiKey);

    expect(res.status).toBe(404);
  });

  it('DELETE /v1/prompts/:name/labels/:label_name deletes a label', async () => {
    const db = getDb();
    await db
      .prepare('INSERT INTO prompt_labels (prompt_name, name, version_tag) VALUES (?, ?, ?)')
      .run('welcome', 'production', '1.0.0');

    const res = await request(app).delete('/v1/prompts/welcome/labels/production').set('X-API-Key', apiKey);

    expect(res.status).toBe(204);

    const after = (await db
      .prepare('SELECT COUNT(*) as c FROM prompt_labels WHERE prompt_name = ? AND name = ?')
      .get('welcome', 'production')) as { c: number };
    expect(after.c).toBe(0);
  });

  it('DELETE /v1/prompts/:name/labels/:label_name returns 404 for missing', async () => {
    const res = await request(app).delete('/v1/prompts/welcome/labels/missing').set('X-API-Key', apiKey);

    expect(res.status).toBe(404);
  });

  it('POST /v1/prompts/:name/labels returns 403 with read-only scope', async () => {
    const res = await request(app)
      .post('/v1/prompts/welcome/labels')
      .set('X-API-Key', 'pm_testlabel_readonly')
      .send({ name: 'production', version_tag: '1.0.0' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('DELETE /v1/prompts/:name/labels/:label_name returns 403 with read-only scope', async () => {
    const db = getDb();
    await db
      .prepare('INSERT INTO prompt_labels (prompt_name, name, version_tag) VALUES (?, ?, ?)')
      .run('welcome', 'production', '1.0.0');

    const res = await request(app)
      .delete('/v1/prompts/welcome/labels/production')
      .set('X-API-Key', 'pm_testlabel_readonly');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });
});
