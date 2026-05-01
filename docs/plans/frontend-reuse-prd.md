# PRD: Reuse of PromptSmith Frontend Assets for PromptMetrics Dashboard
**Status**: Draft
**Author**: Product Manager Agent
**Last Updated**: 2026-04-29
**Version**: 1.0
**Stakeholders**: Engineering Lead, Frontend Lead, Design Lead

---

## 1. Problem Statement

The current PromptMetrics dashboard (v1.1.0) is a functional observability overview built on Next.js + Tailwind. It provides surface-level metrics, time-series charts, and paginated lists for prompts, logs, traces, runs, and evaluations. However, it lacks the depth of interactive tooling that power users — ML engineers, prompt engineers, and platform teams — expect from a modern prompt operations platform.

We have a mature, feature-rich React frontend codebase (`pm-app-frontend`, alias PromptSmith/PromptLayer-FE) that contains 20+ well-built modules including a full Prompt Playground, A/B Testing framework, Evaluation Manager, Compliance Review, Regression Testing, advanced Workspace RBAC, Billing, and real-time collaboration features. This codebase represents approximately 18–24 months of frontend engineering effort and has been battle-tested in production.

**The cost of not solving this:** Rebuilding these capabilities from scratch in the new dashboard would require 6–12 months of dedicated frontend engineering. By selectively porting and adapting proven components, we can compress this timeline to 8–12 weeks while improving UX consistency and reducing technical risk.

**Evidence:**
- The old frontend contains 21 modules with deep feature sets that the new dashboard lacks entirely.
- Competitive analysis shows that PromptOps platforms (PromptLayer, LangSmith, HumanLoop) differentiate on playground depth, eval workflows, and compliance tooling — not just observability charts.
- Support signal: N/A (new product), but the old frontend's feature set was built in response to explicit customer requests over its lifetime.

---

## 2. Goals & Success Metrics

| Goal | Metric | Current Baseline | Target | Measurement Window |
|------|--------|-----------------|--------|--------------------|
| Accelerate feature delivery | Time to ship Playground MVP | N/A (not started) | 3 weeks | Q2 2026 |
| Reduce frontend engineering effort | Reused component coverage | ~15% (basic layout) | 60%+ by EOY | Quarterly audit |
| Improve user activation | % users using interactive tools | 0% | 35% | 90 days post-launch |
| Maintain dashboard stability | Post-merge bug rate | N/A | < 5% regression rate | Per release |

---

## 3. Non-Goals

- **We are not** doing a full UI rewrite or merging the two codebases into one repository. The old frontend remains a reference/ donor codebase.
- **We are not** porting the old frontend's auth system (Google OAuth, 2FA, password reset). The new dashboard uses API-key auth and will eventually add OAuth separately.
- **We are not** porting the billing/subscription module in Q2. It is complex (Stripe integration, plan management) and not critical for the core prompt-ops workflow.
- **We are not** supporting the old frontend's "Organization" multi-tenant model immediately. Workspace scoping in the new backend is simpler; we will adapt org features to the workspace model.
- **We are not** porting real-time Socket.IO collaboration features in v1. Polling-based updates are sufficient for the first iteration.

---

## 4. User Personas & Stories

**Primary Persona**: **Maya** — Prompt Engineer at a 150-person AI-native SaaS company. She designs, versions, and evaluates prompts daily. She needs to iterate fast, compare versions, run A/B tests, and prove compliance to her security team.

**Secondary Persona**: **David** — ML Platform Lead at a mid-market fintech. He cares about cost, latency, error rates, and governance. He needs dashboards he can screenshot for executives and audit trails he can show to compliance.

**Story 1**: As Maya, I want to open a prompt in an interactive playground so that I can edit variables, switch models, and see outputs without deploying code.
**Acceptance Criteria**:
- [ ] Given a prompt in the library, when I click "Open in Playground", then the playground loads with the prompt's system/user messages pre-populated.
- [ ] Given the playground is open, when I edit a Mustache variable, then the preview updates in real time.
- [ ] Given I change the model in the selector, when I click "Run", then the request hits the correct model via the backend proxy.
- [ ] Performance: Playground initial render < 1.5s on a 2023 MacBook Air.

