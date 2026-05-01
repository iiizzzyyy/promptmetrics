import nock from 'nock';
import { AzureOpenAIAdapter } from '@services/providers/azure-openai.adapter';

describe('AzureOpenAIAdapter', () => {
  const originalKey = process.env.AZURE_OPENAI_API_KEY;
  const originalUrl = process.env.AZURE_OPENAI_BASE_URL;

  beforeAll(() => {
    process.env.AZURE_OPENAI_API_KEY = 'test-azure-key';
    process.env.AZURE_OPENAI_BASE_URL = 'https://test.openai.azure.com/openai/deployments/test-deployment';
  });

  afterAll(() => {
    process.env.AZURE_OPENAI_API_KEY = originalKey;
    process.env.AZURE_OPENAI_BASE_URL = originalUrl;
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('constructor', () => {
    it('throws when AZURE_OPENAI_API_KEY is missing', () => {
      delete process.env.AZURE_OPENAI_API_KEY;
      expect(() => new AzureOpenAIAdapter()).toThrow('AZURE_OPENAI_API_KEY environment variable is required');
      process.env.AZURE_OPENAI_API_KEY = 'test-azure-key';
    });

    it('throws when AZURE_OPENAI_BASE_URL is missing', () => {
      delete process.env.AZURE_OPENAI_BASE_URL;
      expect(() => new AzureOpenAIAdapter()).toThrow('AZURE_OPENAI_BASE_URL environment variable is required');
      process.env.AZURE_OPENAI_BASE_URL = 'https://test.openai.azure.com/openai/deployments/test-deployment';
    });
  });

  describe('provider', () => {
    it('returns "azure_openai"', () => {
      const adapter = new AzureOpenAIAdapter();
      expect(adapter.provider).toBe('azure_openai');
    });
  });

  describe('listModels', () => {
    it('returns the hardcoded model list', async () => {
      const adapter = new AzureOpenAIAdapter();
      const models = await adapter.listModels();

      expect(models.length).toBeGreaterThanOrEqual(3);
      expect(models).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'gpt-4o', provider: 'azure_openai' }),
          expect.objectContaining({ id: 'gpt-4o-mini', provider: 'azure_openai' }),
          expect.objectContaining({ id: 'gpt-4-turbo', provider: 'azure_openai' }),
        ]),
      );
    });
  });

  describe('chatCompletion', () => {
    it('sends correct request body and parses response', async () => {
      const adapter = new AzureOpenAIAdapter();
      let capturedBody: unknown;

      nock('https://test.openai.azure.com')
        .post(/\/openai\/deployments\/.*\/chat\/completions/, (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, {
          id: 'chatcmpl-azure-test',
          object: 'chat.completion',
          created: 1234567890,
          model: 'gpt-4o',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Hello from Azure' },
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
      expect(response.output).toBe('Hello from Azure');
      expect(response.tokensIn).toBe(10);
      expect(response.tokensOut).toBe(5);
      expect(response.finishReason).toBe('stop');
      expect(response.id).toBe('chatcmpl-azure-test');
      expect(nock.isDone()).toBe(true);
    });

    it('maps 429 to ProviderError.rateLimit with retryable=true', async () => {
      const adapter = new AzureOpenAIAdapter();

      nock('https://test.openai.azure.com')
        .post(/\/openai\/deployments\/.*\/chat\/completions/)
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
        provider: 'azure_openai',
      });
      expect(nock.isDone()).toBe(true);
    });

    it('maps 400 to invalidRequest with retryable=false', async () => {
      const adapter = new AzureOpenAIAdapter();

      nock('https://test.openai.azure.com')
        .post(/\/openai\/deployments\/.*\/chat\/completions/)
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
        provider: 'azure_openai',
      });
      expect(nock.isDone()).toBe(true);
    });
  });

  describe('streamChatCompletion', () => {
    it('yields tokens and metrics from SSE stream', async () => {
      const adapter = new AzureOpenAIAdapter();

      const sseData = [
        'data: {"id":"chatcmpl-azure-test","object":"chat.completion.chunk","created":1,"model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}',
        'data: {"id":"chatcmpl-azure-test","object":"chat.completion.chunk","created":1,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}',
        'data: {"id":"chatcmpl-azure-test","object":"chat.completion.chunk","created":1,"model":"gpt-4o","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
        'data: [DONE]',
        '',
      ].join('\n\n');

      nock('https://test.openai.azure.com')
        .post(/\/openai\/deployments\/.*\/chat\/completions/)
        .reply(200, sseData, { 'Content-Type': 'text/event-stream' });

      const chunks: unknown[] = [];
      for await (const chunk of adapter.streamChatCompletion({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'hi' }],
      })) {
        chunks.push(chunk);
      }

      const tokenChunks = chunks.filter((c: any) => c.type === 'token');
      expect(tokenChunks.map((c: any) => c.content)).toEqual(['Hello']);

      const doneChunk = chunks.find((c: any) => c.type === 'done');
      expect(doneChunk).toBeDefined();
      expect((doneChunk as any).finishReason).toBe('stop');

      expect(nock.isDone()).toBe(true);
    });

    it('yields error chunk on 429', async () => {
      const adapter = new AzureOpenAIAdapter();

      nock('https://test.openai.azure.com')
        .post(/\/openai\/deployments\/.*\/chat\/completions/)
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
      const adapter = new AzureOpenAIAdapter();
      const cost = adapter.estimateCost('gpt-4o', 1000, 1000);
      expect(cost).toBeCloseTo(0.0125, 5);
    });

    it('falls back to gpt-4o pricing for unknown models', () => {
      const adapter = new AzureOpenAIAdapter();
      const knownCost = adapter.estimateCost('gpt-4o', 1000, 1000);
      const unknownCost = adapter.estimateCost('unknown-model', 1000, 1000);
      expect(unknownCost).toBe(knownCost);
    });

    it('returns 0 for zero tokens', () => {
      const adapter = new AzureOpenAIAdapter();
      expect(adapter.estimateCost('gpt-4o', 0, 0)).toBe(0);
    });
  });
});
