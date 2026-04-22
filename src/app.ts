import express, { Application } from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from '@config/index';
import { createDriver } from '@drivers/promptmetrics-driver.factory';
import { createPromptRoutes } from '@routes/promptmetrics-prompt.route';
import { createLogRoutes } from '@routes/promptmetrics-log.route';
import { createTraceRoutes } from '@routes/promptmetrics-trace.route';
import { createRunRoutes } from '@routes/promptmetrics-run.route';
import { createLabelRoutes } from '@routes/promptmetrics-label.route';

export function createApp(): Application {
  const app = express();
  app.set('query parser', 'extended');
  const driver = createDriver();

  app.use(helmet());
  app.use(hpp());
  app.use(cors());
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => req.path === '/health' || req.path === '/health/deep',
    }),
  );
  app.use(express.json({ limit: '10mb' }));

  app.use('/', createPromptRoutes(driver));
  app.use('/', createLogRoutes());
  app.use('/', createTraceRoutes());
  app.use('/', createRunRoutes());
  app.use('/', createLabelRoutes());

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ error: 'Bad Request', message: 'Invalid JSON body' });
      return;
    }
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error', message: config.nodeEnv === 'development' ? err.message : undefined });
  });

  return app;
}
