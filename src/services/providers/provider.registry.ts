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

  get size(): number {
    return this.adapters.size;
  }

  unregister(providerName: string): void {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('unregister() is only allowed in test environment');
    }
    this.adapters.delete(providerName);
    this.cache.delete(providerName);
  }

  freeze(): void {
    Object.freeze(this.adapters);
  }
}

export const providerRegistry = new ProviderRegistry();

export async function registerBuiltinProviders(): Promise<void> {
  if (providerRegistry.size > 0) {
    return;
  }

  const { OpenAIAdapter } = await import('./openai.adapter');
  providerRegistry.register('openai', () => new OpenAIAdapter());

  const { AnthropicAdapter } = await import('./anthropic.adapter');
  providerRegistry.register('anthropic', () => new AnthropicAdapter());

  const { CohereAdapter } = await import('./cohere.adapter');
  providerRegistry.register('cohere', () => new CohereAdapter());

  const { OllamaAdapter } = await import('./ollama.adapter');
  providerRegistry.register('ollama', () => new OllamaAdapter());

  const { AzureOpenAIAdapter } = await import('./azure-openai.adapter');
  providerRegistry.register('azure_openai', () => new AzureOpenAIAdapter());

  providerRegistry.freeze();
}
