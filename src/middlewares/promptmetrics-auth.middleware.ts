import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AppError } from '@errors/app.error';
import { getDb } from '@models/promptmetrics-sqlite';
import { config } from '@config/index';

export function hashApiKey(key: string): string {
  return crypto.createHmac('sha256', config.apiKeySalt).update(key).digest('hex');
}

export async function authenticateApiKey(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    throw AppError.unauthorized('Missing X-API-Key header');
  }

  const keyHash = hashApiKey(apiKey);
  const db = getDb();

  const row = (await db.prepare('SELECT * FROM api_keys WHERE key_hash = ?').get(keyHash)) as
    | { name: string; scopes: string; last_used_at: number | null; expires_at: number | null; workspace_id: string }
    | undefined;

  if (!row) {
    throw AppError.unauthorized('Invalid API key');
  }

  if (row.expires_at !== null && row.expires_at !== undefined && row.expires_at < Math.floor(Date.now() / 1000)) {
    throw AppError.unauthorized('API key expired');
  }

  const workspaceId = req.workspaceId || 'default';
  if (row.workspace_id !== workspaceId) {
    throw AppError.unauthorized('API key does not belong to this workspace');
  }

  await db.prepare('UPDATE api_keys SET last_used_at = ? WHERE key_hash = ?').run(
    Math.floor(Date.now() / 1000),
    keyHash,
  );

  req.apiKey = {
    name: row.name,
    scopes: row.scopes.split(','),
    workspace_id: row.workspace_id,
  };

  next();
}

export function requireScope(scope: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const apiKey = req.apiKey;
    if (!apiKey || !apiKey.scopes.includes(scope)) {
      throw AppError.forbidden(`Missing required scope: ${scope}`);
    }
    next();
  };
}
