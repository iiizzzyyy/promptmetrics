import { Request, Response } from 'express';
import { AppError } from '@errors/app.error';
import { LogService } from '@services/log.service';
import { logMetadataSchema } from '@validation-schemas/promptmetrics-log.schema';
import { logMetadata } from '@services/promptmetrics-logger.service';

export class LogController {
  constructor(private service: LogService) {}

  async createLog(req: Request, res: Response): Promise<void> {
    const { error, value } = logMetadataSchema.validate(req.body, { abortEarly: false });
    if (error) {
      throw AppError.validationFailed(error.details.map((d) => d.message));
    }

    const workspaceId = req.workspaceId || 'default';
    const logEntry = await this.service.createLog(value, workspaceId);

    console.log(JSON.stringify({ type: 'promptmetrics.log', ...logEntry }));

    if (value.metadata) {
      logMetadata(value.metadata);
    }

    res.status(202).json({ id: logEntry.id, status: 'accepted' });
  }
}
