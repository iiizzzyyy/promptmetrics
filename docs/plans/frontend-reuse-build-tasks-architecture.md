# Frontend Reuse — Build Tasks (Architecture Track)

**Status:** Draft  
**Date:** 2026-04-29  
**Scope:** Architecture validation, integration test strategy, performance budgets, and risk mitigation for the PromptMetrics Playground MVP  
**Target Version:** 1.2.0  

---

## 1. Pre-Development Tasks

These tasks must complete before any feature code is written. They validate stack decisions, audit dependencies, and establish guardrails.

### Task P.1 — Dependency Audit and Stack Alignment
**Owner:** Frontend Lead  
**Effort:** 4 hours  
**Blocked by:** None  
**Deadline:** 2026-05-02

**Description:** Audit `ui/package.json` and `~/Documents/pm-app-frontend/package.json` for conflicts. Install proposed new dependencies and verify the build still passes.

**Acceptance criteria:**
- [ ] `npm install zustand @monaco-editor/react monaco-editor eventsource-parser` succeeds in `ui/`.
- [ ] `next build` in `ui/` completes with zero errors after adding new deps.
- [ ] `depcheck ui/` (or `npx depcheck`) reports no unused dependencies post-cleanup.
- [ ] A compatibility matrix is written in `ui/docs/DEPENDENCIES.md` listing old->new package mappings (e.g., `ag-grid-react` -> `@tanstack/react-table`, `yup` -> `zod`, `apexcharts` -> `recharts`).

**References:**
- Current `ui/package.json` (Tailwind v4, Next.js 16.2.4, React 19.2.4)
- Old frontend stack: React 19 + Vite + Tailwind v4 + Redux Toolkit + ag-grid-react + ApexCharts + Chart.js

---

### Task P.2 — shadcn/ui Component Gap Analysis
**Owner:** Frontend Lead  
**Effort:** 3 hours  
**Blocked by:** Task P.1  
**Deadline:** 2026-05-02

**Description:** Identify which shadcn/ui primitives are missing for the Playground, install them, and verify they compose correctly with Tailwind v4.

**Missing primitives expected:**
- `Resizable` — for Playground split-pane layout
- `Drawer` / `Sheet` — for `ModelConfigDrawer`
- `Slider` — for temperature/max_tokens parameters
- `Multi-select` — for tags (future, but verify availability)

**Acceptance criteria:**
- [ ] All missing primitives are installed via `npx shadcn add` (or equivalent for Next.js 16).
- [ ] Each primitive renders correctly in a test page (`ui/src/app/test-ui/page.tsx`).
- [ ] No CSS specificity conflicts between shadcn v4 tokens and existing `pm-*` tokens.
- [ ] Dark mode renders correctly for all new primitives.

**References:**
- Existing primitives: `ui/src/components/ui/table.tsx`, `ui/src/components/ui/card.tsx`

---

### Task P.3 — Zustand Store Scaffold and Conventions
**Owner:** Frontend Lead  
**Effort:** 2 hours  
**Blocked by:** Task P.1  
**Deadline:** 2026-05-02

**Description:** Create the `ui/src/stores/` directory, scaffold a reference Zustand store, and document conventions for when to use Zustand vs React Query vs `useState`.

**Acceptance criteria:**
- [ ] `ui/src/stores/playground.store.ts` exists with typed state for pane sizes, active tab, and selected model.
- [ ] `ui/src/stores/README.md` documents the decision matrix (server state = React Query, shared UI state = Zustand, local UI state = `useState`).
- [ ] A sample component consumes the store and renders correctly in dev mode.
- [ ] Store is **not** persisted to `localStorage` (by design — ephemeral tool state).

---

### Task P.4 — SSE Client Prototype
**Owner:** Eng Lead  
**Effort:** 4 hours  
**Blocked by:** Task P.1  
**Deadline:** 2026-05-03

**Description:** Build a minimal prototype of the SSE fetch parser in `ui/src/lib/streaming.ts` and verify it works against a mock Express SSE endpoint.

**Acceptance criteria:**
- [ ] `ui/src/lib/streaming.ts` exports a function `createSSEStream(url, headers)` that returns an `AsyncIterator` yielding parsed JSON chunks.
- [ ] Prototype connects to a mock Express route (`GET /__mock/sse`) that emits 10 events over 2 seconds.
- [ ] Browser renders each chunk in real time without memory leaks.
- [ ] AbortController cancellation is tested: closing the stream mid-flight stops the fetch and the mock generator.
- [ ] Document browser compatibility: Safari 14+, Chrome 90+, Firefox 90+.

