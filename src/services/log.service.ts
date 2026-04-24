import { getDb } from '@models/promptmetrics-sqlite';

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
  ollama_keep_alive?: number | null;
  ollama_format?: string | null;
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
  ollama_keep_alive?: number | null;
  ollama_format?: string | null;
}

export class LogService {
  createLog(input: CreateLogInput): LogEntry {
    const db = getDb();
    const result = db
      .prepare(
        `INSERT INTO logs (prompt_name, version_tag, metadata_json, provider, model, tokens_in, tokens_out, latency_ms, cost_usd, ollama_options, ollama_keep_alive, ollama_format)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      );

    return {
      id: result.lastInsertRowid as number,
      ...input,
      created_at: Math.floor(Date.now() / 1000),
    };
  }
}
