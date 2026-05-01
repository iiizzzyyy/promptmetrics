# PromptMetrics Code Review — Detailed Build Tasks

**Date:** 2026-04-30
**Source Plan:** `docs/plans/2026-04-30-code-review-implementation-plan.md`
**Status:** Draft — awaiting approval

---

## How to Use This File

Each task has:
- **Task ID** (e.g., `BE-SEC-01`) — use in branch names and commit messages
- **Owner** — Backend (BE), Frontend (FE), Tests (TST), Docs (DOC), Cross-Cutting (X)
- **Priority** — P0 (blocks merge), P1 (should fix), P2 (nice to have)
- **Dependencies** — tasks that must complete before this one starts
- **Files Changed** — expected file modifications
- **Acceptance Criteria** — how to verify the task is done

---

## Phase 1: Security & Authorization

### BE-SEC-01: Add `requireScope('write')` to evaluation mutations
- **Priority:** P0
- **Owner:** Backend
- **Effort:** 1 hour
- **Files:** `src/routes/evaluation.route.ts`, `tests/integration/evaluation.test.ts`
- **Depends on:** None
- **Work:**
  1. Import `requireScope` from `@middlewares/promptmetrics-auth.middleware`.
  2. Add `requireScope('write')` to `POST /v1/evaluations`, `POST /v1/evaluations/:id/results`, `POST /v1/evaluations/:id/run`, `DELETE /v1/evaluations/:id`.
- **AC:**
  - `tests/integration/evaluation.test.ts` has a test that creates a read-only API key and attempts each mutation; expects 403.
  - All existing evaluation tests still pass.

### BE-SEC-02: Add `auditLog()` to evaluation mutations
- **Priority:** P0
- **Owner:** Backend
- **Effort:** 1 hour
- **Files:** `src/routes/evaluation.route.ts`, `tests/integration/evaluation.test.ts`
- **Depends on:** BE-SEC-01
- **Work:**
  1. Import `auditLog` from `@middlewares/promptmetrics-audit.middleware`.
  2. Mount `auditLog('evaluation:create')` before `POST /v1/evaluations` handler.
  3. Mount `auditLog('evaluation:result')` before `POST /v1/evaluations/:id/results` handler.
  4. Mount `auditLog('evaluation:run')` before `POST /v1/evaluations/:id/run` handler.
  5. Mount `auditLog('evaluation:delete')` before `DELETE /v1/evaluations/:id` handler.
- **AC:**
  - Integration test queries `audit_logs` table after each mutation and verifies an entry exists with correct `action` and `workspace_id`.

### BE-SEC-03: Lazy-load provider registry
- **Priority:** P0
- **Owner:** Backend
- **Effort:** 2 hours
- **Files:** `src/services/providers/provider.registry.ts`, `src/server.ts`, `src/app.ts`, `tests/setup.ts`
- **Depends on:** None
- **Work:**
  1. Remove top-level `new OpenAIAdapter()`, `new AnthropicAdapter()`, etc. from `provider.registry.ts`.
  2. Export `registerBuiltinProviders()` function.
  3. Call `registerBuiltinProviders()` from `server.ts` after config loads.
  4. Update test setup to call `registerBuiltinProviders()` in `beforeAll` when needed.
- **AC:**
  - `npm test` passes with zero provider env vars set.
  - `npm run dev` boots successfully with partial provider config.

### FE-SEC-01: Fix API client header overwriting
- **Priority:** P0
- **Owner:** Frontend
- **Effort:** 1 hour
- **Files:** `ui/src/lib/api.ts`
- **Depends on:** None
- **Work:**
  1. Change `fetchJson` to merge headers instead of replacing:
     ```ts
     headers: {
       'Content-Type': 'application/json',
       ...(apiKey ? { 'X-API-Key': apiKey } : {}),
       ...(workspaceId ? { 'X-Workspace-Id': workspaceId } : {}),
       ...(options?.headers || {}),
     }
     ```
  2. Ensure `options` spread does not override the merged `headers`.
- **AC:**
  - Unit test calls `api.createEvaluation(data, { headers: { 'X-Custom': 'value' } })` and asserts `X-API-Key` is present in the outgoing request.

