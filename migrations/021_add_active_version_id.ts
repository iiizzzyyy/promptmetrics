import { DatabaseAdapter } from '../src/models/database.interface';

export async function up(db: DatabaseAdapter): Promise<void> {
  if (db.dialect === 'postgres') {
    await db.exec(`
      ALTER TABLE prompts ADD COLUMN IF NOT EXISTS active_version_id INTEGER REFERENCES prompts(id) ON DELETE SET NULL;
    `);
  } else {
    await db.exec(`
      ALTER TABLE prompts ADD COLUMN active_version_id INTEGER REFERENCES prompts(id) ON DELETE SET NULL;
    `);
  }

  await db.exec(`
    UPDATE prompts SET active_version_id = (
      SELECT id FROM prompts p2
      WHERE p2.name = prompts.name
      AND p2.version_tag = (
        SELECT version_tag FROM prompt_labels
        WHERE prompt_name = prompts.name
        AND name = 'production'
      )
    )
  `);
}

export async function down(db: DatabaseAdapter): Promise<void> {
  if (db.dialect === 'postgres') {
    await db.exec(`
      ALTER TABLE prompts DROP COLUMN IF EXISTS active_version_id;
    `);
  } else {
    try {
      await db.exec(`
        ALTER TABLE prompts DROP COLUMN active_version_id;
      `);
    } catch {
      console.warn('SQLite <3.35 does not support DROP COLUMN; skipping active_version_id removal');
    }
  }
}