**References:**
- Express SSE pattern: `res.writeHead(200, { 'Content-Type': 'text/event-stream' })`
- Existing fetch client: `ui/src/lib/api.ts`

---

### Task P.5 — Backend Proxy Skeleton
**Owner:** Eng Lead  
**Effort:** 4 hours  
**Blocked by:** None  
**Deadline:** 2026-05-03

**Description:** Create the stub `PlaygroundService`, `PlaygroundController`, and `playground.route.ts` with no actual provider integration. Wire into `src/app.ts`. Endpoint returns a hardcoded SSE stream.

**Acceptance criteria:**
- [ ] `POST /v1/playground/run` returns `200` with a mock SSE stream (3 hardcoded tokens + finish event).
- [ ] Route is protected by `authenticateApiKey` + `requireScope('playground:run')`.
- [ ] `tenantMiddleware` scopes mock response by workspace (echo `X-Workspace-Id` back in SSE metadata).
- [ ] Integration test in `tests/integration/playground.test.ts` verifies the mock stream shape.
- [ ] OpenAPI spec documents the stub endpoint.

**References:**
- Route mounting pattern: `src/app.ts` lines 49-58
- Auth middleware: `src/middlewares/promptmetrics-auth.middleware.ts`
- Existing route examples: `src/routes/promptmetrics-prompt.route.ts`

---

### Task P.6 — Monaco Editor Integration Test
**Owner:** Frontend Lead  
**Effort:** 3 hours  
**Blocked by:** Task P.1  
**Deadline:** 2026-05-03

**Description:** Verify Monaco Editor loads in Next.js 16 without SSR issues. Create a test page with a basic editor instance.

**Acceptance criteria:**
- [ ] `ui/src/app/test-monaco/page.tsx` renders Monaco with syntax highlighting for JSON.
- [ ] Editor loads via dynamic import (`next/dynamic`) to avoid SSR bundle bloat.
- [ ] No FOUC (flash of unstyled content) or layout shift on initial load.
- [ ] Bundle analysis confirms Monaco is split into a separate chunk (not in the initial ~180 KB).

---

## 2. Per-Phase Architecture Validation Checkpoints

### Phase 1: Foundation (Week 1)
**Goal:** Validate that the stack compiles, the proxy skeleton streams, and the store conventions are adopted.

| Checkpoint | Owner | Gate Criteria |
|------------|-------|---------------|
| **C1.1 Stack compiles** | Frontend Lead | `next build` passes; no new peer-dependency warnings; Lighthouse CI runs without errors |
| **C1.2 Proxy streams** | Eng Lead | `POST /v1/playground/run` mock returns SSE that the frontend prototype parses end-to-end |
| **C1.3 Auth gate** | Eng Lead | Calling `/v1/playground/run` without `playground:run` scope returns `403` |
| **C1.4 Store conventions** | Frontend Lead | At least one Zustand store and one React Query hook are used together in a test component without circular deps |
| **C1.5 Tailwind v4 parity** | Frontend Lead | All new shadcn primitives render identically in light and dark mode; no visual regressions on existing pages |

### Phase 2: Playground Shell (Week 2)
**Goal:** Validate the split-pane layout, editor integration, and model selector.

| Checkpoint | Owner | Gate Criteria |
|------------|-------|---------------|
| **C2.1 Resizable layout** | Frontend Lead | Playground page renders with a resizable editor/output split; sizes are stored in Zustand and survive tab switches but not refresh |
| **C2.2 Editor loads prompt** | Frontend Lead | `EditorTab` fetches a prompt via React Query and populates Monaco; Mustache syntax is highlighted |
| **C2.3 Model selector** | Frontend Lead | `ModelSelector` dropdown is populated from `GET /v1/playground/models`; selection is stored in Zustand |
| **C2.4 Drawer opens** | Frontend Lead | `ModelConfigDrawer` opens/closes with correct shadcn animation; form inputs update Zustand state |
| **C2.5 No Redux leakage** | Frontend Lead | `grep -r "useDispatch\|useSelector" ui/src/` returns zero matches (except in docs/comments) |

### Phase 3: Streaming Run (Week 3)
**Goal:** Validate the full run flow: proxy -> provider adapter -> SSE -> UI tokens.

