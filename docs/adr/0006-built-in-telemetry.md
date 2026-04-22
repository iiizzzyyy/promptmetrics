# ADR-0006: Built-in Traces, Spans, and Runs Instead of External APM

**Date**: 2026-04-22
**Status**: accepted
**Deciders**: Project authors

## Context

LLM agent workflows need telemetry, but requiring operators to deploy Jaeger, Zipkin, or DataDog creates friction for a self-hosted tool. We want observability without external dependencies.

## Decision

Store traces, spans, and workflow runs natively in SQLite alongside prompts and logs. Provide REST/CLI access to query them. OpenTelemetry OTLP export is available as an optional add-on, not a requirement.

## Alternatives Considered

### Mandate OpenTelemetry
- **Pros**: Industry standard; works with any backend.
- **Cons**: Forces operators to run a collector; contradicts the lightweight, self-hosted goal.
- **Why not**: Adds a hard dependency for a feature that should work out of the box.

### Integrate with APM vendor SDKs directly
- **Pros**: Rich features, hosted dashboards.
- **Cons**: Vendor lock-in; each vendor has different APIs and data models.
- **Why not**: Would require supporting multiple SDKs and tie the project to commercial tools.

## Consequences

### Positive
- Works out of the box with zero external dependencies.
- Correlates telemetry with prompt metadata in a single query.
- Optional OTel export for operators who outgrow local storage.

### Negative
- Not as feature-rich as dedicated APM tools.
- No distributed tracing across services.
- SQLite may become a bottleneck under very high telemetry volume.

### Risks
- SQLite may become a bottleneck under high telemetry volume.
- **Mitigation**: OTel export remains available for operators who need to offload telemetry to a dedicated system.
