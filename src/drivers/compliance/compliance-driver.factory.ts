import { ComplianceDriver } from './compliance-driver.interface';
import { StubComplianceDriver } from './stub-compliance-driver';
import { LLMGuardComplianceDriver } from './llm-guard-compliance-driver';
import { LakeraComplianceDriver } from './lakera-compliance-driver';

export function createComplianceDriver(): ComplianceDriver {
  const provider = process.env.COMPLIANCE_PROVIDER;
  if (provider === 'lakera') return new LakeraComplianceDriver();
  if (provider === 'llm-guard') return new LLMGuardComplianceDriver();
  if (provider === 'stub') return new StubComplianceDriver();
  if (process.env.NODE_ENV === 'test') return new StubComplianceDriver();
  if (process.env.COMPLIANCE_SCANNER_URL) return new LLMGuardComplianceDriver();
  return new StubComplianceDriver();
}