| Checkpoint | Owner | Gate Criteria |
|------------|-------|---------------|
| **C3.1 Provider adapter** | Eng Lead | `PlaygroundService` can proxy to at least one real provider (OpenAI) with a test key; rate limiting works |
| **C3.2 Token streaming** | Eng Lead | Running a prompt streams tokens to the browser within 500 ms of provider first byte |
| **C3.3 Cost tracking** | Eng Lead | Each run is logged to `logs` table with correct `tokens_in`, `tokens_out`, `cost_usd` |
| **C3.4 Error mid-stream** | Eng Lead | Simulated provider error sends SSE error event; UI renders inline error and preserves partial output |
| **C3.5 Audit log** | Eng Lead | Every run appears in `/v1/audit-logs` with action `playground:run` and workspace scoping |
| **C3.6 Cancel run** | Frontend Lead | Clicking "Cancel" aborts the fetch and stops the SSE stream; backend closes provider connection |

### Phase 4: Variable Sets and Polish (Week 4)
**Goal:** Validate variable preset management, schema builder, and table integration.

| Checkpoint | Owner | Gate Criteria |
|------------|-------|---------------|
| **C4.1 Variable sets CRUD** | Frontend Lead | Create, edit, delete variable sets via modal; persisted to SQLite; React Query invalidates cache on mutation |
| **C4.2 Schema builder** | Frontend Lead | `ParameterSchemaBuilder` renders JSON schema editor in Monaco; schema validates with Zod |
| **C4.3 TanStack Table** | Frontend Lead | At least one page (Logs or Playground history) uses TanStack Table with sorting and pagination |
| **C4.4 Mobile layout** | Frontend Lead | Playground is usable at 768px width (stacked panels, collapsible sidebar) |
| **C4.5 Bundle budget** | Frontend Lead | `next build` analyzer shows dashboard bundle < 500 KB gzipped; Monaco is dynamically imported |

---

## 3. Integration Test Strategy

### 3.1 Backend Integration Tests

All new backend code must have integration tests in `tests/integration/playground.test.ts`. The existing pattern is `supertest` against the Express app with an in-memory SQLite database.

| Test Case | Setup | Assert |
|-----------|-------|--------|
| `POST /v1/playground/run` with valid key and scope | Create API key with `playground:run` scope; insert prompt | Returns `200`; response is SSE stream with `content-type: text/event-stream` |
| `POST /v1/playground/run` without scope | Create API key with only `prompts:read` scope | Returns `403` with message `Missing required scope: playground:run` |
| `POST /v1/playground/run` with wrong workspace | API key scoped to workspace A; call with `X-Workspace-Id: B` | Returns `401` (key does not belong to workspace) |
| `POST /v1/playground/run` stream abort | Start stream; abort client connection after 1 event | Backend does not crash; provider connection is closed cleanly |
| `GET /v1/playground/models` | Seed `workspace_provider_keys` and `workspace_models` | Returns array of models filtered by workspace |
| Variable sets CRUD | `POST /v1/playground/variable-sets`, then `GET`, `PATCH`, `DELETE` | All operations return correct shapes; workspace isolation enforced |

**References:**
- Test setup: `tests/env-setup.ts` (sets `API_KEY_SALT`, calls `initSchema()`)
- Existing integration test pattern: `tests/integration/metrics.test.ts`

### 3.2 Frontend Integration Tests

Use Playwright E2E tests (`ui/e2e/`) for user-facing flows. Add unit tests with `@testing-library/react` for component logic.

| Test Case | Type | Assert |
|-----------|------|--------|
| Playground page loads | E2E | Navigating to `/playground` renders editor, model selector, and run button |
| Run button triggers SSE | E2E | Clicking "Run" opens an SSE connection; tokens appear in output panel within 5 seconds (mock backend) |
| Cancel run stops stream | E2E | Clicking "Cancel" during a run stops token accumulation; "Run" button is re-enabled |
| Variable set modal | E2E | Opening modal, filling form, saving adds a new variable set badge |
| Model config drawer | E2E | Opening drawer, changing temperature, closing persists value in UI |
| Zustand store resets on refresh | Unit | Store state is not in `localStorage`; refreshing page resets active tab to `editor` |
| SSE parser handles malformed chunks | Unit | `streaming.ts` throws `StreamingError` on invalid SSE format without crashing React |
| Monaco editor value change | Unit | `EditorTab` calls `onChange` with updated prompt content |

