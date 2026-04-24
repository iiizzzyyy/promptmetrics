import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '@app';
import { getDb, closeDb, initSchema } from '@models/promptmetrics-sqlite';
import { hashApiKey } from '@middlewares/promptmetrics-auth.middleware';

describe('Run API Integration', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test-runs.db');
  const testPromptsPath = path.resolve(__dirname, '../../data/test-runs-prompts');
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
    apiKey = 'pm_testrun789';
    const keyHash = hashApiKey(apiKey);
    db.prepare('INSERT OR REPLACE INTO api_keys (key_hash, name, scopes) VALUES (?, ?, ?)').run(
      keyHash,
      'test-run-key',
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

  it('POST /v1/runs creates a run with auto run_id', async () => {
    const res = await request(app)
      .post('/v1/runs')
      .set('X-API-Key', apiKey)
      .send({ workflow_name: 'headline-generator', input: { topic: 'AI' }, metadata: { agent: 'test' } });

    expect(res.status).toBe(201);
    expect(res.body.run_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(res.body.workflow_name).toBe('headline-generator');
    expect(res.body.status).toBe('running');
  });

  it('POST /v1/runs creates a run with provided run_id', async () => {
    const runId = '550e8400-e29b-41d4-a716-446655440000';
    const res = await request(app)
      .post('/v1/runs')
      .set('X-API-Key', apiKey)
      .send({ run_id: runId, workflow_name: 'wf-1', status: 'completed' });

    expect(res.status).toBe(201);
    expect(res.body.run_id).toBe(runId);
    expect(res.body.status).toBe('completed');
  });

  it('POST /v1/runs returns 404 for non-existent trace_id', async () => {
    const res = await request(app)
      .post('/v1/runs')
      .set('X-API-Key', apiKey)
      .send({ workflow_name: 'wf-1', trace_id: '550e8400-e29b-41d4-a716-446655440099' });

    expect(res.status).toBe(404);
  });

  it('GET /v1/runs/:run_id returns a run', async () => {
    const runId = '550e8400-e29b-41d4-a716-446655440001';
    const db = getDb();
    db.prepare(
      'INSERT INTO runs (run_id, workflow_name, status, input_json, metadata_json) VALUES (?, ?, ?, ?, ?)',
    ).run(runId, 'wf-1', 'running', JSON.stringify({ user: 'Alice' }), JSON.stringify({ agent: 'test' }));

    const res = await request(app).get(`/v1/runs/${runId}`).set('X-API-Key', apiKey);

    expect(res.status).toBe(200);
    expect(res.body.run_id).toBe(runId);
    expect(res.body.workflow_name).toBe('wf-1');
    expect(res.body.input).toEqual({ user: 'Alice' });
    expect(res.body.metadata).toEqual({ agent: 'test' });
  });

  it('GET /v1/runs/:run_id returns 404 for missing run', async () => {
    const res = await request(app).get('/v1/runs/missing-run').set('X-API-Key', apiKey);
    expect(res.status).toBe(404);
  });

  it('PATCH /v1/runs/:run_id updates status and output', async () => {
    const runId = '550e8400-e29b-41d4-a716-446655440002';
    const db = getDb();
    db.prepare('INSERT INTO runs (run_id, workflow_name, status) VALUES (?, ?, ?)').run(runId, 'wf-1', 'running');

    const res = await request(app)
      .patch(`/v1/runs/${runId}`)
      .set('X-API-Key', apiKey)
      .send({ status: 'completed', output: { result: 'ok' } });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('updated');

    const updated = db.prepare('SELECT * FROM runs WHERE run_id = ?').get(runId) as { status: string; output_json: string };
    expect(updated.status).toBe('completed');
    expect(JSON.parse(updated.output_json)).toEqual({ result: 'ok' });
  });

  it('PATCH /v1/runs/:run_id returns 404 for missing run', async () => {
    const res = await request(app)
      .patch('/v1/runs/missing-run')
      .set('X-API-Key', apiKey)
      .send({ status: 'completed' });

    expect(res.status).toBe(404);
  });

  it('GET /v1/runs lists runs with pagination', async () => {
    const db = getDb();
    for (let i = 0; i < 5; i++) {
      db.prepare('INSERT INTO runs (run_id, workflow_name, status) VALUES (?, ?, ?)').run(
        `run-${i}`,
        `wf-${i}`,
        'running',
      );
    }

    const res = await request(app).get('/v1/runs?page=1&limit=3').set('X-API-Key', apiKey);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(3);
    expect(res.body.total).toBe(5);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(3);
  });

  it('POST /v1/runs rejects invalid status', async () => {
    const res = await request(app)
      .post('/v1/runs')
      .set('X-API-Key', apiKey)
      .send({ workflow_name: 'wf-1', status: 'invalid' });

    expect(res.status).toBe(422);
  });

  it('POST /v1/runs rejects missing workflow_name', async () => {
    const res = await request(app).post('/v1/runs').set('X-API-Key', apiKey).send({ input: {} });
    expect(res.status).toBe(422);
  });
});