**Story 2**: As Maya, I want to create an A/B test between two prompt versions so that I can measure which performs better on a held-out dataset.
**Acceptance Criteria**:
- [ ] Given two prompt versions, when I click "Create A/B Test", then a modal allows me to name the test, select dataset, and define success metric.
- [ ] Given the test is running, when I view results, then I see win rate, p-value, and per-metric delta.
- [ ] Given the test concludes, when I click "Promote Winner", then the winning version becomes the default active version.

**Story 3**: As David, I want to review a compliance report for a prompt so that I can attest it has no PII leakage or policy violations.
**Acceptance Criteria**:
- [ ] Given a prompt version, when I open the compliance tab, then I see a risk score, article references, and violation breakdown.
- [ ] Given there are critical violations, when I view the report, then they are highlighted in red with suggested remediation.

---

## 5. Solution Overview

We will treat `pm-app-frontend` as a **component and pattern library** — not a codebase to merge, but a catalog of proven solutions to adapt. The strategy has three layers:

1. **Direct Reuse** — Copy-paste-adapt UI components that have no old-backend dependencies (e.g., modals, form helpers, chart wrappers, skeleton loaders).
2. **Adapt & Port** — Take complex feature modules (Playground, A/B Testing, Evaluation Manager) and rewrite their data layers to use the new PromptMetrics API (`/v1/*`) while preserving their component trees and interaction patterns.
3. **Inspire & Rebuild** — For features that don't map 1:1 (Organization RBAC, Billing), use the old frontend as a UX reference but build from scratch against the new backend's simpler workspace model.

### Key Design Decisions

- **Decision 1**: We chose to port the Playground using Monaco Editor + React Hook Form rather than building a lighter editor. Trade-off: +~500KB bundle size. Reason: Users expect syntax highlighting for JSON schemas and Mustache templates; the old frontend proved this is table stakes.
- **Decision 2**: We are deferring real-time Socket.IO collaboration to v2. Reason: The new backend has no Socket.IO server. Polling every 5s is sufficient for playground output and reduces backend scope by ~2 weeks.
- **Decision 3**: We will keep the new dashboard's Next.js App Router + Tailwind + shadcn/ui primitives as the foundation. Old frontend components will be "translated" into this stack rather than importing the old Tailwind v4 + React Router stack wholesale.

---

## 6. Technical Considerations

### 6.1 Component Inventory (What to Reuse)

| Component / Module | Reuse Strategy | Effort | Priority |
|--------------------|----------------|--------|----------|
| `PlaygroundLayout` + `EditorTab` | Adapt to Next.js; replace Redux with React Query + Zustand | L | P0 |
| `ModelSelector` | Direct reuse (pure UI); adapt styling to shadcn Select | S | P0 |
| `StreamingOutputPanel` | Adapt fetch logic to hit `/v1/runs` stream | M | P0 |
| `VariableSetsPanel` | Adapt data layer; component tree is reusable | M | P0 |
| `VersionTimeline` | Direct reuse; swap React Router links for Next.js Link | S | P1 |
| `ABTestingTab` + `CreateABTestModal` | Rewrite data layer; UI is 80% reusable | L | P1 |
| `EvaluationTab` + `EvaluationManager` | Rewrite data layer; adapt to new eval schema | L | P1 |
| `ComplianceQuickSummary` + `RiskDistributionCard` | Direct reuse with style adaptation | S | P2 |
| `AppLayout` (Sidebar + Header) | Do NOT reuse — new dashboard layout is superior | — | — |
| `BillingHistory` / `PlanModal` | Defer to Q3/Q4 | XL | P3 |
| `Organization` / `Workspace` RBAC | Rebuild against simpler workspace model | XL | P2 |
| `RequestPage` (log grid) | Replace with new dashboard's table; keep ag-grid as reference | M | P2 |
| `PromptLibrary` list view | New dashboard table is sufficient; reuse detail drawer patterns | S | P2 |
| `AnalyticsPage` | Merge into dashboard overview; reuse chart configs (Recharts) | M | P1 |
| `DateRangePicker` | Direct reuse; wrap in shadcn Popover | S | P1 |
| `ConfirmModal` / `DiscardChangesModal` | Direct reuse; map to shadcn Dialog | S | P0 |
| `NestedObjectEditor` / `ResponseFormatEditor` | Direct reuse; no data-layer changes needed | S | P0 |
| `ParameterSchemaBuilder` | Direct reuse; used in playground for JSON schema editing | S | P0 |

