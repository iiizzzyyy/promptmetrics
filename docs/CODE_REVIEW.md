# PromptMetrics Code Review Report

**Date:** 2026-04-25
**Reviewer:** Code Reviewer Agent
**Scope:** Full codebase (backend, UI, Python/Node SDKs, tests)
**Methodology:** Correctness, Security, Maintainability, Performance, Testing

---

## 1. Executive Summary

**Overall Health Score: B+**

The PromptMetrics codebase is well-structured for a small project, with a clean driver-pattern architecture, solid middleware coverage (Helmet, HPP, CORS, compression), comprehensive request-ID propagation, and a good test pyramid (unit, integration, e2e). Workspace isolation and HMAC-based API key hashing are implemented correctly. However, there are **several real security blockers** that require immediate attention before production use, primarily around path traversal, missing input validation, and race conditions.

### Top 3 Concerns

1. **Path Traversal in Storage Drivers:** Both `FilesystemDriver` and `GithubDriver` accept user-supplied `name` parameters and pass them directly to `path.join()`, allowing directory escape and arbitrary file read/write on the host filesystem.
2. **Unvalidated Evaluation Controller:** The `EvaluationController` is the only controller that does not use Joi schemas, passing raw `req.body` directly to the service layer. This allows arbitrary payload injection and bypasses all input controls.
3. **Race Conditions and Secret Exposure:** The SQLite-backed rate limiter has a read-then-write race condition that allows concurrent requests to burst past the limit. Additionally, the webhook handler falls back to `GITHUB_TOKEN` for HMAC verification, meaning anyone with the PAT can forge webhook events.

---

## 2. Blockers (Must Fix)

### 🔴 Security: Path Traversal in FilesystemDriver
**Files:**
- `src/drivers/promptmetrics-filesystem-driver.ts` (lines 32-37, 68-75, 96-117)

**Why:**
The `name` parameter (from `req.params.name` or the prompt body) is passed directly into `path.join(this.basePath, name)` without sanitization. While `POST /v1/prompts` validates `name` via Joi, `GET /v1/prompts/:name`, `GET /v1/prompts/:name/versions`, and the driver methods themselves do not. An attacker can use `../` sequences to escape the prompts directory.

**Impact:**
- **Read:** `GET /v1/prompts/../../../../etc/passwd` attempts to read arbitrary files (will error on non-directories, but succeeds on directories containing `.json` files).
- **Write:** `POST /v1/prompts` with `name: "../../../tmp/evil"` causes `mkdirSync` to create directories outside the base path and writes the JSON file there.

**Recommendation:**
- Sanitize `name` with a strict regex (e.g., `^[a-zA-Z0-9-_]+$`) at the controller/route layer for **all** path parameters, not just body params.
- Alternatively, use `path.normalize()` and reject paths that resolve outside `basePath`:
  ```ts
  const resolved = path.resolve(basePath, name);
  if (!resolved.startsWith(path.resolve(basePath))) throw AppError.badRequest('Invalid name');
  ```

---

### 🔴 Security: Path Traversal in GithubDriver
**File:** `src/drivers/promptmetrics-github-driver.ts` (lines 81-99)

**Why:**
Same issue as FilesystemDriver. `path.join(this.clonePath, 'prompts', name)` allows escaping the `prompts` subdirectory. For example, `name = '../README'` resolves to `{clonePath}/README`, and `name = '../.git/config'` resolves to `{clonePath}/.git/config`.

**Impact:**
Arbitrary file read within the Git clone directory, including repository configuration, other branches, or any file stored in the bare clone.

**Recommendation:**
Apply the same `path.resolve` + prefix check before accessing the filesystem in `getPrompt`, `listPrompts`, and any other filesystem-touching methods.

---

### 🔴 Security: Missing Input Validation in EvaluationController
**File:** `src/controllers/promptmetrics-evaluation.controller.ts` (lines 7-73)

**Why:**
Every other controller (Prompt, Log, Trace, Run, Label) validates `req.body` with Joi before calling the service. `EvaluationController` does not. It wraps calls in `try/catch` and passes raw `req.body` directly into `createEvaluation`, `createResult`, etc.

