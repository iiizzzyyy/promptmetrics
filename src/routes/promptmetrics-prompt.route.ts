import { Router } from 'express';
import { PromptController } from '@controllers/promptmetrics-prompt.controller';
import { PromptService } from '@services/prompt.service';
import { PromptDriver } from '@drivers/promptmetrics-driver.interface';
import { authenticateApiKey, requireScope } from '@middlewares/promptmetrics-auth.middleware';
import { auditLog } from '@middlewares/promptmetrics-audit.middleware';
import { rateLimitPerKey } from '@middlewares/rate-limit-per-key.middleware';
import { validateQuery } from '@middlewares/promptmetrics-query-validation.middleware';
import { getDb } from '@models/promptmetrics-sqlite';
import { parsePagination, buildPaginatedResponse } from '@utils/pagination';
import { paginationQuerySchema } from '@validation-schemas/promptmetrics-pagination.schema';

export function createPromptRoutes(driver: PromptDriver): Router {
  const router = Router();
  const service = new PromptService(driver);
  const controller = new PromptController(service);

  router.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/health/deep', async (req, res) => {
    const checks: Record<string, string> = { sqlite: 'ok' };
    try {
      await driver.sync();
      checks.driver = 'ok';
    } catch {
      checks.driver = 'error';
    }
    const allOk = Object.values(checks).every((v) => v === 'ok');
    res.status(allOk ? 200 : 503).json({ status: allOk ? 'ok' : 'degraded', checks });
  });

  router.use(authenticateApiKey);
  router.use(rateLimitPerKey());

  router.get('/v1/prompts', validateQuery(paginationQuerySchema), (req, res) => controller.listPrompts(req, res));
  router.get('/v1/prompts/search', validateQuery(paginationQuerySchema), (req, res) =>
    controller.listPrompts(req, res),
  );
  router.get('/v1/prompts/:name', (req, res) => controller.getPrompt(req, res));
  router.get('/v1/prompts/:name/versions', validateQuery(paginationQuerySchema), (req, res) =>
    controller.listVersions(req, res),
  );
  router.post('/v1/prompts', requireScope('write'), auditLog('create_prompt'), (req, res) =>
    controller.createPrompt(req, res),
  );

  router.get('/v1/audit-logs', requireScope('admin'), validateQuery(paginationQuerySchema), async (req, res) => {
    const db = getDb();
    const { page, limit, offset } = parsePagination(req.query);
    const workspaceId = req.workspaceId || 'default';

    const rows = (await db
      .prepare('SELECT * FROM audit_logs WHERE workspace_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?')
      .all(workspaceId, limit, offset)) as unknown[];
    const total = (
      (await db.prepare('SELECT COUNT(*) as count FROM audit_logs WHERE workspace_id = ?').get(workspaceId)) as {
        count: number;
      }
    ).count;

    res.json(buildPaginatedResponse(rows, total, page, limit));
  });

  return router;
}
