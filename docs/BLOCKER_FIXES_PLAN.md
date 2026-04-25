# Blocker Fixes Implementation Plan

**Date:** 2026-04-25
**Scope:** 7 security blockers from CODE_REVIEW.md
**Goal:** Fix all blockers, maintain test coverage, verify with `npm test` and end-to-end tests.

---

## Blockers

### 1. Path Traversal in FilesystemDriver
**File:** `src/drivers/promptmetrics-filesystem-driver.ts`
**Fix:** Add `validateName()` helper using `path.resolve()` + prefix check. Reject names containing `..` or resolving outside `basePath`.
**Tests:** Add negative test cases for `../../../etc/passwd` and `foo/../bar`.

### 2. Path Traversal in GithubDriver
**File:** `src/drivers/promptmetrics-github-driver.ts`
**Fix:** Apply same `validateName()` helper before any filesystem access in `getPrompt`, `listPrompts`, `listVersions`.
**Tests:** Add negative test cases for path traversal inputs.

### 3. Missing Input Validation in EvaluationController
**File:** `src/controllers/promptmetrics-evaluation.controller.ts`
**Fix:** Create `src/validation-schemas/promptmetrics-evaluation.schema.ts` with Joi schemas for `createEvaluation` and `createResult`. Validate `req.body` in every controller method.
**Tests:** Add integration tests for invalid payloads returning 422.

### 4. Race Condition in SQLite Rate Limiter
**File:** `src/middlewares/rate-limit-per-key.middleware.ts`
**Fix:** Replace read-then-update with atomic `UPDATE rate_limits SET count = count + 1 WHERE key = ? AND count < ?`, then check `changes` to determine if allowed.
**Tests:** Verify existing rate-limit tests still pass; add concurrent burst test if feasible.

### 5. Webhook Secret Falls Back to GITHUB_TOKEN
**File:** `src/routes/webhook.route.ts`
**Fix:** Remove `|| process.env.GITHUB_TOKEN`. Fail closed: if `GITHUB_WEBHOOK_SECRET` is missing, return 500.
**Tests:** Update webhook tests to assert 500 when secret is missing.

### 6. Sensitive Data Logged to stdout
**File:** `src/controllers/promptmetrics-log.controller.ts`
**Fix:** Remove `console.log(JSON.stringify({ type: 'promptmetrics.log', ...logEntry }))`. Keep `logMetadata()` call if it is the intended structured logging path.
**Tests:** No new tests needed; verify existing log tests pass.

### 7. SQL Injection Pattern in Migration Storage
**File:** `src/migrations/sqlite-storage.ts`
**Fix:** Validate `tableName` and `columnName` against regex `/^[a-z_][a-z0-9_]*$/i` in constructor. Throw if invalid.
**Tests:** Add unit tests for valid and invalid identifier names.

---

## Execution Order

1. ~~**Task 38** — FilesystemDriver path traversal~~ COMPLETED
2. ~~**Task 42** — GithubDriver path traversal~~ COMPLETED
3. ~~**Task 41** — EvaluationController input validation~~ COMPLETED
4. ~~**Task 40** — SQLite rate limiter race condition~~ COMPLETED
5. ~~**Task 39** — Webhook secret fallback removal~~ COMPLETED
6. ~~**Task 44** — Remove sensitive console.log~~ COMPLETED
7. ~~**Task 43** — SQLiteStorage identifier sanitization~~ COMPLETED
8. ~~**Final Verification** — `npm test`, `docker compose up --build`, update TEST_RESULTS.md~~ COMPLETED

---

## Verification Results

- **Unit/Integration Tests:** 212 passed, 0 failed
- **Docker Smoke Tests:** 10/10 passed
- **TypeScript Build:** Zero errors
- **Coverage:** New services/schemas covered
