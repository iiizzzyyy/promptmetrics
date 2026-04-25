import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '@app';
import { getDb, closeDb, initSchema } from '@models/promptmetrics-sqlite';
import { hashApiKey } from '@middlewares/promptmetrics-auth.middleware';
import { FilesystemDriver } from '@drivers/promptmetrics-filesystem-driver';

describe('Multi-Tenancy Integration', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test-tenant.db');
  const testPromptsPath = path.resolve(__dirname, '../../data/test-tenant-prompts');
  let app: ReturnType<typeof createApp>;
  let driver: FilesystemDriver;
  let workspaceAKey: string;
  let workspaceBKey: string;

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
    workspaceAKey = 'pm_workspace_a_key';
    workspaceBKey = 'pm_workspace_b_key';

    db.prepare(
      'INSERT OR REPLACE INTO api_keys (key_hash, name, scopes, workspace_id) VALUES (?, ?, ?, ?)',
    ).run(hashApiKey(workspaceAKey), 'workspace-a-key', 'read,write', 'workspace-a');

    db.prepare(
      'INSERT OR REPLACE INTO api_keys (key_hash, name, scopes, workspace_id) VALUES (?, ?, ?, ?)',
    ).run(hashApiKey(workspaceBKey), 'workspace-b-key', 'read,write', 'workspace-b');

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

  it('should reject API key used in wrong workspace', async () => {
    const res = await request(app)
      .get('/v1/prompts')
      .set('X-API-Key', workspaceAKey)
      .set('X-Workspace-Id', 'workspace-b');
    expect(res.status).toBe(401);
  });

  it('should isolate prompts per workspace', async () => {
    const createA = await request(app)
      .post('/v1/prompts')
      .set('X-API-Key', workspaceAKey)
      .set('X-Workspace-Id', 'workspace-a')
      .send({
        name: 'tenant-prompt',
        version: '1.0.0',
        messages: [{ role: 'user', content: 'Hello from A' }],
      });
    expect(createA.status).toBe(201);

    const listA = await request(app)
      .get('/v1/prompts')
      .set('X-API-Key', workspaceAKey)
      .set('X-Workspace-Id', 'workspace-a');
    expect(listA.status).toBe(200);
    expect(listA.body.items.map((i: { name: string }) => i.name)).toContain('tenant-prompt');

    const listB = await request(app)
      .get('/v1/prompts')
      .set('X-API-Key', workspaceBKey)
      .set('X-Workspace-Id', 'workspace-b');
    expect(listB.status).toBe(200);
    expect(listB.body.items.map((i: { name: string }) => i.name)).not.toContain('tenant-prompt');

    const getB = await request(app)
      .get('/v1/prompts/tenant-prompt?render=false')
      .set('X-API-Key', workspaceBKey)
      .set('X-Workspace-Id', 'workspace-b');
    expect(getB.status).toBe(404);
  });

  it('should isolate logs per workspace', async () => {
    const resA = await request(app)
      .post('/v1/logs')
      .set('X-API-Key', workspaceAKey)
      .set('X-Workspace-Id', 'workspace-a')
      .send({
        prompt_name: 'tenant-prompt',
        version_tag: '1.0.0',
        provider: 'openai',
        model: 'gpt-4o',
      });
    expect(resA.status).toBe(202);

    const db = getDb();
    const logA = db.prepare('SELECT workspace_id FROM logs WHERE prompt_name = ?').get('tenant-prompt') as { workspace_id: string };
    expect(logA.workspace_id).toBe('workspace-a');
  });

  it('should isolate traces per workspace', async () => {
    const resA = await request(app)
      .post('/v1/traces')
      .set('X-API-Key', workspaceAKey)
      .set('X-Workspace-Id', 'workspace-a')
      .send({ prompt_name: 'tenant-prompt', version_tag: '1.0.0' });
    expect(resA.status).toBe(201);

    const traceId = resA.body.trace_id;

    const getB = await request(app)
      .get(`/v1/traces/${traceId}`)
      .set('X-API-Key', workspaceBKey)
      .set('X-Workspace-Id', 'workspace-b');
    expect(getB.status).toBe(404);

    const getA = await request(app)
      .get(`/v1/traces/${traceId}`)
      .set('X-API-Key', workspaceAKey)
      .set('X-Workspace-Id', 'workspace-a');
    expect(getA.status).toBe(200);
  });

  it('should isolate runs per workspace', async () => {
    const resA = await request(app)
      .post('/v1/runs')
      .set('X-API-Key', workspaceAKey)
      .set('X-Workspace-Id', 'workspace-a')
      .send({ workflow_name: 'wf-a' });
    expect(resA.status).toBe(201);

    const runId = resA.body.run_id;

    const getB = await request(app)
      .get(`/v1/runs/${runId}`)
      .set('X-API-Key', workspaceBKey)
      .set('X-Workspace-Id', 'workspace-b');
    expect(getB.status).toBe(404);

    const getA = await request(app)
      .get(`/v1/runs/${runId}`)
      .set('X-API-Key', workspaceAKey)
      .set('X-Workspace-Id', 'workspace-a');
    expect(getA.status).toBe(200);
  });

  it('should isolate labels per workspace', async () => {
    const createA = await request(app)
      .post('/v1/prompts/tenant-prompt/labels')
      .set('X-API-Key', workspaceAKey)
      .set('X-Workspace-Id', 'workspace-a')
      .send({ name: 'prod', version_tag: '1.0.0' });
    expect(createA.status).toBe(201);

    const listB = await request(app)
      .get('/v1/prompts/tenant-prompt/labels')
      .set('X-API-Key', workspaceBKey)
      .set('X-Workspace-Id', 'workspace-b');
    expect(listB.status).toBe(200);
    expect(listB.body.items).toHaveLength(0);

    const listA = await request(app)
      .get('/v1/prompts/tenant-prompt/labels')
      .set('X-API-Key', workspaceAKey)
      .set('X-Workspace-Id', 'workspace-a');
    expect(listA.status).toBe(200);
    expect(listA.body.items.length).toBeGreaterThan(0);
  });

  it('should isolate evaluations per workspace', async () => {
    const createA = await request(app)
      .post('/v1/evaluations')
      .set('X-API-Key', workspaceAKey)
      .set('X-Workspace-Id', 'workspace-a')
      .send({ name: 'eval-a', prompt_name: 'tenant-prompt' });
    expect(createA.status).toBe(201);

    const evalId = createA.body.id;

    const getB = await request(app)
      .get(`/v1/evaluations/${evalId}`)
      .set('X-API-Key', workspaceBKey)
      .set('X-Workspace-Id', 'workspace-b');
    expect(getB.status).toBe(404);

    const getA = await request(app)
      .get(`/v1/evaluations/${evalId}`)
      .set('X-API-Key', workspaceAKey)
      .set('X-Workspace-Id', 'workspace-a');
    expect(getA.status).toBe(200);
  });
});
