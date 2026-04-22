import { Router } from 'express';
import { PromptController } from '@controllers/promptmetrics-prompt.controller';
import { PromptDriver } from '@drivers/promptmetrics-driver.interface';
import { authenticateApiKey, requireScope } from '@middlewares/promptmetrics-auth.middleware';
import { auditLog } from '@middlewares/promptmetrics-audit.middleware';
import { getDb } from '@models/promptmetrics-sqlite';

export function createPromptRoutes(driver: PromptDriver): Router {
  const router = Router();
  const controller = new PromptController(driver);

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

  router.get('/v1/prompts', (req, res) => void controller.listPrompts(req, res));
  router.get('/v1/prompts/search', (req, res) => void controller.listPrompts(req, res));
  router.get('/v1/prompts/:name', (req, res) => void controller.getPrompt(req, res));
  router.get('/v1/prompts/:name/versions', (req, res) => void controller.listVersions(req, res));
  router.post('/v1/prompts', requireScope('write'), auditLog('create_prompt'), (req, res) => void controller.createPrompt(req, res));

  router.get('/v1/audit-logs', requireScope('admin'), (req, res) => {
    const db = getDb();
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const start = (page - 1) * limit;

    const rows = db
      .prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?')
      .all(limit, start);
    const total = (db.prepare('SELECT COUNT(*) as count FROM audit_logs').get() as { count: number }).count;

    res.json({ items: rows, total, page, limit, totalPages: Math.ceil(total / limit) });
  });

  return router;
}
