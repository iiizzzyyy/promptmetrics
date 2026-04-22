import { Router } from 'express';
import { RunController } from '@controllers/promptmetrics-run.controller';
import { authenticateApiKey } from '@middlewares/promptmetrics-auth.middleware';

export function createRunRoutes(): Router {
  const router = Router();
  const controller = new RunController();

  router.use(authenticateApiKey);
  router.post('/v1/runs', (req, res) => void controller.createRun(req, res));
  router.get('/v1/runs', (req, res) => void controller.listRuns(req, res));
  router.get('/v1/runs/:run_id', (req, res) => void controller.getRun(req, res));
  router.patch('/v1/runs/:run_id', (req, res) => void controller.updateRun(req, res));

  return router;
}
