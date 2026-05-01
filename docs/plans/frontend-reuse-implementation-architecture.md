# Frontend Reuse — Architecture & System Design

**Status:** Proposed  
**Date:** 2026-04-29  
**Scope:** Port PromptSmith frontend assets into the PromptMetrics Next.js dashboard  
**Target Version:** 1.2.0 (Playground MVP)  

---

## 1. Architecture Decision Records

### ADR-001: Client State — Zustand + React Query (Hybrid)

#### Status
Accepted

#### Context
The old frontend (`pm-app-frontend`) uses Redux Toolkit with persistence for all state — server state, client UI state, and ephemeral form state are commingled. The new dashboard already uses TanStack React Query for server state (`ui/src/lib/query-client.ts`). The PRD asks whether to adopt Zustand for client-side UI state (drawers, split ratios, modal open/close).

We evaluated three options:

| Option | Pros | Cons |
|--------|------|------|
| **A. React Query only** | Single state library; less bundle weight | Awkward for non-server state (e.g., Monaco editor split pane sizes, playground panel visibility) |
| **B. Zustand + React Query** | Clean separation: React Query for server, Zustand for UI | +~3 KB gzipped; another API to learn |
| **C. Redux Toolkit (port old logic)** | Direct reuse of old slices | Heavy (~15 KB + persistence middleware); overkill for a dashboard that already abandoned Redux |

#### Decision
Adopt **Option B: Zustand for client UI state, React Query for server state.**

#### Consequences
- **Easier:** Playground layout state (pane sizes, active tab, drawer open/close) lives in a lightweight Zustand store without persistence. State resets on refresh, which is desirable for a tool UI.
- **Easier:** React Query continues to own caching, deduplication, and background refetching for all API data. No change to existing `ui/src/lib/query-client.ts`.
- **Harder:** Developers must decide where a piece of state belongs. Rule of thumb: if it came from `api.ts`, it is React Query; if it controls UI chrome, it is Zustand.
- **Reversible:** If Zustand proves unnecessary, its stores can be inlined into `useState` without touching React Query.

---

### ADR-002: Playground Proxy Architecture — Backend Proxy

#### Status
Accepted

#### Context
The Playground must call LLM providers (OpenAI, Anthropic, etc.) with workspace-scoped API keys. Two architectures were considered:

| Option | Pros | Cons |
|--------|------|------|
| **A. Browser calls providers directly** | Lowest latency; no backend streaming complexity | Exposes provider API keys in the browser; CORS restrictions on some providers; no audit trail; bypasses tenant scoping |
| **B. Backend proxy (`POST /v1/playground/run`)** | Keys remain server-side; audit logging via existing `auditLogService`; workspace-scoped rate limiting; can transform requests/responses | Adds streaming complexity to Express; slightly higher latency |

#### Decision
Adopt **Option B: Backend proxy through `POST /v1/playground/run`.**

#### Consequences
- **Easier:** Provider API keys are stored in a new `workspace_provider_keys` table (or encrypted env vars) and never reach the browser.
- **Easier:** Reuses existing `authenticateApiKey` and `tenantMiddleware` (`src/middlewares/promptmetrics-auth.middleware.ts`) for authz/authn.
- **Easier:** Audit trail is automatic — the existing `auditLog(action)` middleware can wrap the playground route.
- **Harder:** The backend must support streaming response forwarding (SSE or NDJSON) without buffering the full LLM response in memory.
- **Harder:** Error mapping from provider-specific formats (OpenAI vs Anthropic) to a unified client format requires a thin adapter layer.
- **Trade-off:** We accept ~50-100 ms of extra latency for the security and governance benefits.

---

### ADR-003: Streaming Protocol — NDJSON over fetch

#### Status
Accepted

#### Context
The old frontend used Socket.IO for LLM token streaming. The PRD explicitly rules out Socket.IO in v1. We need a protocol for streaming tokens from the backend proxy to the browser.

