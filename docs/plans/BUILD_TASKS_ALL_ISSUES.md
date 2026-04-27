# PromptMetrics — Build Tasks for All Open Issues

**Generated:** 2026-04-27
**Repository:** iiizzzyyy/promptmetrics
**Total Open Issues:** 31
**Sprint Duration:** 2 weeks each

---

## Sprint 1: Critical Fixes (Blockers / P0)

### ISSUE-#31 — PostgreSQL integer overflow in rate_limits.window_start

- [ ] **ISSUE-#31a** Update `migrations/001_initial_schema.ts:129` to change `window_start INTEGER` to `window_start BIGINT` for PostgreSQL dialect while preserving SQLite compatibility.
- [ ] **ISSUE-#31b** Update `src/middlewares/rate-limit-per-key.middleware.ts` to ensure `windowStart` logic remains compatible with the new schema (seconds vs milliseconds alignment).
- [ ] **ISSUE-#31c** Add a new numbered migration file (e.g., `migrations/005_alter_rate_limits_window_start.ts`) to alter existing PostgreSQL deployments using dialect-conditional DDL.
- [ ] **ISSUE-#31d** Write integration test in `tests/integration/rate-limit.test.ts` that verifies PostgreSQL rate limiting works under concurrent load without integer overflow.
- [ ] **ISSUE-#31e** Run full E2E suite against PostgreSQL backend in CI to confirm no regressions.
- [ ] **ISSUE-#31f** Update `CHANGELOG.md` and `docs/adr/ADR-00X-postgres-rate-limit-overflow.md` documenting the dialect-specific type change decision.

### ISSUE-#32 — Postgres lastInsertRowid always returns 0, breaking all create operations

- [ ] **ISSUE-#32a** Modify `src/models/postgres.adapter.ts` to append `RETURNING id` for `INSERT` statements in `PostgresPreparedStatement.run()`, or query `lastval()` after insert.
- [ ] **ISSUE-#32b** Verify all services consuming `lastInsertRowid` receive a valid non-zero ID: `src/services/api-key.service.ts`, `src/services/log.service.ts`, `src/services/evaluation.service.ts`.
- [ ] **ISSUE-#32c** Write unit test in `tests/unit/postgres.adapter.test.ts` asserting `lastInsertRowid` returns the actual inserted row ID.
- [ ] **ISSUE-#32d** Write integration tests for API key creation, log creation, and evaluation creation under PostgreSQL backend.
- [ ] **ISSUE-#32e** Ensure SQLite behavior remains unchanged by running `tests/integration` with `DATABASE_URL` unset.
- [ ] **ISSUE-#32f** Update documentation for PostgreSQL support in `docs/postgres-setup.md` if applicable.

### ISSUE-#33 — GithubDriver missing await on async ensureCloned() causes race conditions

- [ ] **ISSUE-#33a** Add `await` to `this.ensureCloned()` call at `src/drivers/promptmetrics-github-driver.ts:55` inside `listPrompts()`.
- [ ] **ISSUE-#33b** Add `await` to `this.ensureCloned()` call at `src/drivers/promptmetrics-github-driver.ts:97` inside `getPrompt()`.
- [ ] **ISSUE-#33c** Audit `src/drivers/promptmetrics-github-driver.ts` for any other unawaited async calls (e.g., `ensureCloned`, `sync`, `push`).
- [ ] **ISSUE-#33d** Write unit test in `tests/unit/github-driver.test.ts` mocking `ensureCloned` as a delayed promise and verifying `listPrompts` and `getPrompt` wait for completion before filesystem access.
- [ ] **ISSUE-#33e** Write integration test simulating cold-start concurrent requests to `/v1/prompts` with GitHub driver and assert no race-condition errors.

### ISSUE-#34 — Redis rate-limit ignores EXPIRE failures, permanently blocking API keys

- [ ] **ISSUE-#34a** Refactor `src/middlewares/rate-limit-per-key.middleware.ts:32-38` to validate both `INCR` and `EXPIRE` command results before allowing the request to proceed.
- [ ] **ISSUE-#34b** Implement fallback Lua script for atomic `INCR + EXPIRE` in `src/middlewares/rate-limit-per-key.middleware.ts` to eliminate partial-failure mode.
- [ ] **ISSUE-#34c** Write integration test in `tests/integration/rate-limit.test.ts` simulating `EXPIRE` failure (e.g., via Redis mock or fault injection) and asserting the API key is not permanently rate-limited.
- [ ] **ISSUE-#34d** Write unit test for the middleware Redis path asserting both commands are checked and failures result in 500 (not 429).
- [ ] **ISSUE-#34e** Update `docs/adr/ADR-00X-redis-rate-limit-atomicity.md` if Lua script approach is adopted.

