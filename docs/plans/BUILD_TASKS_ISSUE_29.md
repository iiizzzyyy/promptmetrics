# Build Tasks: Issue #29 — PostgreSQL Migration Incompatibility

**Derived from:** [Issue Resolution Plan](./issue-29-resolution-plan.md)
**Date:** 2026-04-27
**Status:** Proposed — Awaiting Approval
**Milestone:** [PostgreSQL Support](https://github.com/iiizzzyyy/promptmetrics/milestone/6)

---

## Legend

- `[ ]` — Not started
- `[-]` — In progress
- `[x]` — Complete
- `**BLOCKED**` — Waiting on dependency

---

## Epic 0: Foundation — Adapter & Infrastructure Fixes

**Goal:** Fix the underlying PostgreSQL adapter and infrastructure before touching migrations.

---

### Task 0.1 — Add `dialect` Property to DatabaseAdapter

- [ ] **0.1.1** Open `src/models/database.interface.ts`
- [ ] **0.1.2** Add `readonly dialect: 'sqlite' | 'postgres';` to the `DatabaseAdapter` interface
- [ ] **0.1.3** Open `src/models/sqlite.adapter.ts`
- [ ] **0.1.4** Add `readonly dialect = 'sqlite' as const;` to `SqliteAdapter` class
- [ ] **0.1.5** Open `src/models/postgres.adapter.ts`
- [ ] **0.1.6** Add `readonly dialect = 'postgres' as const;` to `PostgresAdapter` class
- [ ] **0.1.7** Verify TypeScript compiles: `npm run build` — Clean

---

### Task 0.2 — Fix `PostgresAdapter` Placeholder Rewriting

- [ ] **0.2.1** Open `src/models/postgres.adapter.ts`
- [ ] **0.2.2** Add private method to `PostgresPreparedStatement`:
  ```typescript
  private rewritePlaceholders(sql: string): string {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
  }
  ```
- [ ] **0.2.3** Update `all()`, `get()`, and `run()` to call `this.rewritePlaceholders(this.sql)` before passing to `this.pool.query()`
- [ ] **0.2.4** Apply the same fix to `TransactionPreparedStatement` (used by `TransactionPostgresAdapter`)
- [ ] **0.2.5** Verify TypeScript compiles

---

### Task 0.3 — Rename `SQLiteStorage` to `MigrationStorage`

- [ ] **0.3.1** Open `src/migrations/sqlite-storage.ts`
- [ ] **0.3.2** Rename class from `SQLiteStorage` to `MigrationStorage`
- [ ] **0.3.3** Update all imports:
  - `src/migrations/migrator.ts`
  - Any test files that import `SQLiteStorage`
- [ ] **0.3.4** Verify no remaining references to `SQLiteStorage`
- [ ] **0.3.5** Verify TypeScript compiles

---

### Task 0.4 — Create Dialect Helper Functions

- [ ] **0.4.1** Create `src/migrations/dialect-helpers.ts`:
  ```typescript
  export function idColumn(dialect: 'sqlite' | 'postgres'): string {
    return dialect === 'postgres'
      ? 'SERIAL PRIMARY KEY'
      : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  }

  export function nowFn(dialect: 'sqlite' | 'postgres'): string {
    return dialect === 'postgres'
      ? 'EXTRACT(EPOCH FROM NOW())::INTEGER'
      : 'unixepoch()';
  }

  export function insertOrReplace(dialect: 'sqlite' | 'postgres', table: string, columns: string[], conflictColumns: string[], updateColumns: string[]): string {
    const cols = columns.join(', ');
    const vals = columns.map(() => '?').join(', ');
    const conflict = conflictColumns.join(', ');
    const updates = updateColumns.map((c) => `${c} = excluded.${c}`).join(', ');

    if (dialect === 'postgres') {
      return `INSERT INTO ${table} (${cols}) VALUES (${vals}) ON CONFLICT(${conflict}) DO UPDATE SET ${updates}`;
    }
    return `INSERT OR REPLACE INTO ${table} (${cols}) VALUES (${vals})`;
  }
  ```
- [ ] **0.4.2** Verify TypeScript compiles

---

## Epic 1: Convert Migrations from `.sql` to `.ts`

**Goal:** Rewrite all 6 migrations as TypeScript files with dialect-conditional SQL.

---

### Task 1.1 — Create `migrations/001_initial_schema.ts`

- [ ] **1.1.1** Create `migrations/001_initial_schema.ts`:
  ```typescript
  import { DatabaseAdapter } from '../src/models/database.interface';
  import { idColumn, nowFn } from './dialect-helpers';

  export async function up(db: DatabaseAdapter): Promise<void> {
    const d = db.dialect;

    db.exec(`
      CREATE TABLE IF NOT EXISTS prompts (
        id ${idColumn(d)},
        name TEXT NOT NULL,
        version_tag TEXT NOT NULL,
        commit_sha TEXT,
        fs_path TEXT,
        driver TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (${nowFn(d)}),
        author TEXT,
        UNIQUE(name, version_tag)
      );

      CREATE INDEX IF NOT EXISTS idx_prompts_name ON prompts(name);
      CREATE INDEX IF NOT EXISTS idx_prompts_driver ON prompts(driver);

      CREATE TABLE IF NOT EXISTS api_keys (
        id ${idColumn(d)},
        key_hash TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        scopes TEXT NOT NULL DEFAULT 'read,write',
        created_at INTEGER NOT NULL DEFAULT (${nowFn(d)}),
        last_used_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS logs (
        id ${idColumn(d)},
        prompt_name TEXT,
        version_tag TEXT,
        metadata_json TEXT,
        provider TEXT,
        model TEXT,
        tokens_in INTEGER,
        tokens_out INTEGER,
        latency_ms INTEGER,
        cost_usd REAL,
        created_at INTEGER NOT NULL DEFAULT (${nowFn(d)})
      );

      CREATE INDEX IF NOT EXISTS idx_logs_prompt ON logs(prompt_name, version_tag);
      CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at);

      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id ${idColumn(d)},
        action TEXT NOT NULL,
        prompt_name TEXT,
        version_tag TEXT,
        api_key_name TEXT,
        ip_address TEXT,
        timestamp INTEGER NOT NULL DEFAULT (${nowFn(d)})
      );

      CREATE INDEX IF NOT EXISTS idx_audit_logs_prompt ON audit_logs(prompt_name);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);

      CREATE TABLE IF NOT EXISTS traces (
        id ${idColumn(d)},
        trace_id TEXT NOT NULL UNIQUE,
        prompt_name TEXT,
        version_tag TEXT,
        metadata_json TEXT,
        created_at INTEGER NOT NULL DEFAULT (${nowFn(d)})
      );

      CREATE INDEX IF NOT EXISTS idx_traces_trace_id ON traces(trace_id);
      CREATE INDEX IF NOT EXISTS idx_traces_prompt ON traces(prompt_name, version_tag);

      CREATE TABLE IF NOT EXISTS spans (
        id ${idColumn(d)},
        trace_id TEXT NOT NULL,
        span_id TEXT NOT NULL UNIQUE,
        parent_id TEXT,
        name TEXT NOT NULL,
        status TEXT CHECK(status IN ('ok', 'error')),
        start_time INTEGER,
        end_time INTEGER,
        metadata_json TEXT,
        created_at INTEGER NOT NULL DEFAULT (${nowFn(d)}),
        FOREIGN KEY (trace_id) REFERENCES traces(trace_id)
      );

      CREATE INDEX IF NOT EXISTS idx_spans_trace ON spans(trace_id);
      CREATE INDEX IF NOT EXISTS idx_spans_span_id ON spans(span_id);

      CREATE TABLE IF NOT EXISTS runs (
        id ${idColumn(d)},
        run_id TEXT NOT NULL UNIQUE,
        workflow_name TEXT NOT NULL,
        status TEXT CHECK(status IN ('running', 'completed', 'failed')) NOT NULL DEFAULT 'running',
        input_json TEXT,
        output_json TEXT,
        trace_id TEXT,
        metadata_json TEXT,
        created_at INTEGER NOT NULL DEFAULT (${nowFn(d)}),
        updated_at INTEGER NOT NULL DEFAULT (${nowFn(d)}),
        FOREIGN KEY (trace_id) REFERENCES traces(trace_id)
      );

      CREATE INDEX IF NOT EXISTS idx_runs_run_id ON runs(run_id);
      CREATE INDEX IF NOT EXISTS idx_runs_workflow ON runs(workflow_name);
      CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
      CREATE INDEX IF NOT EXISTS idx_runs_created ON runs(created_at);

      CREATE TABLE IF NOT EXISTS prompt_labels (
        id ${idColumn(d)},
        prompt_name TEXT NOT NULL,
        name TEXT NOT NULL,
        version_tag TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (${nowFn(d)}),
        UNIQUE(prompt_name, name)
      );

      CREATE INDEX IF NOT EXISTS idx_prompt_labels_prompt ON prompt_labels(prompt_name);
      CREATE INDEX IF NOT EXISTS idx_prompt_labels_name ON prompt_labels(name);

      -- Create rate_limits table for both dialects (moved from initSchema)
      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        window_start INTEGER NOT NULL,
        count INTEGER NOT NULL DEFAULT 0
      );
    `);
  }

  export async function down(db: DatabaseAdapter): Promise<void> {
    db.exec(`
      DROP TABLE IF EXISTS rate_limits;
      DROP TABLE IF EXISTS prompt_labels;
      DROP TABLE IF EXISTS runs;
      DROP TABLE IF EXISTS spans;
      DROP TABLE IF EXISTS traces;
      DROP TABLE IF EXISTS audit_logs;
      DROP TABLE IF EXISTS config;
      DROP TABLE IF EXISTS logs;
      DROP TABLE IF EXISTS api_keys;
      DROP TABLE IF EXISTS prompts;
    `);
  }
  ```
