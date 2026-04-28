# Observability Dashboard Implementation Plan

**Status:** Proposed  
**Date:** 2026-04-28  
**Scope:** Option B — Observability Overview MVP  
**Estimated Duration:** 4-6 weeks  
**Target Version:** 1.1.0  

---

## 1. Architecture Overview

### 1.1 High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              User Browser                                    │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   Next.js 16 Dashboard    │
                    │   (ui/ — port 3001)       │
                    │                           │
                    │  ┌─────────────────────┐│
                    │  │  TanStack Query     ││
                    │  │  Recharts           ││
                    │  │  pm-* Design System ││
                    │  └─────────────────────┘│
                    └─────────────┬─────────────┘
                                  │ HTTP / JSON
                    ┌─────────────▼─────────────┐
                    │   Express API             │
                    │   (src/ — port 3000)      │
                    │                           │
                    │  ┌─────────────────────┐  │
                    │  │  /v1/metrics/*      │  │  ← NEW read-only endpoints
                    │  │  /v1/prompts      │  │
                    │  │  /v1/logs         │  │
                    │  │  /v1/traces       │  │
                    │  │  /v1/runs         │  │
                    │  │  /v1/evaluations  │  │
                    │  └─────────────────────┘  │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   DatabaseAdapter         │
                    │   (SQLite / PostgreSQL)   │
                    └───────────────────────────┘
```

### 1.2 How the New UI Relates to the Existing Backend

The new dashboard is a **consumer** of the existing backend. It does not modify the core write paths (prompt creation, log ingestion, trace recording). Instead, it adds a new **read-only metrics surface** on top of the existing tables.

Key relationships:
- **Prompt content** continues to flow through the `PromptDriver` interface (GitHub/filesystem/S3). The UI reads prompts via existing `/v1/prompts` endpoints.
- **Observability data** (logs, traces, runs, evaluations) is queried through new `/v1/metrics/*` endpoints that perform SQL aggregations directly against the metadata database.
- **Authentication** uses the same `X-API-Key` header and `tenantMiddleware` workspace scoping. The dashboard reuses the existing `AuthProvider` pattern.
- **Audit logs** remain on their existing endpoint (`/v1/audit-logs`). The new dashboard switches the "Logs" page from audit logs to execution logs (`/v1/logs`), which is the data users actually need for observability.

### 1.3 Migration Strategy: Replace In-Place

**Decision:** Replace the `ui/` directory in-place rather than creating a parallel `dashboard/` directory.

**Rationale:**
| Factor | In-Place Replace | Parallel `dashboard/` |
|--------|------------------|----------------------|
| Build scripts | `package.json` scripts in `ui/` stay valid | Root scripts need updating |
| CI/CD | No pipeline changes | Path updates required |
| Git history | Preserved; old UI recoverable via tags/branches | History split across dirs |
| Cognitive load | One canonical UI location | Confusion about which is active |
| Documentation | All links to `ui/` remain valid | Broken links |

**Execution:**
1. Create a long-lived Git branch `legacy-ui` from `main` before the first dashboard commit. This preserves the old UI for reference or rollback.
2. On `main`, delete all files under `ui/src/` except `package.json`, `tsconfig.json`, and build config.
3. Scaffold the new dashboard inside `ui/` using the website design system.
4. Update `ui/package.json` dependencies (add `@tanstack/react-query`, `recharts`, etc.).
5. The final PR diff will show `ui/` as largely rewritten, which is accurate.

---

## 2. Backend API Design

### 2.1 New Endpoints under `/v1/metrics`

All metrics endpoints are **read-only**, require `authenticateApiKey`, and respect `req.workspaceId`. They accept an optional `window` query parameter (default `30d`, options `7d|30d|90d`). All date boundaries are computed server-side in UTC.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/metrics/time-series` | GET | Daily buckets of cost, tokens, latency percentiles, error rate, request count |
| `/v1/metrics/prompts` | GET | Aggregate metrics per prompt/version, sorted by total cost DESC |
| `/v1/metrics/evaluations` | GET | Evaluation score trends over time |
| `/v1/metrics/activity` | GET | Summary counts and recent runs for the overview page |

### 2.2 Request/Response Schemas

#### `GET /v1/metrics/time-series`

**Query Parameters:**
```typescript
interface TimeSeriesQuery {
  window?: '7d' | '30d' | '90d';  // default: '30d'
  start?: number;                  // unix epoch (optional, overrides window)
  end?: number;                    // unix epoch (optional, defaults to now)
}
```

**Response (200):**
```json
{
  "window": "30d",
  "start": 1743638400,
  "end": 1746226800,
  "daily": [
    {
      "date": "2026-04-01",
      "request_count": 152,
      "total_tokens": 48200,
      "total_cost_usd": 12.34,
      "avg_latency_ms": 245,
      "p50_latency_ms": 180,
      "p95_latency_ms": 890,
      "error_rate": 0.013
    }
  ]
}
```

**Implementation note:** The backend returns an array of daily objects. If a day has zero data, it is **omitted** from the array; the frontend is responsible for filling gaps when rendering continuous line charts.

---

#### `GET /v1/metrics/prompts`

**Query Parameters:**
```typescript
interface PromptMetricsQuery {
  window?: '7d' | '30d' | '90d';  // default: '30d'
  start?: number;
  end?: number;
  limit?: number;                  // default: 20, max: 100
}
```

**Response (200):**
```json
{
  "window": "30d",
  "prompts": [
    {
      "prompt_name": "summarize",
      "version_tag": "v1.2",
      "request_count": 152,
      "total_tokens_in": 24000,
      "total_tokens_out": 24200,
      "total_cost_usd": 12.34,
      "avg_latency_ms": 245,
      "error_rate": 0.013
    }
  ]
}
```

---

#### `GET /v1/metrics/evaluations`

**Query Parameters:**
```typescript
interface EvaluationMetricsQuery {
  evaluation_id?: number;          // filter to single evaluation
  window?: '7d' | '30d' | '90d';   // default: '30d'
  start?: number;
  end?: number;
}
```

**Response (200):**
```json
{
  "window": "30d",
  "evaluations": [
    {
      "evaluation_id": 1,
      "name": "Factuality Check",
      "prompt_name": "summarize",
      "trend": [
        { "date": "2026-04-01", "avg_score": 4.2, "result_count": 12, "min_score": 3.0, "max_score": 5.0 }
      ]
    }
  ]
}
```

---

#### `GET /v1/metrics/activity`

**Query Parameters:**
```typescript
interface ActivityQuery {
  window?: '7d' | '30d';           // default: '7d'
}
```

**Response (200):**
```json
{
  "window": "7d",
  "summary": {
    "total_runs": 482,
    "total_traces": 315,
    "total_logs": 1520,
    "total_evaluations": 42,
    "active_prompts": 12,
    "failed_runs": 18
  },
  "recent_runs": {
    "items": [
      {
        "run_id": "run-abc",
        "workflow_name": "daily-sync",
        "status": "completed",
        "created_at": 1746226800,
        "updated_at": 1746226900
      }
    ],
    "total": 482,
    "page": 1,
    "limit": 10,
    "totalPages": 49
  }
}
```

### 2.3 SQL Aggregation Queries

All metrics queries are implemented in a new `MetricsService` (`src/services/metrics.service.ts`). The service branches on `db.dialect` for date bucketing functions.

#### Date Bucket Helper

```typescript
// src/services/metrics.service.ts
private dateBucket(column: string, dialect: 'sqlite' | 'postgres'): string {
  if (dialect === 'postgres') {
    return `TO_TIMESTAMP(${column})::DATE`;
  }
  return `date(${column}, 'unixepoch')`;
}
```

#### Time-Series Query

```typescript
async getTimeSeries(workspaceId: string, start: number, end: number) {
  const db = getDb();
  const dateCol = this.dateBucket('l.created_at', db.dialect);

  const rows = await db.prepare(`
    SELECT
      ${dateCol} AS date,
      COUNT(*) AS request_count,
      COALESCE(SUM(l.tokens_in + l.tokens_out), 0) AS total_tokens,
      COALESCE(SUM(l.cost_usd), 0) AS total_cost_usd,
      COALESCE(AVG(l.latency_ms), 0) AS avg_latency_ms,
      COALESCE(AVG(CASE WHEN l.latency_ms IS NOT NULL THEN l.latency_ms END), 0) AS p50_latency_ms
    FROM logs l
    WHERE l.workspace_id = ?
      AND l.created_at >= ?
      AND l.created_at <= ?
    GROUP BY date
    ORDER BY date ASC
  `).all(workspaceId, start, end);

  // Note: p95 is computed in application code or via dialect-specific percentile functions.
  // SQLite does not have a native percentile function; PostgreSQL does.
  // For cross-dialect simplicity, p95 is emitted as null in SQLite and computed exactly in PostgreSQL.
}
```

**Error rate subquery (joined from runs):**

```sql
SELECT
  ${dateCol} AS date,
  COUNT(*) AS total_runs,
  SUM(CASE WHEN r.status = 'failed' THEN 1 ELSE 0 END) AS failed_runs
FROM runs r
WHERE r.workspace_id = ? AND r.created_at >= ? AND r.created_at <= ?
GROUP BY date
```

The service joins the two result sets in TypeScript by `date` to compute `error_rate = failed_runs / total_runs`.

#### Prompt Breakdown Query

```sql
SELECT
  l.prompt_name,
  l.version_tag,
  COUNT(*) AS request_count,
  COALESCE(SUM(l.tokens_in), 0) AS total_tokens_in,
  COALESCE(SUM(l.tokens_out), 0) AS total_tokens_out,
  COALESCE(SUM(l.cost_usd), 0) AS total_cost_usd,
  COALESCE(AVG(l.latency_ms), 0) AS avg_latency_ms
FROM logs l
WHERE l.workspace_id = ?
  AND l.created_at >= ?
  AND l.created_at <= ?
GROUP BY l.prompt_name, l.version_tag
ORDER BY total_cost_usd DESC
LIMIT ?
```

#### Evaluation Trend Query

```sql
SELECT
  e.id AS evaluation_id,
  e.name,
  e.prompt_name,
  ${dateCol} AS date,
  AVG(er.score) AS avg_score,
  COUNT(*) AS result_count,
  MIN(er.score) AS min_score,
  MAX(er.score) AS max_score
FROM evaluations e
JOIN evaluation_results er ON er.evaluation_id = e.id
WHERE e.workspace_id = ?
  AND er.workspace_id = ?
  AND er.created_at >= ?
  AND er.created_at <= ?
GROUP BY e.id, date
ORDER BY e.id, date ASC
```

#### Activity Summary Query

```sql
-- Runs
SELECT COUNT(*) AS c FROM runs WHERE workspace_id = ? AND created_at >= ?;
SELECT COUNT(*) AS c FROM runs WHERE workspace_id = ? AND created_at >= ? AND status = 'failed';

-- Traces
SELECT COUNT(*) AS c FROM traces WHERE workspace_id = ? AND created_at >= ?;

-- Logs
SELECT COUNT(*) AS c FROM logs WHERE workspace_id = ? AND created_at >= ?;

-- Evaluations
SELECT COUNT(*) AS c FROM evaluations WHERE workspace_id = ? AND created_at >= ?;

-- Active prompts
SELECT COUNT(DISTINCT name) AS c FROM prompts WHERE workspace_id = ? AND status = 'active';
```

### 2.4 Performance Considerations

1. **Default window = 30 days.** The API rejects windows larger than 90 days with `400 Bad Request` to prevent unbounded table scans.
2. **Query timeouts.** The `DatabaseAdapter` does not currently support query timeouts. For the MVP, we accept that aggregation queries on large datasets may be slow. A follow-up ADR should consider adding statement timeouts (e.g., `SET statement_timeout` for PostgreSQL, or a Node.js timer wrapper for SQLite).
3. **Indexes.** See Section 4 for the index strategy. Without the recommended indexes, the `logs` table aggregation will degrade linearly with row count.
4. **Caching.** The metrics endpoints are good candidates for short-term caching (e.g., 60 seconds). The existing Redis cache (`cache.service.ts`) can be reused by the `MetricsService` with keys like `metrics:ts:{workspaceId}:{window}:{date}`.
5. **Percentiles.** True p50/p95 latency percentiles are expensive in SQLite. The MVP reports `avg_latency_ms` and approximate p95 computed via a subquery or window function where supported. A future iteration can pre-aggregate metrics into a rollup table.

---

## 3. Frontend Architecture

### 3.1 Project Structure

```
ui/
├── package.json                    # updated deps
├── next.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── src/
│   ├── app/
│   │   ├── layout.tsx              # AdminLayout + Providers
│   │   ├── page.tsx                # Overview (replaces static home)
│   │   ├── prompts/
│   │   │   └── page.tsx
│   │   ├── prompts/
│   │   │   └── [name]/
│   │   │       └── page.tsx
│   │   ├── logs/
│   │   │   └── page.tsx            # Execution logs, not audit logs
│   │   ├── traces/
│   │   │   └── page.tsx            # Trace list + span tree
│   │   ├── traces/
│   │   │   └── [trace_id]/
│   │   │       └── page.tsx
│   │   ├── runs/
│   │   │   └── page.tsx
│   │   ├── labels/
│   │   │   └── page.tsx
│   │   ├── evaluations/
│   │   │   └── page.tsx
│   │   └── settings/
│   │       └── page.tsx
│   ├── components/
│   │   ├── ui/                     # Primitives from website (Button, Card, Dialog, Tabs, Table, Skeleton, Badge, Input, Select)
│   │   ├── layout/
│   │   │   ├── AdminSidebar.tsx    # Nav rail with icons + labels
│   │   │   ├── TopBar.tsx          # Workspace switcher + API key status
│   │   │   └── DashboardLayout.tsx # Sidebar + main content area
│   │   ├── charts/
│   │   │   ├── TimeSeriesChart.tsx # Recharts LineChart wrapper
│   │   │   ├── TokenBarChart.tsx   # Recharts BarChart for prompt token usage
│   │   │   └── ScoreTrendChart.tsx # Recharts AreaChart for evaluation trends
│   │   ├── data-display/
│   │   │   ├── SummaryCard.tsx     # Metric card with trend indicator
│   │   │   ├── StatusBadge.tsx     # run status (running|completed|failed)
│   │   │   └── CostCell.tsx        # formatted USD value
│   │   └── data-table/
│   │       ├── DataTable.tsx       # Generic table with sorting
│   │       └── Pagination.tsx      # Page controls
│   ├── lib/
│   │   ├── api.ts                  # REST client (expanded with metrics endpoints)
│   │   ├── query-client.ts         # TanStack Query client config
│   │   ├── auth.tsx                # Existing AuthProvider
│   │   └── utils.ts
│   └── styles/
│       └── globals.css             # pm-* CSS tokens + Tailwind v4 imports
```

### 3.2 Component Hierarchy

```
DashboardLayout (server component)
├── AdminSidebar
│   ├── NavItem (Prompts, Logs, Traces, Runs, Labels, Evaluations, Settings)
│   └── WorkspaceIndicator
├── TopBar
│   └── ConnectionStatusBadge
└── <main> (page content)
    ├── OverviewPage
    │   ├── SummaryCardGrid
    │   │   ├── SummaryCard (Total Runs)
    │   │   ├── SummaryCard (Evaluations)
    │   │   ├── SummaryCard (Active Prompts)
    │   │   └── SummaryCard (Logs 24h)
    │   ├── TimeSeriesChart (cost / latency)
    │   ├── TokenBarChart (by prompt)
    │   └── RecentRunsTable
    ├── LogsPage
    │   └── DataTable<LogEntry>
    ├── TracesPage
    │   └── DataTable<Trace> + TraceDetailPanel
    ├── RunsPage
    │   └── DataTable<Run>
    ├── LabelsPage
    │   └── DataTable<Label>
    ├── EvaluationsPage
    │   └── DataTable<Evaluation>
    └── SettingsPage
        └── ApiKeyInput
```

### 3.3 State Management Approach

**Decision:** Use **TanStack Query (React Query)** for all server state. Use React `useState` only for local UI state (modal open/close, form inputs, selected date range).

**Rationale:**
- The current UI uses raw `useEffect` + `fetch`, which leads to duplication, race conditions, and no caching.
- TanStack Query provides caching, deduplication, background refetching, and pagination helpers out of the box.
- It aligns with the dashboard's read-heavy, near-real-time observability model.

**Configuration (`src/lib/query-client.ts`):**
```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,      // 30s before background refetch
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});
```

**Usage pattern:**
```typescript
// src/app/page.tsx (Overview)
const { data: activity } = useQuery({
  queryKey: ['metrics', 'activity', window],
  queryFn: () => metricsApi.activity({ window }),
});

const { data: timeSeries } = useQuery({
  queryKey: ['metrics', 'time-series', window],
  queryFn: () => metricsApi.timeSeries({ window }),
});
```

### 3.4 Data Fetching Patterns

1. **Page-level fetching:** Each Next.js page component fetches its own data via TanStack Query hooks. No prop drilling of fetched data.
2. **Shared query keys:** Query keys follow a hierarchical convention: `['metrics', 'time-series', window]`, `['runs', page, limit]`. This enables precise invalidation (e.g., after creating a run, invalidate `['runs']`).
3. **Pagination:** Server-side pagination is used for all list views. The `DataTable` component accepts a `fetchPage` callback and manages `page`/`limit` in local state.
4. **Error handling:** A global `QueryErrorBoundary` (or error UI in each page) displays a user-friendly message when metrics endpoints return 500 or timeout.
5. **Date ranges:** The Overview page offers a `7d / 30d` toggle. Changing the toggle updates the `window` parameter and invalidates all metrics queries.

### 3.5 Design System Integration Strategy

The website repo contains a mature admin design system. The integration is a **copy-and-adapt** operation, not a npm package dependency (the website repo is not published as a package).

**Step 1: Copy CSS tokens**
- Source: `promptmetrics-website/app/globals.css` (or equivalent)
- Target: `ui/src/styles/globals.css`
- Tokens to copy:
  ```css
  @theme {
    --color-pm-bg: #0a0a0a;
    --color-pm-surface: #141414;
    --color-pm-border: #262626;
    --color-pm-brand: #389438;
    --color-pm-brand-hover: #2d7a2d;
    --color-pm-text: #e5e5e5;
    --color-pm-text-muted: #a3a3a3;
    --color-pm-danger: #ef4444;
    --color-pm-warning: #f59e0b;
  }
  ```

**Step 2: Copy component primitives**
- Source: `promptmetrics-website/components/ui/`
- Target: `ui/src/components/ui/`
- Components to copy: `Button`, `Card`, `Dialog`, `Tabs`, `Table`, `Skeleton`, `Badge`, `Input`, `Select`, `DropdownMenu`
- **Adaptation required:** Ensure all components use Tailwind v4 syntax (no `@apply` migration needed if the website is already on v4).

**Step 3: Adapt `AdminSidebar`**
- Source: `promptmetrics-website/components/layout/AdminSidebar.tsx`
- Target: `ui/src/components/layout/AdminSidebar.tsx`
- Changes:
  - Update navigation items to PromptMetrics routes (`/prompts`, `/logs`, `/traces`, `/runs`, `/labels`, `/evaluations`, `/settings`).
  - Replace any website-specific branding with PromptMetrics branding.
  - Ensure mobile responsiveness (collapsible drawer).

**Step 4: Add Recharts**
- `npm install recharts` in `ui/`.
- Wrap charts in `ResponsiveContainer` to handle the sidebar layout resizing.
- Use the `pm-*` token colors for chart strokes/fills (e.g., `stroke: 'var(--color-pm-brand)'`).

---

## 4. Database & Migration Strategy

### 4.1 Schema Changes Needed

No new tables are required for the MVP. The metrics endpoints query existing tables (`logs`, `runs`, `traces`, `evaluations`, `evaluation_results`, `prompts`).

However, two schema additions are recommended for correctness and performance:

#### Migration `010_add_metrics_indexes.ts`

```typescript
import { DatabaseAdapter } from '../src/models/database.interface';

export async function up(db: DatabaseAdapter): Promise<void> {
  const d = db.dialect;

  await db.exec(`
    -- Composite indexes for time-range filtering by workspace
    CREATE INDEX IF NOT EXISTS idx_logs_workspace_created ON logs(workspace_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_logs_workspace_prompt_created ON logs(workspace_id, prompt_name, version_tag, created_at);
    CREATE INDEX IF NOT EXISTS idx_runs_workspace_created ON runs(workspace_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_spans_workspace_created ON spans(workspace_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_evaluation_results_workspace_created ON evaluation_results(workspace_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_traces_workspace_created ON traces(workspace_id, created_at);

    -- Existing prompt_name + version_tag index on logs is replaced by the more specific composite above;
    -- keep the old one for backward compatibility.
  `);
}

export async function down(db: DatabaseAdapter): Promise<void> {
  await db.exec(`
    DROP INDEX IF EXISTS idx_logs_workspace_created;
    DROP INDEX IF EXISTS idx_logs_workspace_prompt_created;
    DROP INDEX IF EXISTS idx_runs_workspace_created;
    DROP INDEX IF EXISTS idx_spans_workspace_created;
    DROP INDEX IF EXISTS idx_evaluation_results_workspace_created;
    DROP INDEX IF EXISTS idx_traces_workspace_created;
  `);
}
```

**SQLite note:** `CREATE INDEX` in SQLite is fast and online (does not lock the table for reads). For the expected data sizes of a self-hosted PromptMetrics instance (thousands to millions of rows), this is acceptable.

**PostgreSQL note:** The migration uses standard `CREATE INDEX` because `umzug` migrations run at startup before the server accepts traffic. For very large PostgreSQL deployments, a follow-up task can switch to `CREATE INDEX CONCURRENTLY` via a standalone script.

### 4.2 Index Recommendations for Aggregation Queries

| Query Pattern | Recommended Index | Table |
|---------------|-------------------|-------|
| Time-series by workspace + date | `(workspace_id, created_at)` | logs |
| Prompt breakdown by workspace + date | `(workspace_id, prompt_name, version_tag, created_at)` | logs |
| Error rate by workspace + date | `(workspace_id, created_at)` | runs |
| Evaluation trends by workspace + date | `(workspace_id, created_at)` | evaluation_results |
| Recent traces by workspace + date | `(workspace_id, created_at)` | traces |

### 4.3 Handling Both SQLite and PostgreSQL Dialects

The new `MetricsService` follows the same dialect-branching pattern used elsewhere in the codebase:

```typescript
private dateBucket(column: string, dialect: 'sqlite' | 'postgres'): string { ... }

private percentileExpr(column: string, percentile: number, dialect: 'sqlite' | 'postgres'): string {
  if (dialect === 'postgres') {
    return `PERCENTILE_CONT(${percentile}) WITHIN GROUP (ORDER BY ${column})`;
  }
  // SQLite fallback: skip percentile, compute in application code
  return `NULL`;
}
```

For date-series gap filling, the application code generates a date range in TypeScript and merges it with the SQL results. This avoids relying on `generate_series` (unavailable in default SQLite builds).

---

## 5. Page-by-Page Implementation Order

### Phase 1: Foundation (Week 1)
**Goal:** Backend metrics API + new UI scaffold + design system integration.

1. **Backend:** Create `MetricsService` and `MetricsController`.
2. **Backend:** Add `createMetricsRoutes()` in `src/routes/metrics.route.ts` and mount in `src/app.ts`.
3. **Backend:** Write migration `010_add_metrics_indexes.ts`.
4. **Backend:** Add integration tests for `/v1/metrics/*` endpoints.
5. **Frontend:** Replace `ui/` directory contents with Next.js 16 scaffold using website design system.
6. **Frontend:** Set up TanStack Query provider and `pm-*` CSS tokens.
7. **Frontend:** Build `AdminSidebar`, `DashboardLayout`, and `TopBar`.

**Dependencies:** None. Can start immediately.

### Phase 2: Overview Page (Week 2)
**Goal:** The new home page with charts and summary cards.

8. **Frontend:** Build `SummaryCard` and `SummaryCardGrid`.
9. **Frontend:** Build `TimeSeriesChart` (cost + latency lines).
10. **Frontend:** Build `TokenBarChart` (top prompts by token usage).
11. **Frontend:** Build `RecentRunsTable` with `StatusBadge`.
12. **Frontend:** Compose `app/page.tsx` (Overview).

**Dependencies:** Phase 1.

### Phase 3: Fix Placeholder Pages (Weeks 2-3)
**Goal:** Make Traces, Labels, Logs, and Runs pages functional and consistent.

13. **Logs page:** Switch from audit logs to execution logs (`/v1/logs`). Add columns: prompt name, version, provider, model, tokens, latency, cost.
14. **Traces page:** Build trace list table. Add trace detail page (`/traces/[trace_id]`) showing span tree.
15. **Runs page:** Enhance existing runs list with pagination, status filters, and detail view.
16. **Labels page:** Build label management table with create/delete actions.

**Dependencies:** Phase 1 (design system). Logs/Traces/Runs can be done in parallel once the design system is ready.

### Phase 4: Evaluations & Prompts (Week 3)
**Goal:** Fill remaining functional gaps.

17. **Evaluations page:** List evaluations with score sparklines. Link to evaluation detail.
18. **Prompts page:** Port existing prompts list to new design system. Enhance with version list.
19. **Settings page:** Port API key input and add workspace indicator.

**Dependencies:** Phase 1.

### Phase 5: Polish & Performance (Week 4)
**Goal:** Responsive design, loading states, error handling, caching.

20. **Frontend:** Add `Skeleton` loaders to all chart and table components.
21. **Frontend:** Add error boundaries and empty states.
22. **Frontend:** Ensure mobile responsiveness (collapsible sidebar, stacked charts).
23. **Backend:** Add Redis caching layer to `MetricsService` (optional for MVP, but high value).
24. **Frontend:** Add date range picker (7d/30d/90d) to Overview.

**Dependencies:** Phases 2-4.

### Phase 6: Testing & Rollout (Weeks 5-6)
**Goal:** QA, E2E tests, documentation.

25. **E2E tests:** Add Playwright tests for Overview page load, chart rendering, and navigation.
26. **Integration tests:** Expand backend coverage for metrics edge cases (empty data, large windows).
27. **OpenAPI spec:** Document new `/v1/metrics/*` endpoints in `docs/openapi.yaml`.
28. **ADR:** Write `docs/adr/0007-metrics-api.md` capturing the decision to compute aggregations at query time vs. pre-aggregated rollup tables.
29. **Cutover:** Merge `main` (with new `ui/`) and tag `legacy-ui` branch.

---

## 6. Risk Mitigation

### Risk 1: Aggregation Queries Are Too Slow on Large Log Tables

**Impact:** High. If a user accumulates millions of log rows, the daily-bucket `GROUP BY` queries on `logs` could take seconds, degrading the dashboard experience.

**Mitigation:**
- Add the composite indexes in Migration 010 before any metrics endpoint ships.
- Cap the query window at 90 days at the API layer.
- Implement a 60-second Redis cache for identical `(workspaceId, window, endpoint)` queries.
- Monitor query latency via OpenTelemetry traces. If p95 exceeds 500ms, escalate to a pre-aggregated rollup table (ADR follow-up).

### Risk 2: Website Design System Components Do Not Map Cleanly to Tailwind v4 / Next.js 16

**Impact:** Medium. The website design system may use Radix UI primitives or class names that conflict with the current `ui/` setup (which uses `@base-ui/react` and `shadcn/ui` conventions).

**Mitigation:**
- Before copying components, audit the website's `package.json` for dependency conflicts (e.g., two versions of Radix).
- Prefer copying **presentational** components (Button, Card, Badge) over **behavioral** ones (Dialog, DropdownMenu) if the primitive libraries differ.
- Maintain a `ui/src/components/ui/LEGACY.md` file documenting any components that were adapted vs. copied verbatim.
- Keep the Tailwind v4 config minimal: only the `pm-*` theme tokens and standard shadcn color scales.

### Risk 3: SQLite vs. PostgreSQL Feature Gaps (Percentiles, Date Functions)

**Impact:** Medium. True p50/p95 latency percentiles and date bucketing behave differently across dialects, leading to inconsistent dashboard numbers when users switch backends.

**Mitigation:**
- Abstract all dialect-specific SQL into `MetricsService` helper methods (`dateBucket`, `percentileExpr`).
- For SQLite, emit `null` for p95 and compute an approximate p95 in TypeScript by fetching ordered latency values into a small window (acceptable for self-hosted SQLite users with moderate data volumes).
- Document the behavior difference in the API response schema: `p95_latency_ms` is `number | null`.
- Add unit tests for both dialects using the existing `DatabaseAdapter` mock pattern.

### Rollback Plan

1. The old UI is preserved on the `legacy-ui` branch. If the new dashboard has critical bugs, revert the `ui/` directory on `main` to the last commit before the replacement.
2. The new `/v1/metrics/*` endpoints are additive and read-only. They do not mutate data. If performance issues arise, simply remove the route mount from `src/app.ts` without affecting other API functionality.
3. Migration 010 (indexes) is backward-compatible. Rolling it back requires running the `down()` function, but dropping indexes does not affect application correctness.

---

## 7. Testing Strategy

### 7.1 Backend Tests

**Unit tests (`tests/unit/`):**
- `metrics.service.test.ts`: Test `MetricsService` with an in-memory SQLite database. Verify correct aggregation math, date bucketing, and empty-result handling.
- Mock the database dialect to test both SQLite and PostgreSQL SQL generation paths without a real Postgres instance.

**Integration tests (`tests/integration/`):**
- `metrics.test.ts`: Hit each `/v1/metrics/*` endpoint via `supertest`. Assert:
  - Correct `200` response shape matching the schemas above.
  - `window` parameter validation rejects invalid values.
  - Data is scoped to the `X-Workspace-Id` header (no cross-tenant leakage).
  - Empty workspaces return zeros/empty arrays, not 500s.

**Performance tests (manual / optional):**
- Seed 100,000 synthetic log rows into SQLite. Run the time-series query and assert execution time < 200ms on developer hardware.

### 7.2 Frontend Tests

**Unit tests (Jest + React Testing Library):**
- `SummaryCard.test.tsx`: Render with props, assert formatted numbers.
- `TimeSeriesChart.test.tsx`: Mock Recharts and assert the component passes correct data keys.
- `StatusBadge.test.tsx`: Assert correct color classes for each run status.

**E2E tests (Playwright, `ui/e2e/`):**
- `overview.spec.ts`:
  - Navigate to `/`. Assert summary cards are visible.
  - Assert charts render SVG elements.
  - Toggle 7d/30d window. Assert network requests to `/v1/metrics/time-series`.
- `logs.spec.ts`:
  - Navigate to `/logs`. Assert table contains execution log columns (cost, latency).
  - Assert no audit log columns (ip_address, api_key_name).
- `traces.spec.ts`:
  - Create a trace via API, then navigate to `/traces`. Assert it appears in the list.
  - Click a trace. Assert span tree is visible.

### 7.3 Visual Regression (Optional)

Given the design system copy, consider adding a Storybook-like visual test harness or use Playwright screenshot comparisons for the Overview page in both light and dark modes. This is **not required for MVP** but is recommended before public release.

### 7.4 Test Data Setup

Use the existing `tests/env-setup.ts` pattern. For metrics tests, add a `seedMetricsFixtures()` helper that inserts:
- 3 prompts with `status = 'active'`
- 50 log rows across 7 days with varying `cost_usd`, `tokens_in`, `tokens_out`, `latency_ms`
- 10 runs with mixed statuses
- 2 evaluations with 5 results each

This helper lives in `tests/fixtures/metrics.fixtures.ts`.

---

## Appendix A: File Inventory (New & Modified)

### New Backend Files
- `src/services/metrics.service.ts`
- `src/controllers/metrics.controller.ts`
- `src/routes/metrics.route.ts`
- `migrations/010_add_metrics_indexes.ts`
- `tests/unit/metrics.service.test.ts`
- `tests/integration/metrics.test.ts`
- `tests/fixtures/metrics.fixtures.ts`

### Modified Backend Files
- `src/app.ts` — mount `createMetricsRoutes()`
- `docs/openapi.yaml` — document new endpoints

### New Frontend Files
- `ui/src/app/page.tsx` (replaces static home)
- `ui/src/app/logs/page.tsx` (execution logs)
- `ui/src/app/traces/[trace_id]/page.tsx`
- `ui/src/components/layout/AdminSidebar.tsx`
- `ui/src/components/layout/DashboardLayout.tsx`
- `ui/src/components/charts/TimeSeriesChart.tsx`
- `ui/src/components/charts/TokenBarChart.tsx`
- `ui/src/components/data-display/SummaryCard.tsx`
- `ui/src/components/data-display/StatusBadge.tsx`
- `ui/src/lib/query-client.ts`

### Modified Frontend Files
- `ui/package.json` — add `@tanstack/react-query`, `recharts`
- `ui/src/lib/api.ts` — add `metricsApi` client
- `ui/src/styles/globals.css` — add `pm-*` tokens

---

## Appendix B: ADR Template for Metrics Query-Time Aggregation

A dedicated ADR should be written at `docs/adr/0007-metrics-query-time-aggregation.md`:

```markdown
# ADR-0007: Compute Metrics via Query-Time Aggregation

## Status
Accepted

## Context
The Observability Dashboard MVP requires time-series and breakdown metrics over logs, runs, traces, and evaluations. We considered two approaches:
1. Query-time aggregation (GROUP BY on existing tables).
2. Pre-aggregated rollup table updated by triggers or background job.

## Decision
Use query-time aggregation for the MVP.

## Consequences
- **Easier:** No new tables, no background jobs, no trigger logic.
- **Easier:** Metrics are always accurate to the latest row.
- **Harder:** Query latency grows with data volume.
- **Mitigation:** Composite indexes + 90-day window cap + Redis caching.
- **Reversible:** If query latency becomes unacceptable, we can introduce a rollup table later without changing the API contract.
```
