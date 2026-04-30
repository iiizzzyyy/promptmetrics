import fs from 'fs';
import path from 'path';
import { getDb, initSchema, closeDb } from '@models/promptmetrics-sqlite';
import { BudgetService } from '@services/budget.service';

describe('BudgetService', () => {
  const testDbPath = path.resolve(__dirname, '../data/test-budget-unit.db');
  let service: BudgetService;

  beforeEach(async () => {
    process.env.SQLITE_PATH = testDbPath;
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
    closeDb();
    await initSchema();
    service = new BudgetService();
  });

  afterEach(() => {
    closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
  });

  function seedLogs(workspaceId: string, costs: number[], timestamps: number[]) {
    const db = getDb();
    for (let i = 0; i < costs.length; i++) {
      db.prepare(
        `INSERT INTO logs (prompt_name, version_tag, tokens_in, tokens_out, latency_ms, cost_usd, created_at, workspace_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run('prompt-a', 'v1.0', 10, 10, 100, costs[i], timestamps[i], workspaceId);
    }
  }

  describe('getWorkspaceSpend', () => {
    it('calculates correct spend for a workspace in a given month', async () => {
      const now = new Date();
      const yearMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      const startOfMonth = Math.floor(new Date(`${yearMonth}-01T00:00:00Z`).getTime() / 1000);
      const midMonth = startOfMonth + 15 * 86400;

      seedLogs('ws-a', [0.01, 0.02, 0.03], [startOfMonth, midMonth, startOfMonth + 1]);
      seedLogs('ws-b', [0.5], [startOfMonth]);

      const spendA = await service.getWorkspaceSpend('ws-a', yearMonth);
      expect(spendA).toBeCloseTo(0.06, 6);

      const spendB = await service.getWorkspaceSpend('ws-b', yearMonth);
      expect(spendB).toBeCloseTo(0.5, 6);
    });

    it('returns 0 when no logs exist', async () => {
      const spend = await service.getWorkspaceSpend('empty-ws');
      expect(spend).toBe(0);
    });

    it('filters by month boundaries correctly', async () => {
      const now = new Date();
      const thisMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      const prevMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15));
      const prevMonth = `${prevMonthDate.getUTCFullYear()}-${String(prevMonthDate.getUTCMonth() + 1).padStart(2, '0')}`;

      const thisMonthStart = Math.floor(new Date(`${thisMonth}-01T00:00:00Z`).getTime() / 1000);
      const prevMonthStart = Math.floor(new Date(`${prevMonth}-01T00:00:00Z`).getTime() / 1000);

      seedLogs('ws-a', [0.01], [thisMonthStart]);
      seedLogs('ws-a', [0.99], [prevMonthStart]);

      const spendThisMonth = await service.getWorkspaceSpend('ws-a', thisMonth);
      expect(spendThisMonth).toBeCloseTo(0.01, 6);

      const spendPrevMonth = await service.getWorkspaceSpend('ws-a', prevMonth);
      expect(spendPrevMonth).toBeCloseTo(0.99, 6);
    });
  });

  describe('checkBudget', () => {
    it('passes when spend is under budget', async () => {
      const db = getDb();
      db.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run('workspace_budget:under-ws', '100');

      await expect(service.checkBudget('under-ws')).resolves.toBeUndefined();
    });

    it('throws when spend equals budget', async () => {
      const db = getDb();
      db.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run('workspace_budget:eq-ws', '0.05');

      const now = new Date();
      const yearMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      const startOfMonth = Math.floor(new Date(`${yearMonth}-01T00:00:00Z`).getTime() / 1000);
      seedLogs('eq-ws', [0.05], [startOfMonth]);

      await expect(service.checkBudget('eq-ws')).rejects.toMatchObject({
        statusCode: 400,
        details: { code: 'BUDGET_EXCEEDED' },
      });
    });

    it('throws when spend exceeds budget', async () => {
      const db = getDb();
      db.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run('workspace_budget:over-ws', '0.01');

      const now = new Date();
      const yearMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      const startOfMonth = Math.floor(new Date(`${yearMonth}-01T00:00:00Z`).getTime() / 1000);
      seedLogs('over-ws', [0.05], [startOfMonth]);

      await expect(service.checkBudget('over-ws')).rejects.toMatchObject({
        statusCode: 400,
        details: { code: 'BUDGET_EXCEEDED' },
      });
    });
  });

  describe('getWorkspaceBudget', () => {
    it('reads budget from config table', async () => {
      const db = getDb();
      db.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run('workspace_budget:custom-ws', '250.50');

      const budget = await service.getWorkspaceBudget('custom-ws');
      expect(budget).toBe(250.5);
    });

    it('falls back to DEFAULT_MONTHLY_BUDGET_USD when no config row exists', async () => {
      const budget = await service.getWorkspaceBudget('no-config-ws');
      expect(budget).toBe(100);
    });

    it('falls back to DEFAULT_MONTHLY_BUDGET_USD when config value is invalid (NaN)', async () => {
      const db = getDb();
      db.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run('workspace_budget:nan-ws', 'not-a-number');

      const budget = await service.getWorkspaceBudget('nan-ws');
      expect(budget).toBe(100);
    });
  });
});
