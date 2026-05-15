import { Redis } from 'ioredis';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  if (redisClient) return redisClient.status === 'ready' || redisClient.status === 'connecting' ? redisClient : null;

  redisClient = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 10) {
        console.error('Redis: giving up after 10 retries');
        return null;
      }
      return Math.min(times * 200, 2000);
    },
  });

  redisClient.on('error', (err) => {
    console.error('Redis connection error:', err.message);
  });

  redisClient.on('close', () => {
    console.warn('Redis connection closed');
  });

  redisClient.on('reconnecting', () => {
    console.info('Redis reconnecting...');
  });

  return redisClient;
}

export function isRedisEnabled(): boolean {
  return !!process.env.REDIS_URL;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
