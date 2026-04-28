# Observability Dashboard — Build Tasks

**Status:** Draft  
**Date:** 2026-04-28  
**Scope:** Option B — Observability Overview MVP  
**Estimated Duration:** 4–6 weeks  
**Target Version:** 1.1.0  

---

## Definition of Done

Every task below must satisfy the following before it is marked complete:

1. Code compiles with `npm run build` (backend) and `next build` (UI) without errors.
2. Unit tests pass (`npm test`) for any new service, controller, or component.
3. Manual QA: the feature is tested against a local SQLite backend with at least 50 rows of seed data.
4. Workspace scoping is verified: data from workspace A does not leak to workspace B.
5. The UI renders correctly in both light and dark modes (where applicable) at 1280px and 1920px widths.
6. A peer has reviewed the PR.

---

## Week 1: Foundation & Setup

### Task 1.1 — Create preservation branch for legacy UI
**Files modified:** `.git/config` (branch creation)  
**Description:** Create a `legacy-ui` branch from `main` before any destructive changes.  
**Acceptance criteria:**
- [ ] Branch `legacy-ui` exists on `origin`.
- [ ] Tag `v1.0.13-legacy-ui` is created as a rollback point.
- [ ] The branch is documented in `README.md` under "Legacy UI Reference."
**Estimated effort:** 0.5 hours  
**Blocked by:** None  

### Task 1.2 — Add database migration for metrics indexes
**Files modified:** `migrations/010_add_metrics_indexes.ts`  
**Description:** Add composite indexes on `(workspace_id, created_at)` for `logs`, `runs`, `traces`, `spans`, and `evaluation_results` tables.  
**Acceptance criteria:**
- [ ] Migration file runs successfully on both SQLite and PostgreSQL.
- [ ] `npm run db:init` applies the migration without errors.
- [ ] Indexes are confirmed via `.schema` (SQLite) or `\d` (PostgreSQL).
**Estimated effort:** 3 hours  
**Blocked by:** None  

### Task 1.3 — Scaffold backend MetricsService
**Files modified:** `src/services/metrics.service.ts`  
**Description:** Create the service with the `dateBucket` helper and the four aggregation methods: `getTimeSeries`, `getPromptMetrics`, `getEvaluationTrends`, `getActivitySummary`. Implement stub responses for now.  
**Acceptance criteria:**
- [ ] File compiles and exports a `MetricsService` class.
- [ ] `dateBucket` returns correct SQL for both SQLite and PostgreSQL dialects.
- [ ] All four methods exist as async stubs returning typed placeholder data.
**Estimated effort:** 4 hours  
**Blocked by:** Task 1.2  

### Task 1.4 — Implement `GET /v1/metrics/time-series` endpoint
**Files modified:** `src/routes/metrics.route.ts`, `src/app.ts`, `src/services/metrics.service.ts`  
**Description:** Wire the route, controller, and full SQL query for daily time-series aggregation.  
**Acceptance criteria:**
- [ ] Endpoint returns `200` with an array of daily buckets.
- [ ] Default `window=30d` works.
- [ ] Invalid window values return `400`.
- [ ] Empty result sets return `{"daily": []}` (not `404`).
- [ ] Integration test exists in `tests/integration/metrics.test.ts`.
**Estimated effort:** 6 hours  
**Blocked by:** Task 1.3  

### Task 1.5 — Implement `GET /v1/metrics/prompts` endpoint
**Files modified:** `src/routes/metrics.route.ts`, `src/services/metrics.service.ts`  
**Description:** Prompt-level cost/latency/token breakdown.  
**Acceptance criteria:**
- [ ] Returns array of prompt/version aggregates sorted by `total_cost_usd DESC`.
- [ ] Respects `limit` parameter (default 20, max 100).
- [ ] Integration test covers pagination and sorting.
**Estimated effort:** 4 hours  
**Blocked by:** Task 1.4  

### Task 1.6 — Implement `GET /v1/metrics/evaluations` endpoint
**Files modified:** `src/routes/metrics.route.ts`, `src/services/metrics.service.ts`  
**Description:** Evaluation score trends grouped by date.  
**Acceptance criteria:**
- [ ] Returns trends array with `avg_score`, `result_count`, `min_score`, `max_score`.
- [ ] Optional `evaluation_id` filter works.
- [ ] Integration test covers single-evaluation and all-evaluation modes.
**Estimated effort:** 4 hours  
**Blocked by:** Task 1.4  

