export interface WelchTTestResult {
  tStatistic: number;
  pValue: number;
  significant: boolean;
}

export interface TwoProportionZTestResult {
  zStatistic: number;
  pValue: number;
  significant: boolean;
}

export interface BootstrapCIResult {
  lower: number;
  upper: number;
  delta: number;
}

export interface ABTestAnalysis {
  winner: 'A' | 'B' | 'tie';
  pValue: number;
  ciLower: number;
  ciUpper: number;
}

/**
 * Approximation of the error function using Abramowitz & Stegun formula 7.1.26.
 */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const p = 0.3275911;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;

  const t = 1 / (1 + p * ax);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);

  return sign * y;
}

/**
 * Standard normal cumulative distribution function.
 */
function normalCDF(x: number): number {
  return 0.5 * (1 + erf(x / Math.sqrt(2)));
}

/**
 * Inverse normal CDF approximation (Acklam's algorithm).
 * Used for power analysis.
 */
function inverseNormalCDF(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  const a1 = -39.6968302866538;
  const a2 = 220.946098424521;
  const a3 = -275.928510446969;
  const a4 = 138.357751867269;
  const a5 = -30.6647980661472;
  const a6 = 2.50662827745924;

  const b1 = -54.4760987982241;
  const b2 = 161.585836858041;
  const b3 = -155.698979859887;
  const b4 = 66.8013118877197;
  const b5 = -13.2806815528857;

  const c1 = -0.00778489400243029;
  const c2 = -0.322396458441136;
  const c3 = -2.40075827716184;
  const c4 = -2.54973253934373;
  const c5 = 4.37466414146497;
  const c6 = 2.93816398269878;

  const d1 = 0.00778469570904146;
  const d2 = 0.32246712907004;
  const d3 = 2.445134137143;
  const d4 = 3.75440866190742;

  const plow = 0.02425;
  const phigh = 1 - plow;

  let q: number;
  let r: number;

  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) / ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
  } else if (p <= phigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q) /
      (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1)
    );
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) / ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
  }
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

function sampleVariance(arr: number[]): number {
  const n = arr.length;
  if (n < 2) return 0;
  const m = mean(arr);
  return arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / (n - 1);
}

export class ABTestEngine {
  welchTTest(a: number[], b: number[]): WelchTTestResult {
    const nA = a.length;
    const nB = b.length;

    if (nA === 0 || nB === 0) {
      return { tStatistic: 0, pValue: 1, significant: false };
    }

    const meanA = mean(a);
    const meanB = mean(b);
    const varA = sampleVariance(a);
    const varB = sampleVariance(b);

    const seA2 = varA / nA;
    const seB2 = varB / nB;
    const se = Math.sqrt(seA2 + seB2);

    if (se === 0) {
      return { tStatistic: 0, pValue: 1, significant: false };
    }

    const tStatistic = (meanA - meanB) / se;
    const pValue = tStatistic === 0 ? 1 : 2 * (1 - normalCDF(Math.abs(tStatistic)));
    const significant = pValue < 0.05;

    return { tStatistic, pValue, significant };
  }

  twoProportionZTest(
    successesA: number,
    trialsA: number,
    successesB: number,
    trialsB: number,
  ): TwoProportionZTestResult {
    if (
      trialsA === 0 ||
      trialsB === 0 ||
      successesA < 0 ||
      successesB < 0 ||
      successesA > trialsA ||
      successesB > trialsB
    ) {
      return { zStatistic: 0, pValue: 1, significant: false };
    }

    const pA = successesA / trialsA;
    const pB = successesB / trialsB;
    const pPooled = (successesA + successesB) / (trialsA + trialsB);

    const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / trialsA + 1 / trialsB));

    if (se === 0) {
      return { zStatistic: 0, pValue: 1, significant: false };
    }

    const zStatistic = (pA - pB) / se;
    const pValue = zStatistic === 0 ? 1 : 2 * (1 - normalCDF(Math.abs(zStatistic)));
    const significant = pValue < 0.05;

    return { zStatistic, pValue, significant };
  }

  bootstrapCI(a: number[], b: number[], options?: { confidence?: number; resamples?: number }): BootstrapCIResult {
    const confidence = options?.confidence ?? 0.95;
    const resamples = options?.resamples ?? 10000;

    if (a.length === 0 || b.length === 0) {
      return { lower: 0, upper: 0, delta: 0 };
    }

    const delta = mean(b) - mean(a);
    const deltas: number[] = new Array(resamples);

    for (let i = 0; i < resamples; i++) {
      let sumA = 0;
      let sumB = 0;

      for (let j = 0; j < a.length; j++) {
        sumA += a[Math.floor(Math.random() * a.length)];
      }
      for (let j = 0; j < b.length; j++) {
        sumB += b[Math.floor(Math.random() * b.length)];
      }

      deltas[i] = sumB / b.length - sumA / a.length;
    }

    deltas.sort((x, y) => x - y);

    const alpha = 1 - confidence;
    const lowerIndex = Math.floor((alpha / 2) * resamples);
    const upperIndex = Math.ceil((1 - alpha / 2) * resamples) - 1;

    return {
      lower: deltas[Math.max(0, lowerIndex)],
      upper: deltas[Math.min(resamples - 1, upperIndex)],
      delta,
    };
  }

  sampleSizeForProportion(p1: number, p2: number, alpha = 0.05, power = 0.8): number {
    if (p1 === p2 || p1 < 0 || p1 > 1 || p2 < 0 || p2 > 1) {
      return Infinity;
    }

    const zAlpha = inverseNormalCDF(1 - alpha / 2);
    const zBeta = inverseNormalCDF(power);

    const numerator = (zAlpha + zBeta) ** 2 * (p1 * (1 - p1) + p2 * (1 - p2));
    const denominator = (p1 - p2) ** 2;

    return Math.ceil(numerator / denominator);
  }

  analyzeABTest(resultsA: number[], resultsB: number[], metric: 'latency' | 'cost' | 'win_rate'): ABTestAnalysis {
    if (resultsA.length === 0 || resultsB.length === 0) {
      return { winner: 'tie', pValue: 1, ciLower: 0, ciUpper: 0 };
    }

    if (metric === 'win_rate') {
      const successesA = resultsA.reduce((s, v) => s + v, 0);
      const successesB = resultsB.reduce((s, v) => s + v, 0);
      const trialsA = resultsA.length;
      const trialsB = resultsB.length;

      const { zStatistic, pValue } = this.twoProportionZTest(successesA, trialsA, successesB, trialsB);

      const pA = successesA / trialsA;
      const pB = successesB / trialsB;
      const diff = pB - pA;
      const se = Math.sqrt((pA * (1 - pA)) / trialsA + (pB * (1 - pB)) / trialsB);
      const z95 = 1.959963984540054;
      const ciLower = diff - z95 * se;
      const ciUpper = diff + z95 * se;

      let winner: 'A' | 'B' | 'tie' = 'tie';
      if (pValue < 0.05) {
        winner = zStatistic < 0 ? 'B' : 'A';
      }

      return { winner, pValue, ciLower, ciUpper };
    }

    const { tStatistic, pValue } = this.welchTTest(resultsA, resultsB);
    const { lower, upper } = this.bootstrapCI(resultsA, resultsB);

    let winner: 'A' | 'B' | 'tie' = 'tie';
    if (pValue < 0.05) {
      // For latency/cost, lower is better.
      // tStatistic = (meanA - meanB) / se
      // t > 0  => meanA > meanB  => B is better
      winner = tStatistic > 0 ? 'B' : 'A';
    }

    return { winner, pValue, ciLower: lower, ciUpper: upper };
  }
}
