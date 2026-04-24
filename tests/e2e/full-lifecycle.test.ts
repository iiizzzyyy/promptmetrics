import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '@app';
import { getDb, closeDb, initSchema } from '@models/promptmetrics-sqlite';
import { hashApiKey } from '@middlewares/promptmetrics-auth.middleware';
import { FilesystemDriver } from '@drivers/promptmetrics-filesystem-driver';

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

    app = createApp(new FilesystemDriver(testPromptsPath));
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
        .send({ name: 'x', version: '1.0.0', messages: [{ role: 'user', content: 'x' }] });
      expect(res.status).toBe(403);
    });

    it('allows write endpoints for write key', async () => {
      const res = await request(app)
        .post('/v1/prompts')
        .set('X-API-Key', writeKey)
        .send({ name: 'x', version: '1.0.0', messages: [{ role: 'user', content: 'x' }] });
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
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Welcome {{name}}! Your email is {{email}}.' },
          ],
          variables: {
            name: { type: 'string', required: true },
            email: { type: 'string', required: true },
          },
          model_config: { model: 'gpt-4o', temperature: 0.7 },
          ollama: {
            options: { temperature: 0.8, num_ctx: 4096, seed: 42 },
            keep_alive: '5m',
            format: 'json',
          },
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
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Hello {{name}}! Welcome aboard.' },
          ],
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
      const res = await request(app).get('/v1/prompts/onboarding?render=false').set('X-API-Key', readKey);
      expect(res.status).toBe(200);
      expect(res.body.content.version).toBe('1.1.0');
      expect(res.body.content.messages).toEqual([
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello {{name}}! Welcome aboard.' },
    ]);
    });

    it('gets specific version', async () => {
      const res = await request(app)
        .get('/v1/prompts/onboarding?version=1.0.0&render=false')
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

  describe('Message Rendering', () => {
    it('renders messages with query variables', async () => {
      const res = await request(app)
        .get('/v1/prompts/onboarding?version=1.0.0&variables[name]=Alice&variables[email]=alice@example.com')
        .set('X-API-Key', readKey);
      expect(res.status).toBe(200);
      expect(res.body.content.messages[1].content).toContain('Welcome Alice!');
      expect(res.body.content.messages[1].content).toContain('alice@example.com');
    });

    it('returns raw messages when render=false', async () => {
      const res = await request(app)
        .get('/v1/prompts/onboarding?render=false')
        .set('X-API-Key', readKey);
      expect(res.status).toBe(200);
      expect(res.body.content.messages[1].content).toContain('{{name}}');
    });

    it('returns 400 when render=true with missing required variables', async () => {
      const res = await request(app)
        .get('/v1/prompts/onboarding?version=1.0.0&render=true')
        .set('X-API-Key', readKey);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing required variables');
    });

    it('renders messages when render=true with all variables provided', async () => {
      const res = await request(app)
        .get('/v1/prompts/onboarding?version=1.0.0&render=true&variables[name]=Alice&variables[email]=alice@example.com')
        .set('X-API-Key', readKey);
      expect(res.status).toBe(200);
      expect(res.body.content.messages[1].content).toContain('Welcome Alice!');
      expect(res.body.content.messages[1].content).toContain('alice@example.com');
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

    it('accepts a log entry with ollama fields', async () => {
      const res = await request(app)
        .post('/v1/logs')
        .set('X-API-Key', writeKey)
        .send({
          prompt_name: 'onboarding',
          version_tag: '1.0.0',
          provider: 'ollama',
          model: 'llama3.1',
          ollama_options: { temperature: 0.8, num_ctx: 4096, seed: 42 },
          ollama_keep_alive: '5m',
          ollama_format: 'json',
        });

      expect(res.status).toBe(202);
      expect(res.body.status).toBe('accepted');
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
        .send({ version: '1.0.0', messages: [{ role: 'user', content: 'x' }] });
      expect(res.status).toBe(422);
    });

    it('rejects prompt without version', async () => {
      const res = await request(app)
        .post('/v1/prompts')
        .set('X-API-Key', writeKey)
        .send({ name: 'x', messages: [{ role: 'user', content: 'x' }] });
      expect(res.status).toBe(422);
    });

    it('rejects prompt without messages', async () => {
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
            messages: [{ role: 'user', content: `Prompt ${i}` }],
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

  describe('Trace Telemetry', () => {
    it('creates a trace and adds spans', async () => {
      const traceRes = await request(app)
        .post('/v1/traces')
        .set('X-API-Key', writeKey)
        .send({
          prompt_name: 'onboarding',
          version_tag: '1.0.0',
          metadata: { agent: 'e2e-test', loop: 1 },
        });

      expect(traceRes.status).toBe(201);
      expect(traceRes.body.trace_id).toBeDefined();
      const traceId = traceRes.body.trace_id;

      const span1 = await request(app)
        .post(`/v1/traces/${traceId}/spans`)
        .set('X-API-Key', writeKey)
        .send({
          name: 'agent-step-1',
          status: 'ok',
          start_time: 1000,
          end_time: 2000,
          metadata: { action: 'fetch_prompt' },
        });

      expect(span1.status).toBe(201);

      const span2 = await request(app)
        .post(`/v1/traces/${traceId}/spans`)
        .set('X-API-Key', writeKey)
        .send({
          name: 'agent-step-2',
          status: 'error',
          start_time: 2000,
          end_time: 3000,
          metadata: { action: 'llm_call', error: 'timeout' },
        });

      expect(span2.status).toBe(201);

      const getRes = await request(app)
        .get(`/v1/traces/${traceId}`)
        .set('X-API-Key', readKey);

      expect(getRes.status).toBe(200);
      expect(getRes.body.trace_id).toBe(traceId);
      expect(getRes.body.spans.length).toBe(2);
      expect(getRes.body.spans[0].name).toBe('agent-step-1');
      expect(getRes.body.spans[1].name).toBe('agent-step-2');
    });

    it('returns 404 for missing trace', async () => {
      const res = await request(app)
        .get('/v1/traces/non-existent-trace')
        .set('X-API-Key', readKey);
      expect(res.status).toBe(404);
    });
  });

  describe('Workflow Runs', () => {
    it('creates a run and updates it', async () => {
      const createRes = await request(app)
        .post('/v1/runs')
        .set('X-API-Key', writeKey)
        .send({
          workflow_name: 'headline-agent',
          input: { topic: 'AI' },
          metadata: { agent: 'e2e-test' },
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.run_id).toBeDefined();
      expect(createRes.body.workflow_name).toBe('headline-agent');
      expect(createRes.body.status).toBe('running');
      const runId = createRes.body.run_id;

      const getRes = await request(app).get(`/v1/runs/${runId}`).set('X-API-Key', readKey);
      expect(getRes.status).toBe(200);
      expect(getRes.body.run_id).toBe(runId);
      expect(getRes.body.input).toEqual({ topic: 'AI' });
      expect(getRes.body.status).toBe('running');

      const patchRes = await request(app)
        .patch(`/v1/runs/${runId}`)
        .set('X-API-Key', writeKey)
        .send({ status: 'completed', output: { headline: 'AI Breakthrough' } });

      expect(patchRes.status).toBe(200);

      const updatedRes = await request(app).get(`/v1/runs/${runId}`).set('X-API-Key', readKey);
      expect(updatedRes.status).toBe(200);
      expect(updatedRes.body.status).toBe('completed');
      expect(updatedRes.body.output).toEqual({ headline: 'AI Breakthrough' });
    });

    it('lists runs with pagination', async () => {
      const res = await request(app).get('/v1/runs?page=1&limit=10').set('X-API-Key', readKey);
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(10);
    });

    it('returns 404 for missing run', async () => {
      const res = await request(app).get('/v1/runs/missing-run').set('X-API-Key', readKey);
      expect(res.status).toBe(404);
    });
  });

  describe('Prompt Labels', () => {
    it('creates, lists, gets, and deletes a label', async () => {
      const createRes = await request(app)
        .post('/v1/prompts/onboarding/labels')
        .set('X-API-Key', writeKey)
        .send({ name: 'production', version_tag: '1.0.0' });

      expect(createRes.status).toBe(201);
      expect(createRes.body.prompt_name).toBe('onboarding');
      expect(createRes.body.name).toBe('production');
      expect(createRes.body.version_tag).toBe('1.0.0');

      const listRes = await request(app)
        .get('/v1/prompts/onboarding/labels')
        .set('X-API-Key', readKey);

      expect(listRes.status).toBe(200);
      expect(listRes.body.items.length).toBe(1);
      expect(listRes.body.items[0].name).toBe('production');

      const getRes = await request(app)
        .get('/v1/prompts/onboarding/labels/production')
        .set('X-API-Key', readKey);

      expect(getRes.status).toBe(200);
      expect(getRes.body.name).toBe('production');
      expect(getRes.body.version_tag).toBe('1.0.0');

      const delRes = await request(app)
        .delete('/v1/prompts/onboarding/labels/production')
        .set('X-API-Key', writeKey);

      expect(delRes.status).toBe(204);

      const afterList = await request(app)
        .get('/v1/prompts/onboarding/labels')
        .set('X-API-Key', readKey);

      expect(afterList.status).toBe(200);
      expect(afterList.body.items.length).toBe(0);
    });

    it('updates existing label on duplicate (upsert)', async () => {
      const first = await request(app)
        .post('/v1/prompts/onboarding/labels')
        .set('X-API-Key', writeKey)
        .send({ name: 'staging', version_tag: '1.0.0' });

      expect(first.status).toBe(201);

      const second = await request(app)
        .post('/v1/prompts/onboarding/labels')
        .set('X-API-Key', writeKey)
        .send({ name: 'staging', version_tag: '1.1.0' });

      expect(second.status).toBe(201);
      expect(second.body.version_tag).toBe('1.1.0');
    });

    it('returns 404 for missing label', async () => {
      const res = await request(app)
        .get('/v1/prompts/onboarding/labels/missing')
        .set('X-API-Key', readKey);

      expect(res.status).toBe(404);
    });
  });
});
