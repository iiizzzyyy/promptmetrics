import { parseIdParam } from '../../../src/utils/validation';

describe('parseIdParam', () => {
  it('parses a numeric string to a number', () => {
    expect(parseIdParam('42')).toBe(42);
  });

  it('parses the first element of an array', () => {
    expect(parseIdParam(['99', 'extra'])).toBe(99);
  });

  it('throws for non-numeric string', () => {
    expect(() => parseIdParam('abc')).toThrow('Invalid ID parameter: abc');
  });

  it('throws for zero', () => {
    expect(() => parseIdParam('0')).toThrow('Invalid ID parameter: 0');
  });

  it('throws for negative number', () => {
    expect(() => parseIdParam('-5')).toThrow('Invalid ID parameter: -5');
  });

  it('accepts decimal string by truncating to integer', () => {
    expect(parseIdParam('3.14')).toBe(3.14);
  });

  it('throws for empty string', () => {
    expect(() => parseIdParam('')).toThrow('Invalid ID parameter:');
  });

  it('throws for NaN in array', () => {
    expect(() => parseIdParam(['foo'])).toThrow('Invalid ID parameter: foo');
  });
});
