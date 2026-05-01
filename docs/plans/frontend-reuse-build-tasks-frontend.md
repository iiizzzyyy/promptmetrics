# Frontend Reuse Build Tasks
**Project**: PromptMetrics Dashboard — Frontend Port from PromptSmith Legacy
**Target Quarter**: Q2 2026
**Owner**: Frontend Lead (primary), Eng Lead (backend proxy), Design Lead (UX review)
**Last Updated**: 2026-04-29

---

## Legend

| Field | Description |
|-------|-------------|
| **Task ID** | Unique identifier (FE-1.1, FE-2.3, etc.) |
| **Title** | Concise deliverable name |
| **Description** | What needs to be built, ported, or adapted |
| **Effort** | Estimated hours (S=1-4h, M=5-12h, L=13-24h, XL=25-40h) |
| **Dependencies** | Task IDs that must complete before this one starts |
| **Owner** | Primary accountable role |
| **Acceptance Criteria** | Measurable, testable conditions for sign-off |

---

## Phase 1: Foundation (Weeks 1–2)
**Goal**: Align the stack, extend shadcn/ui, and establish the API adapter layer.

### FE-1.1 Install and configure new runtime dependencies
| Field | Value |
|-------|-------|
| **Title** | Install Zustand, RHF, Zod, Sonner, Monaco, date-fns |
| **Description** | Add production dependencies to `ui/package.json`. Ensure no version conflicts with existing React 19 / Next.js 16.2.4. Configure `react-hook-form` resolvers for Zod. Set up `sonner` in the root layout (`ui/src/app/layout.tsx`). Verify Monaco webpack config is compatible with Next.js Turbopack or fallback to webpack. |
| **Effort** | 4h |
| **Dependencies** | — |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. `npm install` succeeds with zero peer-dep warnings. 2. `sonner` renders a test toast on the dashboard. 3. `zodResolver` can validate a test form. 4. Monaco lazy-loads without SSR errors. |

### FE-1.2 Extend shadcn/ui primitive library
| Field | Value |
|-------|-------|
| **Title** | Add Drawer, Resizable, Calendar, Popover, Textarea, Slider, Toggle Group |
| **Description** | Run `npx shadcn add drawer resizable calendar popover textarea slider toggle-group`. Ensure each new primitive renders correctly inside `DashboardLayout`. Add custom `Badge` variants (`success`, `warning`, `danger`) to `ui/src/components/ui/badge.tsx`. Verify `tailwind.config.ts` picks up new CSS variables. |
| **Effort** | 8h |
| **Dependencies** | FE-1.1 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. All 8 primitives render in a single test page without console errors. 2. `Badge` variants match old frontend semantic colors (green=success, amber=warning, red=danger). 3. `Resizable` panels remember size across soft navigation (use `localStorage` or Zustand). |

### FE-1.3 Create Zustand client-state stores
| Field | Value |
|-------|-------|
| **Title** | Build `usePlaygroundStore` and `useUIStore` |
| **Description** | Create `ui/src/stores/playground.store.ts` for session-scoped state: panel sizes, active tab, draft prompt sections, selected model, variable sets. Create `ui/src/stores/ui.store.ts` for global UI state: sidebar open/close, modal stack, toast queue. Both stores must use `persist` middleware with `localStorage` namespacing (`pm-playground-v1`, `pm-ui-v1`). |
| **Effort** | 6h |
| **Dependencies** | FE-1.1 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Store state survives page reload. 2. Multiple store instances do not collide (namespace tested). 3. Playground panel sizes restore from persistence within 50ms. 4. No Redux imports remain in new store files. |

### FE-1.4 Build Playground API adapter layer
| Field | Value |
|-------|-------|
| **Title** | Extend `api.ts` with Playground endpoints |
| **Description** | Create `ui/src/lib/playground-api.ts` that wraps `ui/src/lib/api.ts`'s `fetchJson`. Implement `getPlaygroundModels()`, `runPlayground(payload)`, and `getPlaygroundRuns()`. The `runPlayground` function must return a `ReadableStream` reader for SSE-style consumption. Ensure workspace scoping (`X-Workspace-Id`) and API key headers are forwarded. |
| **Effort** | 8h |
| **Dependencies** | FE-1.1 |
| **Owner** | Eng Lead |
| **Acceptance Criteria** | 1. `runPlayground` returns a valid `Response.body.getReader()`. 2. All endpoints inject `X-API-Key` and `X-Workspace-Id`. 3. TypeScript types exported for `PlaygroundRunPayload`, `PlaygroundRunResponse`, `PlaygroundModel`. 4. Unit test covers 401/403 error paths. |

