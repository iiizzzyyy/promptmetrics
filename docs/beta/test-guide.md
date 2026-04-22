# PromptMetrics Beta Test Guide

For human beta testers. Follow each test case, mark the result, and file issues for anything that fails, confuses, or surprises you.

---

## Tester Info

| Field | Value |
|---|---|
| Tester name | |
| Date | |
| Path tested | Docker Compose / From Source (circle one) |
| OS / Environment | |
| Time to complete | |

---

## Prerequisites

Before starting, confirm you have:

- [ ] **Docker** (for Docker path) OR **Node.js 20+** (for source path)
- [ ] `git` installed
- [ ] `curl` or a web browser available
- [ ] A terminal that can run multiple tabs/windows

---

## Path A: Docker Compose (Recommended)

### Setup Steps

```bash
cd /tmp/pm-beta-test
docker compose up --build
```

Wait until you see `All smoke tests passed.` Then the server is running.

**API key for Docker path:** `pm_smoke_test_key` (pre-seeded).

---

## Path B: From Source

### Setup Steps

```bash
cd /tmp/pm-beta-test
cp .env.example .env          # creates your config file
npm install
npm run build
npm run db:init               # creates the SQLite database
node dist/scripts/generate-api-key.js default read,write
# => pm_xxxxxxxx... (copy this key)
```

Start the server in a **separate terminal**:

```bash
cd /tmp/pm-beta-test
node dist/server.js
```

Wait for `PromptMetrics running on port 3000`.

Configure the CLI:

```bash
cd /tmp/pm-beta-test
node dist/cli/promptmetrics-cli.js init
# Edit promptmetrics.yaml and paste your API key
```

---

## Test Cases

### Area 1: Installation & Boot

| # | Test | Steps | Expected Result | Pass? | Notes |
|---|---|---|---|---|---|
| 1.1 | Server boots without errors | Run the setup for your chosen path | Terminal shows "Database initialized. PromptMetrics running on port 3000." | | |
| 1.2 | Health check responds | `curl http://localhost:3000/health` | Returns `{"status":"ok"}` | | |
| 1.3 | Deep health check | `curl http://localhost:3000/health/deep` | Returns JSON with status and checks | | |
| 1.4 | Graceful shutdown | Stop the server with Ctrl+C | "Received SIGTERM. Graceful shutdown complete." with no errors | | |
| 1.5 | Docker smoke test (Docker path only) | `docker compose up --build --abort-on-container-exit` | Ends with `All smoke tests passed.` and 10 PASS lines | | |

### Area 2: Authentication & Security

| # | Test | Steps | Expected Result | Pass? | Notes |
|---|---|---|---|---|---|
| 2.1 | Requests without API key are rejected | `curl http://localhost:3000/v1/prompts` | Returns `401 Unauthorized` | | |
| 2.2 | Requests with wrong API key are rejected | `curl -H "X-API-Key: pm_faketestkey" http://localhost:3000/v1/prompts` | Returns `401 Unauthorized` | | |
| 2.3 | Read scope key can GET | Generate a read-only key, use it to `GET /v1/prompts` | Returns `200 OK` with prompt list | | |
| 2.4 | Read scope key cannot POST | Use the read-only key to `POST /v1/prompts` | Returns `403 Forbidden` | | |
| 2.5 | Write scope key can POST | Use a read,write key to create a prompt | Returns `201 Created` with prompt data | | |

**How to test scopes:**
```bash
# For source path:
node dist/scripts/generate-api-key.js reader read
node dist/scripts/generate-api-key.js writer read,write

# For Docker path, only the pre-seeded key exists.
```

### Area 3: Prompt Registry — CRUD

| # | Test | Steps | Expected Result | Pass? | Notes |
|---|---|---|---|---|---|
| 3.1 | Create a prompt via CLI | Create `welcome.json` (see below) and run `promptmetrics create-prompt --file welcome.json` | Returns JSON with `name`, `version_tag`, `fs_path`, `created_at` | | |
| 3.2 | Create a prompt with YAML file | Create `welcome.yaml` with same content, run `create-prompt --file welcome.yaml` | Same success as JSON | | |
| 3.3 | Create a second version | Edit version to `1.1.0`, run `create-prompt` again | Returns new entry with `version_tag: "1.1.0"` | | |
| 3.4 | List prompts | `promptmetrics list-prompts` | JSON array with the prompt(s) you created | | |
| 3.5 | List with pagination | `promptmetrics list-prompts --page 1 --limit 1` | Returns exactly 1 prompt, with pagination info if present | | |
| 3.6 | Get latest version | `promptmetrics get-prompt welcome` | Returns the most recently created version | | |
| 3.7 | Get specific version | `promptmetrics get-prompt welcome --version 1.0.0` | Returns exactly version 1.0.0 | | |
| 3.8 | Get non-existent prompt | `promptmetrics get-prompt does-not-exist` | Returns `404 Not Found` with clear error message | | |
| 3.9 | Search prompts | `curl "http://localhost:3000/v1/prompts/search?q=welcome"` | Returns prompts matching the query | | |
| 3.10 | List versions | `curl http://localhost:3000/v1/prompts/welcome/versions` | Returns both `1.0.0` and `1.1.0` | | |

