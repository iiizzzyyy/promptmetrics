# Frontend Reuse — Master Implementation Plan
**Status**: Draft awaiting approval
**Date**: 2026-04-29
**Scope**: Port PromptSmith frontend assets into the PromptMetrics Next.js dashboard
**Target Version**: 1.2.0 (Playground MVP)
**Estimated Duration**: 10–12 weeks
**Owners**: Frontend Lead, Eng Lead, Design Lead

> **Superseded by ADR-003 update** — The streaming protocol has been updated from SSE to NDJSON over fetch. See `docs/adr/0003-streaming-protocol.md` for the canonical decision.

---

## Executive Summary

This plan details the phased port of interactive features from the legacy PromptSmith frontend (`~/Documents/pm-app-frontend`) into the new PromptMetrics Next.js 16 dashboard (`ui/`). The work is organized into four phases over 10–12 weeks, spanning architecture decisions, Playground MVP, A/B Testing + Evaluation Manager, and Compliance + Polish.

**Key decisions already made:**
- **State**: Zustand for client UI state, React Query for server state (ADR-001)
- **Proxy**: Backend proxy (`POST /v1/playground/run`) for LLM provider calls (ADR-002)
- **Streaming**: NDJSON over `fetch` (preserves auth headers) (ADR-003)
- **Tables**: TanStack Table + shadcn/ui primitives (replaces ag-grid) (ADR-004)

---

## 1. Architecture Decisions

### ADR-001: Client State — Zustand + React Query (Hybrid)
**Status**: Accepted
- **Decision**: Zustand for client UI state (drawers, pane sizes, modal state). React Query for all server state.
- **Consequences**: Clean separation; ~3 KB gzipped overhead; reversible if needed.

### ADR-002: Playground Proxy — Backend Proxy
**Status**: Accepted
- **Decision**: `POST /v1/playground/run` proxies to OpenAI/Anthropic/etc. via the Express backend.
- **Consequences**: API keys stay server-side; audit logging automatic; ~50–100 ms latency accepted for security.

### ADR-003: Streaming Protocol — SSE over fetch
**Status**: Accepted
- **Decision**: Use `fetch` + `ReadableStream` with a lightweight SSE parser (not native `EventSource`) so custom headers (`X-API-Key`, `X-Workspace-Id`) are preserved.
- **Consequences**: No Socket.IO server needed; works through standard load balancers; requires `Cache-Control: no-cache` on responses.

### ADR-004: Table Library — TanStack Table
**Status**: Accepted
- **Decision**: TanStack Table + existing shadcn/ui `Table` primitives. ag-grid is deferred.
- **Consequences**: ~15 KB vs ~200–400 KB; consistent with shadcn; loses Excel export/pivoting in v1.

---

## 2. System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              User Browser                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐│
│  │  Prompt Detail  │  │  Playground     │  │  A/B Test / Eval /        ││
│  │  (Next.js page) │  │  (Client comp)  │  │  Compliance pages         ││
│  └────────┬────────┘  └────────┬────────┘  └──────────────────────┬──────┘│
└───────────┼──────────────────┼──────────────────────────────────┼────────┘
            │                  │  HTTP/JSON                       │
            │      ┌───────────▼───────────┐                   │
            │      │   Next.js API Routes  │   (optional BFF)  │
            │      └───────────┬───────────┘                   │
            │                  │                                │
