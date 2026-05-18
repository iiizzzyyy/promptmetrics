import fs from 'fs';
import path from 'path';
import { getDb, initSchema, closeDb } from '@models/promptmetrics-sqlite';
import { AppError } from '@errors/app.error';
import { LabelController } from '@controllers/promptmetrics-label.controller';
import { LabelService } from '@services/label.service';
import { Request, Response } from 'express';

describe('LabelController', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test-label.db');
  const controller = new LabelController(new LabelService());

  function mockReq(
    body: unknown,
    params: Record<string, string> = {},
    query: Record<string, string> = {},
  ): Partial<Request> {
    return { body, params, query } as Partial<Request>;
  }

  function mockRes(): Partial<Response> {
    const res: Partial<Response> = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    return res;
  }

  beforeEach(async () => {
    process.env.SQLITE_PATH = testDbPath;
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
    await closeDb();
    await initSchema();

    // Seed a prompt so label creation can validate it exists
    const db = getDb();
    await db
      .prepare(
        `INSERT INTO prompts (name, version_tag, status, driver, created_at) VALUES (?, ?, 'active', 'filesystem', ?)`,
      )
      .run('welcome', '1.0.0', Math.floor(Date.now() / 1000));
  });

  afterEach(async () => {
    await closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
  });

  it('creates a label', async () => {
    const req = mockReq({ name: 'production', version_tag: '1.0.0' }, { name: 'welcome' });
    const res = mockRes();
    await controller.createLabel(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(201);
    const json = (res.json as jest.Mock).mock.calls[0][0];
    expect(json.prompt_name).toBe('welcome');
    expect(json.name).toBe('production');
    expect(json.version_tag).toBe('1.0.0');
  });

  it('updates existing label on duplicate (upsert)', async () => {
    const db = getDb();
    // Add a second version for upsert
    await db
      .prepare(
        `INSERT INTO prompts (name, version_tag, status, driver, created_at) VALUES (?, ?, 'active', 'filesystem', ?)`,
      )
      .run('welcome', '1.1.0', Math.floor(Date.now() / 1000));
    await db
      .prepare('INSERT INTO prompt_labels (prompt_name, name, version_tag) VALUES (?, ?, ?)')
      .run('welcome', 'production', '1.0.0');

    const req = mockReq({ name: 'production', version_tag: '1.1.0' }, { name: 'welcome' });
    const res = mockRes();
    await controller.createLabel(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(201);
    const json = (res.json as jest.Mock).mock.calls[0][0];
    expect(json.version_tag).toBe('1.1.0');
  });

  it('auto-populates version_tag from latest prompt version', async () => {
    const req = mockReq({ name: 'staging' }, { name: 'welcome' });
    const res = mockRes();
    await controller.createLabel(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(201);
    const json = (res.json as jest.Mock).mock.calls[0][0];
    expect(json.name).toBe('staging');
    expect(json.version_tag).toBe('1.0.0');
  });

  it('returns 404 when prompt does not exist for label creation', async () => {
    const req = mockReq({ name: 'production', version_tag: '1.0.0' }, { name: 'nonexistent' });
    const res = mockRes();
    await expect(controller.createLabel(req as Request, res as Response)).rejects.toThrow(
      expect.objectContaining({ statusCode: 404, code: 'NOT_FOUND' }),
    );
  });

  it('returns 400 when specified version does not exist', async () => {
    const req = mockReq({ name: 'production', version_tag: '9.9.9' }, { name: 'welcome' });
    const res = mockRes();
    await expect(controller.createLabel(req as Request, res as Response)).rejects.toThrow(
      expect.objectContaining({ statusCode: 400, code: 'BAD_REQUEST' }),
    );
  });

  it('returns 422 for invalid label body', async () => {
    const req = mockReq({ name: '' }, { name: 'welcome' });
    const res = mockRes();
    await expect(controller.createLabel(req as Request, res as Response)).rejects.toThrow(
      expect.objectContaining({ statusCode: 422, code: 'VALIDATION_FAILED' }),
    );
  });

  it('lists labels for a prompt', async () => {
    const db = getDb();
    await db
      .prepare('INSERT INTO prompt_labels (prompt_name, name, version_tag) VALUES (?, ?, ?)')
      .run('welcome', 'production', '1.0.0');
    await db
      .prepare('INSERT INTO prompt_labels (prompt_name, name, version_tag) VALUES (?, ?, ?)')
      .run('welcome', 'staging', '1.1.0');

    const req = mockReq({}, { name: 'welcome' });
    const res = mockRes();
    await controller.listLabels(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    const json = (res.json as jest.Mock).mock.calls[0][0];
    expect(json.items.length).toBe(2);
    expect(json.total).toBe(2);
  });

  it('gets a specific label', async () => {
    const db = getDb();
    await db
      .prepare('INSERT INTO prompt_labels (prompt_name, name, version_tag) VALUES (?, ?, ?)')
      .run('welcome', 'production', '1.0.0');

    const req = mockReq({}, { name: 'welcome', label_name: 'production' });
    const res = mockRes();
    await controller.getLabel(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    const json = (res.json as jest.Mock).mock.calls[0][0];
    expect(json.name).toBe('production');
    expect(json.version_tag).toBe('1.0.0');
  });

  it('returns 404 for non-existent label', async () => {
    const req = mockReq({}, { name: 'welcome', label_name: 'missing' });
    const res = mockRes();
    await expect(controller.getLabel(req as Request, res as Response)).rejects.toThrow(
      expect.objectContaining({ statusCode: 404, code: 'NOT_FOUND' }),
    );
  });

  it('deletes a label', async () => {
    const db = getDb();
    await db
      .prepare('INSERT INTO prompt_labels (prompt_name, name, version_tag) VALUES (?, ?, ?)')
      .run('welcome', 'production', '1.0.0');

    const req = mockReq({}, { name: 'welcome', label_name: 'production' });
    const res = mockRes();
    await controller.deleteLabel(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('returns 404 when deleting non-existent label', async () => {
    const req = mockReq({}, { name: 'welcome', label_name: 'missing' });
    const res = mockRes();
    await expect(controller.deleteLabel(req as Request, res as Response)).rejects.toThrow(
      expect.objectContaining({ statusCode: 404, code: 'NOT_FOUND' }),
    );
  });
});
