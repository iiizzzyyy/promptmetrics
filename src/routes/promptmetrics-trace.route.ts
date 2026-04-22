import { Router } from 'express';
import { TraceController } from '@controllers/promptmetrics-trace.controller';
import { authenticateApiKey } from '@middlewares/promptmetrics-auth.middleware';

export function createTraceRoutes(): Router {
  const router = Router();
  const controller = new TraceController();

  router.use(authenticateApiKey);
  router.post('/v1/traces', (req, res) => void controller.createTrace(req, res));
  router.get('/v1/traces/:trace_id', (req, res) => void controller.getTrace(req, res));
  router.post('/v1/traces/:trace_id/spans', (req, res) => void controller.createSpan(req, res));
  router.get('/v1/traces/:trace_id/spans/:span_id', (req, res) => void controller.getSpan(req, res));

  return router;
}
