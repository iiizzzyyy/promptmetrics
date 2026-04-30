process.env.RATE_LIMIT_MAX_REQUESTS = '10000';

import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '@app';
import { getDb, closeDb, initSchema } from '@models/promptmetrics-sqlite';
import { hashApiKey } from '@middlewares/promptmetrics-auth.middleware';
import { FilesystemDriver } from '@drivers/promptmetrics-filesystem-driver';
import { cleanupDbFiles } from '../utils/cleanup-db';

describe('Metrics API Integration', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test-metrics-integration.db');
  const testPromptsPath = path.resolve(__dirname, '../../data/test-metrics-integration-prompts');
  let app: ReturnType<typeof createApp>;
  let apiKey: string;
  let driver: FilesystemDriver;
  let evalId1: number;
  let evalId2: number;

  beforeAll(async () => {
    process.env.SQLITE_PATH = testDbPath;
    process.env.DRIVER = 'filesystem';
    process.env.API_KEY_SALT = 'test-salt';
    process.env.RATE_LIMIT_MAX_REQUESTS = '10000';

    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
    if (fs.existsSync(testPromptsPath)) fs.rmSync(testPromptsPath, { recursive: true });

    closeDb();
    await initSchema();

    const db = getDb();
    apiKey = 'pm_testkey_metrics';
    const keyHash = hashApiKey(apiKey);
    db.prepare('INSERT OR REPLACE INTO api_keys (key_hash, name, scopes, workspace_id) VALUES (?, ?, ?, ?)').run(
      keyHash,
      'test-key-metrics',
      'read,write',
      '*',
    );

    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - 86400;

    db.prepare('INSERT INTO prompts (name, version_tag, driver, status, workspace_id) VALUES (?, ?, ?, ?, ?)').run(
      'summarize',
      'v1.0',
      'filesystem',
      'active',
      'default',
    );
    db.prepare('INSERT INTO prompts (name, version_tag, driver, status, workspace_id) VALUES (?, ?, ?, ?, ?)').run(
      'summarize',
      'v1.1',
      'filesystem',
      'active',
      'default',
    );
    db.prepare('INSERT INTO prompts (name, version_tag, driver, status, workspace_id) VALUES (?, ?, ?, ?, ?)').run(
      'other-prompt',
      'v1.0',
      'filesystem',
      'active',
      'other-workspace',
    );

    db.prepare(
      `
      INSERT INTO logs (prompt_name, version_tag, tokens_in, tokens_out, latency_ms, cost_usd, created_at, workspace_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run('summarize', 'v1.0', 100, 50, 200, 0.01, oneDayAgo, 'default');
    db.prepare(
      `
      INSERT INTO logs (prompt_name, version_tag, tokens_in, tokens_out, latency_ms, cost_usd, created_at, workspace_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run('summarize', 'v1.0', 200, 100, 300, 0.02, oneDayAgo, 'default');
    db.prepare(
      `
      INSERT INTO logs (prompt_name, version_tag, tokens_in, tokens_out, latency_ms, cost_usd, created_at, workspace_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run('summarize', 'v1.1', 150, 75, 250, 0.015, oneDayAgo, 'default');
    db.prepare(
      `
      INSERT INTO logs (prompt_name, version_tag, tokens_in, tokens_out, latency_ms, cost_usd, created_at, workspace_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run('other-prompt', 'v1.0', 50, 25, 100, 0.005, oneDayAgo, 'other-workspace');

    db.prepare('INSERT INTO runs (run_id, workflow_name, status, created_at, workspace_id) VALUES (?, ?, ?, ?, ?)').run(
      'run-1',
      'wf-1',
      'completed',
      oneDayAgo,
      'default',
    );
    db.prepare('INSERT INTO runs (run_id, workflow_name, status, created_at, workspace_id) VALUES (?, ?, ?, ?, ?)').run(
      'run-2',
      'wf-1',
      'failed',
      oneDayAgo,
      'default',
    );
    db.prepare('INSERT INTO runs (run_id, workflow_name, status, created_at, workspace_id) VALUES (?, ?, ?, ?, ?)').run(
      'run-3',
      'wf-2',
      'completed',
      oneDayAgo,
      'other-workspace',
    );

    db.prepare('INSERT INTO traces (trace_id, prompt_name, created_at, workspace_id) VALUES (?, ?, ?, ?)').run(
      'trace-1',
      'summarize',
      oneDayAgo,
      'default',
    );
    db.prepare('INSERT INTO traces (trace_id, prompt_name, created_at, workspace_id) VALUES (?, ?, ?, ?)').run(
      'trace-2',
      'other-prompt',
      oneDayAgo,
      'other-workspace',
    );

    const evalResult1 = await db
      .prepare('INSERT INTO evaluations (name, prompt_name, created_at, workspace_id) VALUES (?, ?, ?, ?)')
      .run('Factuality Check', 'summarize', oneDayAgo, 'default');
    evalId1 = evalResult1.lastInsertRowid as number;

    const evalResult2 = await db
      .prepare('INSERT INTO evaluations (name, prompt_name, created_at, workspace_id) VALUES (?, ?, ?, ?)')
      .run('Grammar Check', 'summarize', oneDayAgo, 'default');
    evalId2 = evalResult2.lastInsertRowid as number;

    db.prepare(
      'INSERT INTO evaluation_results (evaluation_id, score, created_at, workspace_id) VALUES (?, ?, ?, ?)',
    ).run(evalId1, 4.5, oneDayAgo, 'default');
    db.prepare(
      'INSERT INTO evaluation_results (evaluation_id, score, created_at, workspace_id) VALUES (?, ?, ?, ?)',
    ).run(evalId1, 3.5, oneDayAgo, 'default');
    db.prepare(
      'INSERT INTO evaluation_results (evaluation_id, score, created_at, workspace_id) VALUES (?, ?, ?, ?)',
    ).run(evalId2, 5.0, oneDayAgo, 'default');

    driver = new FilesystemDriver(testPromptsPath);
    app = createApp(driver);
  });

  afterAll(() => {
    closeDb();
    cleanupDbFiles(testDbPath);
    if (fs.existsSync(testPromptsPath)) fs.rmSync(testPromptsPath, { recursive: true });
  });

  it('GET /v1/metrics/time-series without API key returns 401', async () => {
    const res = await request(app).get('/v1/metrics/time-series');
    expect(res.status).toBe(401);
  });

  it('GET /v1/metrics/time-series with invalid window returns 400', async () => {
    const res = await request(app).get('/v1/metrics/time-series?window=invalid').set('X-API-Key', apiKey);
    expect(res.status).toBe(400);
  });

  it('GET /v1/metrics/time-series returns correct shape', async () => {
    const res = await request(app).get('/v1/metrics/time-series?window=7d').set('X-API-Key', apiKey);
    expect(res.status).toBe(200);
    expect(res.body.window).toBe('7d');
    expect(typeof res.body.start).toBe('number');
    expect(typeof res.body.end).toBe('number');
    expect(Array.isArray(res.body.daily)).toBe(true);
    if (res.body.daily.length > 0) {
      const point = res.body.daily[0];
      expect(point).toHaveProperty('date');
      expect(point).toHaveProperty('request_count');
      expect(point).toHaveProperty('total_tokens');
      expect(point).toHaveProperty('total_cost_usd');
      expect(point).toHaveProperty('avg_latency_ms');
      expect(point).toHaveProperty('p95_latency_ms');
      expect(point).toHaveProperty('error_rate');
    }
  });

  it('GET /v1/metrics/prompts returns correct shape and workspace isolation', async () => {
    const res = await request(app).get('/v1/metrics/prompts?window=7d').set('X-API-Key', apiKey);
    expect(res.status).toBe(200);
    expect(res.body.window).toBe('7d');
    expect(Array.isArray(res.body.prompts)).toBe(true);
    const promptNames = res.body.prompts.map((p: any) => p.prompt_name);
    expect(promptNames).toContain('summarize');
    expect(promptNames).not.toContain('other-prompt');
  });

  it('GET /v1/metrics/evaluations returns correct shape', async () => {
    const res = await request(app).get('/v1/metrics/evaluations?window=7d').set('X-API-Key', apiKey);
    expect(res.status).toBe(200);
    expect(res.body.window).toBe('7d');
    expect(Array.isArray(res.body.evaluations)).toBe(true);
    expect(res.body.evaluations.length).toBeGreaterThan(0);
    const eval0 = res.body.evaluations[0];
    expect(eval0).toHaveProperty('evaluation_id');
    expect(eval0).toHaveProperty('name');
    expect(eval0).toHaveProperty('prompt_name');
    expect(Array.isArray(eval0.trend)).toBe(true);
  });

  it('GET /v1/metrics/evaluations filters by evaluation_id', async () => {
    const res = await request(app)
      .get('/v1/metrics/evaluations?window=7d&evaluation_id=' + evalId1)
      .set('X-API-Key', apiKey);
    expect(res.status).toBe(200);
    expect(res.body.evaluations.length).toBe(1);
    expect(res.body.evaluations[0].evaluation_id).toBe(evalId1);
  });

  it('GET /v1/metrics/activity returns correct shape', async () => {
    const res = await request(app).get('/v1/metrics/activity?window=7d').set('X-API-Key', apiKey);
    expect(res.status).toBe(200);
    expect(res.body.window).toBe('7d');
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.total_runs).toBe(2);
    expect(res.body.summary.total_traces).toBe(1);
    expect(res.body.summary.total_logs).toBe(3);
    expect(res.body.summary.active_prompts).toBe(1);
    expect(res.body.summary.failed_runs).toBe(1);
    expect(res.body.recent_runs).toBeDefined();
    expect(res.body.recent_runs.items.length).toBeGreaterThan(0);
  });

  it('workspace isolation works for activity', async () => {
    const res = await request(app)
      .get('/v1/metrics/activity?window=7d')
      .set('X-API-Key', apiKey)
      .set('X-Workspace-Id', 'other-workspace');
    expect(res.status).toBe(200);
    expect(res.body.summary.total_runs).toBe(1);
    expect(res.body.summary.total_logs).toBe(1);
    expect(res.body.summary.active_prompts).toBe(1);
  });

  // Edge-case tests

  it('GET /v1/metrics/time-series for empty workspace returns 200 with empty daily array', async () => {
    const res = await request(app)
      .get('/v1/metrics/time-series?window=7d')
      .set('X-API-Key', apiKey)
      .set('X-Workspace-Id', 'empty-workspace');
    expect(res.status).toBe(200);
    expect(res.body.window).toBe('7d');
    expect(Array.isArray(res.body.daily)).toBe(true);
    expect(res.body.daily.length).toBe(0);
  });

  it('GET /v1/metrics/prompts for empty workspace returns 200 with empty prompts array', async () => {
    const res = await request(app)
      .get('/v1/metrics/prompts?window=7d')
      .set('X-API-Key', apiKey)
      .set('X-Workspace-Id', 'empty-workspace');
    expect(res.status).toBe(200);
    expect(res.body.prompts).toEqual([]);
  });

  it('GET /v1/metrics/evaluations for empty workspace returns 200 with empty evaluations array', async () => {
    const res = await request(app)
      .get('/v1/metrics/evaluations?window=7d')
      .set('X-API-Key', apiKey)
      .set('X-Workspace-Id', 'empty-workspace');
    expect(res.status).toBe(200);
    expect(res.body.evaluations).toEqual([]);
  });

  it('GET /v1/metrics/activity for empty workspace returns 200 with zero counts', async () => {
    const res = await request(app)
      .get('/v1/metrics/activity?window=7d')
      .set('X-API-Key', apiKey)
      .set('X-Workspace-Id', 'empty-workspace');
    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({
      total_runs: 0,
      total_traces: 0,
      total_logs: 0,
      total_evaluations: 0,
      active_prompts: 0,
      failed_runs: 0,
    });
    expect(res.body.recent_runs.items).toEqual([]);
    expect(res.body.recent_runs.total).toBe(0);
  });

  it('window=1y returns 400 Bad Request for all metrics endpoints', async () => {
    const endpoints = [
      '/v1/metrics/time-series',
      '/v1/metrics/prompts',
      '/v1/metrics/evaluations',
      '/v1/metrics/activity',
    ];
    for (const endpoint of endpoints) {
      const res = await request(app).get(`${endpoint}?window=1y`).set('X-API-Key', apiKey);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid window parameter/);
    }
  });

  it('window=180d returns 400 Bad Request', async () => {
    const res = await request(app).get('/v1/metrics/time-series?window=180d').set('X-API-Key', apiKey);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid window parameter/);
  });

  it('cross-tenant isolation: time-series does not leak across workspaces', async () => {
    const res = await request(app)
      .get('/v1/metrics/time-series?window=7d')
      .set('X-API-Key', apiKey)
      .set('X-Workspace-Id', 'other-workspace');
    expect(res.status).toBe(200);
    expect(res.body.daily.length).toBe(1);
    expect(res.body.daily[0].request_count).toBe(1);
    expect(res.body.daily[0].total_cost_usd).toBe(0.005);
  });

  it('time-series omits days with zero data (gap handling)', async () => {
    const db = getDb();
    const nowMs = Date.now();
    const threeDaysAgoTs = Math.floor(nowMs / 1000) - 3 * 86400;
    const twoDaysAgoDateStr = new Date(nowMs - 2 * 86400 * 1000).toISOString().split('T')[0];

    db.prepare(
      'INSERT INTO logs (prompt_name, version_tag, tokens_in, tokens_out, latency_ms, cost_usd, created_at, workspace_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run('gap-prompt', 'v1.0', 10, 10, 100, 0.001, threeDaysAgoTs, 'default');

    const res = await request(app).get('/v1/metrics/time-series?window=7d').set('X-API-Key', apiKey);
    expect(res.status).toBe(200);
    const dates = res.body.daily.map((d: any) => d.date);
    expect(dates.length).toBe(2);
    expect(dates).not.toContain(twoDaysAgoDateStr);
  });

  it('GET /v1/metrics/prompts returns prompts sorted by total_cost_usd descending', async () => {
    const res = await request(app).get('/v1/metrics/prompts?window=7d').set('X-API-Key', apiKey);
    expect(res.status).toBe(200);
    const costs = res.body.prompts.map((p: any) => p.total_cost_usd);
    for (let i = 0; i < costs.length - 1; i++) {
      expect(costs[i]).toBeGreaterThanOrEqual(costs[i + 1]);
    }
    const summarizeV1 = res.body.prompts.find((p: any) => p.prompt_name === 'summarize' && p.version_tag === 'v1.0');
    const summarizeV11 = res.body.prompts.find((p: any) => p.prompt_name === 'summarize' && p.version_tag === 'v1.1');
    expect(summarizeV1.total_cost_usd).toBe(0.03);
    expect(summarizeV11.total_cost_usd).toBe(0.015);
    expect(res.body.prompts.indexOf(summarizeV1)).toBeLessThan(res.body.prompts.indexOf(summarizeV11));
  });
});
