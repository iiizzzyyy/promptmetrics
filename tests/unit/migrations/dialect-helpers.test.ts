import { idColumn, nowFn, windowStartColumn, timestampColumn } from '../../../migrations/dialect-helpers';

describe('dialect-helpers', () => {
  describe('idColumn', () => {
    it('returns SERIAL PRIMARY KEY for postgres', () => {
      expect(idColumn('postgres')).toBe('SERIAL PRIMARY KEY');
    });

    it('returns INTEGER PRIMARY KEY AUTOINCREMENT for sqlite', () => {
      expect(idColumn('sqlite')).toBe('INTEGER PRIMARY KEY AUTOINCREMENT');
    });
  });

  describe('nowFn', () => {
    it('returns postgres epoch extraction for postgres', () => {
      expect(nowFn('postgres')).toBe('EXTRACT(EPOCH FROM NOW())::INTEGER');
    });

    it('returns unixepoch for sqlite', () => {
      expect(nowFn('sqlite')).toBe('unixepoch()');
    });
  });

  describe('windowStartColumn', () => {
    it('returns BIGINT for postgres', () => {
      expect(windowStartColumn('postgres')).toBe('BIGINT');
    });

    it('returns INTEGER for sqlite', () => {
      expect(windowStartColumn('sqlite')).toBe('INTEGER');
    });
  });

  describe('timestampColumn', () => {
    it('returns BIGINT for postgres', () => {
      expect(timestampColumn('postgres')).toBe('BIGINT');
    });

    it('returns INTEGER for sqlite', () => {
      expect(timestampColumn('sqlite')).toBe('INTEGER');
    });
  });
});
