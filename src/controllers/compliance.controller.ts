import { parseIdParam } from '@utils/validation';
import { Request, Response } from 'express';
import { ComplianceService } from '@services/compliance.service';
import { createComplianceDriver } from '@drivers/compliance/compliance-driver.factory';

export class ComplianceController {
  private service = new ComplianceService(createComplianceDriver());

  async scan(req: Request, res: Response): Promise<void> {
    const result = await this.service.scanPrompt(
      req.body.prompt_name,
      req.body.version_tag,
      req.body.text,
      req.workspaceId || 'default',
    );

    res.status(200).json({
      score: result.score,
      riskLevel: result.riskLevel,
      violations: result.findings,
      provider: result.provider,
      flagged: result.flagged,
      categories: result.categories,
    });
  }

  async listScores(req: Request, res: Response): Promise<void> {
    const limit = Number(req.query.limit) || 50;
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const workspaceId = req.workspaceId || 'default';

    const result = await this.service.listScores(limit, cursor, workspaceId);
    res.status(200).json(result);
  }

  async getScore(req: Request, res: Response): Promise<void> {
    const id = parseIdParam(req.params.id);
    const workspaceId = req.workspaceId || 'default';

    const item = await this.service.getScore(id, workspaceId);
    res.status(200).json(item);
  }
}
