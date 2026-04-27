import { Request, Response, NextFunction } from 'express';
import { getDb } from '@models/promptmetrics-sqlite';
import { getRedisClient } from '@services/redis.service';

// Rate-limit configuration -- overridable via environment for CI/test environments.
// Production defaults: 100 requests per 60-second window.
const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000;
const DEFAULT_MAX = Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;

function getDbOrNull() {
  try {
    return getDb();
  } catch {
    return null;
  }
}

async function checkRedisRateLimit(
  apiKeyName: string,
  windowMs: number,
  maxRequests: number,
  res: Response,
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;

  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const key = `rate_limit:${apiKeyName}:${windowStart}`;
  const ttlSeconds = Math.ceil(windowMs / 1000);

  const pipeline = redis.pipeline();
  pipeline.incr(key);
  pipeline.expire(key, ttlSeconds);
  const results = await pipeline.exec();

  const count = results?.[0]?.[1] as number | undefined;
  if (count === undefined) return false;

  const remaining = Math.max(0, maxRequests - count);
  res.setHeader('RateLimit-Limit', String(maxRequests));
  res.setHeader('RateLimit-Remaining', String(remaining));
  res.setHeader('RateLimit-Reset', String(Math.ceil((windowStart + windowMs) / 1000)));

  if (count > maxRequests) {
    const retryAfter = Math.ceil((windowStart + windowMs - now) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
    });
    return true;
  }

  return false;
}

async function checkSqliteRateLimit(
  apiKeyName: string,
  windowMs: number,
  maxRequests: number,
  res: Response,
): Promise<boolean> {
  const db = getDbOrNull();
  if (!db) return false;

  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;

  // Node.js is single-threaded; SELECT + INSERT/UPDATE is already atomic for one request.
  // A transaction wrapper would only add BEGIN...COMMIT overhead without concurrency benefit.
  const row = db.prepare('SELECT window_start, count FROM rate_limits WHERE key = ?').get(apiKeyName) as
    | { window_start: number; count: number }
    | undefined;

  if (!row || row.window_start < windowStart) {
    db.prepare(
      `INSERT INTO rate_limits (key, window_start, count)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        window_start = excluded.window_start,
        count = excluded.count`,
    ).run(apiKeyName, windowStart, 1);
    res.setHeader('RateLimit-Limit', String(maxRequests));
    res.setHeader('RateLimit-Remaining', String(maxRequests - 1));
    res.setHeader('RateLimit-Reset', String(Math.ceil((windowStart + windowMs) / 1000)));
    return false;
  }

  if (row.count >= maxRequests) {
    const retryAfter = Math.ceil((row.window_start + windowMs - now) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
    });
    return true;
  }

  db.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?').run(apiKeyName);
  res.setHeader('RateLimit-Limit', String(maxRequests));
  res.setHeader('RateLimit-Remaining', String(maxRequests - row.count - 1));
  res.setHeader('RateLimit-Reset', String(Math.ceil((row.window_start + windowMs) / 1000)));
  return false;
}

export function rateLimitPerKey(windowMs = WINDOW_MS, maxRequests = DEFAULT_MAX) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const apiKeyName = req.apiKey?.name;
    const workspaceId = req.workspaceId || 'default';
    if (!apiKeyName) {
      return next();
    }

    const rateLimitKey = `${workspaceId}:${apiKeyName}`;

    const redis = getRedisClient();
    if (redis) {
      const limited = await checkRedisRateLimit(rateLimitKey, windowMs, maxRequests, res);
      if (limited) return;
      return next();
    }

    const sqliteLimited = await checkSqliteRateLimit(rateLimitKey, windowMs, maxRequests, res);
    if (sqliteLimited) return;

    next();
  };
}
