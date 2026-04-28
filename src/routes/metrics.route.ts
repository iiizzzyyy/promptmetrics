import { Router } from 'express';
import { MetricsController } from '@controllers/metrics.controller';
import { MetricsService } from '@services/metrics.service';
import { authenticateApiKey } from '@middlewares/promptmetrics-auth.middleware';
import { rateLimitPerKey } from '@middlewares/rate-limit-per-key.middleware';

export function createMetricsRoutes(): Router {
  const router = Router();
  const controller = new MetricsController(new MetricsService());

  router.use(authenticateApiKey);
  router.use(rateLimitPerKey());

  router.get('/v1/metrics/time-series', (req, res) => controller.getTimeSeries(req, res));
  router.get('/v1/metrics/prompts', (req, res) => controller.getPromptMetrics(req, res));
  router.get('/v1/metrics/evaluations', (req, res) => controller.getEvaluationTrends(req, res));
  router.get('/v1/metrics/activity', (req, res) => controller.getActivitySummary(req, res));

  return router;
}
