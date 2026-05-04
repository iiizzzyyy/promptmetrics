import { DatabaseAdapter } from '../src/models/database.interface';

export async function up(db: DatabaseAdapter): Promise<void> {
  if (db.dialect === 'postgres') {
    await db.exec(`
      ALTER TABLE ab_test_results
        ADD COLUMN IF NOT EXISTS ci_lower REAL,
        ADD COLUMN IF NOT EXISTS ci_upper REAL,
        ADD COLUMN IF NOT EXISTS stddev_a REAL,
        ADD COLUMN IF NOT EXISTS stddev_b REAL;
    `);
  } else {
    await db.exec(`ALTER TABLE ab_test_results ADD COLUMN ci_lower REAL;`);
    await db.exec(`ALTER TABLE ab_test_results ADD COLUMN ci_upper REAL;`);
    await db.exec(`ALTER TABLE ab_test_results ADD COLUMN stddev_a REAL;`);
    await db.exec(`ALTER TABLE ab_test_results ADD COLUMN stddev_b REAL;`);
  }
}

export async function down(db: DatabaseAdapter): Promise<void> {
  if (db.dialect === 'postgres') {
    await db.exec(`
      ALTER TABLE ab_test_results
        DROP COLUMN IF EXISTS ci_lower,
        DROP COLUMN IF EXISTS ci_upper,
        DROP COLUMN IF EXISTS stddev_a,
        DROP COLUMN IF EXISTS stddev_b;
    `);
  } else {
    try {
      await db.exec(`ALTER TABLE ab_test_results DROP COLUMN ci_lower;`);
    } catch {
      console.warn('SQLite <3.35 does not support DROP COLUMN; skipping ci_lower removal');
    }
    try {
      await db.exec(`ALTER TABLE ab_test_results DROP COLUMN ci_upper;`);
    } catch {
      console.warn('SQLite <3.35 does not support DROP COLUMN; skipping ci_upper removal');
    }
    try {
      await db.exec(`ALTER TABLE ab_test_results DROP COLUMN stddev_a;`);
    } catch {
      console.warn('SQLite <3.35 does not support DROP COLUMN; skipping stddev_a removal');
    }
    try {
      await db.exec(`ALTER TABLE ab_test_results DROP COLUMN stddev_b;`);
    } catch {
      console.warn('SQLite <3.35 does not support DROP COLUMN; skipping stddev_b removal');
    }
  }
}