**Impact:**
- Arbitrary payload shapes stored in the database.
- Potential DoS via extremely large JSON payloads (`express.json` limit is 10MB, but unvalidated nested objects can still cause issues).
- Inconsistent API contract for consumers.

**Recommendation:**
Create `src/validation-schemas/promptmetrics-evaluation.schema.ts` with Joi schemas for `createEvaluation` and `createResult`, and validate `req.body` in every `EvaluationController` method, matching the pattern used in `PromptController` and `RunController`.

---

### 🔴 Security: Race Condition in SQLite Rate Limiter
**File:** `src/middlewares/rate-limit-per-key.middleware.ts` (lines 56-105)

**Why:**
`checkSqliteRateLimit` performs a non-atomic read-then-update sequence:
1. `SELECT window_start, count FROM rate_limits WHERE key = ?`
2. `UPDATE rate_limits SET count = count + 1 WHERE key = ?`

There is no transaction wrapping these two operations.

**Impact:**
Under concurrent load, two requests can read the same `count` value (e.g., `4` with a limit of `5`), both decide the request is allowed, and both increment. The actual count becomes `6`, violating the rate limit.

**Recommendation:**
Wrap the read-and-update logic in a database transaction, or use a single atomic statement like:
```sql
UPDATE rate_limits SET count = count + 1 WHERE key = ? AND count < ?
```
Then check `changes` to determine if the update succeeded.

---

### 🔴 Security: Webhook Secret Falls Back to GitHub Token
**File:** `src/routes/webhook.route.ts` (line 16)

**Why:**
```ts
const secret = process.env.GITHUB_WEBHOOK_SECRET || process.env.GITHUB_TOKEN;
```
If `GITHUB_WEBHOOK_SECRET` is not set, the handler uses the GitHub personal access token as the HMAC secret. The PAT is a long-lived credential. Anyone who knows the PAT (e.g., from leaked logs, the driver clone URL, or environment dumps) can forge valid webhook signatures and trigger arbitrary syncs.

**Impact:**
Authentication bypass for webhook endpoints. An attacker can forge `push` events and trigger `driver.sync()` at will, potentially causing DoS or pulling malicious content into the local clone.

**Recommendation:**
- Remove the fallback. Require `GITHUB_WEBHOOK_SECRET` explicitly.
- Fail closed: if `GITHUB_WEBHOOK_SECRET` is missing, return `500` or disable the webhook route entirely.

---

### 🔴 Security: Sensitive Data Logged to stdout
**File:** `src/controllers/promptmetrics-log.controller.ts` (line 19)

**Why:**
```ts
console.log(JSON.stringify({ type: 'promptmetrics.log', ...logEntry }));
```
The entire log entry object (including `metadata`, `provider`, `model`, `cost_usd`, etc.) is serialized and written to stdout. If `metadata` contains PII (user IDs, emails, IP addresses, prompt content), this leaks sensitive data to log aggregation systems, Docker logs, or CI output.

**Impact:**
Potential exposure of personally identifiable information, API keys, or proprietary prompt content through centralized logging infrastructure.

**Recommendation:**
Remove this `console.log` or redact the `metadata` field. If structured logging is required, use a proper logging level (e.g., `debug`) and ensure log sinks are configured to scrub sensitive fields.

---

### 🔴 Security: SQL Injection Pattern in Migration Storage
**File:** `src/migrations/sqlite-storage.ts` (lines 22-38)

**Why:**
```ts
await this.db.prepare(`INSERT INTO ${this.tableName} (${this.columnName}) VALUES (?)`).run(name);
```
While `tableName` and `columnName` are currently hardcoded to `'migrations'` and `'name'`, this pattern is dangerous. If the constructor arguments ever become dynamic or user-influenced, this is a direct SQL injection vector.

**Impact:**
Potential SQL injection if `SQLiteStorage` is ever instantiated with untrusted input.

**Recommendation:**
Validate `tableName` and `columnName` against a strict whitelist (e.g., `/^[a-z_][a-z0-9_]*$/i`) before interpolating them into SQL.

---