### FE-SEC-02: Replace `localStorage` with `sessionStorage` for API key
- **Priority:** P1
- **Owner:** Frontend
- **Effort:** 30 min
- **Files:** `ui/src/app/settings/page.tsx`, `ui/src/lib/api.ts`
- **Depends on:** None
- **Work:**
  1. Replace `localStorage` with `sessionStorage` in settings page.
  2. Update `api.ts` to read from `sessionStorage`.
  3. Add warning text in UI: "API key is stored in session memory and will be lost on page refresh."
- **AC:**
  - E2E test: set key, refresh page, verify key is gone.
  - Key persists during SPA navigation (no full reload).

---

## Phase 2: Crash Prevention & Data Integrity

### BE-DATA-01: Create `safeJsonParse` helper and apply everywhere
- **Priority:** P0
- **Owner:** Backend
- **Effort:** 1.5 hours
- **Files:** `src/utils/safe-json.ts` (new), `src/services/metrics.service.ts`, `src/services/dataset.service.ts`, `src/controllers/compliance.controller.ts`
- **Depends on:** None
- **Work:**
  1. Create `safeJsonParse<T>(json: string | null, fallback: T): T`.
  2. Replace unprotected `JSON.parse` in `metrics.service.ts` (activity summary).
  3. Replace unprotected `JSON.parse` in `dataset.service.ts` (list/get dataset).
  4. Replace unprotected `JSON.parse` in `compliance.controller.ts`.
- **AC:**
  - Unit test for `safeJsonParse`: valid JSON returns parsed value; invalid JSON returns fallback; null returns fallback.
  - Integration test seeds a run with corrupt `input_json` and verifies `/v1/metrics/activity` returns 200 with fallback values.

### BE-DATA-02: Add Joi validation to playground
- **Priority:** P0
- **Owner:** Backend
- **Effort:** 1.5 hours
- **Files:** `src/validation-schemas/playground.schema.ts` (new), `src/routes/playground.route.ts`, `src/controllers/playground.controller.ts`
- **Depends on:** None
- **Work:**
  1. Create schema with: `provider`, `model`, `messages` (array of `{role, content}`), `temperature` (0–2), `maxTokens` (min 1), `topP` (0–1), `variables` (optional object).
  2. Mount `validateBody(playgroundSchema)` in route.
  3. Remove manual checks from controller.
- **AC:**
  - `tests/integration/playground.test.ts` expects 422 for missing `provider`, invalid `temperature` (>2), and malformed `messages`.
  - Valid payloads still work.

### BE-DATA-03: Implement real `promoteWinner`
- **Priority:** P0
- **Owner:** Backend
- **Effort:** 3 hours
- **Files:** `src/services/ab-test.service.ts`, `src/controllers/ab-test.controller.ts`, `migrations/015_add_ab_test_promotion.ts` (new)
- **Depends on:** None
- **Work:**
  1. Create migration adding `promoted_version TEXT` and `promoted_at INTEGER` to `ab_tests`.
  2. Update `promoteWinner` to write these columns.
  3. Wrap in transaction.
  4. Return updated test object.
- **AC:**
  - Integration test: create test, run it, call promote, query DB and verify `promoted_version` is set.
  - Endpoint returns 200 with the updated test.

### BE-DATA-04: Fix stream timeout with AbortController
- **Priority:** P0
- **Owner:** Backend
- **Effort:** 3 hours
- **Files:** `src/services/playground.service.ts`, `src/controllers/playground.controller.ts`, `src/services/providers/*.adapter.ts`
- **Depends on:** None
- **Work:**
  1. Remove `timedStream`.
  2. In controller, create `AbortController`.
  3. Set `setTimeout(() => controller.abort(), TIMEOUT)`.
  4. Pass `signal` through service to adapters.
  5. Each adapter forwards `signal` to HTTP client.
- **AC:**
  - Integration test mocks a provider that hangs forever; verifies request aborts within timeout + buffer.
  - Normal streaming still works.

### BE-DATA-05: Make dataset creation atomic
- **Priority:** P1
- **Owner:** Backend
- **Effort:** 1.5 hours
- **Files:** `src/services/dataset.service.ts`
- **Depends on:** None
- **Work:**
  1. Wrap header insert, row loop, and `row_count` update in `db.transaction()`.
  2. Ensure transaction rolls back on any failure.
