import { AppError } from '@errors/app.error';
import { getDb } from '@models/promptmetrics-sqlite';
import { parsePagination, buildPaginatedResponse, PaginatedResponse, parseCountRow } from '@utils/pagination';
import { LabelService } from './label.service';
import { ABTestEngine } from './ab-test.engine';

export interface ABTest {
  id: number;
  prompt_name: string;
  version_a: string;
  version_b: string;
  dataset_id: number | null;
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
  metric?: string;
}

export class ABTestService {
  private engine = new ABTestEngine();

  constructor(private labelService = new LabelService()) {}

  async createTest(input: CreateABTestInput, workspaceId: string = 'default'): Promise<ABTest> {
    const db = getDb();
    const insertResult = await db
      .prepare(
        `INSERT INTO ab_tests (prompt_name, version_a, version_b, dataset_id, metric, workspace_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.prompt_name,
        input.version_a,
        input.version_b,
        input.dataset_id ?? null,
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
    scoresA: number[],
    scoresB: number[],
  ): Promise<ABTestResult> {
    const db = getDb();
    const test = (await db.prepare('SELECT * FROM ab_tests WHERE id = ? AND workspace_id = ?').get(id, workspaceId)) as
      | ABTest
      | undefined;

    if (!test) {
      throw AppError.notFound('A/B test');
    }

    const metric = test.metric as 'latency' | 'cost' | 'win_rate';
    const analysis = this.engine.analyzeABTest(scoresA, scoresB, metric);

    const meanA = scoresA.reduce((s, v) => s + v, 0) / scoresA.length;
    const meanB = scoresB.reduce((s, v) => s + v, 0) / scoresB.length;

    const insertResult = await db
      .prepare(
        `INSERT INTO ab_test_results (ab_test_id, version_a_score, version_b_score, p_value, winner, workspace_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, meanA, meanB, analysis.pValue, analysis.winner, workspaceId);

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
        await db
          .prepare('UPDATE ab_tests SET promoted_version = ?, promoted_at = ? WHERE id = ? AND workspace_id = ?')
          .run(version, now, id, workspaceId);
        await this.labelService.createLabel(
          test.prompt_name,
          { name: 'production', version_tag: version },
          workspaceId,
        );
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
