import { Request, Response } from 'express';
import { AppError } from '@errors/app.error';
import { getDb } from '@models/promptmetrics-sqlite';
import { logMetadataSchema } from '@validation-schemas/promptmetrics-log.schema';
import { logMetadata } from '@services/promptmetrics-logger.service';

export class LogController {
  async createLog(req: Request, res: Response): Promise<void> {
    const { error, value } = logMetadataSchema.validate(req.body, { abortEarly: false });
    if (error) {
      throw AppError.validationFailed(error.details.map((d) => d.message));
    }

    const db = getDb();
      const result = db
        .prepare(
          `INSERT INTO logs (prompt_name, version_tag, metadata_json, provider, model, tokens_in, tokens_out, latency_ms, cost_usd, ollama_options, ollama_keep_alive, ollama_format)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          value.ollama_options ? JSON.stringify(value.ollama_options) : null,
          value.ollama_keep_alive || null,
          value.ollama_format ? (typeof value.ollama_format === 'string' ? value.ollama_format : JSON.stringify(value.ollama_format)) : null,
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
  }
}
