import { LRUCache } from 'lru-cache';
import { PromptFile, PromptVersion } from '@drivers/promptmetrics-driver.interface';

export interface CachedPrompt {
  content: PromptFile;
  version: PromptVersion;
}

export const promptCache = new LRUCache<string, CachedPrompt>({
  max: 500,
  ttl: 1000 * 60,
  updateAgeOnGet: true,
});

export function cacheKey(name: string, version?: string): string {
  return version ? `prompt:${name}:${version}` : `prompt:${name}:latest`;
}

export function invalidatePrompt(name: string): void {
  for (const key of promptCache.keys()) {
    if (key.startsWith(`prompt:${name}:`)) {
      promptCache.delete(key);
    }
  }
}
