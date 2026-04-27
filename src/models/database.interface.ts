export interface PreparedStatement {
  all(...params: unknown[]): Promise<unknown[]>;
  get(...params: unknown[]): Promise<unknown | undefined>;
  run(
    ...params: unknown[]
  ): Promise<{ lastInsertRowid: number | bigint; changes: number }>;
}

export interface DatabaseAdapter {
  readonly dialect: 'sqlite' | 'postgres';
  prepare(sql: string): PreparedStatement;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (db: DatabaseAdapter) => T | Promise<T>): Promise<T>;
  close(): Promise<void>;
}
