import { Request, Response, NextFunction } from 'express';
import { getDb } from '@models/promptmetrics-sqlite';
import { getRedisClient } from '@services/redis.service';
import { hashApiKey } from '@middlewares/promptmetrics-auth.middleware';
import { AppError } from '@errors/app.error';

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
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

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
    return;
  }

  const count = incrResult?.[1] as number | undefined;
  if (count === undefined) return;

  const remaining = Math.max(0, maxRequests - count);
  res.setHeader('RateLimit-Limit', String(maxRequests));
  res.setHeader('RateLimit-Remaining', String(remaining));
  res.setHeader('RateLimit-Reset', String(Math.ceil((windowStart + windowMs) / 1000)));

  if (count > maxRequests) {
    const retryAfter = Math.ceil((windowStart + windowMs - now) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    throw new AppError('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED', undefined, 'context');
  }
}

async function checkSqliteRateLimit(
  rateLimitKey: string,
  windowMs: number,
  maxRequests: number,
  res: Response,
): Promise<void> {
  const db = getDbOrNull();
  if (!db) return;

  try {
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;

    // Use a transaction to make the check-and-increment atomic,
    // preventing race conditions under concurrent requests.
    // Returns { allowed: boolean, count: number } so we can distinguish
    // between "we just incremented to max" (allowed) and "already at max" (blocked).
    const result = await db.transaction(async (): Promise<{ allowed: boolean; count: number }> => {
      const updateResult = await db
        .prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ? AND window_start = ? AND count < ?')
        .run(rateLimitKey, windowStart, maxRequests);

      if (updateResult.changes > 0) {
        const row = (await db.prepare('SELECT count FROM rate_limits WHERE key = ?').get(rateLimitKey)) as
          | { count: number }
          | undefined;
        return { allowed: true, count: row?.count ?? 1 };
      }

      const row = (await db.prepare('SELECT window_start, count FROM rate_limits WHERE key = ?').get(rateLimitKey)) as
        | { window_start: number; count: number }
        | undefined;

      if (!row || row.window_start < windowStart) {
        await db
          .prepare(
            `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
             ON CONFLICT(key) DO UPDATE SET window_start = excluded.window_start, count = excluded.count`,
          )
          .run(rateLimitKey, windowStart);
        return { allowed: true, count: 1 };
      }

      return { allowed: false, count: row.count };
    });

    if (!result.allowed) {
      const retryAfter = Math.ceil((windowStart + windowMs - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      throw new AppError('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED', undefined, 'context');
    }

    const remaining = Math.max(0, maxRequests - result.count);
    res.setHeader('RateLimit-Limit', String(maxRequests));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil((windowStart + windowMs) / 1000)));
  } catch (err) {
    // Graceful degradation: if the DB query fails, log the error and
    // allow the request through rather than returning a 500.
    // AppError (rate limit exceeded) should propagate, not be swallowed.
    if (err instanceof AppError) throw err;
    console.error('Rate limit DB query failed, allowing request:', err);
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
      await checkRedisRateLimit(rateLimitKey, windowMs, maxRequests, res);
      return next();
    }

    await checkSqliteRateLimit(rateLimitKey, windowMs, maxRequests, res);
    next();
  };
}