- [ ] **1.1.2** Verify TypeScript compiles

---

### Task 1.2 — Create `migrations/002_add_ollama_columns.ts`

- [ ] **1.2.1** Create `migrations/002_add_ollama_columns.ts`:
  ```typescript
  import { DatabaseAdapter } from '../src/models/database.interface';

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
  ```
- [ ] **1.2.2** Note: `DROP COLUMN IF EXISTS` requires SQLite 3.35+ (bundled with better-sqlite3 v12.1.1) and PostgreSQL 9.6+

---

### Task 1.3 — Create `migrations/003_add_key_expiration.ts`

- [ ] **1.3.1** Create `migrations/003_add_key_expiration.ts`:
  ```typescript
  import { DatabaseAdapter } from '../src/models/database.interface';

  export async function up(db: DatabaseAdapter): Promise<void> {
    db.exec(`ALTER TABLE api_keys ADD COLUMN expires_at INTEGER;`);
  }

  export async function down(db: DatabaseAdapter): Promise<void> {
    db.exec(`ALTER TABLE api_keys DROP COLUMN IF EXISTS expires_at;`);
  }
  ```

---

### Task 1.4 — Create `migrations/004_add_evaluations.ts`

- [ ] **1.4.1** Create `migrations/004_add_evaluations.ts`:
  ```typescript
  import { DatabaseAdapter } from '../src/models/database.interface';
  import { idColumn, nowFn } from './dialect-helpers';

  export async function up(db: DatabaseAdapter): Promise<void> {
    const d = db.dialect;

    db.exec(`
      CREATE TABLE IF NOT EXISTS evaluations (
        id ${idColumn(d)},
        name TEXT NOT NULL,
        description TEXT,
        prompt_name TEXT NOT NULL,
        version_tag TEXT,
        criteria_json TEXT,
        created_at INTEGER NOT NULL DEFAULT (${nowFn(d)})
      );

      CREATE INDEX IF NOT EXISTS idx_evaluations_prompt ON evaluations(prompt_name);
      CREATE INDEX IF NOT EXISTS idx_evaluations_created ON evaluations(created_at);

      CREATE TABLE IF NOT EXISTS evaluation_results (
        id ${idColumn(d)},
        evaluation_id INTEGER NOT NULL,
        run_id TEXT,
        score REAL,
        metadata_json TEXT,
        created_at INTEGER NOT NULL DEFAULT (${nowFn(d)}),
        FOREIGN KEY (evaluation_id) REFERENCES evaluations(id)
      );

      CREATE INDEX IF NOT EXISTS idx_evaluation_results_evaluation ON evaluation_results(evaluation_id);
      CREATE INDEX IF NOT EXISTS idx_evaluation_results_run ON evaluation_results(run_id);
    `);
  }

  export async function down(db: DatabaseAdapter): Promise<void> {
    db.exec(`
      DROP TABLE IF EXISTS evaluation_results;
      DROP TABLE IF EXISTS evaluations;
    `);
  }
  ```

