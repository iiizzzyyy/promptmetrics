import CircuitBreaker from 'opossum';

export interface CircuitBreakerOptions {
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  volumeThreshold?: number;
  timeout?: number;
}

export function createCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: CircuitBreakerOptions = {},
): CircuitBreaker {
  const breaker = new CircuitBreaker(fn, {
    errorThresholdPercentage: options.errorThresholdPercentage ?? 50,
    resetTimeout: options.resetTimeout ?? 30000,
    volumeThreshold: options.volumeThreshold ?? 5,
    timeout: options.timeout ?? 10000,
  });

  breaker.on('open', () => {
    console.warn(`Circuit breaker OPENED for ${fn.name || 'anonymous'}`);
  });

  breaker.on('halfOpen', () => {
    console.warn(`Circuit breaker HALF-OPEN for ${fn.name || 'anonymous'}`);
  });

  breaker.on('close', () => {
    console.warn(`Circuit breaker CLOSED for ${fn.name || 'anonymous'}`);
  });

  return breaker;
}
