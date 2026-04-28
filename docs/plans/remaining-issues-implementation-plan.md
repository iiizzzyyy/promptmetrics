# Remaining Open Issues — Implementation Plan

**Repository:** `iiizzzyyy/promptmetrics`
**Date:** 2026-04-28
**Status:** Proposed
**Scope:** Issues #31, #41, #62

---

## How to Read This Plan

Each issue section follows the Architecture Decision Record (ADR) format:
- **Context** — What is motivating the decision?
- **Decision** — What change is being proposed?
- **Consequences** — What becomes easier or harder?
- **Files affected, migration strategy, test strategy, rollback plan, and estimated effort**

---

# ADR-007: PostgreSQL integer overflow in rate_limits.window_start

## Status
Proposed

## Context

The `rate_limits` table stores per-API-key sliding-window counters. The initial migration (`001_initial_schema.ts`) defines `window_start INTEGER NOT NULL`.

- **SQLite:** `INTEGER` is dynamically typed and can store 64-bit signed values. It already handles millisecond timestamps without issue.
- **PostgreSQL:** `INTEGER` is a fixed 32-bit signed type (`-2,147,483,648` to `2,147,483,647`). The middleware computes `windowStart = Math.floor(Date.now() / windowMs) * windowMs`. When `windowMs = 60_000`, `windowStart` is approximately `1,700,000,000,000` (1.7 trillion), which overflows PostgreSQL `INTEGER` by three orders of magnitude. This causes every rate-limit write to fail on PostgreSQL.

Existing SQLite deployments must work unchanged. Existing PostgreSQL deployments already have the table created, so a new migration is required.

## Decision

1. **Update `001_initial_schema.ts`** to use `BIGINT` for `rate_limits.window_start` when the dialect is PostgreSQL, and `INTEGER` when the dialect is SQLite. This only affects fresh databases.
2. **Add migration `007_alter_rate_limits_window_start.ts`** that alters the column type on existing PostgreSQL deployments. For SQLite, the migration is a no-op because `INTEGER` is already 64-bit capable.

### Migration approach

| Dialect | Action | Rationale |
|---------|--------|-----------|
| PostgreSQL | `ALTER TABLE rate_limits ALTER COLUMN window_start TYPE BIGINT;` | Native DDL, atomic, no data loss needed |
| SQLite | No-op (return immediately) | SQLite `INTEGER` already stores up to 8 bytes; no type change is semantically meaningful |

The `rate_limits` table is ephemeral (rows live only for the duration of a window), so data migration is unnecessary.

### Dialect helper

Add a new helper `windowStartColumn(dialect)` in `migrations/dialect-helpers.ts`:

```typescript
export function windowStartColumn(dialect: 'sqlite' | 'postgres'): string {
  return dialect === 'postgres' ? 'BIGINT' : 'INTEGER';
}
```

Update `001_initial_schema.ts` line 129:

```sql
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_start ${windowStartColumn(d)} NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);
```

### Middleware validation

No middleware logic change is required. The `windowStart` value is already computed in milliseconds; the column simply needs to be wide enough to store it.

## Consequences

**Easier:**
- PostgreSQL rate limiting works out of the box.
- Fresh PostgreSQL databases get the correct schema automatically.

**Harder:**
- One more dialect-specific branch in migrations to maintain.
- umzug must run migration `007` on existing PostgreSQL deployments; if it is skipped, the overflow remains.

## Trade-off Matrix

| Approach | New migration | Fix in 001 only | Drop + recreate table |
|----------|---------------|-----------------|---------------------|
| Affects existing Postgres | Yes | No | Yes |
| Affects existing SQLite | No | No | No |
| Data migration needed | No | No | No |
| Risk of drift | Low | High (001 vs runtime) | Low |
| **Chosen** | **Yes** | — | — |

## Files Affected

- `migrations/dialect-helpers.ts` — add `windowStartColumn()`
- `migrations/001_initial_schema.ts` — use `windowStartColumn(d)` for `rate_limits.window_start`
- `migrations/007_alter_rate_limits_window_start.ts` — new migration (PostgreSQL only)

## Test Strategy

1. **Unit test** for `windowStartColumn()` helper asserting correct strings per dialect.
2. **Integration test** for `checkSqliteRateLimit` asserting that `window_start` values > 2^31 insert cleanly into SQLite (regression guard).
3. **Integration test** for PostgreSQL adapter: create a `rate_limits` row with `window_start = 1_700_000_000_000` and assert no error. This requires a PostgreSQL container or a mocked `pg` Pool that validates parameter types.
4. **Migration test** asserting `007` runs successfully against both dialects and is a no-op on SQLite.

## Rollback Plan

