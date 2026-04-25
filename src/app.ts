import express, { Application } from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import { PromptDriver } from '@drivers/promptmetrics-driver.interface';
import { createDriver } from '@drivers/promptmetrics-driver.factory';
import { createPromptRoutes } from '@routes/promptmetrics-prompt.route';
import { createLogRoutes } from '@routes/promptmetrics-log.route';
import { createTraceRoutes } from '@routes/promptmetrics-trace.route';
import { createRunRoutes } from '@routes/promptmetrics-run.route';
import { createLabelRoutes } from '@routes/promptmetrics-label.route';
import { requestIdMiddleware } from '@middlewares/promptmetrics-request-id.middleware';
import { errorHandlerMiddleware } from '@middlewares/promptmetrics-error-handler.middleware';

export function createApp(driver?: PromptDriver): Application {
  const app = express();
  app.set('query parser', 'extended');
  if (!driver) {
    driver = createDriver();
  }

  app.use(requestIdMiddleware);
  app.use(helmet());
  app.use(hpp());
  app.use(cors());
  app.use(compression());
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

  const openapiPath = path.resolve(__dirname, '../docs/openapi.yaml');
  if (fs.existsSync(openapiPath)) {
    const openapiSpec = yaml.load(fs.readFileSync(openapiPath, 'utf8')) as object;
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));
  }

  app.use('/', createPromptRoutes(driver));
  app.use('/', createLogRoutes());
  app.use('/', createTraceRoutes());
  app.use('/', createRunRoutes());
  app.use('/', createLabelRoutes());

  app.use(errorHandlerMiddleware);

  return app;
}
