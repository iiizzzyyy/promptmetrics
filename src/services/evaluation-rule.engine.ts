import Ajv from 'ajv';
import { safeJsonParse } from '@utils/safe-json';

const JSON_PARSE_FAILED: unique symbol = Symbol('json-parse-failed');

export type RuleType = 'regex' | 'keyword' | 'json_schema' | 'length';

export interface Rule {
  type: RuleType;
  config: Record<string, unknown>;
}

export interface EvalResult {
  passed: boolean;
  score: number;
  reason?: string;
}

const ajv = new Ajv();
const compiledSchemaCache = new Map<Record<string, unknown>, ReturnType<typeof ajv.compile>>();
const MAX_CACHE_SIZE = 100;

function getCachedValidator(schema: Record<string, unknown>) {
  const cached = compiledSchemaCache.get(schema);
  if (cached) return cached;

  const validator = ajv.compile(schema);

  if (compiledSchemaCache.size >= MAX_CACHE_SIZE) {
    const firstKey = compiledSchemaCache.keys().next().value;
    if (firstKey) {
      compiledSchemaCache.delete(firstKey);
    }
  }

  compiledSchemaCache.set(schema, validator);
  return validator;
}

export class RuleBasedEvalEngine {
  evaluateRegex(text: string, pattern: string, flags?: string): EvalResult {
    try {
      const regex = new RegExp(pattern, flags);
      const passed = regex.test(text);
      return {
        passed,
        score: passed ? 1 : 0,
        reason: passed ? undefined : `Text does not match regex pattern: ${pattern}`,
      };
    } catch {
      return {
        passed: false,
        score: 0,
        reason: `Invalid regex pattern: ${pattern}`,
      };
    }
  }

  evaluateKeyword(text: string, keywords: string[], mode: 'all' | 'any' = 'all'): EvalResult {
    const missing: string[] = [];
    for (const kw of keywords) {
      if (!text.includes(kw)) {
        missing.push(kw);
      }
    }

    if (mode === 'all') {
      const passed = missing.length === 0;
      return {
        passed,
        score: passed ? 1 : 0,
        reason: passed ? undefined : `Missing keywords: ${missing.join(', ')}`,
      };
    }

    const foundCount = keywords.length - missing.length;
    const passed = foundCount > 0;
    return {
      passed,
      score: passed ? 1 : 0,
      reason: passed ? undefined : `None of the keywords found: ${keywords.join(', ')}`,
    };
  }

  evaluateJsonSchema(value: unknown, schema: Record<string, unknown>): EvalResult {
    try {
      const validate = getCachedValidator(schema);
      const passed = validate(value) as boolean;
      return {
        passed,
        score: passed ? 1 : 0,
        reason: passed ? undefined : `JSON schema validation failed: ${ajv.errorsText(validate.errors)}`,
      };
    } catch (err) {
      return {
        passed: false,
        score: 0,
        reason: `Invalid JSON schema: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  evaluateLength(text: string, min?: number, max?: number): EvalResult {
    const len = text.length;
    if (min !== undefined && len < min) {
      return {
        passed: false,
        score: 0,
        reason: `Text length ${len} is less than minimum ${min}`,
      };
    }
    if (max !== undefined && len > max) {
      return {
        passed: false,
        score: 0,
        reason: `Text length ${len} exceeds maximum ${max}`,
      };
    }
    return { passed: true, score: 1 };
  }

  evaluate(
    text: string,
    rules: Rule[],
  ): { overallPassed: boolean; overallScore: number; ruleResults: Array<EvalResult & { rule: Rule }> } {
    if (rules.length === 0) {
      return { overallPassed: true, overallScore: 1, ruleResults: [] };
    }

    const ruleResults: Array<EvalResult & { rule: Rule }> = [];

    for (const rule of rules) {
      let result: EvalResult;

      switch (rule.type) {
        case 'regex': {
          const config = rule.config as { pattern: string; flags?: string };
          result = this.evaluateRegex(text, config.pattern, config.flags);
          break;
        }
        case 'keyword': {
          const config = rule.config as { keywords: string[]; mode?: 'all' | 'any' };
          result = this.evaluateKeyword(text, config.keywords, config.mode);
          break;
        }
        case 'json_schema': {
          const config = rule.config as { schema: Record<string, unknown> };
          const parsed = safeJsonParse<unknown>(text, JSON_PARSE_FAILED);
          if (parsed === JSON_PARSE_FAILED) {
            result = { passed: false, score: 0, reason: 'Text is not valid JSON' };
            break;
          }
          result = this.evaluateJsonSchema(parsed, config.schema);
          break;
        }
        case 'length': {
          const config = rule.config as { min?: number; max?: number };
          result = this.evaluateLength(text, config.min, config.max);
          break;
        }
        default:
          result = { passed: false, score: 0, reason: `Unknown rule type: ${(rule as Rule).type}` };
      }

      ruleResults.push({ ...result, rule });
    }

    const passedCount = ruleResults.filter((r) => r.passed).length;
    const overallScore = passedCount / rules.length;
    const overallPassed = passedCount === rules.length;

    return { overallPassed, overallScore, ruleResults };
  }
}