┌───────────▼──────────────────▼────────────────────────────────▼─────────────┐
│                           Express API (port 3000)                          │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────────┐  │
│  │ /v1/playground  │ │ /v1/ab-tests    │ │ /v1/evaluations             │  │
│  │ /v1/providers   │ │ /v1/datasets    │ │ /v1/compliance              │  │
│  └────────┬────────┘ └────────┬────────┘ └──────────────────────┬────────┘  │
│           │                   │                                   │          │
│  ┌────────▼────────┐ ┌────────▼────────┐ ┌──────────────────────▼───────┐  │
│  │ PlaygroundProxy │ │ ABTestEngine    │ │ EvaluationRunner              │  │
│  │   Service       │ │   Service       │ │   Service                     │  │
│  │ ┌─────────────┐ │ │ ┌─────────────┐ │ │ ┌──────────┐  ┌────────────┐ │  │
│  │ │ LLMProvider │ │ │ │ Statistical │ │ │ │ RuleEval │  │ LLMJudge   │ │  │
│  │ │   Adapter   │ │ │ │   Engine    │ │ │ │  v1      │  │   v2       │ │  │
│  │ │ (OpenAI,    │ │ │ │ (Welch t,   │ │ │ └──────────┘  └────────────┘ │  │
│  │ │ Anthropic,  │ │ │ │  bootstrap) │ │ │ ┌──────────────────────────┐   │  │
│  │ │ Cohere)     │ │ │ └─────────────┘ │ │ │ ComplianceScorer         │   │  │
│  │ └─────────────┘ │ └─────────────────┘ │ │ │ (Regex/Heuristic v1)     │   │  │
│  │ ┌─────────────┐ │                     │ │ └──────────────────────────┘   │  │
│  │ │ Mustache    │ │                     │ └──────────────────────────────────┘  │
│  │ │  Renderer   │ │                     │                                   │
│  │ └─────────────┘ │                     │                                   │
│  └─────────────────┘                     │                                   │
│                                           │                                   │
│  ┌────────────────────────────────────────┴─────────────────────────────────┐│
│  │                         DatabaseAdapter                                   ││
│  │  (SQLite / PostgreSQL) — prompts, logs, runs, ab_tests, datasets, etc.  ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Phase-by-Phase Implementation

### Phase 1: Foundation (Weeks 1–2)
**Goal**: Align stack, extend shadcn/ui, establish API adapter layer.

| Deliverable | Location | Effort | Owner |
|-------------|----------|--------|-------|
| Install deps (zustand, RHF, zod, sonner, Monaco, date-fns) | `ui/package.json` | 2h | Frontend Lead |
| Extend shadcn primitives (Drawer, Resizable, Calendar, Slider, etc.) | `ui/src/components/ui/*` | 8h | Frontend Lead |
| Create `usePlaygroundStore` (Zustand) | `ui/src/stores/playground.store.ts` | 4h | Frontend Lead |
| Build Playground API adapter | `ui/src/lib/playground-api.ts` | 6h | Eng Lead |
| Port pure UI helpers (ConfirmModal, DateRangePicker) | `ui/src/components/common/*` | 6h | Frontend Lead |
| Dynamic-import boundaries for Monaco/modals | `ui/src/components/lazy/*` | 3h | Frontend Lead |
| Port ParameterSchemaBuilder, NestedObjectEditor | `ui/src/components/playground/helpers/*` | 6h | Frontend Lead |
| Database migrations for AI features | `migrations/011_*.ts` – `014_*.ts` | 6h | Eng Lead |
| LLM Provider Adapter interface + registry | `src/services/llm-provider.adapter.ts` | 4h | Eng Lead |
| SSE client prototype | `ui/src/lib/streaming.ts` | 4h | Eng Lead |
| Backend proxy skeleton | `src/routes/playground.route.ts` | 4h | Eng Lead |

**Key decisions this phase:**
- Zustand is adopted for client UI state. Server state remains in React Query.
- Playground adapter isolates legacy API shapes from the new backend contract.
- All new tables use `workspace_id` and are created via `umzug` migrations.

---

### Phase 2: Playground MVP (Weeks 3–5)
**Goal**: Port 8 core playground components and wire to backend proxy.

| Component | Source (old) | Target (new) | Strategy | Effort |
|-----------|-------------|--------------|----------|--------|
| `PlaygroundLayout` | `components/Playground/PlaygroundLayout.tsx` | `ui/src/components/playground/PlaygroundLayout.tsx` | shadcn Resizable; remove Redux | 8h |
| `EditorTab` | `components/Playground/tabs/EditorTab.tsx` | `ui/src/components/playground/EditorTab.tsx` | Monaco + Suspense; replace Axios | 10h |
| `ModelSelector` | `components/Playground/ModelSelector.tsx` | `ui/src/components/playground/ModelSelector.tsx` | shadcn Select + provider icons | 4h |
| `StreamingOutputPanel` | `components/Playground/StreamingOutputPanel.tsx` | `ui/src/components/playground/StreamingOutputPanel.tsx` | `fetch` NDJSON reader | 8h |
| `VariableSetsPanel` | `components/Playground/VariableSetsPanel.tsx` | `ui/src/components/playground/VariableSetsPanel.tsx` | Zustand or props; shadcn Button | 6h |
| `ModelConfigDrawer` | `components/Playground/modals/ModelConfigDrawer.tsx` | `ui/src/components/playground/ModelConfigDrawer.tsx` | shadcn Drawer + Slider + Input | 6h |
| `VariableSetModal` | `components/Playground/modals/VariableSetModal.tsx` | `ui/src/components/playground/VariableSetModal.tsx` | shadcn Dialog + RHF + Zod | 6h |
| `ParameterSchemaBuilder` | `components/Playground/helpers/ParameterSchemaBuilder.tsx` | `ui/src/components/playground/ParameterSchemaBuilder.tsx` | Pure UI port | 6h |

