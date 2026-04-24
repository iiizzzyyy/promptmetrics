import fs from 'fs';
import path from 'path';
import { getDb, initSchema, closeDb } from '@models/promptmetrics-sqlite';
import { AppError } from '@errors/app.error';
import { RunController } from '@controllers/promptmetrics-run.controller';
import { RunService } from '@services/run.service';
import { Request, Response } from 'express';

describe('RunController', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test-run.db');
  const controller = new RunController(new RunService());

  function mockReq(body: unknown, params: Record<string, string> = {}, query: Record<string, string> = {}): Partial<Request> {
    return { body, params, query } as Partial<Request>;
  }

  function mockRes(): Partial<Response> {
    const res: Partial<Response> = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  }

  beforeEach(() => {
    process.env.SQLITE_PATH = testDbPath;
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
    closeDb();
    initSchema();
  });

  afterEach(() => {
    closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
  });

  it('creates a run with auto-generated run_id', async () => {
    const req = mockReq({ workflow_name: 'test-workflow', input: { user: 'Alice' } });
    const res = mockRes();
    await controller.createRun(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(201);
    const json = (res.json as jest.Mock).mock.calls[0][0];
    expect(json.run_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(json.workflow_name).toBe('test-workflow');
    expect(json.status).toBe('running');
  });

  it('creates a run with provided run_id', async () => {
    const runId = '550e8400-e29b-41d4-a716-446655440000';
    const req = mockReq({ run_id: runId, workflow_name: 'wf-1', status: 'completed', output: { result: 'ok' } });
    const res = mockRes();
    await controller.createRun(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(201);
    expect((res.json as jest.Mock).mock.calls[0][0].run_id).toBe(runId);
    expect((res.json as jest.Mock).mock.calls[0][0].status).toBe('completed');
  });

  it('returns 422 for invalid run body', async () => {
    const req = mockReq({ status: 'invalid' });
    const res = mockRes();
    await expect(controller.createRun(req as Request, res as Response)).rejects.toThrow(
      expect.objectContaining({ statusCode: 422, code: 'VALIDATION_FAILED' }),
    );
  });

  it('returns 404 when trace_id does not exist', async () => {
    const req = mockReq({ workflow_name: 'wf-1', trace_id: '550e8400-e29b-41d4-a716-446655440099' });
    const res = mockRes();
    await expect(controller.createRun(req as Request, res as Response)).rejects.toThrow(
      expect.objectContaining({ statusCode: 404, code: 'NOT_FOUND' }),
    );
  });

  it('gets a run by id', async () => {
    const runId = '550e8400-e29b-41d4-a716-446655440001';
    const db = getDb();
    db.prepare(
      'INSERT INTO runs (run_id, workflow_name, status, input_json, metadata_json) VALUES (?, ?, ?, ?, ?)',
    ).run(runId, 'wf-1', 'running', JSON.stringify({ user: 'Alice' }), JSON.stringify({ agent: 'test' }));

    const req = mockReq({}, { run_id: runId });
    const res = mockRes();
    await controller.getRun(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    const json = (res.json as jest.Mock).mock.calls[0][0];
    expect(json.run_id).toBe(runId);
    expect(json.workflow_name).toBe('wf-1');
    expect(json.input).toEqual({ user: 'Alice' });
    expect(json.metadata).toEqual({ agent: 'test' });
  });

  it('returns 404 for non-existent run', async () => {
    const req = mockReq({}, { run_id: 'non-existent' });
    const res = mockRes();
    await expect(controller.getRun(req as Request, res as Response)).rejects.toThrow(
      expect.objectContaining({ statusCode: 404, code: 'NOT_FOUND' }),
    );
  });

  it('updates run status and output', async () => {
    const runId = '550e8400-e29b-41d4-a716-446655440002';
    const db = getDb();
    db.prepare('INSERT INTO runs (run_id, workflow_name, status) VALUES (?, ?, ?)').run(runId, 'wf-1', 'running');

    const req = mockReq({ status: 'completed', output: { result: 'ok' } }, { run_id: runId });
    const res = mockRes();
    await controller.updateRun(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    expect((res.json as jest.Mock).mock.calls[0][0].status).toBe('updated');

    const updated = db.prepare('SELECT * FROM runs WHERE run_id = ?').get(runId) as { status: string; output_json: string };
    expect(updated.status).toBe('completed');
    expect(JSON.parse(updated.output_json)).toEqual({ result: 'ok' });
  });

  it('returns 404 when updating non-existent run', async () => {
    const req = mockReq({ status: 'completed' }, { run_id: 'missing' });
    const res = mockRes();
    await expect(controller.updateRun(req as Request, res as Response)).rejects.toThrow(
      expect.objectContaining({ statusCode: 404, code: 'NOT_FOUND' }),
    );
  });

  it('lists runs with pagination', async () => {
    const db = getDb();
    for (let i = 0; i < 5; i++) {
      db.prepare('INSERT INTO runs (run_id, workflow_name, status) VALUES (?, ?, ?)').run(
        `run-${i}`,
        `wf-${i}`,
        'running',
      );
    }

    const req = mockReq({}, {}, { page: '1', limit: '3' });
    const res = mockRes();
    await controller.listRuns(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    const json = (res.json as jest.Mock).mock.calls[0][0];
    expect(json.items.length).toBe(3);
    expect(json.total).toBe(5);
    expect(json.page).toBe(1);
    expect(json.limit).toBe(3);
    expect(json.totalPages).toBe(2);
  });
});
