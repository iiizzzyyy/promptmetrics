# AI/ML System Integration — Build Tasks

**Status:** Draft  
**Date:** 2026-04-29  
**Scope:** Granular build tasks for Prompt Playground, A/B Testing, Evaluation Manager, and Compliance & Risk modules.  
**Estimated Duration:** 10–12 weeks  
**Target Version:** 1.2.0  

---

## Definition of Done

Every task below must satisfy the following before it is marked complete:

1. Code compiles with `npm run build` (backend) and `next build` (UI) without errors.
2. Unit tests pass (`npm test`) for any new service, controller, or evaluator.
3. Integration tests pass for all new endpoints under `tests/integration/`.
4. Workspace scoping is verified: data from workspace A does not leak to workspace B.
5. AI/ML components are validated against synthetic data; statistical tests assert correctness within tolerance.
6. A peer has reviewed the PR.

---

## Phase 1: Playground Backend (Weeks 1–3)

### Task AI-1.1 — Add database migrations for AI feature tables
**Files modified:** `migrations/011_add_ab_testing.ts`, `migrations/012_add_datasets_and_eval_runs.ts`, `migrations/013_add_compliance.ts`, `migrations/014_add_log_run_id.ts`  
**Description:** Create four migrations covering A/B testing, datasets/evaluations, compliance, and the `run_id` column on `logs`. All migrations must use `dialect-helpers.ts` for cross-database compatibility.  
**Acceptance criteria:**
- [ ] All four migrations apply successfully on SQLite and PostgreSQL.
- [ ] `npm run db:init` completes without errors.
- [ ] Indexes are confirmed via `.schema` (SQLite) or `\d` (PostgreSQL).
- [ ] Rollback (`down()`) drops all created objects cleanly.
**Estimated effort:** 6 hours  
**Blocked by:** None  
**Owner:** Eng Lead

### Task AI-1.2 — Implement LLM Provider Adapter interface and registry
**Files modified:** `src/services/llm-provider.adapter.ts`, `src/services/providers/provider.registry.ts`  
**Description:** Define the `LLMProviderAdapter` interface with methods for `listModels`, `chatCompletion`, `streamChatCompletion`, and `estimateCost`. Build a registry that maps provider slugs to adapter instances, lazily instantiated and cached.  
**Acceptance criteria:**
- [ ] Interface is exported and compile-time type-safe.
- [ ] Registry returns the correct adapter for `openai`, `anthropic`, `cohere`, `ollama`, `azure_openai`.
- [ ] Unknown slug throws `AppError.badRequest('Unsupported provider')`.
- [ ] Unit test covers registry lookup and error case.
**Estimated effort:** 4 hours  
**Blocked by:** AI-1.1  
**Owner:** Eng Lead

### Task AI-1.3 — Implement OpenAI provider adapter
**Files modified:** `src/services/providers/openai.adapter.ts`  
**Description:** Implement `LLMProviderAdapter` for OpenAI using the `openai` npm package. Support both streaming and non-streaming chat completions. Implement `estimateCost` with a hardcoded pricing table for `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`.  
**Acceptance criteria:**
- [ ] Non-streaming `chatCompletion` returns `ChatCompletionResponse` with output text, token counts, and estimated cost.
- [ ] Streaming `streamChatCompletion` yields `TokenChunk`, `ToolCallChunk`, `MetricsChunk`, and `DoneChunk` in correct order.
- [ ] `estimateCost` returns USD value within 1% of known OpenAI pricing.
- [ ] Circuit breaker from `circuit-breaker.service.ts` is wired into the adapter.
**Estimated effort:** 8 hours  
**Blocked by:** AI-1.2  
**Owner:** Eng Lead

### Task AI-1.4 — Implement Anthropic and Cohere provider adapters
**Files modified:** `src/services/providers/anthropic.adapter.ts`, `src/services/providers/cohere.adapter.ts`  
**Description:** Implement adapters for Anthropic (via `@anthropic-ai/sdk`) and Cohere (via `cohere-ai`). Follow the same streaming/non-streaming pattern as OpenAI.  
**Acceptance criteria:**
- [ ] Anthropic adapter supports `claude-3-5-sonnet-20241022` and `claude-3-opus-20240229`.
- [ ] Cohere adapter supports `command-r` and `command-r-plus`.
- [ ] Both adapters yield NDJSON-compatible chunks.
- [ ] Both adapters handle provider-specific error codes (Anthropic 529 overload, Cohere 429) and map them to `ProviderError`.
**Estimated effort:** 8 hours  
**Blocked by:** AI-1.3  
**Owner:** Eng Lead

### Task AI-1.5 — Implement Ollama and Azure OpenAI adapters
**Files modified:** `src/services/providers/ollama.adapter.ts`, `src/services/providers/azure-openai.adapter.ts`  
**Description:** Ollama adapter calls a local HTTP endpoint (`OLLAMA_BASE_URL`, default `http://localhost:11434`). Azure OpenAI adapter wraps the `openai` SDK with a custom `baseURL` and `apiVersion`. Ollama does not return token counts; fallback to `tiktoken` estimation.  
**Acceptance criteria:**
- [ ] Ollama adapter streams NDJSON chunks from `/api/chat`.
- [ ] Azure adapter supports `azure_openai` slug and reads `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_VERSION` from env.
- [ ] Ollama token estimate falls back to `tiktoken` (or `gpt-tokenizer`) when provider does not return counts.
- [ ] Both adapters pass integration tests with mock HTTP servers (`nock`).
**Estimated effort:** 6 hours  
**Blocked by:** AI-1.3  
**Owner:** Eng Lead

