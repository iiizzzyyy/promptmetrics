# ADR-011: Metrics Dashboard

## Status

Accepted

## Context

PromptMetrics collects rich telemetry (logs, traces, runs, evaluations) but had no built-in way for operators to visualize trends, compare prompt performance, or monitor costs over time. Users relied on external tools or raw API queries.

We needed a lightweight, self-hosted dashboard that:
- Requires no additional infrastructure beyond the PromptMetrics server
- Works with both SQLite and PostgreSQL backends
- Provides actionable metrics (requests, tokens, latency, errors, evaluation scores)
- Loads fast without heavy aggregation at request time

## Decision

We will build an **Observability Dashboard** with two parts:

1. **Backend Metrics API** — Four read-only endpoints under `/v1/metrics/*` that aggregate data from existing tables (logs, runs, traces, spans, evaluation_results) using composite indexes on `(workspace_id, created_at)`.

2. **Frontend Dashboard** — A Next.js SPA embedded in the `ui/` directory, using TanStack Query for server state, Recharts for charts, and a custom design system with `pm-*` CSS tokens.

### Metrics Endpoints

| Endpoint | Data Source | Aggregation |
|----------|-------------|-------------|
| `GET /v1/metrics/time-series` | logs + runs | Daily: request_count, total_tokens, total_cost, avg_latency, p50/p95 latency, error_rate |
| `GET /v1/metrics/prompts` | logs | Per-prompt: request_count, tokens_in/out, total_cost, avg_latency, error_rate |
| `GET /v1/metrics/evaluations` | evaluation_results | Per-evaluation daily: avg_score, result_count, min/max score |
| `GET /v1/metrics/activity` | runs + traces + logs + evaluations + prompts | Summary counts + recent runs |

### Window Support

All endpoints accept a `window` parameter: `7d`, `30d`, or `90d`. Default is `7d`.

### Indexing Strategy

Migration `010_add_metrics_indexes.ts` adds composite indexes on `(workspace_id, created_at)` for:
- `logs`
- `runs`
- `traces`
- `spans`
- `evaluation_results`

This ensures metrics queries remain fast even as tables grow into the millions of rows.

### Frontend Architecture

- **Next.js 16** with App Router
- **Tailwind CSS v4** with custom `pm-*` design tokens
- **TanStack Query** with 30s staleTime
- **Recharts** for line, bar, and area charts
- **Pages**: Overview, Logs, Traces, Trace Detail, Runs, Labels, Evaluations, Settings, Prompts

## Consequences

### Positive

- Operators get instant visibility into prompt performance without external tools.
- Composite indexes keep metrics queries sub-second on SQLite up to ~1M rows per table.
- The frontend is a standalone Next.js app that can be built and served independently.
- All metrics are workspace-scoped, maintaining multi-tenant isolation.

### Negative

- Metrics aggregation is computed on-demand; very large datasets may require materialized views or caching (Redis is available but not used for metrics yet).
- The frontend bundle includes Recharts, which adds ~100KB gzipped.
- The UI replaces the previous minimal dashboard; users who relied on the old UI must adapt.

## Alternatives Considered

1. **Grafana + PostgreSQL** — Rejected because it adds operational complexity and doesn't work well with SQLite.
2. **Materialized views** — Rejected for SQLite incompatibility; may be reconsidered for PostgreSQL-only deployments.
3. **Pre-aggregated tables** — Rejected to keep the schema simple; aggregation logic is centralized in MetricsService.

## Related

- [docs/plans/observability-dashboard-implementation-plan.md](docs/plans/observability-dashboard-implementation-plan.md)
- PR #72