### ISSUE-#35 — SQLite rate-limit read-modify-write race condition under concurrent load

- [ ] **ISSUE-#35a** Replace the SELECT-then-UPDATE logic in `src/middlewares/rate-limit-per-key.middleware.ts:71-106` with a single atomic `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET count = count + 1, window_start = excluded.window_start WHERE ...`.
- [ ] **ISSUE-#35b** Ensure the atomic query correctly handles window expiration logic (resetting count when window_start changes).
- [ ] **ISSUE-#35c** Write integration test in `tests/integration/rate-limit.test.ts` firing concurrent requests against the same API key and asserting the total accepted requests never exceeds `maxRequests`.
- [ ] **ISSUE-#35d** Write load-test script (can live in `tests/load/`) validating behavior under 50+ concurrent SQLite connections.
- [ ] **ISSUE-#35e** Verify PM2/cluster mode compatibility by documenting that SQLite rate limiting is process-local; recommend Redis for multi-process deployments.

---

## Sprint 2: High Severity (Important / P1)

### ISSUE-#36 — GithubDriver.createPrompt() revert uses incorrect SHA, failing to clean up on DB failure

- [ ] **ISSUE-#36a** Store the SHA returned by the successful GitHub Contents API `PUT` response in `src/drivers/promptmetrics-github-driver.ts` around the create/write flow.
- [ ] **ISSUE-#36b** Update the revert delete logic at `src/drivers/promptmetrics-github-driver.ts:228-241` to use the stored blob SHA instead of the repository HEAD SHA.
- [ ] **ISSUE-#36c** Write integration test in `tests/integration/github-driver.test.ts` (or new file) simulating DB failure after GitHub write and verifying the revert delete succeeds with status 200/404.
- [ ] **ISSUE-#36d** Write unit test mocking Octokit to return a specific SHA on PUT and asserting the revert delete uses that exact SHA.

### ISSUE-#37 — GithubDriver embeds token in clone URL, leaking credentials to logs and process listings

- [ ] **ISSUE-#37a** Remove token embedding from the clone URL at `src/drivers/promptmetrics-github-driver.ts:44`.
- [ ] **ISSUE-#37b** Implement an in-memory credential helper or use `GIT_ASKPASS` environment variable to supply the token during `simple-git` clone/fetch operations.
- [ ] **ISSUE-#37c** Alternatively, configure `simple-git` with `extraHTTPHeaders` if supported by the underlying transport.
- [ ] **ISSUE-#37d** Write security unit test in `tests/unit/github-driver.test.ts` asserting the token string does not appear in any logged URLs, error messages, or `.git/config` output.
- [ ] **ISSUE-#37e** Update `docs/adr/ADR-00X-github-token-handling.md` documenting the chosen approach and trade-offs.
- [ ] **ISSUE-#37f** Run `npm run lint` and `npm run test` to ensure no regressions.

### ISSUE-#38 — CacheService JSON.parse crashes on corrupted Redis data

- [ ] **ISSUE-#38a** Wrap `JSON.parse(raw)` at `src/services/cache.service.ts:26` inside a `try/catch` block.
- [ ] **ISSUE-#38b** On `SyntaxError`, emit a cache-miss (return `undefined`) and optionally log a warning with the cache key.
- [ ] **ISSUE-#38c** Write unit test in `tests/unit/cache.service.test.ts` injecting non-JSON strings into Redis and asserting the service returns `undefined` instead of throwing.
- [ ] **ISSUE-#38d** Write integration test in `tests/integration/prompts.test.ts` simulating corrupted Redis cache data and asserting the endpoint still serves the prompt (cache miss fallback).

### ISSUE-#39 — getRedisClient() connection leak on concurrent cold-start access

- [ ] **ISSUE-#39a** Refactor `src/services/redis.service.ts:5-13` to use an initialization promise pattern: assign `clientPromise` early and have concurrent callers await the same promise.
- [ ] **ISSUE-#39b** Ensure the singleton always returns the same `Redis` instance even under burst concurrent access.
- [ ] **ISSUE-#39c** Write unit test in `tests/unit/redis.service.test.ts` calling `getRedisClient()` 100 times in parallel and asserting only one `new Redis(...)` constructor invocation occurs.
- [ ] **ISSUE-#39d** Verify no memory leak by checking open connection count after burst test.

