import { parseIdParam } from '@utils/validation';
import { Request, Response } from 'express';
import { AppError } from '@errors/app.error';
import { ComplianceEngine } from '@services/compliance.engine';
import { scanComplianceSchema } from '@validation-schemas/compliance.schema';
import { getDb } from '@models/promptmetrics-sqlite';
import { parsePagination, buildPaginatedResponse, parseCountRow } from '@utils/pagination';
import { safeJsonParse } from '@utils/safe-json';

export class ComplianceController {
  private engine = new ComplianceEngine();

  async scan(req: Request, res: Response): Promise<void> {
    const { error, value } = scanComplianceSchema.validate(req.body, { abortEarly: false });
    if (error) {
      throw AppError.validationFailed(error.details.map((d) => d.message));
    }

    const workspaceId = req.workspaceId || 'default';
    const result = await this.engine.scanPrompt(value.prompt_name, value.version_tag, value.text, workspaceId);

    const fullResult = this.engine.score(value.text);

    res.status(200).json({
      score: result.score,
      riskLevel: fullResult.riskLevel,
      violations: result.violations,
    });
  }

  async listScores(req: Request, res: Response): Promise<void> {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const workspaceId = req.workspaceId || 'default';

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

    res.status(200).json(
      buildPaginatedResponse(
        items.map((item) => ({
          id: item.id,
          prompt_name: item.prompt_name,
          version_tag: item.version_tag,
          score: item.score,
          risk_level: item.score >= 90 ? 'low' : item.score >= 70 ? 'medium' : item.score >= 40 ? 'high' : 'critical',
          violations: safeJsonParse(item.violations_json, []),
          created_at: item.created_at,
        })),
        total,
        page,
        limit,
      ),
    );
  }

  async getScore(req: Request, res: Response): Promise<void> {
    const id = parseIdParam(req.params.id);
    const workspaceId = req.workspaceId || 'default';

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

    res.status(200).json({
      id: item.id,
      prompt_name: item.prompt_name,
      version_tag: item.version_tag,
      score: item.score,
      risk_level: item.score >= 90 ? 'low' : item.score >= 70 ? 'medium' : item.score >= 40 ? 'high' : 'critical',
      violations: safeJsonParse(item.violations_json, []),
      created_at: item.created_at,
    });
  }
}
