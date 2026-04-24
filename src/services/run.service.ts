import crypto from 'crypto';
import { AppError } from '@errors/app.error';
import { getDb } from '@models/promptmetrics-sqlite';
import { parsePagination, buildPaginatedResponse, PaginatedResponse } from '@utils/pagination';

export interface Run {
  run_id: string;
  workflow_name: string;
  status: string;
  input: unknown | null;
  output: unknown | null;
  trace_id: string | null;
  metadata: Record<string, unknown>;
  created_at: number;
  updated_at: number;
}

export interface CreateRunInput {
  run_id?: string;
  workflow_name: string;
  status?: string;
  input?: unknown;
  output?: unknown;
  trace_id?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateRunInput {
  status?: string;
  output?: unknown;
  metadata?: Record<string, unknown>;
}

export class RunService {
  createRun(input: CreateRunInput): Run {
    const db = getDb();
    const runId = input.run_id || crypto.randomUUID();

    if (input.trace_id) {
      const trace = db.prepare('SELECT trace_id FROM traces WHERE trace_id = ?').get(input.trace_id) as
        | { trace_id: string }
        | undefined;
      if (!trace) {
        throw AppError.notFound('Trace');
      }
    }

    db.prepare(
      `INSERT INTO runs (run_id, workflow_name, status, input_json, output_json, trace_id, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      runId,
      input.workflow_name,
      input.status || 'running',
      input.input ? JSON.stringify(input.input) : null,
      input.output ? JSON.stringify(input.output) : null,
      input.trace_id || null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    );

    return {
      run_id: runId,
      workflow_name: input.workflow_name,
      status: input.status || 'running',
      input: input.input || null,
      output: input.output || null,
      trace_id: input.trace_id || null,
      metadata: input.metadata || {},
      created_at: Math.floor(Date.now() / 1000),
      updated_at: Math.floor(Date.now() / 1000),
    };
  }

  getRun(runId: string): Run {
    const db = getDb();
    const run = db.prepare('SELECT * FROM runs WHERE run_id = ?').get(runId) as
      | {
          run_id: string;
          workflow_name: string;
          status: string;
          input_json: string | null;
          output_json: string | null;
          trace_id: string | null;
          metadata_json: string | null;
          created_at: number;
          updated_at: number;
        }
      | undefined;

    if (!run) {
      throw AppError.notFound('Run');
    }

    return {
      run_id: run.run_id,
      workflow_name: run.workflow_name,
      status: run.status,
      input: run.input_json ? JSON.parse(run.input_json) : null,
      output: run.output_json ? JSON.parse(run.output_json) : null,
      trace_id: run.trace_id,
      metadata: run.metadata_json ? JSON.parse(run.metadata_json) : {},
      created_at: run.created_at,
      updated_at: run.updated_at,
    };
  }

  updateRun(runId: string, input: UpdateRunInput): { run_id: string; status: string } {
    const db = getDb();
    const existing = db.prepare('SELECT run_id FROM runs WHERE run_id = ?').get(runId) as
      | { run_id: string }
      | undefined;

    if (!existing) {
      throw AppError.notFound('Run');
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (input.status !== undefined) {
      updates.push('status = ?');
      params.push(input.status);
    }
    if (input.output !== undefined) {
      updates.push('output_json = ?');
      params.push(JSON.stringify(input.output));
    }
    if (input.metadata !== undefined) {
      updates.push('metadata_json = ?');
      params.push(JSON.stringify(input.metadata));
    }

    if (updates.length === 0) {
      return { run_id: runId, status: 'unchanged' };
    }

    updates.push('updated_at = unixepoch()');
    params.push(runId);

    db.prepare(`UPDATE runs SET ${updates.join(', ')} WHERE run_id = ?`).run(...params);

    return { run_id: runId, status: 'updated' };
  }

  listRuns(page: number, limit: number): PaginatedResponse<Run> {
    const db = getDb();
    const { offset } = parsePagination({ page: String(page), limit: String(limit) });
    const total = (db.prepare('SELECT COUNT(*) as c FROM runs').get() as { c: number }).c;
    const items = db
      .prepare('SELECT * FROM runs ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(limit, offset) as Array<{
      run_id: string;
      workflow_name: string;
      status: string;
      input_json: string | null;
      output_json: string | null;
      trace_id: string | null;
      metadata_json: string | null;
      created_at: number;
      updated_at: number;
    }>;

    return buildPaginatedResponse(
      items.map((r) => ({
        run_id: r.run_id,
        workflow_name: r.workflow_name,
        status: r.status,
        input: r.input_json ? JSON.parse(r.input_json) : null,
        output: r.output_json ? JSON.parse(r.output_json) : null,
        trace_id: r.trace_id,
        metadata: r.metadata_json ? JSON.parse(r.metadata_json) : {},
        created_at: r.created_at,
        updated_at: r.updated_at,
      })),
      total,
      page,
      limit,
    );
  }
}