### ISSUE-#40 — PostgresAdapter missing pool error handler crashes Node process

- [ ] **ISSUE-#40a** Add `this.pool.on('error', (err) => { console.error('Postgres pool error:', err); })` listener in `src/models/postgres.adapter.ts:38-39` immediately after pool creation.
- [ ] **ISSUE-#40b** Ensure the error handler does not crash the process; consider logging only and emitting an OpenTelemetry metric if available.
- [ ] **ISSUE-#40c** Write unit test in `tests/unit/postgres.adapter.test.ts` emitting a synthetic `'error'` event on the mocked pool and asserting the process does not exit.
- [ ] **ISSUE-#40d** Run integration tests against PostgreSQL to verify normal operations remain unaffected.

### ISSUE-#41 — PromptService.createPrompt() non-atomic two-phase write can orphan prompts in storage

- [ ] **ISSUE-#41a** Implement "pending/active" state machine in `src/services/prompt.service.ts:123-131`: insert DB row with `status = 'pending'`, then call `driver.createPrompt()`, then update DB row to `status = 'active'`.
- [ ] **ISSUE-#41b** Add a background reconciliation job (or startup scanner) that finds prompts with `status = 'pending'` older than N minutes and either completes or cleans them up.
- [ ] **ISSUE-#41c** Update `src/services/prompt.service.ts` to handle the case where driver write succeeds but DB update fails by queuing a retry or marking for reconciliation.
- [ ] **ISSUE-#41d** Write integration test in `tests/integration/prompt-transaction.test.ts` simulating DB failure after driver write and asserting the orphan is visible to the reconciliation job.
- [ ] **ISSUE-#41e** Write E2E test covering full create-lifecycle with each driver type (filesystem, GitHub, S3) and asserting no orphaned prompts.
- [ ] **ISSUE-#41f** Update `docs/adr/ADR-00X-prompt-write-atomicity.md` documenting the two-phase commit pattern and reconciliation strategy.

### ISSUE-#42 — Audit log fire-and-forget on buffer full silently drops audit entries

- [ ] **ISSUE-#42a** Add a bounded retry queue (max 3 attempts) in `src/services/audit-log.service.ts:34-36` when `flush()` fails on buffer-full.
- [ ] **ISSUE-#42b** Increment a `dropped_audit_entries` counter metric (OpenTelemetry or simple in-memory) when retries are exhausted.
- [ ] **ISSUE-#42c** Expose the dropped counter via the `/health` or `/metrics` endpoint if applicable.
- [ ] **ISSUE-#42d** Write unit test in `tests/unit/audit-log.service.test.ts` forcing `flush()` to fail and asserting retries occur and the dropped counter increments.
- [ ] **ISSUE-#42e** Write integration test verifying audit logs are not lost under moderate backpressure.

### ISSUE-#43 — Tests use unawaited DB calls in beforeAll blocks causing flaky tests

- [ ] **ISSUE-#43a** Add `await` to all `db.prepare(...).run(...)` calls in `tests/integration/auth.test.ts` beforeAll blocks.
- [ ] **ISSUE-#43b** Add `await` to all `db.prepare(...).run(...)` calls in `tests/integration/rate-limit.test.ts` beforeAll blocks.
- [ ] **ISSUE-#43c** Add `await` to all `db.prepare(...).run(...)` calls in `tests/integration/tenant.test.ts` beforeAll blocks.
- [ ] **ISSUE-#43d** Add `await` to all `db.prepare(...).run(...)` calls in `tests/integration/traces.test.ts` beforeAll blocks.
- [ ] **ISSUE-#43e** Add `await` to all `db.prepare(...).run(...)` calls in `tests/integration/api-keys.test.ts` beforeAll blocks.
- [ ] **ISSUE-#43f** Add `await` to all `db.prepare(...).run(...)` calls in `tests/integration/prompt-transaction.test.ts` beforeAll blocks.
- [ ] **ISSUE-#43g** Audit all remaining `tests/**/*.test.ts` files for unawaited DB setup calls and fix them.
- [ ] **ISSUE-#43h** Add an ESLint rule or CI grep check to prevent floating promises in test setup.
- [ ] **ISSUE-#43i** Run full test suite 5 times in CI to confirm flakiness is eliminated.

