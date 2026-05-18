# PromptMetrics

[![npm](https://img.shields.io/npm/v/promptmetrics.svg)](https://www.npmjs.com/package/promptmetrics)
[![CI](https://github.com/iiizzzyyy/promptmetrics/actions/workflows/ci.yml/badge.svg)](https://github.com/iiizzzyyy/promptmetrics/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)

> Lightweight, self-hosted prompt registry with Git-backed versioning, metadata logging, and evaluations for LLM observability.

PromptMetrics solves six hard problems in LLM application development without adding operational complexity:

1. **Prompt Versioning** — Store, version, and retrieve prompts via a REST API or CLI. Every change is a commit with full history, branching, and rollback.
2. **Metadata Logging** — Log structured metadata about every LLM request (model, tokens, latency, cost, custom tags) to stdout JSON or OpenTelemetry.
3. **Agent Telemetry** — Track agent loops with traces and spans, workflow runs with input/output, and tag prompt versions with environment labels — all without external APM tools.
4. **Evaluations** — Create, score, and manage prompt evaluations to track quality, latency, and accuracy over time.
5. **A/B Testing** — Compare two prompt versions statistically, collect metrics, and promote the winner.
6. **Compliance & Security** — Scan prompts for PII, API keys, and sensitive data with a built-in risk engine.

Self-hosted with no vendor lock-in. Prompt content lives in Git, not a database. Optional Web UI Dashboard and LLM Playground included.

---

## What's New in v1.5.2

- **Error `detailsType` Field** — All error responses now include a `detailsType` field (`"fields"` for validation errors, `"context"` for business errors) so clients can programmatically distinguish between `{ fields: string[] }` and `{ key: value }` detail shapes.
- **Filesystem Driver Fix** — Removed redundant `fs.existsSync` check that threw a raw `Error` (causing 500 responses). The service-layer DB check is the authoritative duplicate guard and returns proper `400 BAD_REQUEST` with structured details. Stale files from previous runs are now safely overwritten.
- **Rate Limit Defaults** — Raised default `RATE_LIMIT_MAX_REQUESTS` from 100 to 300 per 60-second window. Previous default was too aggressive for bulk operations.
- **Label `version_tag` Auto-Population** — `POST /v1/prompts/:name/labels` now makes `version_tag` optional. When omitted, auto-populates from the prompt's latest active version. Added prompt existence validation (404) and version validation (400).
- **Compliance Pagination Consistency** — `GET /v1/compliance/scores` now accepts offset pagination (`page` + `limit`) alongside cursor pagination (`cursor` + `limit`). Offset mode returns the standard `{ items, total, page, limit, totalPages }` response. Cursor mode is deprecated but still functional.

### Previous: v1.5.1

- **Filesystem Duplicate Prompt Fix** — Creating a prompt that already exists on disk now returns an error instead of silently overwriting the file.
- **SQLite Rate Limit Fix** — Fixed race condition that caused premature 429s and stale `RateLimit-Remaining` headers under concurrent requests. Rate limit checks are now atomic via `db.transaction()`.
- **Error Response Normalization** — All validation errors now return `422 VALIDATION_FAILED` with a consistent `details` shape (`{ fields: string[] }` for Joi errors, `{ key: value }` for business errors). Query validation errors previously returned `400 BAD_REQUEST` with bare `string[]` details.

### Previous: v1.5.0

- **Trace & Run Deletion** — `DELETE /v1/traces/:trace_id` and `DELETE /v1/runs/:run_id` endpoints for cleaning up data. Trace deletion cascades to spans. Both require `write` scope and produce audit log entries.
- **Expanded Span Status** — Span `status` now accepts `unset`, `ok`, `error`, and `running` (matching OpenTelemetry conventions). `status` is optional and defaults to `unset`.
- **Compliance Scores Total** — `GET /v1/compliance/scores` now returns a `total` count alongside `items` and `nextCursor`.
- **Duplicate Prompt Error** — Creating a prompt that already exists as `active` returns `400` with details instead of silently upserting.
- **A/B Test Error Details** — Insufficient logs/scores `400` errors now include version and score counts in the `details` field.
- **Compliance Pagination Docs** — Documented that compliance scores use cursor pagination while all other list endpoints use offset pagination.
- **Schema Cache Fix** — Evaluation rule engine schema cache used object reference identity, so it never hit. Now uses `JSON.stringify` as the cache key.
- **Redis KEYS → SCAN** — Cache invalidation replaced blocking `KEYS` command with non-blocking `SCAN` iteration to prevent production latency spikes.
- **Dataset Pagination** — `DatasetController.listDatasets` now uses `parsePagination()` to clamp queries, preventing unbounded result sets.
- **Env Var Empty String Fix** — `getEnv()` treated empty-string env vars as unset (`DRIVER=""` silently fell back to `filesystem`). Now uses nullish coalescing (`??`).
- **Anthropic 529 Retryable** — HTTP 529 (Overloaded) now maps to `rateLimit` instead of `unknown`, making it retryable by callers.
- **Dead Health Route Removed** — The Express `/health/deep` handler was unreachable (shadowed by `server.ts`). Removed to avoid confusion.
- **Redis Graceful Shutdown** — `closeRedis()` is now called during shutdown; previously Redis connections were leaked.
- **Postgres Transaction Retry Removed** — `RETURNING id` retry inside transactions was impossible (PostgreSQL aborts the transaction on error). Simplified to skip retry.
- **Ollama Streaming Fix** — Final JSON fragment without trailing newline was silently discarded. Buffer is now processed after stream ends.
- **Active Version NULL Fix** — `getPrompt` active_version subquery now filters for `active_version_id IS NOT NULL`, preventing wrong version from being served.
- **Eval NULL version_tag** — `getResultsForVersion` now handles NULL `version_tag` evaluations correctly, fixing A/B tests linked to versionless evaluations.
- **Streaming Circuit Breaker** — Playground `streamChatCompletion` now checks circuit breaker state and tests connection through the breaker.
- **Cost Estimation Warning** — Unknown Anthropic models now log a warning when falling back to default pricing.

### Previous: v1.3.0

- BFF Session Cookie Auth, CSRF Protection, Scoped Authorization on All Mutations
- Real Error Rate Metrics, Audit Logging on All Mutations
- Compliance Scanning Engine, A/B Test Real Scores, Promote Winner Transaction
- Radix UI Migration, Playground Validation, Resizable Panels
- Error Boundary, Settings Sheet, AlertDialog Confirmations
- E2E Console Hygiene, Accessibility Audit

---

## Table of Contents

- [What's New in v1.4.0](#whats-new-in-v140)
- [Why PromptMetrics?](#why-promptmetrics)
- [Features](#features)
- [Architecture](#architecture)
- [Quickstart](#quickstart)
  - [npm Global Install](#option-a-npm-global-install-fastest)
  - [Docker Compose](#option-b-docker-compose)
  - [From Source](#option-c-from-source)
- [Configuration](#configuration)
- [API Overview](#api-overview)
- [CLI Overview](#cli-overview)
- [SDK Overview](#sdk-overview)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

---

## Why PromptMetrics?

| Concern | Without PromptMetrics | With PromptMetrics |
|---------|----------------------|-------------------|
| Prompt versions | Scattered in code repos, PRs, or Google Docs | Centralized, versioned, git-backed registry |
| Prompt changes | Require code deploys | Update via API/CLI, apps fetch latest at runtime |
| LLM observability | Ad-hoc logging, no structure | Structured metadata with cost, latency, token tracking |
| Agent debugging | Black box execution | Traces, spans, and runs with full timeline |
| Environment management | Hardcoded version strings | Label-based resolution (`production`, `staging`) |
| Evaluations | Manual prompt quality checks | Structured evaluation suites with scoring and history |
| Dashboard | No central UI for prompt ops | Optional Next.js observability dashboard with charts, traces, logs, runs, A/B tests, compliance, and metrics |
| A/B Testing | Manual A/B testing with spreadsheets | Built-in statistical comparison with winner promotion |
| Compliance | Manual security reviews | Automated PII/API key scanning with risk scores |
| Playground | Separate LLM provider accounts | Unified proxy for OpenAI, Anthropic, Cohere, Ollama, Azure OpenAI |
| Operational cost | Managed SaaS fees, data egress | Self-hosted, single-node, zero external deps |

---

## Features

- **Git-Native Versioning** — Prompt content lives in Git (local filesystem or GitHub). Every version is immutable and traceable.
- **Hybrid Storage** — SQLite indexes metadata for sub-millisecond queries; Git stores content for auditability. PostgreSQL and S3 backends also supported.
- **Atomic Prompt Writes** — Two-phase commit with pending/active status and a background reconciliation job to heal incomplete writes.
- **Template Rendering** — Mustache-style variable substitution in prompts (`Hello {{name}}!`).
- **Structured Logging** — Log LLM metadata (model, tokens, latency, cost) with validated key-value tags, including nested objects and arrays.
- **Agent Telemetry** — Built-in traces, spans, and workflow runs without Jaeger, Zipkin, or DataDog.
- **Evaluations** — Create evaluation suites, record scores, and track prompt quality metrics over time.
- **Evaluation Runs** — Execute evaluation suites against datasets with built-in budget tracking and cost controls.
- **Datasets** — Create and manage test datasets for structured evaluation runs. Deletion in the UI requires a confirmation dialog to prevent accidental loss.
- **Budget Service** — Track spend and enforce budget limits during evaluation runs.
- **A/B Testing** — Run side-by-side tests against two prompt versions, measure performance with real evaluation scores from logs, and promote winning versions with an automatic `production` label.
- **Compliance Engine** — Scan prompts for PII (email, SSN, phone, credit card), API keys, URLs, and IP addresses with automated risk scoring. Results are paginated and support detail lookup by ID.
- **Playground** — Proxy LLM chat and completion calls through registered providers (OpenAI, Anthropic, Cohere, Ollama, Azure OpenAI) with input validation, stream timeouts, and lazy provider initialization.
- **Environment Labels** — Tag prompt versions with labels like `production` or `v2-test` and resolve them at runtime.
- **API Key Auth** — HMAC-SHA256 hashed keys with scoped permissions (`read`, `write`, `admin`), optional expiration, and master keys that can access any workspace. The dashboard uses a BFF proxy pattern so keys are never stored in browser localStorage.
- **API Key Management** — Create, list, and revoke keys programmatically via `/v1/api-keys`.
- **Per-API-Key Rate Limiting** — Sliding window rate limits with Redis or SQLite backends.
- **Multi-Tenancy** — Workspace isolation via `X-Workspace-Id` header.
- **OpenTelemetry Export** — Optional OTLP export for operators who already have an observability stack.
- **Observability Dashboard** — Next.js UI with pages for prompts, logs, traces, runs, labels, evaluations, A/B tests, datasets, compliance, playground, audit logs, GitOps promotion, health status, and settings. Built with Radix UI primitives and free of hydration errors.
- **Metrics Dashboard** — Time-series metrics, per-prompt usage statistics, evaluation trends, and activity summaries.
- **Node.js & Python SDKs** — First-class client libraries for programmatic access.
- **GitHub Webhooks** — Immediate sync on push events via webhook endpoint.
- **Circuit Breaker** — GitHub API calls wrapped in an Opossum circuit breaker with exponential backoff on 429 responses.
- **Migration System** — `umzug`-based migration runner with TypeScript migration files in `migrations/` supporting SQLite and PostgreSQL.
- **Async Audit Log Queue** — `AuditLogService` batches audit entries and flushes to the database asynchronously.
- **Audit Logs Explorer** — Query and visualize audit logs in the dashboard with filtering and pagination.
- **GitOps Promotion Widget** — Visual interface for promoting prompt versions through Git-backed environments.
- **Health Status Panel** — Real-time dashboard panel showing system health and dependency status.

---

## Architecture

```
  +-------------+      +-----------------+      +-----------------------+
  |  API / CLI  |----->|   Express App   |----->|  SQLite / PostgreSQL  |
  +-------------+      +-----------------+      |  - prompts index      |
         |                   |                   |  - api_keys           |
         |                   |                   |  - logs               |
         v                   v                   |  - audit_logs         |
  +-------------+      +-----------------+      |  - traces             |
  |   OTel      |      |  Storage Driver |      |  - spans              |
  |  (opt-in)   |      |  - filesystem   |      |  - runs               |
  +-------------+      |  - github       |      |  - labels             |
  |   Redis     |      |  - s3           |      |  - evaluations        |
  |  (opt-in)   |      +-----------------+      |  - datasets           |
  +-------------+            |                  |  - ab_tests           |
                             |                  |  - eval_runs          |
                             v                  |  - compliance_scans   |
                      +------------------+      |  - budget_tracking    |
                      |   Git / Files    |      |  - playground         |
                      |  - content       |      +-----------------------+
                      |  - history       |
                      +------------------+
```

**Design principles:**
- **Prompt content is code** — Version it like code (Git), not like data (database rows).
- **Metadata is data** — SQLite is the default for fast, structured queries over indexes and logs. PostgreSQL is available for networked or multi-node deployments.
- **No proxy, no lock-in** — PromptMetrics serves prompts and collects logs, but LLM inference happens in your code.

Read the full architecture in [docs/architecture.md](docs/architecture.md).

---

## Quickstart

### Option A: npm Global Install (Fastest)

```bash
npm install -g promptmetrics
promptmetrics-server
```

Generate an API key (in another terminal):
```bash
node $(npm root -g)/promptmetrics/dist/scripts/generate-api-key.js --workspace default read,write
# => pm_xxxxxxxx... (store this)
```

### Option B: Docker Compose

```bash
git clone https://github.com/iiizzzyyy/promptmetrics.git
cd promptmetrics
cp .env.example .env
# Edit .env and set API_KEY_SALT
docker compose up --build
```

Generate an API key:
```bash
docker compose exec promptmetrics node dist/scripts/generate-api-key.js --workspace default read,write
# => pm_xxxxxxxx... (store this)
```

### Option C: From Source

```bash
git clone https://github.com/iiizzzyyy/promptmetrics.git
cd promptmetrics
cp .env.example .env          # set API_KEY_SALT and other config
npm install
npm run build
npm run db:init               # initialize the SQLite database
node dist/scripts/generate-api-key.js --workspace default read,write
# => pm_xxxxxxxx... (store this)
promptmetrics-server
```

### Configure the CLI

```bash
promptmetrics init
# Edit promptmetrics.yaml with your server URL and API key
```

### Create your first prompt

```bash
promptmetrics create-prompt --file welcome.json
```

Example `welcome.json`:

```json
{
  "name": "welcome",
  "version": "1.0.0",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello {{name}}!" }
  ],
  "variables": { "name": { "type": "string", "required": true } }
}
```

### Retrieve and render

```bash
promptmetrics get-prompt welcome --var name=Alice
# => "messages": [{ "role": "system", "content": "You are a helpful assistant." }, { "role": "user", "content": "Hello Alice!" }]
```

### Log metadata

```bash
promptmetrics log \
  --prompt-name welcome \
  --version 1.0.0 \
  --provider openai \
  --model gpt-4o \
  --tokens-in 10 \
  --tokens-out 20 \
  --latency-ms 500 \
  --cost-usd 0.001
```

### Track an agent loop

```bash
TRACE=$(promptmetrics create-trace --prompt-name welcome | jq -r '.trace_id')
promptmetrics add-span "$TRACE" --name fetch-prompt --status ok --start-time 1000 --end-time 2000
promptmetrics get-trace "$TRACE"
```

### Track a workflow run

```bash
RUN=$(promptmetrics create-run --workflow headline-agent --input topic=AI | jq -r '.run_id')
promptmetrics update-run "$RUN" --status completed --output headline="AI Breakthrough"
```

### Tag a prompt version

```bash
promptmetrics add-label welcome production --version 1.0.0
promptmetrics get-label welcome production
```

---

## Configuration

All configuration is environment-variable driven. No config files required for the server.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | HTTP server port |
| `API_KEY_SALT` | **Yes** | — | Salt for hashing API keys (32+ chars in production) |
| `DRIVER` | No | `filesystem` | `filesystem`, `github`, or `s3` |
| `SQLITE_PATH` | No | `./data/promptmetrics.db` | SQLite file path |
| `DATABASE_URL` | No | — | PostgreSQL connection URL (falls back to SQLite) |
| `GITHUB_REPO` | If driver=github | — | `owner/repo` format |
| `GITHUB_TOKEN` | If driver=github | — | GitHub PAT or App token |
| `GITHUB_SYNC_INTERVAL_MS` | No | `60000` | Git fetch interval in ms |
| `GITHUB_WEBHOOK_SECRET` | No | — | Secret for GitHub webhook push events |
| `S3_BUCKET` | If driver=s3 | — | S3 bucket name |
| `S3_REGION` | If driver=s3 | — | AWS region |
| `S3_ACCESS_KEY` | If driver=s3 | — | AWS access key |
| `S3_SECRET_KEY` | If driver=s3 | — | AWS secret key |
| `S3_ENDPOINT` | No | — | Custom S3-compatible endpoint |
| `S3_PREFIX` | No | — | Key prefix for prompt objects |
| `REDIS_URL` | No | — | Redis connection URL for caching and rate limiting |
| `OTEL_ENABLED` | No | `false` | Enable OpenTelemetry |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | If OTEL=true | — | OTLP collector URL |
| `RATE_LIMIT_WINDOW_MS` | No | `60000` | Rate-limit time window in milliseconds |
| `RATE_LIMIT_MAX_REQUESTS` | No | `300` | Max requests per window per API key |
| `API_KEY_LAST_USED_DEBOUNCE_MS` | No | `60000` | Minimum ms between `last_used_at` writes (reduces SQLite contention) |
| `PROMPT_RECONCILE_INTERVAL_MS` | No | `60000` | Interval in ms for the reconciliation job to heal pending prompts |

See [docs/configuration.md](docs/configuration.md) for advanced configuration.

---

## API Overview

Base URL: `http://localhost:3000`

Authentication: All endpoints except `/health` require `X-API-Key` header. Mutation endpoints (POST, PUT, PATCH, DELETE) additionally require the `write` scope.

Multi-tenancy: Pass `X-Workspace-Id` header to scope all data. API keys are validated against their assigned workspace. Master keys with `workspace_id = '*'` can access any workspace.

### Prompts
- `GET /v1/prompts` — List prompts (paginated, searchable)
- `GET /v1/prompts/:name` — Get a prompt (with optional variable rendering)
- `GET /v1/prompts/:name/versions` — List versions of a prompt
- `POST /v1/prompts` — Create a new prompt

### Logs
- `GET /v1/logs` — List logs (paginated)
- `POST /v1/logs` — Log metadata for an LLM request

### Traces & Spans
- `GET /v1/traces` — List traces (paginated)
- `POST /v1/traces` — Create a trace
- `GET /v1/traces/:trace_id` — Get a trace with spans
- `POST /v1/traces/:trace_id/spans` — Add a span
- `DELETE /v1/traces/:trace_id` — Delete a trace and its spans (write scope)

### Workflow Runs
- `POST /v1/runs` — Create a workflow run
- `GET /v1/runs` — List runs
- `PATCH /v1/runs/:run_id` — Update a run
- `DELETE /v1/runs/:run_id` — Delete a run (write scope)

### Prompt Labels
- `POST /v1/prompts/:name/labels` — Tag a version
- `GET /v1/prompts/:name/labels/:label_name` — Resolve label to version

### API Keys
- `POST /v1/api-keys` — Create an API key (admin scope)
- `GET /v1/api-keys` — List API keys (admin scope)
- `DELETE /v1/api-keys/:id` — Revoke an API key (admin scope)

### Evaluations
- `POST /v1/evaluations` — Create an evaluation
- `GET /v1/evaluations` — List evaluations
- `GET /v1/evaluations/:id` — Get an evaluation
- `POST /v1/evaluations/:id/results` — Add a result
- `GET /v1/evaluations/:id/results` — List results
- `POST /v1/evaluations/:id/run` — Run an evaluation suite
- `GET /v1/evaluations/:id/run` — List evaluation runs
- `DELETE /v1/evaluations/:id` — Delete an evaluation

### A/B Tests
- `POST /v1/ab-tests` — Create an A/B test
- `GET /v1/ab-tests` — List A/B tests
- `GET /v1/ab-tests/:id` — Get an A/B test
- `POST /v1/ab-tests/:id/run` — Run the test
- `POST /v1/ab-tests/:id/promote` — Promote the winning variant and create a `production` label
- `DELETE /v1/ab-tests/:id` — Delete an A/B test

### Datasets
- `POST /v1/datasets` — Create a dataset
- `GET /v1/datasets` — List datasets
- `GET /v1/datasets/:id` — Get a dataset
- `DELETE /v1/datasets/:id` — Delete a dataset

### Compliance
- `POST /v1/compliance/scan` — Scan prompt text for violations
- `GET /v1/compliance/scores` — List compliance scores (paginated)
- `GET /v1/compliance/scores/:id` — Get a compliance score by ID

### Playground
- `GET /v1/playground/models` — List available LLM models
- `POST /v1/playground/chat` — Chat completion proxy
- `POST /v1/playground/chat/stream` — Streaming chat completion proxy
- `POST /v1/playground/completions` — Text completion proxy

### Metrics
- `GET /v1/metrics/time-series` — Daily request counts, tokens, latency, and error rates (window: 7d|30d|90d)
- `GET /v1/metrics/prompts` — Per-prompt usage metrics
- `GET /v1/metrics/evaluations` — Evaluation score trends over time
- `GET /v1/metrics/activity` — Activity summary with recent runs

### Audit
- `GET /v1/audit-logs` — Query audit logs (admin scope)

See [docs/api.md](docs/api.md) for the complete reference.

---

## CLI Overview

```bash
promptmetrics init                         # Create promptmetrics.yaml
promptmetrics create-prompt --file welcome.json
promptmetrics list-prompts
promptmetrics get-prompt welcome --version v1.0.0
promptmetrics import --dir ./my-prompts/
promptmetrics export --out ./backup/
promptmetrics log --prompt-name welcome --version 1.0.0
promptmetrics create-trace --prompt-name welcome
promptmetrics create-run --workflow headline-agent
promptmetrics add-label welcome production --version 1.0.0
```

See [docs/cli.md](docs/cli.md) for full documentation.

---

## SDK Overview

### Node.js

```typescript
import { PromptMetrics } from 'promptmetrics-sdk';

const client = new PromptMetrics({
  baseUrl: 'http://localhost:3000',
  apiKey: 'pm_xxxxxxxx',
});

// Create a prompt
await client.prompts.create({
  name: 'welcome',
  version: '1.0.0',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello {{name}}!' },
  ],
  variables: { name: { type: 'string', required: true } },
});

// Retrieve and render
const rendered = await client.prompts.get('welcome', {
  variables: { name: 'Alice' },
});

// Log metadata
await client.logs.create({
  prompt_name: 'welcome',
  version_tag: '1.0.0',
  provider: 'openai',
  model: 'gpt-4o',
  tokens_in: 10,
  tokens_out: 20,
  latency_ms: 500,
  cost_usd: 0.001,
});
```

### Python

```python
from promptmetrics import PromptMetrics

client = PromptMetrics(
    base_url="http://localhost:3000",
    api_key="pm_xxxxxxxx",
)

# Create a prompt
client.prompts.create({
    "name": "welcome",
    "version": "1.0.0",
    "messages": [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello {{name}}!"},
    ],
    "variables": {"name": {"type": "string", "required": True}},
})

# Retrieve and render
rendered = client.prompts.get("welcome", variables={"name": "Alice"})

# Log metadata
client.logs.create({
    "prompt_name": "welcome",
    "version_tag": "1.0.0",
    "provider": "openai",
    "model": "gpt-4o",
    "tokens_in": 10,
    "tokens_out": 20,
    "latency_ms": 500,
    "cost_usd": 0.001,
})
```

See [docs/sdk.md](docs/sdk.md) for full documentation.

---

## Dashboard

PromptMetrics includes an optional Next.js observability dashboard in the `ui/` directory. It provides a visual interface for:

- Monitoring prompt usage, costs, and latency with time-series charts
- Browsing execution logs with token and cost breakdowns
- Inspecting agent traces and their span trees
- Tracking evaluation scores over time
- Managing A/B tests, datasets, compliance scans, and the LLM playground
- Exploring audit logs with filtering and pagination
- Promoting prompt versions via the GitOps promotion widget
- Checking system health on the real-time status panel

### Quick Start

```bash
# 1. Start the backend API (port 3000)
npm run build
npm start

# 2. Generate an API key
node dist/scripts/generate-api-key.js --workspace default read,write

# 3. (Optional) Seed demo data for a populated dashboard
node dist/scripts/seed-demo-data.js

# 4. Start the UI (port 3001)
cd ui
npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001). The dashboard authenticates through a BFF proxy — your API key is never stored in browser localStorage.

See [`ui/README.md`](ui/README.md) for the complete user guide: authentication, page-by-page walkthrough, metrics API reference, workspace switching, and common workflows.

---

## Documentation

| Document | Purpose |
|----------|---------|
| [docs/architecture.md](docs/architecture.md) | System design, storage drivers, request flows |
| [docs/api.md](docs/api.md) | Complete REST API reference |
| [docs/cli.md](docs/cli.md) | CLI commands and usage |
| [docs/sdk.md](docs/sdk.md) | Node.js SDK reference |
| [ui/README.md](ui/README.md) | Dashboard UI user guide |
| [SECURITY.md](SECURITY.md) | Security policy and best practices |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute |
| [docs/adr](docs/adr) | Architecture Decision Records |

---

## Contributing

We welcome contributions. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on development workflow, testing, and pull requests.

---

## License

[MIT](LICENSE)
