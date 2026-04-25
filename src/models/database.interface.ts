export interface PreparedStatement {
  all(...params: unknown[]): unknown[] | Promise<unknown[]>;
  get(...params: unknown[]): unknown | Promise<unknown | undefined>;
  run(
    ...params: unknown[]
  ):
    | { lastInsertRowid: number | bigint; changes: number }
    | Promise<{ lastInsertRowid: number | bigint; changes: number }>;
}

export interface DatabaseAdapter {
  prepare(sql: string): PreparedStatement;
  exec(sql: string): void | Promise<void>;
  transaction<T>(fn: (db: DatabaseAdapter) => T | Promise<T>): T | Promise<T>;
  close(): void | Promise<void>;
}
