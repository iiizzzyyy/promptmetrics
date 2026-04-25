import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '@app';
import { getDb, closeDb, initSchema } from '@models/promptmetrics-sqlite';
import { hashApiKey } from '@middlewares/promptmetrics-auth.middleware';
import { FilesystemDriver } from '@drivers/promptmetrics-filesystem-driver';
import { promptCache } from '@services/cache.service';

describe('Prompt API Integration', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test-integration.db');
  const testPromptsPath = path.resolve(__dirname, '../../data/test-integration-prompts');
  let app: ReturnType<typeof createApp>;
  let apiKey: string;
  let driver: FilesystemDriver;

  beforeAll(async () => {
    process.env.SQLITE_PATH = testDbPath;
    process.env.DRIVER = 'filesystem';
    process.env.API_KEY_SALT = 'test-salt';

    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
    if (fs.existsSync(testPromptsPath)) fs.rmSync(testPromptsPath, { recursive: true });

    closeDb();
    await initSchema();

    const db = getDb();
    apiKey = 'pm_testkey123';
    const keyHash = hashApiKey(apiKey);
    db.prepare('INSERT OR REPLACE INTO api_keys (key_hash, name, scopes) VALUES (?, ?, ?)').run(
      keyHash,
      'test-key',
      'read,write',
    );

    driver = new FilesystemDriver(testPromptsPath);
    app = createApp(driver);
  });

  beforeEach(() => {
    promptCache.clear();
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
    if (fs.existsSync(testPromptsPath)) fs.rmSync(testPromptsPath, { recursive: true });
  });

  it('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /v1/prompts without API key returns 401', async () => {
    const res = await request(app).get('/v1/prompts');
    expect(res.status).toBe(401);
  });

  it('POST /v1/prompts creates a prompt', async () => {
    const res = await request(app)
      .post('/v1/prompts')
      .set('X-API-Key', apiKey)
      .send({
        name: 'welcome',
        version: '1.0.0',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello {{name}}!' },
        ],
        variables: { name: { type: 'string', required: true } },
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('welcome');
    expect(res.body.version_tag).toBe('1.0.0');
  });

  it('GET /v1/prompts lists prompts', async () => {
    const res = await request(app).get('/v1/prompts').set('X-API-Key', apiKey);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.total).toBeGreaterThan(0);
  });

  it('GET /v1/prompts/:name returns latest version', async () => {
    const res = await request(app).get('/v1/prompts/welcome?render=false').set('X-API-Key', apiKey);
    expect(res.status).toBe(200);
    expect(res.body.content.messages).toEqual([
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello {{name}}!' },
    ]);
  });

  it('GET /v1/prompts/:name/versions lists versions', async () => {
    const res = await request(app).get('/v1/prompts/welcome/versions').set('X-API-Key', apiKey);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].version_tag).toBe('1.0.0');
  });

  it('POST /v1/logs accepts metadata', async () => {
    const res = await request(app)
      .post('/v1/logs')
      .set('X-API-Key', apiKey)
      .send({
        prompt_name: 'welcome',
        version_tag: '1.0.0',
        provider: 'openai',
        model: 'gpt-4o',
        tokens_in: 10,
        tokens_out: 20,
        latency_ms: 500,
        cost_usd: 0.001,
        metadata: { user_id: 'user_123', experiment: 'headline-v2' },
      });

    expect(res.status).toBe(202);
    expect(res.body.status).toBe('accepted');
  });

  it('POST /v1/prompts accepts ollama config', async () => {
    const res = await request(app)
      .post('/v1/prompts')
      .set('X-API-Key', apiKey)
      .send({
        name: 'ollama-prompt',
        version: '1.0.0',
        messages: [{ role: 'user', content: 'Hello' }],
        ollama: {
          options: { temperature: 0.8, num_ctx: 4096 },
          keep_alive: '5m',
          format: 'json',
        },
      });

    expect(res.status).toBe(201);
  });

  it('POST /v1/logs accepts ollama fields', async () => {
    const res = await request(app)
      .post('/v1/logs')
      .set('X-API-Key', apiKey)
      .send({
        prompt_name: 'ollama-prompt',
        version_tag: '1.0.0',
        provider: 'ollama',
        model: 'llama3.1',
        ollama_options: { temperature: 0.8, num_ctx: 4096 },
        ollama_keep_alive: '5m',
        ollama_format: 'json',
      });

    expect(res.status).toBe(202);
    expect(res.body.status).toBe('accepted');
  });

  it('second GET of same prompt should hit cache', async () => {
    const spy = jest.spyOn(driver, 'getPrompt');

    const res1 = await request(app).get('/v1/prompts/welcome?render=false').set('X-API-Key', apiKey);
    expect(res1.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(1);

    const res2 = await request(app).get('/v1/prompts/welcome?render=false').set('X-API-Key', apiKey);
    expect(res2.status).toBe(200);
    // Cache hit: driver should not be called again
    expect(spy).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });

  it('createPrompt should invalidate cache so subsequent get returns new version', async () => {
    // Create v1
    await request(app)
      .post('/v1/prompts')
      .set('X-API-Key', apiKey)
      .send({
        name: 'cache-invalidate-test',
        version: '1.0.0',
        messages: [{ role: 'user', content: 'v1' }],
      });

    // GET v1 (caches it)
    const res1 = await request(app)
      .get('/v1/prompts/cache-invalidate-test?render=false')
      .set('X-API-Key', apiKey);
    expect(res1.status).toBe(200);
    expect(res1.body.content.messages[0].content).toBe('v1');

    // Create v2
    await request(app)
      .post('/v1/prompts')
      .set('X-API-Key', apiKey)
      .send({
        name: 'cache-invalidate-test',
        version: '2.0.0',
        messages: [{ role: 'user', content: 'v2' }],
      });

    // GET latest should return v2, not stale cached v1
    const res2 = await request(app)
      .get('/v1/prompts/cache-invalidate-test?render=false')
      .set('X-API-Key', apiKey);
    expect(res2.status).toBe(200);
    expect(res2.body.content.messages[0].content).toBe('v2');
  });
});
