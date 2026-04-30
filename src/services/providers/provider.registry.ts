import { AppError } from '../../errors/app.error';
import type { LLMProviderAdapter } from '../llm-provider.adapter';

export class ProviderRegistry {
  private adapters = new Map<string, () => LLMProviderAdapter>();
  private cache = new Map<string, LLMProviderAdapter>();

  register(slug: string, factory: () => LLMProviderAdapter): void {
    this.adapters.set(slug, factory);
  }

  getProvider(slug: string): LLMProviderAdapter {
    const cached = this.cache.get(slug);
    if (cached) return cached;

    const factory = this.adapters.get(slug);
    if (!factory) {
      throw AppError.badRequest(`Unsupported provider: ${slug}`);
    }

    const adapter = factory();
    this.cache.set(slug, adapter);
    return adapter;
  }

  listProviders(): string[] {
    return Array.from(this.adapters.keys());
  }

  hasProvider(slug: string): boolean {
    return this.adapters.has(slug);
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const providerRegistry = new ProviderRegistry();

export function registerBuiltinProviders(): void {
  const { OpenAIAdapter } = require('./openai.adapter');
  providerRegistry.register('openai', () => new OpenAIAdapter());

  const { AnthropicAdapter } = require('./anthropic.adapter');
  providerRegistry.register('anthropic', () => new AnthropicAdapter());

  const { CohereAdapter } = require('./cohere.adapter');
  providerRegistry.register('cohere', () => new CohereAdapter());

  const { OllamaAdapter } = require('./ollama.adapter');
  providerRegistry.register('ollama', () => new OllamaAdapter());

  const { AzureOpenAIAdapter } = require('./azure-openai.adapter');
  providerRegistry.register('azure_openai', () => new AzureOpenAIAdapter());
}
