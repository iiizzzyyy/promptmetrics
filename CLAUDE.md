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

1. **Prompt content** lives in Git (GitHub or local filesystem). The `PromptDriver` interface (`src/drivers/promptmetrics-driver.interface.ts`) abstracts this. There are two implementations:
   - `FilesystemDriver` — stores JSON files at `./prompts/{name}/{version}.json`
   - `GithubDriver` — uses GitHub Contents API + a local bare clone at `./data/github-clone` (synced via background `GitSyncJob`)

2. **Metadata** lives in SQLite (`better-sqlite3` with WAL mode). The `getDb()` singleton (`src/models/promptmetrics-sqlite.ts`) provides the connection. Schema is initialized via `initSchema()` with inline `CREATE TABLE` and `PRAGMA table_info`-based migrations.

**Key implication:** The `prompts` table in SQLite is an *index* — it stores `name`, `version_tag`, `commit_sha`, and `driver`, but the actual prompt JSON content is read from Git/filesystem by the driver. When creating a prompt, the driver writes content to the storage backend AND inserts a row into SQLite. These two operations are NOT wrapped in a transaction.

### Application Bootstrap Flow

1. `src/server.ts` loads config (which reads `.env`), initializes SQLite schema, sets up OpenTelemetry, creates the driver, and starts the Express app.
2. `src/app.ts` mounts global middleware (helmet, CORS, rate limit, JSON parser) and routes.
3. Routes are mounted at `/` but endpoints are versioned under `/v1/`. Each route file (`src/routes/*.route.ts`) receives the driver instance and wires its controller.
4. `GitSyncJob` starts only if `DRIVER=github`.

**Important:** There is a known bug where the driver is instantiated twice — once in `server.ts` (for `GitSyncJob`) and once inside `createApp()`. When modifying this area, prefer passing the driver instance from `server.ts` into `createApp(driver)` rather than creating a second instance.

### Authentication & Authorization

- `authenticateApiKey` middleware (`src/middlewares/promptmetrics-auth.middleware.ts`) reads `X-API-Key` header, HMAC-SHA256 hashes it with `API_KEY_SALT`, and looks up the hash in SQLite. Valid keys have `name` and `scopes` attached to `req.apiKey`.
- `requireScope(scope)` returns middleware that checks `req.apiKey.scopes` and returns 403 if missing.
- `auditLog(action)` monkey-patches `res.send` to write successful mutations to the `audit_logs` table. Be careful when adding other middleware that also patches `res.send`.

### Request Flow (Prompts)

1. Route (`src/routes/promptmetrics-prompt.route.ts`) receives the driver.
2. `PromptController` methods handle HTTP concerns (pagination params, query parsing) then delegate to the driver.
3. `getPrompt` also performs Mustache-style variable substitution on `system` and `user` role messages (custom regex, not the `mustache` library despite it being a dependency).
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
2. **Synchronous SQLite:** `better-sqlite3` is synchronous. Controllers call `db.prepare().all()` and block the event loop. This is intentional but means heavy DB operations will stall the server.
3. **No service layer:** Controllers talk directly to drivers and SQLite. There is no intermediate service/abstraction layer between routes and storage.
4. **No ORM:** All SQL is hand-written in controllers and drivers. There are no models or repositories beyond the `getDb()` connection manager.
5. **Schema migrations are manual:** New columns are added via `PRAGMA table_info` checks in `initSchema()`. There is no formal migration runner.
