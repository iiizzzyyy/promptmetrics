import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { createApp } from '@app';
import { getDb, closeDb, initSchema } from '@models/promptmetrics-sqlite';
import { hashApiKey } from '@middlewares/promptmetrics-auth.middleware';
import { FilesystemDriver } from '@drivers/promptmetrics-filesystem-driver';

describe('Prompt Creation Transaction', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test-prompt-transaction.db');
  const testPromptsPath = path.resolve(__dirname, '../../data/test-prompt-transaction-prompts');
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

    closeDb();
    await initSchema();

    const db = getDb();
    apiKey = 'pm_testtrans456';
    db.prepare('INSERT OR REPLACE INTO api_keys (key_hash, name, scopes) VALUES (?, ?, ?)').run(
      hashApiKey(apiKey),
      'test-key',
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

  it('creates a prompt and inserts into SQLite index', async () => {
    const res = await request(app)
      .post('/v1/prompts')
      .set('X-API-Key', apiKey)
      .send({
        name: 'transaction-prompt',
        version: '1.0.0',
        messages: [{ role: 'system', content: 'Hello' }],
      });

    expect(res.status).toBe(201);

    const db = getDb();
    const row = (await db
      .prepare('SELECT * FROM prompts WHERE name = ? AND version_tag = ?')
      .get('transaction-prompt', '1.0.0')) as {
      name: string;
      version_tag: string;
      driver: string;
    };

    expect(row).toBeDefined();
    expect(row.name).toBe('transaction-prompt');
    expect(row.version_tag).toBe('1.0.0');
    expect(row.driver).toBe('filesystem');
  });
});
