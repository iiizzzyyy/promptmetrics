import { DatabaseAdapter } from '../src/models/database.interface';

export function idColumn(dialect: 'sqlite' | 'postgres'): string {
  return dialect === 'postgres' ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
}

export function nowFn(dialect: 'sqlite' | 'postgres'): string {
  return dialect === 'postgres' ? 'EXTRACT(EPOCH FROM NOW())::INTEGER' : 'unixepoch()';
}

export function windowStartColumn(dialect: 'sqlite' | 'postgres'): string {
  return dialect === 'postgres' ? 'BIGINT' : 'INTEGER';
}

export function timestampColumn(dialect: 'sqlite' | 'postgres'): string {
  return dialect === 'postgres' ? 'BIGINT' : 'INTEGER';
}
