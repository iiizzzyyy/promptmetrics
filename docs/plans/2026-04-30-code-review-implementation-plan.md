# PromptMetrics Code Review — Master Implementation Plan

**Date:** 2026-04-30
**Source:** `docs/reviews/2026-04-30-promptmetrics-comprehensive-code-review.md`
**Contributors:** AI Engineer, Backend Architect, Frontend Developer, Security Engineer, Software Architect
**Status:** Draft — awaiting approval

---

## Goal

Fix all P0 (Critical) and P1 (Important) issues identified in the comprehensive code review so the working tree is production-ready for merge. P2 (Minor) items are tracked as follow-up tech debt.

---

## Guiding Principles

1. **Security first.** Authorization gaps and data exposure risks take absolute priority.
2. **Fix functional bugs before refactors.** Broken endpoints, dead UI, and incorrect data must work before we optimize.
3. **Atomic changes.** Each P0/P1 fix is a standalone, testable change. Group related fixes into logical PRs.
4. **Preserve existing patterns.** Follow the conventions already established in `src/routes/promptmetrics-prompt.route.ts` (scope checks, audit logs) and `src/services/metrics.service.ts` (dialect-conditional SQL).
5. **Add tests with every fix.** Every backend bug fix must include a unit or integration test that fails before the fix and passes after.

---

## Phase Overview

| Phase | Theme | Issues | Est. Effort |
|-------|-------|--------|-------------|
| Phase 1 | Security & Authorization | #1, #2, #21, #5, #11, #29 | 1 day |
| Phase 2 | Crash Prevention & Data Integrity | #3, #9, #4, #6, #7, #10, #17, #2 | 1.5 days |
| Phase 3 | API Contracts & Validation | #19, #20, #24, #23, #25, #22 | 1 day |
| Phase 4 | Frontend Critical Fixes | #13, #14, #15, #16, #12, #30, #31 | 1 day |
| Phase 5 | Frontend Architecture & Performance | #33, #34, #35, #36, #32, #29 | 1.5 days |
| Phase 6 | Test Reliability & Coverage | #37, #38, #39, #40, #41, #42, #28 | 1.5 days |
| Phase 7 | Migrations, Docs & Config | #18, #17, #46, #43, #44, #45, #47 | 1 day |

**Total Estimated Effort:** ~7.5 engineering days (spillover into a second week likely for review cycles).

---

## Phase 1: Security & Authorization (Day 1)

### 1.1 Add `requireScope('write')` to Evaluation Mutations
- **Issue:** #1 — Evaluation routes protected only by `authenticateApiKey`; read-only keys can mutate data.
- **Files:** `src/routes/evaluation.route.ts`
- **Work:** Import `requireScope` and mount on `POST /v1/evaluations`, `POST /v1/evaluations/:id/results`, `POST /v1/evaluations/:id/run`, `DELETE /v1/evaluations/:id`.
- **Pattern to copy:** `src/routes/promptmetrics-prompt.route.ts:43` (has `requireScope('write')` on `POST /v1/prompts`).
- **Test:** Update `tests/integration/evaluation.test.ts` — expect 403 when calling with a read-only key.

### 1.2 Add `auditLog()` to Evaluation Mutations
- **Issue:** #21 — No audit trail for evaluation create, result, run, delete.
- **Files:** `src/routes/evaluation.route.ts`
- **Work:** Import `auditLog` and mount before each mutation handler. Use action names: `evaluation:create`, `evaluation:result`, `evaluation:run`, `evaluation:delete`.
- **Pattern to copy:** `src/routes/promptmetrics-prompt.route.ts` (uses `auditLog('prompt:create')`).
- **Test:** Verify audit entries are written in `tests/integration/evaluation.test.ts`.

### 1.3 Make Provider Registration Lazy
- **Issue:** #5 — Adapters crash at import time when env vars are missing.
- **Files:** `src/services/providers/provider.registry.ts`, `src/server.ts`, `src/app.ts`, `tests/setup.ts`
- **Work:**
  1. Remove top-level `new OpenAIAdapter()` etc. from `provider.registry.ts`.
  2. Export `registerBuiltinProviders()` function that does the registrations.
  3. Call `registerBuiltinProviders()` from `server.ts` after config loads.
  4. Update tests to call `registerBuiltinProviders()` in `beforeAll` when needed.
