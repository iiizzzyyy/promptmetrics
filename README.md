# PromptMetrics

Lightweight, self-hosted prompt registry with GitHub-backed versioning and metadata logging for LLM observability.

## What It Is

PromptMetrics is a programmatic-only backend service that solves two problems in LLM development:

1. **Prompt Versioning** — Store, version, and retrieve prompts via a REST API or CLI. Prompts live in a GitHub repository (or local filesystem) with full version history.
2. **Metadata Logging** — Log structured metadata about every LLM request (model, tokens, latency, cost, custom tags) to stdout JSON or OpenTelemetry.

No UI. No database for prompt content. No vendor lock-in.

## Quickstart

### With Docker

```bash
docker run -p 3000:3000 -e API_KEY_SALT=your-salt promptmetrics
```

### With npm

```bash
npm install -g promptmetrics
promptmetrics-server
```

### Generate an API key

```bash
node dist/scripts/generate-api-key.js default read,write
# => pm_xxxxxxxx... (store this)
```

### Create your first prompt

```bash
curl -X POST http://localhost:3000/v1/prompts \
  -H "Content-Type: application/json" \
  -H "X-API-Key: pm_xxxxxxxx" \
  -d '{
    "name": "welcome",
    "version": "1.0.0",
    "template": "Hello {{name}}!",
    "variables": { "name": { "type": "string", "required": true } }
  }'
```

### Retrieve and render

```bash
curl "http://localhost:3000/v1/prompts/welcome?variables[name]=Alice" \
  -H "X-API-Key: pm_xxxxxxxx"
# => "Hello Alice!"
```

### Log metadata

```bash
curl -X POST http://localhost:3000/v1/logs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: pm_xxxxxxxx" \
  -d '{
    "prompt_name": "welcome",
    "version_tag": "1.0.0",
    "provider": "openai",
    "model": "gpt-4o",
    "tokens_in": 10,
    "tokens_out": 20,
    "latency_ms": 500,
    "cost_usd": 0.001,
    "metadata": { "user_id": "user_123", "experiment": "headline-v2" }
  }'
```

## Architecture

- **Storage drivers:** `filesystem` (default) or `github`
- **Database:** SQLite (metadata index only — WAL mode)
- **Auth:** API keys (hashed with HMAC-SHA256)
- **Observability:** Structured JSON stdout logs, optional OpenTelemetry OTLP export

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | HTTP server port |
| `API_KEY_SALT` | Yes | — | Salt for hashing API keys |
| `DRIVER` | No | `filesystem` | `filesystem` or `github` |
| `SQLITE_PATH` | No | `./data/promptmetrics.db` | SQLite file path |
| `GITHUB_REPO` | If driver=github | — | `owner/repo` format |
| `GITHUB_TOKEN` | If driver=github | — | GitHub PAT or App token |
| `GITHUB_SYNC_INTERVAL_MS` | No | `60000` | Git fetch interval |
| `OTEL_ENABLED` | No | `false` | Enable OpenTelemetry |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | If OTEL=true | — | OTLP collector URL |

## CLI Commands

```bash
promptmetrics init                    # Create promptmetrics.yaml
promptmetrics create-prompt --file welcome.json
promptmetrics list-prompts
promptmetrics get-prompt welcome --version v1.0.0
promptmetrics import --dir ./my-prompts/
promptmetrics export --out ./backup/
```

## License

MIT
