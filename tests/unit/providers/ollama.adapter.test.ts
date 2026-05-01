import nock from 'nock';
import { OllamaAdapter } from '@services/providers/ollama.adapter';

describe('OllamaAdapter', () => {
  const originalBaseUrl = process.env.OLLAMA_BASE_URL;

  beforeAll(() => {
    delete process.env.OLLAMA_BASE_URL;
  });

  afterAll(() => {
    if (originalBaseUrl !== undefined) {
      process.env.OLLAMA_BASE_URL = originalBaseUrl;
    } else {
      delete process.env.OLLAMA_BASE_URL;
    }
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('constructor', () => {
    it('uses default base URL when env var is missing', () => {
      const adapter = new OllamaAdapter();
      expect(adapter.provider).toBe('ollama');
    });
  });

  describe('provider', () => {
    it('returns "ollama"', () => {
      const adapter = new OllamaAdapter();
      expect(adapter.provider).toBe('ollama');
    });
  });

  describe('listModels', () => {
    it('returns models from /api/tags', async () => {
      const adapter = new OllamaAdapter();

      nock('http://localhost:11434')
        .get('/api/tags')
        .reply(200, {
          models: [
            { name: 'llama3', model: 'llama3:latest', size: 5000000000 },
            { name: 'mistral', model: 'mistral:latest', size: 4000000000 },
          ],
        });

      const models = await adapter.listModels();
      expect(models.length).toBe(2);
      expect(models).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'llama3:latest', name: 'llama3', provider: 'ollama' }),
          expect.objectContaining({ id: 'mistral:latest', name: 'mistral', provider: 'ollama' }),
        ]),
      );
      expect(nock.isDone()).toBe(true);
    });

    it('returns empty array when Ollama returns 500', async () => {
      const adapter = new OllamaAdapter();

      nock('http://localhost:11434').get('/api/tags').reply(500, { error: 'Internal server error' });

      const models = await adapter.listModels();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBe(0);
      expect(nock.isDone()).toBe(true);
    });
  });

  describe('chatCompletion', () => {
    it('sends correct request body and parses response', async () => {
      const adapter = new OllamaAdapter();
      let capturedBody: unknown;

      nock('http://localhost:11434')
        .post('/api/chat', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, {
          model: 'llama3',
          message: { role: 'assistant', content: 'Hello from Ollama' },
          eval_count: 5,
          prompt_eval_count: 10,
          done_reason: 'stop',
        });

      const response = await adapter.chatCompletion({
        model: 'llama3',
        messages: [
          { role: 'system', content: 'Be helpful' },
          { role: 'user', content: 'Hello' },
        ],
        temperature: 0.7,
        maxTokens: 100,
        topP: 0.9,
      });

      expect(capturedBody).toMatchObject({
        model: 'llama3',
        messages: [
          { role: 'system', content: 'Be helpful' },
          { role: 'user', content: 'Hello' },
        ],
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 100,
          top_p: 0.9,
        },
      });
      expect(response.output).toBe('Hello from Ollama');
      expect(response.tokensIn).toBe(10);
      expect(response.tokensOut).toBe(5);
      expect(response.finishReason).toBe('stop');
      expect(response.model).toBe('llama3');
      expect(response.costUsd).toBe(0);
      expect(nock.isDone()).toBe(true);
    });

    it('falls back to estimated tokens when prompt_eval_count is missing', async () => {
      const adapter = new OllamaAdapter();

      nock('http://localhost:11434')
        .post('/api/chat')
        .reply(200, {
          model: 'llama3',
          message: { role: 'assistant', content: 'Hi' },
          eval_count: 1,
          done_reason: 'stop',
        });

      const response = await adapter.chatCompletion({
        model: 'llama3',
        messages: [{ role: 'user', content: 'Hello world' }],
      });

      expect(response.tokensIn).toBeGreaterThan(0);
      expect(response.tokensOut).toBe(1);
      expect(nock.isDone()).toBe(true);
    });

    it('maps HTTP errors to ProviderError', async () => {
      const adapter = new OllamaAdapter();

      nock('http://localhost:11434').post('/api/chat').reply(429, { error: 'Rate limit exceeded' });

      await expect(
        adapter.chatCompletion({ model: 'llama3', messages: [{ role: 'user', content: 'hi' }] }),
      ).rejects.toMatchObject({
        provider: 'ollama',
        code: 'unknown',
        retryable: false,
      });
      expect(nock.isDone()).toBe(true);
    });
  });

  describe('streamChatCompletion', () => {
    it('yields tokens and metrics from NDJSON stream', async () => {
      const adapter = new OllamaAdapter();

      const responseBody = [
        JSON.stringify({ model: 'llama3', message: { role: 'assistant', content: 'Hello' }, done: false }),
        JSON.stringify({ model: 'llama3', message: { role: 'assistant', content: ' world' }, done: false }),
        JSON.stringify({
          model: 'llama3',
          message: { role: 'assistant', content: '' },
          done: true,
          done_reason: 'stop',
          eval_count: 2,
          prompt_eval_count: 3,
        }),
      ].join('\n');

      nock('http://localhost:11434')
        .post('/api/chat')
        .reply(200, responseBody, { 'Content-Type': 'application/x-ndjson' });

      const chunks: unknown[] = [];
      for await (const chunk of adapter.streamChatCompletion({
        model: 'llama3',
        messages: [{ role: 'user', content: 'hi' }],
      })) {
        chunks.push(chunk);
      }

      const tokenChunks = chunks.filter((c: any) => c.type === 'token');
      expect(tokenChunks.map((c: any) => c.content)).toEqual(['Hello', ' world']);

      const metricsChunk = chunks.find((c: any) => c.type === 'metrics');
      expect(metricsChunk).toBeDefined();
      expect((metricsChunk as any).tokensOut).toBe(2);
      expect((metricsChunk as any).costUsd).toBe(0);

      const doneChunk = chunks.find((c: any) => c.type === 'done');
      expect(doneChunk).toBeDefined();
      expect((doneChunk as any).finishReason).toBe('stop');

      expect(nock.isDone()).toBe(true);
    });

    it('yields error chunk on HTTP error', async () => {
      const adapter = new OllamaAdapter();

      nock('http://localhost:11434').post('/api/chat').reply(500, { error: 'Internal server error' });

      const chunks: unknown[] = [];
      for await (const chunk of adapter.streamChatCompletion({
        model: 'llama3',
        messages: [{ role: 'user', content: 'hi' }],
      })) {
        chunks.push(chunk);
      }

      const errorChunk = chunks.find((c: any) => c.type === 'error');
      expect(errorChunk).toBeDefined();
      expect((errorChunk as any).code).toBe('unknown');
      expect(nock.isDone()).toBe(true);
    });
  });

  describe('estimateCost', () => {
    it('returns 0 for any model', () => {
      const adapter = new OllamaAdapter();
      expect(adapter.estimateCost('llama3', 1000, 1000)).toBe(0);
    });
  });
});