- **Test:** Run `npm test` with no provider env vars set; should pass (tests that need providers can mock the registry).

### 1.4 Fix API Client Header Overwriting
- **Issue:** #11 — `...options` spread replaces `headers`, dropping auth.
- **Files:** `ui/src/lib/api.ts`
- **Work:** Change header construction to deep-merge:
  ```ts
  headers: {
    'Content-Type': 'application/json',
    ...(apiKey ? { 'X-API-Key': apiKey } : {}),
    ...(workspaceId ? { 'X-Workspace-Id': workspaceId } : {}),
    ...(options?.headers || {}),
  }
  ```
- **Test:** Add a frontend unit test that calls `api.createEvaluation(data, { headers: { 'X-Custom': 'value' } })` and verifies `X-API-Key` is still present.

### 1.5 Move API Key Out of `localStorage`
- **Issue:** #29 — Settings page persists API key in `localStorage`, XSS-vulnerable.
- **Files:** `ui/src/app/settings/page.tsx`, `ui/src/lib/api.ts`
- **Work:**
  1. Replace `localStorage.setItem('apiKey', ...)` with `sessionStorage.setItem('apiKey', ...)` as a stopgap.
  2. Add a clear warning in the UI: "API key is stored in session memory and will be lost on page refresh."
  3. Document that a proper fix requires a backend `/auth/session` endpoint with `httpOnly` cookies (out of scope for this PR, tracked as follow-up).
- **Test:** E2E test verifies key is cleared after session ends.

---

## Phase 2: Crash Prevention & Data Integrity (Days 1.5–2.5)

### 2.1 Guard All `JSON.parse` Calls
- **Issue:** #3 — `metrics.service.ts` parses `input_json`, `output_json`, `metadata_json` without try/catch.
- **Issue:** #9 — `compliance.controller.ts` parses `violations_json` without try/catch.
- **Files:** `src/services/metrics.service.ts`, `src/services/dataset.service.ts`, `src/controllers/compliance.controller.ts`
- **Work:** Create a `safeJsonParse<T>(json: string | null, fallback: T): T` helper in `src/utils/safe-json.ts`. Replace every unprotected `JSON.parse` in the service layer and controllers.
- **Test:** Unit test the helper. Integration test with a manually corrupted JSON row in `runs` table verifies the endpoint returns 200 with partial data.

### 2.2 Add Joi Body Validation to Playground
- **Issue:** #4 — PlaygroundController only does manual field checks; no schema enforcement.
- **Files:** `src/validation-schemas/playground.schema.ts` (new), `src/routes/playground.route.ts`, `src/controllers/playground.controller.ts`
- **Work:**
  1. Create `playground.schema.ts`:
     ```ts
     provider: Joi.string().valid('openai','anthropic','azure','ollama','cohere').required()
     model: Joi.string().required()
     messages: Joi.array().items(Joi.object({ role: Joi.string().valid('system','user','assistant').required(), content: Joi.string().required() })).min(1)
     temperature: Joi.number().min(0).max(2).optional()
     maxTokens: Joi.number().integer().min(1).optional()
     topP: Joi.number().min(0).max(1).optional()
     variables: Joi.object().optional()
     ```
  2. Mount `validateBody(playgroundSchema)` in `playground.route.ts`.
  3. Remove manual checks from controller.
- **Test:** `tests/integration/playground.test.ts` — expect 422 for invalid payloads.

### 2.3 Implement Actual `promoteWinner` Logic
- **Issue:** #6 — `POST /v1/ab-tests/:id/promote` reads winner but performs zero DB mutations.
- **Files:** `src/services/ab-test.service.ts`, `src/controllers/ab-test.controller.ts`
- **Work:**
  1. Add `promoted_version TEXT` and `promoted_at INTEGER` to `ab_tests` table (new migration `015_add_ab_test_promotion.ts`).
  2. In `promoteWinner`, update the `ab_tests` row with the winning version.
  3. Wrap in transaction.
  4. Return the promoted test object.
- **Test:** Integration test verifies the DB row is updated after calling `POST /v1/ab-tests/:id/promote`.

