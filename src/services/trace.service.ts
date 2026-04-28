import crypto from 'crypto';
import { AppError } from '@errors/app.error';
import { getDb } from '@models/promptmetrics-sqlite';
import { parsePagination, buildPaginatedResponse, PaginatedResponse, parseCountRow } from '@utils/pagination';

export interface Trace {
  trace_id: string;
  prompt_name: string | null;
  version_tag: string | null;
  metadata: Record<string, unknown>;
  created_at: number;
}

export interface Span {
  span_id: string;
  parent_id: string | null;
  name: string;
  status: string;
  start_time: number | null;
  end_time: number | null;
  metadata: Record<string, unknown>;
  created_at: number;
}

export interface CreateTraceInput {
  trace_id?: string;
  prompt_name?: string | null;
  version_tag?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateSpanInput {
  span_id?: string;
  parent_id?: string | null;
  name: string;
  status: string;
  start_time?: number | null;
  end_time?: number | null;
  metadata?: Record<string, unknown>;
}

export class TraceService {
  async createTrace(input: CreateTraceInput, workspaceId: string = 'default'): Promise<Trace> {
    const db = getDb();
    const traceId = input.trace_id || crypto.randomUUID();

    await db
      .prepare(
        `INSERT INTO traces (trace_id, prompt_name, version_tag, metadata_json, workspace_id)
       VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        traceId,
        input.prompt_name || null,
        input.version_tag || null,
        input.metadata ? JSON.stringify(input.metadata) : null,
        workspaceId,
      );

    return {
      trace_id: traceId,
      prompt_name: input.prompt_name || null,
      version_tag: input.version_tag || null,
      metadata: input.metadata || {},
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  async getTrace(traceId: string, workspaceId: string = 'default'): Promise<{ trace: Trace; spans: Span[] }> {
    const db = getDb();
    const row = (await db
      .prepare('SELECT * FROM traces WHERE trace_id = ? AND workspace_id = ?')
      .get(traceId, workspaceId)) as
      | {
          trace_id: string;
          prompt_name: string | null;
          version_tag: string | null;
          metadata_json: string | null;
          created_at: number;
        }
      | undefined;

    if (!row) {
      throw AppError.notFound('Trace');
    }

    const trace: Trace = {
      trace_id: row.trace_id,
      prompt_name: row.prompt_name,
      version_tag: row.version_tag,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : {},
      created_at: row.created_at,
    };

    const spanRows = (await db
      .prepare('SELECT * FROM spans WHERE trace_id = ? AND workspace_id = ? ORDER BY start_time ASC')
      .all(traceId, workspaceId)) as Array<{
      span_id: string;
      parent_id: string | null;
      name: string;
      status: string;
      start_time: number | null;
      end_time: number | null;
      metadata_json: string | null;
      created_at: number;
    }>;

    const spans: Span[] = spanRows.map((s) => ({
      span_id: s.span_id,
      parent_id: s.parent_id,
      name: s.name,
      status: s.status,
      start_time: s.start_time,
      end_time: s.end_time,
      metadata: s.metadata_json ? JSON.parse(s.metadata_json) : {},
      created_at: s.created_at,
    }));

    return { trace, spans };
  }

  async createSpan(traceId: string, input: CreateSpanInput, workspaceId: string = 'default'): Promise<Span> {
    const db = getDb();
    const trace = (await db
      .prepare('SELECT trace_id FROM traces WHERE trace_id = ? AND workspace_id = ?')
      .get(traceId, workspaceId)) as { trace_id: string } | undefined;

    if (!trace) {
      throw AppError.notFound('Trace');
    }

    const spanId = input.span_id || crypto.randomUUID();

    await db
      .prepare(
        `INSERT INTO spans (trace_id, span_id, parent_id, name, status, start_time, end_time, metadata_json, workspace_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        traceId,
        spanId,
        input.parent_id || null,
        input.name,
        input.status,
        input.start_time || null,
        input.end_time || null,
        input.metadata ? JSON.stringify(input.metadata) : null,
        workspaceId,
      );

    return {
      span_id: spanId,
      parent_id: input.parent_id || null,
      name: input.name,
      status: input.status,
      start_time: input.start_time || null,
      end_time: input.end_time || null,
      metadata: input.metadata || {},
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  async getSpan(traceId: string, spanId: string, workspaceId: string = 'default'): Promise<Span> {
    const db = getDb();
    const row = (await db
      .prepare('SELECT * FROM spans WHERE trace_id = ? AND span_id = ? AND workspace_id = ?')
      .get(traceId, spanId, workspaceId)) as
      | {
          span_id: string;
          parent_id: string | null;
          name: string;
          status: string;
          start_time: number | null;
          end_time: number | null;
          metadata_json: string | null;
          created_at: number;
        }
      | undefined;

    if (!row) {
      throw AppError.notFound('Span');
    }

    return {
      span_id: row.span_id,
      parent_id: row.parent_id,
      name: row.name,
      status: row.status,
      start_time: row.start_time,
      end_time: row.end_time,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : {},
      created_at: row.created_at,
    };
  }

  async listTraces(page: number, limit: number, workspaceId: string = 'default'): Promise<PaginatedResponse<Trace>> {
    const db = getDb();
    const { offset } = parsePagination({ page: String(page), limit: String(limit) });
    const total = parseCountRow(await db.prepare('SELECT COUNT(*) as c FROM traces WHERE workspace_id = ?').get(workspaceId));
    const items = (await db
      .prepare('SELECT * FROM traces WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(workspaceId, limit, offset)) as Array<{
      trace_id: string;
      prompt_name: string | null;
      version_tag: string | null;
      metadata_json: string | null;
      workspace_id: string;
      created_at: number;
    }>;

    return buildPaginatedResponse(
      items.map((t) => ({
        trace_id: t.trace_id,
        prompt_name: t.prompt_name,
        version_tag: t.version_tag,
        metadata: t.metadata_json ? JSON.parse(t.metadata_json) : {},
        created_at: t.created_at,
      })),
      total,
      page,
      limit,
    );
  }
}