- **AC:**
  - Integration test mocks a crash mid-row-insert (e.g., by stubbing a row insert to throw); verify no dataset exists in DB.

### BE-DATA-06: Fix migration 014 SQLite rollback
- **Priority:** P0
- **Owner:** Backend
- **Effort:** 1 hour
- **Files:** `migrations/014_add_log_run_id.ts`
- **Depends on:** None
- **Work:**
  1. Use dialect-conditional DDL in `down()`.
  2. SQLite: `ALTER TABLE logs DROP COLUMN run_id;` (no `IF EXISTS`).
  3. PostgreSQL: keep `IF EXISTS`.
- **AC:**
  - Run `npm run db:migrate` and `npm run db:down` on SQLite; both succeed.

### BE-DATA-07: Compute real `error_rate` in prompt metrics
- **Priority:** P0
- **Owner:** Backend
- **Effort:** 1.5 hours
- **Files:** `src/services/metrics.service.ts`, `tests/unit/metrics.service.test.ts`
- **Depends on:** None
- **Work:**
  1. Join `runs` table in `getPromptMetrics` query.
  2. Compute `error_rate` per prompt/version.
  3. Return `null` when no runs.
- **AC:**
  - Unit test seeds runs with errors and asserts correct `error_rate`.
  - Unit test with zero runs asserts `error_rate` is `null`.

---

## Phase 3: API Contracts & Validation

### BE-API-01: Resolve evaluation score schema conflict
- **Priority:** P1
- **Owner:** Backend
- **Effort:** 1 hour
- **Files:** `src/validation-schemas/promptmetrics-evaluation.schema.ts`, `tests/integration/metrics.test.ts`, `tests/unit/metrics.service.test.ts`
- **Depends on:** None
- **Work:**
  1. Decision: remove `.max(1)` from score schema to allow any non-negative number.
  2. Document scale in schema comment.
  3. Update tests to use valid scores.
- **AC:**
  - `POST /v1/evaluations/:id/results` with score `4.5` returns 201.
  - All existing tests pass.

### BE-API-02: Add `parseIdParam()` helper
- **Priority:** P1
- **Owner:** Backend
- **Effort:** 1.5 hours
- **Files:** `src/utils/validation.ts`, `src/controllers/promptmetrics-evaluation.controller.ts`, `src/controllers/ab-test.controller.ts`, `src/controllers/dataset.controller.ts`, `src/controllers/compliance.controller.ts`
- **Depends on:** None
- **Work:**
  1. Create `parseIdParam(raw: string): number`.
  2. Replace all `Number(req.params.id)` with `parseIdParam(req.params.id)`.
- **AC:**
  - Integration tests for each controller: `GET /v1/{resource}/abc` returns 400 with "Invalid ID parameter".

### BE-API-03: Add input size limits
- **Priority:** P1
- **Owner:** Backend
- **Effort:** 1 hour
- **Files:** `src/validation-schemas/compliance.schema.ts`, `src/validation-schemas/dataset.schema.ts`, `src/services/dataset.service.ts`
- **Depends on:** None
- **Work:**
  1. Compliance: `text: Joi.string().max(100_000).required()`.
  2. Dataset: add total payload size check in service (reject if > 10MB).
- **AC:**
  - Integration test with 101KB compliance text returns 422.
  - Integration test with 11MB dataset payload returns 422.

### BE-API-04: Cache Ajv compiled validators
- **Priority:** P1
- **Owner:** Backend
- **Effort:** 1 hour
- **Files:** `src/services/evaluation-rule.engine.ts`
- **Depends on:** None
- **Work:**
  1. Instantiate `Ajv` once in constructor.
  2. Add `Map<string, ValidateFunction>` cache.
  3. Cap at 100 entries (LRU).
- **AC:**
  - Unit test: mock `ajv.compile` and verify it is called once for repeated evaluations with same schema.

### BE-API-05: Fix AnthropicAdapter system role mapping
- **Priority:** P1
- **Owner:** Backend
- **Effort:** 1.5 hours
- **Files:** `src/services/providers/anthropic.adapter.ts`, `tests/unit/providers/anthropic.adapter.test.ts`
- **Depends on:** None
- **Work:**
  1. Extract system messages into top-level `system` parameter.
  2. Filter system from `messages` array.
  3. Add `nock` test verifying request body shape.
