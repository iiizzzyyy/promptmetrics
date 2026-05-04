import {
  ComplianceDriver,
  ComplianceScanRequest,
  ComplianceScanResponse,
  ComplianceFinding,
} from './compliance-driver.interface';

interface LLMGuardScanResult {
  score?: number;
  flagged?: boolean;
  risk_level?: string;
  categories?: string[];
  findings?: Array<{
    rule?: string;
    severity?: string;
    category?: string;
    matched_text?: string;
    matchedText?: string;
  }>;
}

export class LLMGuardComplianceDriver implements ComplianceDriver {
  readonly name = 'llm-guard';

  private getUrl(): string {
    const base = process.env.COMPLIANCE_SCANNER_URL;
    if (!base) throw new Error('COMPLIANCE_SCANNER_URL is not set');
    return base.replace(/\/$/, '');
  }

  async scan(req: ComplianceScanRequest): Promise<ComplianceScanResponse> {
    const url = `${this.getUrl()}/scan`;
    const timeoutMs = Number(process.env.COMPLIANCE_SCANNER_TIMEOUT_MS) || 5000;

    const res = await globalThis.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: req.text, categories: req.categories }),
      signal: globalThis.AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      throw new Error(`LLM Guard scan failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as LLMGuardScanResult;

    const findings: ComplianceFinding[] =
      data.findings?.map((f) => ({
        rule: f.rule || 'unknown',
        severity: this.normalizeSeverity(f.severity),
        category: f.category || 'custom',
        matchedText: f.matched_text || f.matchedText || '',
      })) ?? [];

    const categories = data.categories ?? [...new Set(findings.map((f) => f.category))];

    const score = typeof data.score === 'number' ? data.score : 100;
    const flagged = typeof data.flagged === 'boolean' ? data.flagged : findings.length > 0;

    const riskLevel = this.normalizeRiskLevel(data.risk_level) ?? this.deriveRiskLevel(score);

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

  async healthCheck(): Promise<boolean> {
    try {
      const url = `${this.getUrl()}/health`;
      const res = await globalThis.fetch(url, {
        method: 'GET',
        signal: globalThis.AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private normalizeSeverity(raw?: string): 'critical' | 'high' | 'medium' | 'low' | 'info' {
    const s = raw?.toLowerCase();
    if (s === 'critical' || s === 'high' || s === 'medium' || s === 'low' || s === 'info') {
      return s;
    }
    return 'medium';
  }

  private normalizeRiskLevel(raw?: string): 'low' | 'medium' | 'high' | 'critical' | null {
    const r = raw?.toLowerCase();
    if (r === 'low' || r === 'medium' || r === 'high' || r === 'critical') {
      return r;
    }
    return null;
  }

  private deriveRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    return score >= 90 ? 'low' : score >= 70 ? 'medium' : score >= 40 ? 'high' : 'critical';
  }
}
