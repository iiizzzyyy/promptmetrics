import {
  ComplianceDriver,
  ComplianceScanRequest,
  ComplianceScanResponse,
  ComplianceFinding,
} from './compliance-driver.interface';
import { ComplianceEngine } from '@services/compliance.engine';

export class StubComplianceDriver implements ComplianceDriver {
  readonly name = 'stub';
  private engine = new ComplianceEngine();

  async scan(req: ComplianceScanRequest): Promise<ComplianceScanResponse> {
    const result = this.engine.score(req.text);

    const findings: ComplianceFinding[] = result.violations.map((v) => ({
      rule: v.rule,
      severity: v.severity as 'critical' | 'high' | 'medium' | 'low' | 'info',
      category: v.category,
      matchedText: v.matchedText,
    }));

    const categories = [...new Set(findings.map((f) => f.category))];

    return {
      score: result.score,
      flagged: result.score < 90,
      riskLevel: result.riskLevel,
      categories,
      findings,
      provider: this.name,
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
