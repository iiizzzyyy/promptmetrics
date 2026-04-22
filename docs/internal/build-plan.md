# PromptMetrics Build Plan
## Multi-Phase Feature Expansion

**Date:** 2026-04-22
**Status:** Plan Complete — Pending Implementation

---

## Context

PromptMetrics is a lightweight, self-hosted prompt registry with GitHub-backed versioning and metadata logging. This plan expands it with three major capabilities:

1. **Messages-based prompts** — Replace single `template` string with OpenAI-style `messages` array (system/user/assistant), enabling modern LLM prompt formats.
2. **Ollama first-class support** — Add schema fields for local Ollama deployments (options, keep_alive, format) so users can use PromptMetrics for both cloud and local LLMs.
3. **Agent telemetry** — Add traces/spans, workflow runs, and prompt labels inspired by PromptLayer's observability features.

---

## Architecture Decisions

### Messages Array Format
Use OpenAI Chat Completions format as the canonical standard:
```json
{
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello {{name}}!" }
  ]
}
```
- `role`: `"system" | "user" | "assistant"`
- `content`: string (supports `{{variable}}` substitution)
- `name`: optional string (for function/tool responses)

### Ollama Fields
- Top-level `ollama` object for Ollama-specific settings:
  - `options`: object (temperature, num_ctx, seed, etc.)
  - `keep_alive`: string (e.g., `"5m"`, `"1h"`)
  - `format`: string or object (for structured output)
- Also accept these in `model_config` as passthrough for backward compatibility

### Agent Telemetry

#### Traces/Spans
- `trace_id`: UUID v4, user-provided or auto-generated
- `span_id`: auto-generated
- `parent_id`: optional, for nested spans
- `name`: string (e.g., "agent-step-1")
- `status`: `"ok" | "error"`
- `start_time` / `end_time`: timestamps
- `metadata`: key-value pairs
- `prompt_name` / `version_tag`: optional link to prompt

#### Workflow Runs
- `run_id`: UUID
- `workflow_name`: string
- `status`: `"running" | "completed" | "failed"`
- `input`: JSON object
- `output`: JSON object
- `trace_id`: optional link to trace
- `metadata`: key-value pairs

#### Prompt Labels
- `name`: string (e.g., "production", "staging", "v2-test")
- `prompt_name`: string
- `version_tag`: string
- UNIQUE constraint on (prompt_name, name)

---

## Phase Breakdown

### Phase 1: Messages Array Refactor
**Goal:** Replace `template` with `messages` throughout the codebase.

**Files to modify:**
- `src/validation-schemas/promptmetrics-prompt.schema.ts` — replace `template` with `messages` array validation
- `src/drivers/promptmetrics-driver.interface.ts` — update `PromptFile` interface
- `src/controllers/promptmetrics-prompt.controller.ts` — update rendering logic to iterate messages
- `src/interfaces/` — update or add new types
- `clients/node/src/index.ts` — update Node.js SDK `Prompt` interface
- `tests/unit/filesystem-driver.test.ts` — update test fixtures
- `tests/unit/github-driver.test.ts` — update test fixtures
- `tests/integration/prompts.test.ts` — update assertions
- `tests/integration/rendering.test.ts` — rewrite for messages rendering
- `tests/integration/audit.test.ts` — update test fixture
- `tests/e2e/full-lifecycle.test.ts` — update all prompt assertions
- Documentation: `PROMPT_FORMAT.md`, `API.md`, `SDK.md`, `README.md`, `ARCHITECTURE.md`, `TEST_CASES.md`

**Key changes:**
- Joi schema: `messages: Joi.array().items(Joi.object({ role: Joi.string().valid('system', 'user', 'assistant').required(), content: Joi.string().required(), name: Joi.string() })).min(1).required()`
- Rendering: iterate `content.messages`, apply `{{var}}` substitution to each `content` string where role != "assistant"
- Response shape: `content.messages` instead of `content.template`

### Phase 2: Ollama First-Class Support
**Goal:** Add Ollama-specific fields to prompt schema and log schema.

**Files to modify:**
- `src/validation-schemas/promptmetrics-prompt.schema.ts` — add `ollama` object validation
- `src/validation-schemas/promptmetrics-log.schema.ts` — add `ollama_options` and `ollama_keep_alive` fields
- `src/drivers/promptmetrics-driver.interface.ts` — add Ollama fields to `PromptFile`
- `src/controllers/promptmetrics-log.controller.ts` — handle new log fields
- `src/models/promptmetrics-sqlite.ts` — add `ollama_options` and `ollama_keep_alive` columns to `logs` table
- `tests/` — update tests with Ollama fixtures
- Documentation: `CONFIGURATION.md`, `PROMPT_FORMAT.md`, `API.md`

