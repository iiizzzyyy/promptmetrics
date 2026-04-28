#!/usr/bin/env node
import http from 'http';
import { createApp } from './app';
import { config } from '@config/index';
import { initSchema } from '@models/promptmetrics-sqlite';
import { setupGracefulShutdown } from '@utils/promptmetrics-shutdown';
import { initOtel, shutdownOtel } from '@services/promptmetrics-otel.service';
import { auditLogService } from '@services/audit-log.service';
import { GitSyncJob } from '@jobs/promptmetrics-git-sync.job';
import { PromptReconciliationJob } from '@jobs/promptmetrics-reconciliation.job';
import { createDriver } from '@drivers/promptmetrics-driver.factory';

async function main(): Promise<void> {
  console.log('Starting PromptMetrics...');

  await initSchema();
  console.log('Database initialized.');

  initOtel();
  auditLogService.start();

  const driver = createDriver();
  const app = createApp(driver);
  const server = http.createServer(app);

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
    reconciliationJob.start();
    console.log('Prompt reconciliation job started');
  }

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
