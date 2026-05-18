import mustache from 'mustache';
import { AppError } from '@errors/app.error';
import { PromptDriver, PromptFile, PromptVersion } from '@drivers/promptmetrics-driver.interface';
import { parsePagination, buildPaginatedResponse, PaginatedResponse, parseCountRow } from '@utils/pagination';
import { getCachedPrompt, cacheKey, setCachedPrompt, invalidatePrompt } from '@services/cache.service';
import { getDb } from '@models/promptmetrics-sqlite';
import { config } from '@config/index';

export class PromptService {
  constructor(private driver: PromptDriver) {}

  async listPrompts(
    workspaceId: string,
    page: number,
    limit: number,
    query?: string,
  ): Promise<PaginatedResponse<{ name: string }>> {
    const db = getDb();
    const { offset } = parsePagination({ page: String(page), limit: String(limit) });

    if (query) {
      // DESIGN NOTE (wontfix): driver.search() is not workspace-scoped — it
      // searches across all workspaces and may return prompt names belonging to
      // other tenants. The subsequent DB query filters by workspace_id so that
      // only names present in the requesting workspace are returned to the
      // caller. Prompt names themselves are not sensitive content (the full
      // content is gated by getPrompt()'s workspace check), but the fact that
      // a name exists in another workspace is visible to the driver layer.
      // Properly scoping search would require adding a workspaceId parameter
      // to the PromptDriver.search() interface and all three driver
      // implementations (filesystem, GitHub, S3), which is a larger change
      // than the current risk justifies. Accepted as a known trade-off.
      const driverItems = await this.driver.search(query);
      if (driverItems.length === 0) {
        return buildPaginatedResponse([], 0, page, limit);
      }
      const placeholders = driverItems.map(() => '?').join(',');
      const rows = (await db
        .prepare(
          `SELECT DISTINCT name FROM prompts WHERE workspace_id = ? AND status = 'active' AND name IN (${placeholders}) ORDER BY name`,
        )
        .all(workspaceId, ...driverItems)) as Array<{ name: string }>;
      const total = rows.length;
      const paginated = rows.slice(offset, offset + limit);
      return buildPaginatedResponse(paginated, total, page, limit);
    }

    const total = parseCountRow(
      await db
        .prepare("SELECT COUNT(DISTINCT name) as c FROM prompts WHERE workspace_id = ? AND status = 'active'")
        .get(workspaceId),
    );
    const rows = (await db
      .prepare(
        "SELECT DISTINCT name FROM prompts WHERE workspace_id = ? AND status = 'active' ORDER BY name LIMIT ? OFFSET ?",
      )
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
    const membership = (await db
      .prepare("SELECT 1 FROM prompts WHERE name = ? AND workspace_id = ? AND status = 'active' LIMIT 1")
      .get(name, workspaceId)) as { 1: number } | undefined;
    if (!membership) {
      throw AppError.notFound('Prompt');
    }

    // If no version is specified and an active_version_id is set, use that version
    // instead of falling through to the driver's "latest" logic.
    let effectiveVersion = version;
    if (!version) {
      const activeVersion = (await db
        .prepare(
          "SELECT version_tag FROM prompts WHERE id = (SELECT active_version_id FROM prompts WHERE name = ? AND workspace_id = ? AND status = 'active' LIMIT 1)",
        )
        .get(name, workspaceId)) as { version_tag: string } | undefined;
      if (activeVersion) {
        effectiveVersion = activeVersion.version_tag;
      }
    }

    const key = cacheKey(workspaceId, name, effectiveVersion);
    const cached = await getCachedPrompt(key);

    let rawContent: PromptFile;
    let promptVersion: PromptVersion;

    if (cached) {
      rawContent = cached.content;
      promptVersion = cached.version;
    } else {
      const result = await this.driver.getPrompt(name, effectiveVersion);
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
        // Mustache's default escape function HTML-escapes values (e.g. "<" →
        // "&lt;"). That is wrong for prompt content, which is sent to LLMs —
        // not rendered in HTML — so we intentionally disable it here. There is
        // currently no way to opt into HTML escaping; if prompts are ever
        // displayed in a web UI, the UI layer must apply its own escaping at
        // render time.
        // See also: mustache-renderer.service.ts renderTemplate(), which
        // applies the same policy for playground prompts.
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

  async listVersions(
    workspaceId: string,
    name: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResponse<PromptVersion>> {
    const db = getDb();
    const { offset } = parsePagination({ page: String(page), limit: String(limit) });
    const total = parseCountRow(
      await db
        .prepare("SELECT COUNT(*) as c FROM prompts WHERE name = ? AND workspace_id = ? AND status = 'active'")
        .get(name, workspaceId),
    );
    const rows = (await db
      .prepare(
        "SELECT * FROM prompts WHERE name = ? AND workspace_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT ? OFFSET ?",
      )
      .all(name, workspaceId, limit, offset)) as PromptVersion[];

    return buildPaginatedResponse(rows, total, page, limit);
  }

  async createPrompt(workspaceId: string, prompt: PromptFile): Promise<PromptVersion> {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    // Wrap the three-step write in a transaction so that if the driver
    // write fails, the pending row is rolled back instead of orphaned.
    const result = await db.transaction(async () => {
      // Check for existing active prompt with same name+version
      const existing = (await db
        .prepare(
          "SELECT status FROM prompts WHERE name = ? AND version_tag = ? AND workspace_id = ? AND status = 'active'",
        )
        .get(prompt.name, prompt.version, workspaceId)) as { status: string } | undefined;

      if (existing) {
        throw AppError.badRequest('Prompt already exists', { name: prompt.name, version: prompt.version });
      }

      // Step 1: insert pending row (or reset existing to pending)
      await db
        .prepare(
          `INSERT INTO prompts (name, version_tag, workspace_id, status, driver, created_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(name, version_tag) DO UPDATE SET
             workspace_id = excluded.workspace_id,
             status = 'pending',
             driver = excluded.driver,
             created_at = excluded.created_at`,
        )
        .run(prompt.name, prompt.version, workspaceId, 'pending', config.driver, now);

      // Step 2: driver writes content and updates its own fields via ON CONFLICT
      const driverResult = await this.driver.createPrompt(prompt);

      // Step 3: activate
      await db
        .prepare("UPDATE prompts SET status = 'active' WHERE name = ? AND version_tag = ?")
        .run(prompt.name, prompt.version);

      return driverResult;
    });

    await invalidatePrompt(workspaceId, prompt.name);
    return result;
  }
}