| Option | Pros | Cons |
|--------|------|------|
| **A. Server-Sent Events (SSE)** | Native browser API (`EventSource`); simple text format; works over HTTP/1.1 and HTTP/2; automatic reconnection | Unidirectional (server->client only); older browsers need polyfill; Express middleware ecosystem is mixed |
| **B. NDJSON over fetch (`ReadableStream`)** | Full control over headers and body; works with standard `fetch` | Requires manual stream parsing in the client; no automatic reconnect; more boilerplate |
| **C. WebSocket** | True bidirectional; low overhead after handshake | Requires `ws` library on backend; harder to auth via headers; overkill for unidirectional token streaming |
| **D. Short polling** | Simplest implementation | High latency; wasteful on provider tokens and backend CPU; poor UX for long outputs |

#### Decision
Adopt **Option B: NDJSON over fetch for token streaming.**  
Do NOT use SSE for the run endpoint.

#### Rationale

| Concern | SSE | NDJSON over fetch | WebSocket/Socket.IO |
|---------|-----|-------------------|---------------------|
| Request body size | Limited by URL length for GET-based SSE | Unbounded POST body | Unbounded |
| Browser compatibility | Good | Excellent (ReadableStream) | Good (requires lib) |
| Proxy/Load balancer | Needs buffering config | Works out of the box | Needs sticky sessions |
| Cancellation | Close EventSource | AbortController | Close socket |
| Tool call support | Hard to interleave | Easy: JSON lines | Easy |
| Backend complexity | Extra `text/event-stream` formatting | Minimal: `res.write(JSON.stringify(chunk) + '\n')` | Requires Socket.IO server |

#### Consequences
- **Easier:** Full control over headers and POST body via `fetch`; no special SSE parsing required beyond splitting on newlines.
- **Easier:** Works through standard reverse proxies and CDNs without special buffering configuration.
- **Easier:** Cancellation is trivial with `AbortController`.
- **Harder:** No automatic reconnect; the client must handle retries if needed.
- **Trade-off:** We accept a small amount of manual stream parsing in exchange for compatibility and simplicity.

---

### ADR-004: Table Library — TanStack Table

#### Status
Accepted

#### Context
The old frontend uses `ag-grid-react` for its Requests/Logs table. The PRD proposes TanStack Table for the new dashboard. The existing dashboard already uses a lightweight hand-written table (`ui/src/components/ui/table.tsx`) for simple lists.

| Option | Pros | Cons |
|--------|------|------|
| **A. ag-grid-react** | Feature-rich (grouping, pivoting, Excel export); direct reuse of old grid configs | Heavy (~200-400 KB gzipped); licensing complexity for enterprise features; styling does not map cleanly to shadcn/ui |
| **B. TanStack Table + shadcn/ui primitives** | Lightweight (~15 KB); headless — full control over markup; aligns with existing shadcn Table components | Requires building wrappers for advanced features (column resizing, drag-to-reorder) |
| **C. Hand-written table (current)** | Zero dependency | Re-inventing sorting, pagination, filtering for every page |

#### Decision
Adopt **Option B: TanStack Table for all list views, built on top of existing `ui/src/components/ui/table.tsx` primitives.**

#### Consequences
- **Easier:** Consistent with the dashboard's existing shadcn/ui stack. The `Table`, `TableHeader`, `TableRow`, `TableCell` primitives in `ui/src/components/ui/table.tsx` become the presentation layer; TanStack Table provides logic.
- **Easier:** Bundle impact is negligible compared to ag-grid. This keeps the dashboard under the 500 KB gzipped budget.
- **Easier:** Old frontend grid configs (column definitions, sort directions) can be mechanically translated to TanStack `columns` arrays.
- **Harder:** Advanced ag-grid features (server-side row model, range selection) are not available. The Playground logs table and A/B test results table will need custom implementations if those features are required later.
- **Trade-off:** We give up Excel export and pivoting in v1. If enterprise customers demand it, we can lazily-load ag-grid on a single page without bloating the global bundle.

---

## 2. System Component Diagram (C4 — Container Level)

