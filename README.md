# PromptMetrics

[![npm](https://img.shields.io/npm/v/promptmetrics.svg)](https://www.npmjs.com/package/promptmetrics)
[![CI](https://github.com/iiizzzyyy/promptmetrics/actions/workflows/ci.yml/badge.svg)](https://github.com/iiizzzyyy/promptmetrics/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)

> Lightweight, self-hosted prompt registry with Git-backed versioning, metadata logging, and evaluations for LLM observability.

PromptMetrics solves four hard problems in LLM application development without adding operational complexity:

1. **Prompt Versioning** — Store, version, and retrieve prompts via a REST API or CLI. Every change is a commit with full history, branching, and rollback.
2. **Metadata Logging** — Log structured metadata about every LLM request (model, tokens, latency, cost, custom tags) to stdout JSON or OpenTelemetry.
3. **Agent Telemetry** — Track agent loops with traces and spans, workflow runs with input/output, and tag prompt versions with environment labels — all without external APM tools.
4. **Evaluations** — Create, score, and manage prompt evaluations to track quality, latency, and accuracy over time.

Self-hosted with no vendor lock-in. Prompt content lives in Git, not a database. Optional Web UI Dashboard included.

---

## Table of Contents

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
| Dashboard | No central UI for prompt ops | Optional Next.js dashboard for prompts, logs, traces, runs, labels, and settings |
| Operational cost | Managed SaaS fees, data egress | Self-hosted, single-node, zero external deps |

---

## Features

- **Git-Native Versioning** — Prompt content lives in Git (local filesystem or GitHub). Every version is immutable and traceable.
- **Hybrid Storage** — SQLite indexes metadata for sub-millisecond queries; Git stores content for auditability. PostgreSQL and S3 backends also supported.
- **Template Rendering** — Mustache-style variable substitution in prompts (`Hello {{name}}!`).
- **Structured Logging** — Log LLM metadata (model, tokens, latency, cost) with validated key-value tags.
- **Agent Telemetry** — Built-in traces, spans, and workflow runs without Jaeger, Zipkin, or DataDog.
- **Evaluations** — Create evaluation suites, record scores, and track prompt quality metrics over time.
- **Environment Labels** — Tag prompt versions with labels like `production` or `v2-test` and resolve them at runtime.
- **API Key Auth** — HMAC-SHA256 hashed keys with scoped permissions (`read`, `write`, `admin`) and optional expiration.
- **Per-API-Key Rate Limiting** — Sliding window rate limits with Redis or SQLite backends.
- **Multi-Tenancy** — Workspace isolation via `X-Workspace-Id` header.
- **OpenTelemetry Export** — Optional OTLP export for operators who already have an observability stack.
- **Web UI Dashboard** — Next.js dashboard for browsing prompts, logs, traces, runs, labels, and settings.
- **Node.js & Python SDKs** — First-class client libraries for programmatic access.
- **GitHub Webhooks** — Immediate sync on push events via webhook endpoint.
- **Circuit Breaker** — GitHub API calls wrapped in an Opossum circuit breaker with exponential backoff on 429 responses.
- **Migration System** — `umzug`-based migration runner with numbered SQL files in `migrations/`.
- **Async Audit Log Queue** — `AuditLogService` batches audit entries and flushes to SQLite asynchronously.

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
|  (opt-in)   |      +-----------------+      +-----------------------+
+-------------+            |
                             v
                      +------------------+
                      |   Git / Files    |
                      |  - content       |
                      |  - history       |
                      +------------------+
```

**Design principles:**
- **Prompt content is code** — Version it like code (Git), not like data (database rows).
- **Metadata is data** — SQLite is perfect for fast, structured queries over indexes and logs.
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
node $(npm root -g)/promptmetrics/dist/scripts/generate-api-key.js default read,write
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
docker compose exec promptmetrics node dist/scripts/generate-api-key.js default read,write
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
node dist/scripts/generate-api-key.js default read,write
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

See [docs/configuration.md](docs/configuration.md) for advanced configuration.

---

## API Overview

Base URL: `http://localhost:3000`

Authentication: All endpoints except `/health` require `X-API-Key` header.

Multi-tenancy: Pass `X-Workspace-Id` header to scope all data. API keys are validated against their assigned workspace.

### Prompts
- `GET /v1/prompts` — List prompts (paginated, searchable)
- `GET /v1/prompts/:name` — Get a prompt (with optional variable rendering)
- `GET /v1/prompts/:name/versions` — List versions of a prompt
- `POST /v1/prompts` — Create a new prompt

### Logs
- `POST /v1/logs` — Log metadata for an LLM request

### Traces & Spans
- `POST /v1/traces` — Create a trace
- `GET /v1/traces/:trace_id` — Get a trace with spans
- `POST /v1/traces/:trace_id/spans` — Add a span

### Workflow Runs
- `POST /v1/runs` — Create a workflow run
- `GET /v1/runs` — List runs
- `PATCH /v1/runs/:run_id` — Update a run

### Prompt Labels
- `POST /v1/prompts/:name/labels` — Tag a version
- `GET /v1/prompts/:name/labels/:label_name` — Resolve label to version

### Evaluations
- `POST /v1/evaluations` — Create an evaluation
- `GET /v1/evaluations` — List evaluations
- `GET /v1/evaluations/:id` — Get an evaluation
- `POST /v1/evaluations/:id/results` — Add a result
- `GET /v1/evaluations/:id/results` — List results
- `DELETE /v1/evaluations/:id` — Delete an evaluation

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

## Documentation

| Document | Purpose |
|----------|---------|
| [docs/architecture.md](docs/architecture.md) | System design, storage drivers, request flows |
| [docs/api.md](docs/api.md) | Complete REST API reference |
| [docs/cli.md](docs/cli.md) | CLI commands and usage |
| [docs/sdk.md](docs/sdk.md) | Node.js SDK reference |
| [SECURITY.md](SECURITY.md) | Security policy and best practices |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute |
| [docs/adr](docs/adr) | Architecture Decision Records |

---

## Contributing

We welcome contributions. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on development workflow, testing, and pull requests.

---

## License

[MIT](LICENSE)
