import { Request, Response, NextFunction } from 'express';
import { EvaluationService } from '@services/evaluation.service';

export class EvaluationController {
  constructor(private service = new EvaluationService()) {}

  async createEvaluation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.service.createEvaluation(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  async listEvaluations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 50;
      const result = await this.service.listEvaluations(page, limit);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getEvaluation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      const result = await this.service.getEvaluation(id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async deleteEvaluation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      await this.service.deleteEvaluation(id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async createResult(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      const result = await this.service.createResult(id, req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  async listResults(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 50;
      const result = await this.service.listResults(id, page, limit);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
