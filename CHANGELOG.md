# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-05-04

### Security

- **BFF session cookie** — Dashboard authentication now uses an HTTP-only, SameSite=strict session cookie instead of exposing API keys to the browser.
- **API key removed from localStorage** — Client-side storage of API keys eliminated; keys are held only in the secure BFF session.
- **CSRF tokens** — State-changing BFF endpoints require a double-submit CSRF token.
- **requireScope on all mutations** — All write routes (POST/PUT/PATCH/DELETE) now enforce granular API key scopes consistently.

### Observability

- **Real error_rate computation** — Time-series metrics now compute `error_rate` as `failures / total` instead of a placeholder.
- **Audit logging on all mutations** — Every state-changing API call is recorded in the audit log with actor, action, and timestamp.
- **Compliance scanning engine** — New engine scans prompts for PII, secrets, and policy violations with pluggable providers.

### UI/UX

- **Radix Dialog + Popover rewrite** — Modal and popover components rebuilt on Radix primitives for accessibility and keyboard control.
- **AlertDialog confirmations** — Destructive actions (delete, promote, reset) now require explicit confirmation.
- **Settings Sheet** — Slide-out settings panel with workspace and preference management.
- **ErrorBoundary** — Top-level React error boundary catches render crashes and shows a recoverable fallback UI.
- **Resizable panels** — Drag-to-resize layout panels in playground and trace views.
- **Zod validation** — Runtime schema validation on all dashboard forms with detailed error messages.

### Backend

- **Compliance cursor pagination** — Compliance scan result lists use cursor-based pagination for reliable large-set navigation.
- **A/B test real scores** — Variant metrics now aggregate actual evaluation scores instead of dummy values.
- **promoteWinner transaction** — Winner promotion runs inside a database transaction to prevent partial state.
- **ProviderRegistry safety** — Lazy-loaded adapters include graceful fallback when a provider package is missing.

### Breaking Changes

- None. All changes are additive; existing API clients continue to work unchanged.

### Migration Notes

- Run `npm run db:init` to apply migrations `018` through `022`.

## [1.2.1] - 2026-05-02

### Fixed

- **build:** Include compiled `dist/` directory in npm tarball so CLI and server binaries are available.

## [1.2.0] - 2026-05-01

### Security

- **fix(proxy):** Add backend-for-frontend (BFF) proxy layer to prevent direct client exposure of internal APIs.
- **fix(auth):** Enforce granular auth scopes on dashboard API routes.

### Added

- **Audit Logs Page** — New paginated audit log viewer with filtering by action, actor, and date range.
- **Health Panel** — New dashboard widget showing real-time connectivity status for database, cache, and LLM providers.
- **GitOps Widget** — New dashboard component displaying prompt repository sync state with last-sync timestamp and manual re-sync trigger.

### Changed

- **Playground Validation** — Tightened input validation in Playground prompt testing with schema-aware error messages.
- **Provider Initialization** — Moved LLM provider adapter initialization from application startup to first-request lazy loading.
- **Dataset Deletion UX** — Changed dataset deletion from immediate hard delete to soft delete with confirmation flow and 48-hour grace period.

### Fixed

- **fix(compliance):** Resolve pagination offset miscalculation in compliance scan result lists.
- **fix(ui):** Resolve Next.js hydration mismatch errors on dashboard data tables.
- **fix(telemetry):** Survive `JSON.parse` crashes during log ingestion with bounded safe parsing fallback.
- **fix(metrics):** Correct `error_rate` denominator in time-series aggregation so failures are divided by total requests.

## [1.1.1] - 2026-05-01

### Added

- **Dashboard User Guide** — Comprehensive `ui/README.md` with page-by-page walkthroughs for Overview, Logs, Traces, Evaluations, Metrics API reference, workspace switching, and common workflows.
- **Dashboard Screenshots** — 5 Playwright-captured screenshots with seeded demo data: overview, logs, traces, trace detail, and evaluations.
- **Dashboard Quick-Start** — Added Dashboard section to root `README.md` with setup instructions and link to the full user guide.

## [1.1.0] - 2026-04-30

### Added

