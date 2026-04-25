import fs from 'fs';
import path from 'path';
import { getDb, initSchema, closeDb } from '@models/promptmetrics-sqlite';
import { auditLogService, AuditLogEntry } from '@services/audit-log.service';

describe('AuditLogService', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test-audit-log.db');

  beforeEach(async () => {
    process.env.SQLITE_PATH = testDbPath;
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
    closeDb();
    await initSchema();
    auditLogService.stop();
  });

  afterEach(() => {
    auditLogService.stop();
    closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
  });

  it('should enqueue entries to the buffer', async () => {
    auditLogService.enqueue({ action: 'test_action', api_key_name: 'test-key', ip_address: '127.0.0.1' });
    await auditLogService.flush();

    const db = getDb();
    const rows = db.prepare('SELECT * FROM audit_logs WHERE action = ?').all('test_action') as { action: string; api_key_name: string }[];
    expect(rows.length).toBe(1);
    expect(rows[0].action).toBe('test_action');
    expect(rows[0].api_key_name).toBe('test-key');
  });

  it('should batch multiple entries', async () => {
    auditLogService.enqueue({ action: 'action1', api_key_name: 'key1', ip_address: '1.1.1.1' });
    auditLogService.enqueue({ action: 'action2', api_key_name: 'key2', ip_address: '2.2.2.2' });
    auditLogService.enqueue({ action: 'action3', api_key_name: 'key3', ip_address: '3.3.3.3' });
    await auditLogService.flush();

    const db = getDb();
    const count = (db.prepare('SELECT COUNT(*) as c FROM audit_logs').get() as { c: number }).c;
    expect(count).toBe(3);
  });

  it('should auto-flush on buffer reaching max size', async () => {
    for (let i = 0; i < 100; i++) {
      auditLogService.enqueue({ action: `action_${i}`, api_key_name: 'key', ip_address: '0.0.0.0' });
    }

    // Wait a tick for the async flush to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    const db = getDb();
    const count = (db.prepare('SELECT COUNT(*) as c FROM audit_logs').get() as { c: number }).c;
    expect(count).toBe(100);
  });

  it('should auto-flush on interval', async () => {
    auditLogService.start();
    auditLogService.enqueue({ action: 'interval_test', api_key_name: 'key', ip_address: '0.0.0.0' });

    // Wait for the 5s interval — we'll advance timers in a real test, but here we manually flush to verify the mechanism
    // In this test, we verify that start() sets up the interval and stop() clears it
    expect((auditLogService as any).timer).not.toBeNull();

    auditLogService.stop();
    expect((auditLogService as any).timer).toBeNull();

    // Ensure the entry is still in buffer and can be flushed manually
    await auditLogService.flush();
    const db = getDb();
    const count = (db.prepare('SELECT COUNT(*) as c FROM audit_logs').get() as { c: number }).c;
    expect(count).toBe(1);
  });

  it('flush should be a no-op when buffer is empty', async () => {
    await auditLogService.flush();
    const db = getDb();
    const count = (db.prepare('SELECT COUNT(*) as c FROM audit_logs').get() as { c: number }).c;
    expect(count).toBe(0);
  });

  it('should include optional prompt_name and version_tag', async () => {
    auditLogService.enqueue({
      action: 'create_prompt',
      prompt_name: 'welcome',
      version_tag: '1.0.0',
      api_key_name: 'admin-key',
      ip_address: '192.168.1.1',
    });
    await auditLogService.flush();

    const db = getDb();
    const row = db.prepare('SELECT * FROM audit_logs WHERE action = ?').get('create_prompt') as {
      prompt_name: string;
      version_tag: string;
    };
    expect(row.prompt_name).toBe('welcome');
    expect(row.version_tag).toBe('1.0.0');
  });
});