### Task AI-1.6 — Implement PlaygroundProxyService
**Files modified:** `src/services/playground.service.ts`  
**Description:** Orchestrate prompt lookup (via `PromptService`), Mustache variable substitution, provider adapter selection, request execution (streaming or non-streaming), metrics computation, and log insertion. Enforce the 10-minute global timeout.  
**Acceptance criteria:**
- [ ] Service accepts `PlaygroundRunRequest`, validates variables, and renders messages with Mustache.
- [ ] Non-streaming path returns `PlaygroundRunResponse` including `run_id`, `output`, `metrics`, and `finish_reason`.
- [ ] Streaming path returns an `AsyncGenerator<StreamChunk>`.
- [ ] After every run (both paths), a row is inserted into `logs` with `run_id`, `tokens_in`, `tokens_out`, `latency_ms`, `cost_usd`, `provider`, `model`.
- [ ] Missing required variables throw `AppError.validationFailed` (422).
- [ ] Unit tests mock the provider adapter and verify log insertion.
**Estimated effort:** 10 hours  
**Blocked by:** AI-1.3, AI-1.4, AI-1.5  
**Owner:** Eng Lead

### Task AI-1.7 — Implement NDJSON streaming controller and route
**Files modified:** `src/controllers/playground.controller.ts`, `src/routes/playground.route.ts`, `src/app.ts`  
**Description:** Build the Express controller that handles `POST /v1/playground/run`. Support `?stream=true` via NDJSON. Implement cancellation detection (`req.on('close')` and `AbortController`). Set correct headers (`Content-Type: application/x-ndjson`, `Cache-Control: no-cache`).  
**Acceptance criteria:**
- [ ] `POST /v1/playground/run` returns 200 with JSON response when `stream=false` or omitted.
- [ ] `POST /v1/playground/run?stream=true` returns `Content-Type: application/x-ndjson` and streams chunks.
- [ ] Aborting the request (client disconnect) stops the provider call within 2 seconds.
- [ ] Invalid body returns 422 with `details` array.
- [ ] Integration test covers streaming, non-streaming, and abort scenarios.
**Estimated effort:** 8 hours  
**Blocked by:** AI-1.6  
**Owner:** Eng Lead

### Task AI-1.8 — Implement `GET /v1/playground/models` endpoint
**Files modified:** `src/controllers/playground.controller.ts`, `src/routes/playground.route.ts`  
**Description:** Return the static provider/model manifest. The manifest is loaded from `config/llm-models.json` (or generated from adapter `listModels()` calls). Include capabilities, parameter schemas, and context lengths so the frontend can render the ModelSelector dynamically.  
**Acceptance criteria:**
- [ ] Returns an array of providers, each with an array of models.
- [ ] Each model includes `id`, `name`, `context_length`, `capabilities`, and `parameters`.
- [ ] Response shape matches the frontend's `LLMProvider[]` type.
- [ ] Integration test asserts at least one provider and one model are returned.
**Estimated effort:** 4 hours  
**Blocked by:** AI-1.2  
**Owner:** Eng Lead

### Task AI-1.9 — Add provider-level rate limiting and budget enforcement
**Files modified:** `src/services/playground.service.ts`, `src/middlewares/rate-limit-per-key.middleware.ts` (optional extension)  
**Description:** Add a per-provider token bucket inside `PlaygroundProxyService` (in-memory, backed by Redis if available). Enforce a workspace-level monthly budget by querying `SUM(cost_usd)` from `logs` before each run.  
**Acceptance criteria:**
- [ ] Rate limit returns 429 with `retry_after` when provider bucket is exhausted.
- [ ] Budget exceeded returns 429 with code `budget_exceeded`.
- [ ] Rate limit and budget headers are present in every playground response.
- [ ] Unit tests simulate bucket exhaustion and budget overrun.
**Estimated effort:** 6 hours  
**Blocked by:** AI-1.6  
**Owner:** Eng Lead

### Task AI-1.10 — Add playground route to OpenAPI spec
**Files modified:** `docs/openapi.yaml`  
**Description:** Document `POST /v1/playground/run` and `GET /v1/playground/models` with request/response schemas, including the NDJSON stream response type.  
**Acceptance criteria:**
- [ ] Swagger UI at `/docs` renders the playground section correctly.
- [ ] All schemas are valid OpenAPI 3.0.3.
**Estimated effort:** 2 hours  
**Blocked by:** AI-1.7, AI-1.8  
**Owner:** Eng Lead

---

## Phase 2: Playground Frontend (Weeks 2–4)

### Task AI-2.1 — Scaffold Playground page and Zustand store
**Files modified:** `ui/src/app/playground/page.tsx`, `ui/src/stores/playground.store.ts`  
**Description:** Create the Next.js client component page for the Playground. Set up a Zustand store for playground UI state: selected model, parameter values, variable sets, prompt sections, and streaming output.  
**Acceptance criteria:**
- [ ] Page renders at `/playground` without errors.
- [ ] Zustand store persists selected model and parameters across hot reloads (dev-only).
- [ ] Store exposes actions for `setSelectedModel`, `setParameterValues`, `addVariableSet`, `updatePromptSection`.
**Estimated effort:** 5 hours  
**Blocked by:** None  
**Owner:** Frontend Lead

