import { Router } from 'express';
import { LabelController } from '@controllers/promptmetrics-label.controller';
import { LabelService } from '@services/label.service';
import { authenticateApiKey, requireScope } from '@middlewares/promptmetrics-auth.middleware';
import { auditLog } from '@middlewares/promptmetrics-audit.middleware';
import { rateLimitPerKey } from '@middlewares/rate-limit-per-key.middleware';
import { validateQuery } from '@middlewares/promptmetrics-query-validation.middleware';
import { paginationQuerySchema } from '@validation-schemas/promptmetrics-pagination.schema';

export function createLabelRoutes(): Router {
  const router = Router();
  const controller = new LabelController(new LabelService());

  router.use(authenticateApiKey);
  router.use(rateLimitPerKey());
  router.post(
    '/v1/prompts/:name/labels',
    requireScope('write'),
    auditLog('label:create', (req) => ({
      prompt_name: Array.isArray(req.params.name) ? req.params.name[0] : req.params.name,
      target_id: Array.isArray(req.params.name) ? req.params.name[0] : req.params.name,
    })),
    (req, res) => controller.createLabel(req, res),
  );
  router.get('/v1/prompts/:name/labels', validateQuery(paginationQuerySchema), (req, res) =>
    controller.listLabels(req, res),
  );
  router.get('/v1/prompts/:name/labels/:label_name', (req, res) => controller.getLabel(req, res));
  router.delete(
    '/v1/prompts/:name/labels/:label_name',
    requireScope('write'),
    auditLog('label:delete', (req) => ({
      prompt_name: Array.isArray(req.params.name) ? req.params.name[0] : req.params.name,
      target_id: Array.isArray(req.params.name) ? req.params.name[0] : req.params.name,
    })),
    (req, res) => controller.deleteLabel(req, res),
  );

  return router;
}
