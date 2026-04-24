# PromptMetrics Repository Review & Improvements Roadmap

**Date:** 2026-04-24
**Reviewer:** AI Assistant
**Repository:** https://github.com/iiizzzyyy/promptmetrics
**Commit:** (latest on main)

---

## Executive Summary

PromptMetrics is a well-structured, self-hosted prompt registry built on **Node.js/Express + TypeScript + SQLite**. It features Git-backed versioning (filesystem or GitHub drivers), API key authentication, OpenTelemetry observability, and a CLI + Node.js SDK. The codebase is clean, modular, and follows good separation of concerns. However, several areas can be hardened for production readiness, scalability, and maintainability.

---

## Strengths

| Area | Assessment |
|---|---|
| **Architecture** | Clean layered architecture (routes -> controllers -> drivers -> services). Driver pattern enables pluggable storage backends. |
| **Code Organization** | Logical directory structure with clear separation of concerns. Path aliases (`@config`, `@controllers`, etc.) improve readability. |
| **Security Baseline** | Helmet, CORS, HPP, rate limiting, API key HMAC hashing, audit logging. |
| **Observability** | OpenTelemetry integration for tracing. Structured JSON logging. |
| **Testing** | Comprehensive test suite: unit, integration, and E2E with Jest + Supertest. |
| **Developer Experience** | CLI tool, SDK client, docker-compose setup, clear documentation. |
| **Type Safety** | TypeScript with strong interfaces. Joi validation on all inputs. |

---

## 1. Architectural Review

### 1.1 Entry Point & Lifecycle (`src/server.ts`, `src/app.ts`)

**Current State:**
- `server.ts` bootstraps DB, OTel, driver, Express app, and background jobs.
- `createApp()` in `app.ts` wires middleware and routes.

**Concerns:**
- **Driver instantiated twice**: `server.ts:18` creates a driver, then `app.ts:17` creates another inside `createApp()`. This is wasteful and could cause state divergence (e.g., two SQLite connections, two GitSyncJob instances if not careful).
- **Global error handler** exposes `err.message` in development but could leak sensitive paths or internals.
- **No request ID propagation** for tracing logs across a single request lifecycle.

**Recommendations:**
- Pass the driver instance from `server.ts` into `createApp(driver)` to ensure singleton semantics.
- Add a `requestId` middleware (UUID) and attach it to logs and OTel spans for request correlation.
- Consider using an `AsyncLocalStorage` context to avoid passing `req` through every function.

### 1.2 Storage Layer (Driver Pattern)

**Current State:**
- `PromptDriver` interface abstracts filesystem vs. GitHub.
- `FilesystemDriver` stores JSON files locally.
- `GithubDriver` uses GitHub Contents API + local bare clone.

**Concerns:**
- **SQLite schema migrations** are manual `ALTER TABLE` blocks in `initSchema()`. This does not scale.
- **No transaction support** in controllers. A failed GitHub push could leave SQLite in an inconsistent state.
- **GithubDriver** does `git pull` on every sync but does not handle merge conflicts or authentication expiry gracefully.
- **Race condition risk**: `ensureCloned()` checks `fs.existsSync()` then does `git clone` -- not atomic.
- **Rate limiting** is only handled for GitHub 429s; no circuit breaker for repeated failures.

**Recommendations:**
- Introduce a lightweight migration runner (e.g., `umzug` or a simple numbered migration file system).
- Wrap multi-step operations (GitHub push + SQLite insert) in database transactions with rollback on failure.
- Use a proper Git library (`simple-git`) instead of `execSync` for better error handling and concurrency safety.
- Add a circuit breaker for GitHub API calls (e.g., `opossum`).

### 1.3 Database Layer (`src/models/promptmetrics-sqlite.ts`)

**Current State:**
- Singleton `better-sqlite3` connection with WAL mode and foreign keys.
- Schema initialization is inline SQL.

**Concerns:**
- **Singleton is not thread-safe across workers** (but fine for single-process Node.js).
- **No connection pooling or read replicas** -- this is fine for SQLite, but limits horizontal scaling.
- **Schema drift risk**: The `PRAGMA table_info` migration pattern is fragile.
- **No soft deletes** -- prompts/versions cannot be recovered if deleted.
- **`created_at` uses `unixepoch()`** (seconds), but `Date.now() / 1000` in code mixes precision. Pick one.

**Recommendations:**
- Use `knex.js` or `drizzle-orm` for query building, migrations, and type-safe schema definitions.
- Store timestamps as ISO 8601 strings or consistent millisecond integers.
- Consider adding `deleted_at` columns for soft deletes.

