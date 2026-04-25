import { Router } from 'express';
import { LogController } from '@controllers/promptmetrics-log.controller';
import { LogService } from '@services/log.service';
import { authenticateApiKey } from '@middlewares/promptmetrics-auth.middleware';
import { rateLimitPerKey } from '@middlewares/rate-limit-per-key.middleware';

export function createLogRoutes(): Router {
  const router = Router();
  const controller = new LogController(new LogService());

  router.use(authenticateApiKey);
  router.use(rateLimitPerKey());
  router.post('/v1/logs', (req, res) => controller.createLog(req, res));

  return router;
}