- **A/B Testing Engine** — Define tests comparing two prompt versions, run variants through the LLM provider registry, collect metrics, and promote winners.
- **Dataset Management** — Create test datasets (input/expected pairs) for evaluation runs with workspace scoping.
- **Evaluation Runs** — Execute evaluation suites against datasets with budget tracking via `EvalRunService`.
- **Compliance Engine** — Scan prompts for PII (email, SSN, phone, credit card), API keys (Shannon entropy), URLs, and IP addresses. Produces a 0–100 risk score with severity-weighted deductions.
- **Playground Proxy** — Direct LLM proxy supporting chat, streaming chat, and text completions for OpenAI, Anthropic, Cohere, Ollama, and Azure OpenAI.
- **Observability Dashboard** — Next.js UI with time-series charts, traces, logs, runs, metrics, compliance, A/B tests, datasets, playground, and settings pages.
- **Budget Service** — Tracks evaluation run costs against configurable budgets.
- **Metrics Dashboard** — Query-time aggregation for time-series, per-prompt usage, and evaluation trends.
- **LLM Provider Registry** — Lazy-loaded adapter pattern for multiple LLM providers with dynamic `import()`.
- **New migrations** for A/B testing (`011`), datasets and eval runs (`012`), compliance (`013`), log run IDs (`014`), A/B test promotion (`015`), cascade deletes (`016`), and cascade eval runs (`017`).
- **ON DELETE CASCADE** for foreign key relationships.
- **`safeJsonParse`** utility for robust JSON parsing.
- **`parseIdParam`** helper for route parameter validation.

### Changed

- Provider registry uses dynamic `import()` instead of `require()` for lazy loading.
- CI workflow: PostgreSQL schema reset between test runs for idempotency.
- CI workflow: npm audit threshold raised to high (moderate vulnerabilities in umzug transitive deps).
- Migration 005 made idempotent for PostgreSQL via DO EXCEPTION blocks.

### Fixed

- ESLint `no-undef` errors for DOM globals in Node.js context (used `globalThis.*` prefix).
- ESLint `no-require-imports` in provider registry (converted to dynamic imports).
- Regex escape sequence in compliance engine URL pattern.
- `NodeJS.ErrnoException` type annotation in GitHub driver.

## [1.0.13] - 2026-04-28

### Fixed

