# Frontend Reuse — Master Build Tasks
**Status**: Draft awaiting approval
**Date**: 2026-04-29
**Scope**: All build tasks for porting PromptSmith frontend assets into the PromptMetrics Next.js dashboard
**Target Version**: 1.2.0
**Estimated Duration**: 10–12 weeks
**Total Tasks**: 90

---

## Legend

| Field | Description |
|-------|-------------|
| **Task ID** | Unique identifier (P-1.1, FE-1.1, BE-1.1, AI-1.1, etc.) |
| **Phase** | Foundation, Playground, A/B + Eval, Compliance + Polish |
| **Title** | Concise deliverable name |
| **Description** | What needs to be built, ported, or adapted |
| **Effort** | Estimated hours (S=1-4h, M=5-12h, L=13-24h, XL=25-40h) |
| **Dependencies** | Task IDs that must complete before this one starts |
| **Owner** | Primary accountable role |
| **Acceptance Criteria** | Measurable, testable conditions for sign-off |

---

## Definition of Done

Every task must satisfy:
1. Code compiles (`npm run build` backend, `next build` UI) without errors.
2. Unit tests pass for new services/controllers/components.
3. Integration tests pass for new endpoints.
4. Workspace scoping verified: data from workspace A does not leak to workspace B.
5. A peer has reviewed the PR.

---

## Phase 1: Foundation (Weeks 1–2)

### P-1.1 Dependency Audit and Stack Alignment
| Field | Value |
|-------|-------|
| **Title** | Dependency Audit and Stack Alignment |
| **Description** | Audit `ui/package.json` and old frontend `package.json` for conflicts. Install proposed new dependencies (zustand, RHF, zod, sonner, Monaco, date-fns) and verify build passes. Write compatibility matrix. |
| **Effort** | 4h |
| **Dependencies** | — |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. `npm install` succeeds with zero peer-dep warnings. 2. `next build` completes with zero errors. 3. `depcheck` reports no unused dependencies. 4. `ui/docs/DEPENDENCIES.md` compatibility matrix written. |

### P-1.2 shadcn/ui Component Gap Analysis
| Field | Value |
|-------|-------|
| **Title** | shadcn/ui Component Gap Analysis |
| **Description** | Identify missing shadcn primitives (Resizable, Drawer, Sheet, Slider, Multi-select), install them, verify they compose correctly with Tailwind v4. Test in `ui/src/app/test-ui/page.tsx`. |
| **Effort** | 3h |
| **Dependencies** | P-1.1 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. All missing primitives installed. 2. Each renders in test page without console errors. 3. No CSS specificity conflicts. 4. Dark mode renders correctly. |

### P-1.3 Zustand Store Scaffold and Conventions
| Field | Value |
|-------|-------|
| **Title** | Zustand Store Scaffold and Conventions |
| **Description** | Create `ui/src/stores/` directory, scaffold `playground.store.ts` with typed state (pane sizes, active tab, selected model). Write `ui/src/stores/README.md` documenting decision matrix (React Query = server, Zustand = shared UI, useState = local). |
| **Effort** | 2h |
| **Dependencies** | P-1.1 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. `playground.store.ts` exists with typed state. 2. README documents decision matrix. 3. Sample component consumes store in dev. 4. Store NOT persisted to localStorage. |

### P-1.4 SSE Client Prototype
| Field | Value |
|-------|-------|
| **Title** | SSE Client Prototype |
| **Description** | Build `ui/src/lib/streaming.ts` with `createSSEStream(url, headers)` returning `AsyncIterator` yielding parsed JSON chunks. Verify against mock Express SSE endpoint (`GET /__mock/sse`). |
| **Effort** | 4h |
| **Dependencies** | P-1.1 |
| **Owner** | Eng Lead |
| **Acceptance Criteria** | 1. `createSSEStream` works and yields 10 events over 2 seconds. 2. Browser renders chunks in real time without memory leaks. 3. AbortController cancellation tested. 4. Browser compatibility documented (Safari 14+, Chrome 90+, Firefox 90+). |