- **AC:**
  - `nock` intercepts Anthropic request and asserts `system` is present at top level, not inside `messages`.

### BE-API-06: Remove driver double-instantiation
- **Priority:** P1
- **Owner:** Backend
- **Effort:** 1 hour
- **Files:** `src/app.ts`, `src/server.ts`, `tests/integration/playground.test.ts`
- **Depends on:** None
- **Work:**
  1. Remove `if (!driver) { driver = createDriver(); }` from `src/app.ts`.
  2. Ensure `server.ts` passes driver.
  3. Update tests.
- **AC:**
  - All tests pass.
  - `git grep "createApp()" tests/` returns zero hits (all callers pass driver).

---

## Phase 4: Frontend Critical Fixes

### FE-CRIT-01: Fix A/B test run to use real data
- **Priority:** P0
- **Owner:** Frontend
- **Effort:** 2 hours
- **Files:** `ui/src/app/ab-tests/page.tsx`
- **Depends on:** None
- **Work:**
  1. Remove `generateRandomScores()`.
  2. Call `POST /v1/ab-tests/:id/run` with empty body or `{ dataset_id }`.
  3. Show loading spinner during computation.
- **AC:**
  - E2E intercepts POST and verifies no `scoresA`/`scoresB` in payload.
  - Test completes and results display.

### FE-CRIT-02: Fix compliance detail dialog
- **Priority:** P0
- **Owner:** Frontend
- **Effort:** 1 hour
- **Files:** `ui/src/app/compliance/page.tsx`
- **Depends on:** None
- **Work:**
  1. Derive detail from already-fetched `data.items` instead of calling `getComplianceScores({ page: 1, limit: 1 })`.
  2. Find selected item by ID in the list.
- **AC:**
  - E2E clicks compliance row and verifies correct detail text appears.

### FE-CRIT-03: Fix `modal_class` across all dialogs
- **Priority:** P0
- **Owner:** Frontend
- **Effort:** 1 hour
- **Files:** `ui/src/app/evaluations/page.tsx`, `ui/src/app/ab-tests/page.tsx`, `ui/src/app/datasets/page.tsx`, `ui/src/app/compliance/page.tsx`, `ui/src/components/common/confirm-modal.tsx`
- **Depends on:** None
- **Work:**
  1. Remove `modal_class` from `<Dialog>` root.
  2. Add `className` to `<DialogContent>`.
- **AC:**
  - No React warnings in dev console.
  - Dialogs render at correct max-width.

### FE-CRIT-04: Add delete confirmation for datasets
- **Priority:** P0
- **Owner:** Frontend
- **Effort:** 1 hour
- **Files:** `ui/src/app/datasets/page.tsx`
- **Depends on:** None
- **Work:**
  1. Import `ConfirmModal`.
  2. Wrap `deleteMutation.mutate()` in confirmation flow.
- **AC:**
  - E2E: click delete, modal appears, click cancel — dataset remains. Click confirm — dataset deleted.

### FE-CRIT-05: Replace resizable with react-resizable-panels
- **Priority:** P0
- **Owner:** Frontend
- **Effort:** 2 hours
- **Files:** `ui/src/components/ui/resizable.tsx`
- **Depends on:** None
- **Work:**
  1. `npm install react-resizable-panels`.
  2. Replace custom implementation.
  3. Wire `onLayout` to store.
- **AC:**
  - E2E drags handle and verifies pane size changes.
  - Works in both directions (horizontal/vertical).

### FE-CRIT-06: Add playground input validation
- **Priority:** P1
- **Owner:** Frontend
- **Effort:** 1 hour
- **Files:** `ui/src/components/playground/PlaygroundLayout.tsx`
- **Depends on:** None
- **Work:**
  1. Disable Run button when `!selectedModel || (!systemMessage.trim() && !userMessage.trim())`.
  2. Show tooltip explaining why disabled.
- **AC:**
  - E2E: empty inputs → Run button disabled. Select model + enter prompt → enabled.

