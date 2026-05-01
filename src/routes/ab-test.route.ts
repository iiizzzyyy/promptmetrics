import { Router } from 'express';
import { ABTestController } from '@controllers/ab-test.controller';
import { authenticateApiKey } from '@middlewares/promptmetrics-auth.middleware';
import { auditLog } from '@middlewares/promptmetrics-audit.middleware';
import { rateLimitPerKey } from '@middlewares/rate-limit-per-key.middleware';
import { validateQuery } from '@middlewares/promptmetrics-query-validation.middleware';
import { paginationQuerySchema } from '@validation-schemas/promptmetrics-pagination.schema';

export function createABTestRoutes(): Router {
  const router = Router();
  const controller = new ABTestController();

  router.use(authenticateApiKey);
  router.use(rateLimitPerKey());

  router.post('/v1/ab-tests', auditLog('create_ab_test'), (req, res) => controller.createTest(req, res));
  router.get('/v1/ab-tests', validateQuery(paginationQuerySchema), auditLog('list_ab_tests'), (req, res) =>
    controller.listTests(req, res),
  );
  router.get('/v1/ab-tests/:id', auditLog('get_ab_test'), (req, res) => controller.getTest(req, res));
  router.post('/v1/ab-tests/:id/run', auditLog('run_ab_test'), (req, res) => controller.runTest(req, res));
  router.post('/v1/ab-tests/:id/promote', auditLog('promote_ab_test'), (req, res) =>
    controller.promoteWinner(req, res),
  );
  router.delete('/v1/ab-tests/:id', auditLog('delete_ab_test'), (req, res) => controller.deleteTest(req, res));

  return router;
}