---

### Task 1.5 — Create `migrations/005_add_workspace_id.ts`

- [ ] **1.5.1** Create `migrations/005_add_workspace_id.ts`:
  ```typescript
  import { DatabaseAdapter } from '../src/models/database.interface';

  export async function up(db: DatabaseAdapter): Promise<void> {
    db.exec(`
      ALTER TABLE api_keys ADD COLUMN workspace_id TEXT DEFAULT 'default';
      ALTER TABLE prompts ADD COLUMN workspace_id TEXT DEFAULT 'default';
      ALTER TABLE logs ADD COLUMN workspace_id TEXT DEFAULT 'default';
      ALTER TABLE traces ADD COLUMN workspace_id TEXT DEFAULT 'default';
      ALTER TABLE spans ADD COLUMN workspace_id TEXT DEFAULT 'default';
      ALTER TABLE runs ADD COLUMN workspace_id TEXT DEFAULT 'default';
      ALTER TABLE prompt_labels ADD COLUMN workspace_id TEXT DEFAULT 'default';
      ALTER TABLE evaluations ADD COLUMN workspace_id TEXT DEFAULT 'default';
      ALTER TABLE evaluation_results ADD COLUMN workspace_id TEXT DEFAULT 'default';
      ALTER TABLE audit_logs ADD COLUMN workspace_id TEXT DEFAULT 'default';

      CREATE INDEX IF NOT EXISTS idx_prompts_workspace ON prompts(workspace_id, name);
      CREATE INDEX IF NOT EXISTS idx_logs_workspace ON logs(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_traces_workspace ON traces(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_spans_workspace ON spans(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_runs_workspace ON runs(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_prompt_labels_workspace ON prompt_labels(workspace_id, prompt_name);
      CREATE INDEX IF NOT EXISTS idx_evaluations_workspace ON evaluations(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_evaluation_results_workspace ON evaluation_results(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace ON audit_logs(workspace_id);
    `);
  }

  export async function down(db: DatabaseAdapter): Promise<void> {
    db.exec(`
      DROP INDEX IF EXISTS idx_prompts_workspace;
      DROP INDEX IF EXISTS idx_logs_workspace;
      DROP INDEX IF EXISTS idx_traces_workspace;
      DROP INDEX IF EXISTS idx_spans_workspace;
      DROP INDEX IF EXISTS idx_runs_workspace;
      DROP INDEX IF EXISTS idx_prompt_labels_workspace;
      DROP INDEX IF EXISTS idx_evaluations_workspace;
      DROP INDEX IF EXISTS idx_evaluation_results_workspace;
      DROP INDEX IF EXISTS idx_audit_logs_workspace;

      ALTER TABLE api_keys DROP COLUMN IF EXISTS workspace_id;
      ALTER TABLE prompts DROP COLUMN IF EXISTS workspace_id;
      ALTER TABLE logs DROP COLUMN IF EXISTS workspace_id;
      ALTER TABLE traces DROP COLUMN IF EXISTS workspace_id;
      ALTER TABLE spans DROP COLUMN IF EXISTS workspace_id;
      ALTER TABLE runs DROP COLUMN IF EXISTS workspace_id;
      ALTER TABLE prompt_labels DROP COLUMN IF EXISTS workspace_id;
      ALTER TABLE evaluations DROP COLUMN IF EXISTS workspace_id;
      ALTER TABLE evaluation_results DROP COLUMN IF EXISTS workspace_id;
      ALTER TABLE audit_logs DROP COLUMN IF EXISTS workspace_id;
    `);
  }
  ```

---

### Task 1.6 — Create `migrations/006_add_trace_created_index.ts`

- [ ] **1.6.1** Create `migrations/006_add_trace_created_index.ts`:
  ```typescript
  import { DatabaseAdapter } from '../src/models/database.interface';

  export async function up(db: DatabaseAdapter): Promise<void> {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_traces_created ON traces(created_at);`);
  }

  export async function down(db: DatabaseAdapter): Promise<void> {
    db.exec(`DROP INDEX IF EXISTS idx_traces_created;`);
  }
  ```

---

## Epic 2: Update Migrator and Init Logic

**Goal:** Wire the new `.ts` migrations into umzug and fix `initSchema()`.

---

### Task 2.1 — Update `createMigrator()` to Load `.ts` Migrations

- [ ] **2.1.1** Open `src/migrations/migrator.ts`
- [ ] **2.1.2** Change glob from `../../migrations/*.sql` to `../../migrations/*.ts`
- [ ] **2.1.3** Update `resolve()` to dynamically import `.ts` files and preserve `.sql` names for backward compatibility:
  ```typescript
  resolve({ name, path: filePath }) {
    if (!filePath) throw new Error(`Migration path not found for ${name}`);
    const legacyName = path.basename(filePath).replace(/\.ts$/, '.sql');
    return {
      name: legacyName,
      up: async () => {
        const mod = await import(filePath);
        await mod.up(db);
      },
      down: async () => {
        const mod = await import(filePath);
        if (mod.down) await mod.down(db);
      },
    };
  }
  ```
- [ ] **2.1.4** Update storage import from `SQLiteStorage` to `MigrationStorage`
- [ ] **2.1.5** Verify TypeScript compiles

---

### Task 2.2 — Fix `initSchema()` to Remove SQLite-Only `rate_limits` Gate

- [ ] **2.2.1** Open `src/models/promptmetrics-sqlite.ts`
- [ ] **2.2.2** Remove the entire `if (db instanceof SqliteAdapter)` block that creates `rate_limits`
- [ ] **2.2.3** `initSchema()` should now only call `migrator.up()`
  ```typescript
  export async function initSchema(): Promise<void> {
    const migrator = createMigrator();
    await migrator.up();
  }
  ```
- [ ] **2.2.4** Verify TypeScript compiles

---

## Epic 3: Fix Runtime SQLite-Specific SQL

**Goal:** Replace all SQLite-only SQL patterns in application code with cross-dialect equivalents.

---

### Task 3.1 — Fix `INSERT OR REPLACE` in Drivers

- [ ] **3.1.1** Open `src/drivers/promptmetrics-github-driver.ts` (~line 217)
- [ ] **3.1.2** Find `INSERT OR REPLACE INTO prompts` and replace with:
  ```typescript
  db.prepare(`
    INSERT INTO prompts (name, version_tag, commit_sha, fs_path, driver, created_at, author)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(name, version_tag) DO UPDATE SET
      commit_sha = excluded.commit_sha,
      fs_path = excluded.fs_path,
      driver = excluded.driver,
      created_at = excluded.created_at,
      author = excluded.author
  `).run(...)
  ```
- [ ] **3.1.3** Open `src/drivers/promptmetrics-filesystem-driver.ts` (~line 100)
- [ ] **3.1.4** Apply same `ON CONFLICT` replacement
- [ ] **3.1.5** Open `src/drivers/promptmetrics-s3-driver.ts` (~line 111)
- [ ] **3.1.6** Apply same `ON CONFLICT` replacement
- [ ] **3.1.7** Verify TypeScript compiles

---

### Task 3.2 — Fix `INSERT OR REPLACE` in Rate Limit Middleware

- [ ] **3.2.1** Open `src/middlewares/rate-limit-per-key.middleware.ts`
- [ ] **3.2.2** Find `INSERT OR REPLACE INTO rate_limits` (~line 77)
- [ ] **3.2.3** Replace with:
  ```typescript
  db.prepare(`
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      window_start = excluded.window_start,
      count = excluded.count
  `).run(key, windowStart, count);
  ```
- [ ] **3.2.4** Verify TypeScript compiles

---

### Task 3.3 — Fix `unixepoch()` in Run Service

- [ ] **3.3.1** Open `src/services/run.service.ts` (~line 146)
- [ ] **3.3.2** Find `updates.push('updated_at = unixepoch()');`
- [ ] **3.3.3** Replace with application-level timestamp to avoid dialect-specific SQL in the service layer:
  ```typescript
  updates.push('updated_at = ?');
  params.push(Math.floor(Date.now() / 1000));
  ```
  Or alternatively, keep the SQL but use a dialect-aware expression (prefer application-level for simplicity).
- [ ] **3.3.4** Verify TypeScript compiles

---

### Task 3.4 — Fix `sqlite_master` Query in Init Script

- [ ] **3.4.1** Open `src/scripts/init-db.ts` (~line 9)
- [ ] **3.4.2** Find `SELECT name FROM sqlite_master WHERE type='table'`
- [ ] **3.4.3** Replace with dialect-aware query:
  ```typescript
  const db = getDb();
  let tables: string[];
  if (db.dialect === 'postgres') {
    const rows = await db.prepare("SELECT tablename FROM pg_tables WHERE schemaname = 'public'").all() as { tablename: string }[];
    tables = rows.map((r) => r.tablename);
  } else {
    const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    tables = rows.map((r) => r.name);
  }
  ```
- [ ] **3.4.4** Verify TypeScript compiles

---

## Epic 4: Testing & Regression

**Goal:** Ensure PostgreSQL works and SQLite doesn't break.

---

### Task 4.1 — Add PostgreSQL Migration Test

- [ ] **4.1.1** Create `tests/unit/migrations/migrator.test.ts` (or extend existing):
  - Spin up a temporary SQLite DB, run `migrator.up()`, assert all expected tables exist
  - If `DATABASE_URL` is set in env, also run against Postgres and assert same tables
- [ ] **4.1.2** Test backward compatibility:
  - Create a SQLite DB using the old `.sql` files (or just verify an existing test DB)
  - Run the new `.ts` migrator against it
  - Assert `migrator.up()` is a no-op (no duplicate tables)

---

### Task 4.2 — Parameterize Integration Tests for PostgreSQL

- [ ] **4.2.1** Update `tests/env-setup.ts` or test helpers to respect `DATABASE_URL`:
  - If `DATABASE_URL` is set, `getDb()` returns `PostgresAdapter`
  - If `SQLITE_PATH` is set, `getDb()` returns `SqliteAdapter`
  - Ensure test databases are isolated (use unique DB names or temp SQLite files)
- [ ] **4.2.2** Run `npm test` with `DATABASE_URL` pointing to a local Postgres instance:
  ```bash
  DATABASE_URL=postgres://user:pass@localhost:5432/promptmetrics_test npm test
  ```

---

### Task 4.3 — Full Regression Test

- [ ] **4.3.1** Run `npm test` — verify all 33 suites pass against SQLite
- [ ] **4.3.2** Run `npm run build` — verify TypeScript compiles cleanly
- [ ] **4.3.3** Run `npm test` with `DATABASE_URL` — verify against PostgreSQL (may need local Postgres or Docker)

---

## Epic 5: Final Commit and Release

- [ ] **5.1.1** Commit all changes with conventional commits:
  ```bash
  git commit -m "feat(db): add dialect property to DatabaseAdapter and fix Postgres placeholder rewriting (#29)"
  git commit -m "refactor(migrations): convert .sql migrations to .ts with dialect-conditional SQL (#29)"
  git commit -m "fix(runtime): replace SQLite-specific SQL with cross-dialect equivalents (#29)"
  git commit -m "test(db): add PostgreSQL migration and integration tests (#29)"
  ```
- [ ] **5.1.2** Push to GitHub
- [ ] **5.1.3** Close issue #29
- [ ] **5.1.4** Bump version to 1.0.7 in `package.json`
- [ ] **5.1.5** Update `CHANGELOG.md`
- [ ] **5.1.6** Run `npm run build` and `npm publish`

---

## Cross-Cutting Checklist

- [ ] All migration files are dialect-safe (no `AUTOINCREMENT`, `unixepoch()`, `INSERT OR REPLACE`)
- [ ] `PostgresAdapter` rewrites `?` placeholders to `$1, $2, ...`
- [ ] `rate_limits` table is created by migrations, not `initSchema()`
- [ ] All drivers use `ON CONFLICT ... DO UPDATE` instead of `INSERT OR REPLACE`
- [ ] `run.service.ts` uses application-level timestamp instead of `unixepoch()`
- [ ] `init-db.ts` queries the correct catalog table per dialect
- [ ] `SQLiteStorage` renamed to `MigrationStorage`
- [ ] Backward compatibility: existing SQLite DBs do not re-run migrations
- [ ] `npm test` passes with exit code 0 against SQLite
- [ ] `npm test` passes against PostgreSQL (CI or local)
- [ ] `npm run build` compiles cleanly

---

## Test Results Template

| Suite | Result | Time |
|-------|--------|------|
| `npm test` (SQLite) | ___ passed, ___ failed | ___ s |
| `npm test` (PostgreSQL) | ___ passed, ___ failed | ___ s |
| `npm run build` | Clean (no errors) | ___ s |

---

*Tasks generated by AI Engineer & Software Architect agent analysis.*
*Proposed 2026-04-27.*
