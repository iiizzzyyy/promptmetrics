import { parseIdParam } from '@utils/validation';
import { Request, Response } from 'express';
import { AppError } from '@errors/app.error';
import { EvaluationService } from '@services/evaluation.service';
import { EvalRunService } from '@services/eval-run.service';
import {
  createEvaluationSchema,
  createEvaluationResultSchema,
  runEvaluationSchema,
} from '@validation-schemas/promptmetrics-evaluation.schema';

export class EvaluationController {
  constructor(
    private service = new EvaluationService(),
    private evalRunService = new EvalRunService(),
  ) {}

  async createEvaluation(req: Request, res: Response): Promise<void> {
    const { error, value } = createEvaluationSchema.validate(req.body, { abortEarly: false });
    if (error) {
      throw AppError.validationFailed(error.details.map((d) => d.message));
    }

    const workspaceId = req.workspaceId || 'default';
    const result = await this.service.createEvaluation(value, workspaceId);
    res.status(201).json(result);
  }

  async listEvaluations(req: Request, res: Response): Promise<void> {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const workspaceId = req.workspaceId || 'default';
    const result = await this.service.listEvaluations(page, limit, workspaceId);
    res.status(200).json(result);
  }

  async getEvaluation(req: Request, res: Response): Promise<void> {
    const id = parseIdParam(req.params.id);
    const workspaceId = req.workspaceId || 'default';
    const result = await this.service.getEvaluation(id, workspaceId);
    res.status(200).json(result);
  }

  async deleteEvaluation(req: Request, res: Response): Promise<void> {
    const id = parseIdParam(req.params.id);
    const workspaceId = req.workspaceId || 'default';
    await this.service.deleteEvaluation(id, workspaceId);
    res.status(204).send();
  }

  async createResult(req: Request, res: Response): Promise<void> {
    const { error, value } = createEvaluationResultSchema.validate(req.body, { abortEarly: false });
    if (error) {
      throw AppError.validationFailed(error.details.map((d) => d.message));
    }

    const id = parseIdParam(req.params.id);
    const workspaceId = req.workspaceId || 'default';
    const result = await this.service.createResult(id, value, workspaceId);
    res.status(201).json(result);
  }

  async listResults(req: Request, res: Response): Promise<void> {
    const id = parseIdParam(req.params.id);
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const workspaceId = req.workspaceId || 'default';
    const result = await this.service.listResults(id, page, limit, workspaceId);
    res.status(200).json(result);
  }

  async runEvaluation(req: Request, res: Response): Promise<void> {
    const { error, value } = runEvaluationSchema.validate(req.body, { abortEarly: false });
    if (error) {
      throw AppError.validationFailed(error.details.map((d) => d.message));
    }

    const id = parseIdParam(req.params.id);
    const workspaceId = req.workspaceId || 'default';
    const run = await this.evalRunService.createRun(id, value.dataset_id, workspaceId);
    res.status(201).json(run);
  }

  async listRuns(req: Request, res: Response): Promise<void> {
    const id = parseIdParam(req.params.id);
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const workspaceId = req.workspaceId || 'default';
    const result = await this.evalRunService.listRuns(id, page, limit, workspaceId);
    res.status(200).json(result);
  }
}
