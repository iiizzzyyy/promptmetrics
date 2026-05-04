import { DatabaseAdapter } from '../src/models/database.interface';
import { idColumn, nowFn } from './dialect-helpers';

export async function up(db: DatabaseAdapter): Promise<void> {
  if (db.dialect === 'postgres') {
    await db.exec(`
      ALTER TABLE compliance_scores
        ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'stub',
        ADD COLUMN IF NOT EXISTS raw_response_json TEXT;
    `);
  } else {
    await db.exec(`
      ALTER TABLE compliance_scores ADD COLUMN provider TEXT NOT NULL DEFAULT 'stub';
    `);
    await db.exec(`
      ALTER TABLE compliance_scores ADD COLUMN raw_response_json TEXT;
    `);
  }
}

export async function down(db: DatabaseAdapter): Promise<void> {
  if (db.dialect === 'postgres') {
    await db.exec(`
      ALTER TABLE compliance_scores
        DROP COLUMN IF EXISTS provider,
        DROP COLUMN IF EXISTS raw_response_json;
    `);
  } else {
    try {
      await db.exec(`ALTER TABLE compliance_scores DROP COLUMN provider;`);
    } catch {
      console.warn('SQLite <3.35 does not support DROP COLUMN; skipping provider removal');
    }
    try {
      await db.exec(`ALTER TABLE compliance_scores DROP COLUMN raw_response_json;`);
    } catch {
      console.warn('SQLite <3.35 does not support DROP COLUMN; skipping raw_response_json removal');
    }
  }
}