### 2.4 Fix Stream Timeout for Stuck Connections
- **Issue:** #7 — `timedStream` only checks deadline between chunks; hung connections never time out.
- **Files:** `src/services/playground.service.ts`, `src/controllers/playground.controller.ts`, all provider adapters
- **Work:**
  1. Remove `timedStream` wrapper.
  2. In `PlaygroundController`, create an `AbortController` before calling the service.
  3. Start a `setTimeout(() => controller.abort(), TIMEOUT_MS)`.
  4. Pass `controller.signal` through `PlaygroundProxyService` to each provider adapter.
  5. Each adapter forwards `signal` to its HTTP client (`fetch` or SDK).
  6. On `res.on('close')`, clear the timeout and abort.
- **Test:** Integration test mocks a provider that hangs; verify the request aborts and returns 504 or similar.

### 2.5 Make Dataset Creation Atomic
- **Issue:** #10 — Dataset header inserted, then rows looped, then `row_count` updated. Crash mid-loop = partial data.
- **Files:** `src/services/dataset.service.ts`
- **Work:** Wrap header insert, row inserts, and `row_count` update in `db.transaction()`.
- **Test:** Mock a failure mid-row-insert; verify no dataset row exists in DB.

### 2.6 Fix SQLite-Incompatible Migration Rollback
- **Issue:** #17 — Migration 014 `down()` uses `DROP COLUMN IF EXISTS`, invalid in SQLite.
- **Files:** `migrations/014_add_log_run_id.ts`
- **Work:** Use dialect-conditional DDL: for SQLite, omit `IF EXISTS` (or use table recreation if SQLite version is pre-3.35.0). For PostgreSQL, keep `IF EXISTS`.
- **Test:** Run `npm run db:down` (or equivalent) on SQLite and verify it succeeds.

### 2.7 Compute Real `error_rate` in `getPromptMetrics`
- **Issue:** #2 — `getPromptMetrics` hardcodes `error_rate: 0`.
- **Files:** `src/services/metrics.service.ts`
- **Work:** Join `runs` table in the prompt metrics query. Compute `error_rate` as `failed_runs / total_runs` per prompt/version. Return `null` if no runs exist.
- **Test:** Update `tests/unit/metrics.service.test.ts` to seed runs with errors and assert correct error rate.

---

## Phase 3: API Contracts & Validation (Days 2.5–3.5)

### 3.1 Resolve Evaluation Score Schema Conflict
- **Issue:** #19 — Schema restricts scores to `[0, 1]`, but tests insert `4.5`, `5.0`.
- **Files:** `src/validation-schemas/promptmetrics-evaluation.schema.ts`, `tests/integration/metrics.test.ts`, `tests/unit/metrics.service.test.ts`
- **Work:** Decision needed: are scores normalized floats `[0,1]` or Likert-scale `[1,5]`?
  - **Option A:** Remove `.max(1)` and allow any non-negative number. Document scale in API.
  - **Option B:** Keep `[0,1]` and update tests to normalize scores.
  - Recommended: **Option A** — evaluation metrics vary (BLEU, ROUGE, Likert, etc.).
- **Test:** Fix tests to use valid scores under the chosen schema.

### 3.2 Add Shared `parseIdParam()` Helper
- **Issue:** #20 — `Number(req.params.id)` produces `NaN` across multiple controllers.
- **Files:** `src/utils/validation.ts` (new or existing), all controllers with `:id` params
- **Work:**
  ```ts
  export function parseIdParam(raw: string): number {
    const id = Number(raw);
    if (!Number.isFinite(id) || id <= 0) {
      throw AppError.badRequest(`Invalid ID parameter: ${raw}`);
    }
    return id;
  }
  ```
  Update: `promptmetrics-evaluation.controller.ts`, `ab-test.controller.ts`, `dataset.controller.ts`, `compliance.controller.ts`.
- **Test:** Integration test for `GET /v1/evaluations/abc` expects 400.

### 3.3 Add Input Size Limits
- **Issue:** #24 — Compliance text and dataset rows have no size limits.
- **Files:** `src/validation-schemas/compliance.schema.ts`, `src/validation-schemas/dataset.schema.ts`
- **Work:**
  - Compliance: `text: Joi.string().max(100_000).required()`
  - Dataset: Add total payload size check in service layer (e.g., reject if total JSON > 10MB).
