process.env.RATE_LIMIT_MAX_REQUESTS = '10000';

import request from 'supertest';
import { createApp } from '@app';
import { getDb, closeDb, initSchema } from '@models/promptmetrics-sqlite';
import { hashApiKey } from '@middlewares/promptmetrics-auth.middleware';
import { FilesystemDriver } from '@drivers/promptmetrics-filesystem-driver';

const testDbPath = require('path').resolve(__dirname, '../../data/test-ab-tests.db');

describe('A/B Test API', () => {
  let app: ReturnType<typeof createApp>;
  let apiKey: string;

  beforeAll(async () => {
    process.env.SQLITE_PATH = testDbPath;
    process.env.DRIVER = 'filesystem';
    process.env.API_KEY_SALT = 'test-ab-test-salt';
    closeDb();
    await initSchema();
    const db = getDb();
    apiKey = 'pm_test_ab_test_key';
    db.prepare('INSERT INTO api_keys (key_hash, name, scopes, workspace_id) VALUES (?, ?, ?, ?)').run(
      hashApiKey(apiKey),
      'ab-test-test',
      'read,write',
      'default',
    );
    const driver = new FilesystemDriver(require('path').resolve(__dirname, '../../data/test-ab-tests-prompts'));
    app = createApp(driver);
  });

  afterAll(() => {
    closeDb();
    const fs = require('fs');
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  it('should create an A/B test', async () => {
    const res = await request(app).post('/v1/ab-tests').set('X-API-Key', apiKey).send({
      prompt_name: 'test-prompt',
      version_a: 'v1',
      version_b: 'v2',
      metric: 'latency',
    });
    expect(res.status).toBe(201);
    expect(res.body.prompt_name).toBe('test-prompt');
    expect(res.body.version_a).toBe('v1');
    expect(res.body.version_b).toBe('v2');
    expect(res.body.metric).toBe('latency');
    expect(res.body.status).toBe('running');
    expect(res.body.id).toBeDefined();
  });

  it('should reject invalid create payload with 422', async () => {
    const res = await request(app).post('/v1/ab-tests').set('X-API-Key', apiKey).send({ prompt_name: 'only-name' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('should list A/B tests with pagination', async () => {
    const res = await request(app).get('/v1/ab-tests?page=1&limit=10').set('X-API-Key', apiKey);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(10);
  });

  it('should get an A/B test by id', async () => {
    const createRes = await request(app).post('/v1/ab-tests').set('X-API-Key', apiKey).send({
      prompt_name: 'get-test-prompt',
      version_a: 'v1',
      version_b: 'v2',
    });
    const id = createRes.body.id;

    const res = await request(app).get(`/v1/ab-tests/${id}`).set('X-API-Key', apiKey);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body.prompt_name).toBe('get-test-prompt');
    expect(res.body.latest_result).toBeUndefined();
  });

  it('should return 404 for non-existent A/B test', async () => {
    const res = await request(app).get('/v1/ab-tests/99999').set('X-API-Key', apiKey);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('should run an A/B test with known scores and return statistical results', async () => {
    const createRes = await request(app).post('/v1/ab-tests').set('X-API-Key', apiKey).send({
      prompt_name: 'run-test-prompt',
      version_a: 'v1',
      version_b: 'v2',
      metric: 'latency',
    });
    const id = createRes.body.id;

    const scoresA = [100, 110, 105, 108, 112];
    const scoresB = [90, 92, 88, 95, 91];

    const res = await request(app).post(`/v1/ab-tests/${id}/run`).set('X-API-Key', apiKey).send({ scoresA, scoresB });

    expect(res.status).toBe(200);
    expect(res.body.version_a_score).toBeCloseTo(107, 0);
    expect(res.body.version_b_score).toBeCloseTo(91.2, 0);
    expect(typeof res.body.p_value).toBe('number');
    expect(res.body.winner).toBeDefined();
  });

  it('should reject invalid run payload with 422', async () => {
    const createRes = await request(app).post('/v1/ab-tests').set('X-API-Key', apiKey).send({
      prompt_name: 'invalid-run-prompt',
      version_a: 'v1',
      version_b: 'v2',
    });
    const id = createRes.body.id;

    const res = await request(app)
      .post(`/v1/ab-tests/${id}/run`)
      .set('X-API-Key', apiKey)
      .send({ scoresA: 'not-array' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('should promote winner', async () => {
    const createRes = await request(app).post('/v1/ab-tests').set('X-API-Key', apiKey).send({
      prompt_name: 'promote-test-prompt',
      version_a: 'v1',
      version_b: 'v2',
      metric: 'latency',
    });
    const id = createRes.body.id;

    const scoresA = [100, 110, 105, 108, 112];
    const scoresB = [90, 92, 88, 95, 91];

    await request(app).post(`/v1/ab-tests/${id}/run`).set('X-API-Key', apiKey).send({ scoresA, scoresB });

    const res = await request(app).post(`/v1/ab-tests/${id}/promote`).set('X-API-Key', apiKey).send();

    expect(res.status).toBe(200);
    expect(res.body.winner).toBeDefined();
    expect(['A', 'B', 'tie']).toContain(res.body.winner);
    if (res.body.winner === 'A') {
      expect(res.body.version).toBe('v1');
    } else if (res.body.winner === 'B') {
      expect(res.body.version).toBe('v2');
    } else {
      expect(res.body.version).toBeNull();
    }
  });

  it('should return 400 when promoting without results', async () => {
    const createRes = await request(app).post('/v1/ab-tests').set('X-API-Key', apiKey).send({
      prompt_name: 'promote-no-result-prompt',
      version_a: 'v1',
      version_b: 'v2',
    });
    const id = createRes.body.id;

    const res = await request(app).post(`/v1/ab-tests/${id}/promote`).set('X-API-Key', apiKey).send();
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });

  it('should persist promoted_version and promoted_at on promote', async () => {
    const createRes = await request(app).post('/v1/ab-tests').set('X-API-Key', apiKey).send({
      prompt_name: 'persist-promote-prompt',
      version_a: 'v1',
      version_b: 'v2',
      metric: 'latency',
    });
    const id = createRes.body.id;

    const scoresA = [100, 110, 105, 108, 112];
    const scoresB = [90, 92, 88, 95, 91];

    await request(app).post(`/v1/ab-tests/${id}/run`).set('X-API-Key', apiKey).send({ scoresA, scoresB });

    const promoteRes = await request(app).post(`/v1/ab-tests/${id}/promote`).set('X-API-Key', apiKey).send();
    expect(promoteRes.status).toBe(200);
    expect(promoteRes.body.winner).toBeDefined();
    expect(promoteRes.body.version).toBeDefined();

    const getRes = await request(app).get(`/v1/ab-tests/${id}`).set('X-API-Key', apiKey);
    expect(getRes.status).toBe(200);
    expect(getRes.body.promoted_version).toBe(promoteRes.body.version);
    expect(typeof getRes.body.promoted_at).toBe('number');
    expect(getRes.body.promoted_at).toBeGreaterThan(0);
  });

  it('should delete an A/B test', async () => {
    const createRes = await request(app).post('/v1/ab-tests').set('X-API-Key', apiKey).send({
      prompt_name: 'delete-test-prompt',
      version_a: 'v1',
      version_b: 'v2',
    });
    const id = createRes.body.id;

    const delRes = await request(app).delete(`/v1/ab-tests/${id}`).set('X-API-Key', apiKey);
    expect(delRes.status).toBe(204);

    const getRes = await request(app).get(`/v1/ab-tests/${id}`).set('X-API-Key', apiKey);
    expect(getRes.status).toBe(404);
  });

  it('should return 404 when deleting non-existent A/B test', async () => {
    const res = await request(app).delete('/v1/ab-tests/99999').set('X-API-Key', apiKey);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('should isolate A/B tests per workspace', async () => {
    const db = getDb();
    const workspaceKey = 'pm_workspace_ab_test_key';
    db.prepare('INSERT OR REPLACE INTO api_keys (key_hash, name, scopes, workspace_id) VALUES (?, ?, ?, ?)').run(
      hashApiKey(workspaceKey),
      'workspace-ab-test-key',
      'read,write',
      'workspace-ab',
    );

    const createRes = await request(app)
      .post('/v1/ab-tests')
      .set('X-API-Key', workspaceKey)
      .set('X-Workspace-Id', 'workspace-ab')
      .send({
        prompt_name: 'workspace-prompt',
        version_a: 'v1',
        version_b: 'v2',
      });
    expect(createRes.status).toBe(201);
    const id = createRes.body.id;

    const getDefault = await request(app).get(`/v1/ab-tests/${id}`).set('X-API-Key', apiKey);
    expect(getDefault.status).toBe(404);

    const getWs = await request(app)
      .get(`/v1/ab-tests/${id}`)
      .set('X-API-Key', workspaceKey)
      .set('X-Workspace-Id', 'workspace-ab');
    expect(getWs.status).toBe(200);
    expect(getWs.body.prompt_name).toBe('workspace-prompt');
  });
});
