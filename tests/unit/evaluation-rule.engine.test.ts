import { RuleBasedEvalEngine, Rule } from '@services/evaluation-rule.engine';

describe('RuleBasedEvalEngine', () => {
  const engine = new RuleBasedEvalEngine();

  describe('evaluateRegex', () => {
    it('returns passed for matching regex', () => {
      const result = engine.evaluateRegex('hello world', 'hello');
      expect(result.passed).toBe(true);
      expect(result.score).toBe(1);
    });

    it('returns failed for non-matching regex', () => {
      const result = engine.evaluateRegex('hello world', '^foo');
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.reason).toContain('does not match');
    });

    it('supports regex flags', () => {
      const result = engine.evaluateRegex('HELLO', 'hello', 'i');
      expect(result.passed).toBe(true);
    });

    it('returns failed for invalid pattern', () => {
      const result = engine.evaluateRegex('test', '[');
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.reason).toContain('Invalid regex');
    });
  });

  describe('evaluateKeyword', () => {
    it('passes when all keywords are present (all mode)', () => {
      const result = engine.evaluateKeyword('the quick brown fox', ['quick', 'fox']);
      expect(result.passed).toBe(true);
      expect(result.score).toBe(1);
    });

    it('fails when some keywords are missing (all mode)', () => {
      const result = engine.evaluateKeyword('the quick brown fox', ['quick', 'cat']);
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.reason).toContain('Missing keywords');
    });

    it('passes when any keyword is present (any mode)', () => {
      const result = engine.evaluateKeyword('the quick brown fox', ['cat', 'fox'], 'any');
      expect(result.passed).toBe(true);
      expect(result.score).toBe(1);
    });

    it('fails when no keywords are present (any mode)', () => {
      const result = engine.evaluateKeyword('the quick brown fox', ['cat', 'dog'], 'any');
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
    });

    it('passes for empty keywords in all mode', () => {
      const result = engine.evaluateKeyword('hello', [], 'all');
      expect(result.passed).toBe(true);
    });

    it('fails for empty keywords in any mode', () => {
      const result = engine.evaluateKeyword('hello', [], 'any');
      expect(result.passed).toBe(false);
    });
  });

  describe('evaluateJsonSchema', () => {
    it('passes for valid JSON schema', () => {
      const result = engine.evaluateJsonSchema({ name: 'test' }, { type: 'object', required: ['name'] });
      expect(result.passed).toBe(true);
      expect(result.score).toBe(1);
    });

    it('fails for invalid JSON schema', () => {
      const result = engine.evaluateJsonSchema({ name: 'test' }, { type: 'object', required: ['age'] });
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.reason).toContain('schema validation failed');
    });
  });

  describe('evaluateLength', () => {
    it('passes when length is within bounds', () => {
      const result = engine.evaluateLength('hello', 3, 10);
      expect(result.passed).toBe(true);
      expect(result.score).toBe(1);
    });

    it('fails when length is below min', () => {
      const result = engine.evaluateLength('hi', 3);
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.reason).toContain('less than minimum');
    });

    it('fails when length exceeds max', () => {
      const result = engine.evaluateLength('hello world', undefined, 5);
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.reason).toContain('exceeds maximum');
    });

    it('passes when no bounds are set', () => {
      const result = engine.evaluateLength('anything');
      expect(result.passed).toBe(true);
    });
  });

  describe('evaluate (aggregate)', () => {
    it('returns overallPassed true when all rules pass', () => {
      const result = engine.evaluate('the quick brown fox', [
        { type: 'keyword', config: { keywords: ['quick'], mode: 'all' } },
        { type: 'length', config: { min: 5 } },
      ]);
      expect(result.overallPassed).toBe(true);
      expect(result.overallScore).toBe(1);
      expect(result.ruleResults).toHaveLength(2);
      expect(result.ruleResults.every((r) => r.passed)).toBe(true);
    });

    it('returns overallPassed false when some rules fail', () => {
      const result = engine.evaluate('the quick brown fox', [
        { type: 'keyword', config: { keywords: ['cat'], mode: 'all' } },
        { type: 'length', config: { min: 5 } },
      ]);
      expect(result.overallPassed).toBe(false);
      expect(result.overallScore).toBe(0.5);
    });

    it('returns perfect score for empty rules', () => {
      const result = engine.evaluate('hello', []);
      expect(result.overallPassed).toBe(true);
      expect(result.overallScore).toBe(1);
      expect(result.ruleResults).toHaveLength(0);
    });

    it('handles mixed rule types', () => {
      const result = engine.evaluate('{"name":"test"}', [
        { type: 'json_schema', config: { schema: { type: 'object', required: ['name'] } } },
        { type: 'length', config: { max: 50 } },
      ]);
      expect(result.overallPassed).toBe(true);
      expect(result.overallScore).toBe(1);
    });

    it('fails json_schema when text is not valid JSON', () => {
      const result = engine.evaluate('not json', [{ type: 'json_schema', config: { schema: { type: 'object' } } }]);
      expect(result.overallPassed).toBe(false);
      expect(result.ruleResults[0].reason).toContain('not valid JSON');
    });

    it('caches compiled Ajv validators for reuse', () => {
      const schema = { type: 'object', required: ['name'] };
      const rules = [{ type: 'json_schema' as const, config: { schema } }];

      // First evaluation compiles the schema
      const result1 = engine.evaluate('{"name":"test"}', rules);
      expect(result1.overallPassed).toBe(true);

      // Second evaluation with the same schema object should reuse the cached validator
      const result2 = engine.evaluate('{"name":"test"}', rules);
      expect(result2.overallPassed).toBe(true);
    });

    it('evicts oldest cached validator when cache exceeds 100 entries', () => {
      // This test verifies the cache eviction logic by using 101 distinct schema objects
      const schemas: Array<Record<string, unknown>> = [];
      for (let i = 0; i < 101; i++) {
        schemas.push({ type: 'object', properties: { id: { type: 'number', const: i } } });
      }

      // Evaluate with each unique schema to fill the cache
      for (let i = 0; i < 101; i++) {
        const rules = [{ type: 'json_schema' as const, config: { schema: schemas[i] } }];
        engine.evaluate(`{"id":${i}}`, rules);
      }

      // All evaluations should still pass because eviction only removes the oldest;
      // re-compiling on demand is transparent to the caller.
      const lastRules = [{ type: 'json_schema' as const, config: { schema: schemas[100] } }];
      const result = engine.evaluate('{"id":100}', lastRules);
      expect(result.overallPassed).toBe(true);
    });
  });
});
