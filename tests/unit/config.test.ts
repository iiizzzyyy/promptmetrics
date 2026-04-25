import { config } from '@config/index';

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.DRIVER;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should load default values', () => {
    process.env.PORT = '3000';
    process.env.API_KEY_SALT = 'test-salt';
    delete process.env.NODE_ENV;

    jest.isolateModules(() => {
      jest.mock('dotenv', () => ({ config: jest.fn() }));
      const { config: freshConfig } = require('@config/index');
      expect(freshConfig.port).toBe(3000);
      expect(freshConfig.nodeEnv).toBe('development');
      expect(freshConfig.driver).toBe('filesystem');
      expect(freshConfig.sqlitePath).toBe('./data/promptmetrics.db');
      expect(freshConfig.githubSyncIntervalMs).toBe(60000);
      expect(freshConfig.otelEnabled).toBe(false);
    });
  });

  it('should parse integer values', () => {
    process.env.PORT = '8080';
    process.env.GITHUB_SYNC_INTERVAL_MS = '30000';
    process.env.API_KEY_SALT = 'test-salt';
    delete process.env.NODE_ENV;

    jest.isolateModules(() => {
      const { config: freshConfig } = require('@config/index');
      expect(freshConfig.port).toBe(8080);
      expect(freshConfig.githubSyncIntervalMs).toBe(30000);
    });
  });

  it('should throw on missing required variable', () => {
    jest.isolateModules(() => {
      jest.mock('dotenv', () => ({ config: jest.fn() }));
      const originalSalt = process.env.API_KEY_SALT;
      delete process.env.API_KEY_SALT;

      expect(() => {
        require('@config/index');
      }).toThrow('Missing required environment variable: API_KEY_SALT');

      process.env.API_KEY_SALT = originalSalt;
    });
  });
});