### P-1.5 Backend Proxy Skeleton
| Field | Value |
|-------|-------|
| **Title** | Backend Proxy Skeleton |
| **Description** | Scaffold `src/routes/playground.route.ts`, `src/controllers/playground.controller.ts`, and `src/services/playground.service.ts`. Wire into `src/app.ts` with `authenticateApiKey` + `tenantMiddleware` + `auditLog`. Return 501 "Not yet implemented" for all methods. |
| **Effort** | 4h |
| **Dependencies** | — |
| **Owner** | Eng Lead |
| **Acceptance Criteria** | 1. Route mounted at `/v1/playground/*`. 2. Auth middleware rejects missing API key (401) and invalid workspace (403). 3. Audit log entry written on every request. 4. `supertest` integration test passes for 501 responses. |

### P-1.6 Database Migrations for AI Features
| Field | Value |
|-------|-------|
| **Title** | Database Migrations for AI Features |
| **Description** | Create migrations `011_add_ab_testing.ts`, `012_add_datasets_and_eval_runs.ts`, `013_add_compliance.ts`, `014_add_log_run_id.ts`. All use `dialect-helpers.ts` for cross-database compatibility. |
| **Effort** | 6h |
| **Dependencies** | — |
| **Owner** | Eng Lead |
| **Acceptance Criteria** | 1. All migrations apply on SQLite and PostgreSQL. 2. `npm run db:init` completes without errors. 3. Indexes confirmed via `.schema` or `\d`. 4. Rollback (`down()`) drops all objects cleanly. |

### P-1.7 LLM Provider Adapter Interface
| Field | Value |
|-------|-------|
| **Title** | LLM Provider Adapter Interface and Registry |
| **Description** | Define `LLMProviderAdapter` interface with `listModels`, `chatCompletion`, `streamChatCompletion`, `estimateCost`. Build registry mapping slugs to lazily-instantiated adapters. Unknown slug throws `AppError.badRequest('Unsupported provider')`. |
| **Effort** | 4h |
| **Dependencies** | P-1.6 |
| **Owner** | Eng Lead |
| **Acceptance Criteria** | 1. Interface is compile-time type-safe. 2. Registry returns correct adapter for `openai`, `anthropic`, `cohere`, `ollama`, `azure_openai`. 3. Unknown slug throws mapped error. 4. Unit test covers lookup and error case. |

### P-1.8 Port Pure UI Helpers
| Field | Value |
|-------|-------|
| **Title** | Port Pure UI Helpers |
| **Description** | Copy-adapt `ConfirmModal`, `DiscardChangesModal`, `DateRangePicker` into `ui/src/components/common/`. Map old custom Modal to shadcn Dialog. Map old date picker to shadcn Calendar + Popover. Replace React Icons with Lucide. |
| **Effort** | 6h |
| **Dependencies** | P-1.2 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. `ConfirmModal` traps focus and returns focus on close. 2. `DateRangePicker` selects/clears range. 3. Zero React Icons imports remain. 4. Keyboard navigation passes axe-core scan. |

### P-1.9 Dynamic Import Boundaries
| Field | Value |
|-------|-------|
| **Title** | Dynamic Import Boundaries for Heavy Assets |
| **Description** | Create `ui/src/components/lazy/index.ts` with `next/dynamic` wrappers for Monaco Editor, `ParameterSchemaBuilder`, modals. Add `LazyLoadBoundary` with Skeleton fallback. |
| **Effort** | 3h |
| **Dependencies** | P-1.1 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Network tab shows separate chunks for Monaco/modals. 2. `LazyLoadBoundary` renders Skeleton for 200ms+ loads. 3. No hydration mismatch errors. 4. Lighthouse "Avoid enormous payloads" passes. |

### P-1.10 Port ParameterSchemaBuilder + NestedObjectEditor
| Field | Value |
|-------|-------|
| **Title** | Port ParameterSchemaBuilder and NestedObjectEditor |
| **Description** | Copy-adapt into `ui/src/components/playground/helpers/`. Remove old Button imports; use shadcn Button. Wrap `ParameterSchemaBuilder` in `next/dynamic` with `ssr: false`. |
| **Effort** | 6h |
| **Dependencies** | P-1.2, P-1.9 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Editors render correctly. 2. Add/remove buttons work with keyboard. 3. No Redux or Axios imports remain. 4. Visual regression snapshot within 5% pixel diff. |

---

## Phase 2: Playground MVP (Weeks 3–5)

### FE-2.1 PlaygroundLayout + Resizable Panes
| Field | Value |
|-------|-------|
| **Title** | PlaygroundLayout with Resizable Panes |
| **Description** | Port `PlaygroundLayout` to `ui/src/components/playground/PlaygroundLayout.tsx`. Use shadcn Resizable for split-pane. Remove Redux/connect. Manage pane sizes in Zustand. |
| **Effort** | 8h |
| **Dependencies** | P-1.3, P-1.2 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Three-pane layout renders (editor, output, variables). 2. Pane sizes persist in Zustand (not localStorage). 3. Works on 1440px and 1920px widths. 4. No Redux imports. |

