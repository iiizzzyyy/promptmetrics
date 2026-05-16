import CircuitBreaker from 'opossum';
import { LLMModel } from '@services/llm-provider.adapter';
import { providerRegistry } from '@services/providers/provider.registry';
import { renderTemplate } from '@services/mustache-renderer.service';
import { LogService } from '@services/log.service';
import { BudgetService } from '@services/budget.service';
import { createCircuitBreaker } from '@services/circuit-breaker.service';
import {
  ChatCompletionMessage,
  ChatCompletionResponse,
  StreamChunk,
  ProviderError,
} from '@services/llm-provider.adapter';
import { PaginatedResponse, buildPaginatedResponse, parsePagination } from '@utils/pagination';

interface ModelsCacheEntry {
  data: LLMModel[];
  timestamp: number;
}

const CACHE_TTL_MS = 60_000;
const TEN_MINUTES_MS = 600_000;

function withTimeout<T>(promise: Promise<T>, ms: number, provider: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(ProviderError.timeout(provider)), ms)),
  ]);
}

async function* timedStream(gen: AsyncGenerator<StreamChunk>, ms: number): AsyncGenerator<StreamChunk> {
  const deadline = Date.now() + ms;
  for await (const chunk of gen) {
    if (Date.now() > deadline) {
      yield { type: 'error', message: 'Request timed out', code: 'timeout' };
      return;
    }
    yield chunk;
    if (chunk.type === 'done' || chunk.type === 'error') {
      return;
    }
  }
}

export class PlaygroundProxyService {
  private modelsCache: ModelsCacheEntry | null = null;
  private logService = new LogService();
  private budgetService = new BudgetService();
  private breakers = new Map<string, CircuitBreaker>();

  private renderMessages(
    messages: ChatCompletionMessage[],
    variables?: Record<string, unknown>,
  ): ChatCompletionMessage[] {
    if (!variables || Object.keys(variables).length === 0) {
      return messages;
    }
    // Skip assistant-role messages — they are example outputs, not templates.
    // This matches PromptService.getPrompt() which also skips assistant messages.
    return messages.map((m) => {
      if (m.role === 'assistant') return m;
      return { ...m, content: renderTemplate(m.content, variables, { strict: true }) };
    });
  }

  private async logRun(
    workspaceId: string,
    provider: string,
    model: string,
    response: ChatCompletionResponse,
  ): Promise<void> {
    await this.logService.createLog(
      {
        prompt_name: 'playground',
        version_tag: 'playground',
        provider,
        model,
        tokens_in: response.tokensIn,
        tokens_out: response.tokensOut,
        latency_ms: response.latencyMs,
        cost_usd: response.costUsd,
      },
      workspaceId,
    );
  }

  private getBreakerForProvider(providerSlug: string, fn: (...args: any[]) => Promise<any>): CircuitBreaker {
    let breaker = this.breakers.get(providerSlug);
    if (!breaker) {
      breaker = createCircuitBreaker(fn, {
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        volumeThreshold: 5,
        timeout: 60000,
      });
      this.breakers.set(providerSlug, breaker);
    }
    return breaker;
  }

  async chatCompletion(
    workspaceId: string,
    providerSlug: string,
    model: string,
    messages: ChatCompletionMessage[],
    variables?: Record<string, unknown>,
    temperature?: number,
    maxTokens?: number,
    topP?: number,
  ): Promise<ChatCompletionResponse> {
    await this.budgetService.checkBudget(workspaceId);
    const provider = providerRegistry.getProvider(providerSlug);
    const renderedMessages = this.renderMessages(messages, variables);

    const breaker = this.getBreakerForProvider(providerSlug, (req: unknown) => provider.chatCompletion(req as any));
    const response = await withTimeout(
      breaker.fire({
        model,
        messages: renderedMessages,
        temperature,
        maxTokens,
        topP,
        stream: false,
      }) as Promise<ChatCompletionResponse>,
      TEN_MINUTES_MS,
      providerSlug,
    );

    await this.logRun(workspaceId, providerSlug, model, response);
    return response;
  }

  async *streamChatCompletion(
    workspaceId: string,
    providerSlug: string,
    model: string,
    messages: ChatCompletionMessage[],
    variables?: Record<string, unknown>,
    temperature?: number,
    maxTokens?: number,
    topP?: number,
  ): AsyncGenerator<StreamChunk> {
    await this.budgetService.checkBudget(workspaceId);
    const provider = providerRegistry.getProvider(providerSlug);
    const renderedMessages = this.renderMessages(messages, variables);

    const generator = provider.streamChatCompletion({
      model,
      messages: renderedMessages,
      temperature,
      maxTokens,
      topP,
      stream: true,
    });

    let metricsChunk: StreamChunk | null = null;

    for await (const chunk of timedStream(generator, TEN_MINUTES_MS)) {
      yield chunk;
      if (chunk.type === 'metrics') {
        metricsChunk = chunk;
      }
      if (chunk.type === 'done' || chunk.type === 'error') {
        break;
      }
    }

    if (metricsChunk && metricsChunk.type === 'metrics') {
      await this.logService.createLog(
        {
          prompt_name: 'playground',
          version_tag: 'playground',
          provider: providerSlug,
          model,
          tokens_in: metricsChunk.tokensIn,
          tokens_out: metricsChunk.tokensOut,
          latency_ms: metricsChunk.latencyMs,
          cost_usd: metricsChunk.costUsd,
        },
        workspaceId,
      );
    }
  }

  async textCompletion(
    workspaceId: string,
    providerSlug: string,
    model: string,
    prompt: string,
    variables?: Record<string, unknown>,
    temperature?: number,
    maxTokens?: number,
    topP?: number,
  ): Promise<ChatCompletionResponse> {
    return this.chatCompletion(
      workspaceId,
      providerSlug,
      model,
      [{ role: 'user', content: prompt }],
      variables,
      temperature,
      maxTokens,
      topP,
    );
  }

  clearModelsCache(): void {
    this.modelsCache = null;
  }

  async listModels(_workspaceId: string, page: number, limit: number): Promise<PaginatedResponse<LLMModel>> {
    const now = Date.now();

    let allModels: LLMModel[];
    if (this.modelsCache && now - this.modelsCache.timestamp < CACHE_TTL_MS) {
      allModels = this.modelsCache.data;
    } else {
      const slugs = providerRegistry.listProviders();
      const results = await Promise.allSettled(
        slugs.map((slug) => {
          try {
            const provider = providerRegistry.getProvider(slug);
            return provider.listModels();
          } catch {
            return Promise.resolve([]);
          }
        }),
      );

      allModels = [];
      for (const result of results) {
        if (result.status === 'fulfilled') {
          allModels.push(...result.value);
        }
      }

      this.modelsCache = { data: allModels, timestamp: now };
    }

    const { offset } = parsePagination({ page: String(page), limit: String(limit) });
    const items = allModels.slice(offset, offset + limit);
    return buildPaginatedResponse(items, allModels.length, page, limit);
  }
}
