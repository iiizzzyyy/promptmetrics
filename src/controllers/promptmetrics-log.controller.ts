import { Request, Response } from 'express';
import { getDb } from '@models/promptmetrics-sqlite';
import { logMetadataSchema } from '@validation-schemas/promptmetrics-log.schema';
import { logMetadata } from '@services/promptmetrics-logger.service';

export class LogController {
  async createLog(req: Request, res: Response): Promise<void> {
    const { error, value } = logMetadataSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(422).json({
        error: 'Validation failed',
        details: error.details.map((d) => d.message),
      });
      return;
    }

    try {
      const db = getDb();
      const result = db
        .prepare(
          `INSERT INTO logs (prompt_name, version_tag, metadata_json, provider, model, tokens_in, tokens_out, latency_ms, cost_usd)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          value.prompt_name,
          value.version_tag,
          value.metadata ? JSON.stringify(value.metadata) : null,
          value.provider || null,
          value.model || null,
          value.tokens_in || null,
          value.tokens_out || null,
          value.latency_ms || null,
          value.cost_usd || null,
        );

      const logEntry = {
        id: result.lastInsertRowid,
        ...value,
        metadata: value.metadata || {},
        created_at: Math.floor(Date.now() / 1000),
      };

      // Default: structured JSON to stdout
      console.log(JSON.stringify({ type: 'promptmetrics.log', ...logEntry }));

      // OTel: emit metadata as span attributes if enabled
      if (value.metadata) {
        logMetadata(value.metadata);
      }

      res.status(202).json({ id: result.lastInsertRowid, status: 'accepted' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to log metadata', message: (err as Error).message });
    }
  }
}
