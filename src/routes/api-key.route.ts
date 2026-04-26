import { Router } from 'express';
import { ApiKeyController } from '@controllers/api-key.controller';
import { ApiKeyService } from '@services/api-key.service';
import { authenticateApiKey } from '@middlewares/promptmetrics-auth.middleware';
import { rateLimitPerKey } from '@middlewares/rate-limit-per-key.middleware';
import { requireScope } from '@middlewares/promptmetrics-auth.middleware';
import { validateQuery } from '@middlewares/promptmetrics-query-validation.middleware';
import { paginationQuerySchema } from '@validation-schemas/promptmetrics-pagination.schema';

export function createApiKeyRoutes(): Router {
  const router = Router();
  const controller = new ApiKeyController(new ApiKeyService());

  router.use(authenticateApiKey);
  router.use(rateLimitPerKey());

  router.post('/v1/api-keys', requireScope('admin'), (req, res) => controller.createApiKey(req, res));
  router.get('/v1/api-keys', requireScope('admin'), validateQuery(paginationQuerySchema), (req, res) =>
    controller.listApiKeys(req, res),
  );
  router.delete('/v1/api-keys/:id', requireScope('admin'), (req, res) => controller.deleteApiKey(req, res));

  return router;
}
