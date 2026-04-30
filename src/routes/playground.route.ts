import { Router } from 'express';
import { PlaygroundController } from '@controllers/playground.controller';
import { PlaygroundProxyService } from '@services/playground.service';
import { authenticateApiKey } from '@middlewares/promptmetrics-auth.middleware';
import { auditLog } from '@middlewares/promptmetrics-audit.middleware';
import { rateLimitPerKey } from '@middlewares/rate-limit-per-key.middleware';
import { validateBody } from '@middlewares/promptmetrics-body-validation.middleware';
import { playgroundChatSchema, playgroundCompletionSchema } from '@validation-schemas/playground.schema';

export function createPlaygroundRoutes(): Router {
  const router = Router();
  const service = new PlaygroundProxyService();
  const controller = new PlaygroundController(service);

  router.use(authenticateApiKey);
  router.use(rateLimitPerKey());

  router.get('/v1/playground/models', auditLog('playground_list_models'), (req, res) =>
    controller.listModels(req, res),
  );

  router.post('/v1/playground/chat', validateBody(playgroundChatSchema), auditLog('playground_chat'), (req, res) =>
    controller.chatCompletion(req, res),
  );

  router.post(
    '/v1/playground/chat/stream',
    validateBody(playgroundChatSchema),
    auditLog('playground_chat_stream'),
    (req, res) => controller.streamChatCompletion(req, res),
  );

  router.post(
    '/v1/playground/completions',
    validateBody(playgroundCompletionSchema),
    auditLog('playground_completion'),
    (req, res) => controller.textCompletion(req, res),
  );

  return router;
}
