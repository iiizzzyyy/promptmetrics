# Issue Resolution Plan: PostgreSQL Migration Incompatibility (#29)

**Date:** 2026-04-27
**Status:** Proposed — Awaiting Approval
**Agents Consulted:** AI Engineer, Software Architect

---

## Executive Summary

Issue #29 reports that PostgreSQL startup fails because all migration files use SQLite-only syntax (`INTEGER PRIMARY KEY AUTOINCREMENT`, `unixepoch()`). After analysis, the problem is **much larger than migrations alone** — the `PostgresAdapter` uses `?` placeholders which `pg` does not support (requires `$1, $2, ...`), and multiple runtime code paths embed SQLite-specific SQL (`INSERT OR REPLACE`, `unixepoch()` in updates).

**In short: PostgreSQL support is currently completely broken at every layer.**

This plan resolves migrations, runtime SQL, adapter placeholders, test infrastructure, and the missing `rate_limits` table for PostgreSQL.

---

## Problem Inventory

| Issue | Severity | Layer | Description |
|-------|----------|-------|-------------|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | **Blocking** | Migrations | All 6 migration files; Postgres uses `SERIAL PRIMARY KEY` |
| `DEFAULT (unixepoch())` | **Blocking** | Migrations | All `created_at`/`updated_at` defaults; Postgres uses `EXTRACT(EPOCH FROM NOW())::INTEGER` |
| `?` placeholders in `PostgresAdapter` | **Blocking** | Runtime | `pg` module requires `$1, $2, ...`; every query fails |
| `INSERT OR REPLACE INTO` | **Blocking** | Runtime | 4 occurrences in drivers + middleware; Postgres uses `ON CONFLICT DO UPDATE` |
| `unixepoch()` in `UPDATE` | **Blocking** | Runtime | `run.service.ts:146` uses `updated_at = unixepoch()` |
| `rate_limits` table never created | **Blocking** | Runtime | `initSchema()` gates creation on `SqliteAdapter` instance check |
| `sqlite_master` query | Testing | Scripts | `src/scripts/init-db.ts` uses SQLite catalog table |
| `SQLiteStorage` naming | Risk | Infrastructure | Class name implies SQLite-only; SQL is actually generic |

---

## Architectural Decision

**ADR-00X: Convert migrations to TypeScript with dialect-conditional SQL strings.**

### Why TypeScript migrations (Approach C)

| Criterion | A: Separate dirs | B: Suffixes | C: TS migrations | D: Translation layer |
|-----------|------------------|-------------|------------------|----------------------|
| Files per migration | 2 | 2 | **1** | 1 + translator |
| Drift risk | High | High | **Low** | Low |
| umzug compatibility | Good | Custom glob | **Native** | Custom resolver |
| Backward compat | Good | Poor (breaks names) | **Good** (resolver maps names) | Good |
| Rollback support | Needs `down.sql` | Needs `down.sql` | **`down()` in same file** | Same as C |
| Complexity | Low | Low | **Low** | High |

**Rejected alternatives:**
- **A (separate dirs):** Drift risk is unacceptable as the schema is actively evolving (3 migrations added in 48 hours).
- **B (suffixes):** Breaks backward compatibility — existing SQLite DBs store migration names as `.sql`; renaming would cause umzug to re-run all migrations.
- **D (translation layer):** Over-engineered for 6 simple DDL files; the translator itself would need tests and maintenance.

### Consequences

**Easier:**
- One file per migration means zero drift between dialects.
- `rate_limits` moves from `initSchema()` into the initial migration where it belongs.
- `down()` migrations can be added for rollback support.
- umzug natively supports JS/TS migrations.

**Harder:**
- Can no longer `cat migrations/001.sql | psql`; must run `npm run migrate`.
- Reviewers read TypeScript with template strings instead of raw SQL (minor cost).

---

## Implementation Strategy

### Phase 1: Foundation (no user-facing change)
1. Add `dialect` property to `DatabaseAdapter` interface
2. Implement placeholder rewriting in `PostgresAdapter` (`?` -> `$1, $2, ...`)
3. Create dialect helper functions (`idColumn()`, `nowFn()`)
4. Rename `SQLiteStorage` -> `MigrationStorage` (generic SQL, no logic change)

### Phase 2: Migration Rewrite
5. Convert all 6 `.sql` migrations to `.ts` with conditional SQL
6. Update `createMigrator()` to glob `*.ts`, resolve via `import()`, preserve `.sql` names for backward compat
7. Move `rate_limits` table creation into `001_initial_schema.ts`
8. Remove `rate_limits` from `initSchema()`

### Phase 3: Runtime SQL Fixes
9. Replace `INSERT OR REPLACE` with `INSERT ... ON CONFLICT ... DO UPDATE` in all drivers and middleware
10. Replace `unixepoch()` in `run.service.ts` with cross-dialect expression
11. Replace `sqlite_master` query in `init-db.ts` with Postgres equivalent

### Phase 4: Testing
12. Parameterize migration tests to run against both SQLite and PostgreSQL
13. Add PostgreSQL integration test job to CI
14. Verify backward compatibility: existing SQLite DB with old `.sql` migrations must be a no-op under new `.ts` resolver

---

## Success Metrics

- [ ] `DATABASE_URL=postgres://... npm start` boots without migration errors
- [ ] All existing integration tests pass against PostgreSQL (in CI)
- [ ] All existing integration tests pass against SQLite (no regression)
- [ ] `npm run migrate` works for both fresh SQLite and fresh PostgreSQL databases
- [ ] `npm run build` compiles cleanly
- [ ] Backward compatibility: existing SQLite databases do not re-run migrations

---

## Related Work Outside Migrations

These must be fixed alongside migrations or PostgreSQL remains broken:

1. **`src/middlewares/rate-limit-per-key.middleware.ts`** — Replace `INSERT OR REPLACE` with `INSERT ... ON CONFLICT ... DO UPDATE`
2. **`src/drivers/promptmetrics-github-driver.ts:217`** — Replace `INSERT OR REPLACE`
3. **`src/drivers/promptmetrics-filesystem-driver.ts:100`** — Replace `INSERT OR REPLACE`
4. **`src/drivers/promptmetrics-s3-driver.ts:111`** — Replace `INSERT OR REPLACE`
5. **`src/services/run.service.ts:146`** — Replace `updated_at = unixepoch()`
6. **`src/scripts/init-db.ts:9`** — Replace `sqlite_master` query

---

*Plan generated by AI Engineer & Software Architect agent analysis.*
*Proposed 2026-04-27.*