```
+------------------------+         +------------------------------------------+
|  User Browser          |         |  Old Frontend (pm-app-frontend)          |
|  (Next.js dashboard)   |         |  React 19 + Vite + Redux + Socket.IO     |
+-----------+------------+         +---------------------+--------------------+
            |                                            |
            | HTTPS                                      | HTTPS
            v                                            v
+-----------+--------------------------------------------+--------------------+
|                         PromptMetrics Backend (Express)                      |
|  +-------------------+  +-------------------+  +------------------------+  |
|  | /v1/prompts       |  | /v1/playground/run|  | /v1/metrics/*          |  |
|  | /v1/logs          |  | /v1/playground/...|  | /v1/runs               |  |
|  | /v1/traces        |  | (NEW — proxy)     |  | /v1/evaluations        |  |
|  | /v1/audit-logs    |  |                   |  | (existing)             |  |
|  | (existing)        |  |                   |  |                        |  |
|  +---------+---------+  +---------+---------+  +------------------------+  |
|            |                      |                                         |
|            v                      v                                         |
|  +-------------------+  +-------------------+                               |
|  | PromptDriver      |  | PlaygroundService |                               |
|  | (GitHub/fs/S3)    |  | (LLM proxy)       |                               |
|  +---------+---------+  +---------+---------+                               |
|            |                      |                                         |
|            v                      v                                         |
|  +-------------------+  +-------------------+                               |
|  | SQLite / Postgres |  | OpenAI / Anthropic|                               |
|  | (metadata index)  |  | / Google / Ollama |                               |
|  +-------------------+  +-------------------+                               |
|                                                                             |
+-----------------------------------------------------------------------------+
```

### Data Flow: Playground Run (Streaming)

```
1. Browser: POST /v1/playground/run
   Headers: X-API-Key, X-Workspace-Id, Content-Type: application/json
   Body: { prompt_name, version_tag, variables, model, parameters, stream: true }

2. Express Route: authenticateApiKey -> tenantMiddleware -> requireScope('playground:run')
   -> PlaygroundController.run

3. PlaygroundService:
   a. Lookup workspace provider key from DB (encrypted at rest)
   b. Read prompt content from PromptDriver (GitHub/fs/S3)
   c. Render Mustache variables
   d. POST to provider API with stream: true
   e. Stream provider NDJSON chunks through to client as NDJSON

4. Browser StreamingOutputPanel:
   a. Open fetch request with ReadableStream
   b. Parse NDJSON chunks by splitting on newlines and JSON.parse
   c. Append tokens to React state
   d. On completion, persist run log via POST /v1/logs (background)
```

---

## 3. API Contract Mapping

### Old Frontend Endpoints (PromptSmith API) → New PromptMetrics Endpoints

The old frontend speaks to a PromptSmith backend with a different URL scheme. All new calls must target the existing `/v1/*` surface or new playground endpoints.

| Old Endpoint | Old Purpose | New Endpoint | New Purpose | Notes |
|--------------|-------------|--------------|-------------|-------|
| `GET /templates` | List prompts | `GET /v1/prompts` | List prompts | Direct mapping; pagination shape differs slightly |
| `GET /templates/:id` | Prompt detail | `GET /v1/prompts/:name?render=false` | Prompt detail | Old uses Mongo `_id`; new uses `name` as natural key |
| `GET /templates/:id/versions` | List versions | `GET /v1/prompts/:name/versions` | List versions | Direct mapping |
| `POST /templates/:id/run` | Run prompt | `POST /v1/playground/run` | Proxy run | New endpoint; adds streaming support |
| `GET /requests` | Execution logs | `GET /v1/logs` | Execution logs | Already exists; same data shape |
| `GET /workspaces/:id/llm-keys` | Provider keys | `GET /v1/playground/models` | Available models | New endpoint returns models, not raw keys |
| `GET /analytics/:id` | Template analytics | `GET /v1/metrics/prompts` | Prompt metrics | Aggregated by name/version instead of template ID |
| `POST /ab-tests` | Create A/B test | *(future)* `POST /v1/ab-tests` | Create A/B test | P1; backend not yet implemented |
| `GET /ab-tests` | List A/B tests | *(future)* `GET /v1/ab-tests` | List A/B tests | P1 |
| `POST /evaluations` | Create evaluation | `POST /v1/evaluations` | Create evaluation | Already exists |
| `GET /evaluations/:id/results` | Eval results | `GET /v1/evaluations/:id/results` | Eval results | Already exists |

