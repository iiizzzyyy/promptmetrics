import { Request, Response, NextFunction } from 'express';

const mockGetDb = jest.fn();
const mockGetRedisClient = jest.fn();
const mockHashApiKey = jest.fn((k: string) => `hash_${k}`);

jest.mock('@models/promptmetrics-sqlite', () => ({
  getDb: mockGetDb,
}));

jest.mock('@services/redis.service', () => ({
  getRedisClient: mockGetRedisClient,
}));

jest.mock('@middlewares/promptmetrics-auth.middleware', () => ({
  hashApiKey: mockHashApiKey,
}));

import { rateLimitPerKey } from '@middlewares/rate-limit-per-key.middleware';

describe('rateLimitPerKey middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;
  let setHeaderMock: jest.Mock;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    setHeaderMock = jest.fn();
    jsonMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnThis();
    res = {
      setHeader: setHeaderMock,
      status: statusMock,
      json: jsonMock,
    };
    next = jest.fn();
  });

  it('falls through when getDb throws', async () => {
    mockGetDb.mockImplementation(() => {
      throw new Error('DB not ready');
    });
    mockGetRedisClient.mockReturnValue(null);

    req = { headers: { 'x-api-key': 'key1' }, workspaceId: 'ws1' };
    const middleware = rateLimitPerKey(60_000, 10);
    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('sets Redis rate-limit headers on INCR + EXPIRE pipeline success', async () => {
    const pipelineMock: any = {
      incr: jest.fn().mockImplementation(() => pipelineMock),
      expire: jest.fn().mockImplementation(() => pipelineMock),
      exec: jest.fn().mockResolvedValue([[null, 5], [null, 1]]),
    };
    const redisMock = {
      pipeline: jest.fn().mockReturnValue(pipelineMock),
    };
    mockGetRedisClient.mockReturnValue(redisMock);
    mockGetDb.mockReturnValue(null);

    req = { headers: { 'x-api-key': 'key1' }, workspaceId: 'ws1' };
    const middleware = rateLimitPerKey(60_000, 10);
    await middleware(req as Request, res as Response, next);

    expect(setHeaderMock).toHaveBeenCalledWith('RateLimit-Limit', '10');
    expect(setHeaderMock).toHaveBeenCalledWith('RateLimit-Remaining', '5');
    expect(setHeaderMock).toHaveBeenCalledWith('RateLimit-Reset', expect.any(String));
    expect(next).toHaveBeenCalled();
  });

  it('returns 429 when Redis count exceeds maxRequests', async () => {
    const pipelineMock: any = {
      incr: jest.fn().mockImplementation(() => pipelineMock),
      expire: jest.fn().mockImplementation(() => pipelineMock),
      exec: jest.fn().mockResolvedValue([[null, 11], [null, 1]]),
    };
    const redisMock = {
      pipeline: jest.fn().mockReturnValue(pipelineMock),
    };
    mockGetRedisClient.mockReturnValue(redisMock);
    mockGetDb.mockReturnValue(null);

    req = { headers: { 'x-api-key': 'key1' }, workspaceId: 'ws1' };
    const middleware = rateLimitPerKey(60_000, 10);
    await middleware(req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(429);
    expect(jsonMock).toHaveBeenCalledWith({
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
    });
    expect(setHeaderMock).toHaveBeenCalledWith('Retry-After', expect.any(String));
    expect(next).not.toHaveBeenCalled();
  });

  it('skips rate limiting when no API key header is present', async () => {
    mockGetRedisClient.mockReturnValue(null);
    req = { headers: {}, workspaceId: 'ws1' };
    const middleware = rateLimitPerKey(60_000, 10);
    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  it('falls through to SQLite when Redis client is not available', async () => {
    mockGetRedisClient.mockReturnValue(null);
    const runMock = jest.fn().mockResolvedValue({ changes: 1 });
    const getMock = jest.fn().mockResolvedValue({ count: 1 });
    mockGetDb.mockReturnValue({
      prepare: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('UPDATE rate_limits')) {
          return { run: runMock };
        }
        if (sql.includes('SELECT count FROM rate_limits')) {
          return { get: getMock };
        }
        return { run: runMock, get: getMock };
      }),
    });

    req = { headers: { 'x-api-key': 'key1' }, workspaceId: 'ws1' };
    const middleware = rateLimitPerKey(60_000, 10);
    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(setHeaderMock).toHaveBeenCalledWith('RateLimit-Limit', '10');
  });
});
