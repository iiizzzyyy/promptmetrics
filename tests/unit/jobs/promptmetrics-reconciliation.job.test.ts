import fs from 'fs';
import path from 'path';
import { PromptReconciliationJob } from '@jobs/promptmetrics-reconciliation.job';
import { PromptDriver } from '@drivers/promptmetrics-driver.interface';
import { getDb, initSchema, closeDb } from '@models/promptmetrics-sqlite';

describe('PromptReconciliationJob', () => {
  const testDbPath = path.resolve(__dirname, '../../../data/test-reconciliation.db');
  let driver: PromptDriver;
  let job: PromptReconciliationJob;

  beforeEach(async () => {
    process.env.SQLITE_PATH = testDbPath;
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
    await closeDb();
    await initSchema();

    driver = {
      sync: jest.fn().mockResolvedValue(undefined),
      listPrompts: jest.fn(),
      getPrompt: jest.fn(),
      createPrompt: jest.fn(),
      listVersions: jest.fn(),
      search: jest.fn(),
    } as unknown as PromptDriver;

    jest.useFakeTimers();
  });

  afterEach(async () => {
    jest.useRealTimers();
    await closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
  });

  it('should promote pending prompts that exist in storage', async () => {
    (driver.getPrompt as jest.Mock).mockResolvedValue({
      content: { name: 'exists', version: '1.0.0', messages: [] },
      version: { name: 'exists', version_tag: '1.0.0', created_at: Math.floor(Date.now() / 1000) },
    });

    const db = getDb();
    const oldTime = Math.floor(Date.now() / 1000) - 300;
    await db
      .prepare(
        "INSERT INTO prompts (name, version_tag, workspace_id, status, driver, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run('exists', '1.0.0', 'default', 'pending', 'filesystem', oldTime);

    job = new PromptReconciliationJob(driver, 60000);
    await job.runReconcile();

    const row = (await db.prepare("SELECT status FROM prompts WHERE name = ? AND version_tag = ?").get('exists', '1.0.0')) as
      | { status: string }
      | undefined;
    expect(row?.status).toBe('active');
  });

  it('should delete pending prompts that do not exist in storage', async () => {
    (driver.getPrompt as jest.Mock).mockResolvedValue(undefined);

    const db = getDb();
    const oldTime = Math.floor(Date.now() / 1000) - 300;
    await db
      .prepare(
        "INSERT INTO prompts (name, version_tag, workspace_id, status, driver, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run('missing', '1.0.0', 'default', 'pending', 'filesystem', oldTime);

    job = new PromptReconciliationJob(driver, 60000);
    await job.runReconcile();

    const row = await db.prepare("SELECT 1 FROM prompts WHERE name = ? AND version_tag = ?").get('missing', '1.0.0');
    expect(row).toBeUndefined();
  });

  it('should ignore pending prompts newer than 120 seconds', async () => {
    (driver.getPrompt as jest.Mock).mockResolvedValue(undefined);

    const db = getDb();
    const recentTime = Math.floor(Date.now() / 1000) - 10;
    await db
      .prepare(
        "INSERT INTO prompts (name, version_tag, workspace_id, status, driver, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run('recent', '1.0.0', 'default', 'pending', 'filesystem', recentTime);

    job = new PromptReconciliationJob(driver, 60000);
    await job.runReconcile();

    const row = (await db.prepare("SELECT status FROM prompts WHERE name = ? AND version_tag = ?").get('recent', '1.0.0')) as
      | { status: string }
      | undefined;
    expect(row?.status).toBe('pending');
    expect(driver.getPrompt).not.toHaveBeenCalled();
  });

  it('should handle driver errors gracefully and continue processing', async () => {
    (driver.getPrompt as jest.Mock)
      .mockRejectedValueOnce(new Error('Storage error'))
      .mockResolvedValueOnce({
        content: { name: 'ok', version: '1.0.0', messages: [] },
        version: { name: 'ok', version_tag: '1.0.0', created_at: Math.floor(Date.now() / 1000) },
      });

    const db = getDb();
    const oldTime = Math.floor(Date.now() / 1000) - 300;
    await db
      .prepare(
        "INSERT INTO prompts (name, version_tag, workspace_id, status, driver, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run('err', '1.0.0', 'default', 'pending', 'filesystem', oldTime);
    await db
      .prepare(
        "INSERT INTO prompts (name, version_tag, workspace_id, status, driver, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run('ok', '1.0.0', 'default', 'pending', 'filesystem', oldTime);

    job = new PromptReconciliationJob(driver, 60000);
    await job.runReconcile();

    const errRow = (await db.prepare("SELECT status FROM prompts WHERE name = ? AND version_tag = ?").get('err', '1.0.0')) as
      | { status: string }
      | undefined;
    expect(errRow?.status).toBe('pending');

    const okRow = (await db.prepare("SELECT status FROM prompts WHERE name = ? AND version_tag = ?").get('ok', '1.0.0')) as
      | { status: string }
      | undefined;
    expect(okRow?.status).toBe('active');
  });

  it('should call reconcile on interval when started', () => {
    const spy = jest.spyOn(PromptReconciliationJob.prototype, 'runReconcile').mockResolvedValue();
    job = new PromptReconciliationJob(driver, 1000);
    job.start();
    expect(spy).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1000);
    expect(spy).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(2000);
    expect(spy).toHaveBeenCalledTimes(4);

    job.stop();
    spy.mockRestore();
  });

  it('should stop calling reconcile after stop', () => {
    const spy = jest.spyOn(PromptReconciliationJob.prototype, 'runReconcile').mockResolvedValue();
    job = new PromptReconciliationJob(driver, 1000);
    job.start();
    job.stop();

    jest.advanceTimersByTime(5000);
    expect(spy).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });
});