### FE-1.5 Port pure UI helpers (ConfirmModal, DiscardChangesModal, DateRangePicker)
| Field | Value |
|-------|-------|
| **Title** | Port ConfirmModal, DiscardChangesModal, DateRangePicker |
| **Description** | Copy-adapt `~/Documents/pm-app-frontend/src/components/Common/ConfirmModal.tsx` and `DateRangePicker.tsx` into `ui/src/components/common/`. Map old custom `Modal` to shadcn `Dialog`. Map old `react-date-range` to shadcn `Calendar` + `Popover`. Ensure all Lucide icons are used; remove React Icons. |
| **Effort** | 8h |
| **Dependencies** | FE-1.2 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. `ConfirmModal` traps focus and returns focus to trigger on close. 2. `DateRangePicker` selects a range, shows it in the button, and clears on "Clear". 3. Zero React Icons imports in `ui/src/components/common/`. 4. Keyboard navigation works for both components (axe-core scan passes). |

### FE-1.6 Set up dynamic-import boundaries for heavy assets
| Field | Value |
|-------|-------|
| **Title** | Configure lazy loading for Monaco, modals, and chart modals |
| **Description** | Create `ui/src/components/lazy/index.ts` with `next/dynamic` wrappers for Monaco Editor, `ParameterSchemaBuilder`, `ABTestResultModal`, and `CreateABTestModal`. Ensure each wrapper has `ssr: false` where needed. Add a reusable `LazyLoadBoundary` component that shows `Skeleton` while loading. |
| **Effort** | 4h |
| **Dependencies** | FE-1.1 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Network tab shows separate chunks for Monaco and modals. 2. `LazyLoadBoundary` renders `Skeleton` for 200ms+ loads. 3. No hydration mismatch errors in dev console. 4. Lighthouse "Avoid enormous network payloads" passes for `/playground`. |

### FE-1.7 Port NestedObjectEditor and ResponseFormatEditor
| Field | Value |
|-------|-------|
| **Title** | Port NestedObjectEditor and ResponseFormatEditor |
| **Description** | Copy-adapt `~/Documents/pm-app-frontend/src/components/Playground/helpers/NestedObjectEditor.tsx` and `ResponseFormatEditor.tsx` into `ui/src/components/playground/helpers/`. Remove old `Button` import; use shadcn `Button`. Ensure `PropertyForm` and `PropertyList` sub-components are co-located. No data-layer changes required. |
| **Effort** | 6h |
| **Dependencies** | FE-1.2 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Editors render nested properties and response format types correctly. 2. Add/remove property buttons work with keyboard. 3. No Redux or Axios imports remain. 4. Visual regression snapshot matches old component within 5% pixel diff. |

### FE-1.8 Port ParameterSchemaBuilder
| Field | Value |
|-------|-------|
| **Title** | Port ParameterSchemaBuilder |
| **Description** | Copy-adapt `~/Documents/pm-app-frontend/src/components/Playground/helpers/ParameterSchemaBuilder.tsx` into `ui/src/components/playground/ParameterSchemaBuilder.tsx`. Wrap in `next/dynamic` with `ssr: false` due to heavy recursive rendering. Ensure schema validation still works with pure JSON logic. |
| **Effort** | 6h |
| **Dependencies** | FE-1.2, FE-1.6 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Can build a valid JSON schema with nested objects. 2. Exports schema as JSON. 3. Loads in a separate chunk (<100KB). 4. No console warnings on mount. |

---

## Phase 2: Playground MVP (Weeks 3–5)
**Goal**: Port the 8 core playground components and wire them to the new backend proxy.

### FE-2.1 Port PlaygroundLayout with Resizable panels
| Field | Value |
|-------|-------|
| **Title** | Port PlaygroundLayout with shadcn Resizable |
| **Description** | Create `ui/src/components/playground/PlaygroundLayout.tsx`. Replace old CSS grid split-pane with `ResizablePanelGroup` (horizontal: sidebar 25% / editor+output 75%; vertical: editor 60% / output 40%). Integrate `TemplateSidebar` stub. Remove `AppLayout` wrapper; use `DashboardLayout` from `ui/src/components/layout/DashboardLayout.tsx`. Remove `useNavigate`; use Next.js `useRouter` only for external navigation (e.g., "Back to prompts"). |
| **Effort** | 12h |
| **Dependencies** | FE-1.2, FE-1.3 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Panels resize smoothly via mouse and keyboard. 2. Panel sizes persist in Zustand store. 3. Layout renders within 1.5s on a 2023 MacBook Air (Lighthouse TTI < 2s). 4. No horizontal scrollbars at 1280px width. |