---

## Sprint 3: Medium Severity (Architecture, Security, Refactor / P2)

### ISSUE-#44 — S3Driver lacks prompt name validation, allowing unexpected object keys

- [ ] **ISSUE-#44a** Add `validateName(name: string)` private method to `src/drivers/promptmetrics-s3-driver.ts:43-45` using the same regex pattern as `FilesystemDriver` and `GithubDriver`.
- [ ] **ISSUE-#44b** Call `validateName()` inside `createPrompt()`, `getPrompt()`, `updatePrompt()`, and `deletePrompt()` methods of `S3Driver`.
- [ ] **ISSUE-#44c** Write unit test in `tests/unit/s3-driver.test.ts` attempting to create prompts with malicious names (`../etc/passwd`, `foo/../../../bar`) and asserting 400/validation errors.
- [ ] **ISSUE-#44d** Update `docs/drivers.md` to document prompt naming rules for S3 driver.

### ISSUE-#45 — Rate-limit counters shared by key name, not key hash

- [ ] **ISSUE-#45a** Change rate-limit key construction in `src/middlewares/rate-limit-per-key.middleware.ts:111` from `workspaceId:apiKeyName` to `workspaceId:hashOfActualApiKey` (e.g., SHA-256 of the raw key).
- [ ] **ISSUE-#45b** Alternatively, enforce `UNIQUE(workspace_id, name)` on the `api_keys` table in `migrations/001_initial_schema.ts` and document that rate limiting assumes unique names.
- [ ] **ISSUE-#45c** Write integration test in `tests/integration/rate-limit.test.ts` creating two API keys with the same name and asserting they receive independent rate-limit buckets.
- [ ] **ISSUE-#45d** If schema change is chosen, write migration file to add the unique constraint.

### ISSUE-#46 — PromptService.listPrompts search query unbounded length

- [ ] **ISSUE-#46a** Add a max-length validation (256 characters) for the `q` query parameter in `src/controllers/promptmetrics-prompt.controller.ts:12`.
- [ ] **ISSUE-#46b** Update `src/services/prompt.service.ts:20` to reject or truncate queries exceeding the limit before calling `driver.search()`.
- [ ] **ISSUE-#46c** Write integration test in `tests/integration/prompts.test.ts` sending a query string of 1000+ characters and asserting 400 Bad Request.
- [ ] **ISSUE-#46d** Verify the Joi validation schema in `src/validation-schemas/` includes the length limit.

### ISSUE-#47 — PromptController.getPrompt accepts body on GET request

- [ ] **ISSUE-#47a** Remove `req.body.variables` fallback in `src/controllers/promptmetrics-prompt.controller.ts:37-39`; only read variables from query parameters for GET requests.
- [ ] **ISSUE-#47b** If variable-heavy GET requests are a valid use case, introduce a new `POST /v1/prompts/:name/:version/render` endpoint that accepts a JSON body.
- [ ] **ISSUE-#47c** Write integration test in `tests/integration/prompts.test.ts` sending a GET request with a body and asserting the body is ignored (or returns 400 if body is present).
- [ ] **ISSUE-#47d** Update API documentation and Node SDK to reflect the new POST endpoint if introduced.

### ISSUE-#48 — Migration downgrades are not transaction-safe

- [ ] **ISSUE-#48a** Wrap `down()` implementation in `migrations/001_initial_schema.ts:135-148` inside `db.transaction()`.
- [ ] **ISSUE-#48b** Wrap `down()` implementation in `migrations/004_add_evaluations.ts:36-40` inside `db.transaction()`.
- [ ] **ISSUE-#48c** Audit all other migration files (`migrations/002_*.ts`, `migrations/003_*.ts`, etc.) for similar non-transactional `down()` blocks and fix them.
- [ ] **ISSUE-#48d** Write integration test in `tests/integration/migrations.test.ts` simulating a failed `down()` mid-way and asserting the database schema rolls back to a consistent state.
- [ ] **ISSUE-#48e** Verify `umzug` is configured to pass the transaction object into migration functions if needed.

### ISSUE-#49 — PostgresAdapter.transaction() loses original error if ROLLBACK throws

