import mustache from 'mustache';
import { AppError } from '@errors/app.error';
import { PromptDriver, PromptFile, PromptVersion } from '@drivers/promptmetrics-driver.interface';
import { parsePagination, buildPaginatedResponse, PaginatedResponse } from '@utils/pagination';
import { promptCache, cacheKey, invalidatePrompt } from '@services/cache.service';

export class PromptService {
  constructor(private driver: PromptDriver) {}

  async listPrompts(page: number, limit: number, query?: string): Promise<PaginatedResponse<{ name: string }>> {
    if (query) {
      const items = await this.driver.search(query);
      const { offset } = parsePagination({ page, limit });
      const paginated = items.slice(offset, offset + limit);
      return buildPaginatedResponse(paginated.map((name) => ({ name })), items.length, page, limit);
    }

    const result = await this.driver.listPrompts(page, limit);
    return buildPaginatedResponse(result.items.map((name) => ({ name })), result.total, page, limit);
  }

  async getPrompt(
    name: string,
    version?: string,
    variables?: Record<string, string>,
    shouldRender = true,
  ): Promise<{ content: PromptFile; version: PromptVersion }> {
    const key = cacheKey(name, version);
    const cached = promptCache.get(key);

    let rawContent: PromptFile;
    let promptVersion: PromptVersion;

    if (cached) {
      rawContent = cached.content;
      promptVersion = cached.version;
    } else {
      const result = await this.driver.getPrompt(name, version);
      if (!result) {
        throw AppError.notFound('Prompt');
      }
      rawContent = result.content;
      promptVersion = result.version;
      promptCache.set(key, { content: rawContent, version: promptVersion });
    }

    let content = rawContent;

    if (shouldRender) {
      const requiredVars = Object.entries(content.variables || {}).filter(
        ([, def]) => (def as { required?: boolean }).required,
      ).map(([key]) => key);
      const providedVars = variables ? Object.keys(variables) : [];
      const missing = requiredVars.filter((v) => !providedVars.includes(v));
      if (missing.length > 0) {
        throw AppError.badRequest(`Missing required variables: ${missing.join(', ')}`);
      }

      if (variables && Object.keys(variables).length > 0) {
        const renderedMessages = content.messages.map((msg) => {
          if (msg.role === 'assistant') return msg;
          const rendered = mustache.render(msg.content, variables, undefined, { escape: (text) => text });
          return { ...msg, content: rendered };
        });
        content = { ...content, messages: renderedMessages };
      }
    }

    return { content, version: promptVersion };
  }

  async listVersions(name: string, page: number, limit: number): Promise<PaginatedResponse<PromptVersion>> {
    const result = await this.driver.listVersions(name, page, limit);
    return buildPaginatedResponse(result.items, result.total, page, limit);
  }

  async createPrompt(prompt: PromptFile): Promise<PromptVersion> {
    const result = await this.driver.createPrompt(prompt);
    invalidatePrompt(prompt.name);
    return result;
  }
}
