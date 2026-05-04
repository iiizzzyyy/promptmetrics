import { parseIdParam } from '@utils/validation';
import { Request, Response } from 'express';
import { AppError } from '@errors/app.error';
import { ABTestService } from '@services/ab-test.service';
import { LogService } from '@services/log.service';
import { createABTestSchema, runABTestSchema } from '@validation-schemas/ab-test.schema';

export class ABTestController {
  constructor(
    private service = new ABTestService(),
    private logService = new LogService(),
  ) {}

  async createTest(req: Request, res: Response): Promise<void> {
    const { error, value } = createABTestSchema.validate(req.body, { abortEarly: false });
    if (error) {
      throw AppError.validationFailed(error.details.map((d) => d.message));
    }

    const workspaceId = req.workspaceId || 'default';
    const result = await this.service.createTest(value, workspaceId);
    res.status(201).json(result);
  }

  async listTests(req: Request, res: Response): Promise<void> {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const workspaceId = req.workspaceId || 'default';
    const result = await this.service.listTests(page, limit, workspaceId);
    res.status(200).json(result);
  }

  async getTest(req: Request, res: Response): Promise<void> {
    const id = parseIdParam(req.params.id);
    const workspaceId = req.workspaceId || 'default';
    const result = await this.service.getTest(id, workspaceId);
    res.status(200).json(result);
  }

  async runTest(req: Request, res: Response): Promise<void> {
    const { error, value } = runABTestSchema.validate(req.body, { abortEarly: false });
    if (error) {
      throw AppError.validationFailed(error.details.map((d) => d.message));
    }

    const id = parseIdParam(req.params.id);
    const workspaceId = req.workspaceId || 'default';

    let scoresA: number[] | undefined = value.scoresA;
    let scoresB: number[] | undefined = value.scoresB;

    if (!scoresA || !scoresB) {
      const test = await this.service.getTest(id, workspaceId);

      if (!test.evaluation_id) {
        const metric = test.metric || 'latency';

        const logsA = await this.logService.getLogsForPromptVersion(test.prompt_name, test.version_a, workspaceId);
        const logsB = await this.logService.getLogsForPromptVersion(test.prompt_name, test.version_b, workspaceId);

        const extractScore = (log: {
          latency_ms?: number | null;
          cost_usd?: number | null;
          metadata?: Record<string, unknown>;
        }): number => {
          if (metric === 'latency') return log.latency_ms ?? 0;
          if (metric === 'cost') return log.cost_usd ?? 0;
          if (metric === 'win_rate') {
            const meta = log.metadata ?? {};
            const rating = meta.rating ?? meta.score ?? meta.win;
            return typeof rating === 'number' ? rating : 0;
          }
          return log.latency_ms ?? 0;
        };

        scoresA = logsA.map(extractScore).filter((s) => s > 0);
        scoresB = logsB.map(extractScore).filter((s) => s > 0);

        if (scoresA.length === 0 || scoresB.length === 0) {
          throw AppError.badRequest('Insufficient logs to auto-compute scores for this A/B test');
        }
      }
    }

    const result = await this.service.runTest(id, workspaceId, scoresA, scoresB);
    res.status(200).json(result);
  }

  async promoteWinner(req: Request, res: Response): Promise<void> {
    const id = parseIdParam(req.params.id);
    const workspaceId = req.workspaceId || 'default';
    const apiKeyName = req.apiKey?.name || 'unknown';
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const result = await this.service.promoteWinner(id, workspaceId, apiKeyName, ipAddress);
    res.status(200).json(result);
  }

  async deleteTest(req: Request, res: Response): Promise<void> {
    const id = parseIdParam(req.params.id);
    const workspaceId = req.workspaceId || 'default';
    await this.service.deleteTest(id, workspaceId);
    res.status(204).send();
  }
}
