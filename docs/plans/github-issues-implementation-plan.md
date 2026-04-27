# PromptMetrics Open GitHub Issues — Comprehensive Implementation Plan

**Repository:** `iiizzzyyy/promptmetrics`
**Date:** 2026-04-27
**Total Open Issues:** 32 (#31–#62)
**Plan Version:** 1.0

---

## 1. Executive Summary

This plan covers all 32 open issues in the promptmetrics repository, grouped into 7 logical sprints. The highest priority is restoring PostgreSQL compatibility (#31–#32, #40), hardening the rate-limiting layer (#34–#35, #45), and fixing GitHub driver race conditions and security (#33, #36–#37). Lower-priority sprints address middleware hardening, migration safety, route architecture, and test coverage gaps.

**Key dependencies:**
- Sprint 1 must complete before Sprint 4 (rate-limit key naming depends on atomic SQLite path).
- Sprint 2 must complete before Sprint 5 (GitHub driver fixes must land before testing revert logic).
- Sprint 7 (test coverage) should start after Sprint 5 so that new tests can validate the fixes above.

---

## 2. Sprint Overview

| Sprint | Theme | Issues | Est. Duration |
|--------|-------|--------|---------------|
| **1** | PostgreSQL & Rate-Limit Stability | #31, #32, #34, #35, #40 | 3–4 days |
| **2** | GitHub Driver Reliability & Security | #33, #36, #37, #44, #59 | 3–4 days |
| **3** | Cache, Redis, and Audit Infrastructure | #38, #39, #42, #57 | 2–3 days |
| **4** | Data Integrity & Middleware Hardening | #41, #45, #46, #47, #50, #52, #53 | 4–5 days |
| **5** | Migration Safety & Test Flakiness | #43, #48, #49, #60 | 2–3 days |
| **6** | Routes, Config, Types & Performance | #51, #54, #55, #56, #58, #61 | 2–3 days |
| **7** | Test Coverage Expansion | #62 | 3–4 days |

---

## 3. Sprint 1: PostgreSQL & Rate-Limit Stability

### #31 — PostgreSQL integer overflow in rate_limits.window_start (Additional Critical)
**Severity:** Critical | **Introduced:** v1.0.9

- **Files:** `migrations/001_initial_schema.ts`, new `migrations/007_fix_rate_limits_window_start.ts`, `src/middlewares/rate-limit-per-key.middleware.ts`
- **Change:**
  1. Update `001_initial_schema.ts` to use `BIGINT` for `window_start` under PostgreSQL via the existing `dialect-helpers.ts` conditional. SQLite can keep `INTEGER` (it is already 64-bit).
  2. Add migration `007_fix_rate_limits_window_start.ts` that runs `ALTER TABLE rate_limits ALTER COLUMN window_start TYPE BIGINT` when `db.dialect === 'postgres'`. Since `rate_limits` data is ephemeral, no data migration is needed.
  3. In `rate-limit-per-key.middleware.ts`, ensure the middleware still computes `windowStart` in milliseconds but stores it correctly in the widened column.
- **Effort:** Medium
- **New Tests:** Yes — integration test that verifies `INSERT INTO rate_limits` with a millisecond timestamp succeeds under the Postgres adapter.

### #32 — Postgres lastInsertRowid always returns 0
**Severity:** Critical | **Introduced:** v1.0.7

- **Files:** `src/models/postgres.adapter.ts`
- **Change:** In `PostgresPreparedStatement.run()` (and `TransactionPreparedStatement.run()`), detect `INSERT` statements that do not already contain a `RETURNING` clause. Rewrite the SQL to append `RETURNING id` so that `result.rows[0]?.id` is populated. Use a regex like `/^\s*INSERT\b/i` and a negative check for `/RETURNING\b/i`.
  ```ts
  const needsReturning = /^\s*INSERT\b/i.test(sql) && !/RETURNING\b/i.test(sql);
  const finalSql = needsReturning ? `${sql} RETURNING id` : sql;
  ```
- **Dependencies:** Must be fixed before #62 can validate Postgres create operations.
- **Effort:** Small
- **New Tests:** Yes — unit test for `PostgresPreparedStatement.run()` asserting `lastInsertRowid > 0` after an `INSERT INTO api_keys`.

### #34 — Redis rate-limit ignores EXPIRE failures
**Severity:** Critical | **Introduced:** v1.0.1

- **Files:** `src/middlewares/rate-limit-per-key.middleware.ts`
- **Change:** In `checkRedisRateLimit`, after `pipeline.exec()`, validate both command results (`results[0]` and `results[1]`). If EXPIRE fails (result is not `1` or contains an error), retry `redis.expire(key, ttlSeconds)` once. If it still fails, log an error but do not permanently block the key — treat the request as within limit and set headers accordingly. Alternatively, replace the pipeline with a Lua script that performs `INCR` + `EXPIRE` atomically.
- **Effort:** Small
- **New Tests:** Yes — mock Redis pipeline to simulate EXPIRE failure and assert the request is not permanently rate-limited.

### #35 — SQLite rate-limit read-modify-write race condition
**Severity:** Critical | **Introduced:** v1.0.1

- **Files:** `src/middlewares/rate-limit-per-key.middleware.ts`
- **Change:** In `checkSqliteRateLimit`, replace the separate `SELECT` + `UPDATE` increment path with a single atomic `UPDATE ... SET count = count + 1 WHERE key = ? AND count < ?`, then check `result.changes`. If `changes === 0`, either the key hit the limit or does not exist; fall back to the existing `INSERT ... ON CONFLICT` path for initialization. This eliminates the TOCTOU window.
- **Dependencies:** Must land before or with #45 because both touch the same middleware.
- **Effort:** Small
- **New Tests:** Yes — integration test that fires concurrent requests against the same key and asserts none exceed `maxRequests`.

### #40 — PostgresAdapter missing pool error handler
**Severity:** High | **Introduced:** v1.0.7

- **Files:** `src/models/postgres.adapter.ts`
- **Change:** In the constructor, after `this.pool = new Pool(...)`, add:
  ```ts
  this.pool.on('error', (err) => {
    console.error('Postgres pool error:', err);
  });
  ```
- **Effort:** Small
- **New Tests:** Yes — unit test that emits an error on a mock pool and asserts it is caught.

---

## 4. Sprint 2: GitHub Driver Reliability & Security

### #33 — GithubDriver missing await on async ensureCloned()
**Severity:** Critical | **Introduced:** v1.0.0

- **Files:** `src/drivers/promptmetrics-github-driver.ts`
- **Change:** Add `await` to the `this.ensureCloned()` calls on lines 55 (`listPrompts`) and 97 (`getPrompt`).
- **Dependencies:** Should be fixed before #36 (revert logic depends on `getPrompt` and `listPrompts` behaving deterministically).
- **Effort:** Small
- **New Tests:** Yes — unit test that asserts `simpleGit.clone` is awaited before any filesystem reads.

### #37 — GithubDriver embeds token in clone URL
**Severity:** High | **Introduced:** v1.0.0

- **Files:** `src/drivers/promptmetrics-github-driver.ts`
- **Change:** Replace the URL-embedded token (`https://${token}@github.com/...`) with a credential helper or `GIT_ASKPASS` approach. Recommended implementation:
  1. Write a temporary executable script that echoes the token.
  2. Use `simpleGit().env({ GIT_ASKPASS: scriptPath, GIT_USERNAME: 'x-access-token' }).clone(...)`.
  3. Delete the script after clone completes.
  Alternatively, use `git.clone` with `--config http.extraheader="Authorization: token ${token}"`.
- **Effort:** Medium
- **New Tests:** Yes — assert that the clone command does not contain the raw token.

### #36 — GithubDriver.createPrompt() revert uses incorrect SHA
**Severity:** High | **Introduced:** v1.0.0

- **Files:** `src/drivers/promptmetrics-github-driver.ts`
- **Change:**
  1. Modify `createGithubContent` to return the blob SHA from the GitHub API PUT response (response.data.content.sha).
  2. In `createPrompt`, capture the returned SHA after the circuit-breaker fire succeeds.
  3. Use the captured blob SHA in the revert DELETE request instead of `existingSha || (await this.getLatestSha()) || ''`.
- **Effort:** Medium
- **New Tests:** Yes — mock GitHub API to return a SHA, force a DB failure, and assert the DELETE request uses the returned blob SHA.

### #44 — S3Driver lacks prompt name validation
**Severity:** Medium | **Introduced:** v1.0.1

- **Files:** `src/drivers/promptmetrics-s3-driver.ts`
- **Change:** Copy the `validateName()` method from `FilesystemDriver` into `S3Driver`. Call it in `getPrompt`, `createPrompt`, `listVersions`, and `search` before constructing S3 object keys.
- **Effort:** Small
- **New Tests:** Yes — assert that `createPrompt` with a malicious name throws before any S3 call.

### #59 — GithubDriver.getPrompt catches all errors silently
**Severity:** Low | **Introduced:** v1.0.0

- **Files:** `src/drivers/promptmetrics-github-driver.ts`
- **Change:** In `getPrompt`, replace the bare `catch { return undefined; }` with:
  ```ts
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return undefined;
    }
    console.error(`GithubDriver.getPrompt failed for ${name}:`, err);
    return undefined;
  }
  ```
- **Effort:** Small
- **New Tests:** Yes — mock `fs.readFileSync` to throw `ENOENT` vs. `EACCES` and assert logging behavior.

---

## 5. Sprint 3: Cache, Redis, and Audit Infrastructure

### #38 — CacheService JSON.parse crashes on corrupted Redis data
**Severity:** High | **Introduced:** v1.0.1

- **Files:** `src/services/cache.service.ts`
- **Change:** Wrap `JSON.parse(raw)` inside `getCachedPrompt` in a `try/catch`. On `SyntaxError`, treat as a cache miss (`return undefined`) and optionally delete the corrupted key from Redis.
- **Effort:** Small
- **New Tests:** Yes — mock Redis `get` to return invalid JSON and assert no throw + cache miss behavior.

### #39 — getRedisClient() connection leak on concurrent cold-start access
**Severity:** High | **Introduced:** v1.0.1

- **Files:** `src/services/redis.service.ts`
- **Change:** Condense the null-check and assignment into a single expression to remove the microscopic race window:
  ```ts
  export function getRedisClient(): Redis | null {
    if (redisClient) return redisClient;
    if (!process.env.REDIS_URL) return null;
    redisClient = new Redis(process.env.REDIS_URL);
    return redisClient;
  }
  ```
  For extra safety, also add `closeRedis()` cleanup in test teardown.
- **Effort:** Small
- **New Tests:** Yes — mock concurrent `getRedisClient()` calls and assert only one `new Redis()` instantiation.

### #42 — Audit log fire-and-forget on buffer full silently drops audit entries
**Severity:** High | **Introduced:** v1.0.0

- **Files:** `src/services/audit-log.service.ts`, optionally `src/app.ts` (for metrics endpoint)
- **Change:**
  1. In `enqueue`, when `buffer.length >= maxBufferSize`, wrap `flush()` in a retry loop (max 3 attempts with 100ms delay).
  2. If all retries fail, increment an internal `droppedCount` counter.
  3. Expose the dropped counter via a new `AuditLogService.getMetrics()` method so it can be logged or scraped.
- **Effort:** Medium
- **New Tests:** Yes — mock `db.prepare(...).run(...)` to throw and assert retry behavior + dropped counter increment.

### #57 — auditLog middleware may enqueue extremely large values
**Severity:** Low | **Introduced:** v1.0.0

- **Files:** `src/middlewares/promptmetrics-audit.middleware.ts`
- **Change:** Truncate `promptName` and `versionTag` to 256 characters before enqueueing. Add a utility `truncate(str, maxLen)` or inline `slice(0, 256)`.
- **Effort:** Small
- **New Tests:** Yes — pass a body with a 10,000-character name and assert the enqueued entry is truncated.

---

## 6. Sprint 4: Data Integrity & Middleware Hardening

### #41 — PromptService.createPrompt() non-atomic two-phase write
**Severity:** High | **Introduced:** v1.0.0

- **Files:** `src/services/prompt.service.ts`, `src/drivers/promptmetrics-driver.interface.ts`, all driver implementations
- **Change:** The safest fix is to add `deletePrompt(name: string, version: string): Promise<void>` to the `PromptDriver` interface, implement it for `FilesystemDriver` (delete file), `GithubDriver` (DELETE contents API), and `S3Driver` (DeleteObject). Then in `PromptService.createPrompt`:
  1. Call `driver.createPrompt(prompt)`.
  2. In a `try/catch`, call `db.prepare(...).run(...)`.
  3. On DB failure, call `driver.deletePrompt(prompt.name, prompt.version)` and rethrow.
- **Alternative (lighter):** If adding `deletePrompt` is too large for this sprint, change the order: write DB row first, then write to driver. If driver fails, delete the DB row. This prevents orphaned prompts in storage but may leave orphaned DB rows briefly.
- **Dependencies:** Depends on driver interface changes. Should be done after Sprint 2 (GitHub driver is stable).
- **Effort:** Large
- **New Tests:** Yes — integration test that mocks DB failure after a successful driver write and asserts the storage is reverted.

### #45 — Rate-limit counters shared by key name, not key hash
**Severity:** Medium | **Introduced:** v1.0.1

- **Files:** `src/middlewares/rate-limit-per-key.middleware.ts`, `src/middlewares/promptmetrics-auth.middleware.ts` (for hashApiKey export)
- **Change:** Change the rate-limit key from `${workspaceId}:${apiKeyName}` to `${workspaceId}:${hashApiKey(apiKeyValue)}`. Since the raw API key value is available in `req.headers['x-api-key']`, hash it with the existing `hashApiKey` function. This ensures two keys with the same name do not share a bucket.
- **Dependencies:** Must land alongside #35 because both modify the same middleware.
- **Effort:** Small
- **New Tests:** Yes — integration test that creates two API keys with the same name and asserts they have independent rate-limit counters.

### #46 — PromptService.listPrompts search query unbounded length
**Severity:** Medium | **Introduced:** v1.0.0

- **Files:** `src/controllers/promptmetrics-prompt.controller.ts`
- **Change:** Before passing `query` to `listPrompts`, validate length. If `query.length > 256`, throw `AppError.badRequest('Search query too long')`.
- **Effort:** Small
- **New Tests:** Yes — integration test with a 300-character query asserting HTTP 400.

### #47 — PromptController.getPrompt accepts body on GET request
**Severity:** Medium | **Introduced:** v1.0.0

- **Files:** `src/controllers/promptmetrics-prompt.controller.ts`
- **Change:** Remove lines 37–39 (the `req.body.variables` fallback). GET requests should only read variables from query parameters. If clients need large variable payloads, they should use a documented POST endpoint or query parameters.
- **Effort:** Small
- **New Tests:** Yes — integration test that sends `variables` in a GET body and asserts they are ignored.

### #50 — validateQuery middleware mutates req.query via Object.defineProperty
**Severity:** Medium | **Introduced:** v1.0.0

- **Files:** `src/middlewares/promptmetrics-query-validation.middleware.ts`, `src/types/express.d.ts` (extend Request), all controllers reading `req.query`
- **Change:**
  1. In `validateQuery`, assign `req.validatedQuery = value` instead of redefining `req.query`.
  2. Extend the Express `Request` interface to include `validatedQuery?: Record<string, unknown>`.
  3. Update all controllers that rely on validated query data to read from `req.validatedQuery` (or keep reading `req.query` if the mutation was only for Joi-casting). A safer minimal change: keep `req.query` mutation but deep-freeze the value first, or clone it. Given the issue explicitly requests `req.validatedQuery`, implement that.
- **Affected Controllers:** `promptmetrics-prompt.controller.ts` (page, limit, q, version), `promptmetrics-prompt.route.ts` (audit-logs pagination).
- **Effort:** Medium
- **New Tests:** Yes — unit test asserting `req.query` remains the original object after validation.

### #52 — config.ts missing API_KEY_SALT length validation
**Severity:** Medium | **Introduced:** v1.0.0

- **Files:** `src/config/index.ts`
- **Change:** After reading `API_KEY_SALT`, validate `apiKeySalt.length >= 16`. If not, throw a clear startup error: `API_KEY_SALT must be at least 16 characters`.
- **Effort:** Small
- **New Tests:** Yes — unit test mocking `process.env.API_KEY_SALT = 'short'` and asserting startup throws.

### #53 — tenantMiddleware blindly trusts X-Workspace-Id header
**Severity:** Medium | **Introduced:** v1.0.1

- **Files:** `src/middlewares/tenant.middleware.ts`
- **Change:** Validate `workspaceId`: max length 128, regex `/^[a-zA-Z0-9_\-]+$/`. If invalid, set `req.workspaceId = 'default'` or throw `AppError.badRequest('Invalid workspace ID')`. The safer choice for backward compatibility is to sanitize and log, but the issue implies rejection is acceptable.
- **Effort:** Small
- **New Tests:** Yes — integration tests with overlong and malformed workspace IDs.

---

## 7. Sprint 5: Migration Safety & Test Flakiness

### #43 — Tests use unawaited DB calls in beforeAll blocks
**Severity:** High | **Introduced:** v1.0.0

- **Files:** `tests/integration/auth.test.ts`, `tests/integration/rate-limit.test.ts`, `tests/integration/tenant.test.ts`, `tests/integration/traces.test.ts`, `tests/integration/api-keys.test.ts`, `tests/integration/prompt-transaction.test.ts`
- **Change:** Audit every `beforeAll` and `beforeEach` block. Add `await` to every `db.prepare(...).run(...)` call. Also audit `afterAll` blocks for missing `await` on cleanup.
- **Effort:** Small
- **New Tests:** No (fixes existing tests).

### #48 — Migration downgrades are not transaction-safe
**Severity:** Medium | **Introduced:** v1.0.7

- **Files:** `migrations/001_initial_schema.ts`, `migrations/004_add_evaluations.ts`
- **Change:** Wrap the `down()` implementations in `await db.transaction(async (trx) => { ... })`. Note: SQLite does not support transactional DDL rollback, but PostgreSQL does. The wrapper provides atomicity where supported and consistent behavior across adapters.
- **Effort:** Small
- **New Tests:** Yes — integration test that runs `umzug.down()` and verifies the schema is fully reverted.

### #49 — PostgresAdapter.transaction() loses original error if ROLLBACK throws
**Severity:** Medium | **Introduced:** v1.0.7

- **Files:** `src/models/postgres.adapter.ts`
- **Change:** In the `catch` block of `transaction`, wrap `client.query('ROLLBACK')` in an inner `try/catch`. If rollback fails, attach the rollback error to the original error via `(err as Error).cause = rollbackErr` (or a custom property) and throw the original error.
- **Effort:** Small
- **New Tests:** Yes — mock `client.query` so that `ROLLBACK` throws and assert the original error is preserved.

### #60 — FilesystemDriver.createPrompt withTransaction is redundant
**Severity:** Low | **Introduced:** v1.0.0

- **Files:** `src/drivers/promptmetrics-filesystem-driver.ts`
- **Change:** Remove `withTransaction(...)` wrapper around the single `INSERT ... ON CONFLICT` statement (lines 97–108). Call `db.prepare(...).run(...)` directly. This removes unnecessary `BEGIN...COMMIT` overhead.
- **Effort:** Small
- **New Tests:** No (behavioral no-op).

---

## 8. Sprint 6: Routes, Config, Types & Performance

### #51 — webhook.route.ts reads GITHUB_WEBHOOK_SECRET directly from process.env
**Severity:** Medium | **Introduced:** v1.0.1

- **Files:** `src/config/index.ts`, `src/routes/webhook.route.ts`
- **Change:**
  1. Add `githubWebhookSecret: getEnv('GITHUB_WEBHOOK_SECRET')` to the `config` object.
  2. In `webhook.route.ts`, replace `process.env.GITHUB_WEBHOOK_SECRET` with `config.githubWebhookSecret`.
- **Effort:** Small
- **New Tests:** Yes — unit test asserting the route reads from the config object.

### #54 — promptmetrics-prompt.route.ts mounts audit-logs endpoint in wrong route file
**Severity:** Medium | **Introduced:** v1.0.0

- **Files:** `src/routes/promptmetrics-prompt.route.ts`, new `src/routes/audit-log.route.ts`, `src/app.ts`
- **Change:**
  1. Create `src/routes/audit-log.route.ts` exporting `createAuditLogRoutes()` with the `/v1/audit-logs` GET handler.
  2. Remove the `/v1/audit-logs` block from `promptmetrics-prompt.route.ts`.
  3. Import and mount `createAuditLogRoutes()` in `src/app.ts` alongside the other routes.
- **Effort:** Small
- **New Tests:** Yes — integration test that `/v1/audit-logs` still responds correctly after the move.

### #55 — api-key.service.ts listApiKeys return type mismatch
**Severity:** Low | **Introduced:** v1.0.5

- **Files:** `src/services/api-key.service.ts`
- **Change:** The return type claims `PaginatedResponse<Omit<ApiKey, 'id'>>` but the mapper includes `id`. Change the return type to `PaginatedResponse<ApiKey>` to match the runtime shape.
- **Effort:** Small
- **New Tests:** No (type-only; TypeScript compiler validates).

### #56 — AppError missing toJSON / serialization support
**Severity:** Low | **Introduced:** v1.0.0

- **Files:** `src/errors/app.error.ts`
- **Change:** Add a `toJSON()` method:
  ```ts
  toJSON(): object {
    return {
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      details: this.details,
    };
  }
  ```
- **Effort:** Small
- **New Tests:** Yes — unit test asserting `JSON.stringify(new AppError(...))` includes all fields.

### #58 — run.service.ts dynamic SQL construction prevents prepared statement reuse
**Severity:** Low | **Introduced:** v1.0.0

- **Files:** `src/services/run.service.ts`, new `src/utils/sql-builder.ts`
- **Change:** Extract a `buildPartialUpdate(table, fields, whereColumns)` utility in `src/utils/sql-builder.ts` that safely builds a parameterized UPDATE string. Import it in `run.service.ts` to replace the inline `updates.join(', ')` logic. This centralizes auditing and makes the SQL easier to review, even though placeholders are already safe.
- **Effort:** Medium
- **New Tests:** Yes — unit tests for `buildPartialUpdate` asserting correct SQL and parameter ordering.

### #61 — package.json dotenv version typo
**Severity:** Low | **Introduced:** v1.0.0

- **Files:** `package.json`
- **Change:** Change the `dotenv` dependency from `^17.2.2` to `^16.4.5` (or the latest v16 patch).
- **Effort:** Small
- **New Tests:** No.

---

## 9. Sprint 7: Test Coverage Expansion

### #62 — Multiple test coverage gaps
**Severity:** Low | **Introduced:** v1.0.0

- **Files:** New and existing test files
- **Change:** Add targeted tests for the following uncovered paths:
  1. **PostgreSQL Adapter** (`tests/unit/postgres.adapter.test.ts`): verify placeholder rewriting (`?` to `$1`), `lastInsertRowid` after INSERT, and nested transaction rejection.
  2. **Redis Rate Limiting** (`tests/integration/rate-limit-redis.test.ts`): spin up Redis (or mock ioredis) and test the Redis-backed path end-to-end.
  3. **Webhook Security** (`tests/integration/webhook.test.ts`): add cases for invalid signatures, missing `x-hub-signature-256`, non-push events, and replayed payloads.
  4. **Driver Revert Logic** (`tests/integration/github-driver-revert.test.ts`): mock GitHub API and simulate DB failure during `createPrompt`, assert revert DELETE is issued.
  5. **Error Handler Middleware** (`tests/unit/error-handler.test.ts`): test `SyntaxError` handling, `AppError` serialization, and 500 masking in production.
  6. **Cache Corruption** (`tests/unit/cache.service.test.ts`): mock Redis to return non-JSON and assert cache miss.
  7. **Multi-Process Rate Limit** (`tests/integration/rate-limit-concurrency.test.ts`): fire concurrent requests and assert no TOCTOU breach.
  8. **S3 Path Traversal** (`tests/unit/s3-driver.test.ts`): assert malicious prompt names are rejected before S3 calls.
  9. **Workspace-Isolated Audit Logs** (`tests/e2e/full-lifecycle.test.ts` or `tests/integration/audit.test.ts`): create prompts in workspace A and B, verify audit logs are scoped.
- **Dependencies:** Should be executed after Sprint 1 (Postgres fixes), Sprint 2 (GitHub fixes), and Sprint 3 (cache/audit fixes) so that the new tests validate the actual fixes rather than masking them.
- **Effort:** Large
- **New Tests:** Yes (this sprint is entirely test additions).

---

## 10. Dependency Graph

```
Sprint 1 (Postgres/Rate-Limit)
├── #31 -> unblocks Postgres rate-limit integration tests
├── #32 -> unblocks Postgres create-path tests for #62
├── #34 -> must land before #62 (Redis rate-limit tests)
├── #35 -> must land before #45 (same middleware)
└── #40 -> unblocks Postgres stability tests

Sprint 2 (GitHub Driver)
├── #33 -> should land before #36 (deterministic driver state)
├── #36 -> depends on stable #33
├── #37 -> independent, but affects same file
├── #44 -> independent
└── #59 -> independent

Sprint 3 (Cache/Redis/Audit)
├── #38 -> independent
├── #39 -> independent
├── #42 -> independent
└── #57 -> independent

Sprint 4 (Integrity/Middleware)
├── #41 -> large; depends on driver interface (affects all drivers)
├── #45 -> depends on #35 (same middleware file)
├── #46 -> independent
├── #47 -> independent
├── #50 -> touches controllers; avoid collision with #46/#47
├── #52 -> independent
└── #53 -> independent

Sprint 5 (Migrations/Tests)
├── #43 -> quick win; unblock CI flakiness
├── #48 -> independent
├── #49 -> independent
└── #60 -> independent

Sprint 6 (Routes/Config/Types)
├── #51 -> independent
├── #54 -> independent (minor route restructure)
├── #55 -> type-only
├── #56 -> independent
├── #58 -> independent
└── #61 -> independent

Sprint 7 (Coverage)
└── #62 -> depends on Sprint 1, 2, 3 for meaningful assertions
```

---

## 11. Testing Strategy

- **Unit tests:** Target adapters (`postgres.adapter.ts`, `sqlite.adapter.ts`), utilities (`sql-builder.ts`), and error classes (`app.error.ts`). Mock external dependencies (Redis, S3, GitHub API, pg Pool).
- **Integration tests:** Spin up the Express app via `supertest`. Use isolated SQLite DBs per test file. For Postgres-specific tests, spin up a temporary PostgreSQL container or mock the `pg` module.
- **E2E tests:** Run the full lifecycle (create prompt, log, trace, run, label, audit) and assert workspace isolation.
- **Test environment:** Ensure `API_KEY_SALT` is set in `.env` or use the CI fallback (`test-salt-for-ci`). Clean up SQLite DBs (`*.db`, `*.db-wal`, `*.db-shm`) in `beforeAll`.
- **Regression rule:** Every Critical and High issue must have at least one new test. Every Medium issue should have a test unless it is purely architectural (e.g., #54 route move still gets an integration test).

---

## 12. Rollout & Validation Checklist

1. **Sprint 1 merge:** Verify all Postgres rate-limit and `lastInsertRowid` tests pass locally and in CI.
2. **Sprint 2 merge:** Verify GitHub driver tests pass with mocked `simple-git` and `axios`.
3. **Sprint 4 merge:** Verify `PromptDriver` interface changes compile for all three driver implementations.
4. **Sprint 5 merge:** Run the full integration suite (`npm test`) three times to confirm flakiness is resolved.
5. **Sprint 7 merge:** Achieve >85% coverage on adapters, >80% on middlewares, and >75% on drivers before closing #62.
6. **Final validation:** Run `npm run lint`, `npm run build`, and `npm test` in sequence. Ensure zero TypeScript errors.
