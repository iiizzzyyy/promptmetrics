import { Umzug } from 'umzug';
import path from 'path';
import { getDb } from '@models/promptmetrics-sqlite';
import { SQLiteStorage } from './sqlite-storage';

export function createMigrator() {
  const db = getDb();

  return new Umzug({
    migrations: {
      glob: path.resolve(__dirname, '../../migrations/*.sql'),
      resolve({ name, path: filePath }) {
        return {
          name,
          up: async () => {
            if (!filePath) throw new Error(`Migration path not found for ${name}`);
            const fs = await import('fs');
            const sql = fs.readFileSync(filePath, 'utf-8');
            db.exec(sql);
          },
        };
      },
    },
    context: { db },
    storage: new SQLiteStorage({
      db,
      tableName: 'migrations',
      columnName: 'name',
      columnType: 'TEXT',
    }),
    logger: undefined,
  });
}
