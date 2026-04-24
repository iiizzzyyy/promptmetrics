import { Request, Response } from 'express';
import crypto from 'crypto';
import { AppError } from '@errors/app.error';
import { getDb } from '@models/promptmetrics-sqlite';
import { parsePagination, buildPaginatedResponse } from '@utils/pagination';
import { createRunSchema, updateRunSchema } from '@validation-schemas/promptmetrics-run.schema';

export class RunController {
  async createRun(req: Request, res: Response): Promise<void> {
    const { error, value } = createRunSchema.validate(req.body, { abortEarly: false });
    if (error) {
      throw AppError.validationFailed(error.details.map((d) => d.message));
    }

    const db = getDb();
    const runId = value.run_id || crypto.randomUUID();

    if (value.trace_id) {
      const trace = db.prepare('SELECT trace_id FROM traces WHERE trace_id = ?').get(value.trace_id) as
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
      value.workflow_name,
      value.status || 'running',
      value.input ? JSON.stringify(value.input) : null,
      value.output ? JSON.stringify(value.output) : null,
      value.trace_id || null,
      value.metadata ? JSON.stringify(value.metadata) : null,
    );

    res.status(201).json({
      run_id: runId,
      workflow_name: value.workflow_name,
      status: value.status || 'running',
    });
  }

  async getRun(req: Request, res: Response): Promise<void> {
    const runId = req.params.run_id as string;

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

    res.status(200).json({
      run_id: run.run_id,
      workflow_name: run.workflow_name,
      status: run.status,
      input: run.input_json ? JSON.parse(run.input_json) : null,
      output: run.output_json ? JSON.parse(run.output_json) : null,
      trace_id: run.trace_id,
      metadata: run.metadata_json ? JSON.parse(run.metadata_json) : {},
      created_at: run.created_at,
      updated_at: run.updated_at,
    });
  }

  async updateRun(req: Request, res: Response): Promise<void> {
    const runId = req.params.run_id as string;
    const { error, value } = updateRunSchema.validate(req.body, { abortEarly: false });
    if (error) {
      throw AppError.validationFailed(error.details.map((d) => d.message));
    }

    const db = getDb();
    const existing = db.prepare('SELECT run_id FROM runs WHERE run_id = ?').get(runId) as
      | { run_id: string }
      | undefined;

    if (!existing) {
      throw AppError.notFound('Run');
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (value.status !== undefined) {
      updates.push('status = ?');
      params.push(value.status);
    }
    if (value.output !== undefined) {
      updates.push('output_json = ?');
      params.push(JSON.stringify(value.output));
    }
    if (value.metadata !== undefined) {
      updates.push('metadata_json = ?');
      params.push(JSON.stringify(value.metadata));
    }

    if (updates.length === 0) {
      res.status(200).json({ message: 'No changes' });
      return;
    }

    updates.push('updated_at = unixepoch()');
    params.push(runId);

    db.prepare(`UPDATE runs SET ${updates.join(', ')} WHERE run_id = ?`).run(...params);

    res.status(200).json({ run_id: runId, status: 'updated' });
  }

  async listRuns(req: Request, res: Response): Promise<void> {
    const { page, limit, offset } = parsePagination(req.query);

    const db = getDb();
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

    res.status(200).json(
      buildPaginatedResponse(
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
      ),
    );
  }
}
