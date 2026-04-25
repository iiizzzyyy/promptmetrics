import Database from 'better-sqlite3';
import { DatabaseAdapter, PreparedStatement } from './database.interface';

class SqlitePreparedStatement implements PreparedStatement {
  constructor(private readonly stmt: Database.Statement) {}

  all(...params: unknown[]): unknown[] {
    return this.stmt.all(...params) as unknown[];
  }

  get(...params: unknown[]): unknown | undefined {
    return (this.stmt.get(...params) as unknown) || undefined;
  }

  run(...params: unknown[]): { lastInsertRowid: number | bigint; changes: number } {
    const result = this.stmt.run(...params);
    return { lastInsertRowid: result.lastInsertRowid, changes: result.changes };
  }
}

export class SqliteAdapter implements DatabaseAdapter {
  constructor(private readonly db: Database.Database) {}

  prepare(sql: string): PreparedStatement {
    return new SqlitePreparedStatement(this.db.prepare(sql));
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  transaction<T>(fn: (db: DatabaseAdapter) => T | Promise<T>): T | Promise<T> {
    this.db.exec('BEGIN');
    try {
      const result = fn(this);
      if (result instanceof Promise) {
        return result.then(
          (value) => {
            this.db.exec('COMMIT');
            return value;
          },
          (err) => {
            this.db.exec('ROLLBACK');
            throw err;
          },
        );
      }
      this.db.exec('COMMIT');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  close(): void {
    this.db.close();
  }
}
