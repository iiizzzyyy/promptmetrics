import { Request, Response } from 'express';
import mustache from 'mustache';
import { PromptDriver } from '@drivers/promptmetrics-driver.interface';
import { createPromptSchema } from '@validation-schemas/promptmetrics-prompt.schema';

export class PromptController {
  constructor(private driver: PromptDriver) {}

  async listPrompts(req: Request, res: Response): Promise<void> {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const query = req.query.q as string | undefined;

    try {
      if (query) {
        const items = await this.driver.search(query);
        const start = (page - 1) * limit;
        const paginated = items.slice(start, start + limit);
        res.json({
          items: paginated.map((name) => ({ name })),
          total: items.length,
          page,
          limit,
          totalPages: Math.ceil(items.length / limit),
        });
        return;
      }

      const result = await this.driver.listPrompts(page, limit);
      res.json({
        items: result.items.map((name) => ({ name })),
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to list prompts', message: (error as Error).message });
    }
  }

  async getPrompt(req: Request, res: Response): Promise<void> {
    const name = req.params.name as string;
    const version = req.query.version as string | undefined;
    const shouldRender = req.query.render !== 'false';

    // Parse variables from query string: ?variables[name]=Alice
    let variables: Record<string, string> | undefined;
    const rawVars = req.query.variables;
    if (rawVars && typeof rawVars === 'object' && !Array.isArray(rawVars)) {
      variables = Object.entries(rawVars).reduce((acc, [key, value]) => {
        acc[key] = String(value);
        return acc;
      }, {} as Record<string, string>);
    }

    // Also accept variables from body for POST requests
    if (req.body && req.body.variables && typeof req.body.variables === 'object') {
      variables = { ...variables, ...req.body.variables };
    }

    try {
      const result = await this.driver.getPrompt(name, version);
      if (!result) {
        res.status(404).json({ error: 'Prompt not found' });
        return;
      }

      let content = result.content;
      const isExplicitRender = req.query.render === 'true';

      const shouldValidate = shouldRender && (isExplicitRender || (variables && Object.keys(variables).length > 0));
      if (shouldValidate) {
        const requiredVars = Object.entries(content.variables || {}).filter(
          ([, def]) => (def as { required?: boolean }).required,
        ).map(([key]) => key);
        const providedVars = Object.keys(variables || {});
        const missing = requiredVars.filter((v) => !providedVars.includes(v));
        if (missing.length > 0) {
          res.status(400).json({
            error: 'Bad Request',
            message: `Missing required variables: ${missing.join(', ')}`,
          });
          return;
        }
      }

      if (shouldRender && variables && Object.keys(variables).length > 0) {
        const renderedMessages = content.messages.map((msg) => {
          if (msg.role === 'assistant') return msg;
          const rendered = mustache.render(msg.content, variables, undefined, { escape: (text) => text });
          return { ...msg, content: rendered };
        });
        content = { ...content, messages: renderedMessages };
      }

      res.json({ content, version: result.version });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get prompt', message: (error as Error).message });
    }
  }

  async listVersions(req: Request, res: Response): Promise<void> {
    const name = req.params.name as string;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));

    try {
      const result = await this.driver.listVersions(name, page, limit);
      res.json({
        items: result.items,
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to list versions', message: (error as Error).message });
    }
  }

  async createPrompt(req: Request, res: Response): Promise<void> {
    const { error, value } = createPromptSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(422).json({
        error: 'Validation failed',
        details: error.details.map((d) => d.message),
      });
      return;
    }

    try {
      const version = await this.driver.createPrompt(value);
      res.status(201).json(version);
    } catch (err) {
      res.status(500).json({ error: 'Failed to create prompt', message: (err as Error).message });
    }
  }
}
