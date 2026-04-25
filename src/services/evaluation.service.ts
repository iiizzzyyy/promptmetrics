import { AppError } from '@errors/app.error';
import { getDb } from '@models/promptmetrics-sqlite';
import { parsePagination, buildPaginatedResponse, PaginatedResponse } from '@utils/pagination';

export interface Evaluation {
  id: number;
  name: string;
  description?: string;
  prompt_name: string;
  version_tag?: string;
  criteria?: Record<string, unknown>;
  created_at: number;
}

export interface EvaluationResult {
  id: number;
  evaluation_id: number;
  run_id?: string;
  score?: number;
  metadata?: Record<string, unknown>;
  created_at: number;
}

export interface CreateEvaluationInput {
  name: string;
  description?: string;
  prompt_name: string;
  version_tag?: string;
  criteria?: Record<string, unknown>;
}

export interface CreateEvaluationResultInput {
  run_id?: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export class EvaluationService {
  async createEvaluation(input: CreateEvaluationInput, workspaceId: string = 'default'): Promise<Evaluation> {
    const db = getDb();
    const result = await db
      .prepare(
        `INSERT INTO evaluations (name, description, prompt_name, version_tag, criteria_json, workspace_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.name,
        input.description ?? null,
        input.prompt_name,
        input.version_tag ?? null,
        input.criteria ? JSON.stringify(input.criteria) : null,
        workspaceId,
      );

    return {
      id: Number(result.lastInsertRowid),
      name: input.name,
      description: input.description,
      prompt_name: input.prompt_name,
      version_tag: input.version_tag,
      criteria: input.criteria,
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  async listEvaluations(
    page: number,
    limit: number,
    workspaceId: string = 'default',
  ): Promise<PaginatedResponse<Evaluation>> {
    const db = getDb();
    const { offset } = parsePagination({ page: String(page), limit: String(limit) });
    const total = (
      (await db.prepare('SELECT COUNT(*) as c FROM evaluations WHERE workspace_id = ?').get(workspaceId)) as {
        c: number;
      }
    ).c;
    const items = (await db
      .prepare('SELECT * FROM evaluations WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(workspaceId, limit, offset)) as Array<{
      id: number;
      name: string;
      description: string | null;
      prompt_name: string;
      version_tag: string | null;
      criteria_json: string | null;
      created_at: number;
    }>;

    return buildPaginatedResponse(
      items.map((e) => ({
        id: e.id,
        name: e.name,
        description: e.description ?? undefined,
        prompt_name: e.prompt_name,
        version_tag: e.version_tag ?? undefined,
        criteria: e.criteria_json ? JSON.parse(e.criteria_json) : undefined,
        created_at: e.created_at,
      })),
      total,
      page,
      limit,
    );
  }

  async getEvaluation(id: number, workspaceId: string = 'default'): Promise<Evaluation> {
    const db = getDb();
    const evaluation = (await db
      .prepare('SELECT * FROM evaluations WHERE id = ? AND workspace_id = ?')
      .get(id, workspaceId)) as
      | {
          id: number;
          name: string;
          description: string | null;
          prompt_name: string;
          version_tag: string | null;
          criteria_json: string | null;
          created_at: number;
        }
      | undefined;

    if (!evaluation) {
      throw AppError.notFound('Evaluation');
    }

    return {
      id: evaluation.id,
      name: evaluation.name,
      description: evaluation.description ?? undefined,
      prompt_name: evaluation.prompt_name,
      version_tag: evaluation.version_tag ?? undefined,
      criteria: evaluation.criteria_json ? JSON.parse(evaluation.criteria_json) : undefined,
      created_at: evaluation.created_at,
    };
  }

  async deleteEvaluation(id: number, workspaceId: string = 'default'): Promise<void> {
    const db = getDb();
    await db
      .prepare('DELETE FROM evaluation_results WHERE evaluation_id = ? AND workspace_id = ?')
      .run(id, workspaceId);
    const result = await db.prepare('DELETE FROM evaluations WHERE id = ? AND workspace_id = ?').run(id, workspaceId);
    if (result.changes === 0) {
      throw AppError.notFound('Evaluation');
    }
  }

  async createResult(
    evaluationId: number,
    input: CreateEvaluationResultInput,
    workspaceId: string = 'default',
  ): Promise<EvaluationResult> {
    const db = getDb();
    const result = await db
      .prepare(
        `INSERT INTO evaluation_results (evaluation_id, run_id, score, metadata_json, workspace_id)
       VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        evaluationId,
        input.run_id ?? null,
        input.score ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null,
        workspaceId,
      );

    return {
      id: Number(result.lastInsertRowid),
      evaluation_id: evaluationId,
      run_id: input.run_id,
      score: input.score,
      metadata: input.metadata,
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  async listResults(
    evaluationId: number,
    page: number,
    limit: number,
    workspaceId: string = 'default',
  ): Promise<PaginatedResponse<EvaluationResult>> {
    const db = getDb();
    const { offset } = parsePagination({ page: String(page), limit: String(limit) });
    const total = (
      (await db
        .prepare('SELECT COUNT(*) as c FROM evaluation_results WHERE evaluation_id = ? AND workspace_id = ?')
        .get(evaluationId, workspaceId)) as { c: number }
    ).c;
    const items = (await db
      .prepare(
        'SELECT * FROM evaluation_results WHERE evaluation_id = ? AND workspace_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      )
      .all(evaluationId, workspaceId, limit, offset)) as Array<{
      id: number;
      evaluation_id: number;
      run_id: string | null;
      score: number | null;
      metadata_json: string | null;
      created_at: number;
    }>;

    return buildPaginatedResponse(
      items.map((r) => ({
        id: r.id,
        evaluation_id: r.evaluation_id,
        run_id: r.run_id ?? undefined,
        score: r.score ?? undefined,
        metadata: r.metadata_json ? JSON.parse(r.metadata_json) : undefined,
        created_at: r.created_at,
      })),
      total,
      page,
      limit,
    );
  }
}