**Backend deliverables this phase:**
| Deliverable | Location | Effort | Owner |
|-------------|----------|--------|-------|
| OpenAI provider adapter | `src/services/providers/openai.adapter.ts` | 8h | Eng Lead |
| Anthropic + Cohere adapters | `src/services/providers/anthropic.adapter.ts`, `cohere.adapter.ts` | 8h | Eng Lead |
| Ollama + Azure OpenAI adapters | `src/services/providers/ollama.adapter.ts`, `azure-openai.adapter.ts` | 6h | Eng Lead |
| `PlaygroundProxyService` | `src/services/playground.service.ts` | 10h | Eng Lead |
| NDJSON streaming controller | `src/controllers/playground.controller.ts` | 6h | Eng Lead |
| `GET /v1/playground/models` | `src/routes/playground.route.ts` | 2h | Eng Lead |
| Mustache renderer + variable validator | `src/services/playground.service.ts` (existing) | 2h | Eng Lead |
| Playground E2E tests | `ui/e2e/playground.spec.ts` | 6h | Frontend Lead |

**Backend contract assumptions:**
- `POST /v1/playground/run` accepts `{ prompt_name, version_tag, model, variables, parameters }` and returns NDJSON stream.
- `GET /v1/playground/models` returns `PaginatedResponse<Model>`.

---

### Phase 3: A/B Testing + Evaluation Manager (Weeks 6–8)
**Goal**: Port complex modules requiring new backend endpoints; reuse UI trees.

| Module | Source (old) | Target (new) | Strategy | Effort |
|--------|-------------|--------------|----------|--------|
| `ABTestingTab` | `components/Playground/tabs/ABTestingTab.tsx` | `ui/src/components/playground/tabs/ABTestingTab.tsx` | React Query hooks | 6h |
| `CreateABTestModal` | `modules/ab-testing/components/CreateABTestModal.tsx` | `ui/src/components/ab-testing/CreateABTestModal.tsx` | shadcn Dialog + Zod | 8h |
| `ABTestResultModal` | `modules/ab-testing/components/ABTestResultModal.tsx` | `ui/src/components/ab-testing/ABTestResultModal.tsx` | Recharts cards | 8h |
| `EvaluationTab` | `components/Playground/tabs/EvaluationTab.tsx` | `ui/src/components/playground/tabs/EvaluationTab.tsx` | Adapt eval schema | 6h |
| `EvaluationManager` | `modules/evaluation/pages/EvaluationManager.tsx` | `ui/src/app/evaluations/page.tsx` | React Query + DashboardLayout | 10h |
| `CreateEvaluation` | `modules/evaluation/pages/CreateEvaluation.tsx` | `ui/src/app/evaluations/new/page.tsx` | Next.js routing + RHF + Zod | 8h |
| `CreateDataset` | `modules/evaluation/pages/CreateDataset.tsx` | `ui/src/app/evaluations/datasets/new/page.tsx` | Next.js routing | 6h |
| `VersionTimeline` | `components/Playground/VersionTimeline.tsx` | `ui/src/components/prompts/VersionTimeline.tsx` | `next/link` | 4h |

