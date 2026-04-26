import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '@app';
import { getDb, closeDb, initSchema } from '@models/promptmetrics-sqlite';
import { hashApiKey } from '@middlewares/promptmetrics-auth.middleware';

describe('Log API Integration', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test-logs.db');
  const testPromptsPath = path.resolve(__dirname, '../../data/test-logs-prompts');
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

    closeDb();
    await initSchema();

    const db = getDb();
    apiKey = 'pm_testlog789';
    const keyHash = hashApiKey(apiKey);
    db.prepare('INSERT OR REPLACE INTO api_keys (key_hash, name, scopes) VALUES (?, ?, ?)').run(
      keyHash,
      'test-log-key',
      'read,write',
    );

    app = createApp();
  });

  afterEach(() => {
    closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
    if (fs.existsSync(testPromptsPath)) fs.rmSync(testPromptsPath, { recursive: true });
  });

  it('POST /v1/logs accepts nested metadata', async () => {
    const res = await request(app)
      .post('/v1/logs')
      .set('X-API-Key', apiKey)
      .send({
        prompt_name: 'agent-loop',
        version_tag: '1.0.0',
        metadata: { nested: { object: 'good' } },
      });

    expect(res.status).toBe(202);
    expect(res.body.status).toBe('accepted');
  });

  it('GET /v1/logs lists logs with pagination', async () => {
    const db = getDb();
    for (let i = 0; i < 5; i++) {
      db.prepare(
        'INSERT INTO logs (prompt_name, version_tag, provider, model, tokens_in, tokens_out, latency_ms, cost_usd, workspace_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(`prompt-${i}`, `v${i}`, 'openai', 'gpt-4', i * 10, i * 5, i * 100, i * 0.001, 'default');
    }

    const res = await request(app).get('/v1/logs?page=1&limit=3').set('X-API-Key', apiKey);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(3);
    expect(res.body.total).toBe(5);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(3);
    expect(res.body.totalPages).toBe(2);
  });

  it('GET /v1/logs returns empty array when no logs exist', async () => {
    const res = await request(app).get('/v1/logs').set('X-API-Key', apiKey);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(0);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(50);
  });

  it('GET /v1/logs parses metadata_json in response', async () => {
    const db = getDb();
    db.prepare(
      'INSERT INTO logs (prompt_name, version_tag, metadata_json, provider, model, workspace_id) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('test-prompt', '1.0.0', JSON.stringify({ agent: 'test' }), 'openai', 'gpt-4', 'default');

    const res = await request(app).get('/v1/logs').set('X-API-Key', apiKey);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].metadata).toEqual({ agent: 'test' });
  });
});