### FE-2.2 EditorTab with Monaco
| Field | Value |
|-------|-------|
| **Title** | EditorTab with Monaco Editor |
| **Description** | Port `EditorTab` to `ui/src/components/playground/EditorTab.tsx`. Wrap Monaco in `React.Suspense`. Replace Axios with `fetch` via playground adapter. Add Mustache variable highlighting. |
| **Effort** | 10h |
| **Dependencies** | P-1.9, P-1.4 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Monaco renders with syntax highlighting. 2. Mustache variables (`{{name}}`) highlighted. 3. No SSR errors. 4. TypeScript types for all props. |

### FE-2.3 ModelSelector
| Field | Value |
|-------|-------|
| **Title** | ModelSelector |
| **Description** | Port `ModelSelector` to `ui/src/components/playground/ModelSelector.tsx`. Use shadcn Select with provider icon helper. Fetch models via `GET /v1/playground/models`. |
| **Effort** | 4h |
| **Dependencies** | P-1.2, BE-2.8 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Dropdown renders providers and models. 2. Selection updates Zustand store. 3. Loading skeleton shown while fetching. 4. Keyboard navigable. |

### FE-2.4 StreamingOutputPanel
| Field | Value |
|-------|-------|
| **Title** | StreamingOutputPanel |
| **Description** | Port `StreamingOutputPanel` to `ui/src/components/playground/StreamingOutputPanel.tsx`. Consume SSE stream from `ui/src/lib/streaming.ts`. Render tokens in real time with typing animation. Show metrics (tokens, latency, cost) on completion. |
| **Effort** | 8h |
| **Dependencies** | P-1.4, BE-2.7 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Tokens appear in real time (<100ms per token). 2. Stream cancellation button works. 3. Metrics panel updates on `done` event. 4. Error state renders on `error` event. |

### FE-2.5 VariableSetsPanel
| Field | Value |
|-------|-------|
| **Title** | VariableSetsPanel |
| **Description** | Port `VariableSetsPanel` to `ui/src/components/playground/VariableSetsPanel.tsx`. Remove Redux; use Zustand or props. Replace old Button with shadcn Button. Support create/edit/delete variable sets. |
| **Effort** | 6h |
| **Dependencies** | P-1.3, P-1.2 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Variable sets list renders. 2. Create/edit/delete work with keyboard. 3. Active set highlights selected variables. 4. No Redux imports. |

### FE-2.6 ModelConfigDrawer
| Field | Value |
|-------|-------|
| **Title** | ModelConfigDrawer |
| **Description** | Port `ModelConfigDrawer` to `ui/src/components/playground/ModelConfigDrawer.tsx`. Use shadcn Drawer + Slider (temperature) + Input (max_tokens, top_p). Persist config in Zustand. |
| **Effort** | 6h |
| **Dependencies** | P-1.2, P-1.3 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Drawer opens/closes with animation. 2. Sliders and inputs update config. 3. Config persists in Zustand during session. 4. Keyboard accessible (Escape to close, Tab to navigate). |

### FE-2.7 VariableSetModal
| Field | Value |
|-------|-------|
| **Title** | VariableSetModal |
| **Description** | Port `VariableSetModal` to `ui/src/components/playground/VariableSetModal.tsx`. Use shadcn Dialog + react-hook-form + Zod validation. Submit via `api.ts` wrapper. |
| **Effort** | 6h |
| **Dependencies** | P-1.2, P-1.3 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Dialog traps focus. 2. Zod validates required fields. 3. Submit calls API and invalidates React Query cache. 4. Success/error toasts via Sonner. |

### FE-2.8 Playground E2E Tests
| Field | Value |
|-------|-------|
| **Title** | Playground E2E Tests |
| **Description** | Write Playwright tests in `ui/e2e/playground.spec.ts`. Cover: open prompt, edit variables, select model, run, see streaming output, cancel stream. |
| **Effort** | 6h |
| **Dependencies** | FE-2.1, FE-2.2, FE-2.3, FE-2.4, FE-2.5, FE-2.6, FE-2.7, BE-2.6 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. All 5 user flows pass in CI. 2. Tests run against mock LLM provider (no real API keys). 3. Screenshots captured on failure. 4. Performance trace shows TTI < 1.5s. |

