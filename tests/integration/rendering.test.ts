import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '@app';
import { getDb, closeDb, initSchema } from '@models/promptmetrics-sqlite';
import { hashApiKey } from '@middlewares/promptmetrics-auth.middleware';

describe('Template Rendering Integration', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test-rendering.db');
  const testPromptsPath = path.resolve(__dirname, '../../data/test-rendering-prompts');
  let app: ReturnType<typeof createApp>;
  let apiKey: string;

  beforeAll(() => {
    process.env.SQLITE_PATH = testDbPath;
    process.env.DRIVER = 'filesystem';
    process.env.API_KEY_SALT = 'test-salt';

    closeDb();

    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
    if (fs.existsSync(testPromptsPath)) fs.rmSync(testPromptsPath, { recursive: true });

    initSchema();

    const db = getDb();
    apiKey = 'pm_testrender456';
    const keyHash = hashApiKey(apiKey);
    db.prepare('INSERT OR REPLACE INTO api_keys (key_hash, name, scopes) VALUES (?, ?, ?)').run(
      keyHash,
      'test-render-key',
      'read,write',
    );

    app = createApp();
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
    if (fs.existsSync(testPromptsPath)) fs.rmSync(testPromptsPath, { recursive: true });
  });

  it('should render template with variables from query string', async () => {
    await request(app)
      .post('/v1/prompts')
      .set('X-API-Key', apiKey)
      .send({
        name: 'greeting',
        version: '1.0.0',
        template: 'Hello {{name}}! You are {{age}} years old.',
        variables: {
          name: { type: 'string', required: true },
          age: { type: 'number', required: true },
        },
      });

    const res = await request(app)
      .get('/v1/prompts/greeting?variables[name]=Alice&variables[age]=30')
      .set('X-API-Key', apiKey);

    expect(res.status).toBe(200);
    expect(res.body.content.template).toBe('Hello Alice! You are 30 years old.');
  });

  it('should return raw template when render=false', async () => {
    const res = await request(app)
      .get('/v1/prompts/greeting?render=false&variables[name]=Alice')
      .set('X-API-Key', apiKey);

    expect(res.status).toBe(200);
    expect(res.body.content.template).toBe('Hello {{name}}! You are {{age}} years old.');
  });

  it('should render template with variables from POST body', async () => {
    const res = await request(app)
      .get('/v1/prompts/greeting')
      .set('X-API-Key', apiKey)
      .send({
        variables: { name: 'Bob', age: '25' },
      });

    expect(res.status).toBe(200);
    expect(res.body.content.template).toBe('Hello Bob! You are 25 years old.');
  });
});
