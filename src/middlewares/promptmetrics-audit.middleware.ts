import { Request, Response, NextFunction } from 'express';
import { auditLogService } from '@services/audit-log.service';

export function auditLog(action: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const apiKey = req.apiKey;

          let promptName: string | undefined;
          let versionTag: string | undefined;

          if (req.params.name) {
            promptName = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
          }
          if (req.body && req.body.name) {
            promptName = req.body.name;
          }
          if (req.body && req.body.version) {
            versionTag = req.body.version;
          }
          if (req.query.version) {
            versionTag = req.query.version as string;
          }

          auditLogService.enqueue({
            action,
            prompt_name: promptName ? promptName.slice(0, 256) : undefined,
            version_tag: versionTag ? versionTag.slice(0, 256) : undefined,
            api_key_name: apiKey?.name || 'unknown',
            ip_address: req.ip || req.socket.remoteAddress || 'unknown',
            workspace_id: req.workspaceId || 'default',
          });
        } catch (err) {
          console.error('Failed to enqueue audit log:', err);
        }
      }
    });

    next();
  };
}
