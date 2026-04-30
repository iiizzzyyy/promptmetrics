# ADR-003: Streaming Protocol — NDJSON over fetch

**Status:** Accepted  
**Date:** 2026-04-29  

## Context

The old frontend used Socket.IO for LLM token streaming. The PRD explicitly ruled out Socket.IO in v1. We need a protocol for streaming tokens from the backend proxy to the browser.

## Decision

Adopt **NDJSON (newline-delimited JSON) streamed over a standard HTTP POST response** for playground output.  
Do NOT use Server-Sent Events (SSE) for the run endpoint.

## Rationale

| Concern | SSE | NDJSON over fetch | WebSocket/Socket.IO |
|---------|-----|-------------------|---------------------|
| Request body size | Limited by URL length for GET-based SSE | Unbounded POST body | Unbounded |
| Browser compatibility | Good | Excellent (ReadableStream) | Good (requires lib) |
| Proxy/Load balancer | Needs buffering config | Works out of the box | Needs sticky sessions |
| Cancellation | Close EventSource | AbortController | Close socket |
| Tool call support | Hard to interleave | Easy: JSON lines | Easy |
| Backend complexity | Extra `text/event-stream` formatting | Minimal: `res.write(JSON.stringify(chunk) + '\n')` | Requires Socket.IO server |

## Consequences

- **Easier:** Full control over headers and POST body via `fetch`; no special SSE parsing required beyond splitting on newlines.
- **Easier:** Works through standard reverse proxies and CDNs without special buffering configuration.
- **Easier:** Cancellation is trivial with `AbortController`.
- **Harder:** No automatic reconnect; the client must handle retries if needed.
- **Trade-off:** We accept a small amount of manual stream parsing in exchange for compatibility and simplicity.

## Implementation

- Backend sets `Content-Type: application/x-ndjson` and writes `JSON.stringify(chunk) + '\n'` for each chunk.
- Frontend uses `fetch` with `ReadableStream` and a `TextDecoder` to parse lines.
