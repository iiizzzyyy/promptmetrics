import fs from 'fs';
import path from 'path';
import { getDb, initSchema, closeDb } from '@models/promptmetrics-sqlite';
import { TraceController } from '@controllers/promptmetrics-trace.controller';
import { Request, Response } from 'express';

describe('TraceController', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test-trace.db');
  const controller = new TraceController();

  function mockReq(body: unknown, params: Record<string, string> = {}): Partial<Request> {
    return { body, params } as Partial<Request>;
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

  it('creates a trace with auto-generated trace_id', async () => {
    const req = mockReq({ prompt_name: 'test-prompt', version_tag: '1.0.0' });
    const res = mockRes();
    await controller.createTrace(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(201);
    const json = (res.json as jest.Mock).mock.calls[0][0];
    expect(json.trace_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(json.prompt_name).toBe('test-prompt');
    expect(json.version_tag).toBe('1.0.0');
  });

  it('creates a trace with provided trace_id', async () => {
    const traceId = '550e8400-e29b-41d4-a716-446655440000';
    const req = mockReq({ trace_id: traceId, metadata: { agent: 'test' } });
    const res = mockRes();
    await controller.createTrace(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(201);
    expect((res.json as jest.Mock).mock.calls[0][0].trace_id).toBe(traceId);
  });

  it('returns 422 for invalid trace body', async () => {
    const req = mockReq({ metadata: { nested: { bad: true } } });
    const res = mockRes();
    await controller.createTrace(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('gets a trace with its spans', async () => {
    const traceId = '550e8400-e29b-41d4-a716-446655440001';
    const db = getDb();
    db.prepare('INSERT INTO traces (trace_id, prompt_name, metadata_json) VALUES (?, ?, ?)').run(
      traceId,
      'test-prompt',
      JSON.stringify({ agent: 'test' }),
    );
    db.prepare(
      'INSERT INTO spans (trace_id, span_id, name, status, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(traceId, 'span-1', 'step-1', 'ok', 1000, 2000);

    const req = mockReq({}, { trace_id: traceId });
    const res = mockRes();
    await controller.getTrace(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    const json = (res.json as jest.Mock).mock.calls[0][0];
    expect(json.trace_id).toBe(traceId);
    expect(json.spans.length).toBe(1);
    expect(json.spans[0].span_id).toBe('span-1');
    expect(json.spans[0].status).toBe('ok');
  });

  it('returns 404 for non-existent trace', async () => {
    const req = mockReq({}, { trace_id: 'non-existent' });
    const res = mockRes();
    await controller.getTrace(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('creates a span under a trace', async () => {
    const traceId = '550e8400-e29b-41d4-a716-446655440002';
    const db = getDb();
    db.prepare('INSERT INTO traces (trace_id, prompt_name) VALUES (?, ?)').run(traceId, 'test');

    const req = mockReq({ name: 'agent-step-1', status: 'ok', start_time: 1000, end_time: 2000 }, { trace_id: traceId });
    const res = mockRes();
    await controller.createSpan(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(201);
    const json = (res.json as jest.Mock).mock.calls[0][0];
    expect(json.trace_id).toBe(traceId);
    expect(json.name).toBe('agent-step-1');
    expect(json.status).toBe('ok');
    expect(json.span_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('returns 404 when creating span for non-existent trace', async () => {
    const req = mockReq({ name: 'step', status: 'ok' }, { trace_id: 'missing' });
    const res = mockRes();
    await controller.createSpan(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 422 for invalid span body', async () => {
    const req = mockReq({ name: 'step' }, { trace_id: 'any' });
    const res = mockRes();
    await controller.createSpan(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('gets a single span', async () => {
    const traceId = '550e8400-e29b-41d4-a716-446655440003';
    const spanId = '550e8400-e29b-41d4-a716-446655440004';
    const db = getDb();
    db.prepare('INSERT INTO traces (trace_id, prompt_name) VALUES (?, ?)').run(traceId, 'test');
    db.prepare(
      'INSERT INTO spans (trace_id, span_id, name, status, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(traceId, spanId, 'step-2', 'error', 3000, 4000);

    const req = mockReq({}, { trace_id: traceId, span_id: spanId });
    const res = mockRes();
    await controller.getSpan(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    const json = (res.json as jest.Mock).mock.calls[0][0];
    expect(json.span_id).toBe(spanId);
    expect(json.name).toBe('step-2');
    expect(json.status).toBe('error');
  });

  it('returns 404 for non-existent span', async () => {
    const req = mockReq({}, { trace_id: 'any', span_id: 'none' });
    const res = mockRes();
    await controller.getSpan(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
