import { renderTemplate, validateVariables, RenderOptions } from '@services/mustache-renderer.service';
import { AppError } from '@errors/app.error';

describe('mustache-renderer.service', () => {
  describe('renderTemplate', () => {
    it('performs basic substitution', () => {
      const result = renderTemplate('Hello, {{name}}!', { name: 'Alice' });
      expect(result).toBe('Hello, Alice!');
    });

    it('returns empty string for an empty template', () => {
      const result = renderTemplate('', { name: 'Alice' });
      expect(result).toBe('');
    });

    it('passes HTML through unescaped', () => {
      const result = renderTemplate('{{html}}', { html: '<b>bold</b>' });
      expect(result).toBe('<b>bold</b>');
    });

    it('replaces multiple variables', () => {
      const result = renderTemplate('{{greeting}}, {{name}}!', {
        greeting: 'Hi',
        name: 'Bob',
      });
      expect(result).toBe('Hi, Bob!');
    });

    it('supports nested object access via dot notation', () => {
      const result = renderTemplate('{{user.name}} is {{user.age}}', {
        user: { name: 'Alice', age: 30 },
      });
      expect(result).toBe('Alice is 30');
    });

    it('leaves missing variables as empty strings when not strict', () => {
      const result = renderTemplate('Hello, {{name}}!', {});
      expect(result).toBe('Hello, !');
    });

    it('throws AppError (422) in strict mode when variables are missing', () => {
      expect(() => renderTemplate('Hello, {{name}}!', {}, { strict: true })).toThrow(AppError);

      try {
        renderTemplate('Hello, {{name}}!', {}, { strict: true });
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).statusCode).toBe(422);
        expect((err as AppError).code).toBe('VALIDATION_FAILED');
      }
    });

    it('does not throw in strict mode when all variables are present', () => {
      const result = renderTemplate('Hello, {{name}}!', { name: 'Alice' }, { strict: true });
      expect(result).toBe('Hello, Alice!');
    });

    it('handles triple-brace unescaped variables', () => {
      const result = renderTemplate('{{{content}}}', { content: '<script>alert(1)</script>' });
      expect(result).toBe('<script>alert(1)</script>');
    });
  });

  describe('validateVariables', () => {
    it('returns valid=true when all variables are present', () => {
      const result = validateVariables('Hello, {{name}}!', { name: 'Alice' });
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('identifies missing simple variables', () => {
      const result = validateVariables('Hello, {{name}}!', {});
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('name');
    });

    it('identifies missing nested variables', () => {
      const result = validateVariables('{{user.name}}', { user: {} });
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('user.name');
    });

    it('returns valid=true for nested variables that exist', () => {
      const result = validateVariables('{{user.name}}', { user: { name: 'Alice' } });
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('returns valid=true and empty missing array for empty template', () => {
      const result = validateVariables('', {});
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('ignores text-only templates', () => {
      const result = validateVariables('Hello, world!', {});
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('detects multiple missing variables', () => {
      const result = validateVariables('{{a}} and {{b}}', {});
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(expect.arrayContaining(['a', 'b']));
      expect(result.missing).toHaveLength(2);
    });

    it('treats null values as missing', () => {
      const result = validateVariables('{{name}}', { name: null });
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('name');
    });

    it('treats empty string values as present', () => {
      const result = validateVariables('{{name}}', { name: '' });
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });
  });
});