### New Playground-Specific Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/v1/playground/run` | POST | `apiKey` + `playground:run` scope | Proxy run to LLM provider. Returns NDJSON if `stream=true`, JSON if `stream=false`. |
| `/v1/playground/models` | GET | `apiKey` | List available models per workspace. Reads from `workspace_models` config table. |
| `/v1/playground/variable-sets` | GET/POST/PATCH/DELETE | `apiKey` | CRUD for variable presets (stored in SQLite). |

### Request/Response Shapes

#### `POST /v1/playground/run`

```typescript
// Request
interface PlaygroundRunRequest {
  prompt_name: string;
  version_tag?: string;          // defaults to latest active
  variables: Record<string, string>;
  model: string;                 // provider-specific model ID, e.g. "gpt-4o"
  provider: "openai" | "anthropic" | "google" | "ollama";
  parameters: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
  };
  stream?: boolean;              // default true
}

// Response (stream=false)
interface PlaygroundRunResponse {
  run_id: string;
  output: string;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
  cost_usd: number;
  model: string;
  provider: string;
  created_at: number;
}

// Response (stream=true) — SSE chunks
// data: {"type":"token","content":"Hello"}
// data: {"type":"token","content":" world"}
// data: {"type":"finish","usage":{"tokens_in":10,"tokens_out":5},"cost_usd":0.0001}
```

---

## 4. State Management Strategy

### What Goes in React Query (Server State)

All data fetched from the backend, including:
- Prompt lists, details, versions (`/v1/prompts/*`)
- Logs, traces, runs, evaluations (`/v1/logs`, `/v1/traces`, `/v1/runs`, `/v1/evaluations`)
- Metrics time-series (`/v1/metrics/*`)
- Playground model list (`/v1/playground/models`)
- Variable sets (`/v1/playground/variable-sets`)

Query keys follow the existing convention in `ui/src/app/page.tsx`:
```typescript
['prompts', page, limit]
['prompts', name, 'versions']
['playground', 'models']
['playground', 'variable-sets']
```

### What Goes in Zustand (Client UI State)

Ephemeral UI state that does not survive refresh and does not need hydration:
- Playground layout pane sizes (editor/output split ratio)
- Active playground tab (`editor` | `analytics` | `evaluation` | `abtesting`)
- Drawer/modal open states (`showModelConfigDrawer`, `showVariableSetModal`)
- Selected model in the playground (not persisted — re-select on each session)
- Editor scroll position and cursor location (optional)
- Toast/notification queue (Sonner handles this, but Zustand can queue pre-Sonner state if needed)

### What Stays in `useState` (Local Component State)

State that is purely local to a single component and does not need to be shared:
- Form input values inside `VariableSetModal`
- Monaco editor content before save (if not lifted to Zustand for cross-tab sharing)
- Collapsible section open/close in `ModelConfigDrawer`

### Store Directory Structure

```
ui/src/
  lib/
    query-client.ts          # existing React Query client
  stores/
    playground.store.ts      # Zustand store for playground UI state
    layout.store.ts          # Zustand store for sidebar/drawer state (optional)
```

---

## 5. Error Handling and Retry Strategy

### React Query Retry Policy

The existing `queryClient` config (`ui/src/lib/query-client.ts`) uses:
```typescript
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});
```

For the Playground, we tighten the retry policy on mutations and relax it on queries:

| Context | Retry | Backoff | Rationale |
|---------|-------|---------|-----------|
| `useQuery` for metrics/lists | 1 retry | exponential | Transient network glitches |
| `useQuery` for playground models | 2 retries | exponential | Provider list may fail if backend is warming up |
| `useMutation` for `POST /v1/playground/run` | 0 retries | none | LLM runs are not idempotent; retrying could double-charge tokens |
| `useMutation` for save variable set | 2 retries | linear | Safe to retry |

### Global Error Boundary

Add a React error boundary around the Playground page to catch rendering crashes (e.g., Monaco initialization failures). The boundary should:
1. Log to console (and eventually Sentry).
2. Display a fallback UI: "Playground encountered an error. Reload to retry."
3. Provide a "Reset" button that clears the Zustand store and reloads the page.

