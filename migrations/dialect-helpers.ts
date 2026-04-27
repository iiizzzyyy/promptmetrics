export interface DatabaseAdapter {
  exec(sql: string): void | Promise<void>;
  readonly dialect: 'sqlite' | 'postgres';
}

export function idColumn(dialect: 'sqlite' | 'postgres'): string {
  return dialect === 'postgres' ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
}

export function nowFn(dialect: 'sqlite' | 'postgres'): string {
  return dialect === 'postgres' ? 'EXTRACT(EPOCH FROM NOW())::INTEGER' : 'unixepoch()';
}
