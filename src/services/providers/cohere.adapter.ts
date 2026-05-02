import { CohereClient, CohereError } from 'cohere-ai';
import type * as Cohere from 'cohere-ai/api';
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
  'command-r': { inputPer1k: 0.0005, outputPer1k: 0.0015 },
  'command-r-plus': { inputPer1k: 0.003, outputPer1k: 0.015 },
};

function extractStatusFromError(err: unknown): number | undefined {
  if (err instanceof Error && 'statusCode' in err) {
    return (err as CohereError).statusCode;
  }
  if (err instanceof Error) {
    const match = err.message.match(/(\d{3})/);
    if (match) {
      const status = parseInt(match[1], 10);
      if (status >= 100 && status < 600) {
        return status;
      }
    }
  }
  return undefined;
}

function mapCohereError(err: unknown): ProviderError {
  const status = extractStatusFromError(err);
  const message = (err instanceof Error ? err.message : undefined) || 'Unknown Cohere error';

  if (status === 429) {
    return ProviderError.rateLimit('cohere');
  }
  if (status === 400) {
    return ProviderError.invalidRequest('cohere', message);
  }
  if (status === 401 || status === 403) {
    return ProviderError.invalidRequest('cohere', `Authentication error: ${message}`);
  }
  if (status && status >= 500) {
    return ProviderError.unknown('cohere', message);
  }

  if (err instanceof Error) {
    return ProviderError.unknown('cohere', err.message);
  }

  return ProviderError.unknown('cohere', 'Unknown error');
}

export class CohereAdapter implements LLMProviderAdapter {
  readonly provider = 'cohere';
  private client: CohereClient | null = null;

  constructor() {
    // Lazy validation in chat methods
  }

  private getClient(): CohereClient {
    if (!this.client) {
      const apiKey = process.env.COHERE_API_KEY;
      if (!apiKey) {
        throw new Error('COHERE_API_KEY environment variable is required');
      }
      this.client = new CohereClient({ token: apiKey });
    }
    return this.client;
  }

  async listModels(): Promise<LLMModel[]> {
    return [
      { id: 'command-r', name: 'Command R', provider: 'cohere', contextWindow: 128_000 },
      { id: 'command-r-plus', name: 'Command R+', provider: 'cohere', contextWindow: 128_000 },
    ];
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const startTime = Date.now();

    try {
      const response = await this.getClient().v2.chat({
        model: request.model,
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })) as Cohere.ChatMessageV2[],
        temperature: request.temperature,
        maxTokens: request.maxTokens,
      });

      const output = this.extractText(response.message);
      const tokensIn = response.usage?.billedUnits?.inputTokens ?? response.usage?.tokens?.inputTokens ?? 0;
      const tokensOut = response.usage?.billedUnits?.outputTokens ?? response.usage?.tokens?.outputTokens ?? 0;
      const latencyMs = Date.now() - startTime;
      const costUsd = this.estimateCost(request.model, tokensIn, tokensOut);

      return {
        id: response.id,
        model: request.model,
        output,
        tokensIn,
        tokensOut,
        latencyMs,
        costUsd,
        finishReason: response.finishReason?.toLowerCase() || 'stop',
      };
    } catch (err) {
      throw mapCohereError(err);
    }
  }

  async *streamChatCompletion(request: ChatCompletionRequest, signal?: globalThis.AbortSignal): AsyncGenerator<StreamChunk> {
    const startTime = Date.now();

    try {
      const stream = await this.getClient().v2.chatStream({
        model: request.model,
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })) as Cohere.ChatMessageV2[],
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        signal,
      } as any);

      let tokensOut = 0;
      let finishReason = 'stop';

      for await (const event of stream) {
        if (event.type === 'content-delta') {
          const text = event.delta?.message?.content?.text;
          if (text) {
            tokensOut += 1;
            yield { type: 'token', content: text };
          }
        }

        if (event.type === 'message-end') {
          finishReason = event.delta?.finishReason?.toLowerCase() || 'stop';
        }
      }

      // Cohere streaming doesn't provide token counts in a simple way, so we estimate
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
      const providerErr = mapCohereError(err);
      yield {
        type: 'error',
        message: providerErr.message,
        code: providerErr.code,
      };
    }
  }

  estimateCost(model: string, tokensIn: number, tokensOut: number): number {
    const pricing = PRICING_TABLE[model] || PRICING_TABLE['command-r'];
    const inputCost = (tokensIn / 1000) * pricing.inputPer1k;
    const outputCost = (tokensOut / 1000) * pricing.outputPer1k;
    return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
  }

  private extractText(message: Cohere.AssistantMessageResponse): string {
    if (!message.content) return '';
    return message.content
      .filter((block): block is Cohere.AssistantMessageResponseContentItem.Text => block.type === 'text')
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