### Task AI-2.2 — Port ModelSelector component
**Files modified:** `ui/src/app/playground/components/ModelSelector.tsx`  
**Description:** Reuse the old frontend's `ModelSelector` UI tree, but replace Redux with Zustand and Axios with `api.ts`. Use shadcn `Select` and `Command` (for searchable dropdown). Display model capabilities as badges.  
**Acceptance criteria:**
- [ ] Dropdown shows providers grouped by slug.
- [ ] Selecting a provider filters models.
- [ ] Each model shows capability badges (streaming, vision, JSON mode, function calling).
- [ ] Disabled models (unsupported by workspace config) are greyed out.
**Estimated effort:** 5 hours  
**Blocked by:** AI-2.1  
**Owner:** Frontend Lead

### Task AI-2.3 — Port EditorTab with Monaco integration
**Files modified:** `ui/src/app/playground/components/EditorTab.tsx`  
**Description:** Port the Monaco-based prompt editor. Add Mustache variable highlighting via a custom Monarch tokenizer. Support system/user/assistant role tabs. Auto-detect variables from `{{var}}` syntax and sync them to the Zustand store.  
**Acceptance criteria:**
- [ ] Monaco editor loads with syntax highlighting for Mustache.
- [ ] Typing `{{name}}` adds `name` to the variable sets panel automatically.
- [ ] Role tabs (system, user, assistant) can be added/removed/reordered.
- [ ] Editor content is persisted in Zustand (not localStorage — session-only).
**Estimated effort:** 8 hours  
**Blocked by:** AI-2.1  
**Owner:** Frontend Lead

### Task AI-2.4 — Build NDJSON streaming consumer hook
**Files modified:** `ui/src/app/playground/hooks/usePlaygroundStream.ts`  
**Description:** Implement a React hook that calls `api.runPlayground()`, consumes the NDJSON stream, and exposes `output`, `toolCalls`, `metrics`, `isRunning`, `error`, and `abort` functions. Handle reconnection is not required (single-shot streams).  
**Acceptance criteria:**
- [ ] Hook yields tokens in real time (updates React state on every `token` chunk).
- [ ] Hook aggregates tool calls across multiple `tool_call` chunks.
- [ ] Hook exposes `metrics` only after the `metrics` chunk arrives.
- [ ] Calling `abort()` sends an AbortController signal and stops updates within 1 second.
- [ ] Error chunks surface as `{ code, message, retryable }` in the hook's `error` state.
**Estimated effort:** 6 hours  
**Blocked by:** AI-2.1, AI-1.7  
**Owner:** Frontend Lead

### Task AI-2.5 — Port StreamingOutputPanel
**Files modified:** `ui/src/app/playground/components/StreamingOutputPanel.tsx`  
**Description:** Port the old frontend's `StreamingOutputPanel` to the new stack. Display streaming text, tool call cards (expandable), metrics badge (latency, tokens, cost), and error banners. Auto-scroll to bottom while streaming.  
**Acceptance criteria:**
- [ ] Streaming text appears character-by-character as tokens arrive.
- [ ] Tool call cards are renderable and expandable.
- [ ] Metrics badge shows after the `metrics` chunk.
- [ ] Error state shows a colored banner with retry button (if `retryable`).
- [ ] Copy-to-clipboard button works for the full output.
- [ ] Auto-scroll stops if the user manually scrolls up.
**Estimated effort:** 6 hours  
**Blocked by:** AI-2.4  
**Owner:** Frontend Lead

### Task AI-2.6 — Port VariableSetsPanel and ModelConfigDrawer
**Files modified:** `ui/src/app/playground/components/VariableSetsPanel.tsx`, `ui/src/app/playground/components/ModelConfigDrawer.tsx`  
**Description:** VariableSetsPanel lets users create named presets of variable values. ModelConfigDrawer is a slide-out panel for temperature, max_tokens, top_p, etc. Both use shadcn `Drawer`, `Slider`, and `Input` components.  
**Acceptance criteria:**
- [ ] VariableSetsPanel supports create, rename, delete, and apply presets.
- [ ] ModelConfigDrawer renders sliders/inputs dynamically based on the selected model's `parameters` schema.
- [ ] Parameter values are validated against min/max bounds.
- [ ] Changes are reflected in the Zustand store immediately.
**Estimated effort:** 6 hours  
**Blocked by:** AI-2.1, AI-2.2  
**Owner:** Frontend Lead

### Task AI-2.7 — Port ParameterSchemaBuilder for response format editing
**Files modified:** `ui/src/app/playground/components/ParameterSchemaBuilder.tsx`  
**Description:** Reuse the old frontend's JSON schema editor pattern. Use Monaco for editing the `response_format.schema` object. Validate against JSON Schema Draft 7 using Ajv. Preview the schema as a form.  
**Acceptance criteria:**
- [ ] Monaco editor loads with JSON syntax highlighting and schema validation.
- [ ] Invalid JSON shows an inline error message.
- [ ] Schema is validated as JSON Schema Draft 7.
- [ ] "Apply" button injects the schema into the playground run request.
**Estimated effort:** 5 hours  
**Blocked by:** AI-2.3  
**Owner:** Frontend Lead