### FE-2.2 Port EditorTab with Monaco
| Field | Value |
|-------|-------|
| **Title** | Port EditorTab with Monaco Editor |
| **Description** | Create `ui/src/components/playground/tabs/EditorTab.tsx`. Wrap Monaco in `React.Suspense`. Accept `messages` (system/user array) and `onChange` props. Implement Mustache variable highlighting via custom Monarch tokenizer or simple regex decoration. Remove old Redux `connect` pattern. Ensure editor height fills `ResizablePanel`. |
| **Effort** | 14h |
| **Dependencies** | FE-1.6, FE-2.1 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Monaco loads on demand (<500ms after user clicks "Playground" nav). 2. System and user messages render in distinct sections. 3. Typing updates parent state within 16ms. 4. Syntax highlighting for JSON and Mustache works. 5. No `Content Security Policy` errors from Monaco worker. |

### FE-2.3 Port ModelSelector and ModelConfigDrawer
| Field | Value |
|-------|-------|
| **Title** | Port ModelSelector and ModelConfigDrawer |
| **Description** | Create `ui/src/components/playground/ModelSelector.tsx` using shadcn `Select`. Create `ui/src/components/playground/ModelConfigDrawer.tsx` using shadcn `Drawer` + `Slider` (temperature) + `Input` (max_tokens, top_p). Populate models via `useQuery` hitting `GET /v1/playground/models`. Remove old `onOpenDrawer` prop pattern; use Zustand `setDrawerOpen(true)`. |
| **Effort** | 10h |
| **Dependencies** | FE-1.4, FE-2.1 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Selector shows provider icon + name + model name. 2. Drawer opens/closes with `Ctrl/Cmd + Shift + M` shortcut. 3. Temperature slider updates state in real time. 4. Config values persist in Zustand store. 5. Models list refreshes every 5 minutes (`staleTime: 5 * 60 * 1000`). |

### FE-2.4 Port StreamingOutputPanel
| Field | Value |
|-------|-------|
| **Title** | Port StreamingOutputPanel with native fetch |
| **Description** | Create `ui/src/components/playground/StreamingOutputPanel.tsx`. Replace Axios streaming with native `fetch` + `ReadableStream` reader against `/v1/runs/{runId}/stream` (or `/v1/playground/run` if SSE). Keep tool-call card rendering, copy-to-clipboard, and metrics footer. Auto-scroll to bottom on new tokens. Add `aria-live="polite"` for screen readers. |
| **Effort** | 12h |
| **Dependencies** | FE-1.4, FE-2.1 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Streamed tokens appear within 200ms of first chunk. 2. Auto-scroll stays pinned to bottom unless user manually scrolls up (>100px from bottom). 3. Copy button copies full output to clipboard. 4. Metrics footer renders latency, cost, and risk level. 5. AbortController cancels fetch on unmount. |

### FE-2.5 Port VariableSetsPanel and VariableSetModal
| Field | Value |
|-------|-------|
| **Title** | Port VariableSetsPanel and VariableSetModal |
| **Description** | Create `ui/src/components/playground/VariableSetsPanel.tsx` and `VariableSetModal.tsx`. Remove Redux `useSelector(getUserData)`; replace with workspace permission prop from parent. Use shadcn `Collapsible` for the panel. Use shadcn `Dialog` + `Form` + Zod for the modal. Variable sets are stored in Zustand `usePlaygroundStore` (not persisted to backend yet). |
| **Effort** | 10h |
| **Dependencies** | FE-1.3, FE-1.5, FE-2.1 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Add/duplicate/delete variable sets works without page reload. 2. Modal validates variable names are non-empty and unique. 3. Panel collapses/expands with keyboard. 4. History button opens a placeholder history view. 5. Empty state matches old frontend illustration style (Lucide icon + text). |

