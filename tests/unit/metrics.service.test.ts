import fs from 'fs';
import path from 'path';
import { getDb, initSchema, closeDb } from '@models/promptmetrics-sqlite';
import { MetricsService } from '@services/metrics.service';

describe('MetricsService', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test-metrics-unit.db');
  let service: MetricsService;

  beforeEach(async () => {
    process.env.SQLITE_PATH = testDbPath;
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
    closeDb();
    await initSchema();
    service = new MetricsService();
  });

  afterEach(() => {
    closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
  });

  async function seedData(workspaceId: string = 'default', promptName: string = 'prompt-a') {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    const twoDaysAgo = now - 2 * 86400;
    const oneDayAgo = now - 86400;

    db.prepare("INSERT INTO prompts (name, version_tag, driver, status, workspace_id) VALUES (?, ?, ?, ?, ?)").run(
      promptName, 'v1.0', 'filesystem', 'active', workspaceId,
    );

    db.prepare(`
      INSERT INTO logs (prompt_name, version_tag, tokens_in, tokens_out, latency_ms, cost_usd, created_at, workspace_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(promptName, 'v1.0', 100, 50, 200, 0.01, twoDaysAgo, workspaceId);
    db.prepare(`
      INSERT INTO logs (prompt_name, version_tag, tokens_in, tokens_out, latency_ms, cost_usd, created_at, workspace_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(promptName, 'v1.0', 200, 100, 400, 0.02, oneDayAgo, workspaceId);

    db.prepare("INSERT INTO runs (run_id, workflow_name, status, created_at, workspace_id) VALUES (?, ?, ?, ?, ?)").run(
      `run-${workspaceId}-1`, 'wf-1', 'completed', twoDaysAgo, workspaceId,
    );
    db.prepare("INSERT INTO runs (run_id, workflow_name, status, created_at, workspace_id) VALUES (?, ?, ?, ?, ?)").run(
      `run-${workspaceId}-2`, 'wf-1', 'failed', oneDayAgo, workspaceId,
    );

    db.prepare("INSERT INTO traces (trace_id, prompt_name, created_at, workspace_id) VALUES (?, ?, ?, ?)").run(
      `trace-${workspaceId}`, promptName, twoDaysAgo, workspaceId,
    );

    const evalResult = await db.prepare("INSERT INTO evaluations (name, prompt_name, created_at, workspace_id) VALUES (?, ?, ?, ?)").run(
      'Eval A', promptName, twoDaysAgo, workspaceId,
    );
    const evalId = Number(evalResult.lastInsertRowid);

    db.prepare("INSERT INTO evaluation_results (evaluation_id, score, created_at, workspace_id) VALUES (?, ?, ?, ?)").run(
      evalId, 4.0, twoDaysAgo, workspaceId,
    );
    db.prepare("INSERT INTO evaluation_results (evaluation_id, score, created_at, workspace_id) VALUES (?, ?, ?, ?)").run(
      evalId, 5.0, oneDayAgo, workspaceId,
    );

    return { now, twoDaysAgo, oneDayAgo };
  }

  it('getTimeSeries aggregates logs and computes error_rate from runs', async () => {
    const { now } = await seedData();
    const start = now - 7 * 86400;
    const daily = await service.getTimeSeries('default', start, now);

    expect(daily.length).toBeGreaterThan(0);
    const totalRequests = daily.reduce((sum, d) => sum + d.request_count, 0);
    expect(totalRequests).toBe(2);

    const totalTokens = daily.reduce((sum, d) => sum + d.total_tokens, 0);
    expect(totalTokens).toBe(450);

    const totalCost = daily.reduce((sum, d) => sum + d.total_cost_usd, 0);
    expect(totalCost).toBeCloseTo(0.03, 6);

    const dayWithError = daily.find((d) => d.error_rate > 0);
    expect(dayWithError).toBeDefined();
    expect(dayWithError!.error_rate).toBe(1);
  });

  it('getTimeSeries returns empty array when no data', async () => {
    const now = Math.floor(Date.now() / 1000);
    const daily = await service.getTimeSeries('default', now - 86400, now);
    expect(daily).toEqual([]);
  });

  it('getPromptMetrics groups by prompt and version', async () => {
    const { now } = await seedData();
    const start = now - 7 * 86400;
    const prompts = await service.getPromptMetrics('default', start, now, 10);

    expect(prompts.length).toBe(1);
    expect(prompts[0].prompt_name).toBe('prompt-a');
    expect(prompts[0].version_tag).toBe('v1.0');
    expect(prompts[0].request_count).toBe(2);
    expect(prompts[0].total_tokens_in).toBe(300);
    expect(prompts[0].total_tokens_out).toBe(150);
    expect(prompts[0].total_cost_usd).toBeCloseTo(0.03, 6);
    expect(prompts[0].avg_latency_ms).toBe(300);
  });

  it('getEvaluationTrends groups by evaluation and date', async () => {
    const { now } = await seedData();
    const start = now - 7 * 86400;
    const trends = await service.getEvaluationTrends('default', start, now);

    expect(trends.length).toBe(1);
    expect(trends[0].evaluation_id).toBe(1);
    expect(trends[0].name).toBe('Eval A');
    expect(trends[0].trend.length).toBe(2);

    const avgScore = trends[0].trend.reduce((sum, t) => sum + t.avg_score, 0) / trends[0].trend.length;
    expect(avgScore).toBeCloseTo(4.5, 6);
  });

  it('getEvaluationTrends filters by evaluation_id', async () => {
    const { now } = await seedData();
    const start = now - 7 * 86400;
    const trends = await service.getEvaluationTrends('default', start, now, 1);
    expect(trends.length).toBe(1);
    expect(trends[0].evaluation_id).toBe(1);

    const empty = await service.getEvaluationTrends('default', start, now, 999);
    expect(empty.length).toBe(0);
  });

  it('getActivitySummary returns correct counts', async () => {
    const { now, twoDaysAgo } = await seedData();
    const result = await service.getActivitySummary('default', twoDaysAgo, 1, 10, '7d');

    expect(result.window).toBe('7d');
    expect(result.summary.total_runs).toBe(2);
    expect(result.summary.total_traces).toBe(1);
    expect(result.summary.total_logs).toBe(2);
    expect(result.summary.total_evaluations).toBe(2);
    expect(result.summary.active_prompts).toBe(1);
    expect(result.summary.failed_runs).toBe(1);
    expect(result.recent_runs.items.length).toBe(2);
    expect(result.recent_runs.total).toBe(2);
  });

  it('getActivitySummary returns empty recent_runs when no data', async () => {
    const now = Math.floor(Date.now() / 1000);
    const result = await service.getActivitySummary('default', now, 1, 10, '7d');
    expect(result.summary.total_runs).toBe(0);
    expect(result.summary.total_logs).toBe(0);
    expect(result.recent_runs.items.length).toBe(0);
    expect(result.recent_runs.total).toBe(0);
  });

  it('workspace isolation prevents cross-workspace data leakage', async () => {
    await seedData('ws-a', 'prompt-a');
    const { now } = await seedData('ws-b', 'prompt-b');
    const start = now - 7 * 86400;

    const promptsA = await service.getPromptMetrics('ws-a', start, now, 10);
    expect(promptsA.length).toBe(1);
    expect(promptsA[0].prompt_name).toBe('prompt-a');

    const promptsB = await service.getPromptMetrics('ws-b', start, now, 10);
    expect(promptsB.length).toBe(1);
    expect(promptsB[0].prompt_name).toBe('prompt-b');

    const trendsA = await service.getEvaluationTrends('ws-a', start, now);
    expect(trendsA.length).toBe(1);

    const trendsB = await service.getEvaluationTrends('ws-b', start, now);
    expect(trendsB.length).toBe(1);
  });
});
