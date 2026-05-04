import { AppError } from '@errors/app.error';
import { getDb } from '@models/promptmetrics-sqlite';
import { parsePagination, buildPaginatedResponse, PaginatedResponse, parseCountRow } from '@utils/pagination';
import { auditLogService } from './audit-log.service';
import { LabelService } from './label.service';
import { ABTestEngine, sampleVariance } from './ab-test.engine';
import { EvaluationService } from './evaluation.service';

export interface ABTest {
  id: number;
  prompt_name: string;
  version_a: string;
  version_b: string;
  dataset_id: number | null;
  evaluation_id: number | null;
  status: 'running' | 'completed' | 'cancelled';
  metric: string;
  created_at: number;
  updated_at: number;
  workspace_id: string;
}

export interface ABTestResult {
  id: number;
  ab_test_id: number;
  version_a_score: number | null;
  version_b_score: number | null;
  p_value: number | null;
  winner: string | null;
  ci_lower: number | null;
  ci_upper: number | null;
  stddev_a: number | null;
  stddev_b: number | null;
  created_at: number;
  workspace_id: string;
}

export interface ABTestWithResult extends ABTest {
  latest_result?: ABTestResult;
}

export interface CreateABTestInput {
  prompt_name: string;
  version_a: string;
  version_b: string;
  dataset_id?: number;
  evaluation_id?: number;
  metric?: string;
}

export class ABTestService {
  private engine = new ABTestEngine();

  constructor(
    private labelService = new LabelService(),
    private evaluationService = new EvaluationService(),
  ) {}