### FE-2.6 Integrate Playground page route
| Field | Value |
|-------|-------|
| **Title** | Wire Playground page in Next.js App Router |
| **Description** | Create `ui/src/app/playground/page.tsx`. Compose `DashboardLayout` > `PlaygroundLayout` > `EditorTab` + `StreamingOutputPanel` + `VariableSetsPanel` + `ModelSelector`. Fetch prompt list on mount via `useQuery` (`api.getPrompts`). Pre-populate editor if `?prompt=name` query param is present. Add nav item to `AdminSidebar` (`ui/src/components/layout/AdminSidebar.tsx`). |
| **Effort** | 8h |
| **Dependencies** | FE-2.1, FE-2.2, FE-2.3, FE-2.4, FE-2.5 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. `/playground` loads without 404. 2. `?prompt=my-prompt` pre-populates editor with prompt content. 3. Nav item highlights when active. 4. Page title is "Playground | PromptMetrics". 5. Playwright E2E `playground.spec.ts` passes (create in FE-2.8). |

### FE-2.7 Backend proxy endpoint for playground run
| Field | Value |
|-------|-------|
| **Title** | Implement `POST /v1/playground/run` proxy endpoint |
| **Description** | Add route/controller/service in the main PromptMetrics backend (`src/routes/`, `src/controllers/`, `src/services/`). Endpoint accepts `{ prompt_name, version_tag, model, variables, parameters }`, validates API key + workspace scope, proxies to OpenAI/Anthropic/etc. using workspace-scoped provider keys, and streams the response back as SSE or chunked JSON. Log cost/latency tokens to existing metrics pipeline. |
| **Effort** | 16h |
| **Dependencies** | — |
| **Owner** | Eng Lead |
| **Acceptance Criteria** | 1. Endpoint returns 200 with stream for valid requests. 2. Returns 402 if workspace has no provider key configured. 3. Returns 403 if API key lacks `playground:run` scope. 4. Latency from request to first chunk < 150ms (backend only). 5. Cost and tokens are written to the `runs` table. |

### FE-2.8 E2E test suite for Playground
| Field | Value |
|-------|-------|
| **Title** | Write Playwright E2E for Playground MVP |
| **Description** | Create `ui/e2e/playground.spec.ts`. Tests: load page, select prompt, edit variables, choose model, click Run, observe streamed output, verify metrics footer. Seed demo data via `src/scripts/seed-demo-data.ts` or MSW handlers. Run against `localhost:3001` with `NEXT_PUBLIC_DEMO_API_KEY`. |
| **Effort** | 8h |
| **Dependencies** | FE-2.6, FE-2.7 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. E2E spec passes in CI (Ubuntu + Chromium). 2. Screenshots captured for visual regression baseline. 3. Test covers error state (no API key). 4. Test runs in < 30s total. |

---

## Phase 3: A/B Testing + Evaluation Manager (Weeks 6–8)
**Goal**: Port complex modules that require new backend endpoints but have highly reusable UI trees.

### FE-3.1 Port ABTestingTab
| Field | Value |
|-------|-------|
| **Title** | Port ABTestingTab for Playground |
| **Description** | Create `ui/src/components/playground/tabs/ABTestingTab.tsx`. Replace Redux data selectors with `useQuery` hooks (`GET /v1/ab-tests`). Keep old tab interaction logic (select baseline, select challenger, choose metric). Use shadcn `Tabs` primitive for sub-navigation inside the tab. |
| **Effort** | 10h |
| **Dependencies** | FE-1.3, FE-2.1 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Lists active and completed A/B tests. 2. Selecting baseline/challenger updates Zustand store. 3. No Redux imports remain. 4. Renders empty state when no tests exist. |

### FE-3.2 Port CreateABTestModal
| Field | Value |
|-------|-------|
| **Title** | Port CreateABTestModal |
| **Description** | Create `ui/src/components/ab-testing/CreateABTestModal.tsx`. Map old form to react-hook-form + Zod. Fields: name, baseline version, challenger version, dataset, success metric, sample size. Submit via `POST /v1/ab-tests`. Wrap in `next/dynamic` for lazy load. |
| **Effort** | 10h |
| **Dependencies** | FE-1.5, FE-3.1 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Form validates all required fields. 2. Submit creates test and invalidates `ab-tests` query cache. 3. Success toast shown; modal closes. 4. Error states show server messages inline. 5. Loads in a separate JS chunk. |

