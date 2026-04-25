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

  router.post('/v1/evaluations', (req, res, next) => controller.createEvaluation(req, res, next));
  router.get('/v1/evaluations', validateQuery(paginationQuerySchema), (req, res, next) =>
    controller.listEvaluations(req, res, next),
  );
  router.get('/v1/evaluations/:id', (req, res, next) => controller.getEvaluation(req, res, next));
  router.delete('/v1/evaluations/:id', (req, res, next) => controller.deleteEvaluation(req, res, next));
  router.post('/v1/evaluations/:id/results', (req, res, next) => controller.createResult(req, res, next));
  router.get('/v1/evaluations/:id/results', validateQuery(paginationQuerySchema), (req, res, next) =>
    controller.listResults(req, res, next),
  );

  return router;
}
