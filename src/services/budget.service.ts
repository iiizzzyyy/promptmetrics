import { getDb } from '@models/promptmetrics-sqlite';
import { AppError } from '@errors/app.error';

const DEFAULT_MONTHLY_BUDGET_USD = Number(process.env.DEFAULT_WORKSPACE_MONTHLY_BUDGET_USD) || 100;

export class BudgetService {
  async getWorkspaceSpend(workspaceId: string, yearMonth?: string): Promise<number> {
    const db = getDb();
    const ym = yearMonth || this.getCurrentYearMonth();
    const start = `${ym}-01T00:00:00Z`;
    const end = this.getNextMonthStart(ym);

    const row = (await db
      .prepare(
        `SELECT COALESCE(SUM(cost_usd), 0) as total FROM logs WHERE workspace_id = ? AND created_at >= ? AND created_at < ?`,
      )
      .get(workspaceId, new Date(start).getTime() / 1000, new Date(end).getTime() / 1000)) as
      | { total: number }
      | undefined;

    return row?.total ?? 0;
  }

  async checkBudget(workspaceId: string): Promise<void> {
    const budgetUsd = await this.getWorkspaceBudget(workspaceId);
    const spend = await this.getWorkspaceSpend(workspaceId);
    if (spend >= budgetUsd) {
      throw AppError.badRequest(
        `Monthly budget exceeded for workspace ${workspaceId}. Current spend: $${spend.toFixed(4)}, Budget: $${budgetUsd.toFixed(4)}`,
        { code: 'BUDGET_EXCEEDED', spend, budget: budgetUsd },
      );
    }
  }

  async getWorkspaceBudget(workspaceId: string): Promise<number> {
    const db = getDb();
    const row = (await db.prepare('SELECT value FROM config WHERE key = ?').get(`workspace_budget:${workspaceId}`)) as
      | { value: string }
      | undefined;
    if (!row) return DEFAULT_MONTHLY_BUDGET_USD;
    const parsed = Number(row.value);
    return Number.isNaN(parsed) ? DEFAULT_MONTHLY_BUDGET_USD : parsed;
  }

  private getCurrentYearMonth(): string {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private getNextMonthStart(yearMonth: string): string {
    const [year, month] = yearMonth.split('-').map(Number);
    const d = new Date(Date.UTC(year, month, 1));
    return d.toISOString();
  }
}
