import { Request, Response } from 'express';
import { AppError } from '@errors/app.error';
import { ApiKeyService } from '@services/api-key.service';
import { parsePagination } from '@utils/pagination';
import { createApiKeySchema } from '@validation-schemas/api-key.schema';

export class ApiKeyController {
  constructor(private service: ApiKeyService) {}

  async createApiKey(req: Request, res: Response): Promise<void> {
    const { error, value } = createApiKeySchema.validate(req.body, { abortEarly: false });
    if (error) {
      throw AppError.validationFailed(error.details.map((d) => d.message));
    }

    const callerWorkspaceId = req.workspaceId || 'default';
    const { apiKey, plaintextKey } = await this.service.createApiKey(value, callerWorkspaceId);

    res.status(201).json({
      id: apiKey.id,
      name: apiKey.name,
      workspace_id: apiKey.workspace_id,
      scopes: apiKey.scopes,
      created_at: apiKey.created_at,
      key: plaintextKey,
    });
  }

  async listApiKeys(req: Request, res: Response): Promise<void> {
    const { page, limit } = parsePagination(req.query);
    const callerWorkspaceId = req.workspaceId || 'default';
    const isAdmin = req.apiKey?.workspace_id === '*';
    const result = await this.service.listApiKeys(page, limit, callerWorkspaceId, isAdmin);
    res.status(200).json(result);
  }

  async deleteApiKey(req: Request, res: Response): Promise<void> {
    const rawId = req.params.id;
    const id = parseInt(Array.isArray(rawId) ? rawId[0] : rawId, 10);
    if (Number.isNaN(id)) {
      throw AppError.validationFailed(['Invalid API key id']);
    }

    const callerWorkspaceId = req.workspaceId || 'default';
    const isAdmin = req.apiKey?.workspace_id === '*';
    await this.service.deleteApiKey(id, callerWorkspaceId, isAdmin);
    res.status(204).send();
  }
}
