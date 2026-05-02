import { AppError } from '@errors/app.error';
import { ComplianceEngine, Violation } from '@services/compliance.engine';
import { getDb } from '@models/promptmetrics-sqlite';
import { safeJsonParse } from '@utils/safe-json';
import { parsePagination, buildPaginatedResponse, PaginatedResponse, parseCountRow } from '@utils/pagination';

export interface ComplianceScore {
  id: number;
  prompt_name: string;
  version_tag: string;
  score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  violations: Violation[];
  created_at: number;
}

export class ComplianceService {
  private engine = new ComplianceEngine();

  async listScores(
    page: number,
    limit: number,
    workspaceId: string = 'default',
  ): Promise<PaginatedResponse<ComplianceScore>> {
    const db = getDb();
    const { offset } = parsePagination({ page: String(page), limit: String(limit) });
    const total = parseCountRow(
      await db.prepare('SELECT COUNT(*) as c FROM compliance_scores WHERE workspace_id = ?').get(workspaceId),
    );

    const items = (await db
      .prepare('SELECT * FROM compliance_scores WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(workspaceId, limit, offset)) as Array<{
      id: number;
      prompt_name: string;
      version_tag: string;
      score: number;
      violations_json: string;
      workspace_id: string;
      created_at: number;
    }>;

    return buildPaginatedResponse(
      items.map((item) => ({
        id: item.id,
        prompt_name: item.prompt_name,
        version_tag: item.version_tag,
        score: item.score,
        risk_level: this.computeRiskLevel(item.score),
        violations: safeJsonParse(item.violations_json, []),
        created_at: item.created_at,
      })),
      total,
      page,
      limit,
    );
  }

  async getScore(id: number, workspaceId: string = 'default'): Promise<ComplianceScore> {
    const db = getDb();
    const item = (await db
      .prepare('SELECT * FROM compliance_scores WHERE id = ? AND workspace_id = ?')
      .get(id, workspaceId)) as
      | {
          id: number;
          prompt_name: string;
          version_tag: string;
          score: number;
          violations_json: string;
          workspace_id: string;
          created_at: number;
        }
      | undefined;

    if (!item) {
      throw AppError.notFound('Compliance score');
    }

    return {
      id: item.id,
      prompt_name: item.prompt_name,
      version_tag: item.version_tag,
      score: item.score,
      risk_level: this.computeRiskLevel(item.score),
      violations: safeJsonParse(item.violations_json, []),
      created_at: item.created_at,
    };
  }

  async scanPrompt(
    promptName: string,
    versionTag: string,
    text: string,
    workspaceId: string = 'default',
  ): Promise<{ score: number; riskLevel: string; violations: Violation[] }> {
    const result = this.engine.score(text);
    const db = getDb();
    await db
      .prepare(
        `INSERT INTO compliance_scores (prompt_name, version_tag, score, violations_json, workspace_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        promptName,
        versionTag,
        result.score,
        JSON.stringify(result.violations),
        workspaceId,
        Math.floor(Date.now() / 1000),
      );

    return { score: result.score, riskLevel: result.riskLevel, violations: result.violations };
  }

  private computeRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    return score >= 90 ? 'low' : score >= 70 ? 'medium' : score >= 40 ? 'high' : 'critical';
  }
}
