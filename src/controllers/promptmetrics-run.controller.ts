import { Request, Response } from 'express';
import { AppError } from '@errors/app.error';
import { RunService } from '@services/run.service';
import { parsePagination } from '@utils/pagination';
import { createRunSchema, updateRunSchema } from '@validation-schemas/promptmetrics-run.schema';

export class RunController {
  constructor(private service: RunService) {}

  async createRun(req: Request, res: Response): Promise<void> {
    const { error, value } = createRunSchema.validate(req.body, { abortEarly: false });
    if (error) {
      throw AppError.validationFailed(error.details.map((d) => d.message));
    }

    const workspaceId = req.workspaceId || 'default';
    const run = await this.service.createRun(value, workspaceId);

    res.status(201).json({
      run_id: run.run_id,
      workflow_name: run.workflow_name,
      status: run.status,
    });
  }

  async getRun(req: Request, res: Response): Promise<void> {
    const runId = req.params.run_id as string;
    const workspaceId = req.workspaceId || 'default';
    const run = await this.service.getRun(runId, workspaceId);

    res.status(200).json({
      run_id: run.run_id,
      workflow_name: run.workflow_name,
      status: run.status,
      input: run.input,
      output: run.output,
      trace_id: run.trace_id,
      metadata: run.metadata,
      created_at: run.created_at,
      updated_at: run.updated_at,
    });
  }

  async updateRun(req: Request, res: Response): Promise<void> {
    const runId = req.params.run_id as string;
    const { error, value } = updateRunSchema.validate(req.body, { abortEarly: false });
    if (error) {
      throw AppError.validationFailed(error.details.map((d) => d.message));
    }

    const workspaceId = req.workspaceId || 'default';
    const result = await this.service.updateRun(runId, value, workspaceId);

    if (result.status === 'unchanged') {
      res.status(200).json({ message: 'No changes' });
      return;
    }

    res.status(200).json({ run_id: runId, status: 'updated' });
  }

  async listRuns(req: Request, res: Response): Promise<void> {
    const { page, limit } = parsePagination(req.query);
    const workspaceId = req.workspaceId || 'default';
    const result = await this.service.listRuns(page, limit, workspaceId);
    res.status(200).json(result);
  }
}