- **Test:** Integration test with oversized payload expects 422.

### 3.4 Cache Ajv Compiled Validators
- **Issue:** #23 — `EvaluationRuleEngine` recompiles Ajv on every call.
- **Files:** `src/services/evaluation-rule.engine.ts`
- **Work:**
  1. Instantiate `Ajv` once in constructor.
  2. Add `private schemaCache = new Map<string, ValidateFunction>()`.
  3. Reuse compiled validators keyed by `JSON.stringify(schema)`.
  4. Cap cache at 100 entries (LRU) to prevent unbounded memory.
- **Test:** Unit test verifies repeated evaluations with the same schema use cached validator (mock `ajv.compile` and assert call count).

### 3.5 Fix AnthropicAdapter System Role Mapping
- **Issue:** #25 — System messages prefixed into `user` messages instead of top-level `system` parameter.
- **Files:** `src/services/providers/anthropic.adapter.ts`
- **Work:**
  1. Extract `system` messages from `request.messages`.
  2. Pass them as top-level `system` parameter in `client.messages.create()`.
  3. Filter `system` out of the `messages` array.
- **Test:** Add `nock`-based unit test that intercepts the Anthropic HTTP request and asserts correct body shape.

### 3.6 Remove Driver Double-Instantiation Fallback
- **Issue:** #22 — `createApp()` falls back to `createDriver()`, a known bug.
- **Files:** `src/app.ts`, `src/server.ts`, `tests/integration/playground.test.ts`
- **Work:**
  1. Remove `if (!driver) { driver = createDriver(); }` from `src/app.ts`.
  2. Ensure `server.ts` always passes the driver.
  3. Update any tests calling `createApp()` without a driver.
- **Test:** All existing tests should still pass.

---

## Phase 4: Frontend Critical Fixes (Days 3.5–4.5)

### 4.1 Fix A/B Test "Run" to Use Real Data
- **Issue:** #13 — Frontend sends `Math.random()` scores.
- **Files:** `ui/src/app/ab-tests/page.tsx`
- **Work:** Remove `generateRandomScores()`. Call `POST /v1/ab-tests/:id/run` with an empty body (backend computes scores) or require user to select a dataset/metric. Update UI to show loading state while backend computes.
- **Test:** E2E test intercepts the POST request and verifies payload does not contain `scoresA`/`scoresB`.

### 4.2 Fix Compliance Detail Dialog
- **Issue:** #14 — Dialog fetches `limit: 1` instead of selected item.
- **Files:** `ui/src/app/compliance/page.tsx`, `ui/src/lib/api.ts`
- **Work:**
  - Option A: Derive detail directly from already-fetched `data.items` (no extra API call).
  - Option B: Add `GET /v1/compliance/scores/:id` endpoint and call it.
  - Recommended: **Option A** for immediate fix; Option B as follow-up if detail needs more data.
- **Test:** E2E test clicks a compliance row and verifies correct detail text appears.

### 4.3 Fix `modal_class` Usage Across Pages
- **Issue:** #15 — `modal_class` passed to `Dialog` root instead of `DialogContent`.
- **Files:** `ui/src/app/evaluations/page.tsx`, `ui/src/app/ab-tests/page.tsx`, `ui/src/app/datasets/page.tsx`, `ui/src/app/compliance/page.tsx`, `ui/src/components/common/confirm-modal.tsx`
- **Work:** Move `modal_class="sm:max-w-..."` from `<Dialog>` to `<DialogContent>` on every usage site.
- **Test:** Visual regression or E2E test that dialogs render at correct width.

### 4.4 Add Confirmation Before Dataset Deletion
- **Issue:** #16 — Single-click data loss.
- **Files:** `ui/src/app/datasets/page.tsx`
- **Work:** Wrap `deleteMutation.mutate()` in `ConfirmModal` with message: "Delete dataset '{name}'? This cannot be undone."
- **Test:** E2E test clicks delete, confirms modal, verifies dataset removed.

### 4.5 Fix Resizable Component
- **Issue:** #12 — `ResizablePanel` is non-functional (no drag handlers).
- **Files:** `ui/src/components/ui/resizable.tsx`
- **Work:** Replace custom implementation with `react-resizable-panels` (install, update imports, wire `onLayout` to store). Keep the same component API (`ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle`).
- **Test:** E2E test drags the handle and verifies pane sizes change.

