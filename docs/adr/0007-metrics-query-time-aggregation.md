# ADR-0007: Compute Metrics via Query-Time Aggregation

**Date**: 2026-04-29
**Status**: accepted
**Deciders**: Project authors

## Context

The Observability Dashboard MVP requires time-series and breakdown metrics over logs, runs, traces, and evaluations. We considered two primary approaches:

1. Query-time aggregation (`GROUP BY` on existing tables).
2. Pre-aggregated rollup table updated by triggers or a background job.

## Decision

Use query-time aggregation for the MVP.

Metrics will be computed on demand by aggregating rows in `logs`, `runs`, `traces`, `spans`, and `evaluation_results`. The API contract (`/v1/metrics/*`) will expose time-series, prompt-level, evaluation, and activity summaries that are assembled directly from SQL `GROUP BY` queries against these tables.

## Alternatives Considered

### Pre-aggregated rollup tables
- **Pros**: Constant-time reads; predictable latency at any data volume.
- **Cons**: Requires new schema, trigger logic or a background job, and reconciliation to handle partial writes or backfills.
- **Why not**: Adds significant complexity for an MVP. The dashboard must ship quickly, and the data volume is not yet large enough to justify the operational overhead.

### Materialized views
- **Pros**: Native database feature for caching expensive aggregations; simple to query.
- **Cons**: SQLite does not support materialized views. Even on PostgreSQL, refresh strategies (concurrent refresh, scheduling) add complexity.
- **Why not**: Incompatible with the SQLite backend, which is a first-class target for PromptMetrics.

### Grafana + PostgreSQL
- **Pros**: Mature visualization platform; rich query language.
- **Cons**: Adds operational complexity (another service to deploy and secure); does not work with SQLite.
- **Why not**: Contradicts the self-hosted, zero-dependency goal and the requirement to support both SQLite and PostgreSQL backends.

## Consequences

### Positive
- No new tables, no background jobs, and no trigger logic to maintain.
- Metrics are always accurate to the latest row because they read directly from source tables.
- Reversible: if query latency becomes unacceptable, we can introduce a rollup table later without changing the API contract.

### Negative
- Query latency grows linearly with data volume.
- Heavier load on the database during dashboard usage.

### Risks
- Query latency may become unacceptable as tables grow into the tens of millions of rows.
- **Mitigation**: Composite indexes on `(workspace_id, created_at)` (see migration `010_add_metrics_indexes.ts`), a 90-day window cap on all metrics endpoints, and Redis caching for repeated identical queries.

## Related

- [ADR-011: Metrics Dashboard](011-metrics-dashboard.md)
- [docs/plans/observability-dashboard-implementation-plan.md](../plans/observability-dashboard-implementation-plan.md)
