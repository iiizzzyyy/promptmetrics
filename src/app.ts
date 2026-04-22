import express, { Application } from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import cors from 'cors';
import { config } from '@config/index';
import { createDriver } from '@drivers/promptmetrics-driver.factory';
import { createPromptRoutes } from '@routes/promptmetrics-prompt.route';
import { createLogRoutes } from '@routes/promptmetrics-log.route';

export function createApp(): Application {
  const app = express();
  app.set('query parser', 'extended');
  const driver = createDriver();

  app.use(helmet());
  app.use(hpp());
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  app.use('/', createPromptRoutes(driver));
  app.use('/', createLogRoutes());

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error', message: config.nodeEnv === 'development' ? err.message : undefined });
  });

  return app;
}