### FE-CRIT-07: Wire playground config button
- **Priority:** P1
- **Owner:** Frontend
- **Effort:** 1 hour
- **Files:** `ui/src/components/playground/PlaygroundLayout.tsx`, `ui/src/components/playground/ModelConfigDrawer.tsx`
- **Depends on:** None
- **Work:**
  1. Import `ModelConfigDrawer`.
  2. Add local state `configOpen`.
  3. Wire settings icon button.
- **AC:**
  - E2E clicks settings icon, drawer opens with current model params.

---

## Phase 5: Frontend Architecture & Performance

### FE-ARCH-01: Fix playground store re-renders
- **Priority:** P1
- **Owner:** Frontend
- **Effort:** 3 hours
- **Files:** `ui/src/stores/playground.store.ts`, `ui/src/components/playground/PlaygroundLayout.tsx`, `ui/src/components/playground/StreamingOutputPanel.tsx`
- **Depends on:** None
- **Work:**
  1. Split into `usePlaygroundConfigStore` and `usePlaygroundStreamStore`, OR add selector hooks.
  2. Update all components to use selectors.
- **AC:**
  - React DevTools Profiler: during streaming, only `StreamingOutputPanel` re-renders (not sidebar, tabs, etc.).

### FE-ARCH-02: Fix O(n²) streaming concatenation
- **Priority:** P1
- **Owner:** Frontend
- **Effort:** 1 hour
- **Files:** `ui/src/stores/playground.store.ts`, `ui/src/components/playground/StreamingOutputPanel.tsx`
- **Depends on:** FE-ARCH-01 (or do together)
- **Work:**
  1. Change `streamOutput: string` → `streamTokens: string[]`.
  2. `appendStreamOutput` pushes to array.
  3. UI renders `streamTokens.join("")`.
- **AC:**
  - Profile with 4K tokens: no UI freezing, smooth updates.

### FE-ARCH-03: Replace custom UI primitives with Radix
- **Priority:** P1
- **Owner:** Frontend
- **Effort:** 4 hours
- **Files:** `ui/src/components/ui/drawer.tsx`, `ui/src/components/ui/tabs.tsx`, `ui/src/components/ui/popover.tsx`, `ui/src/components/ui/toggle-group.tsx`, `package.json`
- **Depends on:** None
- **Work:**
  1. `npm install @radix-ui/react-dialog @radix-ui/react-tabs @radix-ui/react-popover @radix-ui/react-toggle-group`.
  2. Replace each custom implementation.
  3. Keep same exported API.
- **AC:**
  - axe-core audit: zero critical accessibility violations on affected components.
  - Keyboard navigation works (Tab, Escape, Arrow keys).

### FE-ARCH-04: Fix slider single-value input
- **Priority:** P1
- **Owner:** Frontend
- **Effort:** 30 min
- **Files:** `ui/src/components/ui/slider.tsx`
- **Depends on:** None
- **Work:**
  1. Handle scalar `value` / `defaultValue` by wrapping in array.
- **AC:**
  - Unit test: `value={50}` renders single thumb at 50.

### FE-ARCH-05: Fix compliance pagination
- **Priority:** P1
- **Owner:** Frontend
- **Effort:** 1 hour
- **Files:** `ui/src/app/compliance/page.tsx`
- **Depends on:** None
- **Work:**
  1. Change `limit: 1000` → `limit: LIMIT` (20).
  2. Pass `page` and `limit`.
- **AC:**
  - E2E with >20 scores verifies pagination controls work.

### FE-ARCH-06: Add request timeout and ApiError to client
- **Priority:** P1
- **Owner:** Frontend
- **Effort:** 1.5 hours
- **Files:** `ui/src/lib/api.ts`
- **Depends on:** FE-SEC-01
- **Work:**
  1. Wrap `fetch` with `AbortSignal.timeout(10000)`.
  2. Create `ApiError` class.
  3. Parse error responses.
- **AC:**
  - Unit test: mock 15s delay, verify `ApiError` thrown with timeout message.
  - Unit test: mock 500 response, verify `ApiError` has status and body.

---

## Phase 6: Test Reliability & Coverage

### TST-01: Rewrite provider adapter tests with `nock`
- **Priority:** P1
- **Owner:** Tests
- **Effort:** 4 hours
- **Files:** `tests/unit/providers/openai.adapter.test.ts`, `tests/unit/providers/anthropic.adapter.test.ts`, `tests/unit/providers/azure-openai.adapter.test.ts`, `tests/unit/providers/ollama.adapter.test.ts`, `tests/unit/providers/cohere.adapter.test.ts`
- **Depends on:** None
- **Work:**
  1. Mock provider HTTP endpoints with `nock`.
  2. Assert request shaping, response parsing, error mapping.
  3. Mock streaming responses.
