import { Router } from 'express';
import { EvaluationController } from '@controllers/promptmetrics-evaluation.controller';
import { authenticateApiKey } from '@middlewares/promptmetrics-auth.middleware';
import { rateLimitPerKey } from '@middlewares/rate-limit-per-key.middleware';
import { validateQuery } from '@middlewares/promptmetrics-query-validation.middleware';
import { paginationQuerySchema } from '@validation-schemas/promptmetrics-pagination.schema';

export function createEvaluationRoutes(): Router {
  const router = Router();
  const controller = new EvaluationController();

  router.use(authenticateApiKey);
  router.use(rateLimitPerKey());

  router.post('/v1/evaluations', (req, res) => controller.createEvaluation(req, res));
  router.get('/v1/evaluations', validateQuery(paginationQuerySchema), (req, res) =>
    controller.listEvaluations(req, res),
  );
  router.get('/v1/evaluations/:id', (req, res) => controller.getEvaluation(req, res));
  router.delete('/v1/evaluations/:id', (req, res) => controller.deleteEvaluation(req, res));
  router.post('/v1/evaluations/:id/results', (req, res) => controller.createResult(req, res));
  router.get('/v1/evaluations/:id/results', validateQuery(paginationQuerySchema), (req, res) =>
    controller.listResults(req, res),
  );

  return router;
}
