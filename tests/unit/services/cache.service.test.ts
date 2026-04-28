import { getCachedPrompt, cacheKey, setCachedPrompt, invalidatePrompt, CachedPrompt } from '@services/cache.service';
import * as redisService from '@services/redis.service';

const mockRedisClient = {
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  flushall: jest.fn(),
  keys: jest.fn(),
};

jest.mock('@services/redis.service', () => ({
  isRedisEnabled: jest.fn().mockReturnValue(false),
  getRedisClient: jest.fn().mockReturnValue(null),
  closeRedis: jest.fn(),
}));

const WORKSPACE = 'default';

describe('CacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (redisService.isRedisEnabled as jest.Mock).mockReturnValue(false);
    (redisService.getRedisClient as jest.Mock).mockReturnValue(null);
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
    const result = await getCachedPrompt(cacheKey(WORKSPACE, 'unknown'));
    expect(result).toBeUndefined();
  });

  it('should return a cache hit after storing a prompt', async () => {
    const entry = makeEntry('hello');
    const key = cacheKey(WORKSPACE, 'hello', '1.0.0');
    await setCachedPrompt(key, entry);

    const result = await getCachedPrompt(key);
    expect(result).toBeDefined();
    expect(result!.content.name).toBe('hello');
    expect(result!.version.version_tag).toBe('1.0.0');
  });

  it('should differentiate keys by version', async () => {
    const entryV1 = makeEntry('greet');
    const entryV2 = { ...entryV1, version: { ...entryV1.version, version_tag: '2.0.0' } };
    await setCachedPrompt(cacheKey(WORKSPACE, 'greet', '1.0.0'), entryV1);
    await setCachedPrompt(cacheKey(WORKSPACE, 'greet', '2.0.0'), entryV2);

    const resultV1 = await getCachedPrompt(cacheKey(WORKSPACE, 'greet', '1.0.0'));
    const resultV2 = await getCachedPrompt(cacheKey(WORKSPACE, 'greet', '2.0.0'));
    expect(resultV1!.version.version_tag).toBe('1.0.0');
    expect(resultV2!.version.version_tag).toBe('2.0.0');
  });

  it('should use latest suffix when no version is provided', () => {
    const key = cacheKey(WORKSPACE, 'latest-prompt');
    expect(key).toBe('prompt:default:latest-prompt:latest');
  });

  it('should invalidate all versions of a prompt', async () => {
    await setCachedPrompt(cacheKey(WORKSPACE, 'multi', '1.0.0'), makeEntry('multi'));
    await setCachedPrompt(cacheKey(WORKSPACE, 'multi', '2.0.0'), makeEntry('multi'));
    await setCachedPrompt(cacheKey(WORKSPACE, 'multi'), makeEntry('multi'));
    await setCachedPrompt(cacheKey(WORKSPACE, 'other', '1.0.0'), makeEntry('other'));

    await invalidatePrompt(WORKSPACE, 'multi');

    expect(await getCachedPrompt(cacheKey(WORKSPACE, 'multi', '1.0.0'))).toBeUndefined();
    expect(await getCachedPrompt(cacheKey(WORKSPACE, 'multi', '2.0.0'))).toBeUndefined();
    expect(await getCachedPrompt(cacheKey(WORKSPACE, 'multi'))).toBeUndefined();
    expect(await getCachedPrompt(cacheKey(WORKSPACE, 'other', '1.0.0'))).toBeDefined();
  });

  it('should expire entries after TTL', async () => {
    const entry = makeEntry('expire-me');
    const key = cacheKey(WORKSPACE, 'expire-me');
    await setCachedPrompt(key, entry, 50);

    expect(await getCachedPrompt(key)).toBeDefined();

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(await getCachedPrompt(key)).toBeUndefined();
  });

  it('should return undefined when Redis returns invalid JSON', async () => {
    mockRedisClient.get.mockResolvedValue('not-json{');
    (redisService.isRedisEnabled as jest.Mock).mockReturnValue(true);
    (redisService.getRedisClient as jest.Mock).mockReturnValue(mockRedisClient);

    const result = await getCachedPrompt(cacheKey(WORKSPACE, 'bad-json'));
    expect(result).toBeUndefined();
    expect(mockRedisClient.del).toHaveBeenCalled();
  });

  it('should use Redis when enabled', async () => {
    mockRedisClient.get.mockResolvedValue(null);
    mockRedisClient.setex.mockResolvedValue('OK');
    (redisService.isRedisEnabled as jest.Mock).mockReturnValue(true);
    (redisService.getRedisClient as jest.Mock).mockReturnValue(mockRedisClient);

    const entry = makeEntry('redis-prompt');
    const key = cacheKey(WORKSPACE, 'redis-prompt');
    await setCachedPrompt(key, entry);

    expect(mockRedisClient.setex).toHaveBeenCalled();
    const result = await getCachedPrompt(key);
    expect(result).toBeUndefined();
  });

  it('should invalidate via Redis when enabled', async () => {
    mockRedisClient.keys.mockResolvedValue(['prompt:default:multi:1.0.0']);
    (redisService.isRedisEnabled as jest.Mock).mockReturnValue(true);
    (redisService.getRedisClient as jest.Mock).mockReturnValue(mockRedisClient);

    await invalidatePrompt(WORKSPACE, 'multi');
    expect(mockRedisClient.keys).toHaveBeenCalledWith('prompt:default:multi:*');
    expect(mockRedisClient.del).toHaveBeenCalledWith('prompt:default:multi:1.0.0');
  });
});
