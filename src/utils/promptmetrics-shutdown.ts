import { Server } from 'http';
import { closeDb } from '@models/promptmetrics-sqlite';

interface ShutdownOptions {
  server: Server;
  timeoutMs?: number;
  cleanupJobs?: Array<(() => void) | (() => Promise<void>)>;
}

export function setupGracefulShutdown(options: ShutdownOptions): void {
  const { server, timeoutMs = 30000, cleanupJobs = [] } = options;

  async function shutdown(signal: string): Promise<void> {
    console.log(`Received ${signal}. Starting graceful shutdown...`);

    const timer = setTimeout(() => {
      console.error('Shutdown timeout exceeded. Forcing exit.');
      process.exit(1);
    }, timeoutMs);

    try {
      server.close(() => {
        console.log('HTTP server closed.');
      });

      for (const job of cleanupJobs) {
        await job();
      }

      await closeDb();
      console.log('Database connection closed.');

      clearTimeout(timer);
      console.log('Graceful shutdown complete.');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      clearTimeout(timer);
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}