### FE-3.3 Port ABTestResultModal
| Field | Value |
|-------|-------|
| **Title** | Port ABTestResultModal with Recharts |
| **Description** | Create `ui/src/components/ab-testing/ABTestResultModal.tsx`. Port old ApexCharts configs to Recharts (`BarChart` for win rate, `LineChart` for metric delta over time). Display p-value, confidence interval, and "Promote Winner" CTA. CTA calls `POST /v1/ab-tests/:id/promote`. |
| **Effort** | 10h |
| **Dependencies** | FE-3.2 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Recharts render win rate and delta charts correctly. 2. Statistical significance badge shows when p < 0.05. 3. "Promote Winner" button disabled until test status === "completed". 4. Promotion invalidates prompt version cache. |

### FE-3.4 Backend endpoints for A/B Testing
| Field | Value |
|-------|-------|
| **Title** | Implement `/v1/ab-tests/*` endpoints |
| **Description** | Add `POST /v1/ab-tests`, `GET /v1/ab-tests`, `GET /v1/ab-tests/:id`, and `POST /v1/ab-tests/:id/promote`. Store tests in SQLite (`ab_tests` table). Compute win rate and p-value in the service layer. Scope all queries by `workspace_id`. |
| **Effort** | 18h |
| **Dependencies** | — |
| **Owner** | Eng Lead |
| **Acceptance Criteria** | 1. All endpoints return 422 with `details` array on validation failure. 2. Promote endpoint updates `prompts.version_tag` and writes audit log. 3. List endpoint supports pagination. 4. Statistical calculation is accurate (unit-tested against known datasets). |

### FE-3.5 Port EvaluationTab
| Field | Value |
|-------|-------|
| **Title** | Port EvaluationTab for Playground |
| **Description** | Create `ui/src/components/playground/tabs/EvaluationTab.tsx`. Replace Redux data with `useQuery` (`GET /v1/evaluations`). Adapt UI to new eval schema (criteria JSON structure may differ). Keep old "Run Eval" button that opens a confirmation dialog. |
| **Effort** | 10h |
| **Dependencies** | FE-1.3, FE-2.1 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Lists evaluations linked to the current prompt. 2. "Run Eval" triggers `POST /v1/evaluations/:id/run`. 3. Loading spinner shows during run. 4. Results appear without page reload (React Query invalidation). |

### FE-3.6 Port EvaluationManager page
| Field | Value |
|-------|-------|
| **Title** | Port EvaluationManager into Next.js page |
| **Description** | Create `ui/src/app/evaluations/page.tsx` from `~/Documents/pm-app-frontend/src/modules/evaluation/pages/EvaluationManager.tsx`. Replace Redux with React Query. Wrap in `DashboardLayout`. Use shadcn `Table` + `Skeleton` for loading states. Add nav item to `AdminSidebar`. |
| **Effort** | 12h |
| **Dependencies** | FE-3.5 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. `/evaluations` loads paginated list. 2. Search/filter by prompt name works client-side. 3. Clicking "New Evaluation" navigates to `/evaluations/new`. 4. Zero Redux imports. 5. Lighthouse score > 90 for Performance and Accessibility. |

### FE-3.7 Port CreateEvaluation and CreateDataset pages
| Field | Value |
|-------|-------|
| **Title** | Port CreateEvaluation and CreateDataset flows |
| **Description** | Create `ui/src/app/evaluations/new/page.tsx` and `ui/src/app/evaluations/datasets/new/page.tsx`. Port old modal forms into full-page forms. Use react-hook-form + Zod. CreateDataset allows CSV upload or manual row entry. Both submit via `api.ts` wrappers. |
| **Effort** | 14h |
| **Dependencies** | FE-3.6 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. CreateEvaluation form validates criteria JSON. 2. CreateDataset accepts CSV < 5MB. 3. Both pages redirect to `/evaluations` on success. 4. Error toasts shown on 4xx/5xx. 5. Forms are keyboard-navigable. |

### FE-3.8 Backend endpoints for Evaluation Manager
| Field | Value |
|-------|-------|
| **Title** | Implement `/v1/evaluations/*` and dataset storage |
| **Description** | Add `POST /v1/evaluations`, `GET /v1/evaluations`, `POST /v1/evaluations/:id/run`, `GET /v1/evaluations/:id/results`. Add `datasets` table in SQLite with `workspace_id` scoping. Implement eval runner service (v1 can be heuristic-based; v2 may use LLM-as-judge). |
| **Effort** | 20h |
| **Dependencies** | — |
| **Owner** | Eng Lead |
| **Acceptance Criteria** | 1. Eval run stores results in `evaluation_results` table. 2. Results endpoint returns trend data compatible with `ScoreTrendChart`. 3. Dataset rows are validated on upload. 4. Workspace-scoping enforced on all endpoints. |

