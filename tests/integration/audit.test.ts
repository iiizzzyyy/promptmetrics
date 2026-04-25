import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '@app';
import { getDb, closeDb, initSchema } from '@models/promptmetrics-sqlite';
import { hashApiKey } from '@middlewares/promptmetrics-auth.middleware';
import { FilesystemDriver } from '@drivers/promptmetrics-filesystem-driver';
import { auditLogService } from '@services/audit-log.service';

describe('Audit Logging Integration', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test-audit.db');
  const testPromptsPath = path.resolve(__dirname, '../../data/test-audit-prompts');
  let app: ReturnType<typeof createApp>;
  let writeApiKey: string;
  let adminApiKey: string;

  beforeAll(async () => {
    process.env.SQLITE_PATH = testDbPath;
    process.env.DRIVER = 'filesystem';
    process.env.API_KEY_SALT = 'test-salt';

    closeDb();

    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
    if (fs.existsSync(testPromptsPath)) fs.rmSync(testPromptsPath, { recursive: true });

    await initSchema();

    const db = getDb();
    writeApiKey = 'pm_testwrite789';
    adminApiKey = 'pm_testadmin999';

    db.prepare('INSERT OR REPLACE INTO api_keys (key_hash, name, scopes) VALUES (?, ?, ?)').run(
      hashApiKey(writeApiKey),
      'test-write-key',
      'read,write',
    );
    db.prepare('INSERT OR REPLACE INTO api_keys (key_hash, name, scopes) VALUES (?, ?, ?)').run(
      hashApiKey(adminApiKey),
      'test-admin-key',
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

  it('should create audit log on prompt creation', async () => {
    await request(app)
      .post('/v1/prompts')
      .set('X-API-Key', writeApiKey)
      .send({
        name: 'audit-test',
        version: '1.0.0',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Test template' },
        ],
      });

    await auditLogService.flush();

    const db = getDb();
    const row = db
      .prepare('SELECT * FROM audit_logs WHERE prompt_name = ? ORDER BY timestamp DESC LIMIT 1')
      .get('audit-test') as { action: string; api_key_name: string } | undefined;

    expect(row).toBeDefined();
    expect(row!.action).toBe('create_prompt');
    expect(row!.api_key_name).toBe('test-write-key');
  });

  it('should return 403 for audit-logs without admin scope', async () => {
    const res = await request(app).get('/v1/audit-logs').set('X-API-Key', writeApiKey);
    expect(res.status).toBe(403);
  });

  it('should return audit logs with admin scope', async () => {
    await auditLogService.flush();

    const res = await request(app).get('/v1/audit-logs').set('X-API-Key', adminApiKey);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.total).toBeGreaterThan(0);
  });
});
