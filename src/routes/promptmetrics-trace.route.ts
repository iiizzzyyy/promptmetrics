import { Router } from 'express';
import { TraceController } from '@controllers/promptmetrics-trace.controller';
import { TraceService } from '@services/trace.service';
import { authenticateApiKey } from '@middlewares/promptmetrics-auth.middleware';

export function createTraceRoutes(): Router {
  const router = Router();
  const controller = new TraceController(new TraceService());

  router.use(authenticateApiKey);
  router.post('/v1/traces', (req, res) => controller.createTrace(req, res));
  router.get('/v1/traces/:trace_id', (req, res) => controller.getTrace(req, res));
  router.post('/v1/traces/:trace_id/spans', (req, res) => controller.createSpan(req, res));
  router.get('/v1/traces/:trace_id/spans/:span_id', (req, res) => controller.getSpan(req, res));

  return router;
}
