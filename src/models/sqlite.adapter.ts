import Database from 'better-sqlite3';
import { DatabaseAdapter, PreparedStatement } from './database.interface';

class SqlitePreparedStatement implements PreparedStatement {
  constructor(private readonly stmt: Database.Statement) {}

  async all(...params: unknown[]): Promise<unknown[]> {
    return this.stmt.all(...params) as unknown[];
  }

  async get(...params: unknown[]): Promise<unknown | undefined> {
    return (this.stmt.get(...params) as unknown) || undefined;
  }

  async run(...params: unknown[]): Promise<{ lastInsertRowid: number | bigint; changes: number }> {
    const result = this.stmt.run(...params);
    return { lastInsertRowid: result.lastInsertRowid, changes: result.changes };
  }
}

export class SqliteAdapter implements DatabaseAdapter {
  readonly dialect = 'sqlite' as const;
  constructor(private readonly db: Database.Database) {}

  prepare(sql: string): PreparedStatement {
    return new SqlitePreparedStatement(this.db.prepare(sql));
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async transaction<T>(fn: (db: DatabaseAdapter) => T | Promise<T>): Promise<T> {
    this.db.exec('BEGIN');
    try {
      const result = await fn(this);
      this.db.exec('COMMIT');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
