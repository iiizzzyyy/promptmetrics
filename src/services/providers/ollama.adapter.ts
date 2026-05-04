import {
  type ChatCompletionRequest,
  type ChatCompletionResponse,
  type LLMModel,
  type LLMProviderAdapter,
  type StreamChunk,
  ProviderError,
} from '@services/llm-provider.adapter';
import { safeJsonParse } from '@utils/safe-json';

interface OllamaStreamChunk {
  message?: { content?: string };
  done?: boolean;
  done_reason?: string;
  eval_count?: number;
  prompt_eval_count?: number;
}

interface OllamaModelTag {
  name: string;
  model: string;
  size?: number;
}

function mapOllamaError(err: unknown): ProviderError {
  if (err instanceof Error) {
    if (err.message.includes('ECONNREFUSED') || err.message.includes('fetch failed')) {
      return ProviderError.unknown('ollama', 'Cannot connect to Ollama server. Is it running?');
    }
    return ProviderError.unknown('ollama', err.message);
  }
  return ProviderError.unknown('ollama', 'Unknown error');
}

export class OllamaAdapter implements LLMProviderAdapter {
  readonly provider = 'ollama';
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  }

  private async fetchJson(path: string, init?: globalThis.RequestInit): Promise<unknown> {
    const res = await globalThis.fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Ollama HTTP ${res.status}: ${text}`);
    }
    return res.json();
  }

  async listModels(): Promise<LLMModel[]> {
    try {
      const data = (await this.fetchJson('/api/tags')) as { models?: OllamaModelTag[] };
      const models = data.models || [];
      return models.map((m) => ({
        id: m.model || m.name,
        name: m.name,
        provider: 'ollama',
        contextWindow: 128_000,
      }));
    } catch {
      return [];
    }
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const startTime = Date.now();

    try {
      const messages = request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const body = {
        model: request.model,
        messages,
        stream: false,
        options: {
          temperature: request.temperature,
          num_predict: request.maxTokens,
          top_p: request.topP,
        },
      };

      const data = (await this.fetchJson('/api/chat', {
        method: 'POST',
        body: JSON.stringify(body),
      })) as {
        message?: { content?: string };
        eval_count?: number;
        prompt_eval_count?: number;
        done_reason?: string;
      };

      const output = data.message?.content || '';
      const tokensOut = data.eval_count || 0;
      const tokensIn = data.prompt_eval_count || this.estimateTokensIn(request);
      const latencyMs = Date.now() - startTime;

      return {
        id: `ollama-${Date.now()}`,
        model: request.model,
        output,
        tokensIn,
        tokensOut,
        latencyMs,
        costUsd: 0,
        finishReason: data.done_reason || 'stop',
      };
    } catch (err) {
      throw mapOllamaError(err);
    }
  }

  async *streamChatCompletion(
    request: ChatCompletionRequest,
    signal?: globalThis.AbortSignal,
  ): AsyncGenerator<StreamChunk> {
    const startTime = Date.now();

    try {
      const messages = request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const body = {
        model: request.model,
        messages,
        stream: true,
        options: {
          temperature: request.temperature,
          num_predict: request.maxTokens,
          top_p: request.topP,
        },
      };

      const res = await globalThis.fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`Ollama HTTP ${res.status}: ${text}`);
      }

      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new globalThis.TextDecoder();
      let buffer = '';
      let tokensOut = 0;
      let finishReason = 'stop';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            const parsed = safeJsonParse<OllamaStreamChunk | null>(trimmed, null);
            if (!parsed) continue;

            if (parsed.message?.content) {
              tokensOut += 1;
              yield { type: 'token', content: parsed.message.content };
            }

            if (parsed.done) {
              finishReason = parsed.done_reason || 'stop';
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      const tokensIn = this.estimateTokensIn(request);
      const latencyMs = Date.now() - startTime;

      yield {
        type: 'metrics',
        tokensIn,
        tokensOut,
        latencyMs,
        costUsd: 0,
      };

      yield { type: 'done', finishReason };
    } catch (err) {
      const providerErr = mapOllamaError(err);
      yield {
        type: 'error',
        message: providerErr.message,
        code: providerErr.code,
      };
    }
  }

  estimateCost(_model: string, _tokensIn: number, _tokensOut: number): number {
    return 0;
  }

  private estimateTokensIn(request: ChatCompletionRequest): number {
    let chars = 0;
    for (const msg of request.messages) {
      chars += msg.content.length;
    }
    return Math.ceil(chars / 4);
  }
}
