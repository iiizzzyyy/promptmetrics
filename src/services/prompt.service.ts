import mustache from 'mustache';
import { AppError } from '@errors/app.error';
import { PromptDriver, PromptFile, PromptVersion } from '@drivers/promptmetrics-driver.interface';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class PromptService {
  constructor(private driver: PromptDriver) {}

  async listPrompts(page: number, limit: number, query?: string): Promise<PaginatedResult<{ name: string }>> {
    if (query) {
      const items = await this.driver.search(query);
      const start = (page - 1) * limit;
      const paginated = items.slice(start, start + limit);
      return {
        items: paginated.map((name) => ({ name })),
        total: items.length,
        page,
        limit,
        totalPages: Math.ceil(items.length / limit),
      };
    }

    const result = await this.driver.listPrompts(page, limit);
    return {
      items: result.items.map((name) => ({ name })),
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  }

  async getPrompt(
    name: string,
    version?: string,
    variables?: Record<string, string>,
    shouldRender = true,
  ): Promise<{ content: PromptFile; version: PromptVersion }> {
    const result = await this.driver.getPrompt(name, version);
    if (!result) {
      throw AppError.notFound('Prompt');
    }

    let content = result.content;

    if (shouldRender && variables && Object.keys(variables).length > 0) {
      const requiredVars = Object.entries(content.variables || {}).filter(
        ([, def]) => (def as { required?: boolean }).required,
      ).map(([key]) => key);
      const providedVars = Object.keys(variables);
      const missing = requiredVars.filter((v) => !providedVars.includes(v));
      if (missing.length > 0) {
        throw AppError.badRequest(`Missing required variables: ${missing.join(', ')}`);
      }

      const renderedMessages = content.messages.map((msg) => {
        if (msg.role === 'assistant') return msg;
        const rendered = mustache.render(msg.content, variables, undefined, { escape: (text) => text });
        return { ...msg, content: rendered };
      });
      content = { ...content, messages: renderedMessages };
    }

    return { content, version: result.version };
  }

  async listVersions(name: string, page: number, limit: number): Promise<PaginatedResult<PromptVersion>> {
    const result = await this.driver.listVersions(name, page, limit);
    return {
      items: result.items,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  }

  async createPrompt(prompt: PromptFile): Promise<PromptVersion> {
    return this.driver.createPrompt(prompt);
  }
}
