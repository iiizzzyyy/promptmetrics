import mustache from 'mustache';
import { AppError } from '@errors/app.error';
import { PromptDriver, PromptFile, PromptVersion } from '@drivers/promptmetrics-driver.interface';
import { parsePagination, buildPaginatedResponse, PaginatedResponse } from '@utils/pagination';
import { getCachedPrompt, cacheKey, setCachedPrompt, invalidatePrompt } from '@services/cache.service';
import { getDb } from '@models/promptmetrics-sqlite';

export class PromptService {
  constructor(private driver: PromptDriver) {}

  async listPrompts(workspaceId: string, page: number, limit: number, query?: string): Promise<PaginatedResponse<{ name: string }>> {
    const db = getDb();
    const { offset } = parsePagination({ page: String(page), limit: String(limit) });

    if (query) {
      const driverItems = await this.driver.search(query);
      if (driverItems.length === 0) {
        return buildPaginatedResponse([], 0, page, limit);
      }
      const placeholders = driverItems.map(() => '?').join(',');
      const rows = (await db
        .prepare(`SELECT DISTINCT name FROM prompts WHERE workspace_id = ? AND name IN (${placeholders}) ORDER BY name`)
        .all(workspaceId, ...driverItems)) as Array<{ name: string }>;
      const total = rows.length;
      const paginated = rows.slice(offset, offset + limit);
      return buildPaginatedResponse(paginated, total, page, limit);
    }

    const totalRow = (await db.prepare('SELECT COUNT(DISTINCT name) as c FROM prompts WHERE workspace_id = ?').get(workspaceId)) as { c: number };
    const total = totalRow.c;
    const rows = (await db
      .prepare('SELECT DISTINCT name FROM prompts WHERE workspace_id = ? ORDER BY name LIMIT ? OFFSET ?')
      .all(workspaceId, limit, offset)) as Array<{ name: string }>;

    return buildPaginatedResponse(rows, total, page, limit);
  }

  async getPrompt(
    workspaceId: string,
    name: string,
    version?: string,
    variables?: Record<string, string>,
    shouldRender = true,
  ): Promise<{ content: PromptFile; version: PromptVersion }> {
    const db = getDb();
    const membership = (await db.prepare('SELECT 1 FROM prompts WHERE name = ? AND workspace_id = ? LIMIT 1').get(name, workspaceId)) as
      | { 1: number }
      | undefined;
    if (!membership) {
      throw AppError.notFound('Prompt');
    }

    const key = cacheKey(workspaceId, name, version);
    const cached = await getCachedPrompt(key);

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
      await setCachedPrompt(key, { content: rawContent, version: promptVersion });
    }

    let content = rawContent;

    if (shouldRender) {
      const requiredVars = Object.entries(content.variables || {})
        .filter(([, def]) => (def as { required?: boolean }).required)
        .map(([key]) => key);
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

  async listVersions(workspaceId: string, name: string, page: number, limit: number): Promise<PaginatedResponse<PromptVersion>> {
    const db = getDb();
    const { offset } = parsePagination({ page: String(page), limit: String(limit) });
    const totalRow = (await db.prepare('SELECT COUNT(*) as c FROM prompts WHERE name = ? AND workspace_id = ?').get(name, workspaceId)) as { c: number };
    const total = totalRow.c;
    const rows = (await db
      .prepare('SELECT * FROM prompts WHERE name = ? AND workspace_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(name, workspaceId, limit, offset)) as PromptVersion[];

    return buildPaginatedResponse(rows, total, page, limit);
  }

  async createPrompt(workspaceId: string, prompt: PromptFile): Promise<PromptVersion> {
    const result = await this.driver.createPrompt(prompt);
    const db = getDb();
    await db.prepare('UPDATE prompts SET workspace_id = ? WHERE name = ? AND version_tag = ?').run(workspaceId, prompt.name, prompt.version);
    await invalidatePrompt(workspaceId, prompt.name);
    return result;
  }
}
