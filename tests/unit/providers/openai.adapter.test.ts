import nock from 'nock';
import { OpenAIAdapter } from '@services/providers/openai.adapter';

describe('OpenAIAdapter', () => {
  const originalEnv = process.env.OPENAI_API_KEY;

  beforeAll(() => {
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterAll(() => {
    process.env.OPENAI_API_KEY = originalEnv;
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('constructor', () => {
    it('throws when OPENAI_API_KEY is missing', () => {
      delete process.env.OPENAI_API_KEY;
      expect(() => new OpenAIAdapter()).toThrow('OPENAI_API_KEY environment variable is required');
      process.env.OPENAI_API_KEY = 'test-key';
    });
  });

  describe('provider', () => {
    it('returns "openai"', () => {
      const adapter = new OpenAIAdapter();
      expect(adapter.provider).toBe('openai');
    });
  });

  describe('listModels', () => {
    it('returns the hardcoded model list', async () => {
      const adapter = new OpenAIAdapter();
      const models = await adapter.listModels();

      expect(models.length).toBeGreaterThanOrEqual(3);
      expect(models).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'gpt-4o', provider: 'openai' }),
          expect.objectContaining({ id: 'gpt-4o-mini', provider: 'openai' }),
          expect.objectContaining({ id: 'gpt-4-turbo', provider: 'openai' }),
        ]),
      );
    });

    it('includes context window sizes', async () => {
      const adapter = new OpenAIAdapter();
      const models = await adapter.listModels();
      const gpt4o = models.find((m) => m.id === 'gpt-4o');
      expect(gpt4o?.contextWindow).toBe(128_000);
    });
  });

  describe('chatCompletion', () => {
    it('sends correct request body and parses response', async () => {
      const adapter = new OpenAIAdapter();
      let capturedBody: unknown;

      nock('https://api.openai.com')
        .post('/v1/chat/completions', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, {
          id: 'chatcmpl-test',
          object: 'chat.completion',
          created: 1234567890,
          model: 'gpt-4o',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Hello from OpenAI' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        });

      const response = await adapter.chatCompletion({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'Be helpful' },
          { role: 'user', content: 'Hello' },
        ],
        temperature: 0.7,
        maxTokens: 100,
        topP: 0.9,
      });

      expect(capturedBody).toMatchObject({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'Be helpful' },
          { role: 'user', content: 'Hello' },
        ],
        temperature: 0.7,
        max_tokens: 100,
        top_p: 0.9,
        stream: false,
      });
      expect(response.output).toBe('Hello from OpenAI');
      expect(response.tokensIn).toBe(10);
      expect(response.tokensOut).toBe(5);
      expect(response.finishReason).toBe('stop');
      expect(response.model).toBe('gpt-4o');
      expect(response.id).toBe('chatcmpl-test');
      expect(response.costUsd).toBeGreaterThan(0);
      expect(response.latencyMs).toBeGreaterThanOrEqual(0);
      expect(nock.isDone()).toBe(true);
    });

    it('maps 429 to ProviderError.rateLimit with retryable=true', async () => {
      const adapter = new OpenAIAdapter();

      nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .times(3)
        .reply(
          429,
          { error: { message: 'Rate limit exceeded', type: 'rate_limit_error' } },
          { 'content-type': 'application/json', 'retry-after': '0' },
        );

      await expect(
        adapter.chatCompletion({ model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] }),
      ).rejects.toMatchObject({
        code: 'rate_limit',
        retryable: true,
        provider: 'openai',
      });
      expect(nock.isDone()).toBe(true);
    });

    it('maps 400 to invalidRequest with retryable=false', async () => {
      const adapter = new OpenAIAdapter();

      nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .reply(
          400,
          { error: { message: 'Bad request', type: 'invalid_request_error' } },
          { 'content-type': 'application/json' },
        );

      await expect(
        adapter.chatCompletion({ model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] }),
      ).rejects.toMatchObject({
        code: 'invalid_request',
        retryable: false,
        provider: 'openai',
      });
      expect(nock.isDone()).toBe(true);
    });
  });

  describe('streamChatCompletion', () => {
    it('yields tokens and metrics from SSE stream', async () => {
      const adapter = new OpenAIAdapter();

      const sseData = [
        'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1,"model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}',
        'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}',
        'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}',
        'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1,"model":"gpt-4o","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
        'data: [DONE]',
        '',
      ].join('\n\n');

      nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .reply(200, sseData, { 'Content-Type': 'text/event-stream' });

      const chunks: unknown[] = [];
      for await (const chunk of adapter.streamChatCompletion({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'hi' }],
      })) {
        chunks.push(chunk);
      }

      const tokenChunks = chunks.filter((c: any) => c.type === 'token');
      expect(tokenChunks.map((c: any) => c.content)).toEqual(['Hello', ' world']);

      const metricsChunk = chunks.find((c: any) => c.type === 'metrics');
      expect(metricsChunk).toBeDefined();
      expect((metricsChunk as any).tokensOut).toBe(2);
      expect((metricsChunk as any).tokensIn).toBeGreaterThan(0);
      expect((metricsChunk as any).costUsd).toBeGreaterThanOrEqual(0);

      const doneChunk = chunks.find((c: any) => c.type === 'done');
      expect(doneChunk).toBeDefined();
      expect((doneChunk as any).finishReason).toBe('stop');

      expect(nock.isDone()).toBe(true);
    });

    it('yields error chunk on 429', async () => {
      const adapter = new OpenAIAdapter();

      nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .times(3)
        .reply(
          429,
          { error: { message: 'Rate limit exceeded' } },
          { 'content-type': 'application/json', 'retry-after': '0' },
        );

      const chunks: unknown[] = [];
      for await (const chunk of adapter.streamChatCompletion({
        model: 'gpt-4o',
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
    it('calculates cost for gpt-4o correctly', () => {
      const adapter = new OpenAIAdapter();
      const cost = adapter.estimateCost('gpt-4o', 1000, 1000);
      expect(cost).toBeCloseTo(0.0125, 5);
    });

    it('calculates cost for gpt-4o-mini correctly', () => {
      const adapter = new OpenAIAdapter();
      const cost = adapter.estimateCost('gpt-4o-mini', 2000, 1000);
      expect(cost).toBeCloseTo(0.0009, 6);
    });

    it('falls back to gpt-4o pricing for unknown models', () => {
      const adapter = new OpenAIAdapter();
      const knownCost = adapter.estimateCost('gpt-4o', 1000, 1000);
      const unknownCost = adapter.estimateCost('unknown-model', 1000, 1000);
      expect(unknownCost).toBe(knownCost);
    });

    it('returns 0 for zero tokens', () => {
      const adapter = new OpenAIAdapter();
      expect(adapter.estimateCost('gpt-4o', 0, 0)).toBe(0);
    });
  });
});
