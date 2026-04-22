import { Request, Response } from 'express';
import crypto from 'crypto';
import { getDb } from '@models/promptmetrics-sqlite';
import { createTraceSchema, createSpanSchema } from '@validation-schemas/promptmetrics-trace.schema';

export class TraceController {
  async createTrace(req: Request, res: Response): Promise<void> {
    const { error, value } = createTraceSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(422).json({
        error: 'Validation failed',
        details: error.details.map((d) => d.message),
      });
      return;
    }

    try {
      const db = getDb();
      const traceId = value.trace_id || crypto.randomUUID();

      db.prepare(
        `INSERT INTO traces (trace_id, prompt_name, version_tag, metadata_json)
         VALUES (?, ?, ?, ?)`,
      ).run(
        traceId,
        value.prompt_name || null,
        value.version_tag || null,
        value.metadata ? JSON.stringify(value.metadata) : null,
      );

      res.status(201).json({
        trace_id: traceId,
        prompt_name: value.prompt_name,
        version_tag: value.version_tag,
        status: 'created',
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to create trace', message: (err as Error).message });
    }
  }

  async getTrace(req: Request, res: Response): Promise<void> {
    const traceId = req.params.trace_id as string;

    try {
      const db = getDb();
      const trace = db.prepare('SELECT * FROM traces WHERE trace_id = ?').get(traceId) as
        | { trace_id: string; prompt_name: string | null; version_tag: string | null; metadata_json: string | null; created_at: number }
        | undefined;

      if (!trace) {
        res.status(404).json({ error: 'Trace not found' });
        return;
      }

      const spans = db.prepare('SELECT * FROM spans WHERE trace_id = ? ORDER BY start_time ASC').all(traceId) as Array<{
        span_id: string;
        parent_id: string | null;
        name: string;
        status: string;
        start_time: number | null;
        end_time: number | null;
        metadata_json: string | null;
        created_at: number;
      }>;

      res.status(200).json({
        trace_id: trace.trace_id,
        prompt_name: trace.prompt_name,
        version_tag: trace.version_tag,
        metadata: trace.metadata_json ? JSON.parse(trace.metadata_json) : {},
        created_at: trace.created_at,
        spans: spans.map((s) => ({
          span_id: s.span_id,
          parent_id: s.parent_id,
          name: s.name,
          status: s.status,
          start_time: s.start_time,
          end_time: s.end_time,
          metadata: s.metadata_json ? JSON.parse(s.metadata_json) : {},
          created_at: s.created_at,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to get trace', message: (err as Error).message });
    }
  }

  async createSpan(req: Request, res: Response): Promise<void> {
    const traceId = req.params.trace_id as string;
    const { error, value } = createSpanSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(422).json({
        error: 'Validation failed',
        details: error.details.map((d) => d.message),
      });
      return;
    }

    try {
      const db = getDb();
      const trace = db.prepare('SELECT trace_id FROM traces WHERE trace_id = ?').get(traceId) as
        | { trace_id: string }
        | undefined;

      if (!trace) {
        res.status(404).json({ error: 'Trace not found' });
        return;
      }

      const spanId = value.span_id || crypto.randomUUID();

      db.prepare(
        `INSERT INTO spans (trace_id, span_id, parent_id, name, status, start_time, end_time, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        traceId,
        spanId,
        value.parent_id || null,
        value.name,
        value.status,
        value.start_time || null,
        value.end_time || null,
        value.metadata ? JSON.stringify(value.metadata) : null,
      );

      res.status(201).json({
        trace_id: traceId,
        span_id: spanId,
        name: value.name,
        status: value.status,
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to create span', message: (err as Error).message });
    }
  }

  async getSpan(req: Request, res: Response): Promise<void> {
    const traceId = req.params.trace_id as string;
    const spanId = req.params.span_id as string;

    try {
      const db = getDb();
      const span = db.prepare('SELECT * FROM spans WHERE trace_id = ? AND span_id = ?').get(traceId, spanId) as
        | { span_id: string; parent_id: string | null; name: string; status: string; start_time: number | null; end_time: number | null; metadata_json: string | null; created_at: number }
        | undefined;

      if (!span) {
        res.status(404).json({ error: 'Span not found' });
        return;
      }

      res.status(200).json({
        span_id: span.span_id,
        parent_id: span.parent_id,
        name: span.name,
        status: span.status,
        start_time: span.start_time,
        end_time: span.end_time,
        metadata: span.metadata_json ? JSON.parse(span.metadata_json) : {},
        created_at: span.created_at,
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to get span', message: (err as Error).message });
    }
  }
}