- **fix(postgres):** Resolve `spans.start_time` and `spans.end_time` INTEGER overflow on PostgreSQL by using `BIGINT` (#64).
  - Add `timestampColumn(dialect)` helper in `migrations/dialect-helpers.ts` that returns `'BIGINT'` for PostgreSQL and `'INTEGER'` for SQLite.
  - Update `001_initial_schema.ts` to use `BIGINT` for `spans.start_time` and `spans.end_time` on PostgreSQL.
  - Add migration `009_alter_spans_time_columns.ts` to alter existing PostgreSQL deployments.

- **fix(postgres):** Normalize `COUNT(*)` results so pagination `total` fields are always numbers on both PostgreSQL and SQLite (#65).
  - Add `parseCount` and `parseCountRow` helpers in `src/utils/pagination.ts` to safely convert PostgreSQL string counts to numbers.
  - Replace all direct `.c` / `.count` accesses across 9 service, route, and driver files with `parseCountRow()`.
  - All paginated endpoints now return `total` as a proper `number` regardless of database backend.

## [1.0.12] - 2026-04-28

### Fixed

- **fix(postgres):** Remove automatic `RETURNING id` appending from `PostgresAdapter` that broke INSERTs on tables without an `id` column (#63).
  - Stop appending `RETURNING id` blindly in `PostgresAdapter.run()` and `TransactionPreparedStatement.run()`.
  - Add explicit `RETURNING id` to INSERT statements in `EvaluationService` (`evaluations` and `evaluation_results` tables), `ApiKeyService` (`api_keys` table), and `LogService` (`logs` table) where callers rely on `lastInsertRowid`.
  - Update `tests/unit/postgres.adapter.test.ts` to verify no auto-appending and correct behavior when the caller includes `RETURNING id`.

## [1.0.11] - 2026-04-28

### Fixed

- **fix(postgres):** Resolve integer overflow in `rate_limits.window_start` on PostgreSQL by using `BIGINT` instead of `INTEGER` (#31).
  - Add `windowStartColumn(dialect)` helper in `migrations/dialect-helpers.ts` that returns `'BIGINT'` for PostgreSQL and `'INTEGER'` for SQLite.
  - Update `001_initial_schema.ts` to use `BIGINT` for `rate_limits.window_start` on PostgreSQL.
  - Add migration `007_alter_rate_limits_window_start.ts` to alter existing PostgreSQL deployments.

### Added

- **feat(prompts):** Implement atomic prompt writes with pending/active state machine (#41).
  - Add `status` column (`TEXT NOT NULL DEFAULT 'active'`) to `prompts` table via migration `008_add_prompt_status.ts`.
  - Refactor `PromptService.createPrompt()` to insert metadata with `status = 'pending'`, write to the storage driver, then update `status = 'active'`.
  - Add `AND status = 'active'` filter to `listPrompts()`, `listVersions()`, and `getPrompt()` so incomplete writes are never returned.
  - Create `PromptReconciliationJob` (`src/jobs/promptmetrics-reconciliation.job.ts`) that runs every 60 seconds (configurable via `PROMPT_RECONCILE_INTERVAL_MS`) to heal prompts stuck in `pending` state.
  - Start `PromptReconciliationJob` alongside `GitSyncJob` in `src/server.ts`.

### Changed

- **test:** Expand test coverage from 82.61% to 89.23% (#62).
  - Add unit tests for error handler, rate-limit middleware, postgres adapter, reconciliation job, and dialect helpers.
  - Expand tests for cache service, S3 driver, GitHub driver, webhook, rate-limit integration, prompt transactions, and E2E full-lifecycle.

## [1.0.10] - 2026-04-27

### Security

- **fix(github-driver):** Remove token from clone URL and use `GIT_ASKPASS` credential helper (#37).
- **fix(s3-driver):** Add prompt name validation to prevent path traversal via malicious object keys (#44).
- **fix(rate-limit):** Use hashed API key instead of key name for rate-limit counters to prevent cross-key bucket sharing (#45).
- **fix(webhook):** Read `GITHUB_WEBHOOK_SECRET` at request time instead of caching at startup (#51).
- **fix(config):** Enforce minimum 16-character `API_KEY_SALT` at startup (#52).
- **fix(tenant):** Validate `X-Workspace-Id` header against `a-zA-Z0-9_-` with max 128 characters (#53).

### Fixed

- **fix(postgres):** Append `RETURNING id` to INSERT statements so `lastInsertRowid` returns actual row IDs (#32).
- **fix(postgres):** Add pool error handler to prevent uncaught exceptions from crashing Node (#40).
- **fix(postgres):** Preserve original error when ROLLBACK fails during transaction cleanup (#49).
- **fix(github-driver):** Add missing `await` to `ensureCloned()` calls to prevent race conditions (#33).
- **fix(github-driver):** Use blob SHA from GitHub API response for revert DELETE on DB failure (#36).
- **fix(github-driver):** Distinguish ENOENT/404 from internal errors instead of swallowing all exceptions (#59).
- **fix(rate-limit):** Validate both INCR and EXPIRE pipeline results in Redis path to avoid permanent API key blocking (#34).
- **fix(rate-limit):** Replace SQLite SELECT-then-UPDATE with atomic UPDATE + INSERT ON CONFLICT to eliminate read-modify-write races (#35).
- **fix(cache):** Wrap `JSON.parse` in try/catch to survive corrupted Redis cache entries (#38).
- **fix(redis):** Close connection-leak race window in `getRedisClient()` singleton initialization (#39).
- **fix(audit):** Add bounded retry queue and `droppedCount` metric when audit log flush fails (#42).
- **fix(audit):** Truncate `prompt_name` and `version_tag` to 256 characters before enqueueing (#57).
- **fix(filesystem-driver):** Remove redundant `withTransaction()` wrapper around single INSERT ON CONFLICT statement (#60).
- **fix(migrations):** Wrap `down()` in `db.transaction()` for atomic rollback safety (#48).
- **fix(tests):** Add `await` to all `db.prepare(...).run(...)` calls in test `beforeAll` blocks to eliminate flakiness (#43).

### Changed

- **refactor(routes):** Move `/v1/audit-logs` from prompt route to dedicated `src/routes/audit-log.route.ts` (#54).
- **refactor(config):** Centralize `GITHUB_WEBHOOK_SECRET` in config object (#51).
- **refactor(run):** Replace dynamic SQL construction with `buildPartialUpdate()` utility for prepared statement reuse (#58).
- **refactor(errors):** Add `AppError.toJSON()` for consistent serialization (#56).
- **refactor(types):** Correct `listApiKeys` return type from `PaginatedResponse<Omit<ApiKey, 'id'>>` to `PaginatedResponse<ApiKey>` (#55).
- **refactor(validation):** Change `validateQuery` middleware to write validated values to `req.validatedQuery` instead of mutating `req.query` (#50).
- **fix(validation):** Reject prompt search queries longer than 256 characters (#46).
- **fix(validation):** Ignore request body on `GET /v1/prompts/:name` (#47).
- **fix(package):** Correct `dotenv` version from non-existent `^17.2.2` to `^16.4.5` (#61).

## [1.0.9] - 2026-04-27

### Fixed

- **fix(adapter):** Resolve PostgreSQL migrations failing because `db.exec()` was not awaited (#30).
  - Make `DatabaseAdapter.exec()`, `close()`, and `transaction()` uniformly return `Promise<void>` (or `Promise<T>`).
  - Make all `PreparedStatement` methods (`all`, `get`, `run`) uniformly return `Promise<...>`.
  - Update `SqliteAdapter` and `SqlitePreparedStatement` to be fully async.
  - Update `migrations/dialect-helpers.ts` to import `DatabaseAdapter` from the canonical interface (`src/models/database.interface`).
  - Add `await` to all 6 migration files' `db.exec()` calls.
  - Update callers in middleware, scripts, and tests to `await` adapter methods.

## [1.0.8] - 2026-04-27

### Changed

- **docs:** Update README, architecture guide (`docs/architecture.md`), API reference (`docs/api.md`), and release tracker (`docs/NPM_RELEASES.md`) for v1.0.7 cross-dialect database support.
  - Reflect that migrations are now TypeScript files with dialect-conditional DDL.
  - Update architecture diagrams and schema sections to show PostgreSQL as a first-class alternative to SQLite.
  - Update `CLAUDE.md` to describe TypeScript migrations instead of SQL files.

## [1.0.7] - 2026-04-27

### Fixed

- **fix(postgres):** Resolve PostgreSQL incompatibility across migrations, runtime SQL, and adapter placeholders (#29).
  - Convert all 6 migrations from `.sql` to TypeScript with dialect-conditional DDL (`SERIAL PRIMARY KEY` vs `INTEGER PRIMARY KEY AUTOINCREMENT`, `EXTRACT(EPOCH FROM NOW())` vs `unixepoch()`).
  - Rewrite `?` placeholders to `$1, $2, ...` in `PostgresAdapter` for `pg` module compatibility.
  - Replace SQLite-only `INSERT OR REPLACE INTO` with cross-dialect `INSERT ... ON CONFLICT ... DO UPDATE` in all drivers and rate-limit middleware.
  - Replace `unixepoch()` in `run.service.ts` with application-level timestamps.
  - Replace `sqlite_master` query in `init-db.ts` with dialect-aware catalog lookup.
  - Move `rate_limits` table creation from `initSchema()` into `001_initial_schema.ts` migration.
  - Rename `SQLiteStorage` -> `MigrationStorage` to reflect generic dialect support.
  - Maintain backward compatibility: existing SQLite databases with `.sql` migration records remain no-ops under the new resolver.

## [1.0.6] - 2026-04-26

### Changed

- **docs:** Update README, API reference (`docs/api.md`), architecture guide (`docs/architecture.md`), CLI docs (`docs/cli.md`), and SDK docs (`docs/sdk.md`) for v1.0.5 features.
  - Document `GET /v1/logs` and `GET /v1/traces` paginated list endpoints.
  - Document nested metadata support in traces, spans, and logs.
  - Document master API keys (`workspace_id = '*'`) wildcard behavior.
  - Document `/v1/api-keys` CRUD endpoints (`POST`, `GET`, `DELETE`).
  - Update `generate-api-key` CLI docs with `--workspace` flag.

## [1.0.5] - 2026-04-26

### Added

- **feat(api):** Add paginated list endpoints for logs and traces (`GET /v1/logs`, `GET /v1/traces`) (#25).
- **feat(auth):** Support master API keys with wildcard `workspace_id = '*'` that can access any workspace (#27).
- **feat(api):** Add `/v1/api-keys` CRUD management endpoints — create, list, and delete API keys programmatically (#28).
  - Requires `admin` scope on the caller's key.
  - Plaintext key returned **once** on creation.
  - Listing never includes `key_hash`.

### Fixed

- **fix(validation):** Allow nested objects in `metadata` fields across traces, spans, and logs (#26).
  - Relaxes Joi schema from primitive-only values to `Joi.object().unknown(true).max(50)`.
  - Supports real-world OpenTelemetry-style structured telemetry.

### Changed

- `generate-api-key` CLI script now accepts `--workspace <id>` (default `'default'`, supports `'*'` for master keys).

## [1.0.4] - 2026-04-26

### Fixed

- **fix(cli):** Restore `--json` output flag for programmatic consumers (#23).
  - Add global `--json` option via `program.option()` in Commander.
  - Add `print()` helper that routes to `JSON.stringify()` when `--json` is set, or `console.table()` for arrays by default.
  - Replace all `console.log(JSON.stringify(...))` and `console.table()` calls with `print()` for consistent dual-format output.
  - Update `export` command to emit structured output via `print()`.
  - Add unit tests for `--json` flag acceptance and table fallback.

## [1.0.3] - 2026-04-26

### Performance

- **perf(sqlite):** Resolve SQLite write contention under concurrent load (#20, #21, #22).
  - Remove unnecessary `db.transaction()` wrapper from rate-limit middleware — Node.js single-threaded guarantee makes it redundant and it added `BEGIN...COMMIT` overhead on every request.
  - Hoist `CREATE TABLE IF NOT EXISTS rate_limits` from request hot path to `initSchema()` startup, eliminating per-request schema locks.
  - Add `PRAGMA busy_timeout = 5000` so SQLite waits gracefully for write locks instead of returning `SQLITE_BUSY` immediately.
  - Debounce `last_used_at` updates in auth middleware with configurable `API_KEY_LAST_USED_DEBOUNCE_MS` (default 60 s), reducing write volume by ~99%.
  - Make rate-limit thresholds configurable via `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX_REQUESTS` env vars (defaults unchanged: 100 req / 60 s).

## [1.0.2] - 2026-04-25

### Changed

- **docs:** Update README for v1.0.1 release — expanded feature list, added Python SDK section, fixed duplicate env vars, updated architecture diagram, added evaluations and dashboard context.
- **docs:** Add release blog post at `docs/blog/v1.0.1-release.md`.

## [1.0.1] - 2026-04-25

### Security

- **fix(path-traversal):** Sanitize prompt names in `FilesystemDriver` and `GithubDriver` to prevent directory escape via `../` sequences. `validateName()` rejects names containing path separators and validates resolved paths stay within the base directory.
- **fix(validation):** Add Joi input validation to `EvaluationController`. All evaluation and result creation payloads are now validated before reaching the service layer.
- **fix(race-condition):** Wrap SQLite rate limiter read-and-update logic in `db.transaction()` to prevent concurrent requests from bursting past the configured limit.
- **fix(webhook):** Remove `GITHUB_TOKEN` fallback for webhook secret verification. The handler now fails closed (returns 500) if `GITHUB_WEBHOOK_SECRET` is not explicitly configured.
- **fix(logging):** Remove sensitive `console.log(JSON.stringify(...logEntry))` in `LogController` that leaked LLM metadata to stdout.
- **fix(sql-injection):** Validate `tableName` and `columnName` against a strict regex whitelist (`/^[a-z_][a-z0-9_]*$/i`) in `SQLiteStorage` before interpolating into SQL.

### Added

- **Evaluation Framework** — Create, score, and manage prompt evaluations via REST API (`POST /v1/evaluations`, `GET /v1/evaluations/:id`, `POST /v1/evaluations/:id/results`).
- **Python SDK** — `clients/python/` package with `PromptMetrics` class supporting prompts, logs, traces, runs, and labels.
- **Web UI Dashboard** — Next.js dashboard in `ui/` with pages for prompts, logs, traces, runs, labels, and settings. Includes typed API client and API key auth context.
- **GitHub Webhook Support** — `POST /webhooks/github` endpoint verifies `X-Hub-Signature-256` and triggers immediate sync on push events.
- **Redis Integration** — LRU cache and rate limiter backed by Redis when `REDIS_URL` is configured. Falls back to in-memory LRU cache and SQLite rate limiting.
- **PostgreSQL Backend** — `DatabaseAdapter` interface with SQLite and PostgreSQL implementations. Set `DATABASE_URL` to use PostgreSQL instead of SQLite.
- **S3-Compatible Storage Driver** — Store prompt JSON as objects in S3 with keys like `prompts/{name}/{version}.json`.
- **Multi-Tenancy** — Workspace isolation via `X-Workspace-Id` header. All tables include `workspace_id` and API keys are scoped to workspaces.
- **Circuit Breaker** — GitHub API calls wrapped in Opossum circuit breaker with exponential backoff on 429 responses.
- **Per-API-Key Rate Limiting** — Sliding window rate limits with independent counters per API key. Returns `429` with `Retry-After` header.
- **API Key Expiration** — `expires_at` column on `api_keys` table. Expired keys are rejected with "API key expired" message.
- **OpenAPI Documentation** — Swagger UI served at `/docs` with full spec in `docs/openapi.yaml`.
- **LRU Cache for Prompt Lookups** — `CacheService` with TTL-based eviction and invalidation on prompt creation.
- **Database Transactions** — `withTransaction()` helper wraps multi-step operations with automatic rollback on failure.
- **Migration System** — `umzug`-based migration runner with numbered SQL files in `migrations/`.
- **Async Audit Log Queue** — `AuditLogService` batches audit entries and flushes to SQLite asynchronously.

### Changed

- `DRIVER` environment variable now supports `filesystem`, `github`, or `s3`.
- `EvaluationController` standardized on throwing `AppError` instead of manual `try/catch` with `next(err)`.
- `express@5.2.1` handles async errors natively; route handlers no longer need manual error forwarding.

## [1.0.0] - 2026-04-22

### Added

- Prompt registry with REST API and CLI for storing, versioning, and retrieving prompts.
- Filesystem and GitHub storage drivers for prompt content.
- Variable rendering with Mustache-style `{{variable}}` substitution.
- Metadata logging for LLM calls (model, tokens, latency, cost, custom tags).
- Agent telemetry with traces and spans for tracking agent loops.
- Workflow runs with input/output tracking and status updates.
- Prompt version labels for environment tagging (production, staging, etc.).
- SQLite metadata index with WAL mode.
- API key authentication with hashed HMAC-SHA256 and scoped permissions (read, write, admin).
- Audit logging for all write operations.
- OpenTelemetry OTLP export support.
- CLI with global `--server` and `--api-key` flags and `promptmetrics.yaml` config.
- Docker Compose setup with health checks and smoke tests.
- Node.js SDK client.

### Security

- API keys are hashed with HMAC-SHA256 before storage.
- Rate limiting enabled on all endpoints.
- Input validation with Joi schemas on all routes.

## [0.9.0-beta] - 2026-04-20

### Added

- Initial beta release for human validation.
- 50+ test cases across 13 capability areas.

### Fixed

- CLI error handling for HTTP 4xx/5xx responses.
- Invalid JSON body now returns 400 instead of 500.
- Label upsert behavior (update existing labels instead of rejecting duplicates).
- Required variable validation on explicit `?render=true`.
- Docker signal forwarding for graceful shutdown.
- Audit log action naming consistency.