### FE-3.9 E2E test suite for A/B Testing and Evaluation
| Field | Value |
|-------|-------|
| **Title** | Write Playwright E2E for A/B Tests and Evaluations |
| **Description** | Create `ui/e2e/ab-testing.spec.ts` and `ui/e2e/evaluation.spec.ts`. Cover create, view results, promote winner (A/B), and create eval, create dataset, attach, run, view results (Evaluation). Seed demo data before each run. |
| **Effort** | 10h |
| **Dependencies** | FE-3.4, FE-3.8, FE-3.3, FE-3.7 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Both specs pass in CI. 2. Visual regression baselines committed. 3. Promote winner updates prompt version end-to-end. 4. Eval run produces a score trend chart. |

---

## Phase 4: Compliance + Polish (Weeks 9–10)
**Goal**: Ship compliance views, perform bundle-size audit, and polish accessibility.

### FE-4.1 Port ComplianceQuickSummary and RiskDistributionCard
| Field | Value |
|-------|-------|
| **Title** | Port ComplianceQuickSummary and RiskDistributionCard |
| **Description** | Create `ui/src/components/compliance/ComplianceQuickSummary.tsx` and `RiskDistributionCard.tsx`. Direct UI port from `~/Documents/pm-app-frontend/src/components/Compliance/`. Map old Tailwind tokens to shadcn tokens. Use `Badge` variants for severity. |
| **Effort** | 8h |
| **Dependencies** | FE-1.2 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Cards render risk score, distribution bars, and violation counts. 2. Color coding matches severity (critical=destructive, warning=warning, info=info). 3. Responsive at 768px and 1440px. 4. Screen reader announces score as `aria-label`. |

### FE-4.2 Port IntegrityBadge and ReviewPromptsPage
| Field | Value |
|-------|-------|
| **Title** | Port IntegrityBadge and ReviewPromptsPage |
| **Description** | Create `ui/src/components/compliance/IntegrityBadge.tsx` (shadcn `Badge` variant). Create `ui/src/app/compliance/page.tsx` that composes `ComplianceQuickSummary`, `RiskDistributionCard`, and a paginated prompt list. Wrap in `DashboardLayout`. Add nav item to `AdminSidebar`. |
| **Effort** | 8h |
| **Dependencies** | FE-4.1 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. `/compliance` loads without errors. 2. Prompt list is workspace-scoped. 3. Clicking a prompt opens detail drawer (placeholder if detail page not ready). 4. Nav item highlights when active. |

### FE-4.3 Backend endpoints for Compliance dashboard
| Field | Value |
|-------|-------|
| **Title** | Implement `/v1/compliance/score` and `/v1/compliance/violations` |
| **Description** | Add `GET /v1/compliance/score` (aggregate score per prompt) and `GET /v1/compliance/violations` (list with severity). v1 rule engine can be regex/heuristic-based. Write results to `compliance_scores` and `compliance_violations` tables. |
| **Effort** | 14h |
| **Dependencies** | — |
| **Owner** | Eng Lead |
| **Acceptance Criteria** | 1. Score endpoint returns 0-100 numeric score + breakdown. 2. Violations endpoint supports filtering by severity and prompt_name. 3. Rule engine runs in < 500ms for 100 prompts. 4. Audit log entry written on every rule run. |

### FE-4.4 Bundle-size audit and code-splitting pass
| Field | Value |
|-------|-------|
| **Title** | Audit bundle size and enforce lazy loading |
| **Description** | Run `next-bundle-analyzer`. Identify shared chunks >200KB. Move any playground-only dependencies out of the main layout chunk. Verify dynamic imports for Monaco, modals, and compliance charts. Add `scripts/bundle-budget.sh` to CI. |
| **Effort** | 6h |
| **Dependencies** | FE-2.6, FE-3.6, FE-4.2 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Total dashboard bundle < 500KB gzipped. 2. No single chunk > 250KB gzipped. 3. Monaco loads on demand only when visiting `/playground`. 4. CI fails if budget is exceeded. |