---

## 2. Code Quality Review

### 2.1 Controllers (`src/controllers/`)

**Current State:**
- Controllers handle HTTP logic, pagination, query parsing, and error formatting.

**Concerns:**
- **No centralized error handling**: Every controller repeats `try/catch` + `res.status(500).json(...)`.
- **No pagination metadata standard**: Some endpoints return `totalPages`, others don't.
- **Variable rendering** uses custom regex (`\{\{\s*key\s*\}\}`) instead of the `mustache` dependency already listed in `package.json`.
- **Mixed concerns**: `getPrompt` handles rendering logic, validation, and variable parsing -- this belongs in a service layer.

**Recommendations:**
- Introduce a **service layer** between controllers and drivers. Controllers should only handle HTTP concerns (parsing, status codes, headers).
- Use a centralized error class (e.g., `AppError extends Error` with `statusCode`) and an Express error handler.
- Replace custom regex rendering with the `mustache` library (already a dependency).
- Standardize pagination response shapes via a helper function.

### 2.2 Authentication (`src/middlewares/promptmetrics-auth.middleware.ts`)

**Current State:**
- HMAC-SHA256 hashing with salt.
- API key lookup in SQLite.
- Scope-based authorization via `requireScope()`.

**Concerns:**
- **Timing attack vulnerability**: `hashApiKey()` computes the HMAC for every request, but the comparison is not constant-time.
- **No key rotation support**: Old keys cannot be revoked without DB access.
- **No rate limiting per API key**: The global rate limit (100 req/min) is not per-key.
- **Scopes stored as comma-delimited string** (`'read,write'`) instead of a normalized table or array.

**Recommendations:**
- Add per-key rate limiting (store counters in SQLite or Redis).
- Normalize scopes into a separate `api_key_scopes` table or store as JSON array.
- Add key expiration (`expires_at` column) and rotation workflow.
- Consider using `bcrypt` or `argon2` for key hashing instead of HMAC for brute-force protection.

### 2.3 Audit Logging (`src/middlewares/promptmetrics-audit.middleware.ts`)

**Current State:**
- Intercepts `res.send` to log successful mutations.

**Concerns:**
- **Monkey-patching `res.send`** is fragile and can interfere with other middleware or streaming responses.
- **Synchronous SQLite write** inside the response path adds latency.
- **No batching** -- every request triggers an immediate INSERT.

**Recommendations:**
- Use an event emitter or queue (in-memory batch + flush) instead of monkey-patching.
- Make audit logging asynchronous (fire-and-forget) so it never blocks the response.
- Consider streaming audit logs to a file or external system instead of SQLite for high volume.

### 2.4 Validation (`src/validation-schemas/`)

**Current State:**
- Joi schemas for all request bodies.

**Concerns:**
- **No request query validation**: `page`, `limit`, `version` query params are parsed manually in controllers.
- **No OpenAPI/Swagger spec** -- consumers must read source code to understand the API.

**Recommendations:**
- Validate query params with Joi in a reusable middleware.
- Generate an OpenAPI spec from the Joi schemas (or migrate to Zod + `zod-to-openapi`).

---

## 3. Security Review

| Risk | Severity | Details |
|---|---|---|
| **SQL Injection** | Low | Uses parameterized queries (`better-sqlite3` `.run(..., params)`), which is safe. Good. |
| **XSS/Content Injection** | Low | No HTML rendering; JSON API only. |
| **Authentication Bypass** | Low | Proper API key checking. |
| **Secrets in Logs** | Medium | `console.error('Unhandled error:', err)` in `app.ts:44` could leak stack traces with secrets. |
| **GitHub Token Exposure** | Medium | `execSync` clones with token in URL: `https://${this.token}@github.com/...`. This token may appear in process listings or shell history. |
| **Rate Limiting Bypass** | Medium | No per-key rate limiting; one bad actor can exhaust the global limit. |
| **DoS via Large JSON** | Low-Medium | `express.json({ limit: '10mb' })` is reasonable, but no validation of nested object depth. |

**Recommendations:**
- Sanitize error outputs in production (remove `err.message` from 500 responses entirely).
- Use GitHub token via `Authorization` header instead of embedding in URL.
- Add request body depth/size validation.
- Implement per-key rate limiting.

---

## 4. Performance & Scalability