  async createTest(input: CreateABTestInput, workspaceId: string = 'default'): Promise<ABTest> {
    const db = getDb();
    const insertResult = await db
      .prepare(
        `INSERT INTO ab_tests (prompt_name, version_a, version_b, dataset_id, evaluation_id, metric, workspace_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.prompt_name,
        input.version_a,
        input.version_b,
        input.dataset_id ?? null,
        input.evaluation_id ?? null,
        input.metric ?? 'latency',
        workspaceId,
      );

    const test = (await db
      .prepare('SELECT * FROM ab_tests WHERE id = ? AND workspace_id = ?')
      .get(insertResult.lastInsertRowid, workspaceId)) as ABTest | undefined;

    if (!test) {
      throw AppError.internal('Failed to create A/B test');
    }

    return test;
  }

  async listTests(page: number, limit: number, workspaceId: string = 'default'): Promise<PaginatedResponse<ABTest>> {
    const db = getDb();
    const { offset } = parsePagination({ page: String(page), limit: String(limit) });
    const total = parseCountRow(
      await db.prepare('SELECT COUNT(*) as c FROM ab_tests WHERE workspace_id = ?').get(workspaceId),
    );

    const items = (await db
      .prepare('SELECT * FROM ab_tests WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(workspaceId, limit, offset)) as ABTest[];

    return buildPaginatedResponse(items, total, page, limit);
  }

  async getTest(id: number, workspaceId: string = 'default'): Promise<ABTestWithResult> {
    const db = getDb();
    const test = (await db.prepare('SELECT * FROM ab_tests WHERE id = ? AND workspace_id = ?').get(id, workspaceId)) as
      | ABTest
      | undefined;

    if (!test) {
      throw AppError.notFound('A/B test');
    }

    const result = (await db
      .prepare(
        'SELECT * FROM ab_test_results WHERE ab_test_id = ? AND workspace_id = ? ORDER BY created_at DESC LIMIT 1',
      )
      .get(id, workspaceId)) as ABTestResult | undefined;

    return {
      ...test,
      latest_result: result,
    };
  }

  async runTest(
    id: number,
    workspaceId: string = 'default',
    scoresA?: number[],
    scoresB?: number[],
  ): Promise<ABTestResult> {
    const db = getDb();
    const test = (await db.prepare('SELECT * FROM ab_tests WHERE id = ? AND workspace_id = ?').get(id, workspaceId)) as
      | ABTest
      | undefined;

    if (!test) {
      throw AppError.notFound('A/B test');
    }

    let finalScoresA = scoresA;
    let finalScoresB = scoresB;

    if (!finalScoresA || !finalScoresB) {
      if (test.evaluation_id) {
        finalScoresA = await this.evaluationService.getResultsForVersion(
          test.evaluation_id,
          test.prompt_name,
          test.version_a,
          workspaceId,
        );
        finalScoresB = await this.evaluationService.getResultsForVersion(
          test.evaluation_id,
          test.prompt_name,
          test.version_b,
          workspaceId,
        );
      }

      if (!finalScoresA || !finalScoresB || finalScoresA.length === 0 || finalScoresB.length === 0) {
        throw AppError.badRequest('Insufficient scores to run this A/B test');
      }
    }

    const metric = test.metric as 'latency' | 'cost' | 'win_rate';
    const analysis = this.engine.analyzeABTest(finalScoresA, finalScoresB, metric);

    const meanA = finalScoresA.reduce((s, v) => s + v, 0) / finalScoresA.length;
    const meanB = finalScoresB.reduce((s, v) => s + v, 0) / finalScoresB.length;
    const stddevA = Math.sqrt(sampleVariance(finalScoresA));
    const stddevB = Math.sqrt(sampleVariance(finalScoresB));

    const insertResult = await db
      .prepare(
        `INSERT INTO ab_test_results (ab_test_id, version_a_score, version_b_score, p_value, winner, ci_lower, ci_upper, stddev_a, stddev_b, workspace_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        meanA,
        meanB,
        analysis.pValue,
        analysis.winner,
        analysis.ciLower,
        analysis.ciUpper,
        stddevA,
        stddevB,
        workspaceId,
      );

    const now = Math.floor(Date.now() / 1000);
    await db
      .prepare('UPDATE ab_tests SET status = ?, updated_at = ? WHERE id = ? AND workspace_id = ?')
      .run('completed', now, id, workspaceId);

    const inserted = (await db
      .prepare('SELECT * FROM ab_test_results WHERE id = ? AND workspace_id = ?')
      .get(insertResult.lastInsertRowid, workspaceId)) as ABTestResult | undefined;

    if (!inserted) {
      throw AppError.internal('Failed to create A/B test result');
    }

    return inserted;
  }

  async promoteWinner(
    id: number,
    workspaceId: string = 'default',
    apiKeyName: string = 'unknown',
    ipAddress: string = 'unknown',
  ): Promise<{ winner: 'A' | 'B' | 'tie'; version: string | null }> {
    const db = getDb();

    return db.transaction(async () => {
      const test = (await db
        .prepare('SELECT * FROM ab_tests WHERE id = ? AND workspace_id = ?')
        .get(id, workspaceId)) as ABTest | undefined;

      if (!test) {
        throw AppError.notFound('A/B test');
      }

      const result = (await db
        .prepare(
          'SELECT * FROM ab_test_results WHERE ab_test_id = ? AND workspace_id = ? ORDER BY created_at DESC LIMIT 1',
        )
        .get(id, workspaceId)) as ABTestResult | undefined;

      if (!result) {
        throw AppError.badRequest('No results available for this A/B test');
      }

      const winner = result.winner as 'A' | 'B' | 'tie' | null;
      if (!winner) {
        throw AppError.badRequest('No winner determined for this A/B test');
      }

      const version = winner === 'A' ? test.version_a : winner === 'B' ? test.version_b : null;
      const now = Math.floor(Date.now() / 1000);

      if (version) {
        const promptRow = (await db
          .prepare(
            "SELECT id FROM prompts WHERE name = ? AND version_tag = ? AND workspace_id = ? AND status = 'active'",
          )
          .get(test.prompt_name, version, workspaceId)) as { id: number } | undefined;

        if (promptRow) {
          await db
            .prepare('UPDATE prompts SET active_version_id = ? WHERE name = ? AND workspace_id = ?')
            .run(promptRow.id, test.prompt_name, workspaceId);
        }

        await db
          .prepare('UPDATE ab_tests SET promoted_version = ?, promoted_at = ? WHERE id = ? AND workspace_id = ?')
          .run(version, now, id, workspaceId);

        await this.labelService.createLabel(
          test.prompt_name,
          { name: 'production', version_tag: version },
          workspaceId,
        );

        auditLogService.enqueue({
          action: 'promote_ab_test',
          prompt_name: test.prompt_name,
          version_tag: version,
          target_id: String(id),
          api_key_name: apiKeyName,
          ip_address: ipAddress,
          workspace_id: workspaceId,
        });
      }

      return { winner, version };
    });
  }

  async deleteTest(id: number, workspaceId: string = 'default'): Promise<void> {
    const db = getDb();
    await db.prepare('DELETE FROM ab_test_results WHERE ab_test_id = ? AND workspace_id = ?').run(id, workspaceId);

    const result = await db.prepare('DELETE FROM ab_tests WHERE id = ? AND workspace_id = ?').run(id, workspaceId);

    if (result.changes === 0) {
      throw AppError.notFound('A/B test');
    }
  }
}
