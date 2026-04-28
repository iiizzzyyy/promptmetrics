# PromptMetrics — Build Tasks for Remaining Open Issues

**Generated:** 2026-04-28
**Repository:** iiizzzyyy/promptmetrics
**Scope:** Issues #31, #41, #62
**Derived from:** [Remaining Issues Implementation Plan](./remaining-issues-implementation-plan.md)

---

## Legend

- `[ ]` -- Not started
- `[-]` -- In progress
- `[x]` -- Complete
- `**BLOCKED**` -- Waiting on dependency

---

## Sprint 1: Critical PostgreSQL Fix (#31)

**Theme:** PostgreSQL integer overflow in rate limiting
**Estimated Duration:** 1 day
**Dependencies:** None

### ISSUE-#31 — PostgreSQL integer overflow in rate_limits.window_start

- [ ] **ISSUE-#31a** Add `windowStartColumn(dialect)` helper to `migrations/dialect-helpers.ts`.
  - Returns `'BIGINT'` for PostgreSQL, `'INTEGER'` for SQLite.
  - Estimated: 30 min

- [ ] **ISSUE-#31b** Update `migrations/001_initial_schema.ts:127-131` to use `${windowStartColumn(d)}` for the `rate_limits.window_start` column definition.
  - Estimated: 30 min

- [ ] **ISSUE-#31c** Create `migrations/007_alter_rate_limits_window_start.ts` with dialect-conditional `up()` and `down()`.
  - `up()`: PostgreSQL runs `ALTER TABLE rate_limits ALTER COLUMN window_start TYPE BIGINT;`. SQLite returns immediately (no-op).
  - `down()`: PostgreSQL runs `ALTER TABLE rate_limits ALTER COLUMN window_start TYPE INTEGER;`. SQLite returns immediately.
  - Estimated: 1 hour

- [ ] **ISSUE-#31d** Verify `src/middlewares/rate-limit-per-key.middleware.ts` does not require logic changes.
  - Confirm `windowStart = Math.floor(Date.now() / windowMs) * windowMs` still computes milliseconds and is compatible with `BIGINT`.
  - Estimated: 15 min

- [ ] **ISSUE-#31e** Write unit test in `tests/unit/migrations/dialect-helpers.test.ts` (or create it) asserting `windowStartColumn('postgres') === 'BIGINT'` and `windowStartColumn('sqlite') === 'INTEGER'`.
  - Estimated: 30 min

- [ ] **ISSUE-#31f** Write integration test in `tests/integration/rate-limit.test.ts` asserting a `window_start` value of `1_700_000_000_000` inserts cleanly into SQLite.
  - Estimated: 45 min

- [ ] **ISSUE-#31g** Write migration test in `tests/unit/migrations/migrator.test.ts` asserting migration `007` runs successfully and is a no-op on SQLite.
  - Estimated: 45 min

- [ ] **ISSUE-#31h** Run `npm test` and verify no regressions.
  - Estimated: 30 min

- [ ] **ISSUE-#31i** Commit: `git commit -m "fix(migrations): use BIGINT for rate_limits.window_start on PostgreSQL"`
  - Estimated: 15 min

---

## Sprint 2: Prompt Write Atomicity (#41)

**Theme:** Non-atomic two-phase write hardening
**Estimated Duration:** 2-3 days
**Dependencies:** Sprint 1 (migration 007 must exist so 008 can follow)

### ISSUE-#41 — PromptService.createPrompt() non-atomic two-phase write

- [ ] **ISSUE-#41a** Create migration `008_add_prompt_status.ts`.
  - Add `status TEXT NOT NULL DEFAULT 'active'` to the `prompts` table.
  - For PostgreSQL: `ALTER TABLE prompts ADD COLUMN status TEXT NOT NULL DEFAULT 'active';`
  - For SQLite: `ALTER TABLE prompts ADD COLUMN status TEXT NOT NULL DEFAULT 'active';` (SQLite supports `ADD COLUMN` directly).
  - Estimated: 1 hour

- [ ] **ISSUE-#41b** Update `src/services/prompt.service.ts:123-131` `createPrompt()` to use pending/active state machine.
  - Step 1: `INSERT INTO prompts (...) VALUES (... , 'pending', ...) ON CONFLICT(name, version_tag) DO UPDATE SET workspace_id = excluded.workspace_id, status = 'pending', driver = excluded.driver;`
  - Step 2: `await this.driver.createPrompt(prompt);`
  - Step 3: `UPDATE prompts SET status = 'active' WHERE name = ? AND version_tag = ?;`
  - On error, do not throw away the pending row; let reconciliation heal it.
  - Estimated: 2 hours

