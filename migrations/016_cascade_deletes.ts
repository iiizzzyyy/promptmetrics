import { DatabaseAdapter } from '../src/models/database.interface';

export async function up(db: DatabaseAdapter): Promise<void> {
  if (db.dialect === 'sqlite') {
    await db.exec(`
      PRAGMA foreign_keys = OFF;

      DELETE FROM ab_test_results WHERE ab_test_id NOT IN (SELECT id FROM ab_tests);
      ALTER TABLE ab_test_results RENAME TO ab_test_results_old;
      CREATE TABLE ab_test_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ab_test_id INTEGER NOT NULL,
        version_a_score REAL,
        version_b_score REAL,
        p_value REAL,
        winner TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        workspace_id TEXT NOT NULL DEFAULT 'default',
        FOREIGN KEY (ab_test_id) REFERENCES ab_tests(id) ON DELETE CASCADE
      );
      INSERT INTO ab_test_results SELECT * FROM ab_test_results_old;
      DROP TABLE ab_test_results_old;
      CREATE INDEX IF NOT EXISTS idx_ab_test_results_test ON ab_test_results(ab_test_id);

      DELETE FROM dataset_rows WHERE dataset_id NOT IN (SELECT id FROM datasets);
      ALTER TABLE dataset_rows RENAME TO dataset_rows_old;
      CREATE TABLE dataset_rows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dataset_id INTEGER NOT NULL,
        input_json TEXT NOT NULL,
        expected_output_json TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        workspace_id TEXT NOT NULL DEFAULT 'default',
        FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
      );
      INSERT INTO dataset_rows SELECT * FROM dataset_rows_old;
      DROP TABLE dataset_rows_old;
      CREATE INDEX IF NOT EXISTS idx_dataset_rows_dataset ON dataset_rows(dataset_id);

      PRAGMA foreign_keys = ON;
    `);
  } else {
    await db.exec(`
      DELETE FROM ab_test_results WHERE ab_test_id NOT IN (SELECT id FROM ab_tests);
      ALTER TABLE ab_test_results DROP CONSTRAINT IF EXISTS ab_test_results_ab_test_id_fkey;
      ALTER TABLE ab_test_results ADD CONSTRAINT ab_test_results_ab_test_id_fkey
        FOREIGN KEY (ab_test_id) REFERENCES ab_tests(id) ON DELETE CASCADE;

      DELETE FROM dataset_rows WHERE dataset_id NOT IN (SELECT id FROM datasets);
      ALTER TABLE dataset_rows DROP CONSTRAINT IF EXISTS dataset_rows_dataset_id_fkey;
      ALTER TABLE dataset_rows ADD CONSTRAINT dataset_rows_dataset_id_fkey
        FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE;
    `);
  }
}

export async function down(db: DatabaseAdapter): Promise<void> {
  if (db.dialect === 'sqlite') {
    await db.exec(`
      PRAGMA foreign_keys = OFF;

      ALTER TABLE ab_test_results RENAME TO ab_test_results_old;
      CREATE TABLE ab_test_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ab_test_id INTEGER NOT NULL,
        version_a_score REAL,
        version_b_score REAL,
        p_value REAL,
        winner TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        workspace_id TEXT NOT NULL DEFAULT 'default',
        FOREIGN KEY (ab_test_id) REFERENCES ab_tests(id)
      );
      INSERT INTO ab_test_results SELECT * FROM ab_test_results_old;
      DROP TABLE ab_test_results_old;
      CREATE INDEX IF NOT EXISTS idx_ab_test_results_test ON ab_test_results(ab_test_id);

      ALTER TABLE dataset_rows RENAME TO dataset_rows_old;
      CREATE TABLE dataset_rows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dataset_id INTEGER NOT NULL,
        input_json TEXT NOT NULL,
        expected_output_json TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        workspace_id TEXT NOT NULL DEFAULT 'default',
        FOREIGN KEY (dataset_id) REFERENCES datasets(id)
      );
      INSERT INTO dataset_rows SELECT * FROM dataset_rows_old;
      DROP TABLE dataset_rows_old;
      CREATE INDEX IF NOT EXISTS idx_dataset_rows_dataset ON dataset_rows(dataset_id);

      PRAGMA foreign_keys = ON;
    `);
  } else {
    await db.exec(`
      ALTER TABLE ab_test_results DROP CONSTRAINT IF EXISTS ab_test_results_ab_test_id_fkey;
      ALTER TABLE ab_test_results ADD CONSTRAINT ab_test_results_ab_test_id_fkey
        FOREIGN KEY (ab_test_id) REFERENCES ab_tests(id);

      ALTER TABLE dataset_rows DROP CONSTRAINT IF EXISTS dataset_rows_dataset_id_fkey;
      ALTER TABLE dataset_rows ADD CONSTRAINT dataset_rows_dataset_id_fkey
        FOREIGN KEY (dataset_id) REFERENCES datasets(id);
    `);
  }
}
