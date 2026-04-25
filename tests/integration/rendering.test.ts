import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '@app';
import { getDb, closeDb, initSchema } from '@models/promptmetrics-sqlite';
import { hashApiKey } from '@middlewares/promptmetrics-auth.middleware';
import { FilesystemDriver } from '@drivers/promptmetrics-filesystem-driver';

describe('Template Rendering Integration', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test-rendering.db');
  const testPromptsPath = path.resolve(__dirname, '../../data/test-rendering-prompts');
  let app: ReturnType<typeof createApp>;
  let apiKey: string;

  beforeAll(async () => {
    process.env.SQLITE_PATH = testDbPath;
    process.env.DRIVER = 'filesystem';
    process.env.API_KEY_SALT = 'test-salt';

    closeDb();

    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
    if (fs.existsSync(testPromptsPath)) fs.rmSync(testPromptsPath, { recursive: true });

    await initSchema();

    const db = getDb();
    apiKey = 'pm_testrender456';
    const keyHash = hashApiKey(apiKey);
    db.prepare('INSERT OR REPLACE INTO api_keys (key_hash, name, scopes) VALUES (?, ?, ?)').run(
      keyHash,
      'test-render-key',
      'read,write',
    );

    app = createApp(new FilesystemDriver(testPromptsPath));
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
    if (fs.existsSync(testPromptsPath)) fs.rmSync(testPromptsPath, { recursive: true });
  });

  it('should render messages with variables from query string', async () => {
    await request(app)
      .post('/v1/prompts')
      .set('X-API-Key', apiKey)
      .send({
        name: 'greeting',
        version: '1.0.0',
        messages: [
          { role: 'system', content: 'You are a {{role}}.' },
          { role: 'user', content: 'Hello {{name}}! You are {{age}} years old.' },
        ],
        variables: {
          name: { type: 'string', required: true },
          age: { type: 'number', required: true },
          role: { type: 'string', required: true },
        },
      });

    const res = await request(app)
      .get('/v1/prompts/greeting?variables[name]=Alice&variables[age]=30&variables[role]=developer')
      .set('X-API-Key', apiKey);

    expect(res.status).toBe(200);
    expect(res.body.content.messages).toEqual([
      { role: 'system', content: 'You are a developer.' },
      { role: 'user', content: 'Hello Alice! You are 30 years old.' },
    ]);
  });

  it('should return raw messages when render=false', async () => {
    const res = await request(app)
      .get('/v1/prompts/greeting?render=false&variables[name]=Alice&variables[role]=developer')
      .set('X-API-Key', apiKey);

    expect(res.status).toBe(200);
    expect(res.body.content.messages).toEqual([
      { role: 'system', content: 'You are a {{role}}.' },
      { role: 'user', content: 'Hello {{name}}! You are {{age}} years old.' },
    ]);
  });

  it('should render messages with variables from POST body', async () => {
    const res = await request(app)
      .get('/v1/prompts/greeting')
      .set('X-API-Key', apiKey)
      .send({
        variables: { name: 'Bob', age: '25', role: 'manager' },
      });

    expect(res.status).toBe(200);
    expect(res.body.content.messages).toEqual([
      { role: 'system', content: 'You are a manager.' },
      { role: 'user', content: 'Hello Bob! You are 25 years old.' },
    ]);
  });

  it('should not render assistant role messages', async () => {
    await request(app)
      .post('/v1/prompts')
      .set('X-API-Key', apiKey)
      .send({
        name: 'assistant-test',
        version: '1.0.0',
        messages: [
          { role: 'user', content: 'What is {{topic}}?' },
          { role: 'assistant', content: 'Let me tell you about {{topic}}.' },
        ],
        variables: { topic: { type: 'string', required: true } },
      });

    const res = await request(app).get('/v1/prompts/assistant-test?variables[topic]=AI').set('X-API-Key', apiKey);

    expect(res.status).toBe(200);
    expect(res.body.content.messages).toEqual([
      { role: 'user', content: 'What is AI?' },
      { role: 'assistant', content: 'Let me tell you about {{topic}}.' },
    ]);
  });
});
