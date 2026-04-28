import { DatabaseAdapter } from '../src/models/database.interface';
import { idColumn, nowFn } from './dialect-helpers';

export async function up(db: DatabaseAdapter): Promise<void> {
  await db.exec(`
    ALTER TABLE prompts ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
  `);
}

export async function down(db: DatabaseAdapter): Promise<void> {
  if (db.dialect === 'postgres') {
    await db.exec(`
      ALTER TABLE prompts DROP COLUMN status;
    `);
  } else {
    // SQLite does not support DROP COLUMN in older versions; recreate the table
    await db.exec(`
      CREATE TABLE prompts_new (
        id ${idColumn(db.dialect)},
        name TEXT NOT NULL,
        version_tag TEXT NOT NULL,
        commit_sha TEXT,
        fs_path TEXT,
        driver TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (${nowFn(db.dialect)}),
        author TEXT,
        workspace_id TEXT DEFAULT 'default',
        UNIQUE(name, version_tag)
      );
      INSERT INTO prompts_new (id, name, version_tag, commit_sha, fs_path, driver, created_at, author, workspace_id)
        SELECT id, name, version_tag, commit_sha, fs_path, driver, created_at, author, workspace_id FROM prompts;
      DROP TABLE prompts;
      ALTER TABLE prompts_new RENAME TO prompts;
      CREATE INDEX IF NOT EXISTS idx_prompts_name ON prompts(name);
      CREATE INDEX IF NOT EXISTS idx_prompts_driver ON prompts(driver);
      CREATE INDEX IF NOT EXISTS idx_prompts_workspace ON prompts(workspace_id, name);
    `);
  }
}