### Task AI-2.8 — Compose PlaygroundLayout with Resizable panes
**Files modified:** `ui/src/app/playground/components/PlaygroundLayout.tsx`  
**Description:** Use shadcn `Resizable` (or `react-resizable-panels`) to create a split-pane layout: left side for EditorTab + VariableSetsPanel, right side for StreamingOutputPanel + ModelConfigDrawer. Include a top toolbar with Run button, ModelSelector, and streaming toggle.  
**Acceptance criteria:**
- [ ] Layout is responsive: stacked on mobile, side-by-side on desktop.
- [ ] Resizable handles work smoothly (no layout shift).
- [ ] Run button is disabled while `isRunning` is true.
- [ ] Streaming toggle switches between `stream=true` and `stream=false`.
- [ ] Page initial render time is < 1.5s on a 2023 MacBook Air.
**Estimated effort:** 6 hours  
**Blocked by:** AI-2.2, AI-2.5, AI-2.6  
**Owner:** Frontend Lead

---

## Phase 3: A/B Testing Backend (Weeks 3–5)

### Task AI-3.1 — Implement ABTestEngineService and statistical utilities
**Files modified:** `src/services/ab-test.service.ts`, `src/utils/statistics.ts`  
**Description:** Build the core A/B test engine. `statistics.ts` implements Welch's t-test, two-proportion z-test, and percentile bootstrap CI (10,000 resamples). `ABTestEngineService` manages test lifecycle: create, run batch, compute stats, promote winner.  
**Acceptance criteria:**
- [ ] Welch's t-test p-value is within `1e-6` of `scipy.stats.ttest_ind` on identical synthetic data.
- [ ] Bootstrap 95% CI contains the true mean difference in > 94% of 1000 Monte Carlo simulations.
- [ ] Win rate calculation handles edge cases (0 successes, all successes).
- [ ] Service rejects `sample_size < 10` as invalid.
**Estimated effort:** 10 hours  
**Blocked by:** AI-1.1  
**Owner:** ML Engineer

### Task AI-3.2 — Implement A/B test controller and routes
**Files modified:** `src/controllers/ab-test.controller.ts`, `src/routes/ab-test.route.ts`, `src/app.ts`  
**Description:** Wire the REST API for A/B testing. Endpoints: `POST /v1/ab-tests`, `GET /v1/ab-tests`, `GET /v1/ab-tests/:id`, `POST /v1/ab-tests/:id/run`, `POST /v1/ab-tests/:id/promote`, `DELETE /v1/ab-tests/:id`. Use Joi validation for request bodies.  
**Acceptance criteria:**
- [ ] All endpoints return correct HTTP status codes (201, 200, 404, 422, 403).
- [ ] `POST /v1/ab-tests/:id/run` triggers a batch run and returns `202 Accepted` with a `run_id`.
- [ ] `POST /v1/ab-tests/:id/promote` updates the prompt version index and returns the promoted version.
- [ ] Integration tests cover create → run → promote → delete lifecycle.
**Estimated effort:** 8 hours  
**Blocked by:** AI-3.1  
**Owner:** Eng Lead

### Task AI-3.3 — Implement dataset storage API
**Files modified:** `src/services/dataset.service.ts`, `src/controllers/dataset.controller.ts`, `src/routes/dataset.route.ts`  
**Description:** CRUD for datasets and records. `POST /v1/datasets` creates a dataset with headers. `POST /v1/datasets/:id/records` bulk uploads up to 500 records per call. `GET /v1/datasets/:id` returns dataset + paginated records.  
**Acceptance criteria:**
- [ ] Bulk upload of 500 records completes in < 2 seconds on developer SQLite.
- [ ] Records are stored as JSON in `dataset_records.record_json`.
- [ ] Workspace scoping prevents reading another workspace's datasets.
- [ ] Integration tests cover upload, retrieval, and pagination.
**Estimated effort:** 6 hours  
**Blocked by:** AI-1.1  
**Owner:** Eng Lead

### Task AI-3.4 — Build A/B Testing frontend page and modals
**Files modified:** `ui/src/app/ab-tests/page.tsx`, `ui/src/app/ab-tests/components/CreateABTestModal.tsx`, `ui/src/app/ab-tests/components/ABTestResultModal.tsx`  
**Description:** Port the old frontend's `ABTestingPage`, `CreateABTestModal`, and `ABTestResultModal`. Replace Redux with React Query + Zustand. Use shadcn `Dialog`, `Table`, and `Badge`. Display p-value, win rate, and confidence interval with color coding (green if p < 0.05).  
**Acceptance criteria:**
- [ ] User can create a test by selecting two prompt versions, a dataset, and a metric.
- [ ] Result modal shows bar charts for win rate and mean metric delta.
- [ ] "Promote Winner" button is disabled unless `p_value < 0.05`.
- [ ] Frontend polls `GET /v1/ab-tests/:id` every 5 seconds while `status === 'running'`.
**Estimated effort:** 10 hours  
**Blocked by:** AI-3.2, AI-3.3, AI-2.1  
**Owner:** Frontend Lead

---

## Phase 4: Evaluation Manager Backend (Weeks 4–7)

