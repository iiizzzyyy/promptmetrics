import { Request, Response, NextFunction } from 'express';
import { getDb } from '@models/promptmetrics-sqlite';

const WINDOW_MS = 60 * 1000;
const DEFAULT_MAX = 100;

function getDbOrNull() {
  try {
    return getDb();
  } catch {
    return null;
  }
}

export function rateLimitPerKey(windowMs = WINDOW_MS, maxRequests = DEFAULT_MAX) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const apiKeyName = req.apiKey?.name;
    if (!apiKeyName) {
      return next();
    }

    const db = getDbOrNull();
    if (!db) {
      return next();
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        window_start INTEGER NOT NULL,
        count INTEGER NOT NULL DEFAULT 0
      )
    `);

    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;

    const row = db.prepare('SELECT window_start, count FROM rate_limits WHERE key = ?').get(apiKeyName) as
      | { window_start: number; count: number }
      | undefined;

    if (!row || row.window_start < windowStart) {
      db.prepare('INSERT OR REPLACE INTO rate_limits (key, window_start, count) VALUES (?, ?, ?)').run(
        apiKeyName,
        windowStart,
        1,
      );
      res.setHeader('RateLimit-Limit', String(maxRequests));
      res.setHeader('RateLimit-Remaining', String(maxRequests - 1));
      res.setHeader('RateLimit-Reset', String(Math.ceil((windowStart + windowMs) / 1000)));
      return next();
    }

    if (row.count >= maxRequests) {
      const retryAfter = Math.ceil((row.window_start + windowMs - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
      });
      return;
    }

    db.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?').run(apiKeyName);
    res.setHeader('RateLimit-Limit', String(maxRequests));
    res.setHeader('RateLimit-Remaining', String(maxRequests - row.count - 1));
    res.setHeader('RateLimit-Reset', String(Math.ceil((row.window_start + windowMs) / 1000)));
    return next();
  };
}
