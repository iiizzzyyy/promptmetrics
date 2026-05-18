import { Router } from 'express';
import { RunController } from '@controllers/promptmetrics-run.controller';
import { RunService } from '@services/run.service';
import { authenticateApiKey, requireScope } from '@middlewares/promptmetrics-auth.middleware';
import { auditLog } from '@middlewares/promptmetrics-audit.middleware';
import { rateLimitPerKey } from '@middlewares/rate-limit-per-key.middleware';
import { validateQuery } from '@middlewares/promptmetrics-query-validation.middleware';
import { paginationQuerySchema } from '@validation-schemas/promptmetrics-pagination.schema';

export function createRunRoutes(): Router {
  const router = Router();
  const controller = new RunController(new RunService());

  router.use(authenticateApiKey);
  router.use(rateLimitPerKey());
  router.post(
    '/v1/runs',
    requireScope('write'),
    auditLog('run:create', (req) => ({ target_id: req.body?.run_id })),
    (req, res) => controller.createRun(req, res),
  );
  router.get('/v1/runs', validateQuery(paginationQuerySchema), (req, res) => controller.listRuns(req, res));
  router.get('/v1/runs/:run_id', (req, res) => controller.getRun(req, res));
  router.patch(
    '/v1/runs/:run_id',
    requireScope('write'),
    auditLog('run:update', (req) => ({
      target_id: Array.isArray(req.params.run_id) ? req.params.run_id[0] : req.params.run_id,
    })),
    (req, res) => controller.updateRun(req, res),
  );
  router.delete(
    '/v1/runs/:run_id',
    requireScope('write'),
    auditLog('delete_run', (req) => ({
      target_id: Array.isArray(req.params.run_id) ? req.params.run_id[0] : req.params.run_id,
    })),
    (req, res) => controller.deleteRun(req, res),
  );

  return router;
}