### BE-2.1 OpenAI Provider Adapter
| Field | Value |
|-------|-------|
| **Title** | OpenAI Provider Adapter |
| **Description** | Implement `LLMProviderAdapter` for OpenAI using `openai` npm package. Support streaming and non-streaming. Hardcode pricing table for `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`. |
| **Effort** | 8h |
| **Dependencies** | P-1.7 |
| **Owner** | Eng Lead |
| **Acceptance Criteria** | 1. Non-streaming returns text + token counts + cost. 2. Streaming yields TokenChunk, MetricsChunk, DoneChunk. 3. `estimateCost` within 1% of known pricing. 4. Circuit breaker wired in. |

### BE-2.2 Anthropic + Cohere Adapters
| Field | Value |
|-------|-------|
| **Title** | Anthropic and Cohere Adapters |
| **Description** | Implement adapters using `@anthropic-ai/sdk` and `cohere-ai`. Follow same streaming pattern. Handle provider-specific errors (Anthropic 529, Cohere 429). |
| **Effort** | 8h |
| **Dependencies** | BE-2.1 |
| **Owner** | Eng Lead |
| **Acceptance Criteria** | 1. Anthropic supports `claude-3-5-sonnet-20241022` and `claude-3-opus-20240229`. 2. Cohere supports `command-r` and `command-r-plus`. 3. Both yield NDJSON-compatible chunks. 4. Errors mapped to `ProviderError`. |

### BE-2.3 Ollama + Azure OpenAI Adapters
| Field | Value |
|-------|-------|
| **Title** | Ollama and Azure OpenAI Adapters |
| **Description** | Ollama adapter calls local HTTP endpoint (`OLLAMA_BASE_URL`). Azure wraps `openai` SDK with custom `baseURL`. Ollama token estimate falls back to `tiktoken`. |
| **Effort** | 6h |
| **Dependencies** | BE-2.1 |
| **Owner** | Eng Lead |
| **Acceptance Criteria** | 1. Ollama streams from `/api/chat`. 2. Azure reads env vars correctly. 3. Token estimate fallback works. 4. Integration tests pass with `nock`. |

### BE-2.4 PlaygroundProxyService
| Field | Value |
|-------|-------|
| **Title** | PlaygroundProxyService |
| **Description** | Orchestrate prompt lookup, Mustache substitution, adapter selection, request execution, metrics computation, log insertion. Enforce 10-minute timeout. |
| **Effort** | 10h |
| **Dependencies** | BE-2.1, BE-2.2, BE-2.3 |
| **Owner** | Eng Lead |
| **Acceptance Criteria** | 1. Validates variables; throws 422 if missing. 2. Non-streaming returns full response. 3. Streaming returns AsyncGenerator. 4. Logs inserted after every run. 5. Unit tests mock adapter. |

### BE-2.5 NDJSON Streaming Controller
| Field | Value |
|-------|-------|
| **Title** | NDJSON Streaming Controller and Route |
| **Description** | Implement `POST /v1/playground/run` controller that streams NDJSON chunks. Set `Content-Type: application/x-ndjson`, `Cache-Control: no-cache`. Handle AbortController cancellation. |
| **Effort** | 6h |
| **Dependencies** | BE-2.4, P-1.5 |
| **Owner** | Eng Lead |
| **Acceptance Criteria** | 1. Client receives NDJSON chunks in real time. 2. Cancellation stops provider call. 3. 10-minute timeout enforced. 4. Error mid-stream sends `error` chunk and closes cleanly. |

### BE-2.6 GET /v1/playground/models
| Field | Value |
|-------|-------|
| **Title** | GET /v1/playground/models Endpoint |
| **Description** | List available models per workspace. Read from provider adapters' `listModels()` and cache for 60 seconds. |
| **Effort** | 2h |
| **Dependencies** | P-1.7 |
| **Owner** | Eng Lead |
| **Acceptance Criteria** | 1. Returns `PaginatedResponse<Model>`. 2. Workspace-scoped (only shows models for configured providers). 3. Cached for 60s. 4. Integration test passes. |