### 6.2 Stack Mapping (Old → New)

| Concern | Old Frontend | New Dashboard | Migration Notes |
|---------|-------------|---------------|-----------------|
| Framework | React 19 + Vite | Next.js 16 App Router | Use client components for interactive pages |
| Routing | React Router DOM v7 | Next.js file-system routing | Replace `<NavLink>` with `<Link>`; replace `useNavigate` with `useRouter` |
| Styling | Tailwind CSS v4 | Tailwind CSS v3 + shadcn/ui | Translate arbitrary v4 utilities to v3/shadcn tokens |
| State | Redux Toolkit + Persist | React Query + Zustand (proposed) | Remove all `useDispatch` / `useSelector`; replace with `useQuery` / `useMutation` |
| Forms | React Hook Form + Yup | React Hook Form + Zod (proposed) | Translate Yup schemas to Zod for consistency with shadcn |
| Charts | ApexCharts + Chart.js + Recharts | Recharts only | Standardize on Recharts; port ApexChart configs to Recharts |
| Tables | ag-grid-react | TanStack Table (proposed) | ag-grid is powerful but heavy; TanStack Table + shadcn is lighter and more "native" |
| Editor | Monaco Editor | Monaco Editor | Same package; config is portable |
| HTTP | Axios | Native `fetch` via `api.ts` | Replace all service files with calls to `api.ts` |
| Notifications | notistack + toastify + SweetAlert2 | Sonner (shadcn) | Consolidate to Sonner for uniformity |
| Icons | Lucide + React Icons | Lucide only | Replace React Icons with Lucide equivalents |

### 6.3 Dependencies

- **Backend**: Requires `/v1/metrics/*` endpoints (already shipped in v1.1.0). Playground needs a new `/v1/playground/run` proxy endpoint.
- **Design**: Needs shadcn/ui component extensions (Drawer, Resizable panels for playground split-view, Multi-select for tags).
- **Cross-team**: None for Q2; all work is within the PromptMetrics repo.

### 6.4 Known Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Old frontend has hidden coupling to its backend API shape | High | Medium | Audit every reused component for API calls; write adapter layer |
| Bundle size bloat from Monaco + ag-grid patterns | Medium | Medium | Lazy-load Monaco; use dynamic imports for heavy modals |
| Style inconsistency between old Tailwind v4 and new v3 tokens | High | Low | Create a mapping doc; use shadcn tokens as source of truth |
| Porting Redux logic is error-prone | Medium | High | Port one module at a time; write integration tests for each |

### 6.5 Open Questions (must resolve before dev start)

- [ ] Do we adopt Zustand for client-side UI state (drawer open/closed, playground split ratios)? Owner: Frontend Lead — Deadline: 2026-05-02
- [ ] Should the Playground proxy through the backend (`/v1/playground/run`) or call LLM providers directly from the browser? Owner: Eng Lead — Deadline: 2026-05-02
- [ ] Do we keep ag-grid for the Requests/Logs table or migrate to TanStack Table? Owner: Frontend Lead — Deadline: 2026-05-03

---

## 7. Launch Plan

| Phase | Date | Audience | Success Gate |
|-------|------|----------|-------------|
| Internal alpha | 2026-05-20 | Core team | Playground renders, can run a prompt, no console errors |
| Design partner beta | 2026-06-01 | 3–5 design partners | Playground + A/B Test creation works end-to-end; CSAT ≥ 4/5 |
| GA rollout | 2026-06-15 | 100% of users | Feature activation ≥ 20% of monthly active users |

**Rollback Criteria**: If dashboard bundle size exceeds 1.5MB gzipped or Lighthouse performance score drops below 70, disable lazy-loaded modules and page on-call.

---

## 8. Appendix

- **Old frontend source**: `~/Documents/pm-app-frontend/src/`
- **New dashboard source**: `/Users/izzy/Documents/pm-opensource/code/promptmetrics/ui/src/`
- **Backend API contract**: `ui/src/lib/api.ts` and `docs/openapi.yaml`
- **Observability dashboard plan**: `docs/plans/observability-dashboard-implementation-plan.md`
- **Existing build tasks**: `docs/plans/observability-dashboard-build-tasks.md`
