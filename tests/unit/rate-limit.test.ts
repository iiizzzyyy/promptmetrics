import request from 'supertest';
import { createApp } from '@app';

describe('Rate Limiting', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    app = createApp();
  });

  it('should not rate limit health endpoints', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
    }
  });

  it('should return 429 after exceeding rate limit', async () => {
    // Make 101 requests in quick succession
    for (let i = 0; i < 101; i++) {
      await request(app).get('/v1/prompts');
    }

    const res = await request(app).get('/v1/prompts');
    expect(res.status).toBe(429);
  }, 15000);
});
