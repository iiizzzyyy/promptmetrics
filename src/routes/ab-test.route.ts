import { Router } from 'express';
import { ABTestController } from '@controllers/ab-test.controller';
import { authenticateApiKey, requireScope } from '@middlewares/promptmetrics-auth.middleware';
import { auditLog } from '@middlewares/promptmetrics-audit.middleware';
import { rateLimitPerKey } from '@middlewares/rate-limit-per-key.middleware';
import { validateQuery } from '@middlewares/promptmetrics-query-validation.middleware';
import { paginationQuerySchema } from '@validation-schemas/promptmetrics-pagination.schema';

export function createABTestRoutes(): Router {
  const router = Router();
  const controller = new ABTestController();

  router.use(authenticateApiKey);
  router.use(rateLimitPerKey());

  router.post(
    '/v1/ab-tests',
    requireScope('write'),
    auditLog('create_ab_test', (req) => ({ target_id: req.body?.name })),
    (req, res) => controller.createTest(req, res),
  );
  router.get('/v1/ab-tests', validateQuery(paginationQuerySchema), (req, res) => controller.listTests(req, res));
  router.get('/v1/ab-tests/:id', (req, res) => controller.getTest(req, res));
  router.post(
    '/v1/ab-tests/:id/run',
    requireScope('write'),
    auditLog('run_ab_test', (req) => ({ target_id: Array.isArray(req.params.id) ? req.params.id[0] : req.params.id })),
    (req, res) => controller.runTest(req, res),
  );
  router.post(
    '/v1/ab-tests/:id/promote',
    requireScope('write'),
    auditLog('promote_ab_test', (req) => ({
      target_id: Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
    })),
    (req, res) => controller.promoteWinner(req, res),
  );
  router.delete(
    '/v1/ab-tests/:id',
    requireScope('write'),
    auditLog('delete_ab_test', (req) => ({
      target_id: Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
    })),
    (req, res) => controller.deleteTest(req, res),
  );

  return router;
}
