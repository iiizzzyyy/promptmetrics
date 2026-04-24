import http from 'http';
import { createApp } from './app';
import { config } from '@config/index';
import { initSchema } from '@models/promptmetrics-sqlite';
import { setupGracefulShutdown } from '@utils/promptmetrics-shutdown';
import { initOtel, shutdownOtel } from '@services/promptmetrics-otel.service';
import { GitSyncJob } from '@jobs/promptmetrics-git-sync.job';
import { createDriver } from '@drivers/promptmetrics-driver.factory';

function main(): void {
  console.log('Starting PromptMetrics...');

  initSchema();
  console.log('Database initialized.');

  initOtel();

  const driver = createDriver();
  const app = createApp(driver);
  const server = http.createServer(app);

  // Start git sync job for github driver
  const gitSyncJob = new GitSyncJob(driver, config.githubSyncIntervalMs);
  if (config.driver === 'github') {
    gitSyncJob.start();
    console.log(`Git sync job started (interval: ${config.githubSyncIntervalMs}ms)`);
  }

  setupGracefulShutdown({
    server,
    cleanupJobs: [
      shutdownOtel,
      async () => {
        gitSyncJob.stop();
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

main();
