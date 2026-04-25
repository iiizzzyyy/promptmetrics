# PromptMetrics Build Tasks List

**Derived from:** [Implementation Plan](./IMPLEMENTATION_PLAN.md)
**Date:** 2026-04-24
**Status:** Approved | Linked to GitHub Issues

---

## Legend

- `[ ]` -- Not started
- `[-]` -- In progress
- `[x]` -- Complete
- `**BLOCKED**` -- Waiting on dependency

---

## Phase 1: Quick Wins

**Milestone:** [Phase 1: Quick Wins](https://github.com/iiizzzyyy/promptmetrics/milestone/1)

### Epic 1.1 -- Fix Driver Singleton Bug
**GitHub Issue:** [#10](https://github.com/iiizzzyyy/promptmetrics/issues/10)

- [x] **1.1.1** Update `src/app.ts` signature: `export function createApp(driver: PromptDriver): Application`
- [x] **1.1.2** Remove `import { createDriver }` and `const driver = createDriver()` from `src/app.ts`
- [x] **1.1.3** Update `src/server.ts` to instantiate driver once: `const driver = createDriver();`
- [x] **1.1.4** Pass driver to `createApp(driver)` and to `GitSyncJob`
- [x] **1.1.5** Run tests: `npx jest tests/integration/prompts.test.ts`
- [x] **1.1.6** Run E2E: `npx jest tests/e2e`
- [x] **1.1.7** Commit: `git commit -m "fix: singleton driver instance shared between app and sync job"`

---

### Epic 1.2 -- Replace Custom Regex Rendering with Mustache
**GitHub Issue:** [#11](https://github.com/iiizzzyyy/promptmetrics/issues/11)

- [x] **1.2.1** Verify `mustache` is in `package.json` dependencies
- [x] **1.2.2** In `src/controllers/promptmetrics-prompt.controller.ts`, replace regex rendering loop with `mustache.render(msg.content, variables)` for `system` and `user` roles only
- [x] **1.2.3** Remove the old regex-based rendering code
- [x] **1.2.4** Add integration test in `tests/integration/prompts.test.ts` for edge cases:
  - Missing optional variable
  - Variable with special characters (`<`, `>`, `"`)
  - Empty string variable
  - Variable name containing spaces (should fail gracefully)
- [x] **1.2.5** Run tests: `npx jest tests/integration/prompts.test.ts`
- [x] **1.2.6** Commit: `git commit -m "refactor: use mustache for prompt variable rendering"`

---

### Epic 1.3 -- Add Request ID Middleware
**GitHub Issue:** [#12](https://github.com/iiizzzyyy/promptmetrics/issues/12)

- [x] **1.3.1** Create `src/middlewares/request-id.middleware.ts`:
  - Import `crypto` from Node.js
  - Generate `crypto.randomUUID()`
  - Attach to `req.requestId`
  - Set response header `X-Request-Id`
- [x] **1.3.2** Add middleware to `src/app.ts` near the top of the middleware stack (before routes)
- [x] **1.3.3** Update `src/interfaces/express.d.ts` to extend `Request` with `requestId?: string`
- [x] **1.3.4** Add integration test asserting `X-Request-Id` header exists on every response
- [x] **1.3.5** Add integration test asserting the same request ID is returned in response headers
- [x] **1.3.6** (Optional) Attach `requestId` to structured logger context in `src/services/promptmetrics-logger.service.ts`
- [x] **1.3.7** Run all integration tests
- [x] **1.3.8** Commit: `git commit -m "feat: add x-request-id middleware for request correlation"`

---

### Epic 1.4 -- Sanitize Production Error Responses
**GitHub Issue:** [#13](https://github.com/iiizzzyyy/promptmetrics/issues/13)

- [x] **1.4.1** In `src/app.ts` global error handler, wrap `err.message` output:
  ```ts
  message: config.nodeEnv === 'development' ? err.message : undefined
  ```
- [x] **1.4.2** Add integration test that:
  - Forces a 500 error (e.g., mock a controller to throw)
  - Sets `NODE_ENV=production`
  - Asserts response body does NOT contain the raw error message
- [x] **1.4.3** Add integration test that verifies `err.message` IS present when `NODE_ENV=development`
- [x] **1.4.4** Run tests: `npx jest tests/integration/`
- [x] **1.4.5** Commit: `git commit -m "security: sanitize error messages in production responses"`

---

### Epic 1.5 -- Add Compression Middleware
**GitHub Issue:** [#14](https://github.com/iiizzzyyy/promptmetrics/issues/14)

- [x] **1.5.1** Run: `npm install compression @types/compression`
- [x] **1.5.2** In `src/app.ts`, add `import compression from 'compression'` and `app.use(compression())` after helmet/cors, before JSON parser
- [x] **1.5.3** Add integration test that asserts `Content-Encoding: gzip` on a large JSON response (>1KB)
- [x] **1.5.4** Verify no existing tests break: `npm test`
- [x] **1.5.5** Commit: `git commit -m "perf: add gzip compression middleware"`

---

## Phase 2: Short-Term Stability & Polish

**Milestone:** [Phase 2: Stability & Polish](https://github.com/iiizzzyyy/promptmetrics/milestone/2)

### Epic 2.1 -- Centralize Error Handling
**GitHub Issue:** [#15](https://github.com/iiizzzyyy/promptmetrics/issues/15)

#### Task 2.1.1 -- Create AppError class
- [x] **2.1.1.1** Create `src/errors/app.error.ts`:
  ```ts
  export class AppError extends Error {
    constructor(
      message: string,
      public statusCode: number,
      public code: string,
      public details?: string[]
    ) { super(message); }
  }
  export const badRequest = (msg, details?) => new AppError(msg, 400, 'BAD_REQUEST', details);
  export const unauthorized = (msg?) => new AppError(msg || 'Unauthorized', 401, 'UNAUTHORIZED');
  export const forbidden = (msg?) => new AppError(msg || 'Forbidden', 403, 'FORBIDDEN');
  export const notFound = (msg?) => new AppError(msg || 'Not found', 404, 'NOT_FOUND');
  export const validationFailed = (details) => new AppError('Validation failed', 422, 'VALIDATION_FAILED', details);
  export const internal = (msg?) => new AppError(msg || 'Internal server error', 500, 'INTERNAL_ERROR');
  ```
- [x] **2.1.1.2** Unit tests in `tests/unit/errors/app.error.test.ts` for each factory method
- [x] **2.1.1.3** Commit: `git commit -m "feat: add AppError class with typed HTTP status codes"`

#### Task 2.1.2 -- Add global Express error handler middleware
- [x] **2.1.2.1** Create `src/middlewares/error-handler.middleware.ts`:
  - Check `err instanceof AppError`
  - Map to `err.statusCode` and JSON shape `{ error, code, details? }`
  - Fallback to 500 with sanitized message in production
- [x] **2.1.2.2** Register middleware in `src/app.ts` AFTER all routes: `app.use(errorHandler)`
- [x] **2.1.2.3** Remove the existing inline error handler from `src/app.ts` (the one at line 39-46)
- [x] **2.1.2.4** Integration tests in `tests/integration/errors.test.ts` for each error type
- [x] **2.1.2.5** Commit: `git commit -m "feat: add centralized Express error handler middleware"`

#### Task 2.1.3 -- Refactor controllers to throw AppError
- [x] **2.1.3.1** `src/controllers/promptmetrics-prompt.controller.ts`:
  - Replace all `res.status(500).json({ error, message })` with `throw AppError.internal(...)`
  - Replace validation block with `throw AppError.validationFailed(...)`
  - Replace `res.status(404)` with `throw AppError.notFound(...)`
- [x] **2.1.3.2** `src/controllers/promptmetrics-log.controller.ts` -- same pattern
- [x] **2.1.3.3** `src/controllers/promptmetrics-trace.controller.ts` -- same pattern
- [x] **2.1.3.4** `src/controllers/promptmetrics-run.controller.ts` -- same pattern
- [x] **2.1.3.5** `src/controllers/promptmetrics-label.controller.ts` -- same pattern
- [x] **2.1.3.6** Update `tests/integration/*.test.ts` assertions to expect new error response shape `{ error, code, details }` instead of `{ error, message }`
- [x] **2.1.3.7** Run all tests: `npm test`
- [x] **2.1.3.8** Commit: `git commit -m "refactor: use AppError in all controllers, remove manual res.status calls"`

---

### Epic 2.2 -- Extract Service Layer
**GitHub Issue:** [#16](https://github.com/iiizzzyyy/promptmetrics/issues/16)

#### Task 2.2.1 -- Create PromptService
- [x] **2.2.1.1** Create `src/services/prompt.service.ts` with constructor accepting `PromptDriver`
- [x] **2.2.1.2** Move `listPrompts()` logic from controller: accept query, page, limit; return paginated result
- [x] **2.2.1.3** Move `getPrompt()` logic: accept name, version, variables; call driver; render with mustache; return content + version
- [x] **2.2.1.4** Move `listVersions()` logic: delegate to driver
- [x] **2.2.1.5** Move `createPrompt()` logic: delegate to driver
- [x] **2.2.1.6** Unit tests in `tests/unit/services/prompt.service.test.ts` with mocked driver
- [x] **2.2.1.7** Commit: `git commit -m "feat: extract PromptService from controller"`

#### Task 2.2.2 -- Create LogService, TraceService, RunService, LabelService
- [x] **2.2.2.1** Create `src/services/log.service.ts` -- extract SQL INSERT logic from `promptmetrics-log.controller.ts`
- [x] **2.2.2.2** Create `src/services/trace.service.ts` -- extract trace/span SQL logic
- [x] **2.2.2.3** Create `src/services/run.service.ts` -- extract run CRUD SQL logic
- [x] **2.2.2.4** Create `src/services/label.service.ts` -- extract label SQL logic
- [x] **2.2.2.5** Unit tests for each service with mocked DB (use an in-memory SQLite DB per test file)
- [x] **2.2.2.6** Commit: `git commit -m "feat: extract Log, Trace, Run, and Label services"`

#### Task 2.2.3 -- Refactor controllers to delegate to services
- [x] **2.2.3.1** Update `src/controllers/promptmetrics-prompt.controller.ts` to instantiate `PromptService` and delegate all logic
- [x] **2.2.3.2** Update `src/controllers/promptmetrics-log.controller.ts` to use `LogService`
- [x] **2.2.3.3** Update `src/controllers/promptmetrics-trace.controller.ts` to use `TraceService`
- [x] **2.2.3.4** Update `src/controllers/promptmetrics-run.controller.ts` to use `RunService`
- [x] **2.2.3.5** Update `src/controllers/promptmetrics-label.controller.ts` to use `LabelService`
- [x] **2.2.3.6** Run all integration tests: verify no behavioral changes
- [x] **2.2.3.7** Commit: `git commit -m "refactor: thin controllers to delegate to service layer"`

---

### Epic 2.3 -- Standardize Pagination
**GitHub Issue:** [#17](https://github.com/iiizzzyyy/promptmetrics/issues/17)

#### Task 2.3.1 -- Create pagination helper
- [x] **2.3.1.1** Create `src/utils/pagination.ts`:
  ```ts
  export function parsePagination(query: { page?: string; limit?: string }) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '50', 10)));
    return { page, limit, offset: (page - 1) * limit };
  }
  export function paginateResponse<T>(items: T[], total: number, page: number, limit: number) {
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
  ```
- [x] **2.3.1.2** Unit tests in `tests/unit/utils/pagination.test.ts` for clamping logic
- [x] **2.3.1.3** Commit: `git commit -m "feat: add standardized pagination helpers"`

#### Task 2.3.2 -- Apply pagination helper across all routes
- [x] **2.3.2.1** Update `src/routes/promptmetrics-prompt.route.ts` audit-logs endpoint to use `parsePagination` and `paginateResponse`
- [x] **2.3.2.2** Update `PromptController.listPrompts()` to use helpers
- [x] **2.3.2.3** Update `PromptController.listVersions()` to use helpers
- [x] **2.3.2.4** Update `RunController.listRuns()` to use helpers
- [x] **2.3.2.5** Update `LabelController.listLabels()` to use helpers
- [x] **2.3.2.6** Verify all paginated responses now include `totalPages`
- [x] **2.3.2.7** Run all integration tests
- [x] **2.3.2.8** Commit: `git commit -m "refactor: apply standardized pagination across all endpoints"`

---

### Epic 2.4 -- Query Parameter Validation
**GitHub Issue:** [#18](https://github.com/iiizzzyyy/promptmetrics/issues/18)

#### Task 2.4.1 -- Create reusable query validation middleware
- [x] **2.4.1.1** Create `src/middlewares/validate-query.middleware.ts`:
  ```ts
  export function validateQuery(schema: Joi.ObjectSchema) {
    return (req, res, next) => {
      const { error, value } = schema.validate(req.query, { abortEarly: false });
      if (error) throw AppError.validationFailed(error.details.map(d => d.message));
      req.query = value;
      next();
    };
  }
  ```
- [x] **2.4.1.2** Unit tests for middleware with valid and invalid query objects
- [x] **2.4.1.3** Commit: `git commit -m "feat: add query parameter validation middleware"`

#### Task 2.4.2 -- Apply query validation to all routes
- [x] **2.4.2.1** Create Joi schemas in `src/validation-schemas/pagination.schema.ts`:
  ```ts
  export const paginationQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
  });
  ```
- [x] **2.4.2.2** Apply `validateQuery(paginationQuerySchema)` to `GET /v1/prompts`
- [x] **2.4.2.3** Apply to `GET /v1/prompts/:name/versions`
- [x] **2.4.2.4** Apply to `GET /v1/runs`
- [x] **2.4.2.5** Apply to `GET /v1/audit-logs`
- [x] **2.4.2.6** Apply to `GET /v1/prompts/:name/labels`
- [x] **2.4.2.7** Add integration tests for invalid query params (negative page, limit > 100)
- [x] **2.4.2.8** Commit: `git commit -m "feat: validate query params on all paginated endpoints"`

---

## Phase 3: Medium-Term Production Hardening

**Milestone:** [Phase 3: Production Hardening](https://github.com/iiizzzyyy/promptmetrics/milestone/3)
**Roadmap Tracker:** [#19](https://github.com/iiizzzyyy/promptmetrics/issues/19)

### Epic 3.1 -- Introduce Migration System

#### Task 3.1.1 -- Choose and install migration tool
- [x] **3.1.1.1** Decision: use `umzug` (not `drizzle-orm`) to minimize refactoring
- [x] **3.1.1.2** Run: `npm install umzug`
- [x] **3.1.1.3** Create `migrations/` directory
- [x] **3.1.1.4** Create `src/migrations/migrator.ts` that configures `Umzug` with SQLite
- [x] **3.1.1.5** Add `npm run migrate` script to `package.json`
- [x] **3.1.1.6** Unit test: `tests/unit/migrations/migrator.test.ts`
- [x] **3.1.1.7** Commit: `git commit -m "feat: add umzug migration runner"`

#### Task 3.1.2 -- Extract existing schema into migration files
- [x] **3.1.2.1** Create `migrations/001_initial_schema.sql` with all `CREATE TABLE` and `CREATE INDEX` from `initSchema()`
- [x] **3.1.2.2** Create `migrations/002_add_ollama_columns.sql` with the three `ALTER TABLE` statements
- [x] **3.1.2.3** Update `src/models/promptmetrics-sqlite.ts`:
  - Remove inline `CREATE TABLE` statements
  - Remove `PRAGMA table_info` migration block
  - Call `migrator.up()` on startup instead
- [x] **3.1.2.4** Add `migrations` table tracking to `umzug` config
- [x] **3.1.2.5** Test fresh database: delete `./data/`, run `npm run db:init`, verify schema matches old behavior
- [x] **3.1.2.6** Test existing database: verify `umzug` skips already-applied migrations
- [x] **3.1.2.7** Run all tests: `npm test`
- [x] **3.1.2.8** Commit: `git commit -m "refactor: extract schema into numbered SQL migrations"`

---

### Epic 3.2 -- Add Database Transactions

#### Task 3.2.1 -- Create transaction helper
- [x] **3.2.1.1** Update `src/models/promptmetrics-sqlite.ts`:
  ```ts
  export function withTransaction<T>(fn: (db: Database.Database) => T): T {
    const db = getDb();
    return db.transaction(fn)(db);
  }
  ```
- [x] **3.2.1.2** Unit test: verify commit on success, rollback on error
- [x] **3.2.1.3** Commit: `git commit -m "feat: add SQLite transaction helper"`

#### Task 3.2.2 -- Wrap multi-step driver operations in transactions
- [x] **3.2.2.1** Update `FilesystemDriver.createPrompt()`: wrap SQLite INSERT in transaction
- [x] **3.2.2.2** Update `GithubDriver.createPrompt()`: wrap SQLite INSERT in transaction; if INSERT fails, attempt to revert the GitHub commit/tag
- [x] **3.2.2.3** Integration test: simulate a SQLite failure during `createPrompt()` and assert no orphaned prompt files or GitHub commits
- [x] **3.2.2.4** Commit: `git commit -m "feat: wrap prompt creation in database transactions"`

---

### Epic 3.3 -- Replace execSync Git Calls

- [x] **3.3.1** Run: `npm install simple-git`
- [x] **3.3.2** Replace `execSync('git clone ...')` in `GithubDriver.ensureCloned()` with `simpleGit().clone(...)`
- [x] **3.3.3** Replace `execSync('git pull')` in `GithubDriver.sync()` with `simpleGit(repoPath).pull()`
- [x] **3.3.4** Replace `execSync('git rev-list ...')` and `execSync('git rev-parse ...')` with equivalent `simpleGit` commands
- [x] **3.3.5** Add error handling for authentication failures and merge conflicts
- [x] **3.3.6** Unit tests: mock `simple-git` methods, verify error paths
- [x] **3.3.7** Integration tests: verify GitHub driver still syncs and creates prompts correctly
- [x] **3.3.8** Commit: `git commit -m "refactor: replace execSync git calls with simple-git"`

---

### Epic 3.4 -- Implement Async Audit Log Queue

#### Task 3.4.1 -- Create in-memory audit log queue
- [x] **3.4.1.1** Create `src/services/audit-log.service.ts`:
  - In-memory array buffer (max 100 entries)
  - `enqueue(entry)` pushes to buffer
  - `flush()` writes batch to SQLite via `INSERT`
  - Auto-flush interval (5s) and shutdown hook
- [x] **3.4.1.2** Unit tests for batching, flush, and shutdown behavior
- [x] **3.4.1.3** Commit: `git commit -m "feat: add async audit log queue service"`

#### Task 3.4.2 -- Replace monkey-patched res.send with event-based audit logging
- [x] **3.4.2.1** Rewrite `src/middlewares/promptmetrics-audit.middleware.ts`:
  - Remove `res.send` monkey patch
  - Use `res.on('finish', () => { ... })` to capture response status
  - Call `AuditLogService.enqueue(...)` instead of direct SQLite INSERT
- [x] **3.4.2.2** Update `src/app.ts` to register the new audit middleware
- [x] **3.4.2.3** Add shutdown hook in `src/utils/promptmetrics-shutdown.ts` to call `AuditLogService.flush()`
- [x] **3.4.2.4** Integration tests: verify audit logs are captured for mutations; verify no `res.send` patching
- [x] **3.4.2.5** Commit: `git commit -m "refactor: replace res.send monkey-patch with event-based async audit logging"`

---

### Epic 3.5 -- Add LRU Cache for Prompt Lookups

#### Task 3.5.1 -- Install and configure lru-cache
- [x] **3.5.1.1** Run: `npm install lru-cache`
- [x] **3.5.1.2** Create `src/services/cache.service.ts`:
  ```ts
  export const promptCache = new LRUCache({
    max: 500,
    ttl: 1000 * 60,
    updateAgeOnGet: true,
  });
  export function cacheKey(name: string, version?: string) {
    return version ? `prompt:${name}:${version}` : `prompt:${name}:latest`;
  }
  ```
- [x] **3.5.1.3** Unit tests for cache hits, misses, and TTL expiration
- [x] **3.5.1.4** Commit: `git commit -m "feat: add LRU cache service for prompt lookups"`

#### Task 3.5.2 -- Integrate cache into PromptService
- [x] **3.5.2.1** In `PromptService.getPrompt()`, check cache before driver; store result after driver call
- [x] **3.5.2.2** In `PromptService.createPrompt()`, invalidate cache entries for the prompt name
- [x] **3.5.2.3** Integration test: first request hits driver, second request hits cache
- [x] **3.5.2.4** Integration test: after `createPrompt()`, subsequent `getPrompt()` returns new version (not stale cache)
- [x] **3.5.2.5** Commit: `git commit -m "feat: integrate LRU cache into PromptService"`

---

### Epic 3.6 -- Add OpenAPI Documentation

- [x] **3.6.1** Run: `npm install swagger-ui-express @types/swagger-ui-express`
- [x] **3.6.2** Create `docs/openapi.yaml` covering all v1 endpoints:
  - `/health`, `/health/deep`
  - `/v1/prompts` (GET, POST), `/v1/prompts/:name`, `/v1/prompts/:name/versions`
  - `/v1/logs` (POST)
  - `/v1/traces` (POST), `/v1/traces/:trace_id`, `/v1/traces/:trace_id/spans`
  - `/v1/runs` (GET, POST), `/v1/runs/:run_id` (GET, PATCH)
  - `/v1/prompts/:name/labels` (GET, POST), `/v1/prompts/:name/labels/:label_name`
  - `/v1/audit-logs` (GET)
- [x] **3.6.3** In `src/app.ts`, add `app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec))`
- [x] **3.6.4** Integration test: `GET /docs` returns HTML; assert spec is valid with `swagger-parser`
- [x] **3.6.5** Commit: `git commit -m "docs: add OpenAPI spec and Swagger UI at /docs"`

---

### Epic 3.7 -- Circuit Breaker for GitHub API

- [x] **3.7.1** Run: `npm install opossum`
- [x] **3.7.2** Create `src/services/circuit-breaker.service.ts`:
  - Factory function that wraps async functions with `opossum`
  - Config: `errorThresholdPercentage: 50`, `resetTimeout: 30000`, `volumeThreshold: 5`
- [x] **3.7.3** Wrap `GithubDriver.createPrompt()` GitHub API calls with circuit breaker
- [x] **3.7.4** Unit tests: mock failures, verify OPEN, HALF_OPEN, CLOSED state transitions
- [x] **3.7.5** Commit: `git commit -m "feat: add circuit breaker for GitHub API calls"`

---

### Epic 3.8 -- Per-API-Key Rate Limiting

- [x] **3.8.1** Create `src/middlewares/rate-limit-per-key.middleware.ts`:
  - Read `req.apiKey.name` after auth middleware
  - Store counters in SQLite table `rate_limits` (key, window_start, count)
  - Sliding window: 60s per key, default 100 requests
- [x] **3.8.2** Replace global rate limit in `src/app.ts` with per-key middleware
- [x] **3.8.3** Integration test: two different API keys each have their own independent counters
- [x] **3.8.4** Integration test: exceed limit and receive 429 with `Retry-After` header
- [x] **3.8.5** Commit: `git commit -m "feat: add per-API-key rate limiting with sliding window"`

---

### Epic 3.9 -- Key Expiration and Rotation

- [x] **3.9.1** Create migration `003_add_key_expiration.sql`:
  ```sql
  ALTER TABLE api_keys ADD COLUMN expires_at INTEGER;
  ```
- [x] **3.9.2** Update `src/middlewares/promptmetrics-auth.middleware.ts` to reject keys where `expires_at < now()`
- [x] **3.9.3** Update `src/scripts/generate-api-key.ts` to accept `--expires-in-days` flag
- [x] **3.9.4** Integration test: expired key returns 401 with message "API key expired"
- [x] **3.9.5** Commit: `git commit -m "feat: add API key expiration and rotation support"`

---

## Phase 4: Long-Term Scale & Ecosystem

**Milestone:** [Phase 4: Scale & Ecosystem](https://github.com/iiizzzyyy/promptmetrics/milestone/4)
**Roadmap Tracker:** [#19](https://github.com/iiizzzyyy/promptmetrics/issues/19)

### Epic 4.1 -- PostgreSQL Backend Support

- [x] **4.1.1** Create `src/models/database.interface.ts` with `DatabaseAdapter` interface
- [x] **4.1.2** Create `src/models/sqlite.adapter.ts` implementing the interface with `better-sqlite3`
- [x] **4.1.3** Create `src/models/postgres.adapter.ts` implementing the interface with `pg`
- [x] **4.1.4** Update `getDb()` to read `DATABASE_URL` env var and return the correct adapter
- [x] **4.1.5** Update migrations to run on PostgreSQL when configured
- [x] **4.1.6** Add `docker-compose.postgres.yml` for local testing
- [x] **4.1.7** CI: add PostgreSQL test job to `.github/workflows/ci.yml`
- [x] **4.1.8** Commit: `git commit -m "feat: add PostgreSQL backend adapter"`

---

### Epic 4.2 -- Redis Integration

- [x] **4.2.1** Run: `npm install ioredis`
- [x] **4.2.2** Create `src/services/redis.service.ts`
- [x] **4.2.3** Update `CacheService` to use Redis when `REDIS_URL` is set
- [x] **4.2.4** Update rate limiter to use Redis counters when available
- [x] **4.2.5** Add `docker-compose.redis.yml`
- [x] **4.2.6** Commit: `git commit -m "feat: add Redis support for caching and rate limiting"`

---

### Epic 4.3 -- GitHub Webhook Support

- [x] **4.3.1** Create `src/routes/webhook.route.ts` with `POST /webhooks/github`
- [x] **4.3.2** Verify webhook signature using `X-Hub-Signature-256` and `GITHUB_TOKEN`
- [x] **4.3.3** Trigger `driver.sync()` on valid push events
- [x] **4.3.4** Make `GitSyncJob` conditional: skip polling when `GITHUB_WEBHOOK_SECRET` is configured
- [x] **4.3.5** Integration test with mocked GitHub webhook payload
- [x] **4.3.6** Commit: `git commit -m "feat: add GitHub webhook endpoint for instant sync"`

---

### Epic 4.4 -- Web UI Dashboard

- [x] **4.4.1** Scaffold Next.js app in `ui/` with `create-next-app`
- [x] **4.4.2** Install Tailwind CSS and shadcn/ui
- [x] **4.4.3** Create pages: `/prompts`, `/prompts/:name`, `/logs`, `/traces`, `/runs`, `/labels`, `/settings`
- [x] **4.4.4** Create API client using generated OpenAPI types
- [x] **4.4.5** Add auth context for API key input
- [x] **4.4.6** Add E2E tests with Playwright in `ui/e2e/`
- [x] **4.4.7** Commit: `git commit -m "feat: add Next.js web UI dashboard"`

---

### Epic 4.5 -- Python SDK

- [x] **4.5.1** Create `clients/python/` directory
- [x] **4.5.2** Create `client.py` with `PromptMetrics` class
- [x] **4.5.3** Implement `.prompts.list()`, `.prompts.get()`, `.prompts.create()`
- [x] **4.5.4** Implement `.logs.create()`, `.traces.create()`, `.runs.create()`
- [x] **4.5.5** Add `setup.py` and `pyproject.toml`
- [x] **4.5.6** Add pytest tests with `responses` or `httpx` mock transport
- [x] **4.5.7** Commit: `git commit -m "feat: add Python SDK client"`

---

### Epic 4.6 -- Prompt Evaluation Framework

- [ ] **4.6.1** Create migration `004_add_evaluations.sql`:
  ```sql
  CREATE TABLE evaluations (...);
  CREATE TABLE evaluation_results (...);
  ```
- [ ] **4.6.2** Create `src/services/evaluation.service.ts`
- [ ] **4.6.3** Create `src/routes/evaluation.route.ts` with endpoints
- [ ] **4.6.4** Integration tests for evaluation CRUD
- [ ] **4.6.5** Commit: `git commit -m "feat: add prompt evaluation framework"`

---

### Epic 4.7 -- S3-Compatible Storage Driver

- [ ] **4.7.1** Run: `npm install @aws-sdk/client-s3`
- [ ] **4.7.2** Create `src/drivers/promptmetrics-s3-driver.ts` implementing `PromptDriver`
- [ ] **4.7.3** Add `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` env vars
- [ ] **4.7.4** Unit tests with `aws-sdk-client-mock`
- [ ] **4.7.5** Commit: `git commit -m "feat: add S3-compatible storage driver"`

---

### Epic 4.8 -- Multi-Tenancy

- [ ] **4.8.1** Create migration `005_add_workspace_id.sql`:
  ```sql
  ALTER TABLE prompts ADD COLUMN workspace_id TEXT;
  -- Repeat for all tables
  ```
- [ ] **4.8.2** Create `src/middlewares/tenant.middleware.ts` to read `X-Workspace-Id`
- [ ] **4.8.3** Update auth middleware to validate key belongs to workspace
- [ ] **4.8.4** Update all services to scope queries by `workspace_id`
- [ ] **4.8.5** Integration tests for cross-tenant isolation
- [ ] **4.8.6** Commit: `git commit -m "feat: add multi-tenancy with workspace isolation"`

---

## Final Verification Checklist

After all tasks are complete:

- [ ] `npm run build` succeeds with zero errors
- [ ] `npm run lint` passes
- [ ] `npm test` passes with 100% of existing tests green
- [ ] New tests have >80% coverage for new services
- [ ] `docker compose up --build` works end-to-end
- [ ] README.md is updated with any new env vars or commands
- [ ] CLAUDE.md is updated with new architecture patterns

---

*Task list generated on 2026-04-24.*