### Task 1.7 — Implement `GET /v1/metrics/activity` endpoint
**Files modified:** `src/routes/metrics.route.ts`, `src/services/metrics.service.ts`  
**Description:** Summary counts + recent runs for the overview page.  
**Acceptance criteria:**
- [ ] Returns `summary` object with counts for runs, traces, logs, evaluations, active prompts, failed runs.
- [ ] Returns `recent_runs` paginated list.
- [ ] Integration test verifies counts match actual seeded data.
**Estimated effort:** 4 hours  
**Blocked by:** Task 1.4  

### Task 1.8 — Add OpenAPI spec for metrics endpoints
**Files modified:** `docs/openapi.yaml`  
**Description:** Document all four new endpoints with request/response schemas.  
**Acceptance criteria:**
- [ ] Swagger UI at `/docs` renders the metrics section correctly.
- [ ] All schemas are valid (run `npm run lint:openapi` if available, or manual validation).
**Estimated effort:** 2 hours  
**Blocked by:** Tasks 1.4–1.7  

---

## Week 2: Backend Polish & Frontend Scaffold

### Task 2.1 — Add percentile helper for p95 latency
**Files modified:** `src/services/metrics.service.ts`  
**Description:** Implement `p95` calculation. In SQLite, approximate via ordered subquery; in PostgreSQL, use `percentile_cont(0.95)`.  
**Acceptance criteria:**
- [ ] p95 latency is computed and returned in `time-series` response.
- [ ] SQLite p95 is within 5% of true percentile on test datasets.
- [ ] PostgreSQL p95 uses exact `percentile_cont`.
**Estimated effort:** 3 hours  
**Blocked by:** Task 1.4  

### Task 2.2 — Add Redis caching to MetricsService
**Files modified:** `src/services/metrics.service.ts`, `src/services/cache.service.ts`  
**Description:** Cache metric results for 60 seconds using the existing cache service.  
**Acceptance criteria:**
- [ ] Second identical request returns cached result (no DB query logged).
- [ ] Cache keys include workspace ID, endpoint name, and date window.
- [ ] Cache is bypassed when `?nocache=1` is passed (for debugging).
**Estimated effort:** 3 hours  
**Blocked by:** Task 1.7  