### 4.6 Add Playground Input Validation
- **Issue:** #30 — "Run" button works with empty inputs.
- **Files:** `ui/src/components/playground/PlaygroundLayout.tsx`
- **Work:** Disable Run button when `!selectedModel || (!systemMessage.trim() && !userMessage.trim())`. Show tooltip: "Select a model and enter a prompt to run."
- **Test:** E2E test verifies button is disabled with empty inputs.

### 4.7 Wire Playground Config Button
- **Issue:** #31 — Settings icon has no `onClick`.
- **Files:** `ui/src/components/playground/PlaygroundLayout.tsx`, `ui/src/components/playground/ModelConfigDrawer.tsx`
- **Work:** Import `ModelConfigDrawer`, add `const [configOpen, setConfigOpen] = useState(false)`, wire settings button to `setConfigOpen(true)`.
- **Test:** E2E test clicks settings icon and verifies drawer opens.

---

## Phase 5: Frontend Architecture & Performance (Days 4.5–6)

### 5.1 Fix Playground Store Re-Renders
- **Issue:** #33 — No selectors; all subscribers re-render on `streamOutput` changes.
- **Files:** `ui/src/stores/playground.store.ts`, `ui/src/components/playground/PlaygroundLayout.tsx`
- **Work:**
  1. Split store into two: `usePlaygroundConfigStore` (model, temperature, pane sizes) and `usePlaygroundStreamStore` (streamOutput, isRunning).
  2. Or add selector hooks: `useStreamOutput = () => usePlaygroundStore(s => s.streamOutput)`.
- **Test:** Profile component re-renders during streaming; verify only `StreamingOutputPanel` re-renders.

### 5.2 Fix O(n²) Streaming String Concatenation
- **Issue:** #34 — `appendStreamOutput` copies entire accumulated string on every token.
- **Files:** `ui/src/stores/playground.store.ts`, `ui/src/components/playground/StreamingOutputPanel.tsx`
- **Work:** Change `streamOutput: string` to `streamTokens: string[]`. `appendStreamOutput` pushes token to array. UI renders `streamTokens.join("")`.
- **Test:** Profile with a 4K-token stream; verify no UI freezing.

### 5.3 Replace Custom UI Primitives with Radix
- **Issue:** #35 — Drawer, Tabs, Popover, ToggleGroup lack accessibility.
- **Files:** `ui/src/components/ui/drawer.tsx`, `ui/src/components/ui/tabs.tsx`, `ui/src/components/ui/popover.tsx`, `ui/src/components/ui/toggle-group.tsx`
- **Work:**
  1. Install `@radix-ui/react-dialog`, `@radix-ui/react-tabs`, `@radix-ui/react-popover`, `@radix-ui/react-toggle-group`.
  2. Replace each custom implementation with the Radix primitive + Tailwind styling.
  3. Keep the same exported component API to minimize page-level changes.
- **Test:** Accessibility audit (axe-core or manual keyboard navigation test).

### 5.4 Fix Slider Single-Value Input
- **Issue:** #36 — Slider renders two thumbs when scalar `value` is passed.
- **Files:** `ui/src/components/ui/slider.tsx`
- **Work:** Add scalar handling:
  ```ts
  const _values = Array.isArray(value) ? value : value !== undefined ? [value] : Array.isArray(defaultValue) ? defaultValue : defaultValue !== undefined ? [defaultValue] : [min, max];
  ```
- **Test:** Unit test with scalar `value={50}` verifies single thumb.

### 5.5 Fix Compliance Pagination
- **Issue:** #32 — Fetches `limit: 1000` while UI shows pagination.
- **Files:** `ui/src/app/compliance/page.tsx`
- **Work:** Change `limit: 1000` to `limit: LIMIT` (20). Pass both `page` and `limit` to API. Ensure backend returns total count for pagination metadata.
- **Test:** E2E test with >20 compliance scores verifies pagination works.

