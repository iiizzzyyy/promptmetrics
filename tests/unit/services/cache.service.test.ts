import { promptCache, cacheKey, invalidatePrompt, CachedPrompt } from '@services/cache.service';

describe('CacheService', () => {
  beforeEach(() => {
    promptCache.clear();
  });

  afterEach(() => {
    promptCache.clear();
  });

  const makeEntry = (name: string): CachedPrompt => ({
    content: {
      name,
      version: '1.0.0',
      messages: [{ role: 'user', content: 'hello' }],
    },
    version: {
      name,
      version_tag: '1.0.0',
      created_at: Date.now(),
    },
  });

  it('should return a cache miss for unknown keys', () => {
    expect(promptCache.get(cacheKey('unknown'))).toBeUndefined();
  });

  it('should return a cache hit after storing a prompt', () => {
    const entry = makeEntry('hello');
    const key = cacheKey('hello', '1.0.0');
    promptCache.set(key, entry);

    const result = promptCache.get(key);
    expect(result).toBeDefined();
    expect(result!.content.name).toBe('hello');
    expect(result!.version.version_tag).toBe('1.0.0');
  });

  it('should differentiate keys by version', () => {
    const entryV1 = makeEntry('greet');
    const entryV2 = { ...entryV1, version: { ...entryV1.version, version_tag: '2.0.0' } };
    promptCache.set(cacheKey('greet', '1.0.0'), entryV1);
    promptCache.set(cacheKey('greet', '2.0.0'), entryV2);

    expect(promptCache.get(cacheKey('greet', '1.0.0'))!.version.version_tag).toBe('1.0.0');
    expect(promptCache.get(cacheKey('greet', '2.0.0'))!.version.version_tag).toBe('2.0.0');
  });

  it('should use latest suffix when no version is provided', () => {
    const key = cacheKey('latest-prompt');
    expect(key).toBe('prompt:latest-prompt:latest');
  });

  it('should invalidate all versions of a prompt', () => {
    promptCache.set(cacheKey('multi', '1.0.0'), makeEntry('multi'));
    promptCache.set(cacheKey('multi', '2.0.0'), makeEntry('multi'));
    promptCache.set(cacheKey('multi'), makeEntry('multi'));
    promptCache.set(cacheKey('other', '1.0.0'), makeEntry('other'));

    invalidatePrompt('multi');

    expect(promptCache.get(cacheKey('multi', '1.0.0'))).toBeUndefined();
    expect(promptCache.get(cacheKey('multi', '2.0.0'))).toBeUndefined();
    expect(promptCache.get(cacheKey('multi'))).toBeUndefined();
    expect(promptCache.get(cacheKey('other', '1.0.0'))).toBeDefined();
  });

  it('should evict oldest entries when max size is exceeded', () => {
    // max is 500; set 501 entries
    for (let i = 0; i < 501; i++) {
      promptCache.set(`prompt:${i}:latest`, makeEntry(`prompt-${i}`));
    }

    // The first entry should have been evicted
    expect(promptCache.has('prompt:0:latest')).toBe(false);
    // The last entry should still be there
    expect(promptCache.has('prompt:500:latest')).toBe(true);
  });

  it('should expire entries after TTL', async () => {
    // Create a short-lived cache for this test
    const { LRUCache } = await import('lru-cache');
    const shortCache = new LRUCache<string, CachedPrompt>({
      max: 10,
      ttl: 50,
    });

    shortCache.set('key', makeEntry('expire-me'));
    expect(shortCache.get('key')).toBeDefined();

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(shortCache.get('key')).toBeUndefined();
  });
});