- [ ] **ISSUE-#49a** Refactor `src/models/postgres.adapter.ts:50-64` to wrap `client.query('ROLLBACK')` in a nested `try/catch`.
- [ ] **ISSUE-#49b** If rollback throws, attach the rollback error as `originalError.rollbackError` and rethrow the original error.
- [ ] **ISSUE-#49c** Write unit test in `tests/unit/postgres.adapter.test.ts` forcing `ROLLBACK` to throw and asserting the original error message is preserved and the rollback error is accessible.
- [ ] **ISSUE-#49d** Ensure no connection leaks by verifying `client.release()` is always called even when both `COMMIT/ROLLBACK` and `release()` could throw.

### ISSUE-#50 — validateQuery middleware mutates req.query via Object.defineProperty

- [ ] **ISSUE-#50a** Change `src/middlewares/promptmetrics-query-validation.middleware.ts:11-16` to write validated output to `req.validatedQuery` instead of overwriting `req.query`.
- [ ] **ISSUE-#50b** Update all controllers that rely on validated query data to read from `req.validatedQuery`.
- [ ] **ISSUE-#50c** Write unit test in `tests/unit/query-validation.middleware.test.ts` asserting `req.query` remains the original parsed object after validation.
- [ ] **ISSUE-#50d** Write integration test verifying third-party middleware (e.g., pagination helpers) that inspect `req.query` are not broken.

### ISSUE-#51 — webhook.route.ts reads GITHUB_WEBHOOK_SECRET directly from process.env

- [ ] **ISSUE-#51a** Add `githubWebhookSecret: string` field to the centralized config object in `src/config/index.ts` with validation and default handling.
- [ ] **ISSUE-#51b** Update `src/routes/webhook.route.ts:16` to import `config` and read `config.githubWebhookSecret`.
- [ ] **ISSUE-#51c** Write unit test in `tests/unit/webhook.route.test.ts` asserting the route uses the config value, not `process.env`.
- [ ] **ISSUE-#51d** Ensure `config.ts` validation throws on startup if `GITHUB_WEBHOOK_SECRET` is missing in production mode.

### ISSUE-#52 — config.ts missing API_KEY_SALT length validation

- [ ] **ISSUE-#52a** Add startup validation in `src/config/index.ts:31` asserting `API_KEY_SALT.length >= 16`.
- [ ] **ISSUE-#52b** If the salt is too short, throw a fatal error with a clear message and exit code 1.
- [ ] **ISSUE-#52c** Write unit test in `tests/unit/config.test.ts` asserting short salts are rejected and 16+ character salts are accepted.
- [ ] **ISSUE-#52d** Update `.env.example` to include a comment about minimum salt length.
- [ ] **ISSUE-#52e** Update `README.md` security section documenting salt requirements.

### ISSUE-#53 — tenantMiddleware blindly trusts X-Workspace-Id header without validation

- [ ] **ISSUE-#53a** Add validation in `src/middlewares/tenant.middleware.ts:3-7` restricting `X-Workspace-Id` to max 128 characters and allowed characters (`a-zA-Z0-9_-`).
- [ ] **ISSUE-#53b** Return 400 Bad Request with a clear error message if the header value is invalid.
- [ ] **ISSUE-#53c** Write integration test in `tests/integration/tenant.test.ts` sending oversized and malicious workspace IDs and asserting 400 responses.
- [ ] **ISSUE-#53d** Write unit test for `tenantMiddleware` in isolation.
- [ ] **ISSUE-#53e** Update API documentation to specify workspace ID constraints.

### ISSUE-#54 — promptmetrics-prompt.route.ts mounts audit-logs endpoint in wrong route file

- [ ] **ISSUE-#54a** Move `/v1/audit-logs` route definition from `src/routes/promptmetrics-prompt.route.ts:49-64` to a new file `src/routes/audit-log.route.ts`.
- [ ] **ISSUE-#54b** Import and mount the new audit-log router in `src/app.ts` at `/v1/audit-logs`.
- [ ] **ISSUE-#54c** Ensure the audit-log controller methods are imported correctly and route middleware (auth, tenant) are preserved.
- [ ] **ISSUE-#54d** Write integration test in `tests/integration/audit-logs.test.ts` verifying the endpoint responds correctly after the move.
- [ ] **ISSUE-#54e** Update `docs/routing.md` or `README.md` route map to reflect the new file organization.

---

## Sprint 4: Low Severity + Tests + Documentation (P2 / Polish)

### ISSUE-#55 — api-key.service.ts listApiKeys return type mismatch