**Sample `welcome.json`:**
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

### Area 4: Variable Rendering

| # | Test | Steps | Expected Result | Pass? | Notes |
|---|---|---|---|---|---|
| 4.1 | Render with query params | `curl "http://localhost:3000/v1/prompts/welcome?render=true&variables[name]=Alice"` | `messages[1].content` is `"Hello Alice!"` | | |
| 4.2 | Render multiple variables via query | `curl "http://localhost:3000/v1/prompts/multi-var?render=true&variables[first]=Alice&variables[last]=Smith"` | Both variables substituted correctly | | |
| 4.3 | Render multiple variables | Create prompt with `{{first}} {{last}}`, render with both | Both variables substituted correctly | | |
| 4.4 | Raw messages (no render) | `curl "http://localhost:3000/v1/prompts/welcome?render=false"` | `messages[1].content` is the raw template `"Hello {{name}}!"` | | |
| 4.5 | Assistant messages not rendered | Create prompt with assistant role and variables, render it | Assistant content stays raw (not substituted) | | |
| 4.6 | Missing variable fails gracefully | Render a prompt that requires a variable, but don't provide it | Returns `400 Bad Request` with clear message about missing variable | | |

### Area 5: Import & Export

| # | Test | Steps | Expected Result | Pass? | Notes |
|---|---|---|---|---|---|
| 5.1 | Bulk import from directory | Create `test-prompts/greeting/1.0.0.json` and run `promptmetrics import --dir ./test-prompts/` | All prompts imported successfully | | |
| 5.2 | Export prompts | `promptmetrics export --out ./backup/ --limit 100` | Directory `./backup/` created with prompt files | | |
| 5.3 | Export with limit | `promptmetrics export --out ./backup-small/ --limit 1` | Only 1 prompt exported | | |

### Area 6: Metadata Logging

| # | Test | Steps | Expected Result | Pass? | Notes |
|---|---|---|---|---|---|
| 6.1 | Log with all fields | `promptmetrics log --prompt-name welcome --version 1.0.0 --provider openai --model gpt-4o --tokens-in 10 --tokens-out 20 --latency-ms 500 --cost-usd 0.001` | Returns `{"id":N,"status":"accepted"}` | | |
| 6.2 | Log with minimal fields | `promptmetrics log --prompt-name welcome --version 1.0.0` | Returns accepted with only required fields | | |
| 6.3 | Log with metadata tags | Add `--metadata experiment=headline-v2,env=production` | Metadata is stored and retrievable | | |
| 6.4 | Log Ollama fields | Create an Ollama prompt, then log with `--ollama-options temperature=0.8` and `--ollama-keep-alive 5m` | Log accepted with Ollama fields | | |
| 6.5 | Reject too many metadata keys | Log with 51+ metadata keys | Returns `400 Bad Request` | | |
| 6.6 | Reject invalid metadata value | Log with metadata value that is not a string/number | Returns `400 Bad Request` | | |

### Area 7: Agent Telemetry — Traces & Spans

| # | Test | Steps | Expected Result | Pass? | Notes |
|---|---|---|---|---|---|
| 7.1 | Create a trace | `promptmetrics create-trace --prompt-name welcome` | Returns JSON with `trace_id` (UUID format) | | |
| 7.2 | Create trace with custom ID | `curl -X POST /v1/traces -d '{"trace_id":"$(uuidgen)"}'` (macOS) or use a fresh UUID | Returns trace with the provided UUID | | | **Tip:** Use a fresh UUID each time to avoid collisions from prior testing. |
| 7.3 | Add span to trace | `TRACE=$(create-trace | jq -r '.trace_id')` then `add-span "$TRACE" --name fetch-prompt --status ok --start-time 1000 --end-time 2000` | Returns JSON with `span_id` and the trace_id | | |
| 7.4 | Get trace with spans | `promptmetrics get-trace "$TRACE"` | Returns trace object including an array of spans | | |
| 7.5 | Get single span | `curl /v1/traces/$TRACE/spans/$SPAN_ID` | Returns the specific span object | | |
| 7.6 | Span on missing trace fails | `add-span 550e8400-e29b-41d4-a716-446655440099 --name test` (valid UUID, does not exist) | Returns `404 Not Found` | | | Must use a valid UUID format or the route parameter validation rejects it. |
| 7.7 | Invalid span status rejected | `add-span "$TRACE" --status invalid_status` | Returns `400 Bad Request` | | |
| 7.8 | Trace with metadata | `create-trace --metadata agent=beta-tester,run=1` | Metadata stored and returned on get | | |

