#!/usr/bin/env node
import http from 'http';
import { createApp } from './app';
import { config } from '@config/index';
import { initSchema, getDb } from '@models/promptmetrics-sqlite';
import { setupGracefulShutdown } from '@utils/promptmetrics-shutdown';
import { initOtel, shutdownOtel } from '@services/promptmetrics-otel.service';
import { auditLogService } from '@services/audit-log.service';
import { GitSyncJob } from '@jobs/promptmetrics-git-sync.job';
import { PromptReconciliationJob } from '@jobs/promptmetrics-reconciliation.job';
import { createDriver } from '@drivers/promptmetrics-driver.factory';
import { registerBuiltinProviders } from '@services/providers/provider.registry';
import { PromptDriver } from '@drivers/promptmetrics-driver.interface';

interface HealthState {
  gitSyncLastRun: number | null;
  reconciliationRunning: boolean;
}

const healthState: HealthState = {
  gitSyncLastRun: null,
  reconciliationRunning: false,
};

// Cache deep health results for 30 seconds to prevent abuse.
let deepHealthCache: { timestamp: number; body: string; statusCode: number } | null = null;
const DEEP_HEALTH_CACHE_TTL_MS = 30_000;

async function computeDeepHealth(driver: PromptDriver): Promise<{ body: string; statusCode: number }> {
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
    dbConnected = false;
  }

  try {
    await driver.sync();
    checks.driver = 'ok';
  } catch {
    checks.driver = 'error';
  }

  const allOk = Object.values(checks).every((v) => v === 'ok');

  const body = JSON.stringify({
    status: allOk ? 'ok' : 'degraded',
    checks,
    dbType,
    dbConnected,
    driverType: config.driver,
    gitSyncLastRun: config.driver === 'github' ? healthState.gitSyncLastRun : undefined,
    reconciliationRunning: healthState.reconciliationRunning,
  });

  return { body, statusCode: allOk ? 200 : 503 };
}

async function sendDeepHealth(res: http.ServerResponse, driver: PromptDriver): Promise<void> {
  const now = Date.now();
  if (deepHealthCache && now - deepHealthCache.timestamp < DEEP_HEALTH_CACHE_TTL_MS) {
    res.writeHead(deepHealthCache.statusCode, { 'Content-Type': 'application/json' });
    res.end(deepHealthCache.body);
    return;
  }

  const result = await computeDeepHealth(driver);
  deepHealthCache = { timestamp: now, ...result };
  res.writeHead(result.statusCode, { 'Content-Type': 'application/json' });
  res.end(result.body);
}

async function main(): Promise<void> {
  console.log('Starting PromptMetrics...');

  await initSchema();
  console.log('Database initialized.');

  initOtel();
  auditLogService.start();
  await registerBuiltinProviders();

  const driver = createDriver();
  const app = createApp(driver);

  // Patch GitSyncJob to track last run time
  const originalRunSync = (GitSyncJob.prototype as any).runSync;
  if (originalRunSync) {
    (GitSyncJob.prototype as any).runSync = async function () {
      healthState.gitSyncLastRun = Date.now();
      return originalRunSync.call(this);
    };
  }

  // Start git sync job for github driver (skip polling when webhooks are configured)
  const gitSyncJob = new GitSyncJob(driver, config.githubSyncIntervalMs);
  if (config.driver === 'github' && !process.env.GITHUB_WEBHOOK_SECRET) {
    gitSyncJob.start();
    console.log(`Git sync job started (interval: ${config.githubSyncIntervalMs}ms)`);
  } else if (config.driver === 'github' && process.env.GITHUB_WEBHOOK_SECRET) {
    console.log('Git sync job skipped: GITHUB_WEBHOOK_SECRET is configured (using webhooks)');
  }

  // Start prompt reconciliation job for all valid drivers
  const reconciliationJob = new PromptReconciliationJob(driver);
  if (['filesystem', 'github', 's3'].includes(config.driver)) {
    const originalRunReconcile = reconciliationJob.runReconcile.bind(reconciliationJob);
    reconciliationJob.runReconcile = async () => {
      healthState.reconciliationRunning = true;
      try {
        await originalRunReconcile();
      } finally {
        healthState.reconciliationRunning = false;
      }
    };
    reconciliationJob.start();
    console.log('Prompt reconciliation job started');
  }

  const server = http.createServer((req, res) => {
    const pathname = req.url ? req.url.split('?')[0] : '';
    if (pathname === '/health/deep') {
      sendDeepHealth(res, driver).catch(() => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error' }));
      });
      return;
    }
    app(req, res);
  });

  setupGracefulShutdown({
    server,
    cleanupJobs: [
      shutdownOtel,
      async () => {
        gitSyncJob.stop();
      },
      async () => {
        reconciliationJob.stop();
      },
      async () => {
        await auditLogService.flush();
      },
      async () => {
        auditLogService.stop();
      },
    ],
  });

  server.listen(config.port, () => {
    console.log(`PromptMetrics running on port ${config.port}`);
    console.log(`Driver: ${config.driver}`);
    console.log(`SQLite: ${config.sqlitePath}`);
    console.log(`OTel: ${config.otelEnabled ? 'enabled' : 'disabled'}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
