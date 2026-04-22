# ADR-0005: API and CLI Only, No Web UI

**Date**: 2026-04-22
**Status**: accepted
**Deciders**: Project authors

## Context

PromptMetrics is a backend registry and observability collector. Its consumers are applications and developers, not end-users. A web UI would add frontend maintenance burden and scope creep.

## Decision

Expose functionality exclusively through a REST API and a Node.js CLI (`commander`). No HTML templates, no JavaScript bundles, no CSS.

## Alternatives Considered

### React/Vue SPA
- **Pros**: Rich interactive experience; familiar to users.
- **Cons**: Doubles the codebase size; frontend frameworks have their own upgrade treadmill.
- **Why not**: A UI is not necessary for a programmatic tool; it would become a maintenance liability.

### Server-rendered HTML (e.g., EJS)
- **Pros**: Simple to add basic pages.
- **Cons**: Still adds UI complexity for a tool meant to be consumed programmatically.
- **Why not**: Would require session management, CSRF protection, and design work for marginal benefit.

## Consequences

### Positive
- Smaller bundle and Docker image.
- No frontend security surface (XSS, CSRF).
- All effort stays on API stability and performance.

### Negative
- Non-developers cannot browse prompts without curl or the CLI.
- No visual dashboard for telemetry (traces, runs, logs).

### Risks
- Users may request a UI later.
- **Mitigation**: API is stable and well-documented; a UI can be built as a separate client without server changes.
