import request from 'supertest';
import express, { Router } from 'express';
import { createApp } from '@app';
import { getDb, closeDb, initSchema } from '@models/promptmetrics-sqlite';
import { hashApiKey } from '@middlewares/promptmetrics-auth.middleware';
import { rateLimitPerKey } from '@middlewares/rate-limit-per-key.middleware';
import fs from 'fs';
import path from 'path';

describe('Per-API-Key Rate Limiting', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test-rate-limit.db');
  let app: ReturnType<typeof createApp>;
  let keyA: string;
  let keyB: string;

  beforeAll(async () => {
    process.env.SQLITE_PATH = testDbPath;
    process.env.API_KEY_SALT = 'test-salt-for-ci';

    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');

    closeDb();
    await initSchema();

    const db = getDb();
    keyA = 'pm_key_a';
    keyB = 'pm_key_b';
    await db
      .prepare('INSERT OR REPLACE INTO api_keys (key_hash, name, scopes) VALUES (?, ?, ?)')
      .run(hashApiKey(keyA), 'key-a', 'read,write');
    await db
      .prepare('INSERT OR REPLACE INTO api_keys (key_hash, name, scopes) VALUES (?, ?, ?)')
      .run(hashApiKey(keyB), 'key-b', 'read,write');

    app = createApp();
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
  });

  it('two different API keys have independent counters', async () => {
    // Mount a low-limit router for this test
    const router = Router();
    router.use((req, _res, next) => {
      // manually attach apiKey so rate limiter can read it
      const keyValue = req.headers['x-test-key'] as string;
      req.apiKey = { name: keyValue, scopes: ['read'] };
      req.headers['x-api-key'] = keyValue;
      next();
    });
    router.use(rateLimitPerKey(60_000, 3));
    router.get('/test-limit', (_req, res) => res.json({ ok: true }));

    const testApp = express();
    testApp.use(router);

    // keyA uses 3 of its 3 allowed requests
    for (let i = 0; i < 3; i++) {
      const res = await request(testApp).get('/test-limit').set('X-Test-Key', 'key-a');
      expect(res.status).toBe(200);
    }

    // keyA should now be blocked
    const blocked = await request(testApp).get('/test-limit').set('X-Test-Key', 'key-a');
    expect(blocked.status).toBe(429);

    // keyB should still be allowed because it has its own counter
    const allowed = await request(testApp).get('/test-limit').set('X-Test-Key', 'key-b');
    expect(allowed.status).toBe(200);
  });

  it('exceeding limit returns 429 with Retry-After and RateLimit headers', async () => {
    const router = Router();
    router.use((req, _res, next) => {
      req.apiKey = { name: 'limited-key', scopes: ['read'] };
      req.headers['x-api-key'] = 'limited-key-value';
      next();
    });
    router.use(rateLimitPerKey(60_000, 2));
    router.get('/limited', (_req, res) => res.json({ ok: true }));

    const testApp = express();
    testApp.use(router);

    // First two requests succeed
    const r1 = await request(testApp).get('/limited');
    expect(r1.status).toBe(200);
    expect(r1.headers['ratelimit-limit']).toBe('2');
    expect(r1.headers['ratelimit-remaining']).toBe('1');

    const r2 = await request(testApp).get('/limited');
    expect(r2.status).toBe(200);
    expect(r2.headers['ratelimit-remaining']).toBe('0');

    // Third request is blocked
    const r3 = await request(testApp).get('/limited');
    expect(r3.status).toBe(429);
    expect(r3.body.error).toBe('Rate limit exceeded');
    expect(r3.body.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(r3.headers['retry-after']).toBeDefined();
    expect(parseInt(r3.headers['retry-after'] as string, 10)).toBeGreaterThan(0);
  });

  it('does not rate limit unauthenticated routes', async () => {
    // The real app's /health endpoint has no auth middleware, so no rate limiting either
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('accepts window_start values larger than 2^31', async () => {
    const db = getDb();
    const largeWindowStart = 2 ** 31 + 1; // 2147483649

    await db
      .prepare('INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)')
      .run('large-window-test', largeWindowStart);

    const row = (await db
      .prepare('SELECT window_start FROM rate_limits WHERE key = ?')
      .get('large-window-test')) as { window_start: number } | undefined;

    expect(row).toBeDefined();
    expect(row!.window_start).toBe(largeWindowStart);
  });

  it('should allow exactly 10 concurrent requests and block the rest with limit=10', async () => {
    const router = Router();
    router.use((req, _res, next) => {
      req.apiKey = { name: 'concurrent-key', scopes: ['read'] };
      req.headers['x-api-key'] = 'concurrent-key-value';
      next();
    });
    router.use(rateLimitPerKey(60_000, 10));
    router.get('/concurrent', (_req, res) => res.json({ ok: true }));

    const testApp = express();
    testApp.use(router);

    const requests = Array.from({ length: 20 }).map(() => request(testApp).get('/concurrent'));
    const results = await Promise.all(requests);

    const successes = results.filter((r) => r.status === 200).length;
    const blocked = results.filter((r) => r.status === 429).length;

    expect(successes).toBe(10);
    expect(blocked).toBe(10);
  });
});
