import { Pool, PoolClient } from 'pg';
import { DatabaseAdapter, PreparedStatement } from './database.interface';

class PostgresPreparedStatement implements PreparedStatement {
  constructor(
    private readonly pool: Pool,
    private readonly sql: string,
  ) {}

  private rewritePlaceholders(sql: string): string {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
  }

  async all(...params: unknown[]): Promise<unknown[]> {
    const result = await this.pool.query(this.rewritePlaceholders(this.sql), params);
    return result.rows;
  }

  async get(...params: unknown[]): Promise<unknown | undefined> {
    const result = await this.pool.query(this.rewritePlaceholders(this.sql), params);
    return result.rows[0];
  }

  async run(...params: unknown[]): Promise<{ lastInsertRowid: number | bigint; changes: number }> {
    const sql = this.rewritePlaceholders(this.sql);
    const result = await this.pool.query(sql, params);
    return {
      lastInsertRowid: result.rows[0]?.id ?? 0,
      changes: result.rowCount ?? 0,
    };
  }
}

export class PostgresAdapter implements DatabaseAdapter {
  readonly dialect = 'postgres' as const;
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
    this.pool.on('error', (err) => {
      console.error('Postgres pool error:', err);
    });
  }

  prepare(sql: string): PreparedStatement {
    return new PostgresPreparedStatement(this.pool, sql);
  }

  async exec(sql: string): Promise<void> {
    await this.pool.query(sql);
  }

  async transaction<T>(fn: (db: DatabaseAdapter) => T | Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const adapter = new TransactionPostgresAdapter(client);
      const result = await fn(adapter);
      await client.query('COMMIT');
      return result as T;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        (err as any).cause = rollbackErr;
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

class TransactionPostgresAdapter implements DatabaseAdapter {
  readonly dialect = 'postgres' as const;
  constructor(private readonly client: PoolClient) {}

  prepare(sql: string): PreparedStatement {
    return new TransactionPreparedStatement(this.client, sql);
  }

  async exec(sql: string): Promise<void> {
    await this.client.query(sql);
  }

  async transaction<T>(_fn: (db: DatabaseAdapter) => T | Promise<T>): Promise<T> {
    throw new Error('Nested transactions are not supported');
  }

  async close(): Promise<void> {
    // no-op: client is managed by parent
  }
}

class TransactionPreparedStatement implements PreparedStatement {
  constructor(
    private readonly client: PoolClient,
    private readonly sql: string,
  ) {}

  private rewritePlaceholders(sql: string): string {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
  }

  async all(...params: unknown[]): Promise<unknown[]> {
    const result = await this.client.query(this.rewritePlaceholders(this.sql), params);
    return result.rows;
  }

  async get(...params: unknown[]): Promise<unknown | undefined> {
    const result = await this.client.query(this.rewritePlaceholders(this.sql), params);
    return result.rows[0];
  }

  async run(...params: unknown[]): Promise<{ lastInsertRowid: number | bigint; changes: number }> {
    const sql = this.rewritePlaceholders(this.sql);
    const result = await this.client.query(sql, params);
    return {
      lastInsertRowid: result.rows[0]?.id ?? 0,
      changes: result.rowCount ?? 0,
    };
  }
}