### 5.6 Add Request Timeout to API Client
- **Issue:** — `fetch` hangs indefinitely.
- **Files:** `ui/src/lib/api.ts`
- **Work:** Wrap `fetch` with `AbortSignal.timeout(10000)`. Create `ApiError` class with `status`, `statusText`, and parsed body.
- **Test:** Mock a 15s delay and verify `ApiError` with timeout message.

---

## Phase 6: Test Reliability & Coverage (Days 6–7.5)

### 6.1 Rewrite Provider Adapter Tests with `nock`
- **Issue:** #37 — Tests only verify hardcoded constants.
- **Files:** `tests/unit/providers/*.adapter.test.ts`
- **Work:**
  1. Mock each provider's list-models endpoint with `nock`.
  2. Assert correct request URL, headers, and response parsing.
  3. Mock 429/500 errors and verify `ProviderError` classification (rateLimit vs unknown).
  4. Mock streaming responses and verify chunk parsing.
- **Test:** The rewritten tests themselves.

### 6.2 Fix Hardcoded Foreign Key in Metrics Integration Test
- **Issue:** #38 — `evaluation_id = 1` relies on fresh auto-increment.
- **Files:** `tests/integration/metrics.test.ts`
- **Work:** Capture `lastInsertRowid` from evaluation insert and use that variable instead of literal `1`.
- **Test:** Run test after seeding extra rows; should still pass.

### 6.3 Fix Cancel-Abort E2E Test
- **Issue:** #39 — `requestAborted` flag never asserted.
- **Files:** `ui/e2e/playground.spec.ts`
- **Work:** Add `expect(requestAborted).toBe(true)` after clicking cancel. Or verify the response is truncated.
- **Test:** The fixed test itself.

### 6.4 Fix Flaky Skeleton Wait
- **Issue:** #40 — Waits for `.animate-pulse` detached.
- **Files:** `ui/e2e/dashboard.spec.ts`
- **Work:** Replace with robust wait: assert skeleton is visible first, then wait for it to detach. Or wait for data-loaded indicator (table row count > 0).
- **Test:** Run E2E suite 5x; verify no flakes.

### 6.5 Fix Playground Integration Test Driver
- **Issue:** #41 — `createApp()` called without driver.
- **Files:** `tests/integration/playground.test.ts`
- **Work:** Instantiate a `FilesystemDriver` and pass to `createApp(driver)`.
- **Test:** All integration tests pass.

### 6.6 Add WAL/SHM Cleanup to Integration Tests
- **Issue:** #42 — `afterAll` misses `-wal` and `-shm` files.
- **Files:** `tests/integration/ab-test.test.ts`, `tests/integration/compliance.test.ts`, `tests/integration/dataset.test.ts`, `tests/integration/evaluation.test.ts`, `tests/integration/playground.test.ts`
- **Work:** Extract a shared `cleanupDbFiles(dbPath)` helper in `tests/utils/cleanup-db.ts` and call it from every integration test teardown.
- **Test:** Verify no `.db-wal` or `.db-shm` files remain after test suite.

### 6.7 Add Tests for BudgetService and EvalRunService
- **Issue:** #28 — Zero coverage.
- **Files:** `tests/unit/budget.service.test.ts` (new), `tests/unit/eval-run.service.test.ts` (new)
- **Work:**
  - Budget: Test `getWorkspaceSpend`, `checkBudget`, month-boundary logic, NaN fallback.
  - EvalRun: Test `createRun`, `completeRun`, `failRun`, workspace isolation.
- **Test:** The new tests themselves.

---

## Phase 7: Migrations, Docs & Config (Day 7.5–8.5)

### 7.1 Update OpenAPI Spec
- **Issue:** #18 — Missing all new endpoints; version mismatch.
- **Files:** `docs/openapi.yaml`
- **Work:**
  1. Bump version to `1.1.0`.
  2. Add paths for `/v1/ab-tests`, `/v1/datasets`, `/v1/compliance`, `/v1/playground`, `/v1/evaluations/{id}/run`.
  3. Add schemas for request/response bodies.
  4. Use `openapi-typescript` to generate types and verify spec is valid.
- **Test:** Run `swagger-codegen` or equivalent; verify no errors.

