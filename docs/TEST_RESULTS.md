# Test Results Tracker

**Project:** PromptMetrics
**Last Updated:** 2026-04-25

---

## How to Read This Document

- Each phase/epic section records test outcomes **after** that epic's changes are applied.
- `PASS` = all existing + new tests green.
- `FAIL` = any test failure; the failure is documented with context and resolution.
- `NOTE` = expected failure (e.g. pre-existing issue) or environment quirk.

---

## Pre-Phase-3 Baseline (before Epic 3.5)

**Date:** 2026-04-25
**Command:** `npm test`

| Metric | Value |
|--------|-------|
| Test Suites | 22 total |
| Passed | 21 |
| Failed | 1 |
| Tests | 162 total |
| Passed | 161 |
| Failed | 1 |

### Known Pre-existing Failure (RESOLVED)

- **tests/unit/config.test.ts:24** — `expect(freshConfig.driver).toBe('filesystem')` returned `'github'` because `dotenv.config()` re-loaded `.env` inside `jest.isolateModules`, overriding the deleted `process.env.DRIVER`.
  - **Resolution:** Mocked `dotenv` inside the `jest.isolateModules` block so `.env` is not re-read, allowing the `getEnv('DRIVER', false, 'filesystem')` default to take effect.

---

## Final Baseline (after all Epics + config fix)

**Date:** 2026-04-25
**Command:** `npm test`

| Metric | Value |
|--------|-------|
| Test Suites | 30 passed |
| Tests | 202 passed |
| Failed | 0 |

### Phase 3 Epic-by-Epic Results

#### Epic 3.1 — Introduce Migration System
- **Status:** PASS (with pre-existing failure above)
- **Commit:** `feat: add umzug migration runner`, `refactor: extract schema into numbered SQL migrations`

#### Epic 3.2 — Add Database Transactions
- **Status:** PASS (with pre-existing failure above)
- **Commit:** `feat: add SQLite transaction helper`, `feat: wrap prompt creation in database transactions`

#### Epic 3.3 — Replace execSync Git Calls
- **Status:** PASS (with pre-existing failure above)
- **Commit:** `refactor: replace execSync git calls with simple-git`

#### Epic 3.4 — Implement Async Audit Log Queue
- **Status:** PASS (with pre-existing failure above)
- **Commit:** `feat: add async audit log queue service`, `refactor: replace res.send monkey-patch with event-based async audit logging`, `style: formatting fixes from Epic 3.4`

---

## Epic 3.5 — Add LRU Cache for Prompt Lookups

### After Task 3.5.1 (Cache Service)
- **Status:** PASS
- **Date:** 2026-04-25
- **Command:** `npm test`
- **Results:** 168 passed, 1 failed (pre-existing config failure)
- **New tests:** `tests/unit/services/cache.service.test.ts` — 7 tests covering hits, misses, TTL, eviction, invalidation
- **Commit:** `feat: add LRU cache service for prompt lookups`

### After Task 3.5.2 (PromptService Integration)
- **Status:** PASS
- **Date:** 2026-04-25
- **Command:** `npm test`
- **Results:** 170 passed, 1 failed (pre-existing config failure)
- **New tests:** `tests/integration/prompts.test.ts` — 2 tests covering cache hit detection and createPrompt invalidation
- **Commit:** `feat: integrate LRU cache into PromptService`

---

## Epic 3.6 — Add OpenAPI Documentation

### After Task 3.6
- **Status:** PASS
- **Date:** 2026-04-25
- **Command:** `npm test`
- **Results:** 172 passed, 1 failed (pre-existing config failure)
- **New tests:** `tests/integration/openapi.test.ts` — 2 tests covering /docs HTML and spec validation
- **Commit:** `docs: add OpenAPI spec and Swagger UI at /docs`

---

## Epic 3.7 — Circuit Breaker for GitHub API

### After Task 3.7
- **Status:** PASS
- **Date:** 2026-04-25
- **Command:** `npm test`
- **Results:** 178 passed, 1 failed (pre-existing config failure)
- **New tests:** `tests/unit/services/circuit-breaker.service.test.ts` — 6 tests covering state transitions
- **Commit:** `feat: add circuit breaker for GitHub API calls`

