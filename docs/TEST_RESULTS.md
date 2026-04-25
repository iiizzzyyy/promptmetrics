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

### Known Pre-existing Failure

- **tests/unit/config.test.ts:24** — `expect(freshConfig.driver).toBe('filesystem')` returns `'github'`.
  - This is **not related to any build task**. It appears to be a stale test that does not match current default configuration.
  - **Resolution:** Will be reviewed during Final Verification Checklist.

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

## Final Verification Checklist

- [ ] `npm run build` succeeds with zero errors
- [ ] `npm run lint` passes
- [ ] `npm test` passes with 100% of existing tests green (except pre-existing config failure)
- [ ] New tests have >80% coverage for new services
- [ ] `docker compose up --build` works end-to-end
- [ ] README.md is updated with any new env vars or commands
- [ ] CLAUDE.md is updated with new architecture patterns