**Backend deliverables this phase:**
| Deliverable | Location | Effort | Owner |
|-------------|----------|--------|-------|
| A/B test statistical engine | `src/services/ab-test.engine.ts` | 10h | Eng Lead |
| `POST /v1/ab-tests` | `src/routes/ab-test.route.ts` | 4h | Eng Lead |
| `GET /v1/ab-tests/:id` (results) | `src/controllers/ab-test.controller.ts` | 4h | Eng Lead |
| `POST /v1/ab-tests/:id/promote` | `src/services/ab-test.service.ts` | 4h | Eng Lead |
| Dataset storage (SQLite table) | `migrations/012_*.ts` | 4h | Eng Lead |
| Rule-based eval engine v1 | `src/services/evaluation-rule.engine.ts` | 6h | Eng Lead |
| `POST /v1/evaluations/:id/run` | `src/routes/evaluation.route.ts` | 4h | Eng Lead |
| A/B Test + Evaluation E2E | `ui/e2e/ab-test.spec.ts`, `ui/e2e/evaluation.spec.ts` | 8h | Frontend Lead |

---

### Phase 4: Compliance + Polish (Weeks 9–10)
**Goal**: Ship compliance views, bundle audit, accessibility pass.

| Deliverable | Location | Notes | Effort |
|-------------|----------|-------|--------|
| `ComplianceQuickSummary` + `RiskDistributionCard` | `ui/src/components/compliance/*` | Tailwind token remap | 6h |
| `IntegrityBadge` | `ui/src/components/compliance/IntegrityBadge.tsx` | shadcn Badge variant | 2h |
| `ReviewPromptsPage` | `ui/src/app/compliance/page.tsx` | DashboardLayout wrapper | 4h |
| Bundle-size audit | `ui/next.config.*` | Dynamic imports for Monaco/modals/charts | 4h |
| Accessibility pass | All `ui/src/components/playground/*` | Keyboard traps, ARIA, focus | 6h |
| E2E coverage expansion | `ui/e2e/` | Playground, A/B Test, Evaluation | 8h |

**Backend deliverables this phase:**
| Deliverable | Location | Effort | Owner |
|-------------|----------|--------|-------|
| Compliance scoring engine v1 | `src/services/compliance.engine.ts` | 6h | Eng Lead |
| `GET /v1/compliance/score` | `src/routes/compliance.route.ts` | 2h | Eng Lead |
| `GET /v1/compliance/violations` | `src/controllers/compliance.controller.ts` | 2h | Eng Lead |
| Rule engine (PII, policy) | `src/services/compliance.rules.ts` | 4h | Eng Lead |

---

## 4. Stack Translation Cheatsheet

| Concern | Old Frontend | New Dashboard | Migration Notes |
|---------|-------------|---------------|-----------------|
| Framework | React 19 + Vite | Next.js 16 App Router | Use `'use client'` for interactive pages |
| Routing | React Router DOM v7 | Next.js file-system routing | Replace `<NavLink>` with `<Link>`; `useNavigate` → `useRouter` |
| Styling | Tailwind CSS v4 | Tailwind CSS v3 + shadcn/ui | Translate arbitrary v4 utilities to v3/shadcn tokens |
| State | Redux Toolkit + Persist | React Query + Zustand | Remove all `useDispatch` / `useSelector`; replace with `useQuery` / `useMutation` / Zustand |
| Forms | React Hook Form + Yup | React Hook Form + Zod | Translate Yup schemas to Zod |
| Charts | ApexCharts + Chart.js + Recharts | Recharts only | Standardize on Recharts; port configs |
| Tables | ag-grid-react | TanStack Table + shadcn | Headless logic + shadcn presentation |
| Editor | Monaco Editor | Monaco Editor | Same package; config portable |
| HTTP | Axios | Native `fetch` via `api.ts` | Replace all service files with calls to `api.ts` |
| Notifications | notistack + toastify + SweetAlert2 | Sonner (shadcn) | Consolidate to Sonner |
| Icons | Lucide + React Icons | Lucide only | Replace React Icons with Lucide equivalents |

---

## 5. Component Reuse Matrix

