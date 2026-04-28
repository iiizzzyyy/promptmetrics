import { getDb } from '@models/promptmetrics-sqlite';
import { parsePagination, buildPaginatedResponse, PaginatedResponse } from '@utils/pagination';

export interface LogEntry {
  id: number;
  prompt_name: string;
  version_tag: string;
  metadata?: Record<string, unknown>;
  provider?: string | null;
  model?: string | null;
  tokens_in?: number | null;
  tokens_out?: number | null;
  latency_ms?: number | null;
  cost_usd?: number | null;
  ollama_options?: Record<string, unknown> | null;
  ollama_keep_alive?: string | null;
  ollama_format?: string | null;
  workspace_id?: string;
  created_at: number;
}

export interface CreateLogInput {
  prompt_name: string;
  version_tag: string;
  metadata?: Record<string, unknown>;
  provider?: string | null;
  model?: string | null;
  tokens_in?: number | null;
  tokens_out?: number | null;
  latency_ms?: number | null;
  cost_usd?: number | null;
  ollama_options?: Record<string, unknown> | null;
  ollama_keep_alive?: string | null;
  ollama_format?: string | null;
}

export class LogService {
  async createLog(input: CreateLogInput, workspaceId: string = 'default'): Promise<LogEntry> {
    const db = getDb();
    const result = await db
      .prepare(
        `INSERT INTO logs (prompt_name, version_tag, metadata_json, provider, model, tokens_in, tokens_out, latency_ms, cost_usd, ollama_options, ollama_keep_alive, ollama_format, workspace_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id`,
      )
      .run(
        input.prompt_name,
        input.version_tag,
        input.metadata ? JSON.stringify(input.metadata) : null,
        input.provider || null,
        input.model || null,
        input.tokens_in || null,
        input.tokens_out || null,
        input.latency_ms || null,
        input.cost_usd || null,
        input.ollama_options ? JSON.stringify(input.ollama_options) : null,
        input.ollama_keep_alive || null,
        input.ollama_format
          ? typeof input.ollama_format === 'string'
            ? input.ollama_format
            : JSON.stringify(input.ollama_format)
          : null,
        workspaceId,
      );

    return {
      id: result.lastInsertRowid as number,
      ...input,
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  async listLogs(page: number, limit: number, workspaceId: string = 'default'): Promise<PaginatedResponse<LogEntry>> {
    const db = getDb();
    const { offset } = parsePagination({ page: String(page), limit: String(limit) });
    const total = (
      (await db.prepare('SELECT COUNT(*) as c FROM logs WHERE workspace_id = ?').get(workspaceId)) as { c: number }
    ).c;
    const items = (await db
      .prepare('SELECT * FROM logs WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(workspaceId, limit, offset)) as Array<{
      id: number;
      prompt_name: string | null;
      version_tag: string | null;
      metadata_json: string | null;
      provider: string | null;
      model: string | null;
      tokens_in: number | null;
      tokens_out: number | null;
      latency_ms: number | null;
      cost_usd: number | null;
      ollama_options: string | null;
      ollama_keep_alive: string | null;
      ollama_format: string | null;
      workspace_id: string;
      created_at: number;
    }>;

    return buildPaginatedResponse(
      items.map((l) => ({
        id: l.id,
        prompt_name: l.prompt_name || '',
        version_tag: l.version_tag || '',
        metadata: l.metadata_json ? JSON.parse(l.metadata_json) : {},
        provider: l.provider,
        model: l.model,
        tokens_in: l.tokens_in,
        tokens_out: l.tokens_out,
        latency_ms: l.latency_ms,
        cost_usd: l.cost_usd,
        ollama_options: l.ollama_options ? JSON.parse(l.ollama_options) : null,
        ollama_keep_alive: l.ollama_keep_alive,
        ollama_format: l.ollama_format,
        workspace_id: l.workspace_id,
        created_at: l.created_at,
      })),
      total,
      page,
      limit,
    );
  }
}