## 3. Suggestions (Should Fix)

### 🟡 Missing Path Parameter Validation Across Routes
**Files:**
- `src/controllers/promptmetrics-prompt.controller.ts` (line 20)
- `src/controllers/promptmetrics-label.controller.ts` (lines 10, 26, 37, 51)
- `src/controllers/promptmetrics-run.controller.ts` (lines 27, 44)
- `src/controllers/promptmetrics-trace.controller.ts` (lines 26, 41, 59, 60)

**Why:**
`req.params.name`, `req.params.label_name`, `req.params.run_id`, and `req.params.trace_id` are cast with `as string` but never validated. While some drivers are now protected by body validation on `POST`, `GET`, `PATCH`, and `DELETE` routes remain open to malformed inputs, special characters, or extremely long strings.

**Recommendation:**
Add a shared path-parameter sanitizer middleware or validate params inline with the same regex used in Joi schemas (`^[a-zA-Z0-9-_]+$`).

---

### 🟡 GitHub Token Embedded in Clone URL
**File:** `src/drivers/promptmetrics-github-driver.ts` (line 44)

**Why:**
```ts
await git.clone(`https://${this.token}@github.com/${this.repo}.git`, this.clonePath);
```
The PAT is interpolated into the HTTPS URL. If `simple-git` or the underlying `git` CLI logs an error, the token may be written to stderr/stdout logs. This also makes token rotation harder because the token is stored in the git remote URL inside the clone.

**Recommendation:**
Use `simple-git`'s authentication options (e.g., `GIT_ASKPASS` script, or write the token to a temporary `.git-credentials` file with strict permissions) instead of embedding it in the URL.

---

### 🟡 Node SDK Missing URL Encoding
**File:** `clients/node/src/index.ts` (line 77)

**Why:**
```ts
const res = await this.client.get<RenderedPrompt>(`/v1/prompts/${name}`, ...)
```
`name` is not URL-encoded before interpolation. A prompt name containing `/` or `?` will break the request path or alter query parameters.

**Recommendation:**
Use `encodeURIComponent(name)` when building paths:
```ts
`/v1/prompts/${encodeURIComponent(name)}`
```

---

### 🟡 Python SDK Missing URL Encoding
**File:** `clients/python/promptmetrics/client.py` (line 35)

**Why:**
```python
return self._client._request("GET", f"/v1/prompts/{name}", params=params)
```
Same issue as the Node SDK.

**Recommendation:**
Use `urllib.parse.quote(name, safe='')` before interpolating into the path.

---

### 🟡 Redis KEYS Command Blocks on Large Datasets
**File:** `src/services/cache.service.ts` (line 48)

**Why:**
```ts
const keys = await redis.keys(`prompt:${workspaceId}:${name}:*`);
```
`KEYS` is an O(N) operation that blocks the Redis event loop. In production with many keys, this can cause latency spikes or timeouts.

**Recommendation:**
Replace `redis.keys()` with `redis.scan()` (iterative) to avoid blocking the server.

---

### 🟡 CORS Enabled Without Restriction
**File:** `src/app.ts` (line 35)

**Why:**
```ts
app.use(cors());
```
This allows cross-origin requests from **any** domain. For a self-hosted API that may be exposed to the internet, this increases the attack surface for CSRF-like attacks (though API key headers mitigate simple CSRF, preflight behavior still matters).

**Recommendation:**
Restrict CORS to known origins via environment configuration:
```ts
app.use(cors({ origin: config.corsOrigin || false }));
```

---

### 🟡 Missing Workspace Filter in GithubDriver.listVersions
**File:** `src/drivers/promptmetrics-github-driver.ts` (lines 236-238)

**Why:**
```ts
const rows = (await db.prepare('SELECT * FROM prompts WHERE name = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(name, limit, (page - 1) * limit)) as PromptVersion[];
```
This query does not include `workspace_id = ?`, meaning it returns prompts across all workspaces for the given name.

**Recommendation:**
Add `AND workspace_id = ?` to the query and pass the workspace ID. Note: the driver interface does not currently receive `workspaceId` in `listVersions`, so the interface may need to be extended.

---

### 🟡 express-rate-limit Dependency Unused
**File:** `package.json` (line 87)

**Why:**
`express-rate-limit` is listed in dependencies but the codebase uses a custom `rateLimitPerKey` middleware. This increases bundle size and attack surface for no benefit.

**Recommendation:**
Remove the unused dependency, or migrate the custom middleware to use the well-tested `express-rate-limit` library.

---

### 🟡 AuditLogService Buffer Edge Case
**File:** `src/services/audit-log.service.ts` (lines 32-36)

**Why:**
The `enqueue` method checks `this.buffer.length >= this.maxBufferSize` and then triggers an async `flush()`. While JavaScript is single-threaded, the async `flush` can interleave with subsequent `enqueue` calls in the event loop. Under extreme burst traffic, the buffer can grow well past `maxBufferSize` before `splice` executes.

**Recommendation:**
Use a semaphore or simply move the overflow check into `flush()` itself (flush until buffer is below threshold) to prevent unbounded growth.

---

### 🟡 PostgresAdapter Does Not Actually Prepare Statements
**File:** `src/models/postgres.adapter.ts` (line 36)

**Why:**
The `prepare()` method returns an object that executes `pool.query(sql, params)`. It does not use PostgreSQL prepared statements (`PREPARE` / `EXECUTE`). The interface name is misleading.

**Recommendation:**
Rename the method to `query()` or implement actual prepared statements using `client.prepare()` from `pg` for better performance and clarity.

---

## 4. Nits (Nice to Have)

### 💭 Magic Numbers in Pagination
**Files:** Multiple controllers (e.g., `promptmetrics-prompt.controller.ts` lines 10-11)

**Why:**
`Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50))` is repeated in every controller.

**Recommendation:**
Extract `DEFAULT_PAGE_SIZE = 50` and `MAX_PAGE_SIZE = 100` into `src/utils/pagination.ts` and use them consistently.

---

### 💭 Inconsistent Controller Error Handling
**File:** `src/controllers/promptmetrics-evaluation.controller.ts`

**Why:**
`EvaluationController` wraps every method in `try/catch(err) { next(err); }`, while other controllers throw `AppError` directly and rely on the global `errorHandlerMiddleware`. This inconsistency makes the codebase harder to maintain.

**Recommendation:**
Standardize on throwing `AppError` and letting the global handler manage responses, unless a specific controller truly needs custom error handling.

---

### 💭 UI API Key Stored in localStorage
**File:** `ui/src/lib/auth.tsx` (line 21)

**Why:**
```ts
localStorage.setItem('pm_api_key', key);
```
If a cross-site scripting (XSS) vulnerability exists in the Next.js UI, the API key is trivially accessible via `localStorage.getItem('pm_api_key')`.

**Recommendation:**
Consider using `sessionStorage` (cleared on tab close) or, better, a httpOnly cookie set by a backend auth flow. For a local dashboard, `sessionStorage` is a reasonable compromise.

---

### 💭 Hardcoded Test Salt
**File:** `tests/env-setup.ts` (lines 2-3)

**Why:**
```ts
process.env.API_KEY_SALT = 'test-salt-for-ci';
```
While documented and acceptable for CI, hardcoded secrets set a bad precedent. If this pattern leaks into production config loading, it weakens HMAC security.

**Recommendation:**
Generate a random salt per test run (e.g., `crypto.randomBytes(16).toString('hex')`) unless deterministic hashes are required for a specific test.

---

### 💭 Missing Path Traversal Test Coverage
**Files:** `tests/unit/filesystem-driver.test.ts`, `tests/unit/github-driver.test.ts`

**Why:**
Neither driver test suite includes a test case for malicious `name` inputs such as `../../../etc/passwd`.

**Recommendation:**
Add negative test cases asserting that drivers reject or sanitize path-traversal sequences.

---

### 💭 Mustache Escape Disabled
**File:** `src/services/prompt.service.ts` (line 94)

**Why:**
```ts
mustache.render(msg.content, variables, undefined, { escape: (text) => text })
```
The custom escape function disables HTML entity encoding. This is intentional for prompt rendering (you want literal text), but it means if rendered prompts are ever displayed in an HTML context without additional sanitization, they become an XSS vector.

**Recommendation:**
Document this behavior clearly in the API docs. Ensure the UI and any downstream consumers HTML-escape rendered prompt content before DOM insertion.

---

## 5. Positive Findings

- **Strong Authentication & Authorization:** API keys are hashed with HMAC-SHA256 using a configurable salt. Scope-based access control (`read`, `write`, `admin`) is enforced consistently via `requireScope`.
- **Workspace Isolation:** The tenant middleware combined with DB-level `workspace_id` filtering provides genuine multi-tenancy, verified by integration tests.
- **Security Middleware:** Helmet, HPP, compression, and raw body parsing for webhooks are all present and correctly ordered.
- **Request Tracing:** Every request gets a UUID via `requestIdMiddleware`, which is propagated to error responses and logs.
- **Parameterized SQL:** All service-layer SQL queries use `?` placeholders. There are **no** SQL injection vulnerabilities in the business logic services.
- **Webhook Security:** Signature verification uses `crypto.timingSafeEqual` with proper length checks, preventing timing attacks.
- **Graceful Shutdown:** `setupGracefulShutdown` closes the HTTP server, flushes audit logs, shuts down OTel, and closes the DB connection before exiting.
- **Circuit Breaker:** GitHub API writes are wrapped in an Opossum circuit breaker with exponential backoff retry on 429 responses.
- **Test Coverage:** The project has unit, integration, and e2e tests, including concurrent-write tests and full lifecycle verification.

---

## 6. Testing Gaps

| Gap | Location | Impact |
|-----|----------|--------|
| **Path traversal inputs** | `tests/unit/filesystem-driver.test.ts`, `tests/unit/github-driver.test.ts` | No validation that malicious `name` params are rejected |
| **Evaluation input validation** | `tests/integration/evaluations.test.ts` | No tests for invalid payloads because controller has no validation |
| **Rate limiter concurrency** | `tests/integration/rate-limit.test.ts` | Tests single-threaded behavior but not concurrent burst |
| **SQL injection fuzzing** | All integration tests | No negative tests for SQL meta-characters in query params |
| **Node SDK coverage** | `clients/node/src/index.test.ts` | Only instantiation is tested; no request logic coverage |
| **Python SDK coverage** | `clients/python/tests/test_client.py` | Basic mock tests exist, but no error-handling or URL-encoding tests |
| **Webhook secret fallback** | `tests/integration/webhook.test.ts` | Tests valid/invalid signatures, but not the `GITHUB_TOKEN` fallback behavior |

---

## 7. Recommended Priority Order for Fixes

1. **Fix path traversal in `FilesystemDriver` and `GithubDriver`** (Blocker #1, #2)
   - Add `path.resolve` prefix checks or strict regex validation on all `name` parameters.
2. **Add Joi validation to `EvaluationController`** (Blocker #3)
   - Create `promptmetrics-evaluation.schema.ts` and validate all bodies.
3. **Remove webhook secret fallback to `GITHUB_TOKEN`** (Blocker #5)
   - Fail closed if `GITHUB_WEBHOOK_SECRET` is missing.
4. **Fix SQLite rate limiter race condition** (Blocker #4)
   - Use atomic `UPDATE ... WHERE count < max` or wrap in a transaction.
5. **Remove or redact sensitive `console.log` in `LogController`** (Blocker #6)
6. **Sanitize identifiers in `SQLiteStorage`** (Blocker #7)
   - Add regex whitelist for `tableName` and `columnName`.
7. **Add path parameter validation to all routes** (Suggestion #1)
8. **URL-encode path segments in Node and Python SDKs** (Suggestion #3, #4)
9. **Replace Redis `KEYS` with `SCAN`** (Suggestion #5)
10. **Restrict CORS to configured origins** (Suggestion #6)
11. **Add missing workspace filter to `GithubDriver.listVersions`** (Suggestion #7)
12. **Backfill tests** for path traversal, evaluation validation, and rate-limit concurrency (Testing Gaps)
