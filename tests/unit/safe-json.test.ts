import { safeJsonParse } from '@utils/safe-json';

describe('safeJsonParse', () => {
  it('returns parsed value for valid JSON', () => {
    expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
    expect(safeJsonParse('[1,2,3]', [])).toEqual([1, 2, 3]);
  });

  it('returns fallback for invalid JSON', () => {
    expect(safeJsonParse('not json', { fallback: true })).toEqual({ fallback: true });
    expect(safeJsonParse('{malformed', [])).toEqual([]);
  });

  it('returns fallback for null input', () => {
    expect(safeJsonParse(null, {})).toEqual({});
    expect(safeJsonParse(null, [])).toEqual([]);
  });

  it('returns fallback for undefined input', () => {
    expect(safeJsonParse(undefined, {})).toEqual({});
    expect(safeJsonParse(undefined, 'default')).toBe('default');
  });

  it('returns fallback for empty string', () => {
    expect(safeJsonParse('', { fallback: true })).toEqual({ fallback: true });
  });
});
