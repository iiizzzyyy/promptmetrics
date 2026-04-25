import { Request, Response } from 'express';
import { AppError } from '@errors/app.error';
import { EvaluationService } from '@services/evaluation.service';
import {
  createEvaluationSchema,
  createEvaluationResultSchema,
} from '@validation-schemas/promptmetrics-evaluation.schema';

export class EvaluationController {
  constructor(private service = new EvaluationService()) {}

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
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const workspaceId = req.workspaceId || 'default';
    const result = await this.service.listEvaluations(page, limit, workspaceId);
    res.status(200).json(result);
  }

  async getEvaluation(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const workspaceId = req.workspaceId || 'default';
    const result = await this.service.getEvaluation(id, workspaceId);
    res.status(200).json(result);
  }

  async deleteEvaluation(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const workspaceId = req.workspaceId || 'default';
    await this.service.deleteEvaluation(id, workspaceId);
    res.status(204).send();
  }

  async createResult(req: Request, res: Response): Promise<void> {
    const { error, value } = createEvaluationResultSchema.validate(req.body, { abortEarly: false });
    if (error) {
      throw AppError.validationFailed(error.details.map((d) => d.message));
    }

    const id = Number(req.params.id);
    const workspaceId = req.workspaceId || 'default';
    const result = await this.service.createResult(id, value, workspaceId);
    res.status(201).json(result);
  }

  async listResults(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const workspaceId = req.workspaceId || 'default';
    const result = await this.service.listResults(id, page, limit, workspaceId);
    res.status(200).json(result);
  }
}
