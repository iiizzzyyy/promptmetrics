# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
