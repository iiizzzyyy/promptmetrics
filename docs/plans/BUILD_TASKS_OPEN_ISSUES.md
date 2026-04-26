# Build Tasks: Open Issues #24–#28

**Derived from:** [Issue Resolution Plan](./open-issues-resolution-plan.md)  
**Date:** 2026-04-26  
**Status:** Proposed — Awaiting Approval  
**Milestone:** [API Completeness](https://github.com/iiizzzyyy/promptmetrics/milestone/5)

---

## Legend

- `[ ]` — Not started  
- `[-]` — In progress  
- `[x]` — Complete  
- `**BLOCKED**` — Waiting on dependency  

---

## Epic 0: Close Duplicate Issue #24

- [ ] **0.1.1** Comment on #24: "This was resolved in PR #23 and released in v1.0.4. The `--json` flag is registered globally and works across all commands."
- [ ] **0.1.2** Close issue #24 as duplicate

---

## Epic 1: Issue #25 — Missing GET /v1/logs and GET /v1/traces List Endpoints

**Goal:** Add paginated list routes for logs and traces following the existing `RunService` pattern.

---

### Task 1.1 — Add `listLogs()` to LogService

- [ ] **1.1.1** Open `src/services/log.service.ts`
- [ ] **1.1.2** Import `parsePagination` and `buildPaginatedResponse` from `@utils/pagination`
- [ ] **1.1.3** Add `listLogs(page: number, limit: number, workspaceId: string)` method:
  ```typescript
  async listLogs(page: number, limit: number, workspaceId: string = 'default'): Promise<PaginatedResponse<LogEntry>> {
    const db = getDb();
    const { offset } = parsePagination({ page: String(page), limit: String(limit) });
    const total = ((await db.prepare('SELECT COUNT(*) as c FROM logs WHERE workspace_id = ?').get(workspaceId)) as { c: number }).c;
    const items = (await db
      .prepare('SELECT * FROM logs WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(workspaceId, limit, offset)) as Array<{
      log_id: number; prompt_name: string; version_tag: string | null;
      provider: string | null; model: string | null; tokens_in: number | null;
      tokens_out: number | null; latency_ms: number | null; cost_usd: number | null;
      metadata_json: string | null; ollama_options_json: string | null;
      ollama_format: string | null; workspace_id: string; created_at: number;
    }>;

    return buildPaginatedResponse(
      items.map((l) => ({
        log_id: l.log_id,
        prompt_name: l.prompt_name,
        version_tag: l.version_tag,
        provider: l.provider,
        model: l.model,
        tokens_in: l.tokens_in,
        tokens_out: l.tokens_out,
        latency_ms: l.latency_ms,
        cost_usd: l.cost_usd,
        metadata: l.metadata_json ? JSON.parse(l.metadata_json) : {},
        ollama_options: l.ollama_options_json ? JSON.parse(l.ollama_options_json) : null,
        ollama_format: l.ollama_format,
        created_at: l.created_at,
      })),
      total,
      page,
      limit,
    );
  }
  ```
- [ ] **1.1.4** Verify TypeScript compiles: `npm run build` — Clean

---

### Task 1.2 — Add `listTraces()` to TraceService

- [ ] **1.2.1** Open `src/services/trace.service.ts`
- [ ] **1.2.2** Import `parsePagination` and `buildPaginatedResponse` from `@utils/pagination`
- [ ] **1.2.3** Add `listTraces(page, limit, workspaceId)` method:
  ```typescript
  async listTraces(page: number, limit: number, workspaceId: string = 'default'): Promise<PaginatedResponse<Trace>> {
    const db = getDb();
    const { offset } = parsePagination({ page: String(page), limit: String(limit) });
    const total = ((await db.prepare('SELECT COUNT(*) as c FROM traces WHERE workspace_id = ?').get(workspaceId)) as { c: number }).c;
    const items = (await db
      .prepare('SELECT * FROM traces WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(workspaceId, limit, offset)) as Array<{
      trace_id: string; prompt_name: string | null; version_tag: string | null;
      status: string; metadata_json: string | null; workspace_id: string; created_at: number;
    }>;

    return buildPaginatedResponse(
      items.map((t) => ({
        trace_id: t.trace_id,
        prompt_name: t.prompt_name,
        version_tag: t.version_tag,
        status: t.status,
        metadata: t.metadata_json ? JSON.parse(t.metadata_json) : {},
        created_at: t.created_at,
      })),
      total,
      page,
      limit,
    );
  }
  ```
- [ ] **1.2.4** Verify TypeScript compiles

---

### Task 1.3 — Add `listLogs()` to LogController

- [ ] **1.3.1** Open `src/controllers/promptmetrics-log.controller.ts`
- [ ] **1.3.2** Import `parsePagination` from `@utils/pagination`
- [ ] **1.3.3** Add `listLogs()` method:
  ```typescript
  async listLogs(req: Request, res: Response): Promise<void> {
    const { page, limit } = parsePagination(req.query);
    const workspaceId = req.workspaceId || 'default';
    const result = await this.service.listLogs(page, limit, workspaceId);
    res.status(200).json(result);
  }
  ```

---

### Task 1.4 — Add `listTraces()` to TraceController

- [ ] **1.4.1** Open `src/controllers/promptmetrics-trace.controller.ts`
- [ ] **1.4.2** Import `parsePagination` from `@utils/pagination`
- [ ] **1.4.3** Add `listTraces()` method:
  ```typescript
  async listTraces(req: Request, res: Response): Promise<void> {
    const { page, limit } = parsePagination(req.query);
    const workspaceId = req.workspaceId || 'default';
    const result = await this.service.listTraces(page, limit, workspaceId);
    res.status(200).json(result);
  }
  ```

---

### Task 1.5 — Wire List Routes

- [ ] **1.5.1** Open `src/routes/promptmetrics-log.route.ts`
- [ ] **1.5.2** Import `validateQuery` and `paginationQuerySchema`
- [ ] **1.5.3** Add `router.get('/v1/logs', validateQuery(paginationQuerySchema), (req, res) => controller.listLogs(req, res));`
- [ ] **1.5.4** Open `src/routes/promptmetrics-trace.route.ts`
- [ ] **1.5.5** Import `validateQuery` and `paginationQuerySchema`
- [ ] **1.5.6** Add `router.get('/v1/traces', validateQuery(paginationQuerySchema), (req, res) => controller.listTraces(req, res));`

---

### Task 1.6 — Add Index for Trace Created At

- [ ] **1.6.1** Check `migrations/001_initial_schema.sql` for existing trace indexes
- [ ] **1.6.2** If `idx_traces_created` is missing, add migration `006_add_trace_created_index.sql`:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_traces_created ON traces(created_at);
  ```

---

### Task 1.7 — Integration Tests

- [ ] **1.7.1** Create `tests/integration/logs.test.ts` (or extend existing if present):
  - Seed 5 log entries in `beforeEach`
  - Test `GET /v1/logs?page=1&limit=3` returns 200, `items.length === 3`, `total === 5`
  - Test `GET /v1/logs?page=2&limit=3` returns 200, `items.length === 2`
- [ ] **1.7.2** Extend `tests/integration/traces.test.ts`:
  - Seed 5 traces in `beforeEach`
  - Test `GET /v1/traces?page=1&limit=3` returns 200, `items.length === 3`, `total === 5`
  - Verify `items[0]` has `trace_id`, `prompt_name`, `status`, `created_at`

---

### Task 1.8 — Regression Testing

- [ ] **1.8.1** Run `npm test` — verify all 31 suites pass
- [ ] **1.8.2** Run `npm run build` — verify TypeScript compiles cleanly

---

## Epic 2: Issue #26 — Metadata Validation Rejects Nested Objects

**Goal:** Allow arbitrary nested JSON in metadata fields across trace, span, and log schemas.

---

### Task 2.1 — Relax Trace Schema Metadata Validation

- [ ] **2.1.1** Open `src/validation-schemas/promptmetrics-trace.schema.ts`
- [ ] **2.1.2** Find the metadata schema definition (likely `metadata: Joi.object().pattern(...)`)
- [ ] **2.1.3** Replace with:
  ```typescript
  metadata: Joi.object().unknown(true).max(50).messages({
    'object.max': 'metadata cannot contain more than 50 keys',
  }),
  ```
- [ ] **2.1.4** Apply same change to span metadata if separate

---

### Task 2.2 — Relax Log Schema Metadata Validation

- [ ] **2.2.1** Open `src/validation-schemas/promptmetrics-log.schema.ts`
- [ ] **2.2.2** Apply the same `Joi.object().unknown(true).max(50)` change to the `metadata` field

---

### Task 2.3 — Update Integration Tests

- [ ] **2.3.1** Open `tests/integration/traces.test.ts`
- [ ] **2.3.2** Find the test `'POST /v1/traces rejects invalid metadata'` (line ~140)
- [ ] **2.3.3** Change the test payload from nested metadata expecting 422 → nested metadata expecting 201:
  ```typescript
  .send({ metadata: { nested: { object: 'good' } } });
  expect(res.status).toBe(201);
  expect(res.body.metadata).toEqual({ nested: { object: 'good' } });
  ```
- [ ] **2.3.4** Rename test to `'POST /v1/traces accepts nested metadata'`
- [ ] **2.3.5** Add test for `POST /v1/traces/:trace_id/spans` with nested metadata
- [ ] **2.3.6** Add test for `POST /v1/logs` with nested metadata

---

### Task 2.4 — Regression Testing

- [ ] **2.4.1** Run `npm test` — verify all suites pass
- [ ] **2.4.2** Run `npm run build` — verify TypeScript compiles cleanly

---

## Epic 3: Issue #27 — Workspace Authorization Too Strict

**Goal:** Allow admin/master API keys to access any workspace.

---

### Task 3.1 — Modify Auth Middleware

- [ ] **3.1.1** Open `src/middlewares/promptmetrics-auth.middleware.ts`
- [ ] **3.1.2** Find the workspace check (around line 33-36):
  ```typescript
  const workspaceId = req.workspaceId || 'default';
  if (row.workspace_id !== workspaceId) {
    throw AppError.unauthorized('API key does not belong to this workspace');
  }
  ```
- [ ] **3.1.3** Change to:
  ```typescript
  const workspaceId = req.workspaceId || 'default';
  if (row.workspace_id !== workspaceId && row.workspace_id !== '*') {
    throw AppError.unauthorized('API key does not belong to this workspace');
  }
  ```
- [ ] **3.1.4** Verify `row.workspace_id` is attached to `req.apiKey` (already done at line 50)

---

### Task 3.2 — Update CLI Key Generation Script

- [ ] **3.2.1** Open `src/scripts/generate-api-key.ts`
- [ ] **3.2.2** Add `--workspace <id>` CLI argument (default `'default'`)
- [ ] **3.2.3** Support `--workspace '*'` for master key generation
- [ ] **3.2.4** Pass `workspace_id` to the INSERT statement

---

### Task 3.3 — Add Admin Key Integration Tests

- [ ] **3.3.1** Open/create `tests/integration/auth.test.ts`
- [ ] **3.3.2** Insert a key with `workspace_id = '*'` and `scopes = 'read,write,admin'`
- [ ] **3.3.3** Test that master key can `GET /v1/prompts` with `X-Workspace-Id: default`
- [ ] **3.3.4** Test that master key can `GET /v1/prompts` with `X-Workspace-Id: custom-workspace`
- [ ] **3.3.5** Test that normal key (workspace_id = 'default') still fails with mismatched `X-Workspace-Id: other`

---

### Task 3.4 — Regression Testing

- [ ] **3.4.1** Run `npm test` — verify all suites pass
- [ ] **3.4.2** Run `npm run build` — verify TypeScript compiles cleanly

---

## Epic 4: Issue #28 — Missing /v1/api-keys Management Endpoint

**Goal:** Add REST endpoints for API key CRUD operations.

**Blocked by:** Epic 3 (#27) — master key logic must exist before key management endpoints can be properly authorized.

---

### Task 4.1 — Create ApiKeyService

- [ ] **4.1.1** Create `src/services/api-key.service.ts`
- [ ] **4.1.2** Implement `createApiKey(input, workspaceId)`:
  - Generate plaintext key: `pm_` + crypto.randomBytes(32).toString('hex')
  - Hash with `hashApiKey()`
  - Insert into `api_keys` table
  - Return row + plaintext `key` (shown **once**)
- [ ] **4.1.3** Implement `listApiKeys(page, limit, callerWorkspaceId, isAdmin)`:
  - If `isAdmin === false`, filter by `workspace_id = callerWorkspaceId`
  - Return paginated list (never include `key_hash`)
- [ ] **4.1.4** Implement `deleteApiKey(id, callerWorkspaceId, isAdmin)`:
  - If `isAdmin === false`, add `AND workspace_id = ?` to WHERE clause
  - Return `204` on success, `404` if not found

---

### Task 4.2 — Create ApiKeyController

- [ ] **4.2.1** Create `src/controllers/api-key.controller.ts`
- [ ] **4.2.2** Implement `createApiKey(req, res)`:
  - Validate body with `createApiKeySchema`
  - Call service
  - Return `201` with `{ id, name, workspace_id, scopes, created_at, key }`
- [ ] **4.2.3** Implement `listApiKeys(req, res)`:
  - Parse pagination
  - Pass `req.workspaceId` and `req.apiKey.workspace_id === '*'` as `isAdmin`
  - Return `200` with paginated response
- [ ] **4.2.4** Implement `deleteApiKey(req, res)`:
  - Call service with `req.params.id`
  - Return `204`

---

### Task 4.3 — Create ApiKeyRoutes

- [ ] **4.3.1** Create `src/routes/api-key.route.ts`
- [ ] **4.3.2** Import `authenticateApiKey`, `rateLimitPerKey`, `requireScope`
- [ ] **4.3.3** Wire endpoints:
  ```typescript
  router.post('/v1/api-keys', requireScope('admin'), (req, res) => controller.createApiKey(req, res));
  router.get('/v1/api-keys', requireScope('admin'), validateQuery(paginationQuerySchema), (req, res) => controller.listApiKeys(req, res));
  router.delete('/v1/api-keys/:id', requireScope('admin'), (req, res) => controller.deleteApiKey(req, res));
  ```

---

### Task 4.4 — Create Validation Schema

- [ ] **4.4.1** Create `src/validation-schemas/api-key.schema.ts`
- [ ] **4.4.2** Define `createApiKeySchema`:
  ```typescript
  export const createApiKeySchema = Joi.object({
    name: Joi.string().max(128).required(),
    scopes: Joi.string().max(256).optional(),
    workspace_id: Joi.string().max(128).optional(),
    expires_in_days: Joi.number().integer().min(1).optional(),
  }).unknown(true);
  ```

---

### Task 4.5 — Mount Routes in App

- [ ] **4.5.1** Open `src/app.ts`
- [ ] **4.5.2** Import `createApiKeyRoutes` from `@routes/api-key.route`
- [ ] **4.5.3** Add `app.use('/', createApiKeyRoutes());`

---

### Task 4.6 — Integration Tests

- [ ] **4.6.1** Create `tests/integration/api-keys.test.ts`
- [ ] **4.6.2** Test `POST /v1/api-keys` with admin key → 201, response includes plaintext `key`
- [ ] **4.6.3** Test `GET /v1/api-keys` with admin key → 200, paginated list, no `key_hash` in items
- [ ] **4.6.4** Test `DELETE /v1/api-keys/:id` with admin key → 204
- [ ] **4.6.5** Test `POST /v1/api-keys` with non-admin key → 403
- [ ] **4.6.6** Test master key can create keys for any workspace

---

### Task 4.7 — Regression Testing

- [ ] **4.7.1** Run `npm test` — verify all suites pass
- [ ] **4.7.2** Run `npm run build` — verify TypeScript compiles cleanly

---

## Epic 5: Final Commit and Release

- [ ] **5.1.1** Commit all changes with conventional commits:
  ```bash
  git commit -m "feat(api): add GET /v1/logs and GET /v1/traces list endpoints (#25)"
  git commit -m "fix(validation): allow nested objects in metadata fields (#26)"
  git commit -m "feat(auth): support master API keys with wildcard workspace_id (#27)"
  git commit -m "feat(api): add /v1/api-keys CRUD management endpoints (#28)"
  ```
- [ ] **5.1.2** Push to GitHub
- [ ] **5.1.3** Close issues #25, #26, #27, #28
- [ ] **5.1.4** Bump version to 1.0.5 in `package.json`
- [ ] **5.1.5** Update `CHANGELOG.md`
- [ ] **5.1.6** Run `npm run build` and `npm publish`

---

## Cross-Cutting Checklist

- [ ] All new endpoints return proper HTTP status codes (200, 201, 204, 403, 404, 422)
- [ ] All new endpoints enforce authentication and rate limiting
- [ ] Pagination uses existing `parsePagination` / `buildPaginatedResponse` utilities
- [ ] Metadata validation accepts nested objects but limits top-level keys to 50
- [ ] Admin/master key logic (`workspace_id = '*'`) is tested
- [ ] API key management endpoints require `admin` scope
- [ ] Plaintext API keys are returned **only** on creation
- [ ] `npm test` passes with exit code 0
- [ ] `npm run build` compiles cleanly

---

## Test Results Template

| Suite | Result | Time |
|-------|--------|------|
| `npm test` (all suites) | ___ passed, ___ failed | ___ s |
| `npm run build` | Clean (no errors) | ___ s |

---

*Tasks generated by AI Engineer & Software Architect agent analysis.*  
*Proposed 2026-04-26.*
