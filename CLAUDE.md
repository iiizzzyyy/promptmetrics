# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Run dev server (ts-node with path aliases) |
| `npm run build` | Build for production (tsc + tsc-alias) |
| `npm start` | Start production server |
| `npm test` | Run all tests with coverage |
| `npx jest tests/unit` | Unit tests only |
| `npx jest tests/integration` | Integration tests only |
| `npx jest tests/e2e` | E2E tests only |
| `npm run lint` | Lint check |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run format` | Run prettier |
| `npm run db:init` | Initialize SQLite schema |
| `npm run api-key:generate` | Generate an API key |

**Required for tests:** Set `API_KEY_SALT` in `.env` or tests use a hardcoded `test-salt-for-ci`. Tests create isolated SQLite DBs in `./data/` and clean up in `afterAll`.

**Path aliases** are defined in `tsconfig.json` and mirrored in `jest.config.js` (`@config/*`, `@controllers/*`, `@drivers/*`, etc.). Always use them for imports.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `API_KEY_SALT` | Yes | HMAC salt for API key hashing |
| `DRIVER` | No | `filesystem` (default), `github`, or `s3` |
| `GITHUB_REPO` | If `DRIVER=github` | `owner/repo` format |
| `GITHUB_TOKEN` | If `DRIVER=github` | GitHub personal access token |
| `DATABASE_URL` | No | Postgres connection string; omit for SQLite |
| `REDIS_URL` | No | Redis connection string for shared caching |
| `API_KEY_LAST_USED_DEBOUNCE_MS` | No | Default `60000` |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX_REQUESTS` | No | Default `60000` / `100` |

---

## Architecture Rules

### 1. Driver Pattern for Prompt Storage
All prompt read/write operations go through the `PromptDriver` interface. Adding a new storage backend means:
1. Implement `PromptDriver` in `src/drivers/promptmetrics-<name>-driver.ts`
2. Add a case in `src/drivers/promptmetrics-driver.factory.ts`
3. Export the class from the factory

**Current implementations:** `FilesystemDriver`, `GithubDriver`, `S3Driver`.

### 2. Async DatabaseAdapter
The `DatabaseAdapter` interface is uniformly async across SQLite and PostgreSQL. All query methods (`exec`, `all`, `get`, `run`, `transaction`) return `Promise`s. Controllers `await` every DB call. The SQLite adapter wraps `better-sqlite3` to satisfy this contract.

**Key implication:** Never use synchronous SQLite APIs directly in services or controllers. Always go through `getDb()`.

### 3. Service Layer
Controllers are thin. All business logic lives in services:
- `PromptService`, `LogService`, `TraceService`, `RunService`, `LabelService`, `EvaluationService`

### 4. No ORM
All SQL is hand-written in services and drivers. There are no models or repositories beyond the `getDb()` connection manager. Do not introduce an ORM or query builder.

### 5. Schema Migrations
Migrations are numbered TypeScript files in `migrations/`. They use dialect-aware helpers (`idColumn`, `nowFn`, `timestampColumn`) from `migrations/dialect-helpers.ts` to support both SQLite and PostgreSQL in a single file. Applied by `umzug` on startup.

---

## Authentication & Authorization

- `authenticateApiKey` middleware reads `X-API-Key`, HMAC-SHA256 hashes it with `API_KEY_SALT`, and looks up the hash in SQLite.
- Valid keys have `name`, `scopes`, and `workspace_id` attached to `req.apiKey`.
- `requireScope(scope)` returns middleware that checks `req.apiKey.scopes` and returns 403 if missing.
- `auditLog(action)` uses `res.on('finish')` to enqueue audit entries to an async batch writer (`AuditLogService`).
- `tenantMiddleware` reads `X-Workspace-Id` and attaches it to `req.workspaceId`. All services scope queries by `workspace_id`.

---

## Request Flow (Prompts)

1. Route (`src/routes/promptmetrics-prompt.route.ts`) receives the driver.
2. `PromptController` handles HTTP concerns (pagination, query parsing) then delegates to `PromptService`.
3. `getPrompt` performs Mustache variable substitution on `system` and `user` role messages. Cached in LRU (or Redis when `REDIS_URL` is set).
4. Read operations filter on `status = 'active'`, so incomplete writes are invisible.
5. Validation is done via Joi schemas in `src/validation-schemas/` and returns 422 with a `details` object. Joi validation errors are normalized to `{ fields: string[] }`. Business errors use `{ key: value }` shapes.

---

## Testing Conventions

- **Unit tests** mock drivers/services and test logic in isolation.
- **Integration tests** spin up the Express app via `supertest` and hit endpoints.
- **E2E tests** run a full lifecycle (create prompt, log, trace, run, label, audit).
- Test setup lives in `tests/env-setup.ts` (sets `API_KEY_SALT`, calls `initSchema()`) and `tests/setup.ts` (closes DB after all tests).
- `nock` is available for mocking external HTTP calls (GitHub driver tests).

---

## CLI & SDK

- **CLI** (`src/cli/promptmetrics-cli.ts`) is a standalone `commander` program that makes raw HTTP calls. Reads server URL and API key from `promptmetrics.yaml` in CWD, or from `--server`/`--api-key` flags.
- **Node SDK** (`clients/node/src/index.ts`) is a typed wrapper around `axios` that auto-injects the `X-API-Key` header. It is NOT auto-generated from OpenAPI — it is hand-written.
- Both CLI and SDK are published as part of the same npm package (`promptmetrics`).

---

## Common Pitfalls

1. **Driver double-instantiation bug** — `server.ts` already creates the driver. Pass it into `createApp(driver)`; do not instantiate a second one inside `createApp()`.
2. **Postgres placeholder rewriting** — The Postgres adapter rewrites `?` to `$1, $2, ...` at runtime. Never write `$N` placeholders directly; always use `?` so SQL works for both dialects.
3. **Postgres `RETURNING id` retry** — The adapter auto-appends `RETURNING id` to INSERTs. If a table lacks an `id` column (e.g., `config`, `rate_limits`, `migrations`), the adapter catches `42703` and retries without it. Add new no-id tables to `TABLES_WITHOUT_ID` in `postgres.adapter.ts`.
4. **Prompt 3-phase write** — `PromptService.createPrompt` inserts `pending`, calls the driver, then updates to `active`. Read operations filter on `status = 'active'`. The `PromptReconciliationJob` heals stuck prompts automatically.
5. **Debounced `last_used_at`** — `authenticateApiKey` only updates `last_used_at` if it hasn't been updated in the last 60 seconds (configurable via `API_KEY_LAST_USED_DEBOUNCE_MS`). Don't expect sub-second precision.
6. **Raw body parser for webhooks** — `/webhooks` uses Express's `raw()` parser to preserve the exact body bytes for signature verification. Do not add `express.json()` middleware before this route.
7. **Health endpoint bypasses Express** — `/health/deep` is handled directly by the raw `http.Server` in `server.ts`, not by Express. Changes to Express middleware won't affect it.
8. **Mustache skips `assistant` roles** — When rendering prompt variables, `assistant` role messages are skipped. They are example outputs, not templates.
9. **Cache invalidation is explicit** — `CacheService.invalidatePrompt` must be called after prompt creation/update. The cache does not auto-invalidate.
10. **Dialect-aware date bucketing** — `MetricsService.getDateBucket` uses `date(column, 'unixepoch')` for SQLite and `TO_CHAR(TO_TIMESTAMP(column), 'YYYY-MM-DD')` for Postgres. Always use this helper; don't inline date formatting.

---

## Before Committing

1. Run `npm run lint` — fix any issues.
2. Run `npm test` — all suites must pass.
3. If you modified migrations, verify they work for both SQLite and PostgreSQL.
4. If you modified the driver interface, update all three implementations.
5. If you added a new table without an `id` column, add it to `TABLES_WITHOUT_ID`.
