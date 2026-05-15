import express, { Application } from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import cors from 'cors';
import compression from 'compression';
import { raw } from 'express';
import swaggerUi from 'swagger-ui-express';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import { PromptDriver } from '@drivers/promptmetrics-driver.interface';
import { config } from '@config/index';
import { createPromptRoutes } from '@routes/promptmetrics-prompt.route';
import { createLogRoutes } from '@routes/promptmetrics-log.route';
import { createTraceRoutes } from '@routes/promptmetrics-trace.route';
import { createRunRoutes } from '@routes/promptmetrics-run.route';
import { createLabelRoutes } from '@routes/promptmetrics-label.route';
import { createWebhookRoutes } from '@routes/webhook.route';
import { createEvaluationRoutes } from '@routes/evaluation.route';
import { createApiKeyRoutes } from '@routes/api-key.route';
import { createAuditLogRoutes } from '@routes/audit-log.route';
import { createComplianceRoutes } from '@routes/compliance.route';
import { createMetricsRoutes } from '@routes/metrics.route';
import { createDatasetRoutes } from '@routes/dataset.route';
import { createPlaygroundRoutes } from '@routes/playground.route';
import { createABTestRoutes } from '@routes/ab-test.route';
import { requestIdMiddleware } from '@middlewares/promptmetrics-request-id.middleware';
import { errorHandlerMiddleware } from '@middlewares/promptmetrics-error-handler.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { getDb } from '@models/promptmetrics-sqlite';

export function createApp(driver: PromptDriver): Application {
  const app = express();
  app.set('query parser', 'extended');

  app.use(requestIdMiddleware);
  app.use(tenantMiddleware);
  app.use(helmet());
  app.use(hpp());
  app.use(cors());
  app.use(compression());
  app.use('/webhooks', raw({ type: 'application/json' }));
  app.use(express.json({ limit: '10mb' }));

  const openapiPath = path.resolve(__dirname, '../docs/openapi.yaml');
  if (fs.existsSync(openapiPath)) {
    const openapiSpec = yaml.load(fs.readFileSync(openapiPath, 'utf8')) as object;
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));
  }

  // Unauthenticated health endpoints (before auth-protected routes)
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/health/deep', async (_req, res) => {
    const checks: Record<string, string> = { sqlite: 'ok' };
    let dbConnected = false;
    let dbType: 'sqlite' | 'postgresql' = 'sqlite';
    try {
      const db = getDb();
      await db.prepare('SELECT 1').get();
      dbConnected = true;
      dbType = process.env.DATABASE_URL ? 'postgresql' : 'sqlite';
    } catch {
      checks.sqlite = 'error';
    }
    try {
      await driver.sync();
      checks.driver = 'ok';
    } catch {
      checks.driver = 'error';
    }
    const allOk = Object.values(checks).every((v) => v === 'ok');
    res.status(allOk ? 200 : 503).json({
      status: allOk ? 'ok' : 'degraded',
      checks,
      dbType,
      dbConnected,
      driverType: config.driver,
    });
  });

  app.use('/', createWebhookRoutes(driver));
  app.use('/', createPromptRoutes(driver));
  app.use('/', createLogRoutes());
  app.use('/', createTraceRoutes());
  app.use('/', createRunRoutes());
  app.use('/', createLabelRoutes());
  app.use('/', createEvaluationRoutes());
  app.use('/', createApiKeyRoutes());
  app.use('/', createAuditLogRoutes());
  app.use('/', createComplianceRoutes());
  app.use('/', createMetricsRoutes());
  app.use('/', createDatasetRoutes());
  app.use('/', createPlaygroundRoutes());
  app.use('/', createABTestRoutes());

  app.use(errorHandlerMiddleware);

  return app;
}
