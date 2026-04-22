import { createServer } from 'http';
import { setupGracefulShutdown } from '@utils/promptmetrics-shutdown';

describe('Graceful Shutdown', () => {
  let server: ReturnType<typeof createServer>;

  beforeEach(() => {
    server = createServer((req, res) => {
      res.writeHead(200);
      res.end('ok');
    });
  });

  afterEach(() => {
    server.closeAllConnections?.();
    server.close();
  });

  it('should attach SIGTERM and SIGINT listeners', () => {
    const listenersBefore = process.listenerCount('SIGTERM');
    setupGracefulShutdown({ server });
    expect(process.listenerCount('SIGTERM')).toBe(listenersBefore + 1);
    expect(process.listenerCount('SIGINT')).toBeGreaterThan(0);
  });
});
