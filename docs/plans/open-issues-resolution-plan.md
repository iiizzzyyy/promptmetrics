# Issue Resolution Plan: Open Issues #24–#28

**Date:** 2026-04-26
**Status:** Proposed — Awaiting Approval
**Agents Consulted:** AI Engineer, Software Architect

---

## Executive Summary

There are **5 open issues** on the promptmetrics repository. After analysis:
- **#24** is a **duplicate/stale report** of #23, which was already fixed in v1.0.4.
- **#25, #26** are high-value, low-risk fixes that can be implemented independently.
- **#27, #28** are related (workspace auth + key management) and should be built together.

**Recommended order:** #25 → #26 → #27 + #28 (bundle) → close #24 as duplicate.

---

## Issue Inventory

| Issue | Title | Priority | Effort | Risk | Status |
|-------|-------|----------|--------|------|--------|
| #25 | Missing GET /v1/logs and GET /v1/traces list endpoints | **P1** | Small | Low | Open |
| #26 | Metadata validation rejects nested objects | **P1** | Small | Low | Open |
| #27 | Workspace authorization too strict | **P2** | Medium | Medium | Open |
| #28 | Missing /v1/api-keys management endpoint | **P2** | Medium | Medium | Open |
| #24 | Regression: --json flag missing | **P3** | None | None | **Resolved** |

---

## Issue #24: Regression — `--json` flag missing

**Status:** Already resolved by #23 fix (v1.0.4).

**Verification:**
- `src/cli/promptmetrics-cli.ts` has `program.option('--json', 'Output as JSON')` at line 121.
- `print()` helper routes to `JSON.stringify()` when `--json` is set.
- Tests in `tests/unit/cli.test.ts` verify `--json` acceptance and table fallback.

**Action:** Close #24 as duplicate of #23.

---

## Issue #25: Missing GET /v1/logs and GET /v1/traces list endpoints

### Problem Analysis

The route files `promptmetrics-log.route.ts` and `promptmetrics-trace.route.ts` only wire:
- `POST /v1/logs`, `GET /v1/logs/:id`
- `POST /v1/traces`, `GET /v1/traces/:trace_id`, `POST /v1/traces/:trace_id/spans`

There are **no list routes** (`GET /v1/logs`, `GET /v1/traces`). The pattern already exists in `RunService.listRuns()` and `RunController.listRuns()`, so this is a straightforward gap-fill.

### Root Cause

The log and trace services/controllers were built with single-resource operations but the list operations were never added, despite the `runs` module having a complete example.

### Architectural Decision

**ADR-001: Reuse the existing pagination pattern from `RunService`.**

- `parsePagination()` from `@utils/pagination` handles query parsing.
- `buildPaginatedResponse()` wraps results.
- SQLite query: `SELECT * FROM logs WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`.
- Same pattern applies to traces.

**Trade-off:** Minimal new code; follows established convention. No downsides.

### Files Affected

| File | Change |
|------|--------|
| `src/services/log.service.ts` | Add `listLogs()` method |
| `src/services/trace.service.ts` | Add `listTraces()` method |
| `src/controllers/promptmetrics-log.controller.ts` | Add `listLogs()` method |
| `src/controllers/promptmetrics-trace.controller.ts` | Add `listTraces()` method |
| `src/routes/promptmetrics-log.route.ts` | Add `GET /v1/logs` route |
| `src/routes/promptmetrics-trace.route.ts` | Add `GET /v1/traces` route |
| `tests/integration/logs.test.ts` | Add list integration tests |
| `tests/integration/traces.test.ts` | Add list integration tests |

---

## Issue #26: Metadata validation rejects nested objects

### Problem Analysis

Joi validation schemas for metadata fields only allow string/number/boolean values. When a span contains nested objects (e.g., `{"tool": "calculator", "arguments": {"expression": "2+2"}}`), validation fails with:

```json
{"error": "Validation failed", "details": ["metadata.arguments must be one of [string, number, boolean]"]}
```

### Root Cause

The trace schema uses `Joi.object().pattern(Joi.string(), Joi.string(), Joi.number(), Joi.boolean())` or similar primitive restriction. Metadata fields in logs, runs, and traces should accept arbitrary JSON.

### Architectural Decision

**ADR-002: Allow `Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean(), Joi.object(), Joi.array())` for metadata fields.**

- Use a recursive schema helper for metadata: `metadataValueSchema` that accepts primitives, objects, or arrays.
- Apply to all metadata fields across trace, span, log, and run schemas.
- Add a **depth guard** to prevent deeply nested objects from causing stack overflow or DOS (max depth 5).

**Trade-off:**
- **Easier:** Supports real-world OpenTelemetry-style structured telemetry.
- **Harder:** Slightly less strict validation; need depth guard for safety.

### Files Affected

| File | Change |
|------|--------|
| `src/validation-schemas/promptmetrics-trace.schema.ts` | Allow nested objects in metadata |
| `src/validation-schemas/promptmetrics-log.schema.ts` | Allow nested objects in metadata |
| `src/validation-schemas/promptmetrics-run.schema.ts` | Allow nested objects in metadata |
| `tests/integration/traces.test.ts` | Add nested metadata test |
| `tests/integration/logs.test.ts` | Add nested metadata test |