### Area 8: Workflow Runs

| # | Test | Steps | Expected Result | Pass? | Notes |
|---|---|---|---|---|---|
| 8.1 | Create a run | `promptmetrics create-run --workflow headline-agent --input topic=AI` | Returns JSON with `run_id` and `status: "running"` | | |
| 8.2 | Create run with custom ID | `curl -X POST /v1/runs -d '{"run_id":"550e8400-e29b-41d4-a716-446655440001","workflow_name":"test"}'` | Returns run with provided UUID | | |
| 8.3 | Link run to trace | Create a trace, then create run with `--trace-id $TRACE` | Run created successfully with trace reference | | |
| 8.4 | Link run to missing trace fails | `create-run --trace-id 550e8400-e29b-41d4-a716-446655440099` (valid UUID format, but does not exist) | Returns `404 Not Found` | | | Must use a valid UUID format or schema validation rejects it with 422 before checking existence. |
| 8.5 | Update run status | `promptmetrics update-run "$RUN" --status completed --output headline="AI Breakthrough"` | Returns `{"run_id":"...","status":"updated"}` | | |
| 8.6 | Get run | `curl /v1/runs/$RUN_ID` | Returns full run object with workflow, status, input, output | | |
| 8.7 | List runs | `curl /v1/runs` | Returns paginated list of runs | | |
| 8.8 | Invalid status rejected | `update-run "$RUN" --status cancelled` | Returns `400 Bad Request` | | |
| 8.9 | Missing workflow name rejected | `curl -X POST /v1/runs -d '{"status":"running"}'` | Returns `400 Bad Request` | | |

### Area 9: Prompt Version Labels

| # | Test | Steps | Expected Result | Pass? | Notes |
|---|---|---|---|---|---|
| 9.1 | Add label | `promptmetrics add-label welcome production --version 1.0.0` | Returns `{"prompt_name":"welcome","name":"production","version_tag":"1.0.0"}` | | |
| 9.2 | Get label | `promptmetrics get-label welcome production` | Returns the same JSON with `version_tag: "1.0.0"` | | |
| 9.3 | Update label to new version | `add-label welcome production --version 1.1.0` then `get-label` | Returns updated version `1.1.0` | | |
| 9.4 | Duplicate label is an update, not error | Run `add-label welcome production --version 1.0.0` again | Should succeed (upsert behavior) | | |
| 9.5 | List labels | `curl /v1/prompts/welcome/labels` | Returns array with the `production` label | | |
| 9.6 | Delete label | `curl -X DELETE /v1/prompts/welcome/labels/production` | Returns `204 No Content` | | |
| 9.7 | Get deleted label fails | `get-label welcome production` | Returns `404 Not Found` | | |

### Area 10: Audit Logging

| # | Test | Steps | Expected Result | Pass? | Notes |
|---|---|---|---|---|---|
| 10.1 | Admin can view audit logs | `curl -H "X-API-Key: <admin-key>" /v1/audit-logs` | Returns array of audit log entries | | |
| 10.2 | Non-admin cannot view audit logs | Use a read-only key to GET `/v1/audit-logs` | Returns `403 Forbidden` | | |
| 10.3 | Audit log records prompt creation | Create a prompt, then check audit logs | Log entry shows `action: "create_prompt"` with prompt name | | |

### Area 11: CLI Configuration & Global Flags

| # | Test | Steps | Expected Result | Pass? | Notes |
|---|---|---|---|---|---|
| 11.1 | `init` creates config file | `promptmetrics init` | `promptmetrics.yaml` created in current directory | | |
| 11.2 | CLI reads config file defaults | Put server/api_key in `promptmetrics.yaml`, run a command without flags | Command succeeds using values from config | | |
| 11.3 | `--server` overrides config | `promptmetrics list-prompts --server http://other-host:3000` | Uses the overridden server (may fail if no server there) | | |
| 11.4 | `--api-key` overrides config | `promptmetrics list-prompts --api-key pm_otherkey` | Uses the overridden key | | |
| 11.5 | Missing API key shows error | Run a command without `--api-key` and without config file | Clear error message about missing API key | | |

### Area 12: Error Handling & Edge Cases

