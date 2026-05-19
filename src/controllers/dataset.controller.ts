import { parseIdParam } from '@utils/validation';
import { parsePagination } from '@utils/pagination';
import { Request, Response } from 'express';
import { AppError } from '@errors/app.error';
import { DatasetService } from '@services/dataset.service';
import { createDatasetSchema } from '@validation-schemas/dataset.schema';

export class DatasetController {
  constructor(private service = new DatasetService()) {}

  async createDataset(req: Request, res: Response): Promise<void> {
    const { error, value } = createDatasetSchema.validate(req.body, { abortEarly: false });
    if (error) {
      throw AppError.validationFailed(error.details.map((d) => d.message));
    }

    const workspaceId = req.workspaceId || 'default';
    const result = await this.service.createDataset(value, workspaceId);
    res.status(201).json(result);
  }

  async listDatasets(req: Request, res: Response): Promise<void> {
    const { page, limit } = parsePagination(req.query);
    const workspaceId = req.workspaceId || 'default';
    const result = await this.service.listDatasets(page, limit, workspaceId);
    res.status(200).json(result);
  }

  async getDataset(req: Request, res: Response): Promise<void> {
    const id = parseIdParam(req.params.id);
    const workspaceId = req.workspaceId || 'default';
    const result = await this.service.getDataset(id, workspaceId);
    res.status(200).json(result);
  }

  async deleteDataset(req: Request, res: Response): Promise<void> {
    const id = parseIdParam(req.params.id);
    const workspaceId = req.workspaceId || 'default';
    await this.service.deleteDataset(id, workspaceId);
    res.status(204).send();
  }
}