### Task AI-4.1 — Implement rule-based evaluator engine
**Files modified:** `src/services/evaluators/rule.evaluator.ts`, `src/services/evaluators/ajv.validator.ts`  
**Description:** Build the v1 rule evaluator. Support `regex_match`, `regex_no_match`, `contains`, `not_contains`, `json_schema`, `exact_match`, `length_min`, `length_max`. Use `ajv` for JSON Schema validation.  
**Acceptance criteria:**
- [ ] Each rule type returns `{ passed: boolean, score: number, reason?: string }`.
- [ ] `json_schema` rule validates output against Draft 7 schema.
- [ ] Regex rules handle invalid patterns gracefully (catch and return `passed: false`).
- [ ] Unit tests cover all 8 rule types with positive and negative cases.
**Estimated effort:** 6 hours  
**Blocked by:** AI-1.1  
**Owner:** ML Engineer

### Task AI-4.2 — Implement LLM-as-judge evaluator engine (v2)
**Files modified:** `src/services/evaluators/llm-judge.evaluator.ts`  
**Description:** Build the v2 judge evaluator. Construct a judge prompt from a rubric template, send to a judge model (default `gpt-4o-mini`), parse the structured JSON response, and return a score. Support self-consistency ensembling (configurable, default 1).  
**Acceptance criteria:**
- [ ] Judge prompt includes rubric, input, expected output, and actual output.
- [ ] Response is parsed with Zod schema: `{ score: number, reasoning: string, confidence: enum }`.
- [ ] Parsing failure triggers one retry with stricter instructions; second failure marks `score: null`.
- [ ] Ensemble mode (size > 1) returns the median score and concatenated reasoning.
- [ ] Unit tests mock the provider adapter and verify score aggregation.
**Estimated effort:** 10 hours  
**Blocked by:** AI-1.3, AI-4.1  
**Owner:** ML Engineer

### Task AI-4.3 — Implement EvaluationRunnerService
**Files modified:** `src/services/evaluation-runner.service.ts`  
**Description:** Orchestrate eval runs: load dataset, render prompts with Mustache, call provider for each record, apply criteria (rule or judge), aggregate scores, and write results to `eval_run_results`. Process records in batches of 10 to limit concurrency.  
**Acceptance criteria:**
- [ ] Eval run processes all dataset records and updates `eval_runs.completed_records` incrementally.
- [ ] Aggregate score is a weighted average of per-criterion scores.
- [ ] Run stops on first unrecoverable provider error and marks `status = 'failed'`.
- [ ] Cost and latency of every inference are stored per record.
- [ ] Unit test with mock provider processes 20 records in < 1 second.
**Estimated effort:** 10 hours  
**Blocked by:** AI-4.1, AI-4.2, AI-3.3  
**Owner:** Eng Lead

### Task AI-4.4 — Implement evaluation run controller and routes
**Files modified:** `src/controllers/evaluation-run.controller.ts`, `src/routes/evaluation-run.route.ts`, `src/app.ts`  
**Description:** Wire `POST /v1/evaluations/:id/run`, `GET /v1/evaluations/:id/runs`, `GET /v1/evaluations/:id/results`, `GET /v1/evaluations/:id/trends`. Results support pagination and filtering by `eval_run_id`.  
**Acceptance criteria:**
- [ ] `POST /v1/evaluations/:id/run` returns `202 Accepted` with `run_id`.
- [ ] `GET /v1/evaluations/:id/results` returns paginated results with per-criterion breakdowns.
- [ ] `GET /v1/evaluations/:id/trends` returns daily `avg_score` time series for Recharts.
- [ ] Integration tests cover rule-based and judge-based eval runs.
**Estimated effort:** 8 hours  
**Blocked by:** AI-4.3  
**Owner:** Eng Lead

### Task AI-4.5 — Build Evaluation Manager frontend
**Files modified:** `ui/src/app/evaluations/page.tsx`, `ui/src/app/evaluations/components/EvaluationTable.tsx`, `ui/src/app/evaluations/components/CriteriaBuilder.tsx`, `ui/src/app/evaluations/components/DatasetUploader.tsx`  
**Description:** Port the old frontend's `EvaluationManager`, `EvaluationTable`, and `CreateEvaluation` flow. CriteriaBuilder lets users add rule criteria (regex, keywords) or judge criteria (rubric textarea). DatasetUploader accepts CSV/JSON drag-and-drop and calls the bulk upload API.  
**Acceptance criteria:**
- [ ] CriteriaBuilder supports adding/removing/reordering criteria.
- [ ] Rule criteria show a live preview (test against sample text).
- [ ] Judge criteria include a rubric textarea and model selector.
- [ ] DatasetUploader parses CSV with PapaParse and uploads in batches of 500.
- [ ] Eval run button triggers a run and navigates to a results page with a score trend chart.
**Estimated effort:** 12 hours  
**Blocked by:** AI-4.4, AI-3.4  
**Owner:** Frontend Lead

### Task AI-4.6 — Add EvalRollupJob for trend caching
**Files modified:** `src/jobs/eval-rollup.job.ts`, `src/server.ts`  
**Description:** Lightweight background job (similar to `PromptReconciliationJob`) that runs every 5 minutes, computes daily aggregates per evaluation from `eval_run_results`, and upserts into `evaluation_daily_rollup`.  
**Acceptance criteria:**
- [ ] Job computes `avg_score`, `result_count`, `min_score`, `max_score` per evaluation per day.
- [ ] Job is idempotent: rerunning produces identical output.
- [ ] Job logs its progress via the existing `promptmetrics-logger.service.ts`.
- [ ] Unit test with seeded data verifies rollup math matches query-time aggregation.
**Estimated effort:** 5 hours  
**Blocked by:** AI-4.3  
**Owner:** Eng Lead