1. Revert `migrations/001_initial_schema.ts` to `INTEGER` unconditionally.
2. Delete `migrations/007_alter_rate_limits_window_start.ts`.
3. Run `npm run migrate` down to `006` on affected PostgreSQL deployments, then up to `006` again. Note: this will drop the widened column back to `INTEGER` and will re-break rate limiting on PostgreSQL.

## Estimated Effort

- Implementation: 2 hours
- Testing: 2 hours
- Review & merge: 1 hour
- **Total: 5 hours**

---

# ADR-008: PromptService.createPrompt() non-atomic two-phase write

## Status
Proposed

## Context

`PromptService.createPrompt()` executes three sequential operations:

1. `driver.createPrompt(prompt)` — writes to storage (filesystem/GitHub/S3) and upserts a row into the DB index.
2. `db.prepare('UPDATE prompts SET workspace_id = ? ...').run(...)` — sets the workspace association.
3. `invalidatePrompt(...)` — clears the cache.

If step 2 fails (DB connection lost, constraint violation, disk full), the prompt exists in storage and in the DB index but with `workspace_id = NULL`. The API cannot locate it via workspace-scoped queries, effectively orphaning it.

The `PromptDriver` interface does not expose a `deletePrompt` method, so immediate storage-side compensation is not possible from `PromptService`.

## Decision

**Adopt Option 1 (Pending/Active state machine) with a lightweight reconciliation job.**

### Why Option 1 over the alternatives

| Criterion | Option 1: State machine | Option 2: Reverse order | Option 4: Compensating delete |
|-----------|------------------------|-------------------------|-------------------------------|
| Crash recovery | **Yes** (reconciliation job) | No (orphan DB row) | **Partial** (delete may fail) |
| Driver interface changes | None | None | Requires `deletePrompt` on interface |
| Background job needed | **Yes** (reuses existing job pattern) | No | No |
| Schema change | `status` column | None | None |
| Query changes | Filter by `status = 'active'` | None | None |
| Orphan location | DB index (easy to clean) | DB index | Storage (hard to clean) |

**Rejected:**
- **Option 2 (Reverse order):** If the server crashes after DB INSERT but before driver.write, the DB row is a permanent orphan. There is no recovery mechanism.
- **Option 3 (Two-phase commit):** Not practical because GitHub API does not support transactions or prepare/rollback semantics.
- **Option 4 (Compensating transaction):** Requires adding `deletePrompt` to `PromptDriver`, which is a breaking interface change for three drivers plus tests. Even then, `driver.delete()` can fail (network, permissions), leaving a storage orphan that is invisible to the API.

### Implementation design

**Migration 008:** Add `status TEXT NOT NULL DEFAULT 'active'` to the `prompts` table.

**PromptService.createPrompt() flow:**

```
1. DB INSERT INTO prompts (name, version_tag, workspace_id, driver, status, created_at)
   VALUES (... , 'pending', ...)
   ON CONFLICT(name, version_tag) DO UPDATE SET
     workspace_id = excluded.workspace_id,
     status = 'pending',
     driver = excluded.driver;

2. driver.createPrompt(prompt)
   ( driver's internal upsert updates fs_path, commit_sha, etc.
     workspace_id and status are preserved from step 1 because
     the driver's ON CONFLICT clause does not touch them. )

3. UPDATE prompts SET status = 'active'
   WHERE name = ? AND version_tag = ?

4. On any error in steps 2-3, the row remains 'pending'.
   Reconciliation job heals it later.
```

**Query updates:**
- `listPrompts`: add `AND status = 'active'` to the WHERE clause.
- `listVersions`: add `AND status = 'active'`.
- `getPrompt` membership check: add `AND status = 'active'` (a pending prompt should not be readable until the full write is confirmed).

**PromptReconciliationJob:**
- Runs every 60 seconds (configurable via `PROMPT_RECONCILE_INTERVAL_MS`).
- Query: `SELECT name, version_tag, driver FROM prompts WHERE status = 'pending' AND created_at < ?` (older than 2 minutes).
- For each pending prompt:
  - Call `driver.getPrompt(name, version_tag)`.
  - If found: `UPDATE prompts SET status = 'active' WHERE name = ? AND version_tag = ?`.
  - If not found: `DELETE FROM prompts WHERE name = ? AND version_tag = ?`.
- Job starts in `server.ts` alongside `GitSyncJob`.

### Edge cases handled

| Scenario | Outcome |
|----------|---------|
| DB INSERT succeeds, driver.write fails | Pending row exists; reconciliation deletes it after 2 minutes |
| DB INSERT succeeds, driver.write succeeds, UPDATE 'active' fails | Pending row exists with content; reconciliation promotes it to active |
| Server crashes between step 1 and step 3 | Pending row exists; reconciliation heals on next run |
| Driver.write succeeds, driver's own DB upsert fails | PromptService's INSERT already created the row; reconciliation promotes it |
| Reconciliation job finds prompt but DB UPDATE fails | Row stays pending; job retries on next interval |

