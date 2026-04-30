import { ABTestEngine } from '@services/ab-test.engine';

describe('ABTestEngine', () => {
  let engine: ABTestEngine;

  beforeEach(() => {
    engine = new ABTestEngine();
  });

  describe('welchTTest', () => {
    it('returns non-significant for identical arrays', () => {
      const a = [1, 2, 3, 4, 5];
      const b = [1, 2, 3, 4, 5];
      const result = engine.welchTTest(a, b);
      expect(result.tStatistic).toBe(0);
      expect(result.pValue).toBe(1);
      expect(result.significant).toBe(false);
    });

    it('returns significant for clearly different arrays', () => {
      const a = [1, 2, 3, 4, 5];
      const b = [6, 7, 8, 9, 10];
      const result = engine.welchTTest(a, b);
      expect(result.tStatistic).toBeCloseTo(-5, 6);
      expect(result.pValue).toBeLessThan(0.05);
      expect(result.significant).toBe(true);
    });

    it('handles empty arrays gracefully', () => {
      expect(engine.welchTTest([], [1, 2, 3])).toEqual({
        tStatistic: 0,
        pValue: 1,
        significant: false,
      });
      expect(engine.welchTTest([1, 2, 3], [])).toEqual({
        tStatistic: 0,
        pValue: 1,
        significant: false,
      });
    });

    it('handles arrays with zero variance', () => {
      const a = [5, 5, 5, 5];
      const b = [5, 5, 5, 5];
      const result = engine.welchTTest(a, b);
      expect(result.tStatistic).toBe(0);
      expect(result.pValue).toBe(1);
      expect(result.significant).toBe(false);
    });

    it('produces correct t-statistic for known synthetic data', () => {
      const a = [1, 2, 3, 4, 5];
      const b = [6, 7, 8, 9, 10];
      const result = engine.welchTTest(a, b);
      // meanA=3, meanB=8, varA=2.5, varB=2.5, seA2=0.5, seB2=0.5, se=1
      // t = (3 - 8) / 1 = -5
      expect(result.tStatistic).toBeCloseTo(-5, 6);
    });
  });

  describe('twoProportionZTest', () => {
    it('returns non-significant for equal proportions', () => {
      const result = engine.twoProportionZTest(50, 100, 50, 100);
      expect(result.zStatistic).toBe(0);
      expect(result.pValue).toBe(1);
      expect(result.significant).toBe(false);
    });

    it('returns significant for clearly different proportions', () => {
      const result = engine.twoProportionZTest(40, 100, 60, 100);
      expect(Math.abs(result.zStatistic)).toBeGreaterThan(1.96);
      expect(result.pValue).toBeLessThan(0.05);
      expect(result.significant).toBe(true);
    });

    it('handles edge cases gracefully', () => {
      expect(engine.twoProportionZTest(0, 0, 10, 100)).toEqual({
        zStatistic: 0,
        pValue: 1,
        significant: false,
      });
      expect(engine.twoProportionZTest(-1, 100, 10, 100)).toEqual({
        zStatistic: 0,
        pValue: 1,
        significant: false,
      });
      expect(engine.twoProportionZTest(101, 100, 10, 100)).toEqual({
        zStatistic: 0,
        pValue: 1,
        significant: false,
      });
    });

    it('produces correct z-statistic for known data', () => {
      // pA = 0.5, pB = 0.6, pooled = 0.55
      // se = sqrt(0.55 * 0.45 * 0.02) = sqrt(0.00495) ≈ 0.070356
      // z = (0.5 - 0.6) / 0.070356 ≈ -1.421
      const result = engine.twoProportionZTest(50, 100, 60, 100);
      expect(result.zStatistic).toBeCloseTo(-1.421, 3);
      expect(result.pValue).toBeCloseTo(0.155, 3);
      expect(result.significant).toBe(false);
    });
  });

  describe('bootstrapCI', () => {
    it('returns exact CI for constant arrays', () => {
      const a = [1, 1, 1, 1, 1];
      const b = [10, 10, 10, 10, 10];
      const result = engine.bootstrapCI(a, b, { resamples: 1000 });
      expect(result.delta).toBe(9);
      expect(result.lower).toBe(9);
      expect(result.upper).toBe(9);
    });

    it('returns CI that contains the observed delta for varied arrays', () => {
      const a = [1, 2, 3, 4, 5];
      const b = [6, 7, 8, 9, 10];
      const result = engine.bootstrapCI(a, b, { resamples: 2000 });
      expect(result.delta).toBeCloseTo(5, 6);
      expect(result.lower).toBeLessThanOrEqual(result.delta);
      expect(result.upper).toBeGreaterThanOrEqual(result.delta);
      expect(result.lower).toBeLessThan(result.upper);
    });

    it('handles empty arrays gracefully', () => {
      expect(engine.bootstrapCI([], [1, 2, 3])).toEqual({
        lower: 0,
        upper: 0,
        delta: 0,
      });
      expect(engine.bootstrapCI([1, 2, 3], [])).toEqual({
        lower: 0,
        upper: 0,
        delta: 0,
      });
    });

    it('respects confidence level option', () => {
      const a = [1, 2, 3, 4, 5];
      const b = [6, 7, 8, 9, 10];
      const result90 = engine.bootstrapCI(a, b, { confidence: 0.9, resamples: 2000 });
      const result95 = engine.bootstrapCI(a, b, { confidence: 0.95, resamples: 2000 });
      expect(result90.lower).toBeGreaterThanOrEqual(result95.lower);
      expect(result90.upper).toBeLessThanOrEqual(result95.upper);
    });
  });

  describe('sampleSizeForProportion', () => {
    it('calculates correct sample size for known parameters', () => {
      const n = engine.sampleSizeForProportion(0.1, 0.15, 0.05, 0.8);
      expect(n).toBe(683);
    });

    it('returns Infinity when proportions are equal', () => {
      expect(engine.sampleSizeForProportion(0.5, 0.5)).toBe(Infinity);
    });

    it('returns Infinity for invalid proportions', () => {
      expect(engine.sampleSizeForProportion(-0.1, 0.2)).toBe(Infinity);
      expect(engine.sampleSizeForProportion(0.1, 1.2)).toBe(Infinity);
    });

    it('uses default alpha and power when omitted', () => {
      const n = engine.sampleSizeForProportion(0.2, 0.3);
      expect(Number.isFinite(n)).toBe(true);
      expect(n).toBeGreaterThan(0);
    });
  });

  describe('analyzeABTest', () => {
    it('declares B winner for significantly lower latency', () => {
      const resultsA = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
      const resultsB = Array.from({ length: 30 }, (_, i) => 50 + i * 2);
      const result = engine.analyzeABTest(resultsA, resultsB, 'latency');
      expect(result.winner).toBe('B');
      expect(result.pValue).toBeLessThan(0.05);
      expect(result.ciLower).toBeLessThan(0);
      expect(result.ciUpper).toBeLessThan(0);
    });

    it('declares A winner for significantly lower cost', () => {
      const resultsA = Array.from({ length: 30 }, (_, i) => 0.5 + i * 0.01);
      const resultsB = Array.from({ length: 30 }, (_, i) => 1.5 + i * 0.01);
      const result = engine.analyzeABTest(resultsA, resultsB, 'cost');
      expect(result.winner).toBe('A');
      expect(result.pValue).toBeLessThan(0.05);
      expect(result.ciLower).toBeGreaterThan(0);
      expect(result.ciUpper).toBeGreaterThan(0);
    });

    it('declares tie for inconclusive latency difference', () => {
      const resultsA = [1, 2, 3, 4, 5];
      const resultsB = [1, 2, 3, 4, 5];
      const result = engine.analyzeABTest(resultsA, resultsB, 'latency');
      expect(result.winner).toBe('tie');
      expect(result.pValue).toBe(1);
    });

    it('declares B winner for significantly higher win_rate', () => {
      const resultsA = Array(100).fill(0);
      resultsA[0] = 1;
      const resultsB = Array(100).fill(1);
      const result = engine.analyzeABTest(resultsA, resultsB, 'win_rate');
      expect(result.winner).toBe('B');
      expect(result.pValue).toBeLessThan(0.05);
    });

    it('declares A winner for significantly higher win_rate', () => {
      const resultsA = Array(100).fill(1);
      const resultsB = Array(100).fill(0);
      const result = engine.analyzeABTest(resultsA, resultsB, 'win_rate');
      expect(result.winner).toBe('A');
      expect(result.pValue).toBeLessThan(0.05);
    });

    it('declares tie for inconclusive win_rate', () => {
      const resultsA = Array(100).fill(0);
      resultsA[0] = 1;
      const resultsB = Array(100).fill(0);
      resultsB[0] = 1;
      const result = engine.analyzeABTest(resultsA, resultsB, 'win_rate');
      expect(result.winner).toBe('tie');
      expect(result.pValue).toBe(1);
    });

    it('handles empty arrays', () => {
      const result = engine.analyzeABTest([], [1, 2, 3], 'latency');
      expect(result.winner).toBe('tie');
      expect(result.pValue).toBe(1);
      expect(result.ciLower).toBe(0);
      expect(result.ciUpper).toBe(0);
    });
  });
});
