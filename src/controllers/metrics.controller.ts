import { Request, Response } from 'express';
import { AppError } from '@errors/app.error';
import { MetricsService } from '@services/metrics.service';
import { parsePagination } from '@utils/pagination';

const VALID_WINDOWS = ['7d', '30d', '90d'];

function parseWindow(window: string): { start: number; end: number } {
  const days = parseInt(window, 10);
  const end = Math.floor(Date.now() / 1000);
  const start = end - days * 24 * 60 * 60;
  return { start, end };
}

export class MetricsController {
  constructor(private service: MetricsService) {}

  private validateWindow(window: string): { start: number; end: number } {
    if (!VALID_WINDOWS.includes(window)) {
      throw AppError.badRequest('Invalid window parameter. Must be one of: 7d, 30d, 90d');
    }
    return parseWindow(window);
  }

  async getTimeSeries(req: Request, res: Response): Promise<void> {
    const window = (req.query.window as string) || '30d';
    const { start, end } = this.validateWindow(window);
    const workspaceId = req.workspaceId || 'default';
    const daily = await this.service.getTimeSeries(workspaceId, start, end);
    res.status(200).json({ window, start, end, daily });
  }

  async getPromptMetrics(req: Request, res: Response): Promise<void> {
    const window = (req.query.window as string) || '30d';
    const { start, end } = this.validateWindow(window);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const workspaceId = req.workspaceId || 'default';
    const prompts = await this.service.getPromptMetrics(workspaceId, start, end, limit);
    res.status(200).json({ window, prompts });
  }

  async getEvaluationTrends(req: Request, res: Response): Promise<void> {
    const window = (req.query.window as string) || '30d';
    const { start, end } = this.validateWindow(window);
    const evaluationId = req.query.evaluation_id ? Number(req.query.evaluation_id) : undefined;
    const workspaceId = req.workspaceId || 'default';
    const evaluations = await this.service.getEvaluationTrends(workspaceId, start, end, evaluationId);
    res.status(200).json({ window, evaluations });
  }

  async getActivitySummary(req: Request, res: Response): Promise<void> {
    const window = (req.query.window as string) || '30d';
    const { start } = this.validateWindow(window);
    const { page, limit } = parsePagination(req.query);
    const workspaceId = req.workspaceId || 'default';
    const result = await this.service.getActivitySummary(workspaceId, start, page, limit, window);
    res.status(200).json(result);
  }
}