---

## Phase 5: Compliance & Risk Backend (Weeks 6–8)

### Task AI-5.1 — Implement ComplianceScorerService
**Files modified:** `src/services/compliance.service.ts`, `src/services/compliance-engine.ts`  
**Description:** Build the rule-based compliance engine. Default rules: email detection, phone numbers, SSN, credit card (Luhn), API key entropy heuristic, toxicity keyword list. Rules are configurable per workspace via `compliance_rules` table.  
**Acceptance criteria:**
- [ ] Email regex detects `alice@example.com`.
- [ ] SSN regex detects `123-45-6789`.
- [ ] Credit card rule passes Luhn validation before flagging.
- [ ] API key heuristic flags strings with entropy > 4.5 and length > 20.
- [ ] Overall score is 100 when no violations; drops proportionally by severity weights.
- [ ] Unit tests cover all default rules with synthetic data.
**Estimated effort:** 8 hours  
**Blocked by:** AI-1.1  
**Owner:** ML Engineer

### Task AI-5.2 — Implement compliance controller and routes
**Files modified:** `src/controllers/compliance.controller.ts`, `src/routes/compliance.route.ts`, `src/app.ts`  
**Description:** Wire `GET /v1/compliance/rules`, `POST /v1/compliance/rules`, `POST /v1/compliance/score`, `GET /v1/compliance/scores`, `GET /v1/compliance/violations`. Rules are workspace-scoped. On-demand scoring accepts arbitrary text.  
**Acceptance criteria:**
- [ ] `POST /v1/compliance/score` returns overall score, risk level, and breakdown within 200ms for 1KB text.
- [ ] `GET /v1/compliance/violations` returns paginated violations with matched text and position.
- [ ] Custom rules can be created via `POST /v1/compliance/rules`.
- [ ] Integration tests cover default rules and a custom regex rule.
**Estimated effort:** 6 hours  
**Blocked by:** AI-5.1  
**Owner:** Eng Lead

### Task AI-5.3 — Build Compliance & Risk frontend
**Files modified:** `ui/src/app/compliance/page.tsx`, `ui/src/app/compliance/components/RiskDistributionCard.tsx`, `ui/src/app/compliance/components/ComplianceMetricsCard.tsx`, `ui/src/app/compliance/components/ViolationTable.tsx`  
**Description:** Port the old frontend's `ReviewPromptsPage`, `RiskDistributionCard`, and `ComplianceMetricsCard`. RiskDistributionCard uses a Recharts PieChart. ComplianceMetricsCard shows a score gauge. ViolationTable lists matches with severity colors.  
**Acceptance criteria:**
- [ ] RiskDistributionCard renders a pie chart with CRITICAL/HIGH/MEDIUM/LOW segments.
- [ ] ComplianceMetricsCard shows a circular gauge for the overall score.
- [ ] ViolationTable highlights matched substrings in red.
- [ ] Clicking a prompt navigates to the prompt detail with a compliance tab.
**Estimated effort:** 10 hours  
**Blocked by:** AI-5.2, AI-2.1  
**Owner:** Frontend Lead

---

## Phase 6: Integration, Testing & Polish (Weeks 8–10)

### Task AI-6.1 — Write mock LLM adapter for tests
**Files modified:** `tests/fixtures/mock-llm.adapter.ts`  
**Description:** Implement a deterministic `MockLLMAdapter` that returns fixed tokens, metrics, and optional errors. Used across unit and integration tests for Playground, A/B Testing, and Evaluation.  
**Acceptance criteria:**
- [ ] Mock adapter implements `LLMProviderAdapter`.
- [ ] Supports configurable response text, token counts, latency, and error injection.
- [ ] Streaming yields chunks in deterministic order.
**Estimated effort:** 3 hours  
**Blocked by:** AI-1.2  
**Owner:** Eng Lead

### Task AI-6.2 — Write AI features seed fixtures
**Files modified:** `tests/fixtures/ai-features.fixtures.ts`  
**Description:** Create a fixture helper that seeds: 2 prompts with 3 versions, 1 dataset with 20 records, 1 evaluation with 2 criteria, 1 completed A/B test with 200 runs, 5 compliance rules.  
**Acceptance criteria:**
- [ ] Fixture helper is reusable in unit, integration, and E2E tests.
- [ ] Seeding completes in < 3 seconds.
- [ ] Data is workspace-scoped (does not leak to other tests).
**Estimated effort:** 4 hours  
**Blocked by:** AI-1.1  
**Owner:** Eng Lead

### Task AI-6.3 — Write backend integration tests for playground
**Files modified:** `tests/integration/playground.test.ts`  
**Description:** HTTP-level tests for `POST /v1/playground/run` (streaming and non-streaming) and `GET /v1/playground/models`. Assert correct response shapes, metrics accuracy, log insertion, and abort behavior.  
**Acceptance criteria:**
- [ ] Non-streaming run returns 200 with correct output, metrics, and run_id.
- [ ] Streaming run returns NDJSON with at least one token chunk and a metrics chunk.
- [ ] Aborting a streaming run stops provider calls.
- [ ] Missing variables return 422.
- [ ] Mock adapter is used; no real provider API keys are required.
**Estimated effort:** 6 hours  
**Blocked by:** AI-1.7, AI-6.1, AI-6.2  
**Owner:** Eng Lead

