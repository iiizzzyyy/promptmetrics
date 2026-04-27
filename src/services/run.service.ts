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
  async createRun(input: CreateRunInput, workspaceId: string = 'default'): Promise<Run> {
    const db = getDb();
    const runId = input.run_id || crypto.randomUUID();

    if (input.trace_id) {
      const trace = (await db
        .prepare('SELECT trace_id FROM traces WHERE trace_id = ? AND workspace_id = ?')
        .get(input.trace_id, workspaceId)) as { trace_id: string } | undefined;
      if (!trace) {
        throw AppError.notFound('Trace');
      }
    }

    await db
      .prepare(
        `INSERT INTO runs (run_id, workflow_name, status, input_json, output_json, trace_id, metadata_json, workspace_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        runId,
        input.workflow_name,
        input.status || 'running',
        input.input ? JSON.stringify(input.input) : null,
        input.output ? JSON.stringify(input.output) : null,
        input.trace_id || null,
        input.metadata ? JSON.stringify(input.metadata) : null,
        workspaceId,
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

  async getRun(runId: string, workspaceId: string = 'default'): Promise<Run> {
    const db = getDb();
    const run = (await db
      .prepare('SELECT * FROM runs WHERE run_id = ? AND workspace_id = ?')
      .get(runId, workspaceId)) as
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

  async updateRun(
    runId: string,
    input: UpdateRunInput,
    workspaceId: string = 'default',
  ): Promise<{ run_id: string; status: string }> {
    const db = getDb();
    const existing = (await db
      .prepare('SELECT run_id FROM runs WHERE run_id = ? AND workspace_id = ?')
      .get(runId, workspaceId)) as { run_id: string } | undefined;

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

    updates.push('updated_at = ?');
    params.push(Math.floor(Date.now() / 1000));
    params.push(runId);

    await db
      .prepare(`UPDATE runs SET ${updates.join(', ')} WHERE run_id = ? AND workspace_id = ?`)
      .run(...params, workspaceId);

    return { run_id: runId, status: 'updated' };
  }

  async listRuns(page: number, limit: number, workspaceId: string = 'default'): Promise<PaginatedResponse<Run>> {
    const db = getDb();
    const { offset } = parsePagination({ page: String(page), limit: String(limit) });
    const total = (
      (await db.prepare('SELECT COUNT(*) as c FROM runs WHERE workspace_id = ?').get(workspaceId)) as { c: number }
    ).c;
    const items = (await db
      .prepare('SELECT * FROM runs WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(workspaceId, limit, offset)) as Array<{
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
