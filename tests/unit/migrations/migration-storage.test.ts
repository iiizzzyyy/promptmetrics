import { MigrationStorage } from '@migrations/migration-storage';
import { getDb, initSchema, closeDb } from '@models/promptmetrics-sqlite';
import fs from 'fs';
import path from 'path';

describe('MigrationStorage', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test-sqlite-storage.db');

  beforeEach(async () => {
    process.env.SQLITE_PATH = testDbPath;
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    await closeDb();
    await initSchema();
  });

  afterEach(async () => {
    await closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  it('should accept valid identifiers', () => {
    const db = getDb();
    expect(() => new MigrationStorage({ db, tableName: 'migrations', columnName: 'name' })).not.toThrow();
    expect(() => new MigrationStorage({ db, tableName: 'my_table', columnName: 'col_1' })).not.toThrow();
  });

  it('should reject invalid table names', () => {
    const db = getDb();
    expect(() => new MigrationStorage({ db, tableName: 'drop table--', columnName: 'name' })).toThrow(
      'Invalid table name',
    );
    expect(() => new MigrationStorage({ db, tableName: '1table', columnName: 'name' })).toThrow('Invalid table name');
  });

  it('should reject invalid column names', () => {
    const db = getDb();
    expect(() => new MigrationStorage({ db, tableName: 'migrations', columnName: 'select * from' })).toThrow(
      'Invalid column name',
    );
    expect(() => new MigrationStorage({ db, tableName: 'migrations', columnName: '2col' })).toThrow(
      'Invalid column name',
    );
  });
});
