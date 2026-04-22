# ADR-0003: Storage Driver Abstraction with Factory Pattern

**Date**: 2026-04-22
**Status**: accepted
**Deciders**: Project authors

## Context

PromptMetrics must support both local development (filesystem) and production (GitHub-backed versioning). The rest of the application should not care which backend is active.

## Decision

Define a `PromptDriver` interface with `listPrompts`, `getPrompt`, `createPrompt`, `listVersions`, `sync`, and `search`. A factory selects the implementation at runtime based on the `DRIVER` environment variable.

## Alternatives Considered

### Direct filesystem calls in controllers
- **Pros**: Simple, no indirection.
- **Cons**: Would prevent GitHub support and tightly couple storage to HTTP handlers.
- **Why not**: Would require a full refactor to add any new backend.

### Object Storage (S3/MinIO) driver
- **Pros**: Scalable, cloud-native.
- **Cons**: No native versioning semantics; would need to rebuild git-like features on top.
- **Why not**: Adds complexity without delivering the version history that git provides natively.

## Consequences

### Positive
- Swappable backends without touching controllers or routes.
- Testable with in-memory or mock drivers.
- Clear boundary between storage and API layers.

### Negative
- Interface must be broad enough to accommodate both local and remote semantics.
- Lowest-common-denominator design may omit backend-specific optimizations.

### Risks
- Feature drift between drivers.
- **Mitigation**: Both drivers implement the same interface and share SQLite for metadata indexing; integration tests run against both.
