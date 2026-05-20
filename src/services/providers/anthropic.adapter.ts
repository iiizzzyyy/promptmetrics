import Anthropic from '@anthropic-ai/sdk';
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
  'claude-3-5-sonnet-20241022': { inputPer1k: 0.003, outputPer1k: 0.015 },
  'claude-3-opus-20240229': { inputPer1k: 0.015, outputPer1k: 0.075 },
};

function mapAnthropicError(err: unknown): ProviderError {
  if (err instanceof Anthropic.APIError) {
    const status = err.status;
    const message = err.message || 'Unknown Anthropic error';

    if (status === 429) {
      return ProviderError.rateLimit('anthropic');
    }
    if (status === 529) {
      return ProviderError.rateLimit('anthropic');
    }
    if (status === 400) {
      return ProviderError.invalidRequest('anthropic', message);
    }
    if (status === 401 || status === 403) {
      return ProviderError.invalidRequest('anthropic', `Authentication error: ${message}`);
    }
    if (status && status >= 500) {
      return ProviderError.unknown('anthropic', message);
    }
    return ProviderError.unknown('anthropic', message);
  }

  if (err instanceof Error) {
    return ProviderError.unknown('anthropic', err.message);
  }

  return ProviderError.unknown('anthropic', 'Unknown error');
}

export class AnthropicAdapter implements LLMProviderAdapter {
  readonly provider = 'anthropic';
  private client: Anthropic | null = null;

  constructor() {
    // Lazy validation in chat methods
  }

  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY environment variable is required');
      }
      this.client = new Anthropic({ apiKey });
    }
    return this.client;
  }

  async listModels(): Promise<LLMModel[]> {
    return [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic', contextWindow: 200_000 },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic', contextWindow: 200_000 },
    ];
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const startTime = Date.now();

    try {
      const systemMessages = request.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
      const apiMessages = request.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const response = await this.getClient().messages.create({
        model: request.model,
        max_tokens: request.maxTokens ?? 4096,
        system: systemMessages || undefined,
        messages: apiMessages,
        temperature: request.temperature,
        top_p: request.topP,
      });

      const output = this.extractText(response.content);
      const tokensIn = response.usage?.input_tokens || 0;
      const tokensOut = response.usage?.output_tokens || 0;
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
        finishReason: response.stop_reason || 'stop',
      };
    } catch (err) {
      throw mapAnthropicError(err);
    }
  }

  async *streamChatCompletion(request: ChatCompletionRequest, signal?: globalThis.AbortSignal): AsyncGenerator<StreamChunk> {
    const startTime = Date.now();

    try {
      const systemMessages = request.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
      const apiMessages = request.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const stream = await this.getClient().messages.create(
        {
          model: request.model,
          max_tokens: request.maxTokens ?? 4096,
          system: systemMessages || undefined,
          messages: apiMessages,
          temperature: request.temperature,
          top_p: request.topP,
          stream: true,
        },
        { signal },
      );

      let tokensOut = 0;
      let finishReason = 'stop';

      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          const text = event.delta.type === 'text_delta' ? event.delta.text : undefined;
          if (text) {
            tokensOut += 1;
            yield { type: 'token', content: text };
          }
        }

        if (event.type === 'message_delta') {
          if (event.delta.stop_reason) {
            finishReason = event.delta.stop_reason;
          }
        }
      }

      // Anthropic streaming doesn't provide usage data, so we estimate
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
      const providerErr = mapAnthropicError(err);
      yield {
        type: 'error',
        message: providerErr.message,
        code: providerErr.code,
      };
    }
  }

  estimateCost(model: string, tokensIn: number, tokensOut: number): number {
    const pricing = PRICING_TABLE[model];
    if (!pricing) {
      console.warn(`Unknown model ${model} for cost estimation, using claude-3-5-sonnet-20241022 pricing as fallback`);
    }
    const resolvedPricing = pricing || PRICING_TABLE['claude-3-5-sonnet-20241022'];
    const inputCost = (tokensIn / 1000) * resolvedPricing.inputPer1k;
    const outputCost = (tokensOut / 1000) * resolvedPricing.outputPer1k;
    return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
  }

  private extractText(content: Anthropic.Message['content']): string {
    return content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
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
