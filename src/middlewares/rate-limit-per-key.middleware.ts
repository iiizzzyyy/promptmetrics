import { Request, Response, NextFunction } from 'express';
import { getDb } from '@models/promptmetrics-sqlite';
import { getRedisClient } from '@services/redis.service';
import { hashApiKey } from '@middlewares/promptmetrics-auth.middleware';

// Rate-limit configuration -- overridable via environment for CI/test environments.
// Production defaults: 300 requests per 60-second window.
const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000;
const DEFAULT_MAX = Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 300;

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

  try {
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;

    // Use a transaction to make the check-and-increment atomic,
    // preventing race conditions under concurrent requests.
    // Returns { allowed: boolean, count: number } so we can distinguish
    // between "we just incremented to max" (allowed) and "already at max" (blocked).
    const result = await db.transaction(async (): Promise<{ allowed: boolean; count: number }> => {
      // Try to increment an existing row for the current window.
      // Only increments when count < maxRequests, so a successful increment
      // means this request is within the limit.
      const updateResult = await db
        .prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ? AND window_start = ? AND count < ?')
        .run(rateLimitKey, windowStart, maxRequests);

      if (updateResult.changes > 0) {
        // We incremented successfully — this request is within the limit.
        const row = (await db.prepare('SELECT count FROM rate_limits WHERE key = ?').get(rateLimitKey)) as
          | { count: number }
          | undefined;
        return { allowed: true, count: row?.count ?? 1 };
      }

      // No row was updated. Either no row exists for this key/window,
      // or the count has reached maxRequests.
      const row = (await db.prepare('SELECT window_start, count FROM rate_limits WHERE key = ?').get(rateLimitKey)) as
        | { window_start: number; count: number }
        | undefined;

      if (!row || row.window_start < windowStart) {
        // New window or first request — insert/reset the counter to 1.
        await db
          .prepare(
            `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
             ON CONFLICT(key) DO UPDATE SET window_start = excluded.window_start, count = excluded.count`,
          )
          .run(rateLimitKey, windowStart);
        return { allowed: true, count: 1 };
      }

      // Row exists for the current window and count >= maxRequests.
      // This request is over the limit.
      return { allowed: false, count: row.count };
    });

    if (!result.allowed) {
      const retryAfter = Math.ceil((windowStart + windowMs - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
      });
      return true;
    }

    const remaining = Math.max(0, maxRequests - result.count);
    res.setHeader('RateLimit-Limit', String(maxRequests));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil((windowStart + windowMs) / 1000)));
    return false;
  } catch (err) {
    // Graceful degradation: if the DB query fails, log the error and
    // allow the request through rather than returning a 500.
    console.error('Rate limit DB query failed, allowing request:', err);
    return false;
  }
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
