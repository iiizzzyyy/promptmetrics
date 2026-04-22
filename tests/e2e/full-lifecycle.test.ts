import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '@app';
import { getDb, closeDb, initSchema } from '@models/promptmetrics-sqlite';
import { hashApiKey } from '@middlewares/promptmetrics-auth.middleware';

describe('Full Lifecycle E2E', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test-e2e.db');
  const testPromptsPath = path.resolve(__dirname, '../../data/test-e2e-prompts');
  let app: ReturnType<typeof createApp>;
  let readKey: string;
  let writeKey: string;
  let adminKey: string;
  let badKey: string;

  beforeAll(() => {
    process.env.SQLITE_PATH = testDbPath;
    process.env.DRIVER = 'filesystem';
    process.env.API_KEY_SALT = 'e2e-salt';

    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
    if (fs.existsSync(testPromptsPath)) fs.rmSync(testPromptsPath, { recursive: true });

    closeDb();
    initSchema();

    const db = getDb();
    readKey = 'pm_readkey123';
    writeKey = 'pm_writekey123';
    adminKey = 'pm_adminkey123';
    badKey = 'pm_badkey123';

    db.prepare('INSERT OR REPLACE INTO api_keys (key_hash, name, scopes) VALUES (?, ?, ?)').run(
      hashApiKey(readKey),
      'read-key',
      'read',
    );
    db.prepare('INSERT OR REPLACE INTO api_keys (key_hash, name, scopes) VALUES (?, ?, ?)').run(
      hashApiKey(writeKey),
      'write-key',
      'read,write',
    );
    db.prepare('INSERT OR REPLACE INTO api_keys (key_hash, name, scopes) VALUES (?, ?, ?)').run(
      hashApiKey(adminKey),
      'admin-key',
      'read,write,admin',
    );

    app = createApp();
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
    if (fs.existsSync(testPromptsPath)) fs.rmSync(testPromptsPath, { recursive: true });
  });

  describe('Health', () => {
    it('GET /health returns ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });

    it('GET /health/deep returns ok with checks', async () => {
      const res = await request(app).get('/health/deep');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.checks.sqlite).toBe('ok');
      expect(res.body.checks.driver).toBe('ok');
    });
  });

  describe('Authentication', () => {
    it('rejects requests without API key', async () => {
      const res = await request(app).get('/v1/prompts');
      expect(res.status).toBe(401);
    });

    it('rejects requests with invalid API key', async () => {
      const res = await request(app).get('/v1/prompts').set('X-API-Key', badKey);
      expect(res.status).toBe(401);
    });

    it('allows read scope to access GET endpoints', async () => {
      const res = await request(app).get('/v1/prompts').set('X-API-Key', readKey);
      expect(res.status).toBe(200);
    });

    it('rejects write endpoints for read-only key', async () => {
      const res = await request(app)
        .post('/v1/prompts')
        .set('X-API-Key', readKey)
        .send({ name: 'x', version: '1.0.0', template: 'x' });
      expect(res.status).toBe(403);
    });

    it('allows write endpoints for write key', async () => {
      const res = await request(app)
        .post('/v1/prompts')
        .set('X-API-Key', writeKey)
        .send({ name: 'x', version: '1.0.0', template: 'x' });
      expect(res.status).toBe(201);
    });
  });

  describe('Prompt CRUD', () => {
    it('creates a prompt with all fields', async () => {
      const res = await request(app)
        .post('/v1/prompts')
        .set('X-API-Key', writeKey)
        .send({
          name: 'onboarding',
          version: '1.0.0',
          template: 'Welcome {{name}}! Your email is {{email}}.',
          variables: {
            name: { type: 'string', required: true },
            email: { type: 'string', required: true },
          },
          model_config: { model: 'gpt-4o', temperature: 0.7 },
          tags: ['onboarding', 'user'],
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('onboarding');
      expect(res.body.version_tag).toBe('1.0.0');
    });

    it('creates a second version of the same prompt', async () => {
      const res = await request(app)
        .post('/v1/prompts')
        .set('X-API-Key', writeKey)
        .send({
          name: 'onboarding',
          version: '1.1.0',
          template: 'Hello {{name}}! Welcome aboard.',
          variables: { name: { type: 'string', required: true } },
        });

      expect(res.status).toBe(201);
      expect(res.body.version_tag).toBe('1.1.0');
    });

    it('lists all prompts with pagination', async () => {
      const res = await request(app).get('/v1/prompts?page=1&limit=10').set('X-API-Key', readKey);
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeGreaterThanOrEqual(2);
      expect(res.body.total).toBeGreaterThanOrEqual(2);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(10);
    });

    it('searches prompts by name', async () => {
      const res = await request(app).get('/v1/prompts?q=onboard').set('X-API-Key', readKey);
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(1);
      expect(res.body.items[0].name).toBe('onboarding');
    });

    it('gets latest version by default', async () => {
      const res = await request(app).get('/v1/prompts/onboarding').set('X-API-Key', readKey);
      expect(res.status).toBe(200);
      expect(res.body.content.version).toBe('1.1.0');
      expect(res.body.content.template).toBe('Hello {{name}}! Welcome aboard.');
    });

    it('gets specific version', async () => {
      const res = await request(app)
        .get('/v1/prompts/onboarding?version=1.0.0')
        .set('X-API-Key', readKey);
      expect(res.status).toBe(200);
      expect(res.body.content.version).toBe('1.0.0');
    });

    it('lists all versions', async () => {
      const res = await request(app).get('/v1/prompts/onboarding/versions').set('X-API-Key', readKey);
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(2);
      expect(res.body.items[0].version_tag).toBe('1.0.0');
      expect(res.body.items[1].version_tag).toBe('1.1.0');
    });

    it('returns 404 for non-existent prompt', async () => {
      const res = await request(app).get('/v1/prompts/does-not-exist').set('X-API-Key', readKey);
      expect(res.status).toBe(404);
    });
  });

  describe('Template Rendering', () => {
    it('renders template with query variables', async () => {
      const res = await request(app)
        .get('/v1/prompts/onboarding?version=1.0.0&variables[name]=Alice&variables[email]=alice@example.com')
        .set('X-API-Key', readKey);
      expect(res.status).toBe(200);
      expect(res.body.content.template).toContain('Welcome Alice!');
      expect(res.body.content.template).toContain('alice@example.com');
    });

    it('returns raw template when render=false', async () => {
      const res = await request(app)
        .get('/v1/prompts/onboarding?render=false')
        .set('X-API-Key', readKey);
      expect(res.status).toBe(200);
      expect(res.body.content.template).toContain('{{name}}');
    });
  });

  describe('Logging', () => {
    it('accepts a log entry with all fields', async () => {
      const res = await request(app)
        .post('/v1/logs')
        .set('X-API-Key', writeKey)
        .send({
          prompt_name: 'onboarding',
          version_tag: '1.0.0',
          provider: 'openai',
          model: 'gpt-4o',
          tokens_in: 15,
          tokens_out: 25,
          latency_ms: 420,
          cost_usd: 0.002,
          metadata: { user_id: 'user_456', experiment: 'onboard-v2' },
        });

      expect(res.status).toBe(202);
      expect(res.body.status).toBe('accepted');
      expect(typeof res.body.id).toBe('number');
    });

    it('accepts a log entry with minimal fields', async () => {
      const res = await request(app)
        .post('/v1/logs')
        .set('X-API-Key', writeKey)
        .send({
          prompt_name: 'onboarding',
          version_tag: '1.0.0',
        });

      expect(res.status).toBe(202);
    });

    it('rejects log with too many metadata keys', async () => {
      const metadata: Record<string, string> = {};
      for (let i = 0; i < 51; i++) {
        metadata[`key${i}`] = 'value';
      }

      const res = await request(app)
        .post('/v1/logs')
        .set('X-API-Key', writeKey)
        .send({ prompt_name: 'x', version_tag: '1.0.0', metadata });

      expect(res.status).toBe(422);
    });

    it('rejects log with invalid metadata value type', async () => {
      const res = await request(app)
        .post('/v1/logs')
        .set('X-API-Key', writeKey)
        .send({
          prompt_name: 'x',
          version_tag: '1.0.0',
          metadata: { nested: { object: 'not-allowed' } },
        });

      expect(res.status).toBe(422);
    });
  });

  describe('Audit Logs', () => {
    it('returns audit logs for admin scope', async () => {
      const res = await request(app).get('/v1/audit-logs').set('X-API-Key', adminKey);
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeGreaterThan(0);
      expect(res.body.total).toBeGreaterThan(0);
      expect(res.body.items[0]).toHaveProperty('action');
      expect(res.body.items[0]).toHaveProperty('timestamp');
    });

    it('returns 403 for non-admin scope', async () => {
      const res = await request(app).get('/v1/audit-logs').set('X-API-Key', writeKey);
      expect(res.status).toBe(403);
    });
  });

  describe('Validation', () => {
    it('rejects prompt without name', async () => {
      const res = await request(app)
        .post('/v1/prompts')
        .set('X-API-Key', writeKey)
        .send({ version: '1.0.0', template: 'x' });
      expect(res.status).toBe(422);
    });

    it('rejects prompt without version', async () => {
      const res = await request(app)
        .post('/v1/prompts')
        .set('X-API-Key', writeKey)
        .send({ name: 'x', template: 'x' });
      expect(res.status).toBe(422);
    });

    it('rejects prompt without template', async () => {
      const res = await request(app)
        .post('/v1/prompts')
        .set('X-API-Key', writeKey)
        .send({ name: 'x', version: '1.0.0' });
      expect(res.status).toBe(422);
    });
  });

  describe('Concurrent Writes', () => {
    it('handles multiple prompt creations concurrently', async () => {
      const promises = Array.from({ length: 5 }).map((_, i) =>
        request(app)
          .post('/v1/prompts')
          .set('X-API-Key', writeKey)
          .send({
            name: `concurrent-${i}`,
            version: '1.0.0',
            template: `Prompt ${i}`,
          }),
      );

      const results = await Promise.all(promises);
      expect(results.every((r) => r.status === 201)).toBe(true);
    });

    it('handles multiple log entries concurrently', async () => {
      const promises = Array.from({ length: 10 }).map((_, i) =>
        request(app)
          .post('/v1/logs')
          .set('X-API-Key', writeKey)
          .send({
            prompt_name: 'onboarding',
            version_tag: '1.0.0',
            latency_ms: i * 100,
          }),
      );

      const results = await Promise.all(promises);
      expect(results.every((r) => r.status === 202)).toBe(true);
    });
  });
});