### BE-2.7 Mustache Renderer + Variable Validator
| Field | Value |
|-------|-------|
| **Title** | Mustache Renderer and Variable Validator |
| **Description** | Reuse existing `mustache` integration from `PromptService.getPrompt()`. Add strict mode: throw if required variable is missing. Escape HTML by default. |
| **Effort** | 2h |
| **Dependencies** | — |
| **Owner** | Eng Lead |
| **Acceptance Criteria** | 1. `{{variable}}` substitution works. 2. Missing required variable throws 422. 3. HTML is NOT escaped (raw output for prompts). 4. Unit tests cover edge cases. |

### BE-2.8 Rate Limiting + Budget Enforcement
| Field | Value |
|-------|-------|
| **Title** | Rate Limiting and Budget Enforcement |
| **Description** | Per-workspace token bucket (Redis or in-memory). Monthly budget cap per workspace. Circuit breaker for provider failures. |
| **Effort** | 4h |
| **Dependencies** | BE-2.4 |
| **Owner** | Eng Lead |
| **Acceptance Criteria** | 1. 429 returned when rate limit exceeded. 2. Monthly budget enforced (403 when exceeded). 3. Circuit breaker opens after 5 consecutive failures. 4. Metrics exposed for monitoring. |

---

## Phase 3: A/B Testing + Evaluation Manager (Weeks 6–8)

### FE-3.1 ABTestingTab
| Field | Value |
|-------|-------|
| **Title** | ABTestingTab |
| **Description** | Port `ABTestingTab` to `ui/src/components/playground/tabs/ABTestingTab.tsx`. Replace Redux data with React Query hooks. Keep tab interaction logic. |
| **Effort** | 6h |
| **Dependencies** | P-1.3, BE-3.1 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Tab lists active/completed tests. 2. React Query caches and refetches. 3. No Redux imports. 4. Keyboard navigable. |

### FE-3.2 CreateABTestModal
| Field | Value |
|-------|-------|
| **Title** | CreateABTestModal |
| **Description** | Port `CreateABTestModal` to `ui/src/components/ab-testing/CreateABTestModal.tsx`. shadcn Dialog + Zod schema. Submit via `api.ts` wrapper. |
| **Effort** | 8h |
| **Dependencies** | P-1.2, P-1.3, BE-3.1 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Form validates all fields with Zod. 2. Dataset selector populates from React Query. 3. Submit creates test and invalidates cache. 4. Success toast via Sonner. |

### FE-3.3 ABTestResultModal
| Field | Value |
|-------|-------|
| **Title** | ABTestResultModal |
| **Description** | Port `ABTestResultModal` to `ui/src/components/ab-testing/ABTestResultModal.tsx`. Port Recharts-based result cards. Show win rate, p-value, per-metric delta. |
| **Effort** | 8h |
| **Dependencies** | FE-3.1, BE-3.2 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Results render with statistical significance indicator. 2. Charts use Recharts (no ApexCharts). 3. "Promote Winner" button enabled only for significant results. 4. Responsive layout. |

### FE-3.4 EvaluationTab
| Field | Value |
|-------|-------|
| **Title** | EvaluationTab |
| **Description** | Port `EvaluationTab` to `ui/src/components/playground/tabs/EvaluationTab.tsx`. Adapt to new eval schema. Reuse UI skeleton. |
| **Effort** | 6h |
| **Dependencies** | P-1.3, BE-3.4 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Tab lists evaluations for current prompt. 2. Schema matches backend response. 3. No Redux imports. 4. Run button triggers evaluation. |

### FE-3.5 EvaluationManager Page
| Field | Value |
|-------|-------|
| **Title** | EvaluationManager Page |
| **Description** | Port `EvaluationManager` to `ui/src/app/evaluations/page.tsx`. Replace Redux with React Query. Wrap in `DashboardLayout`. |
| **Effort** | 10h |
| **Dependencies** | P-1.3, BE-3.4 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Page lists all evaluations with pagination. 2. Search and filter work client-side. 3. Create button links to `/evaluations/new`. 4. Responsive table. |

### FE-3.6 CreateEvaluation Page
| Field | Value |
|-------|-------|
| **Title** | CreateEvaluation Page |
| **Description** | Port `CreateEvaluation` to `ui/src/app/evaluations/new/page.tsx`. Next.js routing. react-hook-form + Zod. |
| **Effort** | 8h |
| **Dependencies** | P-1.2, P-1.3, BE-3.4 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Form validates with Zod. 2. Criteria builder supports rule-based v1. 3. Submit creates evaluation. 4. Error states handled. |

