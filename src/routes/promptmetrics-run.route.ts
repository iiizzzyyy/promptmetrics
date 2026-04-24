import { Router } from 'express';
import { RunController } from '@controllers/promptmetrics-run.controller';
import { authenticateApiKey } from '@middlewares/promptmetrics-auth.middleware';
import { validateQuery } from '@middlewares/promptmetrics-query-validation.middleware';
import { paginationQuerySchema } from '@validation-schemas/promptmetrics-pagination.schema';

export function createRunRoutes(): Router {
  const router = Router();
  const controller = new RunController();

  router.use(authenticateApiKey);
  router.post('/v1/runs', (req, res) => controller.createRun(req, res));
  router.get('/v1/runs', validateQuery(paginationQuerySchema), (req, res) => controller.listRuns(req, res));
  router.get('/v1/runs/:run_id', (req, res) => controller.getRun(req, res));
  router.patch('/v1/runs/:run_id', (req, res) => controller.updateRun(req, res));

  return router;
}
