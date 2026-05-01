import { Router } from 'express';
import { EvaluationController } from '@controllers/promptmetrics-evaluation.controller';
import { authenticateApiKey, requireScope } from '@middlewares/promptmetrics-auth.middleware';
import { auditLog } from '@middlewares/promptmetrics-audit.middleware';
import { rateLimitPerKey } from '@middlewares/rate-limit-per-key.middleware';
import { validateQuery } from '@middlewares/promptmetrics-query-validation.middleware';
import { paginationQuerySchema } from '@validation-schemas/promptmetrics-pagination.schema';

export function createEvaluationRoutes(): Router {
  const router = Router();
  const controller = new EvaluationController();

  router.use(authenticateApiKey);
  router.use(rateLimitPerKey());

  router.post('/v1/evaluations', requireScope('write'), auditLog('evaluation:create'), (req, res) =>
    controller.createEvaluation(req, res),
  );
  router.get('/v1/evaluations', validateQuery(paginationQuerySchema), (req, res) =>
    controller.listEvaluations(req, res),
  );
  router.get('/v1/evaluations/:id', (req, res) => controller.getEvaluation(req, res));
  router.delete('/v1/evaluations/:id', requireScope('write'), auditLog('evaluation:delete'), (req, res) =>
    controller.deleteEvaluation(req, res),
  );
  router.post('/v1/evaluations/:id/results', requireScope('write'), auditLog('evaluation:result'), (req, res) =>
    controller.createResult(req, res),
  );
  router.get('/v1/evaluations/:id/results', validateQuery(paginationQuerySchema), (req, res) =>
    controller.listResults(req, res),
  );
  router.post('/v1/evaluations/:id/run', requireScope('write'), auditLog('evaluation:run'), (req, res) =>
    controller.runEvaluation(req, res),
  );
  router.get('/v1/evaluations/:id/run', validateQuery(paginationQuerySchema), (req, res) =>
    controller.listRuns(req, res),
  );

  return router;
}
