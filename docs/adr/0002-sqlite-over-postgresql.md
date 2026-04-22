# ADR-0002: SQLite over PostgreSQL for Single-Node Deployment

**Date**: 2026-04-22
**Status**: accepted
**Deciders**: Project authors

## Context

PromptMetrics targets self-hosted, single-node deployments. A networked database would add operational overhead (connection pooling, migrations, backups) that outweighs the benefits for a service that is metadata-only.

## Decision

Use SQLite with WAL (Write-Ahead Logging) mode as the primary metadata store. Document PostgreSQL as a future horizontal-scaling migration path, not a current requirement.

## Alternatives Considered

### PostgreSQL
- **Pros**: Handles concurrent writers, horizontal scaling, robust migration tooling.
- **Cons**: Overkill for single-node; adds deployment complexity (container, credentials, connection pooling).
- **Why not**: Operational burden contradicts the lightweight, zero-config deployment goal.

### Embedded key-value store (e.g., LevelDB)
- **Pros**: Fast, simple, no SQL overhead.
- **Cons**: Loses relational query capabilities (JOINs, pagination) needed for logs, traces, and audit.
- **Why not**: The schema requires foreign keys, complex queries, and ordered pagination.

## Consequences

### Positive
- Zero-config deployment; single file backup.
- Concurrent readers supported via WAL mode.
- No separate database process or container needed.

### Negative
- Single writer bottleneck.
- Cannot horizontally scale across nodes.

### Risks
- WAL mode requires correct shutdown to avoid `-wal` file growth.
- **Mitigation**: Graceful shutdown handler closes DB cleanly on `SIGTERM`/`SIGINT`.