**References:**
- Existing E2E tests: `ui/e2e/dashboard.spec.ts`
- Playwright config: `ui/playwright.config.ts` (assumed standard)

### 3.3 Contract Tests

Use `zod` on the frontend and `joi` on the backend to validate the same schemas.

| Shared Schema | Frontend (Zod) | Backend (Joi) |
|---------------|----------------|---------------|
| `PlaygroundRunRequest` | `ui/src/lib/schemas/playground.ts` | `src/validation-schemas/playground.schema.ts` |
| `PlaygroundRunResponse` | `ui/src/lib/schemas/playground.ts` | `src/validation-schemas/playground.schema.ts` |
| `VariableSet` | `ui/src/lib/schemas/variable-set.ts` | `src/validation-schemas/variable-set.schema.ts` |

**Validation checkpoint:** A script (`scripts/verify-schemas.ts`) extracts both Zod and Joi schemas, converts them to JSON Schema, and diffs them. The diff must be empty for CI to pass.

---

## 4. Performance Budget and Monitoring Setup

### 4.1 Bundle Budget

| Metric | Current Baseline | Target | Hard Limit |
|--------|-----------------|--------|------------|
| Dashboard initial JS (gzipped) | ~180 KB | < 350 KB | 500 KB |
| Dashboard total JS (gzipped) | ~180 KB | < 500 KB | 1.0 MB |
| Monaco chunk (gzipped) | N/A | < 300 KB | 500 KB |
| First Contentful Paint | ~1.2 s | < 1.5 s | 2.0 s |
| Time to Interactive | ~1.2 s | < 2.0 s | 3.0 s |
| Lighthouse Performance | ~85 | > 80 | 70 |

**Enforcement:**
- Add `@next/bundle-analyzer` to `ui/package.json` devDependencies.
- Run `ANALYZE=true next build` in CI and fail the build if any chunk exceeds its hard limit.
- Monitor `ui/.next/analyze/` artifacts in PRs.

### 4.2 Runtime Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| Playground initial render | < 1.5 s | Lighthouse on `/playground` |
| Time to first token (TTFT) | < 2.0 s | Backend `X-Response-Time` header + frontend timer |
| Token render latency | < 50 ms per token | React DevTools Profiler |
| Memory leak (30 min session) | < 50 MB growth | Chrome DevTools Memory tab |

### 4.3 Monitoring Setup

1. **OpenTelemetry spans** for the proxy:
   - Span name: `playground.run`
   - Attributes: `provider`, `model`, `stream`, `workspace_id`
   - Child span: `provider.request` (time to first byte from LLM provider)

2. **Backend metrics** (Prometheus-compatible):
   - `playground_requests_total` (counter, labeled by `provider`, `status`)
   - `playground_latency_seconds` (histogram, labeled by `provider`)
   - `playground_tokens_total` (counter, labeled by `provider`, `direction={in|out}`)

3. **Frontend vitals**:
   - Use `web-vitals` library to report CLS, LCP, FID to a backend endpoint (`POST /v1/vitals`).
   - This is optional for MVP but recommended for GA.

---

## 5. Risk Mitigation Tasks

### Risk R1: Monaco Editor Bundle Bloat
**Likelihood:** High  
**Impact:** High  
**Owner:** Frontend Lead

| Mitigation Task | Effort | Deadline |
|-----------------|--------|----------|
| M1.1: Configure Monaco webpack plugin to only bundle `json` and `text` languages | 2 hours | Week 1 |
| M1.2: Dynamic import Monaco in `EditorTab` with `next/dynamic` and `ssr: false` | 2 hours | Week 2 |
| M1.3: Bundle analyzer gate in CI (fail build if Monaco chunk > 500 KB) | 2 hours | Week 1 |

**Rollback:** If Monaco still exceeds budget, evaluate lighter editors (CodeMirror 6, Prism-powered textarea) in a spike task.

---

### Risk R2: Provider API Inconsistencies
**Likelihood:** High  
**Impact:** Medium  
**Owner:** Eng Lead

| Mitigation Task | Effort | Deadline |
|-----------------|--------|----------|
| M2.1: Build provider adapter interface (`IProviderAdapter`) with methods `streamChat()` and `completeChat()` | 4 hours | Week 1 |
| M2.2: Implement OpenAI adapter first; stub Anthropic/Google/Ollama adapters that return `501 Not Implemented` | 4 hours | Week 2 |
| M2.3: Unit-test each adapter against recorded provider responses (use `nock` for HTTP mocking) | 4 hours | Week 3 |
| M2.4: Document provider-specific rate limits and context lengths in `docs/playground-providers.md` | 2 hours | Week 2 |

