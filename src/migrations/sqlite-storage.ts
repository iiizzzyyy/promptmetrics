import Database from 'better-sqlite3';

export interface SQLiteStorageOptions {
  db: Database.Database;
  tableName?: string;
  columnName?: string;
  columnType?: string;
}

export class SQLiteStorage {
  private db: Database.Database;
  private tableName: string;
  private columnName: string;

  constructor(options: SQLiteStorageOptions) {
    this.db = options.db;
    this.tableName = options.tableName || 'migrations';
    this.columnName = options.columnName || 'name';
  }

  async logMigration({ name }: { name: string }): Promise<void> {
    const stmt = this.db.prepare(`INSERT INTO ${this.tableName} (${this.columnName}) VALUES (?)`);
    stmt.run(name);
  }

  async unlogMigration({ name }: { name: string }): Promise<void> {
    const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE ${this.columnName} = ?`);
    stmt.run(name);
  }

  async executed(): Promise<string[]> {
    this.ensureTable();
    const rows = this.db.prepare(`SELECT ${this.columnName} FROM ${this.tableName} ORDER BY ${this.columnName}`).all() as Record<string, string>[];
    return rows.map((row) => row[this.columnName]);
  }

  private ensureTable(): void {
    this.db.exec(`CREATE TABLE IF NOT EXISTS ${this.tableName} (${this.columnName} TEXT PRIMARY KEY)`);
  }
}
