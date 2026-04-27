# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Run dev server (ts-node with path aliases)
npm run dev

# Build for production (tsc + tsc-alias)
npm run build

# Start production server
npm start

# Run all tests with coverage
npm test

# Run specific test suites
npx jest tests/unit
npx jest tests/integration
npx jest tests/e2e

# Run a single test file
npx jest tests/integration/prompts.test.ts

# Lint and format
npm run lint
npm run lint:fix
npm run format

# Database and key management
npm run db:init                # Initialize SQLite schema
npm run api-key:generate       # Generate an API key
```

**Required for tests:** Set `API_KEY_SALT` in `.env` or the test setup will use a hardcoded `test-salt-for-ci`. Tests create isolated SQLite DBs in `./data/` and clean them up in `afterAll`.

**Path aliases** are defined in `tsconfig.json` and mirrored in `jest.config.js` (`@config/*`, `@controllers/*`, `@drivers/*`, etc.). Always use them for imports.

---

## High-Level Architecture

### Hybrid Storage Model

PromptMetrics uses a two-tier storage architecture that spans multiple files:

1. **Prompt content** lives in Git (GitHub, local filesystem, or S3). The `PromptDriver` interface (`src/drivers/promptmetrics-driver.interface.ts`) abstracts this. There are three implementations:
   - `FilesystemDriver` — stores JSON files at `./prompts/{name}/{version}.json`
   - `GithubDriver` — uses GitHub Contents API + a local bare clone at `./data/github-clone` (synced via background `GitSyncJob`)
   - `S3Driver` — stores prompt JSON as objects in S3 with keys like `prompts/{name}/{version}.json`

2. **Metadata** lives in SQLite (`better-sqlite3` with WAL mode) or PostgreSQL. The `getDb()` singleton (`src/models/promptmetrics-sqlite.ts`) provides the connection. Schema is managed via `umzug` migration runner (`src/migrations/migrator.ts`) with numbered TypeScript migration files in `migrations/` that use dialect-conditional DDL for SQLite and PostgreSQL.

**Key implication:** The `prompts` table in SQLite is an *index* — it stores `name`, `version_tag`, `commit_sha`, and `driver`, but the actual prompt JSON content is read from Git/filesystem by the driver. When creating a prompt, the driver writes content to the storage backend AND inserts a row into SQLite. These two operations are NOT wrapped in a transaction.

### Application Bootstrap Flow

1. `src/server.ts` loads config (which reads `.env`), initializes SQLite schema, sets up OpenTelemetry, creates the driver, and starts the Express app.
2. `src/app.ts` mounts global middleware (helmet, CORS, rate limit, JSON parser) and routes.
3. Routes are mounted at `/` but endpoints are versioned under `/v1/`. Each route file (`src/routes/*.route.ts`) receives the driver instance and wires its controller.
4. `GitSyncJob` starts only if `DRIVER=github`.

**Important:** There is a known bug where the driver is instantiated twice — once in `server.ts` (for `GitSyncJob`) and once inside `createApp()`. When modifying this area, prefer passing the driver instance from `server.ts` into `createApp(driver)` rather than creating a second instance.

### Authentication & Authorization

- `authenticateApiKey` middleware (`src/middlewares/promptmetrics-auth.middleware.ts`) reads `X-API-Key` header, HMAC-SHA256 hashes it with `API_KEY_SALT`, and looks up the hash in SQLite. Valid keys have `name`, `scopes`, and `workspace_id` attached to `req.apiKey`.
- `requireScope(scope)` returns middleware that checks `req.apiKey.scopes` and returns 403 if missing.
- `auditLog(action)` uses `res.on('finish')` to enqueue audit entries to an async batch writer (`AuditLogService`).
- `tenantMiddleware` reads `X-Workspace-Id` header and attaches it to `req.workspaceId`. All services scope queries by `workspace_id`.

### Request Flow (Prompts)

1. Route (`src/routes/promptmetrics-prompt.route.ts`) receives the driver.
2. `PromptController` methods handle HTTP concerns (pagination params, query parsing) then delegate to the driver.
3. `getPrompt` performs Mustache variable substitution on `system` and `user` role messages via the `mustache` library. The result is cached in an LRU cache (or Redis when `REDIS_URL` is set).
4. Validation is done via Joi schemas in `src/validation-schemas/` and returns 422 with a `details` array.

---

## Testing Conventions

- **Unit tests** mock drivers/services and test logic in isolation.
- **Integration tests** spin up the Express app via `supertest` and hit endpoints.
- **E2E tests** run a full lifecycle (create prompt, log, trace, run, label, audit).
- Test setup lives in `tests/env-setup.ts` (sets `API_KEY_SALT`, calls `initSchema()`) and `tests/setup.ts` (closes DB after all tests).
- `nock` is available for mocking external HTTP calls (GitHub driver tests).

---

## CLI & SDK

- **CLI** (`src/cli/promptmetrics-cli.ts`) is a standalone `commander` program that makes raw HTTP calls. It reads server URL and API key from `promptmetrics.yaml` in the CWD, or from `--server`/`--api-key` flags.
- **Node SDK** (`clients/node/src/index.ts`) is a typed wrapper around `axios` that auto-injects the `X-API-Key` header. It is NOT auto-generated from OpenAPI — it is hand-written.
- Both CLI and SDK are published as part of the same npm package (`promptmetrics`).

---

## Critical Patterns to Know

1. **Driver pattern for storage:** All prompt read/write operations go through the `PromptDriver` interface. When adding a new storage backend, implement this interface and add a case in `promptmetrics-driver.factory.ts`.
2. **Async DatabaseAdapter:** The `DatabaseAdapter` interface is uniformly async across SQLite and PostgreSQL backends. All query methods (`exec`, `all`, `get`, `run`, `transaction`) return `Promise`s. Controllers `await` every DB call. The SQLite adapter wraps `better-sqlite3` to satisfy this contract.
3. **Service layer exists:** `PromptService`, `LogService`, `TraceService`, `RunService`, `LabelService`, and `EvaluationService` encapsulate business logic. Controllers are thin and delegate to services.
4. **No ORM:** All SQL is hand-written in services and drivers. There are no models or repositories beyond the `getDb()` connection manager.
5. **Schema migrations via umzug:** Numbered TypeScript migration files in `migrations/` are applied by `umzug` on startup.
