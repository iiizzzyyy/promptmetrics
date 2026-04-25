import { getCachedPrompt, cacheKey, setCachedPrompt, invalidatePrompt, CachedPrompt } from '@services/cache.service';

describe('CacheService', () => {
  beforeEach(async () => {
    const { getRedisClient } = await import('@services/redis.service');
    const redis = getRedisClient();
    if (redis) {
      await redis.flushall();
    }
  });

  afterEach(async () => {
    const { getRedisClient } = await import('@services/redis.service');
    const redis = getRedisClient();
    if (redis) {
      await redis.flushall();
    }
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

  it('should return a cache miss for unknown keys', async () => {
    const result = await getCachedPrompt(cacheKey('unknown'));
    expect(result).toBeUndefined();
  });

  it('should return a cache hit after storing a prompt', async () => {
    const entry = makeEntry('hello');
    const key = cacheKey('hello', '1.0.0');
    await setCachedPrompt(key, entry);

    const result = await getCachedPrompt(key);
    expect(result).toBeDefined();
    expect(result!.content.name).toBe('hello');
    expect(result!.version.version_tag).toBe('1.0.0');
  });

  it('should differentiate keys by version', async () => {
    const entryV1 = makeEntry('greet');
    const entryV2 = { ...entryV1, version: { ...entryV1.version, version_tag: '2.0.0' } };
    await setCachedPrompt(cacheKey('greet', '1.0.0'), entryV1);
    await setCachedPrompt(cacheKey('greet', '2.0.0'), entryV2);

    const resultV1 = await getCachedPrompt(cacheKey('greet', '1.0.0'));
    const resultV2 = await getCachedPrompt(cacheKey('greet', '2.0.0'));
    expect(resultV1!.version.version_tag).toBe('1.0.0');
    expect(resultV2!.version.version_tag).toBe('2.0.0');
  });

  it('should use latest suffix when no version is provided', () => {
    const key = cacheKey('latest-prompt');
    expect(key).toBe('prompt:latest-prompt:latest');
  });

  it('should invalidate all versions of a prompt', async () => {
    await setCachedPrompt(cacheKey('multi', '1.0.0'), makeEntry('multi'));
    await setCachedPrompt(cacheKey('multi', '2.0.0'), makeEntry('multi'));
    await setCachedPrompt(cacheKey('multi'), makeEntry('multi'));
    await setCachedPrompt(cacheKey('other', '1.0.0'), makeEntry('other'));

    await invalidatePrompt('multi');

    expect(await getCachedPrompt(cacheKey('multi', '1.0.0'))).toBeUndefined();
    expect(await getCachedPrompt(cacheKey('multi', '2.0.0'))).toBeUndefined();
    expect(await getCachedPrompt(cacheKey('multi'))).toBeUndefined();
    expect(await getCachedPrompt(cacheKey('other', '1.0.0'))).toBeDefined();
  });

  it('should expire entries after TTL', async () => {
    const entry = makeEntry('expire-me');
    const key = cacheKey('expire-me');
    await setCachedPrompt(key, entry, 50);

    expect(await getCachedPrompt(key)).toBeDefined();

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(await getCachedPrompt(key)).toBeUndefined();
  });
});