### FE-4.5 Accessibility pass across all ported components
| Field | Value |
|-------|-------|
| **Title** | Accessibility audit and remediation |
| **Description** | Run `axe-core` via Playwright on `/playground`, `/evaluations`, `/compliance`. Fix keyboard traps, missing labels, and low-contrast text. Ensure `prefers-reduced-motion` is respected. Add `aria-live` regions for streaming output and async toasts. |
| **Effort** | 8h |
| **Dependencies** | FE-2.6, FE-3.6, FE-4.2 |
| **Owner** | Design |
| **Acceptance Criteria** | 1. axe-core returns zero critical or serious violations on all three pages. 2. All interactive elements reachable via keyboard. 3. Focus indicators visible on all focusable elements. 4. Color contrast ratios > 4.5:1. |

### FE-4.6 VersionTimeline port and Prompts nav integration
| Field | Value |
|-------|-------|
| **Title** | Port VersionTimeline and integrate with Prompts page |
| **Description** | Create `ui/src/components/prompts/VersionTimeline.tsx`. Replace `useNavigate` with `next/link`. Render on a new or existing `/prompts/[name]/versions` page. Keep vertical timeline markup and commit SHA badges. |
| **Effort** | 6h |
| **Dependencies** | FE-1.2 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. Timeline renders versions in chronological order. 2. Clicking a version navigates to prompt detail. 3. Uses Next.js `Link` for client-side navigation. 4. Responsive layout at 768px. |

### FE-4.7 Final E2E sweep and visual regression update
| Field | Value |
|-------|-------|
| **Title** | Final E2E sweep and visual regression baselines |
| **Description** | Run full Playwright suite (`ui/e2e/*`). Update snapshots where intentional UI changes occurred. Fix flaky tests (timeouts, race conditions). Add test for compliance page load. |
| **Effort** | 6h |
| **Dependencies** | FE-4.2, FE-4.5, FE-3.9, FE-2.8 |
| **Owner** | Frontend Lead |
| **Acceptance Criteria** | 1. All E2E specs pass on CI with > 95% stability. 2. Visual regression baselines committed for Linux. 3. No console errors (warnings allowed < 5). 4. Coverage report shows > 80% of new components touched by E2E. |

---

## Gantt-Style Ordering and Parallel Workstreams

### Workstream A: Frontend Components (Frontend Lead)
```
Week 1:  [FE-1.1][FE-1.2][FE-1.3][FE-1.5][FE-1.6][FE-1.7][FE-1.8]
Week 2:  [FE-1.4====================]  (blocked on backend, can start scaffolding)
Week 3:  [FE-2.1=======][FE-2.2========]
Week 4:  [FE-2.3=====][FE-2.4==========][FE-2.5========]
Week 5:  [FE-2.6========]   [FE-2.8========]
Week 6:  [FE-3.1========][FE-3.2========]
Week 7:  [FE-3.5========][FE-3.6==========][FE-3.7==========]
Week 8:  [FE-3.3========]      [FE-3.9==========]
Week 9:  [FE-4.1========][FE-4.2========][FE-4.4========]
Week 10: [FE-4.5========][FE-4.6========][FE-4.7========]
```

### Workstream B: Backend APIs (Eng Lead)
```
Week 1-2:  [FE-1.4====================] (scaffold + types)
Week 3-4:  [FE-2.7========================]
Week 5:    (buffer / integration support)
Week 6-7:  [FE-3.4==========================]
Week 8:    [FE-3.8============================]
Week 9:    [FE-4.3======================]
Week 10:   (buffer / performance tuning)
```

### Workstream C: Design + QA (Design Lead)
```
Week 1-2:  Review shadcn primitives; create Figma specs for token mapping.
Week 3-5:  UX review of Playground MVP; approve resizable panel UX.
Week 6-8:  Review A/B Test and Evaluation flows; sign off on Recharts styling.
Week 9-10: Accessibility audit (FE-4.5); final visual QA pass.
```

### Critical Path
1. **FE-1.2** (shadcn extensions) blocks all component porting.
2. **FE-2.7** (backend proxy) blocks **FE-2.4** (streaming output) and **FE-2.8** (E2E).
3. **FE-3.4** (A/B backend) blocks **FE-3.3** (promote winner) and **FE-3.9** (E2E).
4. **FE-3.8** (eval backend) blocks **FE-3.7** (dataset upload) and **FE-3.9** (E2E).
5. **FE-4.5** (a11y pass) is the final gate before GA.

