import { DatabaseAdapter } from './dialect-helpers';

export async function up(db: DatabaseAdapter): Promise<void> {
  db.exec(`
    ALTER TABLE logs ADD COLUMN ollama_options TEXT;
    ALTER TABLE logs ADD COLUMN ollama_keep_alive TEXT;
    ALTER TABLE logs ADD COLUMN ollama_format TEXT;
  `);
}

export async function down(db: DatabaseAdapter): Promise<void> {
  db.exec(`
    ALTER TABLE logs DROP COLUMN IF EXISTS ollama_options;
    ALTER TABLE logs DROP COLUMN IF EXISTS ollama_keep_alive;
    ALTER TABLE logs DROP COLUMN IF EXISTS ollama_format;
  `);
}