### Task AI-6.4 — Write backend integration tests for A/B testing
**Files modified:** `tests/integration/ab-testing.test.ts`  
**Description:** End-to-end test of A/B test lifecycle: create, run batch, assert statistics, promote winner, delete.  
**Acceptance criteria:**
- [ ] Test completes with `p_value` < 0.05 on deterministic mock data where version B is clearly better.
- [ ] Winner promotion updates the prompt version index correctly.
- [ ] Workspace isolation is verified (cross-tenant data not visible).
**Estimated effort:** 5 hours  
**Blocked by:** AI-3.2, AI-6.2  
**Owner:** ML Engineer

### Task AI-6.5 — Write backend integration tests for evaluations
**Files modified:** `tests/integration/evaluation-run.test.ts`  
**Description:** Test rule-based and judge-based eval runs. Assert scores, per-criterion breakdowns, and trend data.  
**Acceptance criteria:**
- [ ] Rule-based eval run scores 1.0 when output matches regex and 0.0 when it does not.
- [ ] Judge-based eval run returns a numeric score between 1 and 5.
- [ ] Trend endpoint returns daily aggregates matching seeded data.
**Estimated effort:** 5 hours  
**Blocked by:** AI-4.4, AI-6.2  
**Owner:** ML Engineer

### Task AI-6.6 — Write backend integration tests for compliance
**Files modified:** `tests/integration/compliance.test.ts`  
**Description:** Test compliance scoring endpoint with text containing known PII. Assert score drops and violations are detected.  
**Acceptance criteria:**
- [ ] Text with an email address returns score < 100 and flags the email rule.
- [ ] Text with an SSN returns `risk_level = 'HIGH'` or higher.
- [ ] Clean text returns score 100 and `risk_level = 'LOW'`.
**Estimated effort:** 4 hours  
**Blocked by:** AI-5.2, AI-6.2  
**Owner:** ML Engineer

### Task AI-6.7 — Write Playwright E2E tests for playground
**Files modified:** `ui/e2e/playground.spec.ts`  
**Description:** E2E test: open playground page, enter a prompt, select a model, click Run, assert streamed output appears within 10 seconds. Test cancel button and error state display.  
**Acceptance criteria:**
- [ ] Playground page loads without console errors.
- [ ] Clicking Run displays streamed tokens in the output panel.
- [ ] Metrics badge appears after stream completes.
- [ ] Cancel button stops the stream.
- [ ] Error state displays a retry button when mock adapter is configured to fail.
**Estimated effort:** 6 hours  
**Blocked by:** AI-2.8  
**Owner:** Frontend Lead

### Task AI-6.8 — Write Playwright E2E tests for A/B testing
**Files modified:** `ui/e2e/ab-testing.spec.ts`  
**Description:** E2E test: create an A/B test, wait for completion, assert winner is shown, click Promote.  
**Acceptance criteria:**
- [ ] User can create a test via the UI modal.
- [ ] Result page shows p-value, win rate, and confidence interval.
- [ ] "Promote Winner" button is enabled when `p_value < 0.05`.
- [ ] Promoting updates the prompt detail page to reflect the new default version.
**Estimated effort:** 5 hours  
**Blocked by:** AI-3.4  
**Owner:** Frontend Lead

### Task AI-6.9 — Add OpenAPI documentation for all AI endpoints
**Files modified:** `docs/openapi.yaml`  
**Description:** Document A/B testing, datasets, evaluation runs, and compliance endpoints with full request/response schemas.  
**Acceptance criteria:**
- [ ] Swagger UI renders all new sections without validation errors.
- [ ] All stream chunk types are documented under a `StreamChunk` schema.
**Estimated effort:** 4 hours  
**Blocked by:** AI-3.2, AI-4.4, AI-5.2  
**Owner:** Eng Lead

### Task AI-6.10 — Performance audit and bundle analysis
**Files modified:** None (audit only)  
**Description:** Run Lighthouse and `next-bundle-analyzer` on the dashboard after adding Monaco, Recharts, and Zustand. Identify opportunities to lazy-load heavy components.  
**Acceptance criteria:**
- [ ] Playground page bundle is < 600 KB gzipped (Monaco is dynamically imported).
- [ ] Lighthouse Performance score > 70 on playground page.
- [ ] No render-blocking scripts from provider SDKs (they are backend-only).
**Estimated effort:** 4 hours  
**Blocked by:** AI-2.8  
**Owner:** Frontend Lead

---

## Phase 7: ML Model Selection & V2 Enhancements (Weeks 10–12)