### Risk Mitigation
- If **FE-2.7** slips, Workstream A can mock the endpoint with MSW and continue UI work.
- If **FE-3.8** slips, defer dataset upload to Phase 4 and support manual row entry only.
- If bundle size exceeds budget during **FE-4.4**, cut Monaco language features or defer compliance charts to v1.1.

---

## Appendix: Task-to-File Mapping

| Task ID | Primary Output File(s) |
|---------|------------------------|
| FE-1.1 | `ui/package.json`, `ui/src/app/layout.tsx` |
| FE-1.2 | `ui/src/components/ui/drawer.tsx`, `ui/src/components/ui/resizable.tsx`, `ui/src/components/ui/calendar.tsx`, `ui/src/components/ui/slider.tsx`, `ui/src/components/ui/badge.tsx` |
| FE-1.3 | `ui/src/stores/playground.store.ts`, `ui/src/stores/ui.store.ts` |
| FE-1.4 | `ui/src/lib/playground-api.ts` |
| FE-1.5 | `ui/src/components/common/ConfirmModal.tsx`, `ui/src/components/common/DateRangePicker.tsx` |
| FE-1.6 | `ui/src/components/lazy/index.ts` |
| FE-1.7 | `ui/src/components/playground/helpers/NestedObjectEditor.tsx`, `ui/src/components/playground/helpers/ResponseFormatEditor.tsx` |
| FE-1.8 | `ui/src/components/playground/ParameterSchemaBuilder.tsx` |
| FE-2.1 | `ui/src/components/playground/PlaygroundLayout.tsx`, `ui/src/app/playground/page.tsx` |
| FE-2.2 | `ui/src/components/playground/tabs/EditorTab.tsx` |
| FE-2.3 | `ui/src/components/playground/ModelSelector.tsx`, `ui/src/components/playground/ModelConfigDrawer.tsx` |
| FE-2.4 | `ui/src/components/playground/StreamingOutputPanel.tsx` |
| FE-2.5 | `ui/src/components/playground/VariableSetsPanel.tsx`, `ui/src/components/playground/VariableSetModal.tsx` |
| FE-2.6 | `ui/src/app/playground/page.tsx`, `ui/src/components/layout/AdminSidebar.tsx` |
| FE-2.7 | `src/routes/playground.route.ts`, `src/controllers/playground.controller.ts`, `src/services/playground.service.ts` |
| FE-2.8 | `ui/e2e/playground.spec.ts` |
| FE-3.1 | `ui/src/components/playground/tabs/ABTestingTab.tsx` |
| FE-3.2 | `ui/src/components/ab-testing/CreateABTestModal.tsx` |
| FE-3.3 | `ui/src/components/ab-testing/ABTestResultModal.tsx` |
| FE-3.4 | `src/routes/ab-tests.route.ts`, `src/controllers/ab-tests.controller.ts`, `src/services/ab-tests.service.ts` |
| FE-3.5 | `ui/src/components/playground/tabs/EvaluationTab.tsx` |
| FE-3.6 | `ui/src/app/evaluations/page.tsx` |
| FE-3.7 | `ui/src/app/evaluations/new/page.tsx`, `ui/src/app/evaluations/datasets/new/page.tsx` |
| FE-3.8 | `src/routes/evaluations.route.ts`, `src/controllers/evaluations.controller.ts`, `src/services/evaluations.service.ts`, `migrations/00xx-add-datasets-table.ts` |
| FE-3.9 | `ui/e2e/ab-testing.spec.ts`, `ui/e2e/evaluation.spec.ts` |
| FE-4.1 | `ui/src/components/compliance/ComplianceQuickSummary.tsx`, `ui/src/components/compliance/RiskDistributionCard.tsx` |
| FE-4.2 | `ui/src/components/compliance/IntegrityBadge.tsx`, `ui/src/app/compliance/page.tsx` |
| FE-4.3 | `src/routes/compliance.route.ts`, `src/services/compliance.service.ts`, `migrations/00xx-add-compliance-tables.ts` |
| FE-4.4 | `ui/next.config.ts`, `scripts/bundle-budget.sh` |
| FE-4.5 | Accessibility remediation across `ui/src/components/playground/*`, `ui/src/app/evaluations/*`, `ui/src/app/compliance/*` |
| FE-4.6 | `ui/src/components/prompts/VersionTimeline.tsx`, `ui/src/app/prompts/[name]/versions/page.tsx` |
| FE-4.7 | `ui/e2e/*` snapshot updates, CI config |