### FE-3.7 CreateDataset Page
| Field | Value |
|-------|-------|
| **Title** | CreateDataset Page |
| **Description** | Port `CreateDataset` to `ui/src/app/evaluations/datasets/new/page.tsx`. Next.js routing. Port modal content into page. |
| **Effort** | 6h |
| **Dependencies** | P-1.2, P-1.3, BE-3.5 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. CSV/JSON upload works. 2. Dataset preview renders first 5 rows. 3. Validation for required columns. 4. Submit creates dataset. |

### FE-3.8 VersionTimeline
| Field | Value |
|-------|-------|
| **Title** | VersionTimeline |
| **Description** | Port `VersionTimeline` to `ui/src/components/prompts/VersionTimeline.tsx`. Replace `useNavigate` with `next/link`. Keep timeline markup. |
| **Effort** | 4h |
| **Dependencies** | P-1.2 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Timeline renders versions chronologically. 2. Click navigates to version detail. 3. Active version highlighted. 4. No React Router imports. |

### FE-3.9 A/B Test + Evaluation E2E
| Field | Value |
|-------|-------|
| **Title** | A/B Test and Evaluation E2E Tests |
| **Description** | Write Playwright tests in `ui/e2e/ab-test.spec.ts` and `ui/e2e/evaluation.spec.ts`. Cover create, run, view results, promote winner flows. |
| **Effort** | 8h |
| **Dependencies** | FE-3.1, FE-3.2, FE-3.3, FE-3.4, FE-3.5, FE-3.6, FE-3.7, BE-3.3, BE-3.6 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. All critical flows pass in CI. 2. Mock data seeded for tests. 3. Screenshots on failure. 4. No real LLM API calls. |

### BE-3.1 A/B Test Statistical Engine
| Field | Value |
|-------|-------|
| **Title** | A/B Test Statistical Engine |
| **Description** | Implement Welch's t-test, two-proportion z-test, percentile bootstrap CI (10,000 resamples), sample size power analysis. |
| **Effort** | 10h |
| **Dependencies** | P-1.6 |
| **Owner** | Eng Lead |
| **Acceptance Criteria** | 1. Welch's t-test correct for normal data. 2. Bootstrap CI within 1% tolerance. 3. Early-stopping documented. 4. Unit tests with synthetic data. |

### BE-3.2 A/B Test Routes and Controllers
| Field | Value |
|-------|-------|
| **Title** | A/B Test Routes and Controllers |
| **Description** | Implement `POST /v1/ab-tests`, `GET /v1/ab-tests`, `GET /v1/ab-tests/:id`, `POST /v1/ab-tests/:id/promote`. Workspace-scoped. Audit logged. |
| **Effort** | 8h |
| **Dependencies** | BE-3.1, P-1.5 |
| **Owner** | Eng Lead |
| **Acceptance Criteria** | 1. All endpoints return correct shapes. 2. Workspace scoping verified. 3. Promote winner updates prompt default version. 4. Integration tests pass. |

### BE-3.3 Dataset Storage API
| Field | Value |
|-------|-------|
| **Title** | Dataset Storage API |
| **Description** | Implement `POST /v1/datasets`, `GET /v1/datasets`, `GET /v1/datasets/:id`. Support CSV and JSON upload. Store in SQLite/PostgreSQL. |
| **Effort** | 6h |
| **Dependencies** | P-1.6 |
| **Owner** | Eng Lead |
| **Acceptance Criteria** | 1. Upload parses CSV/JSON correctly. 2. Workspace-scoped listing. 3. Row count limit enforced (10,000). 4. Integration tests pass. |

### BE-3.4 Rule-Based Eval Engine v1
| Field | Value |
|-------|-------|
| **Title** | Rule-Based Evaluation Engine v1 |
| **Description** | Implement regex, keyword, JSON schema (Ajv), and length rules. Workspace-scoped criteria storage. |
| **Effort** | 6h |
| **Dependencies** | P-1.6 |
| **Owner** | Eng Lead |
| **Acceptance Criteria** | 1. Regex rule matches correctly. 2. JSON schema validation works. 3. Length rule enforces min/max. 4. Unit tests cover all rule types. |

