# PromptMetrics Implementation Plan

**Derived from:** [Architecture & Code Review](../reviews/2026-04-24-promptmetrics-architecture-code-review.md)
**Date:** 2026-04-24
**Status:** Approved | GitHub Milestones + Issues Created

---

## How to Read This Plan

This document breaks every recommendation from the review into **phases**, **epics**, and **tasks**. Each task includes:
- **Goal** -- what we are solving
- **Files to modify** -- specific paths
- **Implementation approach** -- how to do it
- **Testing strategy** -- how to verify it
- **Dependencies** -- what must be done first
- **Estimated effort** -- in hours/days

---

## Phase 1: Quick Wins (Week 1)

*Goal: Fix known bugs, close security gaps, and apply zero-dependency improvements before any larger refactor.*

### Epic 1.1 -- Fix Driver Singleton Bug
**GitHub Issue:** [#10](https://github.com/iiizzzyyy/promptmetrics/issues/10)

**Task 1.1.1 -- Pass driver instance from server.ts into createApp()**
- **Files:** `src/server.ts`, `src/app.ts`
- **Approach:** Change `createApp()` to accept `driver: PromptDriver` as an argument. In `server.ts`, instantiate the driver once and pass it to both `GitSyncJob` and `createApp(driver)`. Remove the `createDriver()` call inside `createApp()`.
- **Testing:** Verify integration tests still pass. Confirm `GitSyncJob` and routes share the same driver reference via a debug log or assertion.
- **Dependencies:** None
- **Effort:** 30 min

---

### Epic 1.2 -- Replace Custom Regex Rendering with Mustache
**GitHub Issue:** [#11](https://github.com/iiizzzyyy/promptmetrics/issues/11)

**Task 1.2.1 -- Refactor PromptController.getPrompt() rendering logic**
- **Files:** `src/controllers/promptmetrics-prompt.controller.ts`
- **Approach:** Replace the custom `replace(new RegExp(...))` loop with `mustache.render(msg.content, variables)`. `mustache` is already in `package.json`. Only render `system` and `user` role messages (skip `assistant`).
- **Testing:** Add integration tests that verify variable substitution with edge cases (missing optional vars, special characters, empty strings).
- **Dependencies:** None
- **Effort:** 1 hour

---

### Epic 1.3 -- Add Request ID Middleware
**GitHub Issue:** [#12](https://github.com/iiizzzyyy/promptmetrics/issues/12)

**Task 1.3.1 -- Generate and propagate x-request-id**
- **Files:** `src/app.ts` (new middleware), `src/server.ts` (optionally log it)
- **Approach:** Add middleware near the top of the Express stack that generates a UUID v4 (`crypto.randomUUID()`), sets it on `req.requestId`, and adds the `X-Request-Id` header to the response. Optionally attach it to the structured logger context.
- **Testing:** Integration tests should assert that every response includes `X-Request-Id`. Verify the same ID appears in logs.
- **Dependencies:** None
- **Effort:** 1 hour

---

### Epic 1.4 -- Sanitize Production Error Responses
**GitHub Issue:** [#13](https://github.com/iiizzzyyy/promptmetrics/issues/13)

**Task 1.4.1 -- Remove err.message from 500 responses in production**
- **Files:** `src/app.ts`
- **Approach:** In the global error handler, return `{ error: 'Internal server error' }` when `config.nodeEnv === 'production'`. Keep the message in development.
- **Testing:** Add an integration test that forces a 500 and asserts the response body does not contain the raw error message when `NODE_ENV=production`.
- **Dependencies:** None
- **Effort:** 15 min

---

### Epic 1.5 -- Add Compression Middleware
**GitHub Issue:** [#14](https://github.com/iiizzzyyy/promptmetrics/issues/14)

**Task 1.5.1 -- Install and wire compression**
- **Files:** `src/app.ts`, `package.json`
- **Approach:** `npm install compression` and `@types/compression`. Add `app.use(compression())` after helmet/cors and before JSON parser.
- **Testing:** Integration tests should not break. Optionally add a test asserting `Content-Encoding: gzip` on a large response.
- **Dependencies:** None
- **Effort:** 15 min

---

## Phase 2: Short-Term Stability & Polish (Weeks 1-2)

*Goal: Reduce controller bloat, standardize patterns, and harden input validation.*

### Epic 2.1 -- Centralize Error Handling
**GitHub Issue:** [#15](https://github.com/iiizzzyyy/promptmetrics/issues/15)

**Task 2.1.1 -- Create AppError class**
- **Files:** `src/errors/app.error.ts` (new)
- **Approach:** Define `class AppError extends Error` with `statusCode`, `code`, and optional `details`. Export factory methods: `badRequest()`, `notFound()`, `unauthorized()`, `forbidden()`, `validationFailed()`.
- **Testing:** Unit tests for the error class constructors.
- **Dependencies:** None
- **Effort:** 30 min

**Task 2.1.2 -- Add global Express error handler middleware**
- **Files:** `src/middlewares/error-handler.middleware.ts` (new), `src/app.ts`
- **Approach:** Create middleware that catches `AppError` instances and maps them to the correct HTTP status and JSON shape. Catches unexpected errors and returns 500 with sanitized messages in production. Register it after all routes in `app.ts`.
- **Testing:** Integration tests for each error type. Assert that unknown errors are sanitized in production.
- **Dependencies:** Task 2.1.1
- **Effort:** 1 hour

**Task 2.1.3 -- Refactor all controllers to throw AppError instead of manual res.status().json()**
- **Files:** `src/controllers/*.controller.ts`
- **Approach:** Replace every `try/catch` block that returns `res.status(500).json(...)` with `throw AppError.internal(...)`. Replace validation failures with `throw AppError.validationFailed(...)`. Replace not-found cases with `throw AppError.notFound(...)`.
- **Testing:** All existing integration tests should still pass. Add tests for each new error path.
- **Dependencies:** Task 2.1.1, Task 2.1.2
- **Effort:** 2 hours

---

### Epic 2.2 -- Extract Service Layer
**GitHub Issue:** [#16](https://github.com/iiizzzyyy/promptmetrics/issues/16)

**Task 2.2.1 -- Create PromptService**
- **Files:** `src/services/prompt.service.ts` (new), `src/controllers/promptmetrics-prompt.controller.ts`
- **Approach:** Move business logic out of `PromptController` into `PromptService`:
  - `listPrompts(query?, page, limit)`
  - `getPrompt(name, version?, variables?)` (includes rendering)
  - `listVersions(name, page, limit)`
  - `createPrompt(promptFile)`
- **Testing:** Unit tests for `PromptService` with a mocked driver. Integration tests for the controller remain but become thinner.
- **Dependencies:** Task 2.1.1 (AppError for validation failures)
- **Effort:** 3 hours

**Task 2.2.2 -- Create LogService, TraceService, RunService, LabelService**
- **Files:** `src/services/log.service.ts`, `src/services/trace.service.ts`, `src/services/run.service.ts`, `src/services/label.service.ts` (new)
- **Approach:** Extract SQL and business logic from each controller into dedicated services. Each service receives the driver or DB connection via constructor injection.
- **Testing:** Unit tests for each service with mocked DB.
- **Dependencies:** Task 2.1.1
- **Effort:** 3 hours

**Task 2.2.3 -- Refactor controllers to delegate to services**
- **Files:** `src/controllers/*.controller.ts`
- **Approach:** Strip controllers down to HTTP parsing, service invocation, and response formatting.
- **Testing:** All integration tests must pass without modification.
- **Dependencies:** Task 2.2.1, Task 2.2.2
- **Effort:** 2 hours

---

### Epic 2.3 -- Standardize Pagination
**GitHub Issue:** [#17](https://github.com/iiizzzyyy/promptmetrics/issues/17)

**Task 2.3.1 -- Create pagination helper**
- **Files:** `src/utils/pagination.ts` (new)
- **Approach:** Export `paginateResponse<T>(items: T[], total: number, page: number, limit: number)` that returns `{ items, total, page, limit, totalPages }`. Also export `parsePagination(req.query)` to extract and clamp `page`/`limit`.
- **Testing:** Unit tests for clamping logic (page < 1, limit > 100, etc.).
- **Dependencies:** None
- **Effort:** 30 min

**Task 2.3.2 -- Apply pagination helper across all routes**
- **Files:** `src/routes/*.route.ts`, `src/controllers/*.controller.ts`
- **Approach:** Replace manual `(page - 1) * limit` math with the helper. Ensure every paginated endpoint returns the same shape.
- **Testing:** Integration tests verify `totalPages` exists on every paginated response.
- **Dependencies:** Task 2.3.1
- **Effort:** 1 hour

---

### Epic 2.4 -- Query Parameter Validation
**GitHub Issue:** [#18](https://github.com/iiizzzyyy/promptmetrics/issues/18)

**Task 2.4.1 -- Create reusable query validation middleware**
- **Files:** `src/middlewares/validate-query.middleware.ts` (new)
- **Approach:** Accept a Joi schema. Validate `req.query`. On failure, throw `AppError.validationFailed()` with details.
- **Testing:** Unit tests for middleware behavior.
- **Dependencies:** Task 2.1.1
- **Effort:** 1 hour

**Task 2.4.2 -- Apply query validation to all routes**
- **Files:** `src/routes/*.route.ts`
- **Approach:** Define schemas for `page`, `limit`, `version`, `q`, etc. Add middleware to routes that accept query params.
- **Testing:** Integration tests for invalid query params (negative page, non-numeric limit).
- **Dependencies:** Task 2.4.1
- **Effort:** 1 hour

---

## Phase 3: Medium-Term Production Hardening (Weeks 3-6)
**Roadmap Tracker:** [#19](https://github.com/iiizzzyyy/promptmetrics/issues/19)

*Goal: Database transactions, migrations, async audit logging, caching, and security improvements.*

### Epic 3.1 -- Introduce Migration System

**Task 3.1.1 -- Choose and install migration tool**
- **Options:** `drizzle-orm` (type-safe, modern) or `umzug` (lightweight, SQL-based).
- **Recommendation:** `umzug` with raw SQL files to minimize code churn. Drizzle is better long-term but requires more refactoring.
- **Files:** `package.json`, new `migrations/` directory
- **Approach:** Add `umzug` as a dependency. Create a `migrations/` folder with numbered `.sql` files. Add `npm run migrate` script. On startup, run pending migrations after `initSchema()`.
- **Testing:** Unit tests verify migration runner applies files in order and skips already-run migrations.
- **Dependencies:** None
- **Effort:** 1 day

**Task 3.1.2 -- Extract existing schema into migration files**
- **Files:** `src/models/promptmetrics-sqlite.ts`, `migrations/001_initial_schema.sql`, `migrations/002_add_ollama_columns.sql`
- **Approach:** Move all `CREATE TABLE` statements into `001_initial_schema.sql`. Move the Ollama `ALTER TABLE` additions into `002_add_ollama_columns.sql`. Update `initSchema()` to call the migration runner instead of inline SQL.
- **Testing:** Fresh database creation should produce the same schema. Existing databases should skip initial migration and apply only new ones.
- **Dependencies:** Task 3.1.1
- **Effort:** 1 day

---

### Epic 3.2 -- Add Database Transactions

**Task 3.2.1 -- Create transaction helper**
- **Files:** `src/models/promptmetrics-sqlite.ts`
- **Approach:** Add `withTransaction<T>(fn: (db) => T): T` that begins a transaction, executes the callback, and commits on success or rolls back on error. `better-sqlite3` supports `.transaction()` natively.
- **Testing:** Unit tests verify commit on success and rollback on error.
- **Dependencies:** Task 3.1.2 (migration system ensures schema stability)
- **Effort:** 2 hours

**Task 3.2.2 -- Wrap multi-step driver operations in transactions**
- **Files:** `src/drivers/promptmetrics-filesystem-driver.ts`, `src/drivers/promptmetrics-github-driver.ts`
- **Approach:** In `createPrompt()`, wrap the file write + SQLite INSERT inside a transaction. On failure of either step, rollback the SQLite insert. Note: filesystem/GitHub writes cannot be rolled back, so the pattern should be: write to storage first, then INSERT inside a transaction. If INSERT fails, attempt to delete/rollback the storage write.
- **Testing:** Integration tests that simulate a storage failure and assert the database remains consistent.
- **Dependencies:** Task 3.2.1
- **Effort:** 2 days

---

### Epic 3.3 -- Replace execSync Git Calls

**Task 3.3.1 -- Install and configure simple-git**
- **Files:** `package.json`
- **Approach:** `npm install simple-git`. Replace `execSync('git clone ...')` and `execSync('git pull')` in `GithubDriver` with `simpleGit()` instance methods.
- **Testing:** Mock `simple-git` in unit tests. Verify error handling for authentication failures and merge conflicts.
- **Dependencies:** None
- **Effort:** 1 day

---

### Epic 3.4 -- Implement Async Audit Log Queue

**Task 3.4.1 -- Create in-memory audit log queue**
- **Files:** `src/services/audit-log.service.ts` (new)
- **Approach:** Use `EventEmitter` or a ring buffer. Queue audit entries and flush to SQLite in batches (e.g., every 100 entries or 5 seconds). On shutdown, flush remaining entries.
- **Testing:** Unit tests verify batching and flush behavior. Integration tests verify audit logs are still written after requests complete.
- **Dependencies:** None
- **Effort:** 1 day

**Task 3.4.2 -- Replace monkey-patched res.send with event-based audit logging**
- **Files:** `src/middlewares/promptmetrics-audit.middleware.ts`, `src/app.ts`
- **Approach:** Remove the `res.send` patch. Instead, emit an event in a response `on-finish` listener or a lightweight middleware that runs after routes. The audit service listens and queues entries.
- **Testing:** Integration tests verify audit logs are still captured for all mutation endpoints.
- **Dependencies:** Task 3.4.1
- **Effort:** 1 day

---

### Epic 3.5 -- Add LRU Cache for Prompt Lookups

**Task 3.5.1 -- Install and configure lru-cache**
- **Files:** `package.json`, `src/services/cache.service.ts` (new)
- **Approach:** `npm install lru-cache`. Create a thin wrapper around `LRUCache` with TTL (e.g., 60s). Cache key format: `prompt:{name}:{version}`.
- **Testing:** Unit tests verify cache hits/misses and TTL expiration.
- **Dependencies:** None
- **Effort:** 2 hours

**Task 3.5.2 -- Integrate cache into PromptService**
- **Files:** `src/services/prompt.service.ts`
- **Approach:** Check cache before hitting the driver. Invalidate cache entries on `createPrompt()`.
- **Testing:** Integration tests verify cache behavior: first request hits driver, second request hits cache.
- **Dependencies:** Task 2.2.1, Task 3.5.1
- **Effort:** 2 hours

---

### Epic 3.6 -- Add OpenAPI Documentation

**Task 3.6.1 -- Install and configure swagger-ui-express + openapi spec**
- **Files:** `package.json`, `src/app.ts`, `docs/openapi.yaml` (new)
- **Approach:** Manually author `docs/openapi.yaml` covering all v1 endpoints. Serve it at `/docs` using `swagger-ui-express`. Alternatively, use `joi-to-swagger` to auto-generate from Joi schemas.
- **Testing:** Verify `/docs` renders correctly. Validate the spec with a linter.
- **Dependencies:** None
- **Effort:** 2 days

---

### Epic 3.7 -- Circuit Breaker for GitHub API

**Task 3.7.1 -- Install and configure opossum**
- **Files:** `package.json`, `src/drivers/promptmetrics-github-driver.ts`
- **Approach:** `npm install opossum`. Wrap GitHub API calls (contents PUT, refs POST) in a circuit breaker. Configure thresholds: open after 5 failures in 60s, half-open after 30s.
- **Testing:** Unit tests with mocked failures verify breaker state transitions.
- **Dependencies:** None
- **Effort:** 1 day

---

### Epic 3.8 -- Per-API-Key Rate Limiting

**Task 3.8.1 -- Extend rate limiter to use API key identity**
- **Files:** `src/app.ts`, `src/middlewares/rate-limit.middleware.ts` (new)
- **Approach:** Create custom rate limit middleware that reads `req.apiKey.name` (or falls back to IP) and stores counters in SQLite. Use a sliding window or token bucket algorithm. Different limits per scope (e.g., `read` vs `write`).
- **Testing:** Integration tests verify that two different API keys have independent rate limits.
- **Dependencies:** None
- **Effort:** 1 day

---

### Epic 3.9 -- Key Expiration and Rotation

**Task 3.9.1 -- Add expires_at column and rotation workflow**
- **Files:** `src/models/promptmetrics-sqlite.ts` (migration), `src/middlewares/promptmetrics-auth.middleware.ts`, `src/scripts/generate-api-key.ts`
- **Approach:** Add `expires_at INTEGER` to `api_keys` table. In auth middleware, reject expired keys with a specific error message. Update `generate-api-key.ts` to accept an optional `--expires-in-days` flag.
- **Testing:** Integration tests verify expired keys are rejected. Unit tests verify rotation script generates keys with expiration.
- **Dependencies:** Task 3.1.2 (migration system)
- **Effort:** 1 day

---

## Phase 4: Long-Term Scale & Ecosystem (Months 2-6)
**Roadmap Tracker:** [#19](https://github.com/iiizzzyyy/promptmetrics/issues/19)

*Goal: PostgreSQL support, Redis, webhooks, web UI, multi-language SDKs, and multi-tenancy.*

### Epic 4.1 -- PostgreSQL Backend Support

**Task 4.1.1 -- Abstract database connection behind an interface**
- **Files:** `src/models/database.interface.ts`, `src/models/sqlite.adapter.ts`, `src/models/postgres.adapter.ts`
- **Approach:** Define `DatabaseAdapter` interface with methods: `query()`, `transaction()`, `close()`. Implement for SQLite (wrapping `better-sqlite3`) and PostgreSQL (using `pg` or `drizzle-orm`). Update `getDb()` to return the configured adapter.
- **Testing:** Unit tests for both adapters with identical SQL assertions.
- **Dependencies:** Task 3.1.2 (migration system must support both backends)
- **Effort:** 1 week

**Task 4.1.2 -- Add PostgreSQL connection config and docker-compose profile**
- **Files:** `.env.example`, `docker-compose.yml`
- **Approach:** Add `DATABASE_URL` env var. Provide a `docker-compose.postgres.yml` for local testing.
- **Testing:** CI runs tests against both SQLite and PostgreSQL.
- **Dependencies:** Task 4.1.1
- **Effort:** 2 days

---

### Epic 4.2 -- Redis Integration

**Task 4.2.1 -- Add Redis for caching and rate limiting**
- **Files:** `package.json`, `src/services/redis.service.ts` (new)
- **Approach:** Install `ioredis`. Replace in-memory LRU cache with Redis when `REDIS_URL` is configured. Replace SQLite-based rate limit counters with Redis.
- **Testing:** Mock Redis in unit tests. Provide a `docker-compose.redis.yml` for integration tests.
- **Dependencies:** Task 3.5, Task 3.8
- **Effort:** 3 days

---

### Epic 4.3 -- GitHub Webhook Support

**Task 4.3.1 -- Add webhook endpoint for GitHub push events**
- **Files:** `src/routes/webhook.route.ts` (new), `src/jobs/promptmetrics-git-sync.job.ts`
- **Approach:** Expose `POST /webhooks/github` that verifies the GitHub webhook signature (`X-Hub-Signature-256`) and triggers an immediate `git fetch` instead of polling. Make the `GitSyncJob` optional (disable when webhooks are configured).
- **Testing:** Integration tests with mocked GitHub webhook payloads.
- **Dependencies:** Task 3.3
- **Effort:** 2 days

---

### Epic 4.4 -- Web UI Dashboard

**Task 4.4.1 -- Scaffold Next.js dashboard in `ui/` directory**
- **Files:** New `ui/` directory with Next.js + Tailwind + shadcn/ui
- **Approach:** Create a separate Next.js app that consumes the PromptMetrics REST API. Pages: prompt list, prompt detail/version history, logs viewer, traces/runs viewer, labels manager, settings.
- **Testing:** E2E tests with Playwright. Component tests with React Testing Library.
- **Dependencies:** Task 3.6 (OpenAPI spec enables API client generation)
- **Effort:** 3 weeks

---

### Epic 4.5 -- Python SDK

**Task 4.5.1 -- Create `clients/python/` package**
- **Files:** `clients/python/promptmetrics/client.py`, `clients/python/setup.py`, etc.
- **Approach:** Mirror the Node SDK API surface: `PromptMetrics(base_url, api_key)` with `.prompts.list()`, `.prompts.get()`, `.logs.create()`, etc. Use `httpx` for async support.
- **Testing:** pytest with mocked HTTP responses.
- **Dependencies:** Task 3.6 (OpenAPI spec enables SDK stub generation)
- **Effort:** 1 week

---

### Epic 4.6 -- Prompt Evaluation Framework

**Task 4.6.1 -- Add evaluation and scoring tables**
- **Files:** `src/models/promptmetrics-sqlite.ts` (migration), `src/routes/evaluation.route.ts` (new)
- **Approach:** Tables: `evaluations` (id, prompt_name, version_tag, dataset_id, status), `evaluation_results` (id, evaluation_id, input, expected_output, actual_output, score). Endpoints: `POST /v1/evaluations`, `GET /v1/evaluations/:id`, `POST /v1/evaluations/:id/runs`.
- **Testing:** Integration tests for CRUD and scoring calculation.
- **Dependencies:** Task 3.1.2
- **Effort:** 1 week

---

### Epic 4.7 -- S3-Compatible Storage Driver

**Task 4.7.1 -- Implement S3Driver**
- **Files:** `src/drivers/promptmetrics-s3-driver.ts` (new)
- **Approach:** Implement `PromptDriver` using `@aws-sdk/client-s3`. Store prompt JSON as objects in S3 with keys like `prompts/{name}/{version}.json`. List prompts via `ListObjectsV2`.
- **Testing:** Unit tests with mocked S3 client (`aws-sdk-client-mock`).
- **Dependencies:** None
- **Effort:** 3 days

---

### Epic 4.8 -- Multi-Tenancy

**Task 4.8.1 -- Add workspace isolation**
- **Files:** `src/models/promptmetrics-sqlite.ts` (migration), `src/middlewares/tenant.middleware.ts` (new), all controllers/services
- **Approach:** Add `workspace_id` to all tables. Extract `X-Workspace-Id` header in middleware and scope all queries. Update auth to validate API key belongs to the workspace.
- **Testing:** Integration tests verify cross-tenant data isolation.
- **Dependencies:** Task 3.1.2
- **Effort:** 2 weeks

---

## Testing Strategy Summary

| Phase | Test Focus |
|---|---|
| Phase 1 | Integration tests for each quick win. No breaking changes expected. |
| Phase 2 | Unit tests for services and utilities. Integration tests for controller thinning. |
| Phase 3 | Integration tests for transactions, migration runner, cache invalidation, audit queue flush. |
| Phase 4 | Full E2E suites for new backends, SDK contract tests, Playwright tests for UI. |

---

## Dependency Graph

```
Phase 1 (Quick Wins)
  |
  v
Phase 2 (Stability)
  |
  +-- Epic 2.1 (AppError) --+-- Epic 2.2 (Service Layer)
  |                          +-- Epic 2.4 (Query Validation)
  |
  v
Phase 3 (Production Hardening)
  |
  +-- Epic 3.1 (Migrations) --+-- Epic 3.2 (Transactions)
  |                            +-- Epic 3.9 (Key Expiration)
  |                            +-- Epic 4.6 (Evaluations)
  |                            +-- Epic 4.8 (Multi-Tenancy)
  |
  +-- Epic 2.2 (Services) -----+-- Epic 3.5 (LRU Cache)
  |
  +-- Epic 3.3 (simple-git) ---+-- Epic 4.3 (Webhooks)
  |
  v
Phase 4 (Scale & Ecosystem)
```

---

## GitHub Project Management Strategy (Option D)

This plan is managed on GitHub using **Milestones + Epic Issues**.

### Labels

| Label | Color | Purpose |
|---|---|---|
| `phase:1` | `#1d76db` | Quick Wins |
| `phase:2` | `#5319e7` | Stability & Polish |
| `phase:3` | `#b60205` | Production Hardening |
| `phase:4` | `#0e8a16` | Scale & Ecosystem |
| `priority:p0` | `#d93f0b` | Blocker / must have |
| `priority:p1` | `#fbca04` | Important / should have |
| `priority:p2` | `#c5def5` | Nice to have |
| `area:security` | `#ff7619` | Security-related |
| `area:performance` | `#006b75` | Performance-related |
| `area:architecture` | `#0052cc` | Architecture/refactor |
| `area:dx` | `#84b6eb` | Developer experience |
| `area:testing` | `#cc317c` | Testing |
| `area:docs` | `#0075ca` | Documentation |

### Milestones

| Milestone | Due Date | Description |
|---|---|---|
| Phase 1: Quick Wins | 2026-05-01 | Zero-dependency bug fixes and security hardening |
| Phase 2: Stability & Polish | 2026-05-15 | Service layer, error handling, pagination, validation |
| Phase 3: Production Hardening | 2026-06-15 | Migrations, transactions, caching, circuit breakers |
| Phase 4: Scale & Ecosystem | 2026-08-15 | PostgreSQL, Redis, Web UI, SDKs, multi-tenancy |

### Epic Issues

Phase 1 and Phase 2 epics each have a dedicated GitHub issue. Phase 3-4 epics are tracked in the pinned Roadmap meta-issue until Phase 2 is complete.

### Issue Naming Convention

- Epics: `epic(scope): Brief description`  
  Example: `epic(app): Fix driver singleton instantiation`
- Tasks: `task(scope): Brief description`  
  Example: `task(controller): Refactor getPrompt to use mustache.render()`
- Bugs: `fix(scope): Brief description`
- Features: `feat(scope): Brief description`

### Workflow

1. Pick an epic issue from the current milestone
2. Create a feature branch: `feat/<issue-number>-short-description`
3. Implement tasks from BUILD_TASKS.md
4. Open a PR referencing the epic issue: `Closes #<issue-number>`
5. On merge, the epic issue auto-closes; milestone progress updates automatically
6. When a milestone reaches 100%, close it and move to the next

---

## Approval Checklist

Before implementation begins, confirm the following:

- [x] Phase scope is acceptable (Phases 1-2 approved; 3-4 deferred)
- [x] Technology choices are approved (`umzug`, `simple-git`, `opossum`, `lru-cache`)
- [x] PostgreSQL and Redis epics are deferred to Phase 4
- [x] Web UI epic is deferred to Phase 4
- [x] Multi-tenancy is deferred to Phase 4
- [x] GitHub project management strategy approved (Option D: Milestones + Epic Issues)

---

*Plan generated on 2026-04-24.*
