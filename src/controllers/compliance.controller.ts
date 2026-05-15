import { parseIdParam } from '@utils/validation';
import { AppError } from '@errors/app.error';
import { Request, Response } from 'express';
import { ComplianceService } from '@services/compliance.service';
import { PromptService } from '@services/prompt.service';
import { createDriver } from '@drivers/promptmetrics-driver.factory';
import { createComplianceDriver } from '@drivers/compliance/compliance-driver.factory';

export class ComplianceController {
  private service = new ComplianceService(createComplianceDriver());
  private promptDriver = createDriver();
  private promptService = new PromptService(this.promptDriver);

  async scan(req: Request, res: Response): Promise<void> {
    const workspaceId = req.workspaceId || 'default';
    let text = req.body.text as string | undefined;
    let promptName = req.body.prompt_name as string | undefined;
    let versionTag = req.body.version_tag as string | undefined;

    // If text is not provided, fetch prompt content from storage
    if (!text && promptName) {
      const result = await this.promptService.getPrompt(workspaceId, promptName, versionTag, undefined, false);
      text = result.content.messages.map((m) => m.content).join('\n');
    }

    if (!text) {
      throw AppError.badRequest('Either "text" or "prompt_name" must be provided');
    }

    const result = await this.service.scanPrompt(
      promptName || 'direct-scan',
      versionTag || 'latest',
      text,
      workspaceId,
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
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
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
