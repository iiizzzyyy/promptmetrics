# ADR-0004: Local Bare Clone for GitHub Reads

**Date**: 2026-04-22
**Status**: accepted
**Deciders**: Project authors

## Context

Reading prompt content from the GitHub API on every request would introduce network latency, rate limits, and a hard dependency on GitHub uptime. Prompt retrieval must be sub-millisecond.

## Decision

Maintain a local bare clone of the GitHub repository. Reads use `git show ref:path` against the local clone. A background `git fetch` job (every 60s, configurable) keeps the clone fresh. Writes use the GitHub Contents API.

## Alternatives Considered

### GitHub API for every read
- **Pros**: Always up-to-date; no local disk usage.
- **Cons**: Rate limits (~5k/hr) and ~100ms+ latency unacceptable for prompt retrieval.
- **Why not**: Would make the system fragile and slow under load.

### Full working tree checkout
- **Pros**: Easy to inspect files directly.
- **Cons**: Wastes disk space and complicates concurrent access.
- **Why not**: A bare clone stores only the git object database, which is sufficient for `git show`.

### GitHub Releases as artifact store
- **Pros**: Immutable, versioned artifacts.
- **Cons**: Releases are heavy-weight and not designed for frequent small-file access.
- **Why not**: Would require creating a release for every prompt version.

## Consequences

### Positive
- Sub-millisecond reads insulated from GitHub API outages.
- Zero external dependency for reads after initial clone.
- Bare clones are disk-efficient.

### Negative
- Staleness window of up to 60s for new commits.
- Requires `git` binary in the container image.

### Risks
- Clone corruption or disk failure.
- **Mitigation**: Re-clone on failure; bare clones are cheaper to rebuild than full checkouts. Writes go through the API, so data is never lost.
