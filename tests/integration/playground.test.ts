import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '@app';
import { getDb, closeDb, initSchema } from '@models/promptmetrics-sqlite';
import { hashApiKey } from '@middlewares/promptmetrics-auth.middleware';
import { FilesystemDriver } from '@drivers/promptmetrics-filesystem-driver';
import { cleanupDbFiles } from '../utils/cleanup-db';

describe('Playground API Integration', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test-integration-playground.db');
  const testPromptsPath = path.resolve(__dirname, '../../data/test-integration-playground-prompts');
  let app: ReturnType<typeof createApp>;
  let apiKey: string;
  let driver: FilesystemDriver;

  beforeAll(async () => {
    process.env.SQLITE_PATH = testDbPath;
    process.env.DRIVER = 'filesystem';
    process.env.API_KEY_SALT = 'test-salt';

    cleanupDbFiles(testDbPath);
    if (fs.existsSync(testPromptsPath)) fs.rmSync(testPromptsPath, { recursive: true });

    await closeDb();
    await initSchema();

    const db = getDb();
    apiKey = 'pm_testkey_playground';
    const keyHash = hashApiKey(apiKey);
    db.prepare('INSERT INTO api_keys (key_hash, name, scopes) VALUES (?, ?, ?) ON CONFLICT(key_hash) DO UPDATE SET name = excluded.name, scopes = excluded.scopes').run(
      keyHash,
      'test-key-playground',
      'read,write',
    );

    driver = new FilesystemDriver(testPromptsPath);
    app = createApp(driver);
  });

  afterAll(async () => {
    await closeDb();
    cleanupDbFiles(testDbPath);
    if (fs.existsSync(testPromptsPath)) fs.rmSync(testPromptsPath, { recursive: true });
  });

  it('GET /v1/playground/models without API key returns 401', async () => {
    const res = await request(app).get('/v1/playground/models');
    expect(res.status).toBe(401);
  });

  it('POST /v1/playground/chat without API key returns 401', async () => {
    const res = await request(app).post('/v1/playground/chat').send({});
    expect(res.status).toBe(401);
  });

  it('POST /v1/playground/completions without API key returns 401', async () => {
    const res = await request(app).post('/v1/playground/completions').send({});
    expect(res.status).toBe(401);
  });

  it('GET /v1/playground/models with API key returns 200', async () => {
    const res = await request(app).get('/v1/playground/models').set('X-API-Key', apiKey);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('limit');
  });

  it('POST /v1/playground/chat with API key returns 422 when provider missing', async () => {
    const res = await request(app)
      .post('/v1/playground/chat')
      .set('X-API-Key', apiKey)
      .send({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
      });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('POST /v1/playground/completions with API key returns 422 when provider missing', async () => {
    const res = await request(app).post('/v1/playground/completions').set('X-API-Key', apiKey).send({
      model: 'gpt-4o',
      prompt: 'Hello',
    });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('POST /v1/playground/chat/stream with API key returns 422 when provider missing', async () => {
    const res = await request(app)
      .post('/v1/playground/chat/stream')
      .set('X-API-Key', apiKey)
      .send({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
      });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });
});