### 7.2 Resolve SSE vs NDJSON ADR Conflict
- **Issue:** #46 — Two accepted documents contradict each other.
- **Files:** `docs/adr/0003-streaming-protocol.md` (or ADR-003), `docs/plans/frontend-reuse-implementation-*.md`
- **Work:**
  1. Confirm current implementation uses NDJSON.
  2. Update ADR-003 to reflect NDJSON as the final decision.
  3. Mark the SSE implementation plan as superseded.
  4. Document the NDJSON chunk schema (token, metrics, done, error).
- **Test:** No code test; documentation review.

### 7.3 Refactor Seed Script for DatabaseAdapter
- **Issue:** #43 — SQLite-only, bypasses abstraction.
- **Files:** `src/scripts/seed-demo-data.ts`
- **Work:**
  1. Replace direct `better-sqlite3` import with `getDb()`.
  2. Use `DatabaseAdapter` async methods (`prepare`, `run`, `all`).
  3. Add `run_id` to seeded logs.
  4. Wrap force-mode deletes in transaction.
- **Test:** Run seed script against both SQLite and PostgreSQL (if available).

### 7.4 Add `ON DELETE CASCADE` to Foreign Keys
- **Issue:** #47 — Orphaned rows on parent delete.
- **Files:** `migrations/011_add_ab_testing.ts`, `migrations/012_add_datasets_and_eval_runs.ts`
- **Work:** Add `ON DELETE CASCADE` to `ab_test_results.ab_test_id` and `dataset_rows.dataset_id`. For existing deployments, provide a follow-up migration.
- **Test:** Integration test deletes an A/B test and verifies child results are also deleted.

### 7.5 Clean Up Demo Data PRD Drift
- **Issue:** #45 — PRD describes CLI features that don't exist.
- **Files:** `docs/plans/demo-data-generator-prd.md`
- **Work:** Update PRD to match actual seed script scope, or archive it.
- **Test:** Documentation review.

---

## P2 (Minor) Follow-Up Tasks (Post-Merge)

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| P2.1 | Fix CSS variable name mismatch | `ui/src/styles/globals.css` | Small |
| P2.2 | Upgrade `cn()` to `clsx` + `tailwind-merge` | `ui/src/lib/utils.ts` | Small |
| P2.3 | Remove `NEXT_PUBLIC_DEMO_API_KEY` fallback | `ui/src/lib/api.ts` | Small |
| P2.4 | Keep tab panels mounted (forceMount) | `ui/src/components/ui/tabs.tsx` | Small |
| P2.5 | Extract shared `formatDate` helper | `ui/src/lib/date.ts` | Small |
| P2.6 | Clean up Monaco editor decorations | `ui/src/components/playground/EditorTab.tsx` | Small |
| P2.7 | Fix `useEffect` timer leak | `ui/src/app/settings/page.tsx` | Small |
| P2.8 | Validate `from <= to` in DateRangePicker | `ui/src/components/common/date-range-picker.tsx` | Small |
| P2.9 | Fix RiskBadge variant mapping | `ui/src/app/compliance/page.tsx` | Small |
| P2.10 | Use `crypto.randomUUID()` for IDs | `ui/src/components/playground/ParameterSchemaBuilder.tsx` | Small |
| P2.11 | Remove `@types/axios` stub | `package.json` | Small |
| P2.12 | Consolidate N+1 queries in `getActivitySummary` | `src/services/metrics.service.ts` | Small |
| P2.13 | Add `stream_options: { include_usage: true }` to OpenAI/Azure | `src/services/providers/openai.adapter.ts`, `azure-openai.adapter.ts` | Small |
| P2.14 | Implement Variables tab in Playground | `ui/src/components/playground/PlaygroundLayout.tsx` | Large |

---

## Acceptance Criteria

- [ ] All P0 issues resolved with passing tests
- [ ] All P1 issues resolved or explicitly deferred with documented rationale
- [ ] `npm test` passes (unit + integration)
- [ ] `npm run test:e2e` passes (or all E2E tests green)
- [ ] `npm run build` succeeds for both backend and UI
- [ ] `npm run lint` and `npm run format` pass
- [ ] OpenAPI spec validates with `swagger-codegen` or `openapi-typescript`
- [ ] Migrations run forward and backward on SQLite without errors
- [ ] No new security warnings from `npm audit`
- [ ] Code review of the fixes completed by at least one peer

---

*Plan synthesized from findings by 5 specialized domain agents.*