### Task 2.3 — Prepare legacy UI removal
**Files modified:** `ui/src/` (delete all except config files)  
**Description:** Delete all source files under `ui/src/` except `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, and any build config.  
**Acceptance criteria:**
- [ ] `ui/` directory only contains config files and `.gitkeep`.
- [ ] `npm install` in `ui/` still works.
- [ ] A new `ui/src/` directory can be created and built.
**Estimated effort:** 1 hour  
**Blocked by:** None  

### Task 2.4 — Update `ui/package.json` dependencies
**Files modified:** `ui/package.json`, `package-lock.json`  
**Description:** Add `@tanstack/react-query`, `recharts`, and update Tailwind/shadcn if needed. Remove unused deps.  
**Acceptance criteria:**
- [ ] `npm install` succeeds in `ui/`.
- [ ] Build passes with `next build`.
- [ ] No unused dependencies flagged by `depcheck`.
**Estimated effort:** 2 hours  
**Blocked by:** Task 2.3  

### Task 2.5 — Copy design tokens and global styles from website
**Files modified:** `ui/src/styles/globals.css`, `ui/tailwind.config.ts`  
**Description:** Copy the `pm-*` CSS custom properties, typography utilities, and Tailwind extensions from the website repo.  
**Acceptance criteria:**
- [ ] All `pm-*` tokens are present in `globals.css`.
- [ ] Tailwind config includes `pm` color namespace and custom shadows.
- [ ] Dark mode is default; light mode override exists.
**Estimated effort:** 3 hours  
**Blocked by:** Task 2.4  

### Task 2.6 — Scaffold UI component library from website
**Files modified:** `ui/src/components/ui/*.tsx`  
**Description:** Copy presentational components from the website: Button, Card, Dialog, Tabs, Table, Skeleton, Badge, Input, Select, Label, Switch, Separator.  
**Acceptance criteria:**
- [ ] All listed components exist in `ui/src/components/ui/`.
- [ ] Each component compiles without errors.
- [ ] Components are tree-shakeable (no barrel file side effects).
**Estimated effort:** 4 hours  
**Blocked by:** Task 2.5  

### Task 2.7 — Create DashboardLayout and AdminSidebar
**Files modified:** `ui/src/components/layout/DashboardLayout.tsx`, `ui/src/components/layout/AdminSidebar.tsx`, `ui/src/components/layout/TopBar.tsx`  
**Description:** Build the admin shell: sidebar navigation, top bar, and responsive layout.  
**Acceptance criteria:**
- [ ] Sidebar lists all pages with active state.
- [ ] Layout is responsive: sidebar collapses to icon-only on smaller screens.
- [ ] Active page is highlighted with `pm-brand` color.
- [ ] Top bar shows API key status indicator.
**Estimated effort:** 6 hours  
**Blocked by:** Task 2.6  

### Task 2.8 — Set up TanStack Query client
**Files modified:** `ui/src/lib/query-client.ts`, `ui/src/app/layout.tsx`  
**Description:** Configure the QueryClient with 30s stale time and window-focus refetch.  
**Acceptance criteria:**
- [ ] `queryClient` is exported from `ui/src/lib/query-client.ts`.
- [ ] Provider wraps the app in `layout.tsx`.
- [ ] A test page using `useQuery` fetches data successfully.
**Estimated effort:** 2 hours  
**Blocked by:** Task 2.4  

---

## Week 3: Core Dashboard UI

### Task 3.1 — Expand API client with metrics endpoints
**Files modified:** `ui/src/lib/api.ts`  
**Description:** Add `metricsApi` module with methods: `timeSeries`, `prompts`, `evaluations`, `activity`.  
**Acceptance criteria:**
- [ ] All four endpoints are callable from the UI.
- [ ] TypeScript types are defined for request params and response shapes.
- [ ] Error handling returns typed errors (not `any`).
**Estimated effort:** 3 hours  
**Blocked by:** Task 2.8  

### Task 3.2 — Build SummaryCard component
**Files modified:** `ui/src/components/data-display/SummaryCard.tsx`  
**Description:** Reusable stat card with title, value, optional trend indicator (up/down arrow + percentage).  
**Acceptance criteria:**
- [ ] Accepts `title`, `value`, `trend` props.
- [ ] Uses `pm-surface` styling.
- [ ] Responsive: cards stack on mobile, grid on desktop.
**Estimated effort:** 3 hours  
**Blocked by:** Task 2.6  

### Task 3.3 — Build SummaryCardGrid for Overview page
**Files modified:** `ui/src/app/page.tsx`, `ui/src/components/data-display/SummaryCard.tsx`  
**Description:** Display 4 summary cards on the Overview page using data from `metricsApi.activity()`.  
**Acceptance criteria:**
- [ ] Cards show: Total Runs, Active Evaluations, Active Prompts, Logs (24h).
- [ ] Loading state uses Skeleton cards.
- [ ] Error state shows a retry button.
**Estimated effort:** 4 hours  
**Blocked by:** Tasks 3.1, 3.2  

### Task 3.4 — Build TimeSeriesChart component
**Files modified:** `ui/src/components/charts/TimeSeriesChart.tsx`  
**Description:** Recharts LineChart wrapper for cost and latency time series.  
**Acceptance criteria:**
- [ ] Accepts `data`, `lines` (array of `{key, color, name}`), and `yAxisLabel` props.
- [ ] Renders a line chart with tooltips and a legend.
- [ ] Fills missing date gaps with zero values so the chart is continuous.
- [ ] Uses `pm-*` chart color variables.
**Estimated effort:** 5 hours  
**Blocked by:** Task 2.6  

### Task 3.5 — Build TokenBarChart component
**Files modified:** `ui/src/components/charts/TokenBarChart.tsx`  
**Description:** Recharts BarChart for token usage by prompt/version.  
**Acceptance criteria:**
- [ ] Groups bars by `prompt_name`.
- [ ] Stacked bars for `tokens_in` and `tokens_out`.
- [ ] Tooltip shows exact token counts.
- [ ] Sorted by total tokens descending.
**Estimated effort:** 4 hours  
**Blocked by:** Task 2.6  

### Task 3.6 — Build Overview page with charts
**Files modified:** `ui/src/app/page.tsx`  
**Description:** Combine SummaryCardGrid, TimeSeriesChart, and TokenBarChart on the Overview page with a 7d/30d window toggle.  
**Acceptance criteria:**
- [ ] Toggle switches between 7-day and 30-day views.
- [ ] All charts re-fetch when toggle changes.
- [ ] Page is responsive: charts stack on mobile.
- [ ] Loading and error states handled for each section independently.
**Estimated effort:** 6 hours  
**Blocked by:** Tasks 3.3, 3.4, 3.5  

### Task 3.7 — Build RecentRunsTable for Overview page
**Files modified:** `ui/src/app/page.tsx`, `ui/src/components/data-table/DataTable.tsx`  
**Description:** Table showing recent runs from `metricsApi.activity()`.  
**Acceptance criteria:**
- [ ] Columns: workflow name, status (with StatusBadge), created at, duration.
- [ ] Pagination controls (previous/next).
- [ ] Clicking a row navigates to `/runs/[run_id]` (or `/runs` if detail page is out of scope).
**Estimated effort:** 5 hours  
**Blocked by:** Tasks 3.1, 3.6  

### Task 3.8 — Build StatusBadge component
**Files modified:** `ui/src/components/data-display/StatusBadge.tsx`  
**Description:** Badge for run statuses: `running`, `completed`, `failed`, `pending`.  
**Acceptance criteria:**
- [ ] Each status has a distinct color (green for completed, red for failed, amber for running, gray for pending).
- [ ] Uses the Badge UI primitive.
- [ ] Accessible: includes `role="status"` and appropriate ARIA label.
**Estimated effort:** 2 hours  
**Blocked by:** Task 2.6  

---

## Week 4: Feature Pages

### Task 4.1 — Build Logs page (execution logs)
**Files modified:** `ui/src/app/logs/page.tsx`, `ui/src/lib/api.ts`  
**Description:** Replace the old audit-log view with execution logs. Add `logsApi.list()` to the API client.  
**Acceptance criteria:**
- [ ] Table shows: prompt name, model, tokens in/out, cost, latency, timestamp.
- [ ] Columns are sortable.
- [ ] Filter by prompt name via search input.
- [ ] Pagination works.
**Estimated effort:** 6 hours  
**Blocked by:** Tasks 2.7, 3.1  

### Task 4.2 — Build Traces list page
**Files modified:** `ui/src/app/traces/page.tsx`, `ui/src/lib/api.ts`  
**Description:** Replace placeholder with a trace list. Add `tracesApi.list()` to API client.  
**Acceptance criteria:**
- [ ] Table shows: trace ID, name, status, duration, created at.
- [ ] Clicking a row opens a detail panel (or navigates to `/traces/[trace_id]`).
- [ ] Pagination works.
**Estimated effort:** 5 hours  
**Blocked by:** Tasks 2.7, 3.1  

### Task 4.3 — Build Trace detail page with span tree
**Files modified:** `ui/src/app/traces/[trace_id]/page.tsx`  
**Description:** Show spans for a trace in a hierarchical tree view.  
**Acceptance criteria:**
- [ ] Spans are rendered as a tree with indentation.
- [ ] Each span shows: name, duration, status.
- [ ] Expand/collapse works for nested spans.
- [ ] Empty state if no spans exist.
**Estimated effort:** 6 hours  
**Blocked by:** Task 4.2  

### Task 4.4 — Build Labels page
**Files modified:** `ui/src/app/labels/page.tsx`, `ui/src/lib/api.ts`  
**Description:** Replace placeholder with label management. Add `labelsApi.list()` and `labelsApi.create()`/`delete()` to API client.  
**Acceptance criteria:**
- [ ] Table lists all labels for a prompt.
- [ ] "Add label" button opens a Dialog with a form.
- [ ] Delete button removes a label with confirmation.
- [ ] Form validation prevents empty labels.
**Estimated effort:** 5 hours  
**Blocked by:** Tasks 2.7, 3.1  

### Task 4.5 — Build Evaluations page
**Files modified:** `ui/src/app/evaluations/page.tsx`, `ui/src/lib/api.ts`  
**Description:** New page listing evaluations. Add `evaluationsApi.list()` to API client.  
**Acceptance criteria:**
- [ ] Table shows: name, prompt, version, criteria count.
- [ ] Clicking a row shows evaluation detail (or navigates to detail page).
- [ ] ScoreTrendChart is embedded in the detail view.
**Estimated effort:** 5 hours  
**Blocked by:** Tasks 2.7, 3.1  

### Task 4.6 — Build ScoreTrendChart for Evaluations
**Files modified:** `ui/src/components/charts/ScoreTrendChart.tsx`  
**Description:** Recharts AreaChart showing evaluation score trends over time.  
**Acceptance criteria:**
- [ ] Displays `avg_score` as an area chart.
- [ ] Band shows `min_score` to `max_score` as a shaded range.
- [ ] Tooltip shows `result_count` for each data point.
**Estimated effort:** 4 hours  
**Blocked by:** Task 2.6  

### Task 4.7 — Migrate Prompts page to new design system
**Files modified:** `ui/src/app/prompts/page.tsx`, `ui/src/app/prompts/[name]/page.tsx`  
**Description:** Rewrite existing prompts pages using new UI components and TanStack Query.  
**Acceptance criteria:**
- [ ] Prompt list uses DataTable with sorting.
- [ ] Prompt detail page uses Card components for messages and metadata.
- [ ] All existing functionality preserved.
**Estimated effort:** 5 hours  
**Blocked by:** Tasks 2.7, 3.1  

### Task 4.8 — Migrate Runs and Settings pages
**Files modified:** `ui/src/app/runs/page.tsx`, `ui/src/app/settings/page.tsx`  
**Description:** Rewrite runs and settings pages with new design system.  
**Acceptance criteria:**
- [ ] Runs page uses DataTable + StatusBadge.
- [ ] Settings page uses new Input and Button components.
- [ ] API key input works and persists to localStorage.
**Estimated effort:** 4 hours  
**Blocked by:** Tasks 2.7, 3.1  

---

## Week 5: Polish & Integration

### Task 5.1 — Add DataTable with sorting
**Files modified:** `ui/src/components/data-table/DataTable.tsx`  
**Description:** Generic sortable table using `@tanstack/react-table`.  
**Acceptance criteria:**
- [ ] Accepts `columns` and `data` props.
- [ ] Clicking a header sorts ascending/descending.
- [ ] Sort state is reflected in the UI with arrow icons.
- [ ] Works with all pages (Logs, Runs, Traces, Evaluations).
**Estimated effort:** 5 hours  
**Blocked by:** Task 2.6  

### Task 5.2 — Add Pagination component
**Files modified:** `ui/src/components/data-table/Pagination.tsx`  
**Description:** Reusable pagination controls for DataTable.  
**Acceptance criteria:**
- [ ] Shows current page and total pages.
- [ ] Previous/Next buttons disabled at boundaries.
- [ ] Optional page-size selector (10, 25, 50).
**Estimated effort:** 3 hours  
**Blocked by:** Task 5.1  

### Task 5.3 — Add loading skeletons to all pages
**Files modified:** `ui/src/components/ui/Skeleton.tsx`, all page files  
**Description:** Replace "Loading..." text with proper skeleton screens.  
**Acceptance criteria:**
- [ ] Every async section shows a Skeleton matching the final layout.
- [ ] Skeletons use `pm-surface` colors.
- [ ] No layout shift when data loads.
**Estimated effort:** 4 hours  
**Blocked by:** Tasks 3.6, 4.1–4.8  

### Task 5.4 — Add error boundaries and retry logic
**Files modified:** `ui/src/components/ErrorBoundary.tsx`, page files  
**Description:** Wrap charts and tables in error boundaries with retry buttons.  
**Acceptance criteria:**
- [ ] Failed queries show a user-friendly error message.
- [ ] Retry button re-fetches the failed query.
- [ ] Error boundary catches React rendering errors without crashing the whole app.
**Estimated effort:** 4 hours  
**Blocked by:** None  

### Task 5.5 — Add 7d/30d/90d window selector component
**Files modified:** `ui/src/components/WindowSelector.tsx`  
**Description:** Segmented control for choosing time window on Overview and metrics pages.  
**Acceptance criteria:**
- [ ] Options: 7d, 30d, 90d.
- [ ] Active option highlighted with `pm-brand`.
- [ ] Changing window triggers re-fetch.
**Estimated effort:** 2 hours  
**Blocked by:** None  

### Task 5.6 — Responsive design audit
**Files modified:** All page and component files  
**Description:** Ensure all pages are usable at 768px, 1280px, and 1920px.  
**Acceptance criteria:**
- [ ] Sidebar collapses to icon-only at < 1024px.
- [ ] Charts stack vertically on mobile.
- [ ] Tables are horizontally scrollable on small screens.
- [ ] No text overflow or clipping.
**Estimated effort:** 4 hours  
**Blocked by:** Tasks 3.6, 4.1–4.8  

### Task 5.7 — Add empty states
**Files modified:** `ui/src/components/EmptyState.tsx`  
**Description:** Friendly empty state for tables and charts with zero data.  
**Acceptance criteria:**
- [ ] Empty state shows an icon, message, and optional CTA.
- [ ] Used on all list pages.
- [ ] Message is contextual (e.g., "No logs yet — start sending data!").
**Estimated effort:** 2 hours  
**Blocked by:** None  

### Task 5.8 — Dark mode polish
**Files modified:** `ui/src/styles/globals.css`  
**Description:** Ensure all components render correctly in dark mode (the default).  
**Acceptance criteria:**
- [ ] No hardcoded light colors in components.
- [ ] Chart tooltip backgrounds match the dark theme.
- [ ] Table zebra stripes use subtle dark tones.
**Estimated effort:** 2 hours  
**Blocked by:** Tasks 3.6, 4.1–4.8  

---

## Week 6: Testing & Deployment

### Task 6.1 — Unit tests for MetricsService
**Files modified:** `tests/unit/metrics.service.test.ts`  
**Description:** Test all four aggregation methods with seeded data.  
**Acceptance criteria:**
- [ ] Tests cover time-series, prompt breakdown, evaluation trends, and activity summary.
- [ ] Tests verify workspace isolation.
- [ ] Tests run in < 5 seconds.
**Estimated effort:** 5 hours  
**Blocked by:** Tasks 1.4–1.7  

### Task 6.2 — Integration tests for metrics endpoints
**Files modified:** `tests/integration/metrics.test.ts`  
**Description:** HTTP-level tests for all `/v1/metrics/*` endpoints.  
**Acceptance criteria:**
- [ ] All four endpoints return correct shapes.
- [ ] Invalid parameters return `400`.
- [ ] Missing API key returns `401`.
- [ ] Wrong workspace scope returns empty results (not errors).
**Estimated effort:** 4 hours  
**Blocked by:** Tasks 1.4–1.7  

### Task 6.3 — Frontend unit tests for chart components
**Files modified:** `ui/src/components/charts/__tests__/*.test.tsx`  
**Description:** Test chart rendering with mock data.  
**Acceptance criteria:**
- [ ] `TimeSeriesChart` renders lines for each data series.
- [ ] `TokenBarChart` renders bars.
- [ ] `ScoreTrendChart` renders area.
- [ ] Tests use `@testing-library/react` and `vitest` (or Jest if already configured).
**Estimated effort:** 4 hours  
**Blocked by:** Tasks 3.4, 3.5, 4.6  

### Task 6.4 — Playwright E2E tests for critical flows
**Files modified:** `ui/e2e/overview.spec.ts`, `ui/e2e/logs.spec.ts`, `ui/e2e/traces.spec.ts`  
**Description:** End-to-end tests for the Overview, Logs, and Traces pages.  
**Acceptance criteria:**
- [ ] Overview page loads with summary cards and charts.
- [ ] Logs page shows execution logs.
- [ ] Traces page shows trace list.
- [ ] Tests run against a local backend with seed data.
**Estimated effort:** 5 hours  
**Blocked by:** Tasks 3.6, 4.1, 4.2  

### Task 6.5 — Seed data for testing
**Files modified:** `tests/fixtures/seed-metrics.ts`  
**Description:** Helper to generate realistic logs, runs, traces, and evaluations for testing.  
**Acceptance criteria:**
- [ ] Generates at least 100 log entries across 7 days.
- [ ] Includes runs with all statuses.
- [ ] Includes evaluations with scores.
- [ ] Reusable in unit, integration, and E2E tests.
**Estimated effort:** 3 hours  
**Blocked by:** None  

### Task 6.6 — Performance audit
**Files modified:** None (audit only)  
**Description:** Run Lighthouse and bundle analysis on the new dashboard.  
**Acceptance criteria:**
- [ ] Lighthouse Performance score > 80.
- [ ] First Contentful Paint < 2s.
- [ ] Total bundle size < 500 KB (gzipped).
- [ ] No render-blocking resources.
**Estimated effort:** 3 hours  
**Blocked by:** Tasks 3.6, 4.1–4.8  

### Task 6.7 — Write ADR for metrics dashboard
**Files modified:** `docs/adr/011-metrics-dashboard.md`  
**Description:** Document the architectural decisions: why TanStack Query, why Recharts, why in-place migration.  
**Acceptance criteria:**
- [ ] ADR follows the template in the implementation plan.
- [ ] Captures trade-offs and alternatives considered.
- [ ] Reviewed by at least one team member.
**Estimated effort:** 2 hours  
**Blocked by:** None  

### Task 6.8 — Update documentation
**Files modified:** `README.md`, `ui/README.md`  
**Description:** Update READMEs with new dashboard screenshots, architecture diagram, and setup instructions.  
**Acceptance criteria:**
- [ ] README mentions the new dashboard.
- [ ] UI README explains how to run the dashboard locally.
- [ ] Screenshots or GIFs of the Overview page are included.
**Estimated effort:** 2 hours  
**Blocked by:** Tasks 3.6, 4.1–4.8  

---

## Common Patterns

### Creating a Summary Card
```tsx
import { SummaryCard } from '@/components/data-display/SummaryCard';

<SummaryCard
  title="Total Runs"
  value={summary.total_runs}
  trend={{ direction: 'up', percentage: 12 }}
/>
```

### Using Recharts with the Design System
```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={300}>
  <LineChart data={data}>
    <XAxis dataKey="date" stroke="var(--pm-fg-muted)" />
    <YAxis stroke="var(--pm-fg-muted)" />
    <Tooltip
      contentStyle={{ backgroundColor: 'var(--pm-surface)', border: '1px solid var(--pm-border)' }}
      labelStyle={{ color: 'var(--pm-fg)' }}
    />
    <Line type="monotone" dataKey="total_cost_usd" stroke="var(--pm-brand)" />
  </LineChart>
</ResponsiveContainer>
```

### Fetching Data with TanStack Query
```tsx
import { useQuery } from '@tanstack/react-query';
import { metricsApi } from '@/lib/api';

const { data, isLoading, error } = useQuery({
  queryKey: ['metrics', 'activity', window],
  queryFn: () => metricsApi.activity({ window }),
});
```

### Building a Page
```tsx
// ui/src/app/logs/page.tsx
'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable } from '@/components/data-table/DataTable';
import { logsApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

export default function LogsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['logs'],
    queryFn: () => logsApi.list(),
  });

  return (
    <DashboardLayout title="Logs">
      {isLoading ? <SkeletonTable /> : <DataTable data={data?.items} columns={logColumns} />}
    </DashboardLayout>
  );
}
```

---

## Dependency Graph

```
Week 1: 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.7 → 1.8
Week 2: 2.1 → 2.2 (parallel with 2.3 → 2.4 → 2.5 → 2.6 → 2.7 → 2.8)
Week 3: 3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 3.6 → 3.7 → 3.8
Week 4: 4.1 → 4.2 → 4.3
        4.4 → 4.5 → 4.6
        4.7 → 4.8
Week 5: 5.1 → 5.2 → 5.3
        5.4 → 5.5 → 5.6 → 5.7 → 5.8
Week 6: 6.1 → 6.2
        6.3 → 6.4 → 6.5
        6.6 → 6.7 → 6.8
```

---

## Rollback Plan

If a critical issue is discovered during testing:

1. Stop work on `main`.
2. Create a hotfix branch from `legacy-ui` tag.
3. Revert the `ui/` directory to the `legacy-ui` branch state.
4. Cherry-pick any backend fixes that are safe to keep.
5. Cut a `v1.0.14` patch release with the old UI.
6. Resume dashboard work on a feature branch.

---

## Notes

- **Bundle size:** Monitor Recharts bundle impact. If it exceeds 150 KB gzipped, consider dynamic imports (`next/dynamic`) for chart components.
- **SQLite p95:** The approximate p95 for SQLite should be clearly documented as an estimate in the UI tooltip.
- **Chart colors:** Use `pm-brand` (#389438) as the primary series color, `pm-brand-bright` (#5cc15c) for secondary, and `pm-fg-muted` (#a1a1aa) for grid lines.
- **Date formatting:** Use `toLocaleDateString` with `Intl.DateTimeFormat` for consistent date display across locales.
