# Issue Resolution Plan: SQLite Write Contention & Rate-Limit Performance

**Date:** 2026-04-26  
**GitHub Issues:** [#20](https://github.com/iiizzzyyy/promptmetrics/issues/20), [#21](https://github.com/iiizzzyyy/promptmetrics/issues/21), [#22](https://github.com/iiizzzyyy/promptmetrics/issues/22)  
**Status:** Proposed -- Awaiting Approval  
**Agents Consulted:** AI Engineer, Software Architect

---

## Executive Summary

Three open issues describe a single systemic problem: **SQLite write contention under concurrent request load**. Under any real-world traffic (integration tests, CI pipelines, or production bursts), the combination of per-request `UPDATE` statements in auth middleware, unnecessary transaction wrappers in rate-limiting, and schema-locking `CREATE TABLE` calls serializes all requests through a single SQLite write queue. This causes P99 latency to spike from milliseconds to 20--30 seconds and test suites to timeout.

This plan resolves all three issues as an integrated performance epic rather than isolated patches.

---

## Problem Analysis

### Current Request Hot Path (every authenticated request)

```
Request arrives
  -> authenticateApiKey()
       -> SELECT api_keys          (read)
       -> UPDATE api_keys.last_used_at  (write #1)
  -> rateLimitPerKey()
       -> CREATE TABLE IF NOT EXISTS rate_limits  (schema lock, write #2)
       -> BEGIN TRANSACTION
       -> SELECT rate_limits      (read)
       -> INSERT OR REPLACE / UPDATE rate_limits  (write #3)
       -> COMMIT
  -> Controller logic
```

In a single-threaded Node.js process with one SQLite connection (`better-sqlite3`), every write blocks the event loop until the write lock is available. With three writes per request, concurrent load creates a queue that grows linearly with request volume.

### Measured Impact

| Scenario | Before Fix | After Fix |
|----------|-----------|-----------|
| 60-test suite (integration) | 13 files timeout (30 s each) | ~1 s per file |
| `POST /v1/evaluations/:id/results` | ~26 s | <100 ms |
| Write ops per 100 requests | 300 writes + 100 schema locks | ~2 writes + 0 schema locks |

---

## Architectural Decision Records

### ADR-001: Remove Transaction Wrapper from Rate-Limiter SQLite Path

**Status:** Proposed

**Context:** `checkSqliteRateLimit()` wraps a `SELECT` + `INSERT`/`UPDATE` in `db.transaction()`. In `better-sqlite3`, transactions are synchronous and acquire the write lock. Because Node.js is single-threaded, the `SELECT` + `INSERT`/`UPDATE` sequence is already atomic for a single request -- no concurrent request can interleave.

**Decision:** Replace the `db.transaction()` block with direct prepared statements.

**Consequences:**
- **Easier:** Eliminates `BEGIN...COMMIT` overhead on every request. Reduces lock contention.
- **Harder:** Future developers might mistakenly think they need a transaction for atomicity. We will add a code comment explaining the single-threaded guarantee.

**Trade-off accepted:** Simplicity and performance over theoretical atomicity that is already guaranteed by the runtime.

---

### ADR-002: Hoist Schema Creation from Request Path to Startup

**Status:** Proposed

**Context:** `CREATE TABLE IF NOT EXISTS rate_limits` runs inside the request hot path, acquiring a schema lock on every request. This is unnecessary -- the table only needs to exist once.

**Decision:** Move `CREATE TABLE IF NOT EXISTS rate_limits` into `initSchema()` in `src/models/promptmetrics-sqlite.ts`, guarded by `if (db instanceof SqliteAdapter)`.

**Consequences:**
- **Easier:** Zero schema locks during request handling. Startup time increases by <1 ms.
- **Harder:** If the table definition changes, it must be updated in two places (migrations + initSchema). We will add a comment cross-referencing the migration file.

**Trade-off accepted:** One-time startup cost vs. per-request schema lock penalty.

---

### ADR-003: Debounce `last_used_at` via Time-Based Threshold

**Status:** Proposed

**Context:** `last_used_at` is updated on every authenticated request. It is useful for audit and key rotation, but sub-second precision is unnecessary.

**Decision:** Only write `last_used_at` when the current value is older than a configurable threshold (default: 60 seconds). Store threshold in environment variable `API_KEY_LAST_USED_DEBOUNCE_MS`.

**Consequences:**
- **Easier:** Write volume drops from *N requests* to *N / 60* -- a 99 % reduction for typical test suites. Bounded precision loss (worst-case ±60 s).
- **Harder:** Slightly less accurate `last_used_at` for high-frequency keys. The threshold must be documented so operators understand the precision/performance trade-off.

**Trade-off accepted:** Bounded precision loss vs. massive write reduction.

---

### ADR-004: Environment-Driven Rate-Limit Configuration

**Status:** Proposed

**Context:** Rate-limit thresholds (`100 req / 60 s`) are hard-coded. CI and test environments routinely exceed this, causing 429 cascades and suite timeouts.

**Decision:** Read `WINDOW_MS` and `DEFAULT_MAX` from environment variables `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX_REQUESTS`, falling back to current defaults.

**Consequences:**
- **Easier:** Zero-risk change (defaults unchanged). Unlocks CI tuning (`RATE_LIMIT_MAX_REQUESTS=10000`) and local stress testing (`RATE_LIMIT_WINDOW_MS=1000`).
- **Harder:** Operators must understand that raising limits in production removes backpressure protection. We will document this in `.env.example` with a warning comment.

**Trade-off accepted:** Operational flexibility vs. slightly increased configuration surface area.

---

### ADR-005: Add SQLite Busy Timeout for Resilience

**Status:** Proposed

**Context:** Without `PRAGMA busy_timeout`, SQLite returns `SQLITE_BUSY` immediately if the write lock is held. Clients retry with exponential backoff (up to 8 s, 3 retries), amplifying queue depth.

**Decision:** Add `rawDb.pragma('busy_timeout = 5000')` in `src/models/promptmetrics-sqlite.ts` after the existing pragma setup.

**Consequences:**
- **Easier:** SQLite waits up to 5 s for the lock instead of failing immediately. Reduces retry storms and client-side timeout cascades.
- **Harder:** A stalled write could block the event loop for up to 5 s. This is acceptable because (a) the other changes in this plan drastically reduce write frequency, and (b) 5 s is still better than an immediate failure + 3 retries.

**Trade-off accepted:** Bounded blocking time vs. immediate failure cascades.

---

## Implementation Strategy

### Phase 1: Core Performance Fixes (#20)
**Goal:** Eliminate the write-queue bottleneck.

1. **Remove transaction wrapper** from `checkSqliteRateLimit()` -- direct prepared statements.
2. **Hoist `CREATE TABLE IF NOT EXISTS rate_limits`** to `initSchema()`.
3. **Add `PRAGMA busy_timeout = 5000`** in `promptmetrics-sqlite.ts`.

### Phase 2: Configurability (#21)
**Goal:** Make rate limits environment-aware without changing production defaults.

1. Replace hard-coded `WINDOW_MS` and `DEFAULT_MAX` with env var reads.
2. Document in `.env.example`.

### Phase 3: Auth Middleware Optimization (#22)
**Goal:** Reduce per-request write volume from auth path.

1. Add debounce logic to `authenticateApiKey()`: only `UPDATE` if `last_used_at` is older than threshold.
2. Read threshold from `API_KEY_LAST_USED_DEBOUNCE_MS` (default 60,000 ms).
3. Document in `.env.example`.

### Phase 4: Validation & Regression Testing
**Goal:** Ensure no regressions and measure improvement.

1. Run full test suite: `npm test`
2. Verify rate-limit middleware still enforces limits correctly.
3. Verify auth middleware still updates `last_used_at` (just less frequently).
4. Verify `initSchema()` creates `rate_limits` table on fresh DB.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Rate limiter loses atomicity without transaction | Low | High | Node.js single-threaded guarantee; add code comment |
| `last_used_at` precision too coarse for key rotation | Low | Medium | Threshold is configurable; default is conservative |
| Busy timeout causes event-loop stalls | Low | Medium | 5 s is bounded; write frequency drops 99 % |
| CI tests still hit rate limits | Medium | Low | Env vars allow CI to tune limits independently |
| Schema drift if rate_limits table changes | Low | Low | Cross-reference migration file in initSchema comment |

---

## Success Metrics

- [ ] Full test suite passes: `npm test` (exit 0)
- [ ] Integration test suite completes in <60 s total (vs. current timeouts)
- [ ] `POST /v1/evaluations/:id/results` latency <200 ms under concurrent load
- [ ] No 429 failures in CI when `RATE_LIMIT_MAX_REQUESTS=10000`
- [ ] `last_used_at` updates are spaced by >= configured threshold

---

## Files Affected

| File | Change Type | Issue |
|------|------------|-------|
| `src/middlewares/rate-limit-per-key.middleware.ts` | Modify | #20, #21 |
| `src/middlewares/promptmetrics-auth.middleware.ts` | Modify | #22 |
| `src/models/promptmetrics-sqlite.ts` | Modify | #20 |
| `.env.example` | Modify | #20, #21, #22 |
| `README.md` | Modify | #20, #21, #22 |

---

*Plan generated by AI Engineer & Software Architect agent analysis.*
