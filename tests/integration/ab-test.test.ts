process.env.RATE_LIMIT_MAX_REQUESTS = '10000';

import request from 'supertest';
import { createApp } from '@app';
import { getDb, closeDb, initSchema } from '@models/promptmetrics-sqlite';
import { hashApiKey } from '@middlewares/promptmetrics-auth.middleware';
import { FilesystemDriver } from '@drivers/promptmetrics-filesystem-driver';
import { auditLogService } from '@services/audit-log.service';

const testDbPath = require('path').resolve(__dirname, '../../data/test-ab-tests.db');

describe('A/B Test API', () => {
  let app: ReturnType<typeof createApp>;
  let apiKey: string;

  beforeAll(async () => {
    process.env.SQLITE_PATH = testDbPath;
    process.env.DRIVER = 'filesystem';
    process.env.API_KEY_SALT = 'test-ab-test-salt';
    await closeDb();
    await initSchema();
    const db = getDb();
    apiKey = 'pm_test_ab_test_key';
    await db
      .prepare('INSERT INTO api_keys (key_hash, name, scopes, workspace_id) VALUES (?, ?, ?, ?)')
      .run(hashApiKey(apiKey), 'ab-test-test', 'read,write', 'default');
    const driver = new FilesystemDriver(require('path').resolve(__dirname, '../../data/test-ab-tests-prompts'));
    app = createApp(driver);
  });

  afterAll(async () => {
    await closeDb();
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

  it('should update active_version_id and create audit log on promote', async () => {
    const db = getDb();
    const promptName = 'active-version-promote-prompt';
    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare(
        "INSERT INTO prompts (name, version_tag, workspace_id, status, driver, created_at) VALUES (?, ?, ?, 'active', 'filesystem', ?)",
      )
      .run(promptName, 'v1', 'default', now);
    const v1Row = (await db
      .prepare('SELECT id FROM prompts WHERE name = ? AND version_tag = ? AND workspace_id = ?')
      .get(promptName, 'v1', 'default')) as { id: number };

    await db
      .prepare(
        "INSERT INTO prompts (name, version_tag, workspace_id, status, driver, created_at) VALUES (?, ?, ?, 'active', 'filesystem', ?)",
      )
      .run(promptName, 'v2', 'default', now);
    const v2Row = (await db
      .prepare('SELECT id FROM prompts WHERE name = ? AND version_tag = ? AND workspace_id = ?')
      .get(promptName, 'v2', 'default')) as { id: number };

    const createRes = await request(app).post('/v1/ab-tests').set('X-API-Key', apiKey).send({
      prompt_name: promptName,
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

    const winnerVersion = promoteRes.body.version as string;
    const winnerId = winnerVersion === 'v1' ? v1Row.id : v2Row.id;

    const promptRow = (await db
      .prepare('SELECT active_version_id FROM prompts WHERE name = ? AND version_tag = ? AND workspace_id = ?')
      .get(promptName, winnerVersion, 'default')) as { active_version_id: number | null } | undefined;

    expect(promptRow).toBeDefined();
    expect(promptRow!.active_version_id).toBe(winnerId);

    await auditLogService.flush();

    const auditRow = (await db
      .prepare('SELECT * FROM audit_logs WHERE action = ? AND prompt_name = ? ORDER BY timestamp DESC LIMIT 1')
      .get('promote_ab_test', promptName)) as { action: string; version_tag: string; target_id: string } | undefined;

    expect(auditRow).toBeDefined();
    expect(auditRow!.action).toBe('promote_ab_test');
    expect(auditRow!.version_tag).toBe(winnerVersion);
    expect(auditRow!.target_id).toBe(String(id));
  });

  it('should run an A/B test with evaluation_id and return deterministic scores from EvaluationService', async () => {
    const evalRes = await request(app).post('/v1/evaluations').set('X-API-Key', apiKey).send({
      name: 'ab-eval',
      prompt_name: 'eval-prompt',
      version_tag: 'v1',
    });
    expect(evalRes.status).toBe(201);
    const evalId = evalRes.body.id;

    await request(app).post(`/v1/evaluations/${evalId}/results`).set('X-API-Key', apiKey).send({ score: 0.85 });
    await request(app).post(`/v1/evaluations/${evalId}/results`).set('X-API-Key', apiKey).send({ score: 0.9 });
    await request(app).post(`/v1/evaluations/${evalId}/results`).set('X-API-Key', apiKey).send({ score: 0.8 });

    const createRes = await request(app).post('/v1/ab-tests').set('X-API-Key', apiKey).send({
      prompt_name: 'eval-prompt',
      version_a: 'v1',
      version_b: 'v2',
      evaluation_id: evalId,
      metric: 'latency',
    });
    expect(createRes.status).toBe(201);
    const id = createRes.body.id;

    const runRes = await request(app).post(`/v1/ab-tests/${id}/run`).set('X-API-Key', apiKey).send({});

    expect(runRes.status).toBe(200);
    expect(runRes.body.version_a_score).toBeCloseTo(0.85, 1);
    expect(runRes.body.version_b_score).toBeCloseTo(0.85, 1);
    expect(typeof runRes.body.p_value).toBe('number');
    expect(runRes.body.winner).toBeDefined();
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
    await db
      .prepare(
        'INSERT INTO api_keys (key_hash, name, scopes, workspace_id) VALUES (?, ?, ?, ?) ON CONFLICT(key_hash) DO UPDATE SET name = excluded.name, scopes = excluded.scopes, workspace_id = excluded.workspace_id',
      )
      .run(hashApiKey(workspaceKey), 'workspace-ab-test-key', 'read,write', 'workspace-ab');

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
