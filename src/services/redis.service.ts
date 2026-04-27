import { Redis } from 'ioredis';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;
  if (!process.env.REDIS_URL) return null;
  redisClient = new Redis(process.env.REDIS_URL);
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