### Task AI-7.1 — Evaluate and select judge LLM for v2
**Files modified:** None (research spike)  
**Description:** Run a benchmark comparing `gpt-4o-mini`, `claude-3-haiku-20240307`, and `command-r` as judge models on 50 hand-labeled prompt-output pairs. Measure inter-rater reliability (Cohen's kappa vs human labels), cost per evaluation, and latency.  
**Acceptance criteria:**
- [ ] Benchmark results are documented in `docs/research/judge-model-benchmark-2026-05.md`.
- [ ] Selected model achieves Cohen's kappa > 0.70 on the benchmark.
- [ ] Cost per 1K evaluations is < $2.00 for the selected model.
- [ ] Recommendation includes a fallback model if the primary is rate-limited.
**Estimated effort:** 12 hours  
**Blocked by:** AI-4.2  
**Owner:** ML Engineer

### Task AI-7.2 — Implement prompt optimization endpoint (v2)
**Files modified:** `src/services/prompt-optimization.service.ts`, `src/controllers/playground.controller.ts`  
**Description:** `POST /v1/playground/optimize` sends the current prompt to an LLM with a system prompt instructing it to suggest improvements (clarity, specificity, examples, chain-of-thought). Returns a structured diff.  
**Acceptance criteria:**
- [ ] Endpoint returns an array of suggestions: `{ original: string, suggested: string, reason: string }`.
- [ ] Suggestions are validated to not alter Mustache variable syntax.
- [ ] Integration test verifies at least one suggestion is returned for a vague prompt.
**Estimated effort:** 6 hours  
**Blocked by:** AI-7.1  
**Owner:** ML Engineer

### Task AI-7.3 — Implement semantic compliance scoring (v2)
**Files modified:** `src/services/compliance.service.ts`  
**Description:** Add an optional `semantic` rule type that uses an embedding model (e.g., `text-embedding-3-small`) to compare prompt/output against a policy embedding index. Flag semantic similarity to known toxic or biased content.  
**Acceptance criteria:**
- [ ] Semantic rule computes cosine similarity between text and policy embeddings.
- [ ] Threshold is configurable per rule (default 0.85).
- [ ] Does not block v1 rule-based scoring if embedding service is unavailable.
**Estimated effort:** 8 hours  
**Blocked by:** AI-7.1  
**Owner:** ML Engineer

### Task AI-7.4 — Add cost/latency/token breakdown charts per prompt
**Files modified:** `ui/src/app/prompts/[name]/components/CostBreakdownChart.tsx`, `ui/src/lib/api.ts`  
**Description:** Extend the prompt detail page with Recharts bar/line charts showing per-version cost, latency, and token usage over time. Data comes from the existing `/v1/metrics/prompts` endpoint (already implemented in v1.1.0).  
**Acceptance criteria:**
- [ ] Chart shows daily cost, latency p50/p95, and token usage for the selected prompt.
- [ ] Toggle between versions overlays multiple lines on the same chart.
- [ ] Empty state shows "No runs yet" when the prompt has no logs.
**Estimated effort:** 6 hours  
**Blocked by:** AI-2.1  
**Owner:** Frontend Lead

---

## Dependency Graph

```
Phase 1 (Backend Playground):
  AI-1.1 → AI-1.2 → AI-1.3 → AI-1.6 → AI-1.7
                      ↓         ↓
                  AI-1.4    AI-1.9
                      ↓
                  AI-1.5
                      ↓
                  AI-1.8
                      ↓
                  AI-1.10

Phase 2 (Frontend Playground):
  AI-2.1 → AI-2.2 → AI-2.8
      ↓       ↓
  AI-2.3 → AI-2.7
      ↓
  AI-2.4 → AI-2.5
      ↓
  AI-2.6

Phase 3 (A/B Testing):
  AI-1.1 → AI-3.1 → AI-3.2 → AI-3.4
              ↓
          AI-3.3

Phase 4 (Evaluation):
  AI-1.1 → AI-4.1 → AI-4.2 → AI-4.3 → AI-4.4 → AI-4.5
                                    ↓
                                AI-4.6

Phase 5 (Compliance):
  AI-1.1 → AI-5.1 → AI-5.2 → AI-5.3

Phase 6 (Testing):
  AI-6.1 (parallel with AI-6.2)
  AI-6.3 (needs AI-1.7, AI-6.1, AI-6.2)
  AI-6.4 (needs AI-3.2, AI-6.2)
  AI-6.5 (needs AI-4.4, AI-6.2)
  AI-6.6 (needs AI-5.2, AI-6.2)
  AI-6.7 (needs AI-2.8)
  AI-6.8 (needs AI-3.4)
  AI-6.9 (needs AI-3.2, AI-4.4, AI-5.2)
  AI-6.10 (needs AI-2.8)

Phase 7 (V2):
  AI-7.1 → AI-7.2
         → AI-7.3
  AI-7.4 (needs AI-2.1)
```

---

## Rollback Plan

1. All new endpoints are additive and mounted independently in `src/app.ts`. If any phase is unstable, comment out the route mount and redeploy without affecting the v1.1.0 observability dashboard.
2. New migrations are backward-compatible (only add tables/columns). Rolling back requires running `down()` functions, which is safe.
3. The old frontend (`pm-app-frontend`) remains operational as a reference during the transition. If the Next.js playground is broken, users can be directed to the legacy UI while fixes are deployed.

---

## Notes

- **ML model selection:** Default judge model is `gpt-4o-mini` for cost efficiency. `claude-3-haiku` is the fallback. Do not use `gpt-4o` or `claude-3-opus` for judging in production unless the benchmark (AI-7.1) proves significant quality gains.
- **Cost caps:** Every workspace gets a default $50/month judge budget. This is stored in `config` table as `workspace:{id}:judge_budget_usd`. Admins can override via an env var or API.
- **Streaming safety:** Never cache streaming responses. Always write a `logs` row even if the client disconnects early, so cost tracking remains accurate.
- **Statistical rigor:** A/B tests require a minimum sample size of 10 per variant. The UI should warn users if they attempt to run with fewer records.
- **Mustache security:** The existing `escape: (text) => text` option in `mustache.render` is intentional — we do not HTML-escape prompt content because it is sent to LLM APIs, not rendered as HTML. However, the compliance engine scans for script injection patterns as a defense-in-depth measure.