| Component | Strategy | Effort | Priority |
|-----------|----------|--------|----------|
| `PlaygroundLayout` + `EditorTab` | Adapt to Next.js; replace Redux with React Query + Zustand | L | P0 |
| `ModelSelector` | Direct reuse (pure UI); adapt styling to shadcn Select | S | P0 |
| `StreamingOutputPanel` | Adapt fetch logic to SSE stream | M | P0 |
| `VariableSetsPanel` | Adapt data layer; component tree reusable | M | P0 |
| `VersionTimeline` | Direct reuse; swap React Router links for Next.js Link | S | P1 |
| `ABTestingTab` + `CreateABTestModal` | Rewrite data layer; UI is 80% reusable | L | P1 |
| `EvaluationTab` + `EvaluationManager` | Rewrite data layer; adapt to new eval schema | L | P1 |
| `ComplianceQuickSummary` + `RiskDistributionCard` | Direct reuse with style adaptation | S | P2 |
| `AppLayout` (Sidebar + Header) | Do NOT reuse — new dashboard layout is superior | — | — |
| `DateRangePicker` | Direct reuse; wrap in shadcn Popover | S | P1 |
| `ConfirmModal` / `DiscardChangesModal` | Direct reuse; map to shadcn Dialog | S | P0 |
| `NestedObjectEditor` / `ResponseFormatEditor` | Direct reuse; no data-layer changes | S | P0 |
| `ParameterSchemaBuilder` | Direct reuse; used in playground for JSON schema editing | S | P0 |

---

## 6. Testing Strategy

### Unit Tests
- **Frontend**: Vitest (or Jest) for Zustand stores, API adapters, and pure UI helpers.
- **Backend**: Jest for provider adapters, statistical engine, compliance scorer.

### Integration Tests
- **Backend**: `supertest` against new `/v1/playground/run`, `/v1/ab-tests`, `/v1/evaluations` endpoints.
- **Contract tests**: Zod schemas on frontend must match backend Joi validation.

### E2E Tests
- **Playwright** for critical user flows:
  1. Open prompt in Playground → edit variables → run → see streaming output.
  2. Create A/B test → select dataset → run → view results → promote winner.
  3. Create evaluation → define criteria → run against dataset → view score trend.
- **Performance**: Lighthouse CI gates (Performance ≥ 70, bundle < 500 KB gzipped).

---

## 7. Performance Budget

| Metric | Budget | Enforcement |
|--------|--------|-------------|
| Initial JS (gzipped) | < 500 KB | `next build` output audit |
| Total JS (gzipped) | < 1.0 MB | Lighthouse CI |
| Playground TTI | < 1.5s | WebPageTest / Lighthouse |
| Dashboard TTI | < 2.0s | WebPageTest / Lighthouse |
| Monaco chunk | Lazy-loaded | `next/dynamic` with `ssr: false` |
| Modal chunks | Lazy-loaded | `next/dynamic` on all modals > 10 KB |

---

## 8. Rollback Plan

**Trigger conditions:**
- Dashboard bundle size exceeds 1.5 MB gzipped.
- Lighthouse Performance score drops below 70.
- Playground proxy introduces security vulnerability.
- Critical bug rate > 5% post-merge.

**Rollback actions:**
1. Disable lazy-loaded modules via feature flag (if implemented).
2. Revert `ui/` to last known good commit.
3. Keep backend endpoints deployed but return 503 with informational message.
4. Page on-call and schedule hotfix sprint.

---

## 9. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Old frontend has hidden coupling to its backend API shape | High | Medium | Audit every reused component for API calls; write adapter layer |
| Bundle size bloat from Monaco + ag-grid patterns | Medium | Medium | Lazy-load Monaco; dynamic imports for heavy modals |
| Style inconsistency between old Tailwind v4 and new v3 tokens | High | Low | Create mapping doc; use shadcn tokens as source of truth |
| Porting Redux logic is error-prone | Medium | High | Port one module at a time; write integration tests for each |
| LLM provider API changes break adapter | Medium | Medium | Pin provider SDK versions; adapter pattern isolates changes |
| Streaming timeout / memory leak on backend | Medium | High | 10-minute global timeout; AbortController propagation; max token limits |

---

## 10. Appendices

- **Old frontend source**: `~/Documents/pm-app-frontend/src/`
- **New dashboard source**: `/Users/izzy/Documents/pm-opensource/code/promptmetrics/ui/src/`
- **Backend API contract**: `ui/src/lib/api.ts` and `docs/openapi.yaml`
- **Design system**: `ui/src/components/ui/*` (shadcn/ui primitives)
- **Existing dashboard plan**: `docs/plans/observability-dashboard-implementation-plan.md`
- **PRD**: `docs/plans/frontend-reuse-prd.md`
- **Roadmap**: `docs/plans/frontend-reuse-roadmap.md`
