import fs from 'fs';
import path from 'path';
import { getDb, initSchema, closeDb } from '@models/promptmetrics-sqlite';
import { EvalRunService } from '@services/eval-run.service';

describe('EvalRunService', () => {
  const testDbPath = path.resolve(__dirname, '../data/test-eval-run-unit.db');
  let service: EvalRunService;

  beforeEach(async () => {
    process.env.SQLITE_PATH = testDbPath;
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
    await closeDb();
    await initSchema();
    service = new EvalRunService();
  });

  afterEach(async () => {
    await closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
  });

  async function seedEvaluation(id: number, workspaceId: string = 'default') {
    const db = getDb();
    await db
      .prepare(`INSERT INTO evaluations (id, name, prompt_name, created_at, workspace_id) VALUES (?, ?, ?, ?, ?)`)
      .run(id, `eval-${id}`, 'prompt-a', Math.floor(Date.now() / 1000), workspaceId);
  }

  async function seedDataset(id: number, workspaceId: string = 'default') {
    const db = getDb();
    await db
      .prepare(`INSERT INTO datasets (id, name, workspace_id, row_count) VALUES (?, ?, ?, ?)`)
      .run(id, `dataset-${id}`, workspaceId, 0);
  }

  describe('createRun', () => {
    it('inserts row with status running and returns run with id', async () => {
      await seedEvaluation(1);
      const run = await service.createRun(1, undefined, 'default');

      expect(run.id).toBeDefined();
      expect(run.evaluation_id).toBe(1);
      expect(run.status).toBe('running');
      expect(run.workspace_id).toBe('default');
    });

    it('uses default workspace_id when omitted', async () => {
      await seedEvaluation(1);
      const run = await service.createRun(1, undefined);
      expect(run.workspace_id).toBe('default');
    });

    it('accepts an optional dataset_id', async () => {
      await seedEvaluation(1);
      await seedDataset(42);
      const run = await service.createRun(1, 42, 'default');
      expect(run.dataset_id).toBe(42);
    });
  });

  describe('completeRun', () => {
    it('updates status to completed, sets score and results_json', async () => {
      await seedEvaluation(1);
      const created = await service.createRun(1, undefined, 'default');

      const completed = await service.completeRun(created.id, 0.95, JSON.stringify({ accuracy: 0.95 }), 'default');
      expect(completed.status).toBe('completed');
      expect(completed.score).toBe(0.95);
      expect(completed.results_json).toBe(JSON.stringify({ accuracy: 0.95 }));
    });

    it('uses default workspace_id when omitted', async () => {
      await seedEvaluation(1);
      const created = await service.createRun(1, undefined, 'default');
      const completed = await service.completeRun(created.id, 0.95, JSON.stringify({ accuracy: 0.95 }));
      expect(completed.status).toBe('completed');
    });

    it('throws notFound when completing a non-existent run', async () => {
      await expect(service.completeRun(99999, 0.5, '{}', 'default')).rejects.toMatchObject({
        code: 'NOT_FOUND',
        statusCode: 404,
      });
    });

    it('throws notFound when completing a run from a different workspace', async () => {
      await seedEvaluation(1, 'ws-a');
      const created = await service.createRun(1, undefined, 'ws-a');
      await expect(service.completeRun(created.id, 0.5, '{}', 'ws-b')).rejects.toMatchObject({
        code: 'NOT_FOUND',
        statusCode: 404,
      });
    });
  });

  describe('failRun', () => {
    it('updates status to failed and sets results_json with reason', async () => {
      await seedEvaluation(1);
      const created = await service.createRun(1, undefined, 'default');

      const failed = await service.failRun(created.id, 'Model timeout', 'default');
      expect(failed.status).toBe('failed');
      expect(failed.results_json).toBe(JSON.stringify({ reason: 'Model timeout' }));
    });

    it('uses default workspace_id when omitted', async () => {
      await seedEvaluation(1);
      const created = await service.createRun(1, undefined, 'default');
      const failed = await service.failRun(created.id, 'Model timeout');
      expect(failed.status).toBe('failed');
    });

    it('throws notFound when failing a non-existent run', async () => {
      await expect(service.failRun(99999, 'Error', 'default')).rejects.toMatchObject({
        code: 'NOT_FOUND',
        statusCode: 404,
      });
    });
  });

  describe('listRuns', () => {
    it('paginates correctly and filters by evaluation_id and workspace_id', async () => {
      await seedEvaluation(1);
      await seedEvaluation(2);
      // Seed runs for evaluation 1
      for (let i = 0; i < 5; i++) {
        await service.createRun(1, undefined, 'default');
      }
      // Seed runs for evaluation 2
      await service.createRun(2, undefined, 'default');

      const page1 = await service.listRuns(1, 1, 3, 'default');
      expect(page1.items.length).toBe(3);
      expect(page1.total).toBe(5);
      expect(page1.page).toBe(1);

      const page2 = await service.listRuns(1, 2, 3, 'default');
      expect(page2.items.length).toBe(2);
      expect(page2.total).toBe(5);
      expect(page2.page).toBe(2);

      const eval2Runs = await service.listRuns(2, 1, 10, 'default');
      expect(eval2Runs.items.length).toBe(1);
      expect(eval2Runs.total).toBe(1);
    });

    it('returns empty list when no runs match', async () => {
      const result = await service.listRuns(999, 1, 10, 'default');
      expect(result.items.length).toBe(0);
      expect(result.total).toBe(0);
    });

    it('uses default workspace_id when omitted', async () => {
      await seedEvaluation(1);
      await service.createRun(1, undefined, 'default');
      const result = await service.listRuns(1, 1, 10);
      expect(result.items.length).toBe(1);
    });
  });

  describe('getRun', () => {
    it('throws notFound when run does not exist', async () => {
      await expect((service as any).getRun(99999, 'default')).rejects.toMatchObject({
        code: 'NOT_FOUND',
        statusCode: 404,
      });
    });
  });

  describe('workspace isolation', () => {
    it('run from workspace A is not visible in workspace B', async () => {
      await seedEvaluation(1, 'ws-a');
      const runA = await service.createRun(1, undefined, 'ws-a');
      await service.createRun(1, undefined, 'ws-b');

      const listA = await service.listRuns(1, 1, 10, 'ws-a');
      expect(listA.items.length).toBe(1);
      expect(listA.items[0].id).toBe(runA.id);

      const listB = await service.listRuns(1, 1, 10, 'ws-b');
      expect(listB.items.length).toBe(1);
      expect(listB.items[0].id).not.toBe(runA.id);
    });

    it('getRun enforces workspace isolation on complete/fail', async () => {
      await seedEvaluation(1, 'ws-a');
      const run = await service.createRun(1, undefined, 'ws-a');

      await expect(service.completeRun(run.id, 0.9, '{}', 'ws-b')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      await expect(service.failRun(run.id, 'Error', 'ws-b')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });
});
