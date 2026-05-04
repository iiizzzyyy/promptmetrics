import { Router } from 'express';
import { ComplianceController } from '@controllers/compliance.controller';
import { authenticateApiKey, requireScope } from '@middlewares/promptmetrics-auth.middleware';
import { rateLimitPerKey } from '@middlewares/rate-limit-per-key.middleware';
import { auditLog } from '@middlewares/promptmetrics-audit.middleware';
import { validateQuery } from '@middlewares/promptmetrics-query-validation.middleware';
import { cursorPaginationQuerySchema } from '@validation-schemas/promptmetrics-pagination.schema';
import { validateBody } from '@middlewares/promptmetrics-body-validation.middleware';
import { scanComplianceSchema } from '@validation-schemas/compliance.schema';

export function createComplianceRoutes(): Router {
  const router = Router();
  const controller = new ComplianceController();

  router.use(authenticateApiKey);
  router.use(rateLimitPerKey());

  router.post(
    '/v1/compliance/scan',
    requireScope('write'),
    validateBody(scanComplianceSchema),
    auditLog('compliance_scan', (req) => ({ target_id: req.body?.prompt_name })),
    (req, res) => controller.scan(req, res),
  );
  router.get('/v1/compliance/scores', validateQuery(cursorPaginationQuerySchema), (req, res) =>
    controller.listScores(req, res),
  );
  router.get('/v1/compliance/scores/:id', (req, res) => controller.getScore(req, res));

  return router;
}
