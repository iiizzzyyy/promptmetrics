import { Router } from 'express';
import { LabelController } from '@controllers/promptmetrics-label.controller';
import { authenticateApiKey } from '@middlewares/promptmetrics-auth.middleware';

export function createLabelRoutes(): Router {
  const router = Router();
  const controller = new LabelController();

  router.use(authenticateApiKey);
  router.post('/v1/prompts/:name/labels', (req, res) => controller.createLabel(req, res));
  router.get('/v1/prompts/:name/labels', (req, res) => controller.listLabels(req, res));
  router.get('/v1/prompts/:name/labels/:label_name', (req, res) => controller.getLabel(req, res));
  router.delete('/v1/prompts/:name/labels/:label_name', (req, res) => controller.deleteLabel(req, res));

  return router;
}