### BE-3.5 Evaluation Routes and Controllers
| Field | Value |
|-------|-------|
| **Title** | Evaluation Routes and Controllers |
| **Description** | Implement `POST /v1/evaluations`, `POST /v1/evaluations/:id/run`, `GET /v1/evaluations/:id/results`. |
| **Effort** | 6h |
| **Dependencies** | BE-3.4, P-1.5 |
| **Owner** | Eng Lead |
| **Acceptance Criteria** | 1. Create evaluation persists criteria. 2. Run evaluates dataset against criteria. 3. Results include per-row scores and aggregate. 4. Integration tests pass. |

### BE-3.6 Evaluation Trend Aggregation
| Field | Value |
|-------|-------|
| **Title** | Evaluation Trend Aggregation |
| **Description** | Background job or endpoint to aggregate evaluation scores over time for trend charts. |
| **Effort** | 4h |
| **Dependencies** | BE-3.5 |
| **Owner** | Eng Lead |
| **Acceptance Criteria** | 1. Trend endpoint returns daily aggregates. 2. Window parameter supports 7d/30d/90d. 3. Data matches existing `/v1/metrics/evaluations` shape. 4. Tested with synthetic data. |

---

## Phase 4: Compliance + Polish (Weeks 9–10)

### FE-4.1 ComplianceQuickSummary + RiskDistributionCard
| Field | Value |
|-------|-------|
| **Title** | ComplianceQuickSummary and RiskDistributionCard |
| **Description** | Port to `ui/src/components/compliance/*`. Direct reuse with Tailwind token remap. Use Recharts for risk distribution chart. |
| **Effort** | 6h |
| **Dependencies** | P-1.2, BE-4.1 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Cards render with correct risk colors. 2. Recharts pie/donut chart for risk distribution. 3. Responsive layout. 4. No ApexCharts imports. |

### FE-4.2 IntegrityBadge
| Field | Value |
|-------|-------|
| **Title** | IntegrityBadge |
| **Description** | Port to `ui/src/components/compliance/IntegrityBadge.tsx`. shadcn Badge variant with semantic colors. |
| **Effort** | 2h |
| **Dependencies** | P-1.2 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Badge renders pass/warning/fail states. 2. Accessible (aria-label). 3. Matches shadcn design tokens. |

### FE-4.3 ReviewPromptsPage
| Field | Value |
|-------|-------|
| **Title** | ReviewPromptsPage |
| **Description** | Create `ui/src/app/compliance/page.tsx`. Wrap cards in `DashboardLayout`. Fetch compliance data via React Query. |
| **Effort** | 4h |
| **Dependencies** | FE-4.1, FE-4.2, BE-4.1 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Page renders compliance summary. 2. Lists prompts with risk scores. 3. Pagination works. 4. Responsive. |

### FE-4.4 Bundle-Size Audit
| Field | Value |
|-------|-------|
| **Title** | Bundle-Size Audit and Code-Splitting Pass |
| **Description** | Run `next build` and analyze output. Enforce dynamic imports for Monaco, modals, and charts. Update `ui/next.config.*` if needed. |
| **Effort** | 4h |
| **Dependencies** | FE-2.1, FE-2.2, FE-3.5 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Initial JS < 500 KB gzipped. 2. Total JS < 1.0 MB gzipped. 3. Lighthouse Performance >= 70. 4. Report written to `ui/docs/PERFORMANCE.md`. |

### FE-4.5 Accessibility Pass
| Field | Value |
|-------|-------|
| **Title** | Accessibility Pass |
| **Description** | Audit all `ui/src/components/playground/*` and new compliance components. Fix keyboard traps, focus management, ARIA labels. Run axe-core. |
| **Effort** | 6h |
| **Dependencies** | FE-2.1, FE-2.2, FE-2.3, FE-2.4, FE-2.5, FE-2.6, FE-2.7, FE-4.1, FE-4.2 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. axe-core scan passes with 0 violations. 2. All interactive elements keyboard accessible. 3. Focus visible and logical. 4. Screen reader tested with VoiceOver. |

### FE-4.6 E2E Coverage Expansion
| Field | Value |
|-------|-------|
| **Title** | E2E Coverage Expansion |
| **Description** | Expand Playwright suite to cover compliance flows. Add performance benchmarks. |
| **Effort** | 4h |
| **Dependencies** | FE-4.3, FE-4.5 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Compliance page E2E passes. 2. Performance trace shows TTI < 2.0s. 3. All tests pass in CI. 4. No flaky tests. |

