import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getDb } from '@models/promptmetrics-sqlite';
import { config } from '@config/index';

export function hashApiKey(key: string): string {
  return crypto.createHmac('sha256', config.apiKeySalt).update(key).digest('hex');
}

export function authenticateApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    res.status(401).json({ error: 'Unauthorized', message: 'Missing X-API-Key header' });
    return;
  }

  const keyHash = hashApiKey(apiKey);
  const db = getDb();

  const row = db.prepare('SELECT * FROM api_keys WHERE key_hash = ?').get(keyHash) as
    | { name: string; scopes: string; last_used_at: number | null }
    | undefined;

  if (!row) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid API key' });
    return;
  }

  db.prepare('UPDATE api_keys SET last_used_at = ? WHERE key_hash = ?').run(
    Math.floor(Date.now() / 1000),
    keyHash,
  );

  req.apiKey = {
    name: row.name,
    scopes: row.scopes.split(','),
  };

  next();
}

export function requireScope(scope: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const apiKey = req.apiKey;
    if (!apiKey || !apiKey.scopes.includes(scope)) {
      res.status(403).json({ error: 'Forbidden', message: `Missing required scope: ${scope}` });
      return;
    }
    next();
  };
}
