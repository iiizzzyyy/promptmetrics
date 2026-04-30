import {
  ProviderRegistry,
  providerRegistry,
  registerBuiltinProviders,
} from '../../../src/services/providers/provider.registry';

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  describe('register and getProvider', () => {
    it('registers and lazily instantiates a provider', () => {
      const factory = jest.fn().mockReturnValue({ slug: 'mock' });
      registry.register('mock', factory);
      expect(factory).not.toHaveBeenCalled();

      const provider = registry.getProvider('mock');
      expect(factory).toHaveBeenCalledTimes(1);
      expect(provider).toEqual({ slug: 'mock' });
    });

    it('caches provider instances after first access', () => {
      const factory = jest.fn().mockReturnValue({ slug: 'mock' });
      registry.register('mock', factory);
      registry.getProvider('mock');
      registry.getProvider('mock');
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it('throws for unsupported provider', () => {
      expect(() => registry.getProvider('unknown')).toThrow('Unsupported provider: unknown');
    });
  });

  describe('listProviders', () => {
    it('returns registered slugs', () => {
      registry.register('a', () => ({ slug: 'a' }) as any);
      registry.register('b', () => ({ slug: 'b' }) as any);
      expect(registry.listProviders()).toEqual(['a', 'b']);
    });
  });

  describe('hasProvider', () => {
    it('returns true for registered provider', () => {
      registry.register('x', () => ({ slug: 'x' }) as any);
      expect(registry.hasProvider('x')).toBe(true);
    });

    it('returns false for unregistered provider', () => {
      expect(registry.hasProvider('y')).toBe(false);
    });
  });

  describe('clearCache', () => {
    it('clears the instance cache so next get re-instantiates', () => {
      const factory = jest.fn().mockReturnValue({ slug: 'mock' });
      registry.register('mock', factory);
      registry.getProvider('mock');
      registry.clearCache();
      registry.getProvider('mock');
      expect(factory).toHaveBeenCalledTimes(2);
    });
  });

  describe('registerBuiltinProviders', () => {
    beforeEach(() => {
      providerRegistry.clearCache();
    });

    afterEach(() => {
      providerRegistry.clearCache();
    });

    it('registers all builtin providers lazily', () => {
      registerBuiltinProviders();
      expect(providerRegistry.hasProvider('openai')).toBe(true);
      expect(providerRegistry.hasProvider('anthropic')).toBe(true);
      expect(providerRegistry.hasProvider('cohere')).toBe(true);
      expect(providerRegistry.hasProvider('ollama')).toBe(true);
      expect(providerRegistry.hasProvider('azure_openai')).toBe(true);
    });

    it('does not instantiate providers eagerly', () => {
      // Since registerBuiltinProviders uses require() inside factories,
      // merely registering should not throw or instantiate.
      expect(() => registerBuiltinProviders()).not.toThrow();
    });
  });
});