- **AC:**
  - Each adapter test verifies HTTP request body matches expected shape.
  - Each adapter test verifies 429 → `ProviderError.rateLimit`.
  - `nock.isDone()` is true after each test.

### TST-02: Fix hardcoded foreign key in metrics integration test
- **Priority:** P0
- **Owner:** Tests
- **Effort:** 30 min
- **Files:** `tests/integration/metrics.test.ts`
- **Depends on:** None
- **Work:**
  1. Capture `lastInsertRowid` from evaluation insert.
  2. Use variable instead of literal `1`.
- **AC:**
  - Test passes after seeding extra rows before the test.

### TST-03: Fix cancel-abort E2E test assertion
- **Priority:** P1
- **Owner:** Tests
- **Effort:** 30 min
- **Files:** `ui/e2e/playground.spec.ts`
- **Depends on:** None
- **Work:**
  1. Assert `requestAborted === true` after clicking cancel.
- **AC:**
  - Test passes and meaningfully verifies abort behavior.

### TST-04: Fix flaky skeleton wait in dashboard E2E
- **Priority:** P1
- **Owner:** Tests
- **Effort:** 30 min
- **Files:** `ui/e2e/dashboard.spec.ts`
- **Depends on:** None
- **Work:**
  1. Replace detached wait with positive assertion.
- **AC:**
  - Run E2E suite 5 times, zero flakes.

### TST-05: Fix playground integration test driver
- **Priority:** P1
- **Owner:** Tests
- **Effort:** 30 min
- **Files:** `tests/integration/playground.test.ts`
- **Depends on:** BE-API-06
- **Work:**
  1. Instantiate `FilesystemDriver` and pass to `createApp(driver)`.
- **AC:**
  - All integration tests pass.

### TST-06: Add WAL/SHM cleanup helper
- **Priority:** P1
- **Owner:** Tests
- **Effort:** 1 hour
- **Files:** `tests/utils/cleanup-db.ts` (new), `tests/integration/*.test.ts`
- **Depends on:** None
- **Work:**
  1. Create `cleanupDbFiles(dbPath)` helper.
  2. Update all integration test teardowns.
- **AC:**
  - After test suite, `find tests/ -name "*.db-wal" -o -name "*.db-shm"` returns empty.

### TST-07: Add BudgetService and EvalRunService tests
- **Priority:** P1
- **Owner:** Tests
- **Effort:** 3 hours
- **Files:** `tests/unit/budget.service.test.ts` (new), `tests/unit/eval-run.service.test.ts` (new)
- **Depends on:** None
- **Work:**
  1. Budget: test spend calculation, budget check, NaN fallback, month boundaries.
  2. EvalRun: test create, complete, fail, workspace isolation.
- **AC:**
  - Both new test files have >80% branch coverage.
  - All tests pass.

---

## Phase 7: Migrations, Docs & Config

### DOC-01: Update OpenAPI spec to 1.1.0
- **Priority:** P1
- **Owner:** Docs
- **Effort:** 3 hours
- **Files:** `docs/openapi.yaml`
- **Depends on:** None
- **Work:**
  1. Bump version to `1.1.0`.
  2. Add paths for all new endpoints.
  3. Add schemas.
- **AC:**
  - `swagger-codegen` or `openapi-typescript` validates without errors.
  - Generated types compile.

### DOC-02: Resolve SSE vs NDJSON ADR conflict
- **Priority:** P1
- **Owner:** Docs
- **Effort:** 1 hour
- **Files:** `docs/adr/0003-streaming-protocol.md`, `docs/plans/frontend-reuse-implementation-*.md`
- **Depends on:** None
- **Work:**
  1. Confirm NDJSON is current implementation.
  2. Update ADR-003.
  3. Mark SSE plan as superseded.
- **AC:**
  - No contradictions remain in accepted documents.

