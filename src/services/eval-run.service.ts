import { AppError } from '@errors/app.error';
import { getDb } from '@models/promptmetrics-sqlite';
import { parsePagination, buildPaginatedResponse, PaginatedResponse, parseCountRow } from '@utils/pagination';

export interface EvalRun {
  id: number;
  evaluation_id: number;
  dataset_id?: number;
  status: 'running' | 'completed' | 'failed';
  score?: number;
  results_json?: string;
  created_at: number;
  workspace_id: string;
}

export class EvalRunService {
  async createRun(
    evaluationId: number,
    datasetId: number | undefined,
    workspaceId: string = 'default',
  ): Promise<EvalRun> {
    const db = getDb();
    const result = await db
      .prepare(
        `INSERT INTO eval_runs (evaluation_id, dataset_id, status, workspace_id)
         VALUES (?, ?, ?, ?)
         RETURNING id`,
      )
      .run(evaluationId, datasetId ?? null, 'running', workspaceId);

    const id = Number(result.lastInsertRowid);
    return this.getRun(id, workspaceId);
  }

  async completeRun(
    runId: number,
    score: number,
    resultsJson: string,
    workspaceId: string = 'default',
  ): Promise<EvalRun> {
    const db = getDb();
    const result = await db
      .prepare(
        `UPDATE eval_runs
         SET status = ?, score = ?, results_json = ?
         WHERE id = ? AND workspace_id = ?`,
      )
      .run('completed', score, resultsJson, runId, workspaceId);

    if (result.changes === 0) {
      throw AppError.notFound('Eval run');
    }

    return this.getRun(runId, workspaceId);
  }

  async failRun(runId: number, reason: string, workspaceId: string = 'default'): Promise<EvalRun> {
    const db = getDb();
    const result = await db
      .prepare(
        `UPDATE eval_runs
         SET status = ?, results_json = ?
         WHERE id = ? AND workspace_id = ?`,
      )
      .run('failed', JSON.stringify({ reason }), runId, workspaceId);

    if (result.changes === 0) {
      throw AppError.notFound('Eval run');
    }

    return this.getRun(runId, workspaceId);
  }

  async listRuns(
    evaluationId: number,
    page: number,
    limit: number,
    workspaceId: string = 'default',
  ): Promise<PaginatedResponse<EvalRun>> {
    const db = getDb();
    const { offset } = parsePagination({ page: String(page), limit: String(limit) });
    const total = parseCountRow(
      await db
        .prepare('SELECT COUNT(*) as c FROM eval_runs WHERE evaluation_id = ? AND workspace_id = ?')
        .get(evaluationId, workspaceId),
    );
    const items = (await db
      .prepare(
        'SELECT * FROM eval_runs WHERE evaluation_id = ? AND workspace_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      )
      .all(evaluationId, workspaceId, limit, offset)) as Array<{
      id: number;
      evaluation_id: number;
      dataset_id: number | null;
      status: string;
      score: number | null;
      results_json: string | null;
      created_at: number;
      workspace_id: string;
    }>;

    return buildPaginatedResponse(
      items.map((r) => this.mapRow(r)),
      total,
      page,
      limit,
    );
  }

  private async getRun(runId: number, workspaceId: string): Promise<EvalRun> {
    const db = getDb();
    const row = (await db
      .prepare('SELECT * FROM eval_runs WHERE id = ? AND workspace_id = ?')
      .get(runId, workspaceId)) as
      | {
          id: number;
          evaluation_id: number;
          dataset_id: number | null;
          status: string;
          score: number | null;
          results_json: string | null;
          created_at: number;
          workspace_id: string;
        }
      | undefined;

    if (!row) {
      throw AppError.notFound('Eval run');
    }

    return this.mapRow(row);
  }

  private mapRow(row: {
    id: number;
    evaluation_id: number;
    dataset_id: number | null;
    status: string;
    score: number | null;
    results_json: string | null;
    created_at: number;
    workspace_id: string;
  }): EvalRun {
    return {
      id: row.id,
      evaluation_id: row.evaluation_id,
      dataset_id: row.dataset_id ?? undefined,
      status: row.status as 'running' | 'completed' | 'failed',
      score: row.score ?? undefined,
      results_json: row.results_json ?? undefined,
      created_at: row.created_at,
      workspace_id: row.workspace_id,
    };
  }
}
