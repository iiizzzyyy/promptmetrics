# Build Tasks: Issues #20, #21, #22 -- SQLite Write Contention & Rate-Limit Performance

**Derived from:** [Issue Resolution Plan](./issue-resolution-plan.md)  
**Date:** 2026-04-26  
**Status:** Complete  
**Milestone:** [Performance & Stability](https://github.com/iiizzzyyy/promptmetrics/milestone/3)

---

## Legend

- `[ ]` -- Not started
- `[-]` -- In progress
- `[x]` -- Complete
- `**BLOCKED**` -- Waiting on dependency

---

## Epic 1: Core Performance Fixes (#20)

**GitHub Issue:** [#20 -- SQLite write serialization in rate-limit middleware causes severe latency under concurrent load](https://github.com/iiizzzyyy/promptmetrics/issues/20)  
**Goal:** Eliminate the SQLite write-queue bottleneck by removing unnecessary transactions, hoisting schema creation, and adding busy-timeout resilience.

---

### Task 1.1 -- Remove Transaction Wrapper from `checkSqliteRateLimit()`

- [x] **1.1.1** Open `src/middlewares/rate-limit-per-key.middleware.ts`
- [x] **1.1.2** Replace the `db.transaction<boolean>((txDb) => { ... })` block (lines 76--107) with direct prepared statements using `db` (not `txDb`)
- [x] **1.1.3** Add a code comment above the `SELECT` explaining why no transaction is needed
- [x] **1.1.4** Run unit tests for rate-limit middleware: `npx jest tests/unit/rate-limit.test.ts` (or create if missing)
- [x] **1.1.5** Run integration tests: `npx jest tests/integration/`
- [x] **1.1.6** Commit: `git commit -m "perf(rate-limit): remove unnecessary transaction wrapper from SQLite path"`

---

### Task 1.2 -- Hoist `CREATE TABLE IF NOT EXISTS rate_limits` to Startup

- [x] **1.2.1** In `src/middlewares/rate-limit-per-key.middleware.ts`, delete lines 65--71 (the `db.exec(CREATE TABLE IF NOT EXISTS rate_limits...)` block inside `checkSqliteRateLimit`)
- [x] **1.2.2** Open `src/models/promptmetrics-sqlite.ts`
- [x] **1.2.3** Import `SqliteAdapter` at the top of the file (verify it is already imported)
- [x] **1.2.4** Inside `initSchema()`, after `await migrator.up();`, add `CREATE TABLE IF NOT EXISTS rate_limits`
- [x] **1.2.5** Verify `initSchema()` is called during server startup (`src/server.ts`) and test setup (`tests/env-setup.ts`)
- [x] **1.2.6** Run integration tests to confirm `rate_limits` table is present: `npx jest tests/integration/`
- [x] **1.2.7** Commit: `git commit -m "perf(rate-limit): hoist rate_limits table creation to initSchema, out of request hot path"`

---

### Task 1.3 -- Add SQLite Busy Timeout

- [x] **1.3.1** Open `src/models/promptmetrics-sqlite.ts`
- [x] **1.3.2** After `rawDb.pragma('foreign_keys = ON');` (line 30), add:
  ```typescript
  rawDb.pragma('busy_timeout = 5000');
  ```
- [x] **1.3.3** Verify the pragma is applied in the `getDb()` path (not the Postgres path)
- [x] **1.3.4** Run full test suite: `npm test`
- [x] **1.3.5** Commit: `git commit -m "perf(sqlite): add 5-second busy_timeout to reduce SQLITE_BUSY retry storms"`

---

## Epic 2: Configurable Rate-Limit Thresholds (#21)

**GitHub Issue:** [#21 -- Make rate-limit threshold configurable per environment](https://github.com/iiizzzyyy/promptmetrics/issues/21)  
**Goal:** Read `WINDOW_MS` and `DEFAULT_MAX` from environment variables with safe fallbacks.

---

### Task 2.1 -- Environment-Driven Rate-Limit Constants

- [x] **2.1.1** Open `src/middlewares/rate-limit-per-key.middleware.ts`
- [x] **2.1.2** Replace the hard-coded constants at lines 5--6:
  ```typescript
  const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000;
  const DEFAULT_MAX = Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;
  ```
- [x] **2.1.3** Add a comment block above the constants
- [x] **2.1.4** Open `.env.example`
- [x] **2.1.5** Add the new variables (with comments) near the bottom
- [x] **2.1.6** Open `README.md`, find the "Configuration" or "Environment Variables" section
- [x] **2.1.7** Document `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX_REQUESTS` with defaults and usage notes
- [x] **2.1.8** Run integration tests: `npx jest tests/integration/`
- [x] **2.1.9** Commit: `git commit -m "feat(rate-limit): make WINDOW_MS and DEFAULT_MAX configurable via env vars"`

---

## Epic 3: Debounce `last_used_at` Updates (#22)

**GitHub Issue:** [#22 -- Debounce last_used_at updates in auth middleware to reduce SQLite write contention](https://github.com/iiizzzyyy/promptmetrics/issues/22)  
**Goal:** Only write `last_used_at` when the current value is older than a configurable threshold.

---

### Task 3.1 -- Time-Based Debounce in Auth Middleware

- [x] **3.1.1** Open `src/middlewares/promptmetrics-auth.middleware.ts`
- [x] **3.1.2** Replace the unconditional `UPDATE` block (lines 38--40) with debounced logic:
  ```typescript
  const now = Math.floor(Date.now() / 1000);
  const debounceMs = Number(process.env.API_KEY_LAST_USED_DEBOUNCE_MS) || 60_000;
  const debounceSec = Math.floor(debounceMs / 1000);

  if (!row.last_used_at || now - row.last_used_at >= debounceSec) {
    await db
      .prepare('UPDATE api_keys SET last_used_at = ? WHERE key_hash = ?')
      .run(now, keyHash);
  }
  ```
- [x] **3.1.3** Add a comment above the debounce block
- [x] **3.1.4** Open `.env.example`
- [x] **3.1.5** Add the new variable near the other auth/rate-limit vars
- [x] **3.1.6** Open `README.md`, find the "Configuration" or "Environment Variables" section
- [x] **3.1.7** Document `API_KEY_LAST_USED_DEBOUNCE_MS` with default and rationale
- [x] **3.1.8** Run integration tests: `npx jest tests/integration/`
- [x] **3.1.9** Commit: `git commit -m "perf(auth): debounce last_used_at writes with configurable threshold"`

---

## Epic 4: Validation & Regression Testing

**Goal:** Verify all three epics work correctly together and measure performance improvement.

---

### Task 4.1 -- Unit Test Coverage

- [x] **4.1.1** If `tests/unit/rate-limit.test.ts` exists, update it; otherwise create it:
  - Test that `checkSqliteRateLimit` increments count within window
  - Test that `checkSqliteRateLimit` returns 429 when `count >= maxRequests`
  - Test that `checkSqliteRateLimit` resets count when window expires
- [x] **4.1.2** If `tests/unit/auth.test.ts` exists, add a test; otherwise create it:
  - Mock `db.prepare().get()` returning `last_used_at = now - 30`
  - Assert `UPDATE` is called when threshold is 60 s
  - Mock `last_used_at = now - 10`
  - Assert `UPDATE` is NOT called when threshold is 60 s
- [x] **4.1.3** Run unit tests: `npx jest tests/unit/`

---

### Task 4.2 -- Integration & E2E Regression

- [x] **4.2.1** Run full test suite: `npm test`
- [x] **4.2.2** Verify zero test timeouts (all suites finish in <60 s)
- [x] **4.2.3** Verify no 429 errors in integration tests (unless explicitly testing rate-limit rejection)
- [x] **4.2.4** Run E2E tests: `npx jest tests/e2e/`
- [x] **4.2.5** Verify `initSchema()` creates `rate_limits` on a fresh database (delete `./data/*.db`, restart server, assert table exists)

---

### Task 4.3 -- Performance Smoke Test

- [x] **4.3.1** Start the dev server: `npm run dev`
- [x] **4.3.2** Run a quick concurrent load test (e.g., `autocannon` or a simple Node.js script):
  ```bash
  # Example with autocannon (npm install -g autocannon)
  autocannon -c 10 -d 5 -H "X-API-Key: $TEST_API_KEY" http://localhost:3000/v1/prompts
  ```
- [x] **4.3.3** Assert P99 latency < 500 ms (vs. previous 20--30 s)
- [x] **4.3.4** Assert no `SQLITE_BUSY` errors in server logs

---

### Task 4.4 -- Final Commit & Version Bump (Optional)

- [x] **4.4.1** If all tests pass, create a summary commit or bump version:
  ```bash
  git commit -m "perf: resolve SQLite write contention (#20, #21, #22)"
  ```
- [x] **4.4.2** Update `CHANGELOG.md` with a summary of the three fixes

---

## Cross-Cutting Checklist

- [x] All new env vars are documented in `.env.example`
- [x] All new env vars are documented in `README.md`
- [x] No hard-coded constants remain for rate-limit or debounce thresholds
- [x] `CREATE TABLE IF NOT EXISTS rate_limits` is removed from request path
- [x] `PRAGMA busy_timeout` is set in SQLite initialization
- [x] `npm test` passes with exit code 0
- [x] No `SQLITE_BUSY` errors under concurrent load

---

## Test Results

| Suite | Result | Time |
|-------|--------|------|
| `npm test` (all suites) | 31 passed, 212 tests | 7.4 s |
| `npx jest tests/e2e/` | 1 passed, 39 tests | 1.8 s |
| `npx jest tests/integration/` | All passed | <5 s |
| Build (`npm run build`) | Clean (no errors) | <2 s |

---

*Tasks generated by AI Engineer & Software Architect agent analysis.*
*Implementation completed 2026-04-26.*
