import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '@app';
import { getDb, closeDb, initSchema } from '@models/promptmetrics-sqlite';
import { hashApiKey } from '@middlewares/promptmetrics-auth.middleware';
import { FilesystemDriver } from '@drivers/promptmetrics-filesystem-driver';
const SwaggerParser = require('swagger-parser') as any;

describe('OpenAPI Documentation', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test-openapi.db');
  const testPromptsPath = path.resolve(__dirname, '../../data/test-openapi-prompts');
  let app: ReturnType<typeof createApp>;
  let apiKey: string;

  beforeAll(async () => {
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
    apiKey = 'pm_testopenapi456';
    await db.prepare('INSERT INTO api_keys (key_hash, name, scopes) VALUES (?, ?, ?) ON CONFLICT(key_hash) DO UPDATE SET name = excluded.name, scopes = excluded.scopes').run(
      hashApiKey(apiKey),
      'test-openapi-key',
      'read,write',
    );

    app = createApp(new FilesystemDriver(testPromptsPath));
  });

  afterAll(async () => {
    await closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
    if (fs.existsSync(testPromptsPath)) fs.rmSync(testPromptsPath, { recursive: true });
  });

  it('GET /docs should return HTML', async () => {
    const res = await request(app).get('/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger');
  });

  it('openapi.yaml should be a valid OpenAPI spec', async () => {
    const openapiPath = path.resolve(__dirname, '../../docs/openapi.yaml');
    const parser = new SwaggerParser();
    const api = await parser.validate(openapiPath);
    expect(api.openapi).toBe('3.0.3');
    expect(api.info.title).toBe('PromptMetrics API');
  });
});
