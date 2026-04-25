import { LRUCache } from 'lru-cache';
import { PromptFile, PromptVersion } from '@drivers/promptmetrics-driver.interface';
import { getRedisClient, isRedisEnabled } from './redis.service';

export interface CachedPrompt {
  content: PromptFile;
  version: PromptVersion;
}

const localCache = new LRUCache<string, CachedPrompt>({
  max: 500,
  ttl: 1000 * 60,
  updateAgeOnGet: true,
});

export function cacheKey(workspaceId: string, name: string, version?: string): string {
  return version ? `prompt:${workspaceId}:${name}:${version}` : `prompt:${workspaceId}:${name}:latest`;
}

export async function getCachedPrompt(key: string): Promise<CachedPrompt | undefined> {
  if (isRedisEnabled()) {
    const redis = getRedisClient();
    if (redis) {
      const raw = await redis.get(key);
      if (raw) {
        return JSON.parse(raw) as CachedPrompt;
      }
    }
  }
  return localCache.get(key);
}

export async function setCachedPrompt(key: string, value: CachedPrompt, ttlMs = 60_000): Promise<void> {
  if (isRedisEnabled()) {
    const redis = getRedisClient();
    if (redis) {
      await redis.setex(key, Math.ceil(ttlMs / 1000), JSON.stringify(value));
      return;
    }
  }
  localCache.set(key, value, { ttl: ttlMs });
}

export async function invalidatePrompt(workspaceId: string, name: string): Promise<void> {
  if (isRedisEnabled()) {
    const redis = getRedisClient();
    if (redis) {
      const keys = await redis.keys(`prompt:${workspaceId}:${name}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      return;
    }
  }
  for (const key of localCache.keys()) {
    if (key.startsWith(`prompt:${workspaceId}:${name}:`)) {
      localCache.delete(key);
    }
  }
}

export async function clearCache(): Promise<void> {
  if (isRedisEnabled()) {
    const redis = getRedisClient();
    if (redis) {
      await redis.flushall();
      return;
    }
  }
  localCache.clear();
}
