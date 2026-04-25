import { createCircuitBreaker } from '@services/circuit-breaker.service';
import CircuitBreaker from 'opossum';

describe('CircuitBreakerService', () => {
  let successCount = 0;
  let failCount = 0;

  const successFn = async () => {
    successCount++;
    return 'ok';
  };

  const failFn = async () => {
    failCount++;
    throw new Error('always fails');
  };

  beforeEach(() => {
    successCount = 0;
    failCount = 0;
  });

  afterEach(() => {
    successCount = 0;
    failCount = 0;
  });

  it('should create a circuit breaker with default options', () => {
    const breaker = createCircuitBreaker(successFn);
    expect(breaker).toBeInstanceOf(CircuitBreaker);
    breaker.shutdown();
  });

  it('should fire successfully when function succeeds', async () => {
    const breaker = createCircuitBreaker(successFn);
    const result = await breaker.fire();
    expect(result).toBe('ok');
    expect(successCount).toBe(1);
    breaker.shutdown();
  });

  it('should transition to OPEN after threshold failures', async () => {
    const breaker = createCircuitBreaker(failFn, {
      errorThresholdPercentage: 50,
      resetTimeout: 100,
      volumeThreshold: 2,
    });

    // Fire twice to exceed volume threshold and error threshold
    await expect(breaker.fire()).rejects.toThrow('always fails');
    await expect(breaker.fire()).rejects.toThrow('always fails');

    // Wait a tick for state update
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(breaker.opened).toBe(true);
    breaker.shutdown();
  });

  it('should transition to HALF_OPEN after reset timeout', async () => {
    const breaker = createCircuitBreaker(failFn, {
      errorThresholdPercentage: 50,
      resetTimeout: 100,
      volumeThreshold: 2,
    });

    // Trigger open state
    await expect(breaker.fire()).rejects.toThrow('always fails');
    await expect(breaker.fire()).rejects.toThrow('always fails');
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(breaker.opened).toBe(true);

    // Wait for reset timeout
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Circuit breaker should be half-open now; fire again
    // Since it fails again, it should go back to OPEN
    await expect(breaker.fire()).rejects.toThrow('always fails');
    expect(breaker.opened).toBe(true);
    breaker.shutdown();
  });

  it('should transition to CLOSED after successful half-open call', async () => {
    let callCount = 0;
    const toggleFn = async () => {
      callCount++;
      if (callCount <= 2) {
        throw new Error('fail');
      }
      return 'ok';
    };

    const breaker = createCircuitBreaker(toggleFn, {
      errorThresholdPercentage: 50,
      resetTimeout: 100,
      volumeThreshold: 2,
    });

    // Trigger open
    await expect(breaker.fire()).rejects.toThrow('fail');
    await expect(breaker.fire()).rejects.toThrow('fail');
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(breaker.opened).toBe(true);

    // Wait for reset
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Next call succeeds; breaker should close
    const result = await breaker.fire();
    expect(result).toBe('ok');
    expect(breaker.opened).toBe(false);
    breaker.shutdown();
  });

  it('should reject immediately when OPEN', async () => {
    const breaker = createCircuitBreaker(failFn, {
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      volumeThreshold: 2,
    });

    await expect(breaker.fire()).rejects.toThrow('always fails');
    await expect(breaker.fire()).rejects.toThrow('always fails');
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(breaker.opened).toBe(true);

    // Should reject immediately with "Breaker is open"
    await expect(breaker.fire()).rejects.toThrow();
    breaker.shutdown();
  });
});