### API Error Mapping

The `api.ts` client currently throws generic `Error` objects. For the Playground, we introduce typed errors:

```typescript
class PlaygroundError extends Error {
  constructor(
    message: string,
    public code: 'PROVIDER_ERROR' | 'RATE_LIMITED' | 'INVALID_MODEL' | 'TIMEOUT' | 'UNKNOWN',
    public providerError?: unknown
  ) {
    super(message);
  }
}
```

The backend proxy should normalize provider errors:
- OpenAI 429 -> `PlaygroundError('Rate limited by provider', 'RATE_LIMITED')`
- Anthropic 529 -> `PlaygroundError('Provider overloaded', 'RATE_LIMITED')`
- Timeout after 60s -> `PlaygroundError('Request timed out', 'TIMEOUT')`

### Streaming Error Handling

If the SSE stream encounters an error mid-generation:
1. The backend sends a final SSE event: `data: {"type":"error","code":"PROVIDER_ERROR","message":"..."}`
2. The frontend `StreamingOutputPanel` catches this, stops the stream, and renders an inline error banner.
3. The partial output is preserved so the user can see what was generated before the failure.

---

## 6. Security Considerations for the Playground Proxy

### 6.1 API Key Isolation

Provider API keys must be stored per-workspace, not globally. Proposed schema addition:

```sql
CREATE TABLE workspace_provider_keys (
  workspace_id TEXT NOT NULL,
  provider TEXT NOT NULL,         -- 'openai', 'anthropic', 'google', 'ollama'
  api_key_encrypted TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, provider)
);
```

Encryption at rest uses the existing `API_KEY_SALT` or a dedicated `PROVIDER_KEY_SECRET` env var.

### 6.2 Scope-Based Authorization

The `authenticateApiKey` middleware (`src/middlewares/promptmetrics-auth.middleware.ts`) attaches `req.apiKey.scopes`. A new scope `playground:run` is required for the proxy endpoint. This prevents read-only API keys from triggering LLM calls.

### 6.3 Rate Limiting

The Playground proxy is a cost vector. Implement per-workspace rate limiting:
- 60 runs per minute per workspace (configurable via `PLAYGROUND_RATE_LIMIT_RPM`).
- 10 concurrent streaming connections per workspace.
- Use `express-rate-limit` or an in-memory token bucket (sufficient for single-node; Redis-backed for multi-node).

### 6.4 Input Validation

Before proxying, validate:
- `max_tokens` <= 4096 (or provider-specific limit).
- `temperature` between 0 and 2.
- `prompt_name` exists and is active.
- Rendered prompt length <= model context length (lookup from `workspace_models` table).

Validation uses Zod on both frontend (`ui`) and backend (`src/validation-schemas/`).

### 6.5 Audit Logging

Every playground run generates an audit log entry via the existing `auditLogService`:
```typescript
auditLogService.enqueue({
  action: 'playground:run',
  prompt_name: req.body.prompt_name,
  version_tag: req.body.version_tag,
  api_key_name: req.apiKey.name,
  ip_address: req.ip,
  workspace_id: req.workspaceId,
  metadata: { model, provider, stream },
});
```

### 6.6 Output Sanitization

If future compliance features require PII scanning, the proxy is the chokepoint where output can be scanned before streaming to the client. This is not implemented in v1 but the architecture supports it.

### 6.7 CORS and CSRF

The Playground runs in the Next.js dashboard on `localhost:3001` (or a Vercel domain). The backend is on `localhost:3000`. The existing `cors()` middleware in `src/app.ts` allows all origins. For production:
- Restrict CORS to the dashboard origin via `CORS_ORIGIN` env var.
- Ensure `X-API-Key` is never logged (the `authenticateApiKey` middleware hashes it before DB lookup, but raw keys must not appear in logs).

---

## 7. Component Reuse Strategy (Playground MVP)

### Direct Reuse (minimal changes)

