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
};

function extractStatusFromError(err: unknown): number | undefined {
  if (err instanceof OpenAI.APIError) {
    return err.status;
  }
  if (err instanceof Error) {
    // Fallback for non-APIError HTTP errors (e.g. from nock or generic fetch errors)
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

function mapAzureError(err: unknown): ProviderError {
  const status = extractStatusFromError(err);
  const message = (err instanceof Error ? err.message : undefined) || 'Unknown Azure OpenAI error';

  if (status === 429) {
    return ProviderError.rateLimit('azure_openai');
  }
  if (status === 400) {
    return ProviderError.invalidRequest('azure_openai', message);
  }
  if (status === 401 || status === 403) {
    return ProviderError.invalidRequest('azure_openai', `Authentication error: ${message}`);
  }
  if (status && status >= 500) {
    return ProviderError.unknown('azure_openai', message);
  }

  if (err instanceof Error) {
    return ProviderError.unknown('azure_openai', err.message);
  }

  return ProviderError.unknown('azure_openai', 'Unknown error');
}

export class AzureOpenAIAdapter implements LLMProviderAdapter {
  readonly provider = 'azure_openai';
  private client: OpenAI;

  constructor() {
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const baseURL = process.env.AZURE_OPENAI_BASE_URL;

    if (!apiKey) {
      throw new Error('AZURE_OPENAI_API_KEY environment variable is required');
    }
    if (!baseURL) {
      throw new Error('AZURE_OPENAI_BASE_URL environment variable is required');
    }

    this.client = new OpenAI({ apiKey, baseURL });
  }

  async listModels(): Promise<LLMModel[]> {
    return [
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'azure_openai', contextWindow: 128_000 },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'azure_openai', contextWindow: 128_000 },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'azure_openai', contextWindow: 128_000 },
    ];
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const startTime = Date.now();

    try {
      const response = await this.client.chat.completions.create({
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
      throw mapAzureError(err);
    }
  }

  async *streamChatCompletion(request: ChatCompletionRequest, signal?: globalThis.AbortSignal): AsyncGenerator<StreamChunk> {
    const startTime = Date.now();

    try {
      const stream = await this.client.chat.completions.create(
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
      const providerErr = mapAzureError(err);
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
    let chars = 0;
    for (const msg of request.messages) {
      chars += msg.content.length;
    }
    return Math.ceil(chars / 4);
  }
}
