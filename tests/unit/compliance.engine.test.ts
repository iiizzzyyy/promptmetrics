import fs from 'fs';
import path from 'path';
import { getDb, initSchema, closeDb } from '@models/promptmetrics-sqlite';
import { ComplianceEngine, ComplianceRule } from '@services/compliance.engine';

describe('ComplianceEngine', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test-compliance-unit.db');
  let engine: ComplianceEngine;

  beforeEach(async () => {
    process.env.SQLITE_PATH = testDbPath;
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
    await closeDb();
    await initSchema();
    engine = new ComplianceEngine();
  });

  afterEach(async () => {
    await closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
  });

  describe('getBuiltinRules', () => {
    it('returns 7 built-in rules', () => {
      const rules = ComplianceEngine.getBuiltinRules();
      expect(rules).toHaveLength(7);
      const names = rules.map((r) => r.name);
      expect(names).toContain('Email Detection');
      expect(names).toContain('SSN Detection');
      expect(names).toContain('Phone Detection');
      expect(names).toContain('Credit Card Detection');
      expect(names).toContain('API Key Detection');
      expect(names).toContain('URL Detection');
      expect(names).toContain('IP Address Detection');
    });
  });

  describe('rule detection', () => {
    it('detects email addresses', () => {
      const result = engine.score('Contact us at john.doe@example.com for help.');
      expect(
        result.violations.some((v) => v.rule === 'Email Detection' && v.matchedText === 'john.doe@example.com'),
      ).toBe(true);
    });

    it('does not flag clean text as email', () => {
      const result = engine.score('Please contact us via our support portal.');
      expect(result.violations.filter((v) => v.rule === 'Email Detection')).toHaveLength(0);
    });

    it('detects SSNs', () => {
      const result = engine.score('SSN: 123-45-6789');
      expect(result.violations.some((v) => v.rule === 'SSN Detection')).toBe(true);
    });

    it('does not flag non-SSN numbers', () => {
      const result = engine.score('ID: 1234567890');
      expect(result.violations.filter((v) => v.rule === 'SSN Detection')).toHaveLength(0);
    });

    it('detects phone numbers', () => {
      const result = engine.score('Call me at (555) 234-5678.');
      expect(result.violations.some((v) => v.rule === 'Phone Detection')).toBe(true);
    });

    it('does not flag short digit strings as phone', () => {
      const result = engine.score('Code: 12345');
      expect(result.violations.filter((v) => v.rule === 'Phone Detection')).toHaveLength(0);
    });

    it('detects credit cards and validates with Luhn', () => {
      const result = engine.score('Card: 4111111111111111');
      expect(result.violations.some((v) => v.rule === 'Credit Card Detection')).toBe(true);
    });

    it('does not flag invalid credit card numbers', () => {
      const result = engine.score('Card: 1234567890123');
      expect(result.violations.filter((v) => v.rule === 'Credit Card Detection')).toHaveLength(0);
    });

    it('does not flag clean text as credit card', () => {
      const result = engine.score('Transaction completed successfully.');
      expect(result.violations.filter((v) => v.rule === 'Credit Card Detection')).toHaveLength(0);
    });

    it('detects API keys by entropy', () => {
      const key = 'sk-live-xK9mP2vL5nQ8wR4tY7uI3oZ6aS1dF2gH4jK5l';
      const result = engine.score(`Authorization: Bearer ${key}`);
      expect(result.violations.some((v) => v.rule === 'API Key Detection' && v.matchedText === key)).toBe(true);
    });

    it('does not flag normal text as API key', () => {
      const result = engine.score('This is just a regular sentence with normal words.');
      expect(result.violations.filter((v) => v.rule === 'API Key Detection')).toHaveLength(0);
    });

    it('detects URLs', () => {
      const result = engine.score('Visit https://example.com/path?query=1 for more.');
      expect(result.violations.some((v) => v.rule === 'URL Detection')).toBe(true);
    });

    it('does not flag plain domain names as URLs', () => {
      const result = engine.score('Our domain is example.com');
      expect(result.violations.filter((v) => v.rule === 'URL Detection')).toHaveLength(0);
    });

    it('detects IPv4 addresses', () => {
      const result = engine.score('Server at 192.168.1.1');
      expect(result.violations.some((v) => v.rule === 'IP Address Detection' && v.matchedText === '192.168.1.1')).toBe(
        true,
      );
    });

    it('detects IPv6 addresses', () => {
      const result = engine.score('Server at 2001:0db8:85a3:0000:0000:8a2e:0370:7334');
      expect(result.violations.some((v) => v.rule === 'IP Address Detection')).toBe(true);
    });

    it('does not flag invalid IPs', () => {
      const result = engine.score('Address 256.1.1.1 is invalid');
      expect(result.violations.filter((v) => v.rule === 'IP Address Detection')).toHaveLength(0);
    });
  });

  describe('Luhn algorithm', () => {
    it('returns true for valid card numbers', () => {
      expect(ComplianceEngine.luhnCheck('4111111111111111')).toBe(true);
      expect(ComplianceEngine.luhnCheck('4532015112830366')).toBe(true);
    });

    it('returns false for invalid card numbers', () => {
      expect(ComplianceEngine.luhnCheck('1234567890123')).toBe(false);
      expect(ComplianceEngine.luhnCheck('4111111111111112')).toBe(false);
    });
  });

  describe('Shannon entropy', () => {
    it('returns 0 for uniform single-character strings', () => {
      expect(ComplianceEngine.shannonEntropy('aaaa')).toBe(0);
    });

    it('returns log2(n) for strings with n equally likely unique characters', () => {
      expect(ComplianceEngine.shannonEntropy('abcd')).toBeCloseTo(2, 5);
      expect(ComplianceEngine.shannonEntropy('abcdefgh')).toBeCloseTo(3, 5);
    });
  });

  describe('scoring aggregation', () => {
    it('deducts correct weights per severity', () => {
      const result = engine.score('SSN: 123-45-6789 and Card: 4111111111111111 and Email: test@test.com');
      // critical: SSN (-25), Credit Card (-25)
      // high: Email (-15)
      // total: 100 - 25 - 25 - 15 = 35
      expect(result.score).toBe(35);
      expect(result.riskLevel).toBe('critical');
    });

    it('caps score at 0', () => {
      const result = engine.score(
        'SSN: 123-45-6789 SSN: 123-45-6789 SSN: 123-45-6789 SSN: 123-45-6789 SSN: 123-45-6789',
      );
      expect(result.score).toBe(0);
    });
  });

  describe('risk level thresholds', () => {
    it('low for score >= 90', () => {
      const result = engine.score('Clean text');
      expect(result.score).toBe(100);
      expect(result.riskLevel).toBe('low');
    });

    it('medium for score >= 70', () => {
      const customRule: ComplianceRule = {
        name: 'Medium Rule',
        pattern: /MATCH/,
        severity: 'medium',
        category: 'custom',
      };
      const result = engine.score('MATCH', [customRule]);
      expect(result.score).toBe(90);
      expect(result.riskLevel).toBe('low');
    });

    it('medium at exactly 70', () => {
      // Need a score of 70: deduct 30 points.
      // critical (-25) + low (-5) = -30 -> score 70
      const rules: ComplianceRule[] = [
        { name: 'Critical Rule', pattern: /CRIT/, severity: 'critical', category: 'custom' },
        { name: 'Low Rule', pattern: /LOW/, severity: 'low', category: 'custom' },
      ];
      const result = engine.score('CRIT LOW', rules);
      expect(result.score).toBe(70);
      expect(result.riskLevel).toBe('medium');
    });

    it('high at exactly 40', () => {
      // Need a score of 40: deduct 60 points.
      // critical (-25) + high (-15) + medium (-10) + low (-5) + low (-5) = 60 -> score 40
      const rules: ComplianceRule[] = [
        { name: 'C1', pattern: /A/, severity: 'critical', category: 'custom' },
        { name: 'H1', pattern: /B/, severity: 'high', category: 'custom' },
        { name: 'M1', pattern: /C/, severity: 'medium', category: 'custom' },
        { name: 'L1', pattern: /D/, severity: 'low', category: 'custom' },
        { name: 'L2', pattern: /E/, severity: 'low', category: 'custom' },
      ];
      const result = engine.score('A B C D E', rules);
      expect(result.score).toBe(40);
      expect(result.riskLevel).toBe('high');
    });

    it('critical for score < 40', () => {
      const rules: ComplianceRule[] = [
        { name: 'C1', pattern: /A/, severity: 'critical', category: 'custom' },
        { name: 'C2', pattern: /B/, severity: 'critical', category: 'custom' },
        { name: 'C3', pattern: /C/, severity: 'critical', category: 'custom' },
      ];
      const result = engine.score('A B C', rules);
      expect(result.score).toBe(25);
      expect(result.riskLevel).toBe('critical');
    });
  });

  describe('scanPrompt', () => {
    it('stores compliance score in the database', async () => {
      const result = await engine.scanPrompt('prompt-a', 'v1.0', 'SSN: 123-45-6789', 'ws-1');
      expect(result.score).toBeLessThan(100);
      expect(result.violations.length).toBeGreaterThan(0);

      const db = getDb();
      const row = (await db
        .prepare('SELECT * FROM compliance_scores WHERE prompt_name = ? AND workspace_id = ?')
        .get('prompt-a', 'ws-1')) as Record<string, unknown>;
      expect(row).toBeDefined();
      expect(row.prompt_name).toBe('prompt-a');
      expect(row.version_tag).toBe('v1.0');
      expect(row.score).toBe(result.score);
      const violations = JSON.parse(row.violations_json as string);
      expect(violations).toEqual(result.violations);
    });
  });
});