- [ ] **ISSUE-#55a** Correct the return type at `src/services/api-key.service.ts:61` from `PaginatedResponse<Omit<ApiKey, 'id'>>` to `PaginatedResponse<ApiKey>`.
- [ ] **ISSUE-#55b** Alternatively, if `id` should be omitted, update the mapper to exclude `id` and keep the return type.
- [ ] **ISSUE-#55c** Write unit test in `tests/unit/api-key.service.test.ts` asserting the returned pagination object matches the declared type.
- [ ] **ISSUE-#55d** Run `npm run build` and ensure TypeScript compilation passes with `strict` mode.

### ISSUE-#56 — AppError missing toJSON / serialization support

- [ ] **ISSUE-#56a** Add `toJSON()` method to `src/errors/app.error.ts` returning `{ name, message, code, statusCode }`.
- [ ] **ISSUE-#56b** Alternatively, define class properties as `enumerable: true` so `JSON.stringify` captures them.
- [ ] **ISSUE-#56c** Write unit test in `tests/unit/app.error.test.ts` asserting `JSON.stringify(new AppError(...))` includes `statusCode` and `code`.
- [ ] **ISSUE-#56d** Verify the existing error handler middleware in `src/middlewares/error-handler.middleware.ts` still produces correct output.

### ISSUE-#57 — auditLog middleware may enqueue extremely large values

- [ ] **ISSUE-#57a** Truncate `promptName` and `versionTag` strings to 256 characters at `src/middlewares/promptmetrics-audit.middleware.ts:16-25` before enqueueing.
- [ ] **ISSUE-#57b** Add a maximum payload size guard for the entire audit log entry (e.g., 4KB) to prevent buffer abuse.
- [ ] **ISSUE-#57c** Write integration test in `tests/integration/audit-logs.test.ts` sending prompts with 10,000-character names and asserting the audit entry is truncated and the request still succeeds.
- [ ] **ISSUE-#57d** Write unit test for the audit middleware truncation logic.

### ISSUE-#58 — run.service.ts dynamic SQL construction prevents prepared statement reuse

- [ ] **ISSUE-#58a** Refactor `src/services/run.service.ts:126-152` to use a static SQL builder helper (e.g., `buildPartialUpdate(table, updates, where)`) instead of string concatenation.
- [ ] **ISSUE-#58b** Ensure the refactored query still uses `?` placeholders exclusively for security.
- [ ] **ISSUE-#58c** Write unit test in `tests/unit/run.service.test.ts` asserting the generated SQL string and parameter array are correct for various update combinations.
- [ ] **ISSUE-#58d** Verify prepared statement reuse by checking that the same `db.prepare()` statement can be reused across multiple calls.

### ISSUE-#59 — GithubDriver.getPrompt catches all errors silently, making debugging difficult

- [ ] **ISSUE-#59a** Distinguish between "not found" (ENOENT, 404) and "internal error" (network, permissions, JSON parse) in `src/drivers/promptmetrics-github-driver.ts:132-134`.
- [ ] **ISSUE-#59b** Log internal errors with context (prompt name, version, stack trace) at `warn` or `error` level before returning `undefined`.
- [ ] **ISSUE-#59c** Write unit test in `tests/unit/github-driver.test.ts` simulating each failure mode and asserting correct log output and return values.
- [ ] **ISSUE-#59d** Verify OpenTelemetry spans include error tags for internal failures.

### ISSUE-#60 — FilesystemDriver.createPrompt withTransaction is redundant for single statement

- [ ] **ISSUE-#60a** Remove `withTransaction` wrapper in `src/drivers/promptmetrics-filesystem-driver.ts:97-108` and call `db.prepare(...).run(...)` directly.
- [ ] **ISSUE-#60b** Ensure the single INSERT ... ON CONFLICT statement still handles the upsert correctly.
- [ ] **ISSUE-#60c** Write unit test in `tests/unit/filesystem-driver.test.ts` verifying createPrompt behavior is unchanged after removing the transaction.
- [ ] **ISSUE-#60d** Verify no other drivers wrap single statements in unnecessary transactions.

### ISSUE-#61 — package.json dotenv version typo (^17.2.2 does not exist)

- [ ] **ISSUE-#61a** Change `dotenv` version in `package.json:88` from `^17.2.2` to `^16.4.5` (or current latest 16.x).
- [ ] **ISSUE-#61b** Run `npm install` locally and verify lockfile updates cleanly without resolution warnings.
- [ ] **ISSUE-#61c** Run `npm audit` to ensure the corrected version has no known vulnerabilities.
- [ ] **ISSUE-#61d** Update CI workflow to fail on `npm install` warnings if not already configured.
- [ ] **ISSUE-#61e** Commit updated `package-lock.json` alongside `package.json`.

