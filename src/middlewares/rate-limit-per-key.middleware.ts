import { Request, Response, NextFunction } from 'express';
import { getDb } from '@models/promptmetrics-sqlite';
import { getRedisClient } from '@services/redis.service';
import { hashApiKey } from '@middlewares/promptmetrics-auth.middleware';

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
  rateLimitKey: string,
  windowMs: number,
  maxRequests: number,
  res: Response,
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;

  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const key = `rate_limit:${rateLimitKey}:${windowStart}`;
  const ttlSeconds = Math.ceil(windowMs / 1000);

  const pipeline = redis.pipeline();
  pipeline.incr(key);
  pipeline.expire(key, ttlSeconds);
  const results = await pipeline.exec();

  const incrResult = results?.[0];
  const expireResult = results?.[1];

  // If either command failed, skip rate limiting to avoid permanently blocking
  if (incrResult?.[0] || expireResult?.[0]) {
    return false;
  }

  const count = incrResult?.[1] as number | undefined;
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
  rateLimitKey: string,
  windowMs: number,
  maxRequests: number,
  res: Response,
): Promise<boolean> {
  const db = getDbOrNull();
  if (!db) return false;

  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;

  const updateResult = await db
    .prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ? AND window_start = ? AND count < ?')
    .run(rateLimitKey, windowStart, maxRequests);

  let incremented = updateResult.changes > 0;

  if (!incremented) {
    const insertResult = await db
      .prepare(
        `INSERT INTO rate_limits (key, window_start, count)
       VALUES (?, ?, 1)
       ON CONFLICT(key) DO UPDATE SET
         window_start = excluded.window_start,
         count = excluded.count
       WHERE rate_limits.window_start < excluded.window_start`,
      )
      .run(rateLimitKey, windowStart);
    incremented = insertResult.changes > 0;

    if (!incremented) {
      // Another request may have initialized the row; retry the atomic update once.
      const retryResult = await db
        .prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ? AND window_start = ? AND count < ?')
        .run(rateLimitKey, windowStart, maxRequests);
      incremented = retryResult.changes > 0;
    }
  }

  if (!incremented) {
    const retryAfter = Math.ceil((windowStart + windowMs - now) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
    });
    return true;
  }

  const row = (await db.prepare('SELECT count FROM rate_limits WHERE key = ?').get(rateLimitKey)) as
    | { count: number }
    | undefined;

  const count = row?.count ?? 1;
  res.setHeader('RateLimit-Limit', String(maxRequests));
  res.setHeader('RateLimit-Remaining', String(Math.max(0, maxRequests - count)));
  res.setHeader('RateLimit-Reset', String(Math.ceil((windowStart + windowMs) / 1000)));
  return false;
}

export function rateLimitPerKey(windowMs = WINDOW_MS, maxRequests = DEFAULT_MAX) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const apiKeyValue = req.headers['x-api-key'] as string | undefined;
    const workspaceId = req.workspaceId || 'default';
    if (!apiKeyValue) {
      return next();
    }

    const rateLimitKey = `${workspaceId}:${hashApiKey(apiKeyValue)}`;

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
