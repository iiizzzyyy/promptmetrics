import { AppError } from '@errors/app.error';
import { ComplianceDriver, ComplianceScanResponse } from '@drivers/compliance/compliance-driver.interface';
import { Violation } from '@services/compliance.engine';
import { getDb } from '@models/promptmetrics-sqlite';
import { safeJsonParse } from '@utils/safe-json';

export interface ComplianceScore {
  id: number;
  prompt_name: string;
  version_tag: string;
  score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  violations: Violation[];
  provider: string;
  flagged: boolean;
  categories: string[];
  created_at: number;
}

export interface CursorPaginatedComplianceResponse {
  items: ComplianceScore[];
  nextCursor: string | null;
  total: number;
}

export class ComplianceService {
  private driver: ComplianceDriver;

  constructor(driver: ComplianceDriver) {
    this.driver = driver;
  }

  async listScores(
    limit: number,
    cursor?: string,
    workspaceId: string = 'default',
  ): Promise<CursorPaginatedComplianceResponse> {
    const db = getDb();
    const effectiveLimit = Math.min(200, Math.max(1, limit || 50));

    const totalRow = (await db
      .prepare('SELECT COUNT(*) as c FROM compliance_scores WHERE workspace_id = ?')
      .get(workspaceId)) as { c: number } | undefined;
    const total = totalRow?.c ?? 0;

    // Cursor format: base64("created_at:id")
    let cursorCreatedAt: number | undefined;
    let cursorId: number | undefined;
    if (cursor) {
      const decoded = Buffer.from(cursor, 'base64').toString('utf8');
      const parts = decoded.split(':');
      cursorCreatedAt = parseInt(parts[0], 10);
      cursorId = parseInt(parts[1], 10);
    }

    let sql: string;
    let params: unknown[];
    const dialect = db.dialect;

    if (cursorCreatedAt !== undefined && cursorId !== undefined) {
      if (dialect === 'postgres') {
        // PostgreSQL supports row-value comparisons: (created_at, id) < (?, ?)
        sql = 'SELECT * FROM compliance_scores WHERE workspace_id = ? AND (created_at, id) < (?, ?) ORDER BY created_at DESC, id DESC LIMIT ?';
        params = [workspaceId, cursorCreatedAt, cursorId, effectiveLimit + 1];
      } else {
        // SQLite doesn't support row-value comparisons, so use equivalent OR logic
        sql = 'SELECT * FROM compliance_scores WHERE workspace_id = ? AND (created_at < ? OR (created_at = ? AND id < ?)) ORDER BY created_at DESC, id DESC LIMIT ?';
        params = [workspaceId, cursorCreatedAt, cursorCreatedAt, cursorId, effectiveLimit + 1];
      }
    } else {
      sql = 'SELECT * FROM compliance_scores WHERE workspace_id = ? ORDER BY created_at DESC, id DESC LIMIT ?';
      params = [workspaceId, effectiveLimit + 1];
    }

    const items = (await db.prepare(sql).all(...params)) as Array<{
      id: number;
      prompt_name: string;
      version_tag: string;
      score: number;
      violations_json: string;
      provider: string;
      workspace_id: string;
      created_at: number;
    }>;

    const hasMore = items.length > effectiveLimit;
    const trimmed = hasMore ? items.slice(0, effectiveLimit) : items;
    const last = trimmed[trimmed.length - 1];
    const nextCursor =
      hasMore && last
        ? Buffer.from(`${last.created_at}:${last.id}`, 'utf8').toString('base64')
        : null;

    return {
      items: trimmed.map((item) => {
        const violations = safeJsonParse<Violation[]>(item.violations_json, []);
        return {
          id: item.id,
          prompt_name: item.prompt_name,
          version_tag: item.version_tag,
          score: item.score,
          risk_level: this.computeRiskLevel(item.score),
          violations,
          provider: item.provider ?? 'stub',
          flagged: item.score < 90,
          categories: [...new Set(violations.map((v) => v.category))],
          created_at: item.created_at,
        };
      }),
      nextCursor,
      total,
    };
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
          provider: string;
          workspace_id: string;
          created_at: number;
        }
      | undefined;

    if (!item) {
      throw AppError.notFound('Compliance score');
    }

    const violations = safeJsonParse<Violation[]>(item.violations_json, []);

    return {
      id: item.id,
      prompt_name: item.prompt_name,
      version_tag: item.version_tag,
      score: item.score,
      risk_level: this.computeRiskLevel(item.score),
      violations,
      provider: item.provider ?? 'stub',
      flagged: item.score < 90,
      categories: [...new Set(violations.map((v) => v.category))],
      created_at: item.created_at,
    };
  }

  async scanPrompt(
    promptName: string,
    versionTag: string,
    text: string,
    workspaceId: string = 'default',
  ): Promise<ComplianceScanResponse> {
    const result = await this.driver.scan({ text, workspaceId });
    const db = getDb();
    await db
      .prepare(
        `INSERT INTO compliance_scores (prompt_name, version_tag, score, violations_json, provider, workspace_id, created_at, raw_response_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        promptName,
        versionTag,
        result.score,
        JSON.stringify(result.findings),
        result.provider,
        workspaceId,
        Math.floor(Date.now() / 1000),
        result.rawResponse ? JSON.stringify(result.rawResponse) : null,
      );

    return result;
  }

  private computeRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    return score >= 90 ? 'low' : score >= 70 ? 'medium' : score >= 40 ? 'high' : 'critical';
  }
}
