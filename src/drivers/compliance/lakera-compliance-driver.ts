import {
  ComplianceDriver,
  ComplianceScanRequest,
  ComplianceScanResponse,
  ComplianceFinding,
} from './compliance-driver.interface';

interface LakeraResult {
  flagged?: boolean;
  score?: number;
  category?: string;
  categories?: string[];
  payload?: Array<{
    text?: string;
    matched?: string;
  }>;
}

interface LakeraResponse {
  results?: LakeraResult[];
  model?: string;
  usage?: unknown;
}

export class LakeraComplianceDriver implements ComplianceDriver {
  readonly name = 'lakera';

  private getApiKey(): string {
    const key = process.env.LAKERA_API_KEY;
    if (!key) throw new Error('LAKERA_API_KEY is not set');
    return key;
  }

  async scan(req: ComplianceScanRequest): Promise<ComplianceScanResponse> {
    const res = await globalThis.fetch('https://api.lakera.ai/v1/prompt_injection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getApiKey()}`,
      },
      body: JSON.stringify({ text: req.text }),
      signal: globalThis.AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new Error(`Lakera scan failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as LakeraResponse;
    const result = data.results?.[0];

    const flagged = result?.flagged ?? false;
    const score = typeof result?.score === 'number' ? Math.round((1 - result.score) * 100) : flagged ? 50 : 100;

    const categories = result?.categories ?? (result?.category ? [result.category] : flagged ? ['security'] : []);

    const findings: ComplianceFinding[] = [];
    if (flagged && result?.payload) {
      for (const p of result.payload) {
        findings.push({
          rule: 'prompt_injection',
          severity: 'high',
          category: categories[0] ?? 'security',
          matchedText: p.text ?? p.matched ?? '',
        });
      }
    }

    const riskLevel = score >= 90 ? 'low' : score >= 70 ? 'medium' : score >= 40 ? 'high' : 'critical';

    return {
      score,
      flagged,
      riskLevel,
      categories,
      findings,
      provider: this.name,
      rawResponse: data,
    };
  }
}
