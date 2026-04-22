# ADR-0001: Hybrid Storage Model — Git for Content, SQLite for Metadata

**Date**: 2026-04-22
**Status**: accepted
**Deciders**: Project authors

## Context

PromptMetrics needs to store prompt content with full version history while also serving metadata queries (list versions, search by name, filter by tag) with low latency. Using Git alone would make metadata queries slow; using a database alone would lose versioning and audit history.

## Decision

Use a hybrid model where prompt content lives in Git (filesystem or GitHub) and a SQLite database stores only metadata (name, version tag, commit SHA, timestamps). Reads join the two: SQLite provides the index, Git provides the content.

## Alternatives Considered

### PostgreSQL with built-in versioning
- **Pros**: Single system, ACID transactions, mature ecosystem.
- **Cons**: Adds operational complexity and still lacks true branching/rollback semantics.
- **Why not**: Replaces one operational burden with another without delivering native git semantics.

### S3 with DynamoDB index
- **Pros**: Scalable, durable, managed.
- **Cons**: Introduces cloud vendor lock-in and external dependencies.
- **Why not**: PromptMetrics is designed to be self-hosted and vendor-neutral.

### Pure Git (no database)
- **Pros**: Zero database to manage; everything is in git.
- **Cons**: Listing versions and searching would require scanning the filesystem or GitHub API on every request.
- **Why not**: Unacceptable latency for metadata-heavy operations.

## Consequences

### Positive
- Sub-millisecond metadata queries via SQLite indexes.
- Full git history (branching, rollback, blame) for prompt content.
- No vendor lock-in; works with local filesystem or any Git remote.

### Negative
- Two systems to manage; consistency between Git and SQLite must be maintained.
- Drivers must handle dual writes (git + SQLite) atomically.

### Risks
- SQLite and Git can drift if writes fail partially.
- **Mitigation**: Writes are atomic within the driver, and failures surface as errors to the caller.
