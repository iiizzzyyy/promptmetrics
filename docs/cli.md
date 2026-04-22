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

## Configuration

The CLI looks for a `promptmetrics.yaml` file in the current directory for default `server` and `api_key` values. You can override either with `--server` and `--api-key` flags on any command.

```yaml
server: http://localhost:3000
api_key: pm_xxxxxxxx
```

Create this file with:

```bash
promptmetrics init
```

## Global Flags

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--server` | No | `http://localhost:3000` | PromptMetrics server URL |
| `--api-key` | Yes for most commands | — | Your `pm_...` API key |

## Commands

### `promptmetrics init`

Create a `promptmetrics.yaml` file in the current directory.

```bash
promptmetrics init
```

### `promptmetrics create-prompt --file <path>`

Create a new prompt from a JSON or YAML file.

```bash
promptmetrics create-prompt --file ./welcome.json \
  --api-key pm_xxxxxxxx \
  --server http://localhost:3000
```

The file must match the [Prompt Format](prompt-format.md) schema. YAML files (`.yaml`, `.yml`) are supported.

### `promptmetrics list-prompts`

List all prompts with pagination.

```bash
promptmetrics list-prompts \
  --api-key pm_xxxxxxxx \
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
  --api-key pm_xxxxxxxx \
  --limit 1000
```

### `promptmetrics log`

Log metadata about an LLM call.

```bash
promptmetrics log \
  --prompt-name welcome \
  --version 1.0.0 \
  --provider openai \
  --model gpt-4o \
  --tokens-in 10 \
  --tokens-out 20 \
  --latency-ms 500 \
  --cost-usd 0.001 \
  --metadata experiment=headline-v2 \
  --api-key pm_xxxxxxxx
```

### `promptmetrics create-trace`

Create a new trace for agent telemetry.

```bash
promptmetrics create-trace \
  --prompt-name welcome \
  --metadata agent=test \
  --api-key pm_xxxxxxxx
```

### `promptmetrics get-trace <trace_id>`

Retrieve a trace with its spans.

```bash
promptmetrics get-trace 550e8400-e29b-41d4-a716-446655440000 \
  --api-key pm_xxxxxxxx
```

### `promptmetrics add-span <trace_id>`

Add a span to an existing trace.

```bash
promptmetrics add-span 550e8400-e29b-41d4-a716-446655440000 \
  --name fetch-prompt \
  --status ok \
  --start-time 1000 \
  --end-time 2000 \
  --api-key pm_xxxxxxxx
```

### `promptmetrics create-run`

Create a new workflow run.

```bash
promptmetrics create-run \
  --workflow headline-agent \
  --input topic=AI \
  --api-key pm_xxxxxxxx
```

### `promptmetrics update-run <run_id>`

Update a workflow run with status and output.

```bash
promptmetrics update-run 550e8400-e29b-41d4-a716-446655440001 \
  --status completed \
  --output headline="AI Breakthrough" \
  --api-key pm_xxxxxxxx
```

### `promptmetrics add-label <prompt_name> <label_name>`

Tag a prompt version with an environment label.

```bash
promptmetrics add-label welcome production \
  --version 1.0.0 \
  --api-key pm_xxxxxxxx
```

### `promptmetrics get-label <prompt_name> <label_name>`

Resolve a label to a version tag.

```bash
promptmetrics get-label welcome production \
  --api-key pm_xxxxxxxx
```

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
promptmetrics log \
  --prompt-name welcome \
  --version 1.0.0 \
  --provider openai \
  --model gpt-4o \
  --tokens-in 10 \
  --tokens-out 20 \
  --latency-ms 500 \
  --cost-usd 0.001 \
  --api-key pm_abc123

# 6. Create a trace and add spans
TRACE=$(promptmetrics create-trace --prompt-name welcome --api-key pm_abc123 | jq -r '.trace_id')
promptmetrics add-span "$TRACE" --name llm-call --status ok --api-key pm_abc123

# 7. Track a workflow run
RUN=$(promptmetrics create-run --workflow headline-agent --input topic=AI --api-key pm_abc123 | jq -r '.run_id')
promptmetrics update-run "$RUN" --status completed --output headline="AI Wins" --api-key pm_abc123

# 8. Tag the prompt version
promptmetrics add-label welcome production --version 1.0.0 --api-key pm_abc123
```