---

## Issue #27: Workspace authorization too strict

### Problem Analysis

The auth middleware rejects requests when `X-Workspace-Id` does not match the API key's `workspace_id`. This means:
- Admin keys that should span all workspaces are blocked.
- Multi-tenant CI/CD cannot use a single key across workspaces.

### Root Cause

`src/middlewares/promptmetrics-auth.middleware.ts` enforces exact workspace match after key lookup. There is no concept of a "master" or "admin" key that bypasses workspace checks.

### Architectural Decision

**ADR-003: Add `is_admin` boolean to `api_keys` table. Admin keys bypass workspace validation.**

- Add `is_admin INTEGER DEFAULT 0` to `api_keys` table via migration.
- In auth middleware: if `row.is_admin === 1`, skip workspace check; allow any `X-Workspace-Id`.
- Non-admin keys continue to require exact workspace match.
- Admin keys still require valid scopes.

**Alternative considered:**
- Null `workspace_id` meaning "all workspaces." Rejected because it complicates indexing and query patterns.

**Trade-off:**
- **Easier:** Simple migration, clear semantics, backward compatible.
- **Harder:** Admin keys are more powerful; must be created carefully.

### Files Affected

| File | Change |
|------|--------|
| `migrations/006_add_api_key_admin.sql` | New migration |
| `src/middlewares/promptmetrics-auth.middleware.ts` | Check `is_admin` flag |
| `src/models/promptmetrics-sqlite.ts` | Ensure schema handles new column |
| `tests/integration/auth.test.ts` | Add admin key tests |

---

## Issue #28: Missing /v1/api-keys management endpoint

### Problem Analysis

There is no REST API for programmatic API key management. Keys can only be created via `npm run api-key:generate` (a CLI script) or direct DB insertion.

### Root Cause

No route/controller/service triad exists for API keys. The auth middleware handles key validation but there's no CRUD surface.

### Architectural Decision

**ADR-004: Implement minimal CRUD for API keys, restricted to admin-scoped keys.**

Endpoints:
- `POST /v1/api-keys` — create key (requires `admin` scope). Returns `{ id, name, workspace_id, scopes, key, created_at }`. The raw key is returned **once** on creation.
- `GET /v1/api-keys` — list keys (requires `admin` scope). Returns paginated list.
- `DELETE /v1/api-keys/:id` — revoke key (requires `admin` scope).

**Security considerations:**
- Only admin keys can manage other keys.
- Raw key is hashed with HMAC-SHA256 before storage (reuse existing `hashApiKey`).
- On creation, return the raw key once; never store or return it again.
- `DELETE` soft-deletes or hard-deletes; hard-delete is acceptable for API keys.

**Trade-off:**
- **Easier:** Enables CI/CD key rotation and workspace provisioning.
- **Harder:** Admin keys become high-value targets; requires careful scope enforcement.

### Files Affected

| File | Change |
|------|--------|
| `src/services/api-key.service.ts` | New service |
| `src/controllers/api-key.controller.ts` | New controller |
| `src/routes/api-key.route.ts` | New routes |
| `src/validation-schemas/api-key.schema.ts` | New schemas |
| `src/app.ts` | Mount api-key routes |
| `tests/integration/api-keys.test.ts` | New integration tests |

### Dependency on #27

The `POST /v1/api-keys` endpoint needs to support creating admin keys. This requires the `is_admin` column from #27. Therefore, **#27 must be implemented before or alongside #28**.

---

## Cross-Cutting Concerns

### Testing Strategy
- Each issue gets integration tests following the existing `runs.test.ts` pattern.
- #25 and #26 can be tested independently.
- #27 and #28 share a test file for admin key behavior.

### Security
- #27 introduces admin keys — ensure they are documented as sensitive.
- #28 key creation must reject creating admin keys unless the caller is admin.
- #26 depth guard prevents metadata abuse.

### Backward Compatibility
- #25: additive (new routes) — fully backward compatible.
- #26: relaxes validation — fully backward compatible.
- #27: additive (new column with default 0) — fully backward compatible.
- #28: additive (new routes) — fully backward compatible.

---

## Success Metrics

- [ ] `GET /v1/logs?page=1&limit=10` returns `{ items, total, page, limit, totalPages }`
- [ ] `GET /v1/traces?page=1&limit=10` returns paginated traces
- [ ] `POST /v1/traces/:id/spans` accepts `metadata: { arguments: { expression: "2+2" } }`
- [ ] Admin API key can access any workspace via `X-Workspace-Id`
- [ ] `POST /v1/api-keys` creates and returns a new key
- [ ] `GET /v1/api-keys` lists keys (paginated)
- [ ] `DELETE /v1/api-keys/:id` revokes a key
- [ ] All existing tests pass (31 suites, 215 tests)

---

*Plan generated by AI Engineer & Software Architect agent analysis.*
*Proposed 2026-04-26.*
