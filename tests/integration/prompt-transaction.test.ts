import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { createApp } from '@app';
import { getDb, closeDb, initSchema } from '@models/promptmetrics-sqlite';
import { hashApiKey } from '@middlewares/promptmetrics-auth.middleware';
import { FilesystemDriver } from '@drivers/promptmetrics-filesystem-driver';
import { PromptReconciliationJob } from '@jobs/promptmetrics-reconciliation.job';

describe('Prompt Creation Transaction', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test-prompt-transaction.db');
  const testPromptsPath = path.resolve(__dirname, '../../data/test-prompt-transaction-prompts');
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
    apiKey = 'pm_testtrans456';
    await db
      .prepare('INSERT OR REPLACE INTO api_keys (key_hash, name, scopes) VALUES (?, ?, ?)')
      .run(hashApiKey(apiKey), 'test-key', 'read,write');

    driver = new FilesystemDriver(testPromptsPath);
    app = createApp(driver);
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
    if (fs.existsSync(testPromptsPath)) fs.rmSync(testPromptsPath, { recursive: true });
  });

  it('creates a prompt and inserts into SQLite index with active status', async () => {
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
      status: string;
    };

    expect(row).toBeDefined();
    expect(row.name).toBe('transaction-prompt');
    expect(row.version_tag).toBe('1.0.0');
    expect(row.driver).toBe('filesystem');
    expect(row.status).toBe('active');
  });

  it('leaves pending status when DB update fails after driver write, then reconciliation promotes it', async () => {
    // Manually write the file to simulate successful storage write without DB activation
    const promptDir = path.join(testPromptsPath, 'pending-promote');
    if (!fs.existsSync(promptDir)) fs.mkdirSync(promptDir, { recursive: true });
    fs.writeFileSync(
      path.join(promptDir, '1.0.0.json'),
      JSON.stringify({ name: 'pending-promote', version: '1.0.0', messages: [{ role: 'system', content: 'Promote me' }] }, null, 2),
      'utf-8',
    );

    // Manually insert a pending row with old timestamp (simulating failed UPDATE to active)
    const db = getDb();
    const oldTime = Math.floor(Date.now() / 1000) - 300;
    await db
      .prepare(
        "INSERT INTO prompts (name, version_tag, workspace_id, status, driver, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run('pending-promote', '1.0.0', 'default', 'pending', 'filesystem', oldTime);

    // Verify it's pending
    let row = (await db
      .prepare("SELECT status FROM prompts WHERE name = ? AND version_tag = ?")
      .get('pending-promote', '1.0.0')) as { status: string } | undefined;
    expect(row?.status).toBe('pending');

    // Run reconciliation
    const job = new PromptReconciliationJob(driver);
    await job.runReconcile();

    // Verify promoted to active
    row = (await db
      .prepare("SELECT status FROM prompts WHERE name = ? AND version_tag = ?")
      .get('pending-promote', '1.0.0')) as { status: string } | undefined;
    expect(row?.status).toBe('active');

    // Verify the prompt is now visible via API
    const res = await request(app)
      .get('/v1/prompts/pending-promote?render=false')
      .set('X-API-Key', apiKey);
    expect(res.status).toBe(200);
    expect(res.body.content.messages[0].content).toBe('Promote me');
  });

  it('reconciliation deletes orphaned pending prompts', async () => {
    // Manually insert a pending row for a prompt that does not exist in storage
    const db = getDb();
    const oldTime = Math.floor(Date.now() / 1000) - 300;
    await db
      .prepare(
        "INSERT INTO prompts (name, version_tag, workspace_id, status, driver, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run('orphan-prompt', '1.0.0', 'default', 'pending', 'filesystem', oldTime);

    // Verify it exists
    let row = await db
      .prepare("SELECT 1 FROM prompts WHERE name = ? AND version_tag = ?")
      .get('orphan-prompt', '1.0.0');
    expect(row).toBeDefined();

    // Run reconciliation
    const job = new PromptReconciliationJob(driver);
    await job.runReconcile();

    // Verify deleted
    row = await db
      .prepare("SELECT 1 FROM prompts WHERE name = ? AND version_tag = ?")
      .get('orphan-prompt', '1.0.0');
    expect(row).toBeUndefined();
  });
});
