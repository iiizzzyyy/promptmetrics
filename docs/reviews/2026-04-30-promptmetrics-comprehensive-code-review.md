# PromptMetrics Comprehensive Code Review Report

**Date:** 2026-04-30
**Scope:** Working tree changes (tracked modifications + untracked new features)
**Areas Reviewed:** Backend Core, Backend New Features, Frontend Pages, Frontend Infrastructure, Tests, Migrations/Docs/Config
**Reviewers:** 6 parallel agents
**Commit Range:** HEAD~1 to HEAD (plus all untracked changes in working tree)

---

## Executive Summary

**Verdict: Not Ready to Merge**

The codebase has significant new feature work (Observability Dashboard, LLM Playground, Datasets, A/B Testing, Compliance) with solid architectural foundations, but **critical security, functional, and safety issues block production readiness**. The most severe gaps are missing authorization scopes on evaluation mutations, a non-functional `promoteWinner` endpoint, broken frontend API client headers, multiple critical UI bugs, and a SQLite-incompatible migration rollback.

---

## Critical Issues (Must Fix Before Merge)

| # | Issue | File(s) | Area |
|---|-------|---------|------|
| 1 | **Missing authorization scopes on evaluation mutations** — `POST /v1/evaluations`, `POST /v1/evaluations/:id/results`, `POST /v1/evaluations/:id/run`, and `DELETE /v1/evaluations/:id` are protected only by `authenticateApiKey` with no `requireScope('write')`. Any leaked read-only key can mutate data. | `src/routes/evaluation.route.ts` | Backend Core |
| 2 | **`getPromptMetrics` hardcodes `error_rate: 0`** — The metric is never computed; consumers see false "no failures" data. | `src/services/metrics.service.ts:187` | Backend Core |
| 3 | **`JSON.parse` without try/catch in activity summary** — A single corrupt JSON row crashes the entire `/v1/metrics/activity` endpoint with 500. | `src/services/metrics.service.ts:324-327` | Backend Core |
| 4 | **PlaygroundController lacks Joi body validation** — Manual field checks are incomplete; `messages`, `temperature`, `maxTokens`, `topP` pass through unchecked. | `src/controllers/playground.controller.ts`, `src/routes/playground.route.ts` | Backend New Features |
| 5 | **ProviderRegistry crashes on module import** — Adapters instantiate at import time; missing env vars (e.g., `OPENAI_API_KEY`) crash the process during boot or test import. | `src/services/providers/provider.registry.ts:42-55` | Backend New Features |
| 6 | **`promoteWinner` is a no-op mutation** — `POST /v1/ab-tests/:id/promote` only reads and returns the winner; it does not update prompt versions or DB state. Users think promotion happened when nothing did. | `src/services/ab-test.service.ts:152-183` | Backend New Features |
| 7 | **Stream timeout fails for stuck connections** — `timedStream` only checks deadline between yielded chunks; a hung TCP connection never yields and the deadline is never evaluated. No `AbortSignal` is wired to provider adapters. | `src/services/playground.service.ts:31-43` | Backend New Features |
| 8 | **ComplianceController rescans text unnecessarily** — `scanPrompt()` already scores; controller calls `score()` again, wasting CPU and risking inconsistency. | `src/controllers/compliance.controller.ts:18-20` | Backend New Features |
| 9 | **Unprotected `JSON.parse` in ComplianceController** — `JSON.parse(item.violations_json)` crashes on corrupt data. | `src/controllers/compliance.controller.ts:60,99` | Backend New Features |
| 10 | **Dataset creation is not atomic** — Header inserted, then rows in a loop, then `row_count` update. A crash leaves partial data with `row_count = 0`. | `src/services/dataset.service.ts:38-61` | Backend New Features |
| 11 | **API client overwrites auth headers when custom headers passed** — `...options` spread replaces the `headers` object, losing `X-API-Key` and `X-Workspace-Id`. | `ui/src/lib/api.ts:21-28` | Frontend Infrastructure |
| 12 | **Resizable component is non-functional** — No drag handlers, no state tracking; hardcoded `flex` proportion misleads consumers. | `ui/src/components/ui/resizable.tsx:8-68` | Frontend Infrastructure |
| 13 | **A/B Test "Run" sends random data** — `generateRandomScores()` creates fabricated `scoresA`/`scoresB` instead of real evaluation results. | `ui/src/app/ab-tests/page.tsx:45-47,86-96` | Frontend Pages |
| 14 | **Compliance detail dialog queries wrong item** — Fetches `limit: 1` (first score in DB) instead of the selected item; detail almost always shows wrong data. | `ui/src/app/compliance/page.tsx:71-76` | Frontend Pages |
| 15 | **`modal_class` prop passed to wrong component** — Passed to `Dialog` root (which doesn't accept it) instead of `DialogContent`, breaking dialog sizing and causing React warnings. | Multiple pages + `confirm-modal.tsx` | Frontend Pages |
| 16 | **No confirmation before dataset deletion** — Single-click permanent data loss. | `ui/src/app/datasets/page.tsx:183-194` | Frontend Pages |
| 17 | **Migration 014 `down()` uses invalid SQLite syntax** — `ALTER TABLE ... DROP COLUMN IF EXISTS` is not valid in SQLite. Rollback fails on the default backend. | `migrations/014_add_log_run_id.ts:13` | Migrations |
| 18 | **OpenAPI spec is missing entire new API surface** — Zero definitions for `/v1/ab-tests`, `/v1/datasets`, `/v1/compliance`, `/v1/playground`, `/v1/evaluations/:id/run`. Spec version (`1.0.1`) also mismatches `package.json` (`1.1.0`). | `docs/openapi.yaml` | Documentation |

---

## Important Issues (Should Fix)

| # | Issue | File(s) | Area |
|---|-------|---------|------|
| 19 | **Evaluation score validation conflicts with tests** — Schema restricts scores to `[0, 1]`, but tests insert `4.5`, `5.0`, etc. Users posting Likert-scale scores get 422. | `src/validation-schemas/promptmetrics-evaluation.schema.ts:13` | Backend Core |
| 20 | **`Number(req.params.id)` produces `NaN` without validation** — Passes `NaN` to service/SQL across evaluation, AB test, dataset, and compliance controllers. | Multiple controllers | Backend Core + New Features |
| 21 | **Missing audit logging on evaluation mutations** — No `auditLog()` on create, result, run, or delete endpoints. | `src/routes/evaluation.route.ts` | Backend Core |
| 22 | **Driver double-instantiation fallback still present** — `createApp()` falls back to `createDriver()`, a known bug per `CLAUDE.md`. | `src/app.ts:34-36` | Backend Core |
| 23 | **EvaluationRuleEngine recompiles Ajv on every call** — `ajv.compile(schema)` is expensive; no caching. | `src/services/evaluation-rule.engine.ts:61-77` | Backend New Features |
| 24 | **No input size limits on compliance scan or dataset rows** — Arbitrary text/JSON can cause regex CPU exhaustion or huge payloads. | `src/validation-schemas/compliance.schema.ts`, `src/validation-schemas/dataset.schema.ts` | Backend New Features |
| 25 | **AnthropicAdapter maps `system` role incorrectly** — Prefixes system into `user` messages instead of using Anthropic's top-level `system` parameter. Wastes tokens and degrades behavior. | `src/services/providers/anthropic.adapter.ts:78-80,117-119` | Backend New Features |
| 26 | **ABTestService transactions missing** — Result insertion + status update are separate statements; crash leaves test stuck in `running`. | `src/services/ab-test.service.ts:45-69,108-150` | Backend New Features |
| 27 | **Dataset name uniqueness not enforced** — Multiple datasets with identical names per workspace breaks CLI/SDK selection. | `src/services/dataset.service.ts:38-40` | Backend New Features |
| 28 | **Missing tests for BudgetService and EvalRunService** — No unit or integration coverage. | `src/services/budget.service.ts`, `src/services/eval-run.service.ts` | Backend New Features |
| 29 | **Settings page stores API key in `localStorage`** — Vulnerable to XSS extraction; accessible by any script on the domain. | `ui/src/app/settings/page.tsx:10-36` | Frontend Pages |
| 30 | **Playground "Run" button has no input validation** — No check that model is selected or prompt is non-empty before API call. | `ui/src/components/playground/PlaygroundLayout.tsx:38-41` | Frontend Pages |
| 31 | **Playground Config button is dead UI** — Settings icon has no `onClick` handler; `ModelConfigDrawer` exists but is unused. | `ui/src/components/playground/PlaygroundLayout.tsx:66-68` | Frontend Pages |
| 32 | **Compliance page fetches 1000 items unconditionally** — Pagination UI uses `page` but query uses `limit: 1000`, causing performance issues and disconnected pagination. | `ui/src/app/compliance/page.tsx:68-69` | Frontend Pages |
| 33 | **Playground store causes excessive re-renders** — No selectors; `streamOutput` updates trigger re-renders in components that only need `sidebarOpen`. | `ui/src/stores/playground.store.ts:66-134` | Frontend Infrastructure |
| 34 | **O(n²) string concatenation during streaming** — `appendStreamOutput` concatenates strings for every token. | `ui/src/stores/playground.store.ts:127-128` | Frontend Infrastructure |
| 35 | **Multiple UI primitives lack accessibility** — Drawer (no focus trap, escape-to-close, role), Tabs (no keyboard nav), Popover (click-outside race), ToggleGroup (no ARIA, overwrites child `onClick`). | `ui/src/components/ui/*.tsx` | Frontend Infrastructure |
| 36 | **Slider breaks on single-value input** — Falls back to `[min, max]` when scalar provided, rendering two thumbs. | `ui/src/components/ui/slider.tsx:40-46` | Frontend Infrastructure |
| 37 | **Provider adapter tests give false confidence** — Assert `Array.isArray(models)` instead of `toEqual([])`, and only verify hardcoded constants without HTTP mocking. | `tests/unit/providers/*.test.ts` | Tests |
| 38 | **Hardcoded foreign key assumption in integration tests** — `evaluation_id = 1` relies on fresh SQLite auto-increment; fragile to setup changes. | `tests/integration/metrics.test.ts:138-140` | Tests |
| 39 | **Cancel-abort test never asserts abort happened** — `requestAborted` flag set but never checked. | `ui/e2e/playground.spec.ts:115-139` | Tests |
| 40 | **Flaky skeleton-loader wait pattern** — Waits for `.animate-pulse` detached; fails if skeleton was never in DOM when waiter starts. | `ui/e2e/dashboard.spec.ts:48` | Tests |
| 41 | **Playground integration test uses driverless `createApp()`** — Re-instantiates driver; per `CLAUDE.md` this is an anti-pattern. | `tests/integration/playground.test.ts:34` | Tests |
| 42 | **Missing SQLite WAL/SHM cleanup** — `afterAll` deletes `.db` but not `-wal` / `-shm`, corrupting subsequent runs. | Multiple integration test files | Tests |
| 43 | **Seed script is SQLite-only and bypasses DatabaseAdapter** — Cannot run against PostgreSQL; duplicates connection logic. | `src/scripts/seed-demo-data.ts` | Migrations |
| 44 | **Seed script force-mode deletes are not atomic** — 8 sequential `DELETE`s outside a transaction; partial wipe on failure. | `src/scripts/seed-demo-data.ts:313-323` | Migrations |
| 45 | **Documentation-to-code drift** — Demo data PRD describes rich CLI with Ollama integration; actual implementation is a simple Node script. | `docs/plans/demo-data-generator-*.md` | Documentation |
| 46 | **Accepted ADRs contradict each other on streaming protocol** — ADR-003 selects SSE; AI implementation plan selects NDJSON over fetch. Both marked accepted. | `docs/plans/frontend-reuse-implementation-*.md` | Documentation |
| 47 | **Missing `ON DELETE CASCADE` on foreign keys** — `ab_test_results` and `dataset_rows` lack cascade; direct deletes leave orphans. | `migrations/011_add_ab_testing.ts`, `migrations/012_add_datasets_and_eval_runs.ts` | Migrations |

---

## Minor Issues (Nice to Have)

- CSS variable name mismatch (`--color-primarygradient` vs `--color-primary-gradient`) breaks gradient utility (`ui/src/styles/globals.css`)
- `NEXT_PUBLIC_DEMO_API_KEY` bundles potential secret into client bundle (`ui/src/lib/api.ts`)
- `cn()` utility too primitive; doesn't support object syntax or deduplicate Tailwind classes
- Tab panels unmount when inactive, destroying form state (`ui/src/components/ui/tabs.tsx`)
- `fetch` has no request timeout (`ui/src/lib/api.ts`)
- Redundant `z-50`, hardcoded dark-mode colors, `buttonVariants` string concatenation across multiple components
- Playground variables tab is a placeholder; stub modals exported as lazy-loaded components
- `formatDate` duplicated across ~8 pages
- Monaco editor decorations leak; no cleanup on unmount (`EditorTab.tsx`)
- `useEffect` timer leak in Settings page
- DateRangePicker doesn't validate `from <= to`
- RiskBadge in compliance uses incorrect variant mapping
- ParameterSchemaBuilder ID generation can collide (`Date.now() + Math.random()`)
- Redundant provider-name assertions in adapter tests
- `@types/axios` stub in production dependencies (`package.json`)
- Seed script doesn't populate `run_id` on logs or seed new feature tables (`ab_tests`, `datasets`, etc.)
- N+1 queries in `getActivitySummary` (6 sequential count queries)

---

## Strengths Acknowledged

- **Clean provider adapter abstraction** with registry, uniform error mapping, and retryable flags
- **Robust statistical engine** (Welch t-test, z-test, bootstrap CIs) with edge-case handling
- **Thorough compliance engine** (Luhn, Shannon entropy, PII detectors) with good unit test coverage
- **Solid workspace isolation** across all new controllers and services
- **Good Mustache renderer** with strict-mode validation and dot-notation support
- **Well-typed API client** with comprehensive TypeScript interfaces
- **Proper lazy-loading strategy** for heavy components (Monaco editor)
- **Cross-dialect migration pattern** (SQLite/PostgreSQL) consistently applied
- **Idempotent seeding** with `ON CONFLICT` handling
- **SSE streaming implementation** with backpressure handling and proper reader cleanup

---

## Recommendations

1. **Security & Authorization:** Add `requireScope('write')` and `auditLog()` to all mutation endpoints immediately. This is the highest-impact fix.
2. **Fix functional bugs before anything else:** `promoteWinner`, A/B test random scores, compliance detail query, and API header overwriting are user-facing breakages.
3. **Make provider registration lazy:** Do not instantiate adapters at import time. Call `registerBuiltinProviders()` explicitly from `server.ts` / `createApp()`.
4. **Adopt a headless UI library for primitives:** Replace custom tabs, drawer, popover, and toggle-group with Radix UI or Base UI to fix accessibility gaps permanently.
5. **Standardize API client error handling:** Create an `ApiError` class with structured fields; add request timeouts and proper header merging.
6. **Resolve SSE vs NDJSON conflict:** Update ADR-003 to reflect the final decision and mark the other as superseded.
7. **Update OpenAPI spec:** Add all new endpoints with basic schemas; bump version to match `package.json`.
8. **Fix SQLite-incompatible migration:** Remove `IF EXISTS` from `DROP COLUMN` in migration 014.
9. **Add selectors to Zustand stores:** Split playground store or add selector hooks to prevent re-renders during streaming.
10. **Raise the bar on provider adapter tests:** Use `nock` to mock HTTP calls and verify request shaping, error mapping, and retry logic.

---

## Assessment by Area

| Area | Ready? | Blockers |
|------|--------|----------|
| Backend Core | No | Missing scopes, audit logs, hardcoded error_rate, NaN IDs, unprotected JSON.parse |
| Backend New Features | No | Missing validation, import-time crashes, no-op promoteWinner, broken stream timeout, non-atomic dataset creation |
| Frontend Pages | No | Random A/B scores, wrong compliance detail, no delete confirmation, modal_class misuse |
| Frontend Infrastructure | No | Broken resizable, header overwrite, a11y gaps, re-render bottleneck |
| Tests | No | False-confidence assertions, flaky waits, hardcoded FKs, missing WAL cleanup |
| Migrations/Docs/Config | No | SQLite syntax error, out-of-date OpenAPI, seed script limitations, ADR contradiction |

---

## Detailed Agent Findings

### Agent 1: Backend Core & Metrics
- Found missing `requireScope` on evaluation routes, hardcoded `error_rate: 0`, unprotected JSON.parse, NaN ID validation gaps, missing audit logging, and driver double-instantiation.

### Agent 2: Backend New Features
- Found missing Joi validation on playground, import-time provider registry crashes, no-op `promoteWinner`, ineffective stream timeout, double-scoring in compliance, non-atomic dataset creation, Ajv recompilation overhead, and missing size limits.

### Agent 3: Frontend Pages & Components
- Found random score generation in A/B test UI, broken compliance detail fetching, `modal_class` misuse, unconfirmed dataset deletion, dead playground config button, placeholder variables tab, unconditional 1000-item fetch, and duplicated `formatDate` helpers.

### Agent 4: Frontend Infrastructure
- Found header overwriting in `api.ts`, completely non-functional `ResizablePanel`, CSS variable mismatch, excessive re-renders in playground store, O(n²) string concatenation, hardcoded demo API key, and severe accessibility gaps across drawer, tabs, popover, toggle-group, and slider.

### Agent 5: Tests
- Found false-confidence provider adapter assertions, hardcoded foreign key assumptions, never-asserted abort test, flaky skeleton waits, conditional E2E skips, brittle selectors, missing WAL cleanup, and driverless `createApp()` anti-pattern.

### Agent 6: Migrations, Docs & Config
- Found invalid SQLite `DROP COLUMN IF EXISTS` syntax, completely missing OpenAPI definitions for all new endpoints, seed script SQLite-only limitation, non-atomic force-mode deletes, documentation-to-code drift, and unresolved SSE vs NDJSON ADR contradiction.

---

*Report generated by 6 parallel Code Reviewer agents analyzing ~104 changed/untracked files.*