**Key changes:**
- Prompt schema: add optional `ollama: { options: object, keep_alive: string, format: string|object }`
- Log schema: add optional `ollama_options`, `ollama_keep_alive`, `ollama_format`
- SQLite logs table: add nullable columns

### Phase 3: Agent Telemetry — Traces/Spans
**Goal:** Add trace and span tracking for agent loops.

**Files to create:**
- `src/validation-schemas/promptmetrics-trace.schema.ts`
- `src/controllers/promptmetrics-trace.controller.ts`
- `src/routes/promptmetrics-trace.route.ts`
- `tests/unit/trace.test.ts`
- `tests/integration/traces.test.ts`

**Files to modify:**
- `src/models/promptmetrics-sqlite.ts` — add `traces` and `spans` tables
- `src/app.ts` — mount trace routes
- `tests/e2e/full-lifecycle.test.ts` — add trace CRUD tests

**API Endpoints:**
- `POST /v1/traces` — create a trace
- `GET /v1/traces/:trace_id` — get trace with spans
- `POST /v1/traces/:trace_id/spans` — add a span to a trace
- `GET /v1/traces/:trace_id/spans/:span_id` — get a single span

### Phase 4: Workflow Runs
**Goal:** Track end-to-end workflow/agent executions.

**Files to create:**
- `src/validation-schemas/promptmetrics-run.schema.ts`
- `src/controllers/promptmetrics-run.controller.ts`
- `src/routes/promptmetrics-run.route.ts`
- `tests/unit/run.test.ts`
- `tests/integration/runs.test.ts`

**Files to modify:**
- `src/models/promptmetrics-sqlite.ts` — add `runs` table
- `src/app.ts` — mount run routes
- `tests/e2e/full-lifecycle.test.ts` — add run CRUD tests

**API Endpoints:**
- `POST /v1/runs` — create a run
- `GET /v1/runs/:run_id` — get a run
- `PATCH /v1/runs/:run_id` — update run status/output
- `GET /v1/runs` — list runs with pagination

### Phase 5: Prompt Labels
**Goal:** Tag prompt versions with environment labels (production, staging, etc.).

**Files to create:**
- `src/validation-schemas/promptmetrics-label.schema.ts`
- `src/controllers/promptmetrics-label.controller.ts`
- `src/routes/promptmetrics-label.route.ts`
- `tests/unit/label.test.ts`
- `tests/integration/labels.test.ts`

**Files to modify:**
- `src/models/promptmetrics-sqlite.ts` — add `prompt_labels` table
- `src/app.ts` — mount label routes
- `tests/e2e/full-lifecycle.test.ts` — add label CRUD tests

**API Endpoints:**
- `POST /v1/prompts/:name/labels` — create a label
- `GET /v1/prompts/:name/labels` — list labels for a prompt
- `GET /v1/prompts/:name/labels/:label_name` — get specific label (resolves to version)
- `DELETE /v1/prompts/:name/labels/:label_name` — delete a label

### Phase 6: E2E Testing & Documentation
**Goal:** Full end-to-end testing and comprehensive documentation update.

**Tasks:**
- Run complete test suite (all phases together)
- Fix any integration issues between phases
- Update `API.md` with all new endpoints and schemas
- Update `README.md` with new features and examples
- Update `ARCHITECTURE.md` with telemetry flow diagrams
- Update `PROMPT_FORMAT.md` with messages array format
- Update `SDK.md` with new SDK methods
- Update `TEST_CASES.md` with all new test results
- Build verification: `npm run build` + `npm test` + `npm run lint`
- CLI smoke test: start server, create prompt with messages, create trace, create run, create label

---

## Verification Checklist (Per Phase)

For each phase:
1. `npm run build` — zero TypeScript errors
2. `npx eslint src/` — zero lint errors
3. `npm test` — all existing + new tests passing
4. `API_KEY_SALT=test node dist/server.js` — server starts cleanly
5. Manual curl/smoke test of new endpoints
6. Update documentation

---

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Breaking existing API consumers | Major version bump (v2.0.0), clear migration guide in docs |
| Context window exhaustion during build | Build context preservation file (CONTEXT.md) |
| SQLite schema migrations | Use `ALTER TABLE` or recreate tables; provide `db:migrate` script |
| Test suite grows too large | Keep unit tests fast; E2E tests in separate suite |

---

## Dependencies

- No new npm packages needed for phases 1, 3, 4, 5
- Phase 2 (Ollama): no new packages (pure schema changes)
- Phase 3+ may benefit from `uuid` package if not already available