### BE-4.1 Compliance Scoring Engine v1
| Field | Value |
|-------|-------|
| **Title** | Compliance Scoring Engine v1 |
| **Description** | Implement regex/heuristic-based compliance scoring. Default PII rules (email, SSN, phone, credit card Luhn, API key entropy). Severity-weighted scoring. |
| **Effort** | 6h |
| **Dependencies** | P-1.6 |
| **Owner** | Eng Lead |
| **Acceptance Criteria** | 1. Email regex detects 95%+ of email patterns. 2. Credit card Luhn check validates. 3. Severity weights apply correctly. 4. Unit tests with synthetic data. |

### BE-4.2 Compliance Routes and Controllers
| Field | Value |
|-------|-------|
| **Title** | Compliance Routes and Controllers |
| **Description** | Implement `GET /v1/compliance/score` and `GET /v1/compliance/violations`. Workspace-scoped. |
| **Effort** | 4h |
| **Dependencies** | BE-4.1, P-1.5 |
| **Owner** | Eng Lead |
| **Acceptance Criteria** | 1. Score endpoint returns aggregate per prompt. 2. Violations endpoint lists with severity. 3. Workspace scoping verified. 4. Integration tests pass. |

---

## Dependency Graph (Critical Path)

```
Week 1-2 (Foundation):
  P-1.1 → P-1.2 → P-1.8, P-1.10
  P-1.1 → P-1.3, P-1.9
  P-1.1 → P-1.4
  P-1.1 → P-1.5
  P-1.6 → P-1.7

Week 3-5 (Playground):
  P-1.3 + P-1.2 → FE-2.1
  P-1.9 + P-1.4 → FE-2.2
  P-1.2 + BE-2.8 → FE-2.3
  P-1.4 + BE-2.7 → FE-2.4
  P-1.3 + P-1.2 → FE-2.5
  P-1.2 + P-1.3 → FE-2.6, FE-2.7
  P-1.7 → BE-2.1 → BE-2.2, BE-2.3
  BE-2.1 + BE-2.2 + BE-2.3 → BE-2.4
  BE-2.4 + P-1.5 → BE-2.5
  P-1.7 → BE-2.6
  BE-2.4 → BE-2.8
  FE-2.1..FE-2.7 + BE-2.6 → FE-2.8

Week 6-8 (A/B + Eval):
  P-1.3 + BE-3.1 → FE-3.1
  P-1.2 + P-1.3 + BE-3.1 → FE-3.2
  FE-3.1 + BE-3.2 → FE-3.3
  P-1.3 + BE-3.4 → FE-3.4
  P-1.3 + BE-3.4 → FE-3.5
  P-1.2 + P-1.3 + BE-3.4 → FE-3.6
  P-1.2 + P-1.3 + BE-3.5 → FE-3.7
  P-1.2 → FE-3.8
  P-1.6 → BE-3.1
  BE-3.1 + P-1.5 → BE-3.2
  P-1.6 → BE-3.3
  P-1.6 → BE-3.4
  BE-3.4 + P-1.5 → BE-3.5
  BE-3.5 → BE-3.6
  FE-3.1..FE-3.8 + BE-3.3 + BE-3.6 → FE-3.9

Week 9-10 (Compliance + Polish):
  P-1.2 + BE-4.1 → FE-4.1
  P-1.2 → FE-4.2
  FE-4.1 + FE-4.2 + BE-4.1 → FE-4.3
  FE-2.1 + FE-2.2 + FE-3.5 → FE-4.4
  FE-2.1..FE-2.7 + FE-4.1 + FE-4.2 → FE-4.5
  FE-4.3 + FE-4.5 → FE-4.6
  P-1.6 → BE-4.1
  BE-4.1 + P-1.5 → BE-4.2
```

---

## Summary by Owner

| Owner | Tasks | Total Effort (hours) |
|-------|-------|---------------------|
| Frontend Lead | 28 | ~152h |
| Eng Lead | 18 | ~120h |
| Design Lead | 0 (UX review only) | ~8h (review) |
| **Total** | **46** | **~280h** |

---

## Appendices

- **Implementation Plan**: `docs/plans/frontend-reuse-implementation-plan.md`
- **PRD**: `docs/plans/frontend-reuse-prd.md`
- **Roadmap**: `docs/plans/frontend-reuse-roadmap.md`
- **Architecture detail**: `docs/plans/frontend-reuse-implementation-architecture.md`
- **Frontend detail**: `docs/plans/frontend-reuse-implementation-frontend.md`
- **AI/ML detail**: `docs/plans/frontend-reuse-implementation-ai.md`