**References:**
- Backend `nock` usage pattern: existing GitHub driver tests

---

### Risk R3: SSE Streaming Failures in Production (Proxy Buffering)
**Likelihood:** Medium  
**Impact:** High  
**Owner:** Eng Lead

| Mitigation Task | Effort | Deadline |
|-----------------|--------|----------|
| M3.1: Explicitly set `res.setHeader('X-Accel-Buffering', 'no')` and `Cache-Control: no-cache` in PlaygroundController | 1 hour | Week 2 |
| M3.2: Test SSE through a local nginx reverse proxy (common production setup) | 2 hours | Week 3 |
| M3.3: Add fallback: if SSE fails, automatically retry with `stream=false` and show full response after loading spinner | 3 hours | Week 3 |

---

### Risk R4: State Management Confusion (Zustand vs React Query)
**Likelihood:** Medium  
**Impact:** Medium  
**Owner:** Frontend Lead

| Mitigation Task | Effort | Deadline |
|-----------------|--------|----------|
| M4.1: Write `ui/src/stores/README.md` with clear rules and examples | 1 hour | Week 1 |
| M4.2: Code review checklist item: "Did you put server state in React Query?" | 0.5 hours | Ongoing |
| M4.3: ESLint custom rule (optional) that warns on `useQuery` keys that look like UI state | 2 hours | Week 2 |

---

### Risk R5: Old Frontend Coupling Leakage
**Likelihood:** High  
**Impact:** Medium  
**Owner:** Frontend Lead

| Mitigation Task | Effort | Deadline |
|-----------------|--------|----------|
| M5.1: Audit every ported file for old API calls (`axios`, `fetch` to old backend URLs) | 2 hours | Week 2 |
| M5.2: Create `ui/src/lib/api-adapter.ts` — a single file where any legacy API shape translation happens | 2 hours | Week 2 |
| M5.3: Ban direct `fetch` outside `ui/src/lib/api.ts` via ESLint | 1 hour | Week 1 |

---

### Risk R6: Workspace Scoping Leakage in Proxy
**Likelihood:** Low  
**Impact:** High  
**Owner:** Eng Lead

| Mitigation Task | Effort | Deadline |
|-----------------|--------|----------|
| M6.1: Integration test verifies that Workspace A's provider key is never used for Workspace B | 2 hours | Week 3 |
| M6.2: Code review: PlaygroundService must read `req.workspaceId` and look up keys scoped to that workspace only | 0.5 hours | Ongoing |
| M6.3: Add `workspace_id` column to `logs` table for playground runs and assert it matches the request | 1 hour | Week 3 |

---

## 6. Rollback and Recovery Plan

### Build-Level Rollback
If the Playground branch destabilizes the dashboard:
1. The `legacy-ui` branch (from Observability Dashboard cutover) preserves the pre-Playground dashboard.
2. Revert `ui/src/app/playground/` and `ui/src/components/playground/` directories.
3. Revert `src/routes/playground.route.ts` mount in `src/app.ts`.
4. Tag a patch release (`v1.1.1-hotfix`) without Playground.

### Feature Flag (Optional but Recommended)
If the deployment pipeline supports it, wrap the Playground nav item and route behind an environment variable:
```typescript
// ui/src/components/layout/AdminSidebar.tsx
const showPlayground = process.env.NEXT_PUBLIC_PLAYGROUND_ENABLED === 'true';
```
This allows disabling the feature without a code revert.

---

## 7. Documentation Deliverables

| Document | Owner | Deadline | Location |
|----------|-------|----------|----------|
| Stack alignment decision record | Frontend Lead | 2026-05-02 | This file (Section 1, ADR-001–004) |
| Playground API contract | Eng Lead | 2026-05-05 | `docs/openapi.yaml` + `ui/src/lib/api.ts` |
| Provider adapter guide | Eng Lead | 2026-05-10 | `docs/playground-providers.md` |
| State management conventions | Frontend Lead | 2026-05-02 | `ui/src/stores/README.md` |
| Security runbook | Eng Lead | 2026-05-10 | `docs/security/playground-proxy.md` |
| Performance budget report | Frontend Lead | 2026-05-17 | CI artifact + `ui/docs/PERFORMANCE.md` |
