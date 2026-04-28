import { PostgresAdapter } from '@models/postgres.adapter';

function createMockPool() {
  return {
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
  };
}

describe('PostgresAdapter', () => {
  let adapter: PostgresAdapter;
  let pool: ReturnType<typeof createMockPool>;

  beforeEach(() => {
    pool = createMockPool();
    adapter = new PostgresAdapter('postgres://user:pass@localhost/db');
    (adapter as any).pool = pool;
  });

  it('should rewrite ? placeholders to $1, $2, etc', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 });
    const stmt = adapter.prepare('SELECT * FROM prompts WHERE name = ? AND version_tag = ?');
    await stmt.get('hello', '1.0.0');

    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM prompts WHERE name = $1 AND version_tag = $2', [
      'hello',
      '1.0.0',
    ]);
  });

  it('should NOT automatically append RETURNING id to INSERTs', async () => {
    pool.query.mockResolvedValue({ rows: [], rowCount: 1 });
    const stmt = adapter.prepare('INSERT INTO migrations (name) VALUES (?)');
    const result = await stmt.run('001_test');

    expect(pool.query).toHaveBeenCalledWith('INSERT INTO migrations (name) VALUES ($1)', ['001_test']);
    expect(result.lastInsertRowid).toBe(0);
    expect(result.changes).toBe(1);
  });

  it('should return lastInsertRowid when caller includes RETURNING id', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 42 }], rowCount: 1 });
    const stmt = adapter.prepare('INSERT INTO prompts (name) VALUES (?) RETURNING id');
    const result = await stmt.run('hello');

    expect(pool.query).toHaveBeenCalledWith('INSERT INTO prompts (name) VALUES ($1) RETURNING id', ['hello']);
    expect(result.lastInsertRowid).toBe(42);
    expect(result.changes).toBe(1);
  });

  it('should commit transaction', async () => {
    const clientQuery = jest.fn().mockImplementation(() => ({ rows: [{ id: 1 }], rowCount: 1 }));
    const clientRelease = jest.fn();
    pool.connect.mockResolvedValue({
      query: clientQuery,
      release: clientRelease,
    });

    await adapter.transaction(async (db) => {
      const stmt = db.prepare('SELECT * FROM prompts WHERE name = ?');
      return await stmt.get('hello');
    });

    expect(clientQuery).toHaveBeenCalledWith('BEGIN');
    expect(clientQuery).toHaveBeenCalledWith('COMMIT');
    expect(clientRelease).toHaveBeenCalled();
  });

  it('should rollback transaction and preserve original error', async () => {
    const clientQuery = jest.fn();
    const clientRelease = jest.fn();
    pool.connect.mockResolvedValue({
      query: clientQuery,
      release: clientRelease,
    });

    const err = new Error('boom');
    await expect(
      adapter.transaction(async () => {
        throw err;
      }),
    ).rejects.toThrow('boom');

    expect(clientQuery).toHaveBeenCalledWith('BEGIN');
    expect(clientQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(clientRelease).toHaveBeenCalled();
  });

  it('should preserve original error even when ROLLBACK throws', async () => {
    const clientQuery = jest.fn().mockImplementation((sql: string) => {
      if (sql === 'ROLLBACK') {
        throw new Error('rollback failed');
      }
    });
    const clientRelease = jest.fn();
    pool.connect.mockResolvedValue({
      query: clientQuery,
      release: clientRelease,
    });

    const originalErr = new Error('original');
    await expect(
      adapter.transaction(async () => {
        throw originalErr;
      }),
    ).rejects.toThrow('original');

    expect(clientQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(clientRelease).toHaveBeenCalled();
  });

  it('should register pool error handler that does not crash', () => {
    const { Pool } = require('pg');
    const onSpy = jest.spyOn(Pool.prototype, 'on').mockImplementation(() => {});
    const testAdapter = new PostgresAdapter('postgres://user:pass@localhost/db');
    expect(onSpy).toHaveBeenCalledWith('error', expect.any(Function));
    const handler = onSpy.mock.calls[0][1] as (err: Error) => void;
    expect(() => handler(new Error('pool error'))).not.toThrow();
    onSpy.mockRestore();
  });

  it('should close pool', async () => {
    await adapter.close();
    expect(pool.end).toHaveBeenCalled();
  });

  it('should return dialect postgres', () => {
    expect(adapter.dialect).toBe('postgres');
  });

  it('should exec raw SQL', async () => {
    pool.query.mockResolvedValue({});
    await adapter.exec('CREATE TABLE test (id INT)');
    expect(pool.query).toHaveBeenCalledWith('CREATE TABLE test (id INT)');
  });
});