### ISSUE-#62 — Multiple test coverage gaps for adapters, Redis, and edge cases

- [ ] **ISSUE-#62a** Add PostgreSQL adapter unit tests in `tests/unit/postgres.adapter.test.ts` covering placeholder rewriting, `lastInsertRowid`, and transaction nesting.
- [ ] **ISSUE-#62b** Add Redis-backed rate limit integration tests in `tests/integration/rate-limit.test.ts` verifying the Redis path under normal and failure conditions.
- [ ] **ISSUE-#62c** Add webhook security tests in `tests/integration/webhook.test.ts` for invalid signatures, replay attacks, and non-push events.
- [ ] **ISSUE-#62d** Add GitHub driver revert logic unit tests in `tests/unit/github-driver.test.ts` verifying DB-failure cleanup paths.
- [ ] **ISSUE-#62e** Add error handler middleware unit tests in `tests/unit/error-handler.middleware.test.ts` for `SyntaxError`, `AppError` serialization, and 500 production masking.
- [ ] **ISSUE-#62f** Add cache corruption test in `tests/unit/cache.service.test.ts` simulating `JSON.parse` failure.
- [ ] **ISSUE-#62g** Add multi-process SQLite rate limit test or at least document the limitation in `docs/limitations.md`.
- [ ] **ISSUE-#62h** Add S3 path traversal test in `tests/unit/s3-driver.test.ts` for malicious prompt names.
- [ ] **ISSUE-#62i** Extend E2E test in `tests/e2e/full-lifecycle.test.ts` to cover workspace-isolated audit logs.
- [ ] **ISSUE-#62j** Run `npm test -- --coverage` and ensure overall coverage reaches 85%+ lines.
- [ ] **ISSUE-#62k** Update `docs/testing.md` with a coverage report badge and instructions.

---

## Cross-Cutting Tasks

- [ ] **XCT-1** Run `npm run lint` and `npm run lint:fix` across all modified files in Sprints 1–4.
- [ ] **XCT-2** Run `npm run format` to ensure consistent code style.
- [ ] **XCT-3** Update `.env.example` with any new configuration variables introduced (e.g., `GITHUB_WEBHOOK_SECRET` validation, salt length requirements).
- [ ] **XCT-4** Update `README.md` setup instructions if PostgreSQL-specific setup steps changed.
- [ ] **XCT-5** Update Node SDK (`clients/node/src/index.ts`) if any endpoint signatures changed (e.g., new POST render endpoint).
- [ ] **XCT-6** Update CLI (`src/cli/promptmetrics-cli.ts`) if any command signatures changed.
- [ ] **XCT-7** Ensure all new files have the standard license header (if applicable).
- [ ] **XCT-8** Review all ADRs added during sprints for completeness and sign-off.

---

## Release Checklist

- [ ] **REL-1** All Sprint 1 critical fixes merged to `main` and tagged as `v1.0.10-rc1`.
- [ ] **REL-2** All Sprint 2 high-severity fixes merged to `main` and tagged as `v1.0.10-rc2`.
- [ ] **REL-3** All Sprint 3 medium-severity fixes merged to `main` and tagged as `v1.0.10-rc3`.
- [ ] **REL-4** All Sprint 4 low-severity fixes and tests merged to `main` and tagged as `v1.0.10-rc4`.
- [ ] **REL-5** Full CI pass (unit, integration, E2E) on `main` with both SQLite and PostgreSQL backends.
- [ ] **REL-6** Security scan passes (`npm audit`, Snyk, or equivalent) with zero high/critical vulnerabilities.
- [ ] **REL-7** Performance regression test: rate-limit throughput does not degrade by more than 5% vs `v1.0.9`.
- [ ] **REL-8** Update `CHANGELOG.md` with all 31 issue references, severity labels, and contributor credits.
- [ ] **REL-9** Update `package.json` version to `1.0.10`.
- [ ] **REL-10** Create GitHub Release with release notes and attach `sbom.json` if generated.
- [ ] **REL-11** Publish npm package (`npm publish`) and verify `npm install promptmetrics@latest` succeeds.
- [ ] **REL-12** Announce release in repository Discussions or linked communication channel.
