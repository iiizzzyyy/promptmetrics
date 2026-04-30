import { Router } from 'express';
import { DatasetController } from '@controllers/dataset.controller';
import { authenticateApiKey } from '@middlewares/promptmetrics-auth.middleware';
import { auditLog } from '@middlewares/promptmetrics-audit.middleware';
import { rateLimitPerKey } from '@middlewares/rate-limit-per-key.middleware';
import { validateQuery } from '@middlewares/promptmetrics-query-validation.middleware';
import { paginationQuerySchema } from '@validation-schemas/promptmetrics-pagination.schema';

export function createDatasetRoutes(): Router {
  const router = Router();
  const controller = new DatasetController();

  router.use(authenticateApiKey);
  router.use(rateLimitPerKey());

  router.post('/v1/datasets', auditLog('create_dataset'), (req, res) => controller.createDataset(req, res));
  router.get('/v1/datasets', validateQuery(paginationQuerySchema), auditLog('list_datasets'), (req, res) =>
    controller.listDatasets(req, res),
  );
  router.get('/v1/datasets/:id', auditLog('get_dataset'), (req, res) => controller.getDataset(req, res));
  router.delete('/v1/datasets/:id', auditLog('delete_dataset'), (req, res) => controller.deleteDataset(req, res));

  return router;
}