| Old Component | New Location | Changes |
|---------------|--------------|---------|
| `ParameterSchemaBuilder.tsx` | `ui/src/components/playground/ParameterSchemaBuilder.tsx` | Remove Redux dispatch; lift state to props or Zustand |
| `VariableSetsPanel.tsx` (UI tree) | `ui/src/components/playground/VariableSetsPanel.tsx` | Replace old API calls with `api.ts` hooks |
| `StreamingOutputPanel.tsx` (rendering logic) | `ui/src/components/playground/StreamingOutputPanel.tsx` | Replace Socket.IO listener with SSE parser |
| `ModelSelector.tsx` | `ui/src/components/playground/ModelSelector.tsx` | Swap styling to shadcn Select + Tailwind v3 tokens |

### Adapt & Port (significant rewrite of data layer)

| Old Component | New Location | Changes |
|---------------|--------------|---------|
| `PlaygroundLayout.tsx` | `ui/src/app/playground/page.tsx` + subcomponents | Replace `AppLayout` with `DashboardLayout`; replace Redux `core` with React Query + Zustand; replace `useNavigate` with Next.js `useRouter`; adapt to shadcn Resizable |
| `EditorTab.tsx` | `ui/src/components/playground/EditorTab.tsx` | Keep Monaco integration; replace variable binding logic with React Query prompt fetch; remove old template/permission checks |
| `ModelConfigDrawer.tsx` | `ui/src/components/playground/ModelConfigDrawer.tsx` | Replace Mixpanel tracking with optional `window.gtag` or noop; swap drawer to shadcn Drawer/Sheet; replace Yup with Zod |
| `VariableSetModal.tsx` | `ui/src/components/playground/modals/VariableSetModal.tsx` | Replace Yup with Zod; replace old API service with `api.ts` mutation |

### Do Not Reuse

| Old Component | Reason |
|---------------|--------|
| `AppLayout` (old sidebar + header) | New `DashboardLayout` (`ui/src/components/layout/DashboardLayout.tsx`) is superior and already integrated |
| `AnalyticsTab.tsx` | Dashboard overview (`ui/src/app/page.tsx`) already provides metrics; playground analytics are P1/P2 |
| `ABTestingTab.tsx` | P1 initiative; backend `/v1/ab-tests` does not exist yet |
| `EvaluationTab.tsx` | P1 initiative; needs dataset backend |
| Socket.IO client code | Replaced by SSE (ADR-003) |

---

## 8. File Inventory (New & Modified)

### New Backend Files
- `src/services/playground.service.ts` — LLM proxy logic, provider adapters
- `src/controllers/playground.controller.ts` — HTTP handling for SSE
- `src/routes/playground.route.ts` — route mount
- `src/validation-schemas/playground.schema.ts` — Zod/Joi validation for run request
- `migrations/011_add_workspace_provider_keys.ts` — provider key storage
- `tests/integration/playground.test.ts` — proxy endpoint tests
- `tests/unit/playground.service.test.ts` — provider adapter unit tests

### Modified Backend Files
- `src/app.ts` — mount `createPlaygroundRoutes()`
- `docs/openapi.yaml` — document `/v1/playground/*`
- `src/middlewares/promptmetrics-auth.middleware.ts` — add `playground:run` scope checks

### New Frontend Files
- `ui/src/app/playground/page.tsx` — Playground shell
- `ui/src/stores/playground.store.ts` — Zustand store
- `ui/src/components/playground/PlaygroundLayout.tsx` — split-pane wrapper using shadcn Resizable
- `ui/src/components/playground/EditorTab.tsx`
- `ui/src/components/playground/StreamingOutputPanel.tsx`
- `ui/src/components/playground/ModelSelector.tsx`
- `ui/src/components/playground/VariableSetsPanel.tsx`
- `ui/src/components/playground/ModelConfigDrawer.tsx`
- `ui/src/components/playground/modals/VariableSetModal.tsx`
- `ui/src/lib/streaming.ts` — SSE fetch parser

### Modified Frontend Files
- `ui/package.json` — add `zustand`, `monaco-editor`, `@monaco-editor/react`
- `ui/src/lib/api.ts` — add `playgroundApi` methods
- `ui/src/components/layout/AdminSidebar.tsx` — add "Playground" nav item