### DOC-03: Refactor seed script for DatabaseAdapter
- **Priority:** P1
- **Owner:** Backend/Docs
- **Effort:** 2 hours
- **Files:** `src/scripts/seed-demo-data.ts`
- **Depends on:** None
- **Work:**
  1. Replace `better-sqlite3` with `getDb()`.
  2. Use async adapter methods.
  3. Add `run_id` to logs.
  4. Wrap force deletes in transaction.
- **AC:**
  - Seed script runs against SQLite.
  - Seed script runs against PostgreSQL (if available).

### DOC-04: Add ON DELETE CASCADE to migrations
- **Priority:** P1
- **Owner:** Backend
- **Effort:** 1.5 hours
- **Files:** `migrations/011_add_ab_testing.ts`, `migrations/012_add_datasets_and_eval_runs.ts`
- **Depends on:** None
- **Work:**
  1. Add `ON DELETE CASCADE` to foreign keys.
  2. Provide follow-up migration for existing deployments.
- **AC:**
  - Integration test: delete parent, verify child rows gone.

### DOC-05: Clean up demo data PRD drift
- **Priority:** P2
- **Owner:** Docs
- **Effort:** 30 min
- **Files:** `docs/plans/demo-data-generator-prd.md`
- **Depends on:** None
- **Work:**
  1. Update PRD to match actual seed script, or archive it.
- **AC:**
  - PRD accurately describes what exists.

---

## Cross-Cutting Tasks

### X-01: Run full test suite after all phases
- **Priority:** P0
- **Owner:** Anyone
- **Effort:** 1 hour
- **Files:** All
- **Depends on:** All other tasks
- **Work:**
  1. `npm test` (unit + integration).
  2. `npm run test:e2e`.
  3. `npm run build`.
  4. `npm run lint`.
  5. `npm run format`.
  6. `npm audit`.
- **AC:**
  - All commands exit 0.
  - Zero critical/high vulnerabilities in `npm audit`.

### X-02: Peer code review of all fixes
- **Priority:** P0
- **Owner:** Senior dev / team lead
- **Effort:** 2 hours
- **Files:** All changed files
- **Depends on:** All other tasks
- **Work:**
  1. Review each PR against the code review report.
  2. Verify tests accompany every fix.
  3. Sign off on P0 issues.
- **AC:**
  - At least one approval on each fix PR.
  - No unresolved critical comments.

---

## Task Dependency Graph

```
Phase 1 (Security)
  BE-SEC-01 → BE-SEC-02
  BE-SEC-03
  FE-SEC-01 → FE-SEC-02

Phase 2 (Crash Prevention)
  BE-DATA-01
  BE-DATA-02
  BE-DATA-03
  BE-DATA-04
  BE-DATA-05
  BE-DATA-06
  BE-DATA-07

Phase 3 (API Contracts)
  BE-API-01
  BE-API-02
  BE-API-03
  BE-API-04
  BE-API-05
  BE-API-06

Phase 4 (Frontend Critical)
  FE-CRIT-01
  FE-CRIT-02
  FE-CRIT-03
  FE-CRIT-04
  FE-CRIT-05
  FE-CRIT-06
  FE-CRIT-07

Phase 5 (Frontend Architecture)
  FE-ARCH-01 → FE-ARCH-02
  FE-ARCH-03
  FE-ARCH-04
  FE-ARCH-05
  FE-ARCH-06

Phase 6 (Tests)
  TST-01
  TST-02
  TST-03
  TST-04
  TST-05 (depends on BE-API-06)
  TST-06
  TST-07

Phase 7 (Docs/Config)
  DOC-01
  DOC-02
  DOC-03
  DOC-04
  DOC-05

Final
  X-01 (depends on ALL)
  X-02 (depends on ALL)
```

**Recommended execution order:**
1. Start with Phase 1 (security) — these are the highest risk.
2. Run Phase 2 and Phase 3 in parallel with Phase 4 (backend and frontend can be worked simultaneously).
3. Phase 5 depends on some Phase 4 items being stable.
4. Phase 6 (tests) should be done alongside each phase — add tests with every fix.
5. Phase 7 (docs/migrations) can be done in parallel with Phase 5.
6. X-01 and X-02 are the final gate before merge.

---

*Build tasks generated from the master implementation plan. Total: 40+ tasks across 7 phases + 2 cross-cutting tasks.*
