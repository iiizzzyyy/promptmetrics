import { getDb } from '@models/promptmetrics-sqlite';
import { parsePagination, buildPaginatedResponse, PaginatedResponse, parseCountRow } from '@utils/pagination';
import { safeJsonParse } from '@utils/safe-json';

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
  status?: 'ok' | 'error';
  error_code?: string | null;
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
  status?: 'ok' | 'error';
  error_code?: string | null;
  http_status?: number;
}

type LogRow = {
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
  status: string | null;
  error_code: string | null;
};

function toLogEntry(row: LogRow): LogEntry {
  return {
    id: row.id,
    prompt_name: row.prompt_name || '',
    version_tag: row.version_tag || '',
    metadata: safeJsonParse<Record<string, unknown>>(row.metadata_json, {}),
    provider: row.provider,
    model: row.model,
    tokens_in: row.tokens_in,
    tokens_out: row.tokens_out,
    latency_ms: row.latency_ms,
    cost_usd: row.cost_usd,
    ollama_options: safeJsonParse<Record<string, unknown> | null>(row.ollama_options, null),
    ollama_keep_alive: row.ollama_keep_alive,
    ollama_format: row.ollama_format,
    workspace_id: row.workspace_id,
    created_at: row.created_at,
    status: (row.status || 'ok') as 'ok' | 'error',
    error_code: row.error_code,
  };
}

export class LogService {
  async createLog(input: CreateLogInput, workspaceId: string = 'default'): Promise<LogEntry> {
    const db = getDb();

    const httpStatus = typeof input.http_status === 'number' ? input.http_status : undefined;
    const hasError = input.metadata?.error || (httpStatus !== undefined && httpStatus >= 500);
    const status = input.status ?? (hasError ? 'error' : 'ok');

    let errorCode: string | null = input.error_code ?? null;
    if (errorCode === null) {
      const errorMeta = input.metadata?.error;
      if (errorMeta && typeof errorMeta === 'object' && 'code' in errorMeta) {
        errorCode = String((errorMeta as Record<string, unknown>).code);
      } else if (httpStatus !== undefined && httpStatus >= 500) {
        errorCode = String(httpStatus);
      }
    }

    const result = await db
      .prepare(
        `INSERT INTO logs (prompt_name, version_tag, metadata_json, provider, model, tokens_in, tokens_out, latency_ms, cost_usd, ollama_options, ollama_keep_alive, ollama_format, workspace_id, status, error_code)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        status,
        errorCode,
      );

    return {
      id: result.lastInsertRowid as number,
      prompt_name: input.prompt_name,
      version_tag: input.version_tag,
      metadata: input.metadata,
      provider: input.provider,
      model: input.model,
      tokens_in: input.tokens_in,
      tokens_out: input.tokens_out,
      latency_ms: input.latency_ms,
      cost_usd: input.cost_usd,
      ollama_options: input.ollama_options,
      ollama_keep_alive: input.ollama_keep_alive,
      ollama_format: input.ollama_format,
      workspace_id: workspaceId,
      created_at: Math.floor(Date.now() / 1000),
      status,
      error_code: errorCode,
    };
  }

  async getLogsForPromptVersion(
    promptName: string,
    versionTag: string,
    workspaceId: string = 'default',
  ): Promise<LogEntry[]> {
    const db = getDb();
    const items = (await db
      .prepare(
        'SELECT * FROM logs WHERE prompt_name = ? AND version_tag = ? AND workspace_id = ? ORDER BY created_at DESC LIMIT 100',
      )
      .all(promptName, versionTag, workspaceId)) as LogRow[];

    return items.map(toLogEntry);
  }

  async listLogs(page: number, limit: number, workspaceId: string = 'default'): Promise<PaginatedResponse<LogEntry>> {
    const db = getDb();
    const { offset } = parsePagination({ page: String(page), limit: String(limit) });
    const total = parseCountRow(
      await db.prepare('SELECT COUNT(*) as c FROM logs WHERE workspace_id = ?').get(workspaceId),
    );
    const items = (await db
      .prepare('SELECT * FROM logs WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(workspaceId, limit, offset)) as LogRow[];

    return buildPaginatedResponse(items.map(toLogEntry), total, page, limit);
  }
}