| Concern | Impact | Mitigation |
|---|---|---|
| **SQLite is single-writer** | Limits concurrent writes | Use WAL mode (already enabled). For high write volume, consider PostgreSQL as an optional backend. |
| **Synchronous DB operations** | Blocks event loop | `better-sqlite3` is intentionally synchronous. For heavy loads, move reads to replicas or use `node:worker_threads`. |
| **No caching layer** | Repeated DB queries for static data | Add an LRU cache for prompt lookups (e.g., `lru-cache`). |
| **GitHub driver sync** | Every sync does `git pull` + full file reads | Use GitHub GraphQL API or webhooks instead of polling. |
| **No compression** | JSON responses are uncompressed | Add `compression` middleware. |

---

## 5. Testing Review

**Current State:**
- Unit, integration, and E2E tests with Jest + Supertest.

**Gaps:**
- **No property-based testing** (e.g., `fast-check`) for validation schemas.
- **No load/stress tests** -- the rate limiter and SQLite concurrency are untested under load.
- **No mutation testing** to verify test quality.
- **Mock coverage**: `nock` is listed but verify GitHub driver tests cover 429 retries and auth failures.
- **No contract testing** between server and Node SDK.

---

## 6. Improvements Roadmap

### Short-Term (1-2 Weeks) -- Stability & Polish

| Priority | Task | Effort |
|---|---|---|
| P0 | Fix double driver instantiation (`server.ts` + `app.ts`) | 30 min |
| P0 | Replace custom regex rendering with `mustache` library | 1 hour |
| P0 | Add request ID middleware for log correlation | 1 hour |
| P1 | Centralize error handling with `AppError` class | 2 hours |
| P1 | Add per-API-key rate limiting | 3 hours |
| P1 | Extract service layer from controllers | 4 hours |
| P1 | Standardize pagination helper | 1 hour |
| P2 | Add `compression` middleware | 15 min |
| P2 | Add query param validation middleware | 2 hours |

### Medium-Term (1-2 Months) -- Production Hardening

| Priority | Task | Effort |
|---|---|---|
| P0 | Introduce migration system (e.g., `drizzle-orm` or `umzug`) | 1-2 days |
| P0 | Add database transactions for multi-step operations | 2-3 days |
| P1 | Replace `execSync` git calls with `simple-git` | 1 day |
| P1 | Implement audit log queue (async batching) | 1-2 days |
| P1 | Add LRU cache for prompt lookups | 1 day |
| P1 | Add OpenAPI/Swagger documentation | 2 days |
| P2 | Implement circuit breaker for GitHub API | 1 day |
| P2 | Add key expiration and rotation workflow | 2 days |
| P2 | Sanitize production error responses | 2 hours |

### Long-Term (3-6 Months) -- Scale & Ecosystem

| Priority | Task | Effort |
|---|---|---|
| P1 | Support PostgreSQL as an alternative database backend | 1-2 weeks |
| P1 | Add Redis for caching, rate limiting, and session state | 1 week |
| P1 | Implement webhook support for GitHub events (instead of polling) | 3-5 days |
| P2 | Build a web UI dashboard for prompt management | 2-4 weeks |
| P2 | Add Python SDK alongside Node SDK | 1-2 weeks |
| P2 | Add prompt evaluation framework (A/B testing, scoring) | 2-3 weeks |
| P3 | Support S3-compatible storage driver | 1 week |
| P3 | Add multi-tenancy (workspace isolation) | 2-3 weeks |

---

## 7. Quick Wins (Do These Now)

1. **Fix driver singleton**: Pass driver from `server.ts` into `createApp(driver)`.
2. **Use mustache**: Replace the custom `replace(new RegExp(...))` in `PromptController` with `mustache.render()`.
3. **Add request IDs**: Simple middleware to generate `x-request-id` and log it.
4. **Sanitize 500 errors**: Never send `err.message` in production responses.
5. **Add compression**: `npm install compression` + one line in `app.ts`.

---

## Final Assessment

**Grade: B+** -- Solid foundation, production-viable for small-to-medium scale, with clear paths to enterprise readiness.

The biggest architectural wins will come from:
1. Extracting a service layer to decouple HTTP from business logic
2. Adding proper database transactions and migrations
3. Hardening security (per-key rate limiting, key rotation)
4. Adding a web UI to make this accessible to non-developers

This is a strong open-source project with good bones. The code is readable, well-tested, and follows conventions. The main work ahead is production hardening and scaling the storage layer beyond SQLite for high-traffic deployments.

---

*Report generated on 2026-04-24.*
