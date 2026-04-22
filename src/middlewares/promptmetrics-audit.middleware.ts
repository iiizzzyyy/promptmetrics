import { Request, Response, NextFunction } from 'express';
import { getDb } from '@models/promptmetrics-sqlite';

export function auditLog(action: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalSend = res.send.bind(res);

    res.send = function (body: unknown): Response {
      res.send = originalSend;

      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const apiKey = req.apiKey;
          const db = getDb();

          let promptName: string | null = null;
          let versionTag: string | null = null;

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

          db.prepare(
            'INSERT INTO audit_logs (action, prompt_name, version_tag, api_key_name, ip_address) VALUES (?, ?, ?, ?, ?)',
          ).run(
            action,
            promptName,
            versionTag,
            apiKey?.name || 'unknown',
            req.ip || req.socket.remoteAddress || 'unknown',
          );
        } catch (err) {
          console.error('Failed to write audit log:', err);
        }
      }

      return res.send(body);
    };

    next();
  };
}
