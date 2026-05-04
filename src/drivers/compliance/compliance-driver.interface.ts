export interface ComplianceScanRequest {
  text: string;
  categories?: string[];
  workspaceId: string;
}

export interface ComplianceFinding {
  rule: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  matchedText: string;
}

export interface ComplianceScanResponse {
  score: number;
  flagged: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  categories: string[];
  findings: ComplianceFinding[];
  rawResponse?: unknown;
  provider: string;
}

export interface ComplianceDriver {
  readonly name: string;
  scan(req: ComplianceScanRequest): Promise<ComplianceScanResponse>;
  healthCheck?(): Promise<boolean>;
}
