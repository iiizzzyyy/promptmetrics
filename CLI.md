# PromptMetrics CLI

The `promptmetrics` package ships with a CLI for common operations.

## Installation

```bash
npm install -g promptmetrics
```

Or run directly via npx:

```bash
npx promptmetrics <command>
```

## Commands

### `promptmetrics init`

Create a `promptmetrics.yaml` file in the current directory.

```bash
promptmetrics init
```

This is a convenience scaffold. PromptMetrics itself does not read this file — it is for documenting your local setup and sharing with teammates.

### `promptmetrics create-prompt --file <path>`

Create a new prompt from a JSON or YAML file.

```bash
promptmetrics create-prompt --file ./welcome.json \
  --api-key pm_xxxxxxxx \
  --server http://localhost:3000
```

The file must match the [Prompt Format](PROMPT_FORMAT.md) schema.

### `promptmetrics list-prompts`

List all prompts with pagination.

```bash
promptmetrics list-prompts \
  --api-key pm_xxxxxxxx \
  --server http://localhost:3000 \
  --page 1 \
  --limit 20
```

### `promptmetrics get-prompt <name>`

Retrieve a specific prompt by name, optionally by version.

```bash
# Latest version
promptmetrics get-prompt welcome \
  --api-key pm_xxxxxxxx

# Specific version
promptmetrics get-prompt welcome \
  --version 1.0.0 \
  --api-key pm_xxxxxxxx

# With variable rendering
promptmetrics get-prompt welcome \
  --var name=Alice \
  --var email=alice@example.com \
  --api-key pm_xxxxxxxx
```

### `promptmetrics import --dir <path>`

Bulk import all prompts from a directory tree.

```bash
promptmetrics import --dir ./my-prompts/ \
  --api-key pm_xxxxxxxx
```

Expects a tree like:

```
./my-prompts/
  welcome/
    1.0.0.json
    1.1.0.json
  farewell/
    1.0.0.json
```

### `promptmetrics export --out <path>`

Export all prompts to a local directory.

```bash
promptmetrics export --out ./backup/ \
  --api-key pm_xxxxxxxx
```

### `promptmetrics generate-api-key <name> <scopes>`

Generate a new API key. This command requires access to the server environment (it reads `API_KEY_SALT`).

```bash
node dist/scripts/generate-api-key.js default read,write
# => pm_xxxxxxxx... (store this securely)
```

## Global Flags

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--server` | No | `http://localhost:3000` | PromptMetrics server URL |
| `--api-key` | Yes for most commands | — | Your `pm_...` API key |
| `--page` | No | `1` | Page number for list commands |
| `--limit` | No | `50` | Items per page |
| `--version` | No | `latest` | Specific prompt version |
| `--var` | No | — | Template variable (can be repeated) |

## Examples

### Full workflow

```bash
# 1. Start the server
API_KEY_SALT=my-salt promptmetrics-server

# 2. Generate an API key
node dist/scripts/generate-api-key.js my-cli read,write
# => pm_abc123

# 3. Create a prompt
promptmetrics create-prompt --file welcome.json --api-key pm_abc123

# 4. Fetch and render it
promptmetrics get-prompt welcome --var name=Alice --api-key pm_abc123

# 5. Log metadata about an LLM call
curl -X POST http://localhost:3000/v1/logs \
  -H "X-API-Key: pm_abc123" \
  -d '{
    "prompt_name": "welcome",
    "version_tag": "1.0.0",
    "provider": "openai",
    "model": "gpt-4o",
    "tokens_in": 10,
    "tokens_out": 20,
    "latency_ms": 500,
    "cost_usd": 0.001
  }'
```
