import { parseIdParam } from '@utils/validation';
import { Request, Response } from 'express';
import { AppError } from '@errors/app.error';
import { ABTestService } from '@services/ab-test.service';
import { createABTestSchema, runABTestSchema } from '@validation-schemas/ab-test.schema';

export class ABTestController {
  constructor(private service = new ABTestService()) {}

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
    const result = await this.service.runTest(id, workspaceId, value.scoresA, value.scoresB);
    res.status(200).json(result);
  }

  async promoteWinner(req: Request, res: Response): Promise<void> {
    const id = parseIdParam(req.params.id);
    const workspaceId = req.workspaceId || 'default';
    const result = await this.service.promoteWinner(id, workspaceId);
    res.status(200).json(result);
  }

  async deleteTest(req: Request, res: Response): Promise<void> {
    const id = parseIdParam(req.params.id);
    const workspaceId = req.workspaceId || 'default';
    await this.service.deleteTest(id, workspaceId);
    res.status(204).send();
  }
}
