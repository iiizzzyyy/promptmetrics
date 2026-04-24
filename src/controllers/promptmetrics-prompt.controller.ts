import { Request, Response } from 'express';
import { AppError } from '@errors/app.error';
import { PromptService } from '@services/prompt.service';
import { createPromptSchema } from '@validation-schemas/promptmetrics-prompt.schema';

export class PromptController {
  constructor(private service: PromptService) {}

  async listPrompts(req: Request, res: Response): Promise<void> {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const query = req.query.q as string | undefined;

    const result = await this.service.listPrompts(page, limit, query);
    res.json(result);
  }

  async getPrompt(req: Request, res: Response): Promise<void> {
    const name = req.params.name as string;
    const version = req.query.version as string | undefined;
    const shouldRender = req.query.render !== 'false';

    let variables: Record<string, string> | undefined;
    const rawVars = req.query.variables;
    if (rawVars && typeof rawVars === 'object' && !Array.isArray(rawVars)) {
      variables = Object.entries(rawVars).reduce((acc, [key, value]) => {
        acc[key] = String(value);
        return acc;
      }, {} as Record<string, string>);
    }

    if (req.body && req.body.variables && typeof req.body.variables === 'object') {
      variables = { ...variables, ...req.body.variables };
    }

    const result = await this.service.getPrompt(name, version, variables, shouldRender);
    res.json(result);
  }

  async listVersions(req: Request, res: Response): Promise<void> {
    const name = req.params.name as string;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));

    const result = await this.service.listVersions(name, page, limit);
    res.json(result);
  }

  async createPrompt(req: Request, res: Response): Promise<void> {
    const { error, value } = createPromptSchema.validate(req.body, { abortEarly: false });
    if (error) {
      throw AppError.validationFailed(error.details.map((d) => d.message));
    }

    const version = await this.service.createPrompt(value);
    res.status(201).json(version);
  }
}
