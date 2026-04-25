import { Request, Response } from 'express';
import { AppError } from '@errors/app.error';
import { TraceService } from '@services/trace.service';
import { createTraceSchema, createSpanSchema } from '@validation-schemas/promptmetrics-trace.schema';

export class TraceController {
  constructor(private service: TraceService) {}

  async createTrace(req: Request, res: Response): Promise<void> {
    const { error, value } = createTraceSchema.validate(req.body, { abortEarly: false });
    if (error) {
      throw AppError.validationFailed(error.details.map((d) => d.message));
    }

    const workspaceId = req.workspaceId || 'default';
    const trace = await this.service.createTrace(value, workspaceId);

    res.status(201).json({
      trace_id: trace.trace_id,
      prompt_name: trace.prompt_name,
      version_tag: trace.version_tag,
      status: 'created',
    });
  }

  async getTrace(req: Request, res: Response): Promise<void> {
    const traceId = req.params.trace_id as string;
    const workspaceId = req.workspaceId || 'default';
    const { trace, spans } = await this.service.getTrace(traceId, workspaceId);

    res.status(200).json({
      trace_id: trace.trace_id,
      prompt_name: trace.prompt_name,
      version_tag: trace.version_tag,
      metadata: trace.metadata,
      created_at: trace.created_at,
      spans,
    });
  }

  async createSpan(req: Request, res: Response): Promise<void> {
    const traceId = req.params.trace_id as string;
    const { error, value } = createSpanSchema.validate(req.body, { abortEarly: false });
    if (error) {
      throw AppError.validationFailed(error.details.map((d) => d.message));
    }

    const workspaceId = req.workspaceId || 'default';
    const span = await this.service.createSpan(traceId, value, workspaceId);

    res.status(201).json({
      trace_id: traceId,
      span_id: span.span_id,
      name: span.name,
      status: span.status,
    });
  }

  async getSpan(req: Request, res: Response): Promise<void> {
    const traceId = req.params.trace_id as string;
    const spanId = req.params.span_id as string;
    const workspaceId = req.workspaceId || 'default';

    const span = await this.service.getSpan(traceId, spanId, workspaceId);

    res.status(200).json({
      span_id: span.span_id,
      parent_id: span.parent_id,
      name: span.name,
      status: span.status,
      start_time: span.start_time,
      end_time: span.end_time,
      metadata: span.metadata,
      created_at: span.created_at,
    });
  }
}
