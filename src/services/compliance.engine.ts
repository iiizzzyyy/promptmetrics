export interface ComplianceRule {
  id?: number;
  name: string;
  pattern: RegExp | ((text: string) => boolean);
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: 'pii' | 'security' | 'toxicity' | 'bias' | 'transparency' | 'custom';
}

export interface Violation {
  rule: string;
  severity: string;
  category: string;
  matchedText: string;
}

export class ComplianceEngine {
  private static readonly SEVERITY_WEIGHTS: Record<string, number> = {
    critical: 25,
    high: 15,
    medium: 10,
    low: 5,
    info: 1,
  };

  static getBuiltinRules(): ComplianceRule[] {
    return [
      {
        name: 'Email Detection',
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
        severity: 'high',
        category: 'pii',
      },
      {
        name: 'SSN Detection',
        pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
        severity: 'critical',
        category: 'pii',
      },
      {
        name: 'Phone Detection',
        pattern: /(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?[2-9]\d{2}[-.\s]?\d{4}(?!\d)/g,
        severity: 'medium',
        category: 'pii',
      },
      {
        name: 'Credit Card Detection',
        pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b|\b\d{13,19}\b/g,
        severity: 'critical',
        category: 'pii',
      },
      {
        name: 'API Key Detection',
        pattern: (text: string) => ComplianceEngine.findApiKeys(text).length > 0,
        severity: 'high',
        category: 'security',
      },
      {
        name: 'URL Detection',
        pattern: /\bhttps?:\/\/[a-zA-Z0-9\-.]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?\b/g,
        severity: 'low',
        category: 'security',
      },
      {
        name: 'IP Address Detection',
        pattern: (text: string) => ComplianceEngine.findIpAddresses(text).length > 0,
        severity: 'medium',
        category: 'security',
      },
    ];
  }

  score(
    text: string,
    customRules?: ComplianceRule[],
  ): { score: number; maxScore: number; violations: Violation[]; riskLevel: 'low' | 'medium' | 'high' | 'critical' } {
    const rules = customRules
      ? [...ComplianceEngine.getBuiltinRules(), ...customRules]
      : ComplianceEngine.getBuiltinRules();
    const violations: Violation[] = [];

    for (const rule of rules) {
      if (rule.pattern instanceof RegExp) {
        const flags = rule.pattern.flags.includes('g') ? rule.pattern.flags : rule.pattern.flags + 'g';
        const pattern = new RegExp(rule.pattern.source, flags);
        const matches = text.matchAll(pattern);

        for (const match of matches) {
          const matchedText = match[0];

          if (rule.name === 'Credit Card Detection') {
            const digits = matchedText.replace(/\D/g, '');
            if (!ComplianceEngine.luhnCheck(digits)) continue;
          }

          violations.push({
            rule: rule.name,
            severity: rule.severity,
            category: rule.category,
            matchedText,
          });
        }
      } else {
        if (rule.pattern(text)) {
          if (rule.name === 'API Key Detection') {
            const matches = ComplianceEngine.findApiKeys(text);
            for (const matchedText of matches) {
              violations.push({
                rule: rule.name,
                severity: rule.severity,
                category: rule.category,
                matchedText,
              });
            }
          } else if (rule.name === 'IP Address Detection') {
            const matches = ComplianceEngine.findIpAddresses(text);
            for (const matchedText of matches) {
              violations.push({
                rule: rule.name,
                severity: rule.severity,
                category: rule.category,
                matchedText,
              });
            }
          } else {
            violations.push({
              rule: rule.name,
              severity: rule.severity,
              category: rule.category,
              matchedText: text.substring(0, 200),
            });
          }
        }
      }
    }

    let score = 100;
    for (const v of violations) {
      score -= ComplianceEngine.SEVERITY_WEIGHTS[v.severity] || 0;
    }
    score = Math.max(0, score);

    const riskLevel: 'low' | 'medium' | 'high' | 'critical' =
      score >= 90 ? 'low' : score >= 70 ? 'medium' : score >= 40 ? 'high' : 'critical';

    return { score, maxScore: 100, violations, riskLevel };
  }

  static luhnCheck(digits: string): boolean {
    let sum = 0;
    let alternate = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let n = parseInt(digits.substring(i, i + 1), 10);
      if (alternate) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
      alternate = !alternate;
    }
    return sum % 10 === 0;
  }

  static shannonEntropy(str: string): number {
    const len = str.length;
    if (len === 0) return 0;
    const freq: Record<string, number> = {};
    for (const char of str) {
      freq[char] = (freq[char] || 0) + 1;
    }
    let entropy = 0;
    for (const count of Object.values(freq)) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }
    return entropy;
  }

  private static findApiKeys(text: string): string[] {
    const keys: string[] = [];
    const tokens = text.split(/[\s\n\r\t",;'{}[\]()]+/);
    for (const token of tokens) {
      if (token.length <= 20) continue;
      const entropy = ComplianceEngine.shannonEntropy(token);
      if (entropy > 4.5) {
        keys.push(token);
      }
    }
    return keys;
  }

  private static findIpAddresses(text: string): string[] {
    const matches: string[] = [];

    for (const match of text.matchAll(/\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g)) {
      matches.push(match[0]);
    }

    for (const match of text.matchAll(/\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g)) {
      matches.push(match[0]);
    }

    return matches;
  }
}