| # | Test | Steps | Expected Result | Pass? | Notes |
|---|---|---|---|---|---|
| 12.1 | Invalid JSON body | `curl -X POST /v1/prompts -d 'not json'` | Returns `400 Bad Request` with parse error | | |
| 12.2 | Missing required field | `curl -X POST /v1/prompts -d '{"name":"test"}'` (no version) | Returns `400` with validation error for missing `version` | | |
| 12.3 | Missing messages array | `curl -X POST /v1/prompts -d '{"name":"x","version":"1.0.0"}'` | Returns `400` with validation error for missing `messages` | | |
| 12.4 | Concurrent prompt creation | Run 5 `create-prompt` commands in parallel | All 5 succeed, no data corruption or crashes | | |
| 12.5 | Concurrent log creation | Run 5 `log` commands in parallel | All 5 accepted, no data corruption | | |

### Area 13: Prompt Format — Ollama Support

| # | Test | Steps | Expected Result | Pass? | Notes |
|---|---|---|---|---|---|
| 13.1 | Create Ollama prompt | Create prompt with `ollama_options`, `ollama_keep_alive`, `ollama_format` | Successfully created and retrievable | | |
| 13.2 | Log Ollama fields | Log with Ollama-specific metadata | Log accepted, Ollama fields preserved | | |
| 13.3 | Get raw Ollama config | `get-prompt` with `render=false` | Ollama fields present in raw output | | |

---

## Wrap-Up

### Overall Assessment

| Question | Answer |
|---|---|
| Did you complete all tests? | Yes / No (list skipped) |
| Total tests passed | / |
| Total tests failed | |
| Time to complete | |
| Would you recommend this to a teammate? | Yes / Maybe / No |

### Open Issues

| # | Description | Severity (Blocker/Major/Minor) |
|---|---|---|
| 1 | | |
| 2 | | |
| 3 | | |

### Surprises / Things That Confused You

1.
2.
3.

### Suggestions

1.
2.
3.

---

## Quick Reference: All CLI Commands

```bash
# Config
promptmetrics init

# Prompts
promptmetrics create-prompt --file ./welcome.json
promptmetrics list-prompts [--page 1] [--limit 20]
promptmetrics get-prompt welcome [--version 1.0.0] [--var name=Alice]
promptmetrics import --dir ./my-prompts/
promptmetrics export --out ./backup/ [--limit 1000]

# Logging
promptmetrics log --prompt-name welcome --version 1.0.0 \
  --provider openai --model gpt-4o \
  --tokens-in 10 --tokens-out 20 --latency-ms 500 --cost-usd 0.001 \
  --metadata key=value

# Telemetry
promptmetrics create-trace --prompt-name welcome [--metadata key=value]
promptmetrics get-trace <trace_id>
promptmetrics add-span <trace_id> --name step-name --status ok \
  --start-time 1000 --end-time 2000

# Runs
promptmetrics create-run --workflow my-workflow --input key=value [--trace-id <id>]
promptmetrics update-run <run_id> --status completed --output key=value

# Labels
promptmetrics add-label welcome production --version 1.0.0
promptmetrics get-label welcome production
```

## Quick Reference: API Endpoints

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | None | Liveness |
| GET | `/health/deep` | None | Readiness |
| POST | `/v1/prompts` | Write | Create prompt |
| GET | `/v1/prompts` | Read | List prompts |
| GET | `/v1/prompts/:name` | Read | Get prompt |
| GET | `/v1/prompts/:name/versions` | Read | List versions |
| GET | `/v1/prompts/search` | Read | Search |
| POST | `/v1/logs` | Write | Log metadata |
| POST | `/v1/traces` | Write | Create trace |
| GET | `/v1/traces/:id` | Read | Get trace |
| POST | `/v1/traces/:id/spans` | Write | Add span |
| GET | `/v1/traces/:id/spans/:span_id` | Read | Get span |
| POST | `/v1/runs` | Write | Create run |
| GET | `/v1/runs` | Read | List runs |
| GET | `/v1/runs/:id` | Read | Get run |
| PATCH | `/v1/runs/:id` | Write | Update run |
| POST | `/v1/prompts/:name/labels` | Write | Add label |
| GET | `/v1/prompts/:name/labels` | Read | List labels |
| GET | `/v1/prompts/:name/labels/:label` | Read | Get label |
| DELETE | `/v1/prompts/:name/labels/:label` | Write | Delete label |
| GET | `/v1/audit-logs` | Admin | View audit logs |

## Curl Template

Replace `API_KEY` with your key:

```bash
curl -s -H "X-API-Key: API_KEY" http://localhost:3000/v1/prompts
```

For POST requests:
```bash
curl -s -X POST \
  -H "X-API-Key: API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"test","version":"1.0.0","messages":[{"role":"user","content":"hi"}]}' \
  http://localhost:3000/v1/prompts
```