- [ ] **ISSUE-#41c** Update `src/services/prompt.service.ts:listPrompts()` to add `AND status = 'active'` to the WHERE clause.
  - Estimated: 30 min

- [ ] **ISSUE-#41d** Update `src/services/prompt.service.ts:listVersions()` to add `AND status = 'active'` to the WHERE clause.
  - Estimated: 30 min

- [ ] **ISSUE-#41e** Update `src/services/prompt.service.ts:getPrompt()` membership check to add `AND status = 'active'`.
  - Estimated: 30 min

- [ ] **ISSUE-#41f** Create `src/jobs/promptmetrics-reconciliation.job.ts`.
  - Query for `status = 'pending' AND created_at < (now - 120 seconds)`.
  - For each: call `driver.getPrompt(name, version_tag)`.
  - If found: `UPDATE prompts SET status = 'active' WHERE name = ? AND version_tag = ?`.
  - If not found: `DELETE FROM prompts WHERE name = ? AND version_tag = ?`.
  - Log metrics via OpenTelemetry if available.
  - Estimated: 3 hours

- [ ] **ISSUE-#41g** Update `src/server.ts` to instantiate and start `PromptReconciliationJob` alongside `GitSyncJob`.
  - Only start if `config.driver` is valid.
  - Estimated: 1 hour

- [ ] **ISSUE-#41h** Write unit test in `tests/unit/jobs/promptmetrics-reconciliation.job.test.ts`.
  - Mock driver.getPrompt returning content → assert row updated to 'active'.
  - Mock driver.getPrompt returning undefined → assert row deleted.
  - Estimated: 2 hours

- [ ] **ISSUE-#41i** Expand integration test in `tests/integration/prompt-transaction.test.ts`.
  - Simulate DB failure after driver.write (mock `db.prepare(...).run` to throw).
  - Assert prompt row has `status = 'pending'`.
  - Trigger reconciliation manually.
  - Assert prompt is either promoted to 'active' or deleted.
  - Estimated: 2 hours

- [ ] **ISSUE-#41j** Write E2E test in `tests/e2e/full-lifecycle.test.ts`.
  - Create prompt with each driver type (filesystem, GitHub, S3).
  - Immediately list and get.
  - Assert no orphaned prompts remain after reconciliation window.
  - Estimated: 2 hours

- [ ] **ISSUE-#41k** Run `npm run build` and `npm test` verifying zero regressions.
  - Estimated: 1 hour

- [ ] **ISSUE-#41l** Commit: `git commit -m "feat(prompts): add pending/active state machine and reconciliation job for atomic writes"`
  - Estimated: 15 min

---

## Sprint 3: Test Coverage Expansion (#62)

**Theme:** Close coverage gaps to reach 85%+
**Estimated Duration:** 2-3 days
**Dependencies:** Sprint 1 and Sprint 2 (tests should validate the fixes above)

### ISSUE-#62 — Test coverage gaps

#### Tier 1: Critical path unit tests

- [ ] **ISSUE-#62a** Create `tests/unit/error-handler.middleware.test.ts`.
  - Test `SyntaxError` handling (invalid JSON body).
  - Test `AppError` serialization (assert `JSON.stringify` includes `statusCode` and `code`).
  - Test production 500 masking (assert `err.message` is hidden when `NODE_ENV=production`).
  - Target: cover ~16 uncovered lines in `src/middlewares/promptmetrics-error-handler.middleware.ts`.
  - Estimated: 1.5 hours

- [ ] **ISSUE-#62b** Expand `tests/unit/services/cache.service.test.ts`.
  - Mock Redis `get` to return invalid JSON and assert `JSON.parse` failure is handled as cache miss.
  - Test TTL eviction logic.
  - Test `setCachedPrompt` and `getCachedPrompt` with Redis backend.
  - Target: cover ~35 uncovered lines in `src/services/cache.service.ts`.
  - Estimated: 1.5 hours

- [ ] **ISSUE-#62c** Create `tests/unit/rate-limit-per-key.middleware.test.ts`.
  - Mock `ioredis` pipeline for `INCR` + `EXPIRE` and assert headers are set correctly.
  - Mock `getDbOrNull()` error path.
  - Test the `getDbOrNull()` fallback when `getDb()` throws.
  - Target: cover ~45 uncovered lines in `src/middlewares/rate-limit-per-key.middleware.ts`.
  - Estimated: 2 hours

#### Tier 2: Driver and adapter unit tests

