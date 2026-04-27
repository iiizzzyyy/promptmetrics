import { Umzug } from 'umzug';
import path from 'path';
import { getDb } from '@models/promptmetrics-sqlite';
import { MigrationStorage } from './migration-storage';

export function createMigrator() {
  const db = getDb();

  const isTs = __filename.endsWith('.ts');
  const migrationsDir = isTs ? path.resolve(__dirname, '../../migrations') : __dirname;
  const pattern = isTs ? '[0-9]*.ts' : '[0-9]*.js';

  return new Umzug({
    migrations: {
      glob: path.join(migrationsDir, pattern),
      resolve({ name, path: filePath }) {
        if (!filePath) throw new Error(`Migration path not found for ${name}`);
        const legacyName = path.basename(filePath).replace(/\.ts$/, '.sql');
        return {
          name: legacyName,
          up: async ({ context }) => {
            const migration = await import(filePath);
            await migration.up(context.db);
          },
          down: async ({ context }) => {
            const migration = await import(filePath);
            if (migration.down) await migration.down(context.db);
          },
        };
      },
    },
    context: { db },
    storage: new MigrationStorage({
      db,
      tableName: 'migrations',
      columnName: 'name',
      columnType: 'TEXT',
    }),
    logger: undefined,
  });
}
