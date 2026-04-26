import { Router } from 'express';
import { LogController } from '@controllers/promptmetrics-log.controller';
import { LogService } from '@services/log.service';
import { authenticateApiKey } from '@middlewares/promptmetrics-auth.middleware';
import { rateLimitPerKey } from '@middlewares/rate-limit-per-key.middleware';
import { validateQuery } from '@middlewares/promptmetrics-query-validation.middleware';
import { paginationQuerySchema } from '@validation-schemas/promptmetrics-pagination.schema';

export function createLogRoutes(): Router {
  const router = Router();
  const controller = new LogController(new LogService());

  router.use(authenticateApiKey);
  router.use(rateLimitPerKey());
  router.post('/v1/logs', (req, res) => controller.createLog(req, res));
  router.get('/v1/logs', validateQuery(paginationQuerySchema), (req, res) => controller.listLogs(req, res));

  return router;
}