- [ ] **ISSUE-#62d** Expand `tests/unit/github-driver.test.ts`.
  - Add test for `getPrompt` success path (mock filesystem + `simple-git` calls).
  - Add test for `getPrompt` 404 path (mock `fs.existsSync` returning false).
  - Add test for `listPrompts` pagination.
  - Add test for `listVersions` DB query delegation.
  - Add test for `sync` pulling latest changes.
  - Add test for `search` filtering.
  - Add test for revert logic on DB failure (mock GitHub DELETE API).
  - Target: cover ~50 uncovered lines in `src/drivers/promptmetrics-github-driver.ts`.
  - Estimated: 3 hours

- [ ] **ISSUE-#62e** Create `tests/unit/postgres.adapter.test.ts`.
  - Mock `pg` Pool and assert placeholder rewriting (`?` -> `$1, $2`).
  - Assert `lastInsertRowid` returns the actual ID after `INSERT`.
  - Test transaction commit and rollback paths.
  - Test `pool.on('error')` handler does not crash the process.
  - Target: cover ~50 uncovered lines in `src/models/postgres.adapter.ts`.
  - Estimated: 3 hours

- [ ] **ISSUE-#62f** Expand `tests/unit/s3-driver.test.ts`.
  - Add path-traversal tests for `createPrompt`, `getPrompt`, `listVersions` with malicious names (`../etc/passwd`, `foo/../../../bar`).
  - Assert validation throws before any S3 client call.
  - Estimated: 1 hour

#### Tier 3: Integration and E2E tests

- [ ] **ISSUE-#62g** Create `tests/integration/rate-limit-redis.test.ts`.
  - Mock `ioredis` to test Redis-backed rate-limit path end-to-end.
  - Test normal flow (headers, 429 after limit).
  - Test pipeline failure (assert request is not permanently blocked).
  - Estimated: 2 hours

- [ ] **ISSUE-#62h** Expand `tests/integration/webhook.test.ts`.
  - Test invalid signature (assert 401).
  - Test missing `x-hub-signature-256` header (assert 401).
  - Test non-push event payload (assert 200 but no sync triggered).
  - Estimated: 1.5 hours

- [ ] **ISSUE-#62i** Expand `tests/e2e/full-lifecycle.test.ts`.
  - Create prompts in workspace A and workspace B.
  - Verify audit logs are scoped by workspace.
  - Verify cross-tenant isolation for list/get endpoints.
  - Estimated: 2 hours

#### Coverage validation

- [ ] **ISSUE-#62j** Run `npm test -- --coverage` and verify overall line coverage is >= 85%.
  - If short, diagnose which files still have gaps and add targeted tests.
  - Estimated: 1 hour

- [ ] **ISSUE-#62k** Run `npm run lint` and `npm run build` to ensure no TypeScript or lint errors from new test files.
  - Estimated: 30 min

- [ ] **ISSUE-#62l** Commit: `git commit -m "test: expand coverage for rate-limit, cache, postgres adapter, github driver, and middleware"`
  - Estimated: 15 min

---

## Cross-Cutting Tasks

- [ ] **XCT-1** Run `npm run lint` and `npm run lint:fix` across all modified files in Sprint 1-3.
- [ ] **XCT-2** Run `npm run format` to ensure consistent code style.
- [ ] **XCT-3** Update `.env.example` with any new configuration variables introduced (e.g., `PROMPT_RECONCILE_INTERVAL_MS`).
- [ ] **XCT-4** Update `README.md` if new background jobs or environment variables are added.
- [ ] **XCT-5** Ensure all new test files have the standard license header (if applicable).
- [ ] **XCT-6** Review all ADRs added during sprints for completeness and sign-off.

---

## Dependency Graph

```
Sprint 1 (#31)
  |
  v
Sprint 2 (#41) -- requires migration 007 to be applied before 008
  |
  v
Sprint 3 (#62) -- tests should validate #31 and #41 fixes
```

## Release Checklist

- [ ] **REL-1** Sprint 1 merged to `main` and tagged as `v1.0.11-rc1`.
- [ ] **REL-2** Sprint 2 merged to `main` and tagged as `v1.0.11-rc2`.
- [ ] **REL-3** Sprint 3 merged to `main` and tagged as `v1.0.11-rc3`.
- [ ] **REL-4** Full CI pass (unit, integration, E2E) on `main` with both SQLite and PostgreSQL backends.
- [ ] **REL-5** Coverage gate passes at >= 85% lines.
- [ ] **REL-6** `npm run build` succeeds with zero errors.
- [ ] **REL-7** `npm run lint` passes.
- [ ] **REL-8** Update `CHANGELOG.md` with issue references #31, #41, #62.
- [ ] **REL-9** Update `package.json` version to `1.0.11`.
- [ ] **REL-10** Create GitHub Release with release notes.

---

*Task list generated on 2026-04-28.*
