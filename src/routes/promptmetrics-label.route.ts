import { Router } from 'express';
import { LabelController } from '@controllers/promptmetrics-label.controller';
import { LabelService } from '@services/label.service';
import { authenticateApiKey } from '@middlewares/promptmetrics-auth.middleware';
import { rateLimitPerKey } from '@middlewares/rate-limit-per-key.middleware';
import { validateQuery } from '@middlewares/promptmetrics-query-validation.middleware';
import { paginationQuerySchema } from '@validation-schemas/promptmetrics-pagination.schema';

export function createLabelRoutes(): Router {
  const router = Router();
  const controller = new LabelController(new LabelService());

  router.use(authenticateApiKey);
  router.use(rateLimitPerKey());
  router.post('/v1/prompts/:name/labels', (req, res) => controller.createLabel(req, res));
  router.get('/v1/prompts/:name/labels', validateQuery(paginationQuerySchema), (req, res) =>
    controller.listLabels(req, res),
  );
  router.get('/v1/prompts/:name/labels/:label_name', (req, res) => controller.getLabel(req, res));
  router.delete('/v1/prompts/:name/labels/:label_name', (req, res) => controller.deleteLabel(req, res));

  return router;
}
