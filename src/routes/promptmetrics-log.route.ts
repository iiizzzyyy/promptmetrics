import { Router } from 'express';
import { LogController } from '@controllers/promptmetrics-log.controller';
import { authenticateApiKey } from '@middlewares/promptmetrics-auth.middleware';

export function createLogRoutes(): Router {
  const router = Router();
  const controller = new LogController();

  router.use(authenticateApiKey);
  router.post('/v1/logs', (req, res) => controller.createLog(req, res));

  return router;
}
