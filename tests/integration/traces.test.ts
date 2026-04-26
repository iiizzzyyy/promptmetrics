import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '@app';
import { getDb, closeDb, initSchema } from '@models/promptmetrics-sqlite';
import { hashApiKey } from '@middlewares/promptmetrics-auth.middleware';

describe('Trace API Integration', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test-traces.db');
  const testPromptsPath = path.resolve(__dirname, '../../data/test-traces-prompts');
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
    apiKey = 'pm_testtrace789';
    const keyHash = hashApiKey(apiKey);
    db.prepare('INSERT OR REPLACE INTO api_keys (key_hash, name, scopes) VALUES (?, ?, ?)').run(
      keyHash,
      'test-trace-key',
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

  it('POST /v1/traces creates a trace with auto trace_id', async () => {
    const res = await request(app)
      .post('/v1/traces')
      .set('X-API-Key', apiKey)
      .send({ prompt_name: 'agent-loop', version_tag: '1.0.0', metadata: { agent: 'test' } });

    expect(res.status).toBe(201);
    expect(res.body.trace_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(res.body.prompt_name).toBe('agent-loop');
    expect(res.body.status).toBe('created');
  });

  it('POST /v1/traces creates a trace with provided trace_id', async () => {
    const traceId = '550e8400-e29b-41d4-a716-446655440000';
    const res = await request(app)
      .post('/v1/traces')
      .set('X-API-Key', apiKey)
      .send({ trace_id: traceId, metadata: { run: 'v1' } });

    expect(res.status).toBe(201);
    expect(res.body.trace_id).toBe(traceId);
  });

  it('GET /v1/traces/:trace_id returns trace with spans', async () => {
    const traceId = '550e8400-e29b-41d4-a716-446655440001';
    const db = getDb();
    db.prepare('INSERT INTO traces (trace_id, prompt_name, metadata_json) VALUES (?, ?, ?)').run(
      traceId,
      'test-prompt',
      JSON.stringify({ agent: 'test' }),
    );
    db.prepare(
      'INSERT INTO spans (trace_id, span_id, name, status, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(traceId, 'span-1', 'step-1', 'ok', 1000, 2000);

    const res = await request(app).get(`/v1/traces/${traceId}`).set('X-API-Key', apiKey);

    expect(res.status).toBe(200);
    expect(res.body.trace_id).toBe(traceId);
    expect(res.body.spans.length).toBe(1);
    expect(res.body.spans[0].name).toBe('step-1');
    expect(res.body.spans[0].status).toBe('ok');
  });

  it('GET /v1/traces/:trace_id returns 404 for missing trace', async () => {
    const res = await request(app).get('/v1/traces/missing-trace').set('X-API-Key', apiKey);
    expect(res.status).toBe(404);
  });

  it('POST /v1/traces/:trace_id/spans creates a span', async () => {
    const traceId = '550e8400-e29b-41d4-a716-446655440002';
    const db = getDb();
    db.prepare('INSERT INTO traces (trace_id, prompt_name) VALUES (?, ?)').run(traceId, 'test');

    const res = await request(app)
      .post(`/v1/traces/${traceId}/spans`)
      .set('X-API-Key', apiKey)
      .send({ name: 'agent-step', status: 'ok', start_time: 1000, end_time: 2000, metadata: { step: 1 } });

    expect(res.status).toBe(201);
    expect(res.body.trace_id).toBe(traceId);
    expect(res.body.name).toBe('agent-step');
    expect(res.body.status).toBe('ok');
  });

  it('POST /v1/traces/:trace_id/spans returns 404 for missing trace', async () => {
    const res = await request(app)
      .post('/v1/traces/missing-trace/spans')
      .set('X-API-Key', apiKey)
      .send({ name: 'step', status: 'ok' });

    expect(res.status).toBe(404);
  });

  it('GET /v1/traces/:trace_id/spans/:span_id returns a single span', async () => {
    const traceId = '550e8400-e29b-41d4-a716-446655440003';
    const spanId = '550e8400-e29b-41d4-a716-446655440004';
    const db = getDb();
    db.prepare('INSERT INTO traces (trace_id, prompt_name) VALUES (?, ?)').run(traceId, 'test');
    db.prepare(
      'INSERT INTO spans (trace_id, span_id, parent_id, name, status, start_time, end_time, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(traceId, spanId, 'parent-1', 'nested-step', 'error', 3000, 4000, JSON.stringify({ retry: 2 }));

    const res = await request(app).get(`/v1/traces/${traceId}/spans/${spanId}`).set('X-API-Key', apiKey);

    expect(res.status).toBe(200);
    expect(res.body.span_id).toBe(spanId);
    expect(res.body.parent_id).toBe('parent-1');
    expect(res.body.name).toBe('nested-step');
    expect(res.body.status).toBe('error');
    expect(res.body.metadata).toEqual({ retry: 2 });
  });

  it('POST /v1/traces accepts nested metadata', async () => {
    const res = await request(app)
      .post('/v1/traces')
      .set('X-API-Key', apiKey)
      .send({ metadata: { nested: { object: 'good' } } });

    expect(res.status).toBe(201);

    const getRes = await request(app).get(`/v1/traces/${res.body.trace_id}`).set('X-API-Key', apiKey);
    expect(getRes.status).toBe(200);
    expect(getRes.body.metadata).toEqual({ nested: { object: 'good' } });
  });

  it('POST /v1/traces/:trace_id/spans accepts nested metadata', async () => {
    const traceId = '550e8400-e29b-41d4-a716-446655440006';
    const db = getDb();
    db.prepare('INSERT INTO traces (trace_id, prompt_name) VALUES (?, ?)').run(traceId, 'test');

    const res = await request(app)
      .post(`/v1/traces/${traceId}/spans`)
      .set('X-API-Key', apiKey)
      .send({ name: 'agent-step', status: 'ok', start_time: 1000, end_time: 2000, metadata: { nested: { object: 'good' } } });

    expect(res.status).toBe(201);
    expect(res.body.trace_id).toBe(traceId);
    expect(res.body.name).toBe('agent-step');
  });

  it('POST /v1/traces/:trace_id/spans rejects invalid status', async () => {
    const traceId = '550e8400-e29b-41d4-a716-446655440005';
    const db = getDb();
    db.prepare('INSERT INTO traces (trace_id, prompt_name) VALUES (?, ?)').run(traceId, 'test');

    const res = await request(app)
      .post(`/v1/traces/${traceId}/spans`)
      .set('X-API-Key', apiKey)
      .send({ name: 'step', status: 'invalid' });

    expect(res.status).toBe(422);
  });

  it('GET /v1/traces lists traces with pagination', async () => {
    const db = getDb();
    for (let i = 0; i < 5; i++) {
      db.prepare('INSERT INTO traces (trace_id, prompt_name, version_tag, workspace_id) VALUES (?, ?, ?, ?)').run(
        `trace-${i}`,
        `prompt-${i}`,
        `v${i}`,
        'default',
      );
    }

    const res = await request(app).get('/v1/traces?page=1&limit=3').set('X-API-Key', apiKey);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(3);
    expect(res.body.total).toBe(5);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(3);
    expect(res.body.totalPages).toBe(2);
  });

  it('GET /v1/traces returns empty array when no traces exist', async () => {
    const res = await request(app).get('/v1/traces').set('X-API-Key', apiKey);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(0);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(50);
  });

  it('GET /v1/traces parses metadata_json in response', async () => {
    const db = getDb();
    db.prepare('INSERT INTO traces (trace_id, prompt_name, version_tag, metadata_json, workspace_id) VALUES (?, ?, ?, ?, ?)').run(
      'trace-meta',
      'test-prompt',
      '1.0.0',
      JSON.stringify({ agent: 'test' }),
      'default',
    );

    const res = await request(app).get('/v1/traces').set('X-API-Key', apiKey);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].metadata).toEqual({ agent: 'test' });
  });
});