## Consequences

**Easier:**
- All failure modes are observable via the `status` column.
- Crash recovery is automatic; no manual intervention needed.
- Reuses the existing background job infrastructure (`GitSyncJob` pattern).

**Harder:**
- All prompt-reading queries must include `status = 'active'`.
- A new background job adds operational surface area (must be monitored).
- Prompt creation has a 2-minute window where a failure could make the prompt invisible to list/get operations until reconciliation runs.

## Files Affected

- `migrations/008_add_prompt_status.ts` — new migration
- `src/services/prompt.service.ts` — rewrite `createPrompt()`, add `status` filters to queries
- `src/jobs/promptmetrics-reconciliation.job.ts` — new background job
- `src/server.ts` — start reconciliation job on boot
- `src/models/promptmetrics-sqlite.ts` — no changes needed

## Test Strategy

1. **Unit test** for `PromptReconciliationJob` logic:
   - Mock driver.getPrompt returning content → assert row updated to 'active'.
   - Mock driver.getPrompt returning undefined → assert row deleted.
2. **Integration test** in `tests/integration/prompt-transaction.test.ts`:
   - Simulate DB failure after driver.write (mock `db.prepare(...).run` to throw after the driver succeeds).
   - Assert prompt row has `status = 'pending'`.
   - Trigger reconciliation manually.
   - Assert prompt is either promoted to 'active' (if content exists) or deleted.
3. **Integration test** for list/get queries:
   - Insert a row with `status = 'pending'`.
   - Assert `listPrompts` and `getPrompt` exclude it.
4. **E2E test** covering full create-lifecycle with each driver type (filesystem, GitHub, S3):
   - Create prompt.
   - Immediately list and get.
   - Assert no orphaned prompts remain after reconciliation window.

## Rollback Plan

1. Revert `PromptService` to the original flow (driver.write → UPDATE workspace_id).
2. Remove `status` filtering from queries.
3. Stop `PromptReconciliationJob` in `server.ts`.
4. Run `npm run migrate` down to `007` to drop the `status` column.
5. **Caution:** Any prompts created while `008` was active that have `status = 'pending'` will become visible to queries after rollback (since the column will be gone and the default will not apply). Run the reconciliation job one final time before rollback to ensure no pending rows remain.

## Estimated Effort

- Migration + schema changes: 2 hours
- PromptService refactoring + query updates: 3 hours
- Reconciliation job: 3 hours
- Tests (unit + integration + E2E): 4 hours
- Review & merge: 2 hours
- **Total: 14 hours**

---

# ADR-009: Test coverage expansion to 85%+

## Status
Proposed

## Context

Current line coverage: **82.61%**. Target: **85%+**. The gap is approximately 2.4 percentage points.

Coverage is highly uneven. Several critical production paths have very low coverage:

| File | Lines % | Uncovered lines | Critical? |
|------|---------|-----------------|-----------|
| `src/models/postgres.adapter.ts` | 3.84 | ~125 | Yes (PostgreSQL deployments) |
| `src/drivers/promptmetrics-github-driver.ts` | 42.24 | ~150 | Yes (GitHub driver users) |
| `src/middlewares/rate-limit-per-key.middleware.ts` | 56.94 | ~65 | Yes (production rate limiting) |
| `src/services/cache.service.ts` | 44.18 | ~45 | Yes (cache fallback paths) |
| `src/middlewares/promptmetrics-error-handler.middleware.ts` | 63.63 | ~16 | Yes (user-facing errors) |
| `src/utils/promptmetrics-shutdown.ts` | 22.72 | ~37 | Medium (graceful shutdown) |

## Decision

**Prioritize by effort-to-value ratio, not by file order.** We need approximately 75 additional covered lines to reach 85%. The plan targets ~150 lines to provide a comfortable margin.

### Tier 1 — Critical path, high impact (~90 min)

These files are small, easily mockable, and cover production-critical paths.

1. **`src/middlewares/promptmetrics-error-handler.middleware.ts`**
   - Add unit tests for `SyntaxError` handling, `AppError` serialization, and production 500 masking.
   - Expected new coverage: ~16 lines.

2. **`src/services/cache.service.ts`**
   - Add unit tests for Redis path, `JSON.parse` failure (cache miss fallback), and TTL eviction.
   - Expected new coverage: ~35 lines.

3. **`src/middlewares/rate-limit-per-key.middleware.ts`**
   - Add unit tests for the Redis path (mock `ioredis` pipeline), the `getDbOrNull()` error fallback, and header-setting logic.
   - Expected new coverage: ~45 lines.

