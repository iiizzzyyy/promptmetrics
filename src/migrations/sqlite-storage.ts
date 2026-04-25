import { DatabaseAdapter } from '../models/database.interface';

export interface SQLiteStorageOptions {
  db: DatabaseAdapter;
  tableName?: string;
  columnName?: string;
  columnType?: string;
}

export class SQLiteStorage {
  private db: DatabaseAdapter;
  private tableName: string;
  private columnName: string;

  constructor(options: SQLiteStorageOptions) {
    this.db = options.db;
    this.tableName = options.tableName || 'migrations';
    this.columnName = options.columnName || 'name';
  }

  async logMigration({ name }: { name: string }): Promise<void> {
    await this.db.prepare(`INSERT INTO ${this.tableName} (${this.columnName}) VALUES (?)`).run(name);
  }

  async unlogMigration({ name }: { name: string }): Promise<void> {
    await this.db.prepare(`DELETE FROM ${this.tableName} WHERE ${this.columnName} = ?`).run(name);
  }

  async executed(): Promise<string[]> {
    await this.ensureTable();
    const rows = (await this.db
      .prepare(`SELECT ${this.columnName} FROM ${this.tableName} ORDER BY ${this.columnName}`)
      .all()) as Record<string, string>[];
    return rows.map((row) => row[this.columnName]);
  }

  private async ensureTable(): Promise<void> {
    await this.db.exec(`CREATE TABLE IF NOT EXISTS ${this.tableName} (${this.columnName} TEXT PRIMARY KEY)`);
  }
}