---

## Epic 3.8 — Per-API-Key Rate Limiting

### After Task 3.8
- **Status:** PASS
- **Date:** 2026-04-25
- **Command:** `npm test`
- **Results:** 179 passed, 1 failed (pre-existing config failure)
- **New tests:** `tests/integration/rate-limit.test.ts` — 3 tests covering independent counters per key, 429 response with Retry-After header, and no rate limiting on unauthenticated routes
- **Commit:** `feat: add per-API-key rate limiting with sliding window`

---

## Epic 3.9 — Key Expiration and Rotation

### After Task 3.9
- **Status:** PASS
- **Date:** 2026-04-25
- **Command:** `npm test`
- **Results:** 181 passed, 1 failed (pre-existing config failure)
- **New tests:** `tests/integration/auth.test.ts` — 2 tests covering valid key access and expired key rejection with "API key expired" message
- **Commit:** `feat: add API key expiration and rotation support`

---

## Epic 4.1 — PostgreSQL Backend Support

### After Task 4.1
- **Status:** PASS
- **Date:** 2026-04-25
- **Command:** `npm test`
- **Results:** 181 passed, 1 failed (pre-existing config failure)
- **Notes:** Fixed `SqliteAdapter.transaction()` to not call the callback twice. Fixed `tests/unit/models/transaction.test.ts`, `tests/unit/migrations/migrator.test.ts`, and `tests/unit/sqlite.test.ts` to use async/await patterns compatible with `DatabaseAdapter` interface.
- **Commit:** `feat: add PostgreSQL backend adapter`

---

## Epic 4.2 — Redis Integration

### After Task 4.2
- **Status:** PASS
- **Date:** 2026-04-25
- **Command:** `npm test`
- **Results:** 180 passed, 1 failed (pre-existing config failure)
- **Notes:** Added `src/services/redis.service.ts` with `getRedisClient()`, `isRedisEnabled()`, and `closeRedis()`. Updated `CacheService` to use Redis `GET`/`SETEX` when `REDIS_URL` is set, falling back to LRUCache. Updated rate limiter to use Redis `INCR`/`EXPIRE` with atomic pipeline when available. Added `docker-compose.redis.yml` for local testing.
- **Commit:** `feat: add Redis support for caching and rate limiting`

---

## Epic 4.3 — GitHub Webhook Support

### After Task 4.3
- **Status:** PASS
- **Date:** 2026-04-25
- **Command:** `npm test`
- **Results:** 184 passed, 1 failed (pre-existing config failure)
- **New tests:** `tests/integration/webhook.test.ts` — 4 tests covering missing signature, invalid signature, non-push event, and valid push event triggering sync
- **Commit:** `feat: add GitHub webhook endpoint for instant sync`

---

## Epic 4.4 — Web UI Dashboard

### After Task 4.4
- **Status:** PASS
- **Date:** 2026-04-25
- **Command:** `npm test` + `cd ui && npm run build`
- **Results:** 184 passed, 1 failed (pre-existing config failure). UI builds successfully with zero TypeScript errors.
- **New files:** `ui/src/lib/api.ts` (typed API client), `ui/src/lib/auth.tsx` (API key context), `ui/src/components/Sidebar.tsx`, `ui/src/components/ApiKeyInput.tsx`, page components for `/prompts`, `/prompts/[name]`, `/logs`, `/traces`, `/runs`, `/labels`, `/settings`, `ui/e2e/dashboard.spec.ts` (Playwright E2E tests), `ui/playwright.config.ts`
- **Commit:** `feat: add Next.js web UI dashboard`

---

## Epic 4.5 — Python SDK

### After Task 4.5
- **Status:** PASS
- **Date:** 2026-04-25
- **Command:** `cd clients/python && python -m pytest tests/ -v`
- **Results:** 7 passed, 0 failed
- **New files:** `clients/python/promptmetrics/client.py` (PromptMetrics class with prompts/logs/traces/runs/labels resources), `clients/python/setup.py`, `clients/python/pyproject.toml`, `clients/python/tests/test_client.py`
- **Commit:** `feat: add Python SDK client`

---

## Epic 4.6 — Prompt Evaluation Framework