### Tier 2 — Driver and adapter expansion (~4 hours)

4. **`src/drivers/promptmetrics-github-driver.ts`**
   - Expand `tests/unit/github-driver.test.ts` to cover:
     - `getPrompt` success and 404 paths (mock filesystem + git calls).
     - `listPrompts` pagination.
     - `listVersions` DB query.
     - `sync` and `search`.
     - Revert logic on DB failure (mock GitHub DELETE API).
   - Expected new coverage: ~50 lines.

5. **`src/models/postgres.adapter.ts`**
   - Add `tests/unit/postgres.adapter.test.ts` with a mocked `pg` Pool:
     - Placeholder rewriting (`?` -> `$1, $2`).
     - `lastInsertRowid` after INSERT with `RETURNING id`.
     - Transaction commit and rollback.
     - `pool.on('error')` handler.
   - Expected new coverage: ~50 lines.

### Tier 3 — Integration and E2E validation (~3 hours)

6. **`tests/integration/rate-limit-redis.test.ts`**
   - Mock `ioredis` to test the Redis-backed rate-limit path under normal and failure conditions (pipeline error).

7. **`tests/integration/webhook.test.ts`**
   - Add cases for invalid signatures, missing `x-hub-signature-256`, non-push events.

8. **`tests/e2e/full-lifecycle.test.ts`**
   - Extend to cover workspace-isolated audit logs (create prompts in workspace A and B, verify audit logs are scoped).

9. **`tests/unit/s3-driver.test.ts`**
   - Add path-traversal tests for malicious prompt names (`../etc/passwd`).

### What NOT to test (low value / high effort)

- `src/cli/promptmetrics-cli.ts` and `src/scripts/**` are excluded from coverage collection (`collectCoverageFrom` already ignores them).
- `src/utils/promptmetrics-shutdown.ts` signal handlers are hard to test in Jest without process-level mocking; skip unless time permits.
- `promptmetrics-logger.service.ts` is a thin wrapper around `console`; not worth extensive mocking.

## Consequences

**Easier:**
- Confidence in PostgreSQL, Redis, and GitHub driver paths.
- CI gate can enforce 85% minimum coverage.

**Harder:**
- Mocking `pg` Pool and `ioredis` pipeline requires careful setup to avoid brittle tests.
- GitHub driver tests need `nock` setup for multiple API endpoints per test.

## Files Affected

- `tests/unit/error-handler.middleware.test.ts` — new
- `tests/unit/cache.service.test.ts` — expand existing
- `tests/unit/rate-limit-per-key.middleware.test.ts` — new
- `tests/unit/github-driver.test.ts` — expand existing
- `tests/unit/postgres.adapter.test.ts` — new
- `tests/unit/s3-driver.test.ts` — expand existing
- `tests/integration/rate-limit-redis.test.ts` — new
- `tests/integration/webhook.test.ts` — expand existing
- `tests/e2e/full-lifecycle.test.ts` — expand existing

## Test Strategy

- **Unit tests:** Mock external dependencies (Redis, S3, GitHub API, `pg` Pool). Test in isolation with no DB.
- **Integration tests:** Spin up Express app via `supertest`. Use isolated SQLite DBs per test file. Mock Redis with `ioredis-mock` or manual Jest mocks.
- **E2E tests:** Run full lifecycle with real filesystem driver and SQLite DB.

## Rollback Plan

- Remove or skip new test files. No production code is changed, so rollback is trivial.
- If new tests are flaky, mark them with `.skip` and file a follow-up issue.

## Estimated Effort

- Tier 1 (unit tests): 3 hours
- Tier 2 (driver/adapter tests): 4 hours
- Tier 3 (integration/E2E tests): 3 hours
- Review & CI tuning: 2 hours
- **Total: 12 hours**

---

## Cross-Cutting Concerns

### Migration ordering

| Migration | Issue | Dialect impact |
|-----------|-------|----------------|
| `007_alter_rate_limits_window_start.ts` | #31 | PostgreSQL only |
| `008_add_prompt_status.ts` | #41 | Both |

Both must run in order. umzug handles this natively.

### Dependency graph

```
#31 (rate_limits BIGINT)
  |
  v
#41 (prompt status) -- depends on migration 007 being applied first
  |
  v
#62 (test coverage) -- should validate both #31 and #41 fixes
```

### Acceptance criteria for all three issues

- [ ] `npm run build` succeeds with zero TypeScript errors.
- [ ] `npm run lint` passes.
- [ ] `npm test` reports >= 85% line coverage.
- [ ] All new tests pass against SQLite.
- [ ] All new tests pass against PostgreSQL (in CI or locally with `docker-compose.postgres.yml`).
- [ ] No regressions in existing 232 tests.

---

*Plan generated on 2026-04-28.*
