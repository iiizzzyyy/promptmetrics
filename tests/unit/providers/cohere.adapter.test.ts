import nock from 'nock';
import { CohereAdapter } from '@services/providers/cohere.adapter';

describe('CohereAdapter', () => {
  const originalEnv = process.env.COHERE_API_KEY;

  beforeAll(() => {
    process.env.COHERE_API_KEY = 'test-key';
  });

  afterAll(() => {
    process.env.COHERE_API_KEY = originalEnv;
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('constructor', () => {
    it('throws when COHERE_API_KEY is missing', () => {
      delete process.env.COHERE_API_KEY;
      expect(() => new CohereAdapter()).toThrow('COHERE_API_KEY environment variable is required');
      process.env.COHERE_API_KEY = 'test-key';
    });
  });

  describe('provider', () => {
    it('returns "cohere"', () => {
      const adapter = new CohereAdapter();
      expect(adapter.provider).toBe('cohere');
    });
  });

  describe('listModels', () => {
    it('returns the hardcoded model list', async () => {
      const adapter = new CohereAdapter();
      const models = await adapter.listModels();

      expect(models.length).toBe(2);
      expect(models).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'command-r', provider: 'cohere' }),
          expect.objectContaining({ id: 'command-r-plus', provider: 'cohere' }),
        ]),
      );
    });

    it('includes context window sizes', async () => {
      const adapter = new CohereAdapter();
      const models = await adapter.listModels();
      const commandR = models.find((m) => m.id === 'command-r');
      expect(commandR?.contextWindow).toBe(128_000);
    });
  });

  describe('chatCompletion', () => {
    it('sends correct request body and parses response', async () => {
      const adapter = new CohereAdapter();
      let capturedBody: unknown;

      nock('https://api.cohere.com')
        .post('/v2/chat', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, {
          id: 'test-id',
          model: 'command-r',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello from Cohere' }],
          },
          finish_reason: 'COMPLETE',
          usage: {
            billedUnits: { inputTokens: 10, outputTokens: 5 },
          },
        });

      const response = await adapter.chatCompletion({
        model: 'command-r',
        messages: [
          { role: 'system', content: 'Be helpful' },
          { role: 'user', content: 'Hello' },
        ],
        temperature: 0.7,
        maxTokens: 100,
      });

      expect(capturedBody).toMatchObject({
        model: 'command-r',
        messages: [
          { role: 'system', content: 'Be helpful' },
          { role: 'user', content: 'Hello' },
        ],
        temperature: 0.7,
        max_tokens: 100,
      });
      expect(response.output).toBe('Hello from Cohere');
      expect(response.tokensIn).toBe(10);
      expect(response.tokensOut).toBe(5);
      expect(response.finishReason).toBe('complete');
      expect(response.model).toBe('command-r');
      expect(response.id).toBe('test-id');
      expect(response.costUsd).toBeGreaterThan(0);
      expect(response.latencyMs).toBeGreaterThanOrEqual(0);
      expect(nock.isDone()).toBe(true);
    });

    it('maps 429 to ProviderError.rateLimit with retryable=true', async () => {
      const adapter = new CohereAdapter();

      nock('https://api.cohere.com')
        .post('/v2/chat')
        .times(3)
        .reply(429, { message: 'Rate limit exceeded' }, { 'content-type': 'application/json', 'retry-after': '0' });

      await expect(
        adapter.chatCompletion({ model: 'command-r', messages: [{ role: 'user', content: 'hi' }] }),
      ).rejects.toMatchObject({
        code: 'rate_limit',
        retryable: true,
        provider: 'cohere',
      });
      expect(nock.isDone()).toBe(true);
    });

    it('maps 400 to invalidRequest with retryable=false', async () => {
      const adapter = new CohereAdapter();

      nock('https://api.cohere.com')
        .post('/v2/chat')
        .reply(400, { message: 'Bad request' }, { 'content-type': 'application/json' });

      await expect(
        adapter.chatCompletion({ model: 'command-r', messages: [{ role: 'user', content: 'hi' }] }),
      ).rejects.toMatchObject({
        code: 'invalid_request',
        retryable: false,
        provider: 'cohere',
      });
      expect(nock.isDone()).toBe(true);
    });
  });

  describe('streamChatCompletion', () => {
    it('yields tokens and metrics from SSE stream', async () => {
      const adapter = new CohereAdapter();

      const sseData = [
        'event: content-delta',
        'data: {"type":"content-delta","delta":{"message":{"content":{"text":"Hello"}}}}',
        '',
        'event: content-delta',
        'data: {"type":"content-delta","delta":{"message":{"content":{"text":" world"}}}}',
        '',
        'event: message-end',
        'data: {"type":"message-end","delta":{"finishReason":"COMPLETE"}}',
        '',
      ].join('\n');

      nock('https://api.cohere.com').post('/v2/chat').reply(200, sseData, { 'Content-Type': 'text/event-stream' });

      const chunks: unknown[] = [];
      for await (const chunk of adapter.streamChatCompletion({
        model: 'command-r',
        messages: [{ role: 'user', content: 'hi' }],
      })) {
        chunks.push(chunk);
      }

      const tokenChunks = chunks.filter((c: any) => c.type === 'token');
      expect(tokenChunks.map((c: any) => c.content)).toEqual(['Hello', ' world']);

      const metricsChunk = chunks.find((c: any) => c.type === 'metrics');
      expect(metricsChunk).toBeDefined();
      expect((metricsChunk as any).tokensOut).toBe(2);
      expect((metricsChunk as any).costUsd).toBeGreaterThanOrEqual(0);

      const doneChunk = chunks.find((c: any) => c.type === 'done');
      expect(doneChunk).toBeDefined();
      expect((doneChunk as any).finishReason).toBe('complete');

      expect(nock.isDone()).toBe(true);
    });

    it('yields error chunk on 429', async () => {
      const adapter = new CohereAdapter();

      nock('https://api.cohere.com')
        .post('/v2/chat')
        .times(3)
        .reply(429, { message: 'Rate limit exceeded' }, { 'content-type': 'application/json', 'retry-after': '0' });

      const chunks: unknown[] = [];
      for await (const chunk of adapter.streamChatCompletion({
        model: 'command-r',
        messages: [{ role: 'user', content: 'hi' }],
      })) {
        chunks.push(chunk);
      }

      const errorChunk = chunks.find((c: any) => c.type === 'error');
      expect(errorChunk).toBeDefined();
      expect((errorChunk as any).code).toBe('rate_limit');
      expect(nock.isDone()).toBe(true);
    });
  });

  describe('estimateCost', () => {
    it('calculates cost for command-r correctly', () => {
      const adapter = new CohereAdapter();
      const cost = adapter.estimateCost('command-r', 1000, 1000);
      expect(cost).toBeCloseTo(0.002, 5);
    });

    it('calculates cost for command-r-plus correctly', () => {
      const adapter = new CohereAdapter();
      const cost = adapter.estimateCost('command-r-plus', 2000, 1000);
      expect(cost).toBeCloseTo(0.021, 5);
    });

    it('falls back to command-r pricing for unknown models', () => {
      const adapter = new CohereAdapter();
      const knownCost = adapter.estimateCost('command-r', 1000, 1000);
      const unknownCost = adapter.estimateCost('unknown-model', 1000, 1000);
      expect(unknownCost).toBe(knownCost);
    });

    it('returns 0 for zero tokens', () => {
      const adapter = new CohereAdapter();
      expect(adapter.estimateCost('command-r', 0, 0)).toBe(0);
    });
  });
});