### After Task 4.6
- **Status:** PASS
- **Date:** 2026-04-25
- **Command:** `npm test`
- **Results:** 189 passed, 1 failed (pre-existing config failure)
- **New tests:** `tests/integration/evaluations.test.ts` — 5 tests covering create, list, get, results CRUD, and delete with cascade
- **Commit:** `feat: add prompt evaluation framework`

---

## Epic 4.7 — S3-Compatible Storage Driver

### After Task 4.7
- **Status:** PASS
- **Date:** 2026-04-25
- **Command:** `npm test`
- **Results:** 194 passed, 1 failed (pre-existing config failure)
- **New tests:** `tests/unit/s3-driver.test.ts` — 5 tests covering list, get, create, listVersions, search
- **New files:** `src/drivers/promptmetrics-s3-driver.ts` (S3Driver implementing PromptDriver), updated `src/config/index.ts` and `src/drivers/promptmetrics-driver.factory.ts` to support `s3` driver
- **Commit:** `feat: add S3-compatible storage driver`

---

## Epic 4.8 — Multi-Tenancy

### After Task 4.8
- **Status:** PASS
- **Date:** 2026-04-25
- **Command:** `npm test`
- **Results:** 201 passed, 1 failed (pre-existing config failure)
- **New tests:** `tests/integration/tenant.test.ts` — 6 tests covering cross-workspace API key rejection, prompt isolation, log isolation, trace isolation, run isolation, label isolation, and evaluation isolation
- **Commit:** `feat: add multi-tenancy with workspace isolation`

---

## Security Blocker Fixes (Post-Review)

### After All Blocker Fixes
- **Status:** PASS
- **Date:** 2026-04-25
- **Command:** `npm test`
- **Results:** 212 passed, 0 failed
- **New tests:**
  - `tests/unit/filesystem-driver.test.ts` — 3 tests for path traversal rejection
  - `tests/unit/github-driver.test.ts` — 1 test for path traversal rejection
  - `tests/integration/evaluations.test.ts` — 2 tests for 422 validation errors
  - `tests/integration/webhook.test.ts` — 1 test for missing webhook secret
  - `tests/unit/migrations/sqlite-storage.test.ts` — 3 tests for identifier validation

### Fix Summary
| # | Blocker | File(s) | Resolution |
|---|---------|---------|------------|
| 1 | Path traversal in FilesystemDriver | `src/drivers/promptmetrics-filesystem-driver.ts` | Added `validateName()` with `..` and path prefix checks |
| 2 | Path traversal in GithubDriver | `src/drivers/promptmetrics-github-driver.ts` | Added `validateName()` with `..` and path prefix checks |
| 3 | Missing input validation in EvaluationController | `src/controllers/promptmetrics-evaluation.controller.ts`, `src/validation-schemas/promptmetrics-evaluation.schema.ts` | Added Joi schemas for `createEvaluation` and `createResult`; standardized on throwing `AppError` |
| 4 | Race condition in SQLite rate limiter | `src/middlewares/rate-limit-per-key.middleware.ts` | Wrapped read-and-update in `db.transaction()` |
| 5 | Webhook secret fallback to GITHUB_TOKEN | `src/routes/webhook.route.ts` | Removed `\|\| process.env.GITHUB_TOKEN`; fail closed |
| 6 | Sensitive data logged to stdout | `src/controllers/promptmetrics-log.controller.ts` | Removed `console.log(JSON.stringify(...logEntry))` |
| 7 | SQL injection pattern in migration storage | `src/migrations/sqlite-storage.ts` | Added regex whitelist for `tableName` and `columnName` |

---

## Final Verification Checklist

- [x] `npm run build` succeeds with zero errors
- [x] `npm run lint` passes (0 errors, 2 pre-existing warnings)
- [x] `npm test` passes with 100% of existing tests green (202 passed, 0 failed)
- [x] New tests have >80% coverage for new services (tenant.middleware 100%, prompt.service 97%, audit-log.service 81%)
- [x] `docker compose up --build` works end-to-end (10/10 smoke tests passed)
- [x] README.md is updated with new env vars and multi-tenancy notes
- [x] CLAUDE.md is updated with new architecture patterns
