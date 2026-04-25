import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '@app';
import { getDb, closeDb, initSchema } from '@models/promptmetrics-sqlite';
import { hashApiKey } from '@middlewares/promptmetrics-auth.middleware';
import { FilesystemDriver } from '@drivers/promptmetrics-filesystem-driver';

describe('GitHub Webhook', () => {
  const testDbPath = require('path').resolve(__dirname, '../../data/test-webhook.db');
  const testPromptsPath = require('path').resolve(__dirname, '../../data/test-webhook-prompts');
  let app: ReturnType<typeof createApp>;
  let apiKey: string;
  const webhookSecret = 'test-webhook-secret';

  beforeAll(async () => {
    process.env.SQLITE_PATH = testDbPath;
    process.env.DRIVER = 'filesystem';
    process.env.API_KEY_SALT = 'test-salt';
    process.env.GITHUB_WEBHOOK_SECRET = webhookSecret;

    const fs = require('fs');
    if (!fs.existsSync(testPromptsPath)) {
      fs.mkdirSync(testPromptsPath, { recursive: true });
    }

    const driver = new FilesystemDriver(testPromptsPath);
    app = createApp(driver);

    await initSchema();
    const db = getDb();
    const keyHash = hashApiKey('pm_test_webhook_key');
    await db
      .prepare('INSERT INTO api_keys (key_hash, name, scopes) VALUES (?, ?, ?)')
      .run(keyHash, 'webhook-test', 'read,write');
    apiKey = 'pm_test_webhook_key';
  });

  afterAll(async () => {
    await closeDb();
    const fs = require('fs');
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  function signPayload(payload: string): string {
    return `sha256=${crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex')}`;
  }

  it('should return 401 for missing signature', async () => {
    const res = await request(app)
      .post('/webhooks/github')
      .set('X-GitHub-Event', 'push')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ ref: 'refs/heads/main' }));

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Missing signature');
  });

  it('should return 401 for invalid signature', async () => {
    const payload = JSON.stringify({ ref: 'refs/heads/main' });
    const res = await request(app)
      .post('/webhooks/github')
      .set('X-GitHub-Event', 'push')
      .set('X-Hub-Signature-256', 'sha256=invalid')
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid signature');
  });

  it('should ignore non-push events', async () => {
    const payload = JSON.stringify({ action: 'opened' });
    const res = await request(app)
      .post('/webhooks/github')
      .set('X-GitHub-Event', 'ping')
      .set('X-Hub-Signature-256', signPayload(payload))
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Event ignored');
    expect(res.body.event).toBe('ping');
  });

  it('should trigger sync on valid push event', async () => {
    const payload = JSON.stringify({ ref: 'refs/heads/main' });
    const res = await request(app)
      .post('/webhooks/github')
      .set('X-GitHub-Event', 'push')
      .set('X-Hub-Signature-256', signPayload(payload))
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Sync triggered');
  });

  it('should return 500 when webhook secret is not configured', async () => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
    const freshDriver = new FilesystemDriver(testPromptsPath + '-fresh');
    const freshApp = createApp(freshDriver);

    const payload = JSON.stringify({ ref: 'refs/heads/main' });
    const res = await request(freshApp)
      .post('/webhooks/github')
      .set('X-GitHub-Event', 'push')
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Webhook secret not configured');
  });
});
