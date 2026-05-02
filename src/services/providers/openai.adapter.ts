import OpenAI from 'openai';
import {
  type ChatCompletionRequest,
  type ChatCompletionResponse,
  type LLMModel,
  type LLMProviderAdapter,
  type StreamChunk,
  ProviderError,
} from '@services/llm-provider.adapter';

interface PricingEntry {
  inputPer1k: number;
  outputPer1k: number;
}

const PRICING_TABLE: Record<string, PricingEntry> = {
  'gpt-4o': { inputPer1k: 0.0025, outputPer1k: 0.01 },
  'gpt-4o-mini': { inputPer1k: 0.00015, outputPer1k: 0.0006 },
  'gpt-4-turbo': { inputPer1k: 0.01, outputPer1k: 0.03 },
  'gpt-4-turbo-preview': { inputPer1k: 0.01, outputPer1k: 0.03 },
  'gpt-4': { inputPer1k: 0.03, outputPer1k: 0.06 },
  'gpt-3.5-turbo': { inputPer1k: 0.0005, outputPer1k: 0.0015 },
};

function mapOpenAIError(err: unknown): ProviderError {
  if (err instanceof OpenAI.APIError) {
    const status = err.status;
    const message = err.message || 'Unknown OpenAI error';

    if (status === 429) {
      return ProviderError.rateLimit('openai');
    }
    if (status === 400) {
      return ProviderError.invalidRequest('openai', message);
    }
    if (status === 401 || status === 403) {
      return ProviderError.invalidRequest('openai', `Authentication error: ${message}`);
    }
    if (status && status >= 500) {
      return ProviderError.unknown('openai', message);
    }
    return ProviderError.unknown('openai', message);
  }

  if (err instanceof Error) {
    return ProviderError.unknown('openai', err.message);
  }

  return ProviderError.unknown('openai', 'Unknown error');
}

export class OpenAIAdapter implements LLMProviderAdapter {
  readonly provider = 'openai';
  private client: OpenAI | null = null;

  constructor() {
    // Lazy validation in chat methods
  }

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is required');
      }
      this.client = new OpenAI({ apiKey });
    }
    return this.client;
  }

  async listModels(): Promise<LLMModel[]> {
    return [
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', contextWindow: 128_000 },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', contextWindow: 128_000 },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', contextWindow: 128_000 },
      { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo Preview', provider: 'openai', contextWindow: 128_000 },
      { id: 'gpt-4', name: 'GPT-4', provider: 'openai', contextWindow: 8_192 },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', contextWindow: 16_385 },
    ];
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const startTime = Date.now();

    try {
      const response = await this.getClient().chat.completions.create({
        model: request.model,
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        top_p: request.topP,
        stream: false,
      });

      const choice = response.choices[0];
      const output = choice?.message?.content || '';
      const tokensIn = response.usage?.prompt_tokens || 0;
      const tokensOut = response.usage?.completion_tokens || 0;
      const latencyMs = Date.now() - startTime;
      const costUsd = this.estimateCost(request.model, tokensIn, tokensOut);

      return {
        id: response.id,
        model: response.model,
        output,
        tokensIn,
        tokensOut,
        latencyMs,
        costUsd,
        finishReason: choice?.finish_reason || 'stop',
      };
    } catch (err) {
      throw mapOpenAIError(err);
    }
  }

  async *streamChatCompletion(request: ChatCompletionRequest, signal?: globalThis.AbortSignal): AsyncGenerator<StreamChunk> {
    const startTime = Date.now();

    try {
      const stream = await this.getClient().chat.completions.create(
        {
          model: request.model,
          messages: request.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          temperature: request.temperature,
          max_tokens: request.maxTokens,
          top_p: request.topP,
          stream: true,
        },
        { signal },
      );

      let tokensOut = 0;
      let finishReason = 'stop';

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        const content = delta?.content;
        const reason = chunk.choices[0]?.finish_reason;

        if (reason) {
          finishReason = reason;
        }

        if (content) {
          tokensOut += 1;
          yield { type: 'token', content };
        }
      }

      // OpenAI streaming doesn't provide usage data, so we estimate
      const tokensIn = this.estimateTokensIn(request);
      const latencyMs = Date.now() - startTime;
      const costUsd = this.estimateCost(request.model, tokensIn, tokensOut);

      yield {
        type: 'metrics',
        tokensIn,
        tokensOut,
        latencyMs,
        costUsd,
      };

      yield { type: 'done', finishReason };
    } catch (err) {
      const providerErr = mapOpenAIError(err);
      yield {
        type: 'error',
        message: providerErr.message,
        code: providerErr.code,
      };
    }
  }

  estimateCost(model: string, tokensIn: number, tokensOut: number): number {
    const pricing = PRICING_TABLE[model] || PRICING_TABLE['gpt-4o'];
    const inputCost = (tokensIn / 1000) * pricing.inputPer1k;
    const outputCost = (tokensOut / 1000) * pricing.outputPer1k;
    return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
  }

  private estimateTokensIn(request: ChatCompletionRequest): number {
    // Rough heuristic: 1 token ≈ 4 chars for English text
    let chars = 0;
    for (const msg of request.messages) {
      chars += msg.content.length;
    }
    return Math.ceil(chars / 4);
  }
}
