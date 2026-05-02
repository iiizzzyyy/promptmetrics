import nock from 'nock';
import { AnthropicAdapter } from '@services/providers/anthropic.adapter';

describe('AnthropicAdapter', () => {
  const originalEnv = process.env.ANTHROPIC_API_KEY;
  const originalBaseUrl = process.env.ANTHROPIC_BASE_URL;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    delete process.env.ANTHROPIC_BASE_URL;
  });

  afterEach(() => {
    nock.cleanAll();
  });

  afterAll(() => {
    process.env.ANTHROPIC_API_KEY = originalEnv;
    if (originalBaseUrl !== undefined) {
      process.env.ANTHROPIC_BASE_URL = originalBaseUrl;
    }
    nock.cleanAll();
  });

  describe('constructor', () => {
    it('does not throw when ANTHROPIC_API_KEY is missing (lazy validation)', () => {
      delete process.env.ANTHROPIC_API_KEY;
      expect(() => new AnthropicAdapter()).not.toThrow();
    });

    it('throws on first API call when ANTHROPIC_API_KEY is missing', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      const adapter = new AnthropicAdapter();
      await expect(
        adapter.chatCompletion({
          model: 'claude-3-5-sonnet-20241022',
          messages: [{ role: 'user', content: 'hi' }],
        }),
      ).rejects.toMatchObject({
        provider: 'anthropic',
        code: 'unknown',
      });
    });
  });

  describe('provider', () => {
    it('returns "anthropic"', () => {
      const adapter = new AnthropicAdapter();
      expect(adapter.provider).toBe('anthropic');
    });
  });

  describe('listModels', () => {
    it('returns the hardcoded model list', async () => {
      const adapter = new AnthropicAdapter();
      const models = await adapter.listModels();

      expect(models.length).toBe(2);
      expect(models).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'claude-3-5-sonnet-20241022', provider: 'anthropic' }),
          expect.objectContaining({ id: 'claude-3-opus-20240229', provider: 'anthropic' }),
        ]),
      );
    });

    it('includes context window sizes', async () => {
      const adapter = new AnthropicAdapter();
      const models = await adapter.listModels();
      const sonnet = models.find((m) => m.id === 'claude-3-5-sonnet-20241022');
      expect(sonnet?.contextWindow).toBe(200_000);
    });
  });

  describe('chatCompletion', () => {
    it('sends correct request body and parses response', async () => {
      const adapter = new AnthropicAdapter();
      let capturedBody: unknown;

      nock('https://api.anthropic.com')
        .post('/v1/messages', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, {
          id: 'msg_test',
          type: 'message',
          role: 'assistant',
          model: 'claude-3-5-sonnet-20241022',
          content: [{ type: 'text', text: 'Hello from Anthropic' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 5 },
        });

      const response = await adapter.chatCompletion({
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { role: 'system', content: 'Be helpful' },
          { role: 'user', content: 'Hello' },
        ],
        temperature: 0.7,
        maxTokens: 100,
        topP: 0.9,
      });

      expect(capturedBody).toMatchObject({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        temperature: 0.7,
        top_p: 0.9,
      });
      expect(response.output).toBe('Hello from Anthropic');
      expect(response.tokensIn).toBe(10);
      expect(response.tokensOut).toBe(5);
      expect(response.finishReason).toBe('end_turn');
      expect(response.model).toBe('claude-3-5-sonnet-20241022');
      expect(response.id).toBe('msg_test');
      expect(response.costUsd).toBeGreaterThan(0);
      expect(response.latencyMs).toBeGreaterThanOrEqual(0);
      expect(nock.isDone()).toBe(true);
    });

    it('maps 429 to ProviderError.rateLimit with retryable=true', async () => {
      const adapter = new AnthropicAdapter();

      nock('https://api.anthropic.com')
        .post('/v1/messages')
        .times(3)
        .reply(
          429,
          { type: 'error', error: { type: 'rate_limit_error', message: 'Rate limit exceeded' } },
          { 'content-type': 'application/json', 'retry-after': '0' },
        );

      await expect(
        adapter.chatCompletion({
          model: 'claude-3-5-sonnet-20241022',
          messages: [{ role: 'user', content: 'hi' }],
          maxTokens: 100,
        }),
      ).rejects.toMatchObject({
        code: 'rate_limit',
        retryable: true,
        provider: 'anthropic',
      });
      expect(nock.isDone()).toBe(true);
    });

    it('maps 400 to invalidRequest with retryable=false', async () => {
      const adapter = new AnthropicAdapter();

      nock('https://api.anthropic.com')
        .post('/v1/messages')
        .reply(
          400,
          { type: 'error', error: { type: 'invalid_request_error', message: 'Bad request' } },
          { 'content-type': 'application/json' },
        );

      await expect(
        adapter.chatCompletion({
          model: 'claude-3-5-sonnet-20241022',
          messages: [{ role: 'user', content: 'hi' }],
          maxTokens: 100,
        }),
      ).rejects.toMatchObject({
        code: 'invalid_request',
        retryable: false,
        provider: 'anthropic',
      });
      expect(nock.isDone()).toBe(true);
    });
  });

  describe('streamChatCompletion', () => {
    it('yields tokens and metrics from SSE stream', async () => {
      const adapter = new AnthropicAdapter();

      const sseData = [
        'event: message_start',
        'data: {"type":"message_start","message":{"id":"msg_test","type":"message","role":"assistant","model":"claude-3-5-sonnet-20241022","content":[],"stop_reason":null,"usage":{"input_tokens":1,"output_tokens":1}}}',
        '',
        'event: content_block_start',
        'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
        '',
        'event: content_block_delta',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}',
        '',
        'event: content_block_delta',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" world"}}',
        '',
        'event: content_block_stop',
        'data: {"type":"content_block_stop","index":0}',
        '',
        'event: message_delta',
        'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":2}}',
        '',
        'event: message_stop',
        'data: {"type":"message_stop"}',
        '',
      ].join('\n');

      nock('https://api.anthropic.com')
        .post('/v1/messages')
        .reply(200, sseData, { 'Content-Type': 'text/event-stream' });

      const chunks: unknown[] = [];
      for await (const chunk of adapter.streamChatCompletion({
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'hi' }],
        maxTokens: 100,
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
      expect((doneChunk as any).finishReason).toBe('end_turn');

      expect(nock.isDone()).toBe(true);
    });

    it('yields error chunk on 429', async () => {
      const adapter = new AnthropicAdapter();

      nock('https://api.anthropic.com')
        .post('/v1/messages')
        .times(3)
        .reply(
          429,
          { type: 'error', error: { type: 'rate_limit_error', message: 'Rate limit exceeded' } },
          { 'content-type': 'application/json', 'retry-after': '0' },
        );

      const chunks: unknown[] = [];
      for await (const chunk of adapter.streamChatCompletion({
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'hi' }],
        maxTokens: 100,
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
    it('calculates cost for claude-3-5-sonnet correctly', () => {
      const adapter = new AnthropicAdapter();
      const cost = adapter.estimateCost('claude-3-5-sonnet-20241022', 1000, 1000);
      expect(cost).toBeCloseTo(0.018, 5);
    });

    it('calculates cost for claude-3-opus correctly', () => {
      const adapter = new AnthropicAdapter();
      const cost = adapter.estimateCost('claude-3-opus-20240229', 2000, 1000);
      expect(cost).toBeCloseTo(0.105, 5);
    });

    it('falls back to claude-3-5-sonnet pricing for unknown models', () => {
      const adapter = new AnthropicAdapter();
      const knownCost = adapter.estimateCost('claude-3-5-sonnet-20241022', 1000, 1000);
      const unknownCost = adapter.estimateCost('unknown-model', 1000, 1000);
      expect(unknownCost).toBe(knownCost);
    });

    it('returns 0 for zero tokens', () => {
      const adapter = new AnthropicAdapter();
      expect(adapter.estimateCost('claude-3-5-sonnet-20241022', 0, 0)).toBe(0);
    });
  });
});
