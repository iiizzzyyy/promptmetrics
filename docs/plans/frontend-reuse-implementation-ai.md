# AI/ML System Integration — Frontend Reuse Implementation Plan

**Status:** Proposed  
**Date:** 2026-04-29  
**Scope:** Port Prompt Playground, A/B Testing, Evaluation Manager, and Compliance & Risk modules from `pm-app-frontend` into the Next.js 16 dashboard.  
**Estimated Duration:** 10–12 weeks  
**Target Version:** 1.2.0  

---

## 1. Architecture Overview

### 1.1 High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              User Browser                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  Prompt Detail  │  │  Playground     │  │  A/B Test / Eval /        │  │
│  │  (Next.js page) │  │  (Client comp)  │  │  Compliance pages         │  │
│  └────────┬────────┘  └────────┬────────┘  └──────────────────────┬──────┘  │
└───────────┼──────────────────┼──────────────────────────────────┼────────┘
            │                  │  HTTP/JSON                       │
            │      ┌───────────▼───────────┐                   │
            │      │   Next.js API Routes    │                   │
            │      │   (optional UI BFF)     │                   │
            │      └───────────┬───────────┘                   │
            │                  │                                │
┌───────────▼──────────────────▼────────────────────────────────▼─────────────┐
│                           Express API (port 3000)                          │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────────┐  │
│  │ /v1/playground  │ │ /v1/ab-tests    │ │ /v1/evaluations             │  │
│  │ /v1/providers   │ │ /v1/datasets    │ │ /v1/compliance              │  │
│  └────────┬────────┘ └────────┬────────┘ └──────────────────────┬────────┘  │
│           │                   │                                   │          │
│  ┌────────▼────────┐ ┌────────▼────────┐ ┌──────────────────────▼───────┐  │
│  │ PlaygroundProxy │ │ ABTestEngine    │ │ EvaluationRunner              │  │
│  │   Service       │ │   Service       │ │   Service                     │  │
│  │                 │ │                 │ │                               │  │
│  │ ┌─────────────┐ │ │ ┌─────────────┐ │ │ ┌──────────┐  ┌────────────┐ │  │
│  │ │ LLMProvider │ │ │ │ Statistical │ │ │ │ RuleEval │  │ LLMJudge   │ │  │
│  │ │   Adapter   │ │ │ │   Engine    │ │ │ │  v1      │  │   v2       │ │  │
│  │ │ (OpenAI,    │ │ │ │ (Welch t,   │ │ │ └──────────┘  └────────────┘ │  │
│  │ │ Anthropic,  │ │ │ │  bootstrap) │ │ │                              │  │
│  │ │ Cohere)     │ │ │ └─────────────┘ │ │ ┌──────────────────────────┐ │  │
│  │ └─────────────┘ │ └─────────────────┘ │ │ ComplianceScorer         │ │  │
│  │                 │                     │ │ │ (Regex/Heuristic v1)     │ │  │
│  │ ┌─────────────┐ │                     │ │ └──────────────────────────┘ │  │
│  │ │ Mustache    │ │                     │ └──────────────────────────────┘  │
│  │ │  Renderer   │ │                     │                                   │  │
│  │ └─────────────┘ │                     │                                   │  │
│  └─────────────────┘                     │                                   │  │
│                                           │                                   │  │
│  ┌────────────────────────────────────────┴─────────────────────────────────┐│
│  │                         DatabaseAdapter                                   ││
│  │  (SQLite / PostgreSQL) — prompts, logs, runs, ab_tests, datasets, etc.  ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Design Principles

1. **Backend-First Proxy:** The dashboard never calls LLM providers directly from the browser. All provider traffic flows through `POST /v1/playground/run` (and its streaming variant). This keeps API keys server-side, enables audit logging, and lets us enforce workspace-level rate limits.
2. **Replace Socket.IO with SSE/NDJSON:** The old frontend used Socket.IO for token streaming. The new backend has no Socket.IO server. We use HTTP streaming (Server-Sent Events or NDJSON over `fetch`) because it works through standard load balancers, requires no persistent connections, and maps cleanly to the existing Express middleware stack.
3. **Service Layer Reuse:** All new backend code follows the existing pattern — thin controllers, fat services, hand-written SQL in services, no ORM. Controllers live in `src/controllers/`, services in `src/services/`, routes in `src/routes/`.
4. **Workspace Scoping:** Every new table gets `workspace_id`. Every new endpoint uses `tenantMiddleware` + `authenticateApiKey` + `rateLimitPerKey`.
5. **Migration-First Schema:** New tables are created via numbered `umzug` migrations in `migrations/`, with dialect-conditional DDL for SQLite and PostgreSQL.

---

## 2. Streaming Architecture

### 2.1 Protocol Decision: NDJSON over fetch

**Decision:** Use **NDJSON** (newline-delimited JSON) streamed over a standard HTTP `POST` response for playground output. Do NOT use Server-Sent Events (SSE) for the run endpoint.

**Rationale:**

| Concern | SSE | NDJSON over fetch | WebSocket/Socket.IO |
|---------|-----|-------------------|---------------------|
| Request body size | Limited by URL length for GET-based SSE | Unbounded POST body | Unbounded |
| Browser compatibility | Good | Excellent (ReadableStream) | Good (requires lib) |
| Proxy/Load balancer | Needs buffering config | Works out of the box | Needs sticky sessions |
| Cancellation | Close EventSource | AbortController | Close socket |
| Tool call support | Hard to interleave | Easy: JSON lines | Easy |
| Backend complexity | Extra `text/event-stream` formatting | Minimal: `res.write(JSON.stringify(chunk) + '\n')` | Requires Socket.IO server |

**How NDJSON works in the UI:**

```typescript
// ui/src/lib/api.ts
async function* streamPlaygroundRun(payload: PlaygroundRunPayload): AsyncGenerator<StreamChunk> {
  const res = await fetch(`${API_BASE}/v1/playground/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      'X-Workspace-Id': workspaceId,
      'Accept': 'application/x-ndjson',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`API error: ${res.status}`);
  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.trim()) yield JSON.parse(line);
    }
  }
}
```

**How NDJSON works in the backend:**

```typescript
// src/controllers/playground.controller.ts (excerpt)
res.setHeader('Content-Type', 'application/x-ndjson');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');

for await (const chunk of provider.streamMessages(payload)) {
  res.write(JSON.stringify(chunk) + '\n');
  if (chunk.type === 'done' || chunk.type === 'error') break;
}
res.end();
```

### 2.2 Stream Chunk Schema

Each line is a JSON object with a discriminated `type` field:

```typescript
interface StreamChunk {
  type: 'token' | 'tool_call' | 'done' | 'error' | 'metrics';
  run_id: string;
}

interface TokenChunk extends StreamChunk {
  type: 'token';
  token: string;
  choice_index?: number;
}

interface ToolCallChunk extends StreamChunk {
  type: 'tool_call';
  tool_call: {
    id: string;
    function: { name: string; arguments: string };
  };
}

interface MetricsChunk extends StreamChunk {
  type: 'metrics';
  latency_ms: number;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  model: string;
  provider: string;
}

interface DoneChunk extends StreamChunk {
  type: 'done';
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
}

interface ErrorChunk extends StreamChunk {
  type: 'error';
  code: 'timeout' | 'rate_limit' | 'content_policy' | 'provider_error' | 'validation_error';
  message: string;
  retryable: boolean;
}
```

### 2.3 Cancellation & Timeouts

- **Frontend:** The UI stores an `AbortController` per run. Clicking "Cancel" calls `controller.abort()`, which closes the fetch. The backend detects this via `req.destroyed` or `res.on('close')`.
- **Backend:** The `PlaygroundProxyService` passes an `AbortSignal` to the provider adapter. Adapters forward this to the provider's SDK (e.g., OpenAI's `signal` option). A global 10-minute timeout is enforced by `Promise.race` in the service.

---

## 3. LLM Proxy Backend Design

### 3.1 New Endpoints

| Endpoint | Method | Description | Auth | Rate Limit |
|----------|--------|-------------|------|------------|
| `POST /v1/playground/run` | POST | Run a prompt against an LLM provider (non-streaming) | API key | Standard |
| `POST /v1/playground/run?stream=true` | POST | Stream tokens via NDJSON | API key | Standard |
| `GET /v1/playground/models` | GET | List available models per workspace | API key | Standard |
| `POST /v1/playground/optimize` | POST | Prompt optimization suggestion (v2) | API key | Standard |

### 3.2 Request/Response Schemas

#### `POST /v1/playground/run`

**Request Body:**
```typescript
interface PlaygroundRunRequest {
  prompt_name?: string;        // optional — if omitted, runs raw messages
  version_tag?: string;          // optional — defaults to latest active
  messages?: Array<{ role: string; content: string }>; // optional raw override
  variables?: Record<string, string>; // Mustache variables
  provider: 'openai' | 'anthropic' | 'cohere' | 'ollama' | 'azure_openai';
  model: string;                 // e.g. "gpt-4o", "claude-3-5-sonnet-20241022"
  parameters?: {
    temperature?: number;        // 0–2
    max_tokens?: number;          // >= 1
    top_p?: number;             // 0–1
    frequency_penalty?: number;  // -2–2
    presence_penalty?: number;   // -2–2
    response_format?: { type: 'json_object' | 'json_schema'; schema?: object };
    tools?: Array<{ type: 'function'; function: { name: string; description?: string; parameters: object } }>;
    tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  };
  stream?: boolean;              // default false
}
```

**Non-Streaming Response (200):**
```json
{
  "run_id": "run-uuid",
  "output": "The generated text...",
  "tool_calls": null,
  "metrics": {
    "latency_ms": 1240,
    "tokens_in": 342,
    "tokens_out": 128,
    "cost_usd": 0.00512,
    "model": "gpt-4o",
    "provider": "openai"
  },
  "finish_reason": "stop"
}
```

**Streaming Response:** `Content-Type: application/x-ndjson` — see Section 2.2.

#### `GET /v1/playground/models`

**Response (200):**
```json
{
  "providers": [
    {
      "slug": "openai",
      "name": "OpenAI",
      "models": [
        {
          "id": "gpt-4o",
          "name": "GPT-4o",
          "context_length": 128000,
          "capabilities": { "streaming": true, "json_mode": true, "function_calling": true, "vision": true },
          "parameters": [
            { "key": "temperature", "type": "number", "default_value": 1.0, "min": 0, "max": 2, "category": "sampling" },
            { "key": "max_tokens", "type": "integer", "default_value": 4096, "min": 1, "max": 16384, "category": "output" }
          ]
        }
      ]
    }
  ]
}
```

### 3.3 Provider Abstraction Layer

**New file:** `src/services/llm-provider.adapter.ts`

```typescript
export interface LLMProviderAdapter {
  readonly slug: string;
  readonly name: string;
  listModels(): Promise<ModelDescriptor[]>;
  chatCompletion(req: ChatCompletionRequest, signal?: AbortSignal): Promise<ChatCompletionResponse>;
  streamChatCompletion(req: ChatCompletionRequest, signal?: AbortSignal): AsyncGenerator<StreamChunk>;
  estimateCost(tokensIn: number, tokensOut: number, model: string): number;
}
```

**Implementation pattern:**

```typescript
// src/services/providers/openai.adapter.ts
import OpenAI from 'openai';

export class OpenAIAdapter implements LLMProviderAdapter {
  readonly slug = 'openai';
  readonly name = 'OpenAI';
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async *streamChatCompletion(req: ChatCompletionRequest, signal?: AbortSignal): AsyncGenerator<StreamChunk> {
    const stream = await this.client.chat.completions.create(
      { model: req.model, messages: req.messages, stream: true, ...req.parameters },
      { signal }
    );

    for await (const part of stream) {
      const delta = part.choices[0]?.delta;
      if (delta?.content) {
        yield { type: 'token', run_id: req.runId, token: delta.content };
      }
      if (delta?.tool_calls) {
        yield { type: 'tool_call', run_id: req.runId, tool_call: delta.tool_calls[0] };
      }
    }
    yield { type: 'done', run_id: req.runId, finish_reason: 'stop' };
  }

  estimateCost(tokensIn: number, tokensOut: number, model: string): number {
    // Prices per 1M tokens — update monthly or load from config
    const pricing: Record<string, { in: number; out: number }> = {
      'gpt-4o': { in: 2.50, out: 10.00 },
      'gpt-4o-mini': { in: 0.15, out: 0.60 },
      // ...
    };
    const p = pricing[model] || { in: 0, out: 0 };
    return (tokensIn * p.in + tokensOut * p.out) / 1_000_000;
  }
}
```

**Provider registry:** `src/services/providers/provider.registry.ts` maps `slug → adapter class`. Adapters are instantiated lazily and cached per-API-key scope.

**Supported providers (v1):**
- OpenAI (`openai`)
- Anthropic (`anthropic`) — via `@anthropic-ai/sdk`
- Cohere (`cohere`) — via `cohere-ai`
- Ollama (`ollama`) — local HTTP endpoint, no API key needed
- Azure OpenAI (`azure_openai`) — via `openai` SDK with `baseURL` override

### 3.4 Variable Substitution Engine

The existing `PromptService.getPrompt()` already performs Mustache rendering using the `mustache` library with `escape: (text) => text` (no HTML escaping). The Playground reuses this exact logic:

```typescript
// src/services/playground.service.ts
import mustache from 'mustache';

function renderMessages(
  messages: Array<{ role: string; content: string }>,
  variables: Record<string, string>,
): Array<{ role: string; content: string }> {
  return messages.map((msg) => ({
    ...msg,
    content: mustache.render(msg.content, variables, undefined, { escape: (text) => text }),
  }));
}
```

**Validation:** Before calling the provider, the service checks that all `required` variables are present (same logic as `PromptService.getPrompt`). Missing variables return `422` with a `details` array.

### 3.5 Model Parameter Tuning & JSON Schema Editing

**Parameter schema:** Each provider adapter exposes a `parameters` array that defines the UI-facing parameter schema. The frontend uses this to generate sliders/inputs dynamically.

**Response format editing:** The playground includes a Monaco-based JSON schema editor (reused from old frontend's `ParameterSchemaBuilder`). When `response_format.type === 'json_schema'`, the schema is injected into the provider request body. Validation uses `Joi.object()` with a max depth of 10.

---

## 4. A/B Test Statistical Engine Design

### 4.1 Schema

**New migration:** `migrations/011_add_ab_testing.ts`

```sql
CREATE TABLE IF NOT EXISTS ab_tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  prompt_name TEXT NOT NULL,
  version_a TEXT NOT NULL,
  version_b TEXT NOT NULL,
  dataset_id INTEGER,
  status TEXT CHECK(status IN ('running', 'completed', 'cancelled')) NOT NULL DEFAULT 'running',
  metric_criteria TEXT CHECK(metric_criteria IN ('cost', 'latency', 'win_rate', 'eval_score')) NOT NULL,
  winner_version TEXT,
  workspace_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at INTEGER
);

CREATE TABLE IF NOT EXISTS ab_test_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ab_test_id INTEGER NOT NULL,
  version TEXT NOT NULL,
  run_id TEXT NOT NULL,
  score REAL,
  cost_usd REAL,
  latency_ms REAL,
  tokens_in INTEGER,
  tokens_out INTEGER,
  workspace_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (ab_test_id) REFERENCES ab_tests(id)
);
```

### 4.2 API Design

| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /v1/ab-tests` | POST | Create a new A/B test |
| `GET /v1/ab-tests` | GET | List tests for workspace |
| `GET /v1/ab-tests/:id` | GET | Test detail with interim results |
| `POST /v1/ab-tests/:id/run` | POST | Execute one batch of test runs against dataset |
| `POST /v1/ab-tests/:id/promote` | POST | Promote winner to active version |
| `DELETE /v1/ab-tests/:id` | DELETE | Cancel / delete test |

**Create request:**
```typescript
interface CreateABTestRequest {
  name: string;
  prompt_name: string;
  version_a: string;
  version_b: string;
  dataset_id?: number;           // optional — if omitted, runs on synthetic inputs
  metric_criteria: 'cost' | 'latency' | 'win_rate' | 'eval_score';
  sample_size?: number;          // default 100
  provider: string;
  model: string;
  parameters?: Record<string, unknown>;
}
```

**Result response:**
```json
{
  "id": 1,
  "name": "Summarize v1.2 vs v1.3",
  "prompt_name": "summarize",
  "version_a": "v1.2.0",
  "version_b": "v1.3.0",
  "status": "completed",
  "metric_criteria": "eval_score",
  "winner_version": "v1.3.0",
  "statistics": {
    "version_a": { "n": 100, "mean": 4.12, "std": 0.84 },
    "version_b": { "n": 100, "mean": 4.45, "std": 0.71 },
    "p_value": 0.0032,
    "confidence_interval_95": [0.12, 0.54],
    "power": 0.92,
    "effect_size_cohens_d": 0.42
  },
  "created_at": 1746000000,
  "completed_at": 1746003600
}
```

### 4.3 Statistical Methods

**Primary test:** Welch's two-sample t-test (unequal variances) for continuous metrics (cost, latency, eval_score). Implemented in TypeScript using `simple-statistics` or a lightweight custom implementation.

**Win rate (binary outcomes):** Two-proportion z-test with continuity correction.

**Bootstrap confidence intervals:** For cost/latency distributions that are heavily skewed, we also report a percentile bootstrap CI (10,000 resamples). This is more robust than parametric assumptions.

**Sample size calculation:** Before starting a test, the engine computes required `n` per variant given:
- Desired power (default 0.80)
- Significance level alpha (default 0.05)
- Minimum detectable effect (MDE) from historical std deviation of the metric

**Early stopping:** Tests run until `sample_size` is reached. We do NOT implement sequential testing (alpha spending) in v1 to avoid complexity. This is documented as a v2 enhancement.

### 4.4 Execution Flow

1. `ABTestEngineService.createTest()` inserts a row with `status = 'running'`.
2. `ABTestEngineService.runBatch()`:
   - Loads dataset records (or generates synthetic inputs if no dataset).
   - For each record, runs both versions via `PlaygroundProxyService` (reusing the same provider/model/parameters).
   - Stores results in `ab_test_runs`.
   - If `metric_criteria === 'eval_score'`, calls `EvaluationRunnerService` to score each output.
3. When batch completes or sample size reached, computes statistics, updates `ab_tests.status = 'completed'`, and sets `winner_version` if `p_value < 0.05`.
4. `POST /v1/ab-tests/:id/promote` updates the `prompts` table to mark the winning version as the implicit default (or updates a label).

---

## 5. Evaluation Runner Architecture

### 5.1 Overview

Evaluations answer the question: "How good is this prompt?" The backend supports two execution modes:

| Mode | Description | Use Case | Complexity |
|------|-------------|----------|------------|
| **Rule-based v1** | Regex, keyword matching, exact-string, JSON schema validation | Pass/fail gates, format compliance, presence checks | Low |
| **LLM-as-judge v2** | Send prompt+output to a judge LLM with a rubric; parse structured score | Factuality, tone, safety, creativity | Medium |

### 5.2 Schema

**New migration:** `migrations/012_add_datasets_and_eval_runs.ts`

```sql
CREATE TABLE IF NOT EXISTS datasets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  headers_json TEXT NOT NULL,        -- array of column names
  workspace_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS dataset_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset_id INTEGER NOT NULL,
  record_json TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (dataset_id) REFERENCES datasets(id)
);

CREATE TABLE IF NOT EXISTS eval_criteria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evaluation_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK(type IN ('rule', 'llm_judge')) NOT NULL,
  config_json TEXT NOT NULL,         -- rule regex or judge rubric
  weight REAL NOT NULL DEFAULT 1.0,
  workspace_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (evaluation_id) REFERENCES evaluations(id)
);

CREATE TABLE IF NOT EXISTS eval_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evaluation_id INTEGER NOT NULL,
  status TEXT CHECK(status IN ('running', 'completed', 'failed')) NOT NULL DEFAULT 'running',
  total_records INTEGER NOT NULL DEFAULT 0,
  completed_records INTEGER NOT NULL DEFAULT 0,
  aggregate_score REAL,
  metadata_json TEXT,
  workspace_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at INTEGER,
  FOREIGN KEY (evaluation_id) REFERENCES evaluations(id)
);

CREATE TABLE IF NOT EXISTS eval_run_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eval_run_id INTEGER NOT NULL,
  dataset_record_id INTEGER,
  prompt_name TEXT NOT NULL,
  version_tag TEXT,
  output_json TEXT,
  score REAL,
  criteria_scores_json TEXT,         -- per-criterion breakdown
  latency_ms INTEGER,
  cost_usd REAL,
  workspace_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (eval_run_id) REFERENCES eval_runs(id)
);
```

### 5.3 Rule-Based Engine (v1)

**Config JSON schema:**
```typescript
interface RuleCriterionConfig {
  rule_type: 'regex_match' | 'regex_no_match' | 'contains' | 'not_contains' | 'json_schema' | 'exact_match' | 'length_min' | 'length_max';
  target: 'output' | 'input';       // which field to evaluate
  pattern?: string;                // regex or literal string
  schema?: object;                 // for json_schema
  threshold?: number;              // for length rules
  case_sensitive?: boolean;
}
```

**Execution:**
```typescript
// src/services/evaluators/rule.evaluator.ts
function evaluateRule(output: string, config: RuleCriterionConfig): { passed: boolean; score: number; reason?: string } {
  switch (config.rule_type) {
    case 'regex_match':
      return { passed: new RegExp(config.pattern!, config.case_sensitive ? '' : 'i').test(output), score: passed ? 1 : 0 };
    case 'json_schema':
      // Use Ajv for JSON Schema validation
      const valid = ajv.compile(config.schema!)(JSON.parse(output));
      return { passed: valid, score: valid ? 1 : 0, reason: ajv.errorsText() };
    // ... etc
  }
}
```

### 5.4 LLM-as-Judge Engine (v2)

**Judge prompt template:**
```
You are an expert evaluator. Score the following assistant response on a scale of 1–5.

Rubric: {{rubric}}

Input: {{input}}
Expected Output: {{expected_output}}
Actual Output: {{actual_output}}

Respond ONLY with valid JSON in this exact shape:
{"score": number, "reasoning": string, "confidence": "high" | "medium" | "low"}
```

**Implementation notes:**
- The judge model is configurable per workspace (default: `gpt-4o-mini` for cost efficiency).
- Output is parsed with `JSON.parse()` wrapped in a Zod schema validator.
- If parsing fails, retry once with a stricter system prompt. If still failing, mark as `score: null` and `status: 'failed'` for that record.
- To reduce variance, v2 supports **self-consistency ensembling**: run the judge 3 times and take the median score. This is toggled via `config.ensemble_size` (default 1).

**Cost control:** Judge calls are metered separately and included in the eval run's `cost_usd`. A per-workspace monthly judge budget cap is enforced (default $50).

### 5.5 API Design

| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /v1/datasets` | POST | Create dataset |
| `POST /v1/datasets/:id/records` | POST | Bulk upload records (JSON array) |
| `GET /v1/datasets` | GET | List datasets |
| `GET /v1/datasets/:id` | GET | Get dataset with records |
| `POST /v1/evaluations/:id/run` | POST | Start an eval run |
| `GET /v1/evaluations/:id/runs` | GET | List eval runs |
| `GET /v1/evaluations/:id/results` | GET | Paginated results per run |
| `GET /v1/evaluations/:id/trends` | GET | Score trends over time (for charts) |

**Run request:**
```typescript
interface RunEvaluationRequest {
  dataset_id: number;
  prompt_name: string;
  version_tag?: string;          // if omitted, runs against latest active
  provider: string;
  model: string;
  parameters?: Record<string, unknown>;
  variables?: Record<string, string>; // applied to every record if static
  variable_mapping?: Record<string, string>; // maps dataset column → Mustache variable
}
```

### 5.6 Data Pipeline for Evaluation Trends

The existing `/v1/metrics/evaluations` endpoint already returns `EvaluationTrend[]`. We extend this pipeline:

1. When an `eval_run` completes, `EvaluationRunnerService` inserts rows into `eval_run_results`.
2. The `MetricsService.getEvaluationTrends()` query (already implemented) joins `evaluations → evaluation_results` (legacy) and `eval_runs → eval_run_results` (new) via a `UNION`-like view or simply queries both tables.
3. For v2, we add a materialized cache: `evaluation_daily_rollup` table updated by a lightweight background job (`EvalRollupJob`, runs every 5 minutes) that computes daily aggregates per evaluation. This avoids expensive joins on the evaluation results table for the overview dashboard.

---

## 6. Compliance & Risk Scoring Engine

### 6.1 Overview

Compliance scoring assesses prompts and their outputs for PII leakage, policy violations, and transparency requirements. v1 is entirely rule-based (regex/heuristics). v2 may add an LLM-as-judge layer for semantic policy understanding.

### 6.2 Schema

**New migration:** `migrations/013_add_compliance.ts`

```sql
CREATE TABLE IF NOT EXISTS compliance_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT CHECK(category IN ('pii', 'security', 'toxicity', 'bias', 'transparency', 'custom')) NOT NULL,
  severity TEXT CHECK(severity IN ('critical', 'high', 'medium', 'low', 'info')) NOT NULL,
  rule_type TEXT CHECK(rule_type IN ('regex', 'keyword_list', 'heuristic', 'json_schema')) NOT NULL,
  config_json TEXT NOT NULL,        -- pattern, keywords, or heuristic params
  workspace_id TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS compliance_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prompt_name TEXT NOT NULL,
  version_tag TEXT,
  run_id TEXT,
  overall_score REAL NOT NULL,      -- 0–100
  risk_level TEXT CHECK(risk_level IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')) NOT NULL,
  breakdown_json TEXT NOT NULL,     -- per-rule results
  workspace_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

### 6.3 Scoring Engine (v1)

**Rule types:**

| Rule Type | Implementation | Example |
|-----------|---------------|---------|
| `regex` | `RegExp.test()` | SSN pattern `\b\d{3}-\d{2}-\d{4}\b` |
| `keyword_list` | Exact or substring match | Blocked words list for toxicity |
| `heuristic` | Custom function | Entropy-based PII detection, output length anomaly |
| `json_schema` | Ajv validation | Ensure output contains required transparency fields |

**Scoring algorithm:**
```typescript
function computeComplianceScore(results: RuleResult[]): ComplianceScore {
  const weights = { critical: 10, high: 5, medium: 2, low: 1, info: 0 };
  const maxPenalty = Object.values(weights).reduce((a, b) => a + b, 0) * results.length;
  const penalty = results
    .filter(r => r.violated)
    .reduce((sum, r) => sum + weights[r.severity], 0);
  const score = Math.max(0, 100 - (penalty / maxPenalty) * 100);

  const riskLevel = results.some(r => r.severity === 'critical') ? 'CRITICAL'
    : results.some(r => r.severity === 'high') ? 'HIGH'
    : results.some(r => r.severity === 'medium') ? 'MEDIUM'
    : 'LOW';

  return { overall_score: Math.round(score * 10) / 10, risk_level: riskLevel, breakdown: results };
}
```

**PII detection rules (default):**
- Email addresses
- US phone numbers
- Social Security Numbers
- Credit card numbers (Luhn check)
- API keys / secrets (high-entropy strings)

### 6.4 API Design

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /v1/compliance/rules` | GET | List rules (workspace-scoped) |
| `POST /v1/compliance/rules` | POST | Create custom rule |
| `POST /v1/compliance/score` | POST | Score a prompt/output on demand |
| `GET /v1/compliance/scores` | GET | Historical scores per prompt |
| `GET /v1/compliance/violations` | GET | Paginated violation list |

**On-demand scoring request:**
```typescript
interface ComplianceScoreRequest {
  prompt_name?: string;
  version_tag?: string;
  text: string;                    // the content to scan
  rules?: string[];                // optional subset of rule IDs
}
```

**Response:**
```json
{
  "overall_score": 87.5,
  "risk_level": "LOW",
  "violations": [
    { "rule_id": 3, "rule_name": "Email Detection", "severity": "medium", "matched": "alice@example.com", "position": [12, 29] }
  ],
  "breakdown": [
    { "rule_id": 1, "rule_name": "SSN Pattern", "violated": false },
    { "rule_id": 3, "rule_name": "Email Detection", "violated": true, "severity": "medium" }
  ]
}
```

### 6.5 Risk Distribution Visualization

The frontend reuses `RiskDistributionCard` from the old frontend, adapted to Recharts:

```typescript
// Data shape for Recharts PieChart
interface RiskDistributionDatum {
  name: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  value: number;
  color: string; // #ef4444, #f59e0b, #eab308, #22c55e
}
```

---

## 7. Cost / Latency / Token Tracking

### 7.1 Per-Prompt Tracking

The existing `logs` table already stores `tokens_in`, `tokens_out`, `latency_ms`, `cost_usd`, `provider`, and `model`. The Playground proxy **must** write a log row after every run (both streaming and non-streaming) so that metrics aggregation works.

**New field in `logs` (migration `014_add_log_run_id.ts`):**
```sql
ALTER TABLE logs ADD COLUMN run_id TEXT;
CREATE INDEX IF NOT EXISTS idx_logs_run_id ON logs(run_id);
```

This links every log entry to a `run_id`, enabling the Playground to show "This run cost $0.005 and took 1.2s" immediately after completion.

### 7.2 Token Counting Strategy

- **OpenAI / Anthropic / Cohere:** Token counts returned by the provider API in the response object. Use these exact values.
- **Ollama:** Token counts may not be returned. Fallback to `tiktoken` (or `gpt-tokenizer` for JS) estimated count for the model family. Document that Ollama costs are estimates.
- **Streaming:** For streaming responses, token count is often unavailable until the final chunk. The `MetricsChunk` in NDJSON includes `tokens_in` and `tokens_out` only when the provider sends them (usually at the end). The frontend shows a spinner until the metrics chunk arrives.

### 7.3 Cost Estimation

Each provider adapter implements `estimateCost(tokensIn, tokensOut, model)`. Pricing tables are loaded from a JSON config file (`config/llm-pricing.json`) that can be updated without redeploying code. If a model is missing from the pricing table, the adapter logs a warning and returns `0`.

### 7.4 Budget Alerts (v1)

A lightweight query in `MetricsService` computes per-workspace spend in the last 30 days:

```sql
SELECT COALESCE(SUM(cost_usd), 0) as total_cost
FROM logs
WHERE workspace_id = ? AND created_at >= ?
```

If `total_cost > WORKSPACE_BUDGET_USD` (env var, default unlimited), the Playground proxy returns `429 Too Many Requests` with code `budget_exceeded`. The frontend shows a budget warning banner.

---

## 8. Model Caching and Rate Limiting

### 8.1 Prompt Response Caching

The existing `cache.service.ts` already supports Redis and in-memory LRU caching for rendered prompts. We extend it to cache playground outputs **only for non-streaming requests** where `cache: true` is passed.

**Cache key:** `playground:output:{workspaceId}:{hash(prompt_name+version+messages+variables+provider+model+parameters)}`
**TTL:** 60 seconds (short — playground outputs should reflect parameter changes quickly).

**Streaming is never cached.**

### 8.2 Rate Limiting

The existing `rateLimitPerKey` middleware (`src/middlewares/rate-limit-per-key.middleware.ts`) is already mounted on all v1 routes. We add **provider-level** rate limiting inside `PlaygroundProxyService`:

- OpenAI: 10,000 RPM / 2M TPM (varies by tier)
- Anthropic: 4,000 RPM (varies by tier)
- Ollama: unlimited (local)

**Implementation:** A per-provider token bucket in memory (backed by Redis when `REDIS_URL` is set). Before calling the provider, the service checks the bucket. If exhausted, it returns `429` with `retry_after` seconds.

### 8.3 Circuit Breaker

The existing `circuit-breaker.service.ts` is a basic circuit breaker. We wire it into each provider adapter:

```typescript
// src/services/providers/openai.adapter.ts
import { CircuitBreaker } from '@services/circuit-breaker.service';

const breaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeoutMs: 30000,
});

async chatCompletion(...) {
  return breaker.execute(() => this.client.chat.completions.create(...));
}
```

When the breaker is open, the adapter returns `503 Service Unavailable` with `retryable: true`.

---

## 9. Error Handling for LLM Provider Failures

### 9.1 Error Taxonomy

All provider errors are normalized to a consistent `ProviderError` type:

```typescript
interface ProviderError {
  code: 'timeout' | 'rate_limit' | 'content_policy' | 'auth_error' | 'provider_error' | 'validation_error' | 'budget_exceeded' | 'circuit_open';
  message: string;
  status: number;        // HTTP status to return to client
  retryable: boolean;
  retry_after?: number;  // seconds
}
```

### 9.2 Mapping by Provider

| Provider Error | Mapped Code | Status | Retryable | Notes |
|----------------|-------------|--------|-----------|-------|
| OpenAI 429 | `rate_limit` | 429 | true | `retry_after` from header |
| OpenAI 400 (content_filter) | `content_policy` | 422 | false | Show policy violation UI |
| Anthropic 529 (overloaded) | `provider_error` | 503 | true | Retry with backoff |
| Cohere 429 | `rate_limit` | 429 | true | Exponential backoff |
| Network timeout | `timeout` | 504 | true | Configurable timeout (default 120s) |
| Invalid API key | `auth_error` | 401 | false | Admin must rotate key |
| Unknown 5xx | `provider_error` | 502 | true | Log full stack trace |

### 9.3 Frontend Error Display

The `StreamingOutputPanel` (reused from old frontend) switches to an error state when it receives an `error` chunk:

```typescript
if (chunk.type === 'error') {
  setOutput(prev => ({
    ...prev,
    type: 'error',
    message: chunk.message,
    code: chunk.code,
    isRetryable: chunk.retryable,
    retryAfter: chunk.retry_after,
  }));
}
```

**UI patterns:**
- `rate_limit`: Show countdown timer + "Retry in X seconds"
- `content_policy`: Show red banner with policy reference + "Edit prompt"
- `timeout`: Show amber banner + "Retry" button
- `budget_exceeded`: Show workspace settings link

---

## 10. Frontend Component Mapping

### 10.1 Playground Page Structure

```
ui/src/app/playground/
├── page.tsx                          # Main playground shell (client component)
├── layout.tsx                        # Optional: load providers on mount
├── components/
│   ├── PlaygroundLayout.tsx          # Split-pane layout (shadcn Resizable)
│   ├── EditorTab.tsx                 # Monaco-based prompt editor
│   ├── ModelSelector.tsx             # Provider + model dropdown
│   ├── StreamingOutputPanel.tsx      # NDJSON consumer + output display
│   ├── VariableSetsPanel.tsx         # Variable preset management
│   ├── ModelConfigDrawer.tsx         # Temperature, max_tokens, etc.
│   ├── ParameterSchemaBuilder.tsx    # JSON schema editor for response_format
│   └── VersionTimeline.tsx           # Prompt version selector
```

### 10.2 State Management

**Server state:** TanStack Query (`useQuery` / `useMutation`) for all API calls.
**Client state:** Zustand store for playground-specific UI state (selected model, parameter values, variable sets, editor content). Zustand replaces the old Redux slices.

```typescript
// ui/src/stores/playground.store.ts
import { create } from 'zustand';

interface PlaygroundState {
  selectedModel: Model | null;
  parameterValues: Record<string, unknown>;
  variableSets: VariableSet[];
  promptSections: PromptSection[];
  setSelectedModel: (m: Model | null) => void;
  // ...
}

export const usePlaygroundStore = create<PlaygroundState>((set) => ({
  selectedModel: null,
  parameterValues: {},
  variableSets: [],
  promptSections: [
    { id: 1, name: 'system', content: '', variables: [], expanded: true },
    { id: 2, name: 'user', content: '', variables: [], expanded: true },
  ],
  setSelectedModel: (m) => set({ selectedModel: m }),
  // ...
}));
```

### 10.3 API Client Extensions

```typescript
// ui/src/lib/api.ts (additions)
export type StreamChunk = TokenChunk | ToolCallChunk | MetricsChunk | DoneChunk | ErrorChunk;

export const api = {
  // ... existing methods ...

  getProviders: () => fetchJson<{ providers: LLMProvider[] }>('/v1/playground/models'),

  runPlayground: async function* (payload: PlaygroundRunPayload): AsyncGenerator<StreamChunk> {
    // NDJSON streaming implementation from Section 2.1
  },

  createABTest: (data: CreateABTestRequest) =>
    fetchJson<ABTest>('/v1/ab-tests', { method: 'POST', body: JSON.stringify(data) }),

  getABTest: (id: number) => fetchJson<ABTest>(`/v1/ab-tests/${id}`),

  promoteABTestWinner: (id: number) =>
    fetchJson<ABTest>(`/v1/ab-tests/${id}/promote`, { method: 'POST' }),

  createDataset: (data: { name: string; description?: string; records: unknown[] }) =>
    fetchJson<Dataset>('/v1/datasets', { method: 'POST', body: JSON.stringify(data) }),

  runEvaluation: (evaluationId: number, data: RunEvaluationRequest) =>
    fetchJson<EvalRun>(`/v1/evaluations/${evaluationId}/run`, { method: 'POST', body: JSON.stringify(data) }),

  getComplianceScore: (data: ComplianceScoreRequest) =>
    fetchJson<ComplianceScoreResponse>('/v1/compliance/score', { method: 'POST', body: JSON.stringify(data) }),
};
```

---

## 11. Database & Migration Strategy

### 11.1 New Migrations

| Migration | File | Purpose |
|-----------|------|---------|
| 011 | `011_add_ab_testing.ts` | `ab_tests`, `ab_test_runs` tables |
| 012 | `012_add_datasets_and_eval_runs.ts` | `datasets`, `dataset_records`, `eval_criteria`, `eval_runs`, `eval_run_results` |
| 013 | `013_add_compliance.ts` | `compliance_rules`, `compliance_scores` |
| 014 | `014_add_log_run_id.ts` | Add `run_id` column to `logs` |

### 11.2 Index Strategy

```sql
-- AB testing
CREATE INDEX idx_ab_tests_workspace ON ab_tests(workspace_id, created_at);
CREATE INDEX idx_ab_test_runs_test ON ab_test_runs(ab_test_id, version);

-- Datasets & evals
CREATE INDEX idx_dataset_records_dataset ON dataset_records(dataset_id);
CREATE INDEX idx_eval_runs_evaluation ON eval_runs(evaluation_id, status);
CREATE INDEX idx_eval_run_results_run ON eval_run_results(eval_run_id);

-- Compliance
CREATE INDEX idx_compliance_scores_prompt ON compliance_scores(workspace_id, prompt_name, created_at);
CREATE INDEX idx_compliance_rules_workspace ON compliance_rules(workspace_id, category);
```

### 11.3 Cross-Dialect Notes

- All migrations use `dialect-helpers.ts` (`idColumn`, `nowFn`) for SQLite/PostgreSQL compatibility.
- `JSON` columns are stored as `TEXT` in SQLite and `JSONB` in PostgreSQL where applicable. The codebase already uses `*_json` TEXT columns with `JSON.stringify`/`JSON.parse` — this pattern continues.

---

## 12. Testing Strategy

### 12.1 Mock Provider Adapter

For unit and integration tests, implement a `MockLLMAdapter` that returns deterministic responses:

```typescript
// tests/fixtures/mock-llm.adapter.ts
export class MockLLMAdapter implements LLMProviderAdapter {
  readonly slug = 'mock';
  readonly name = 'Mock Provider';

  async *streamChatCompletion(req: ChatCompletionRequest): AsyncGenerator<StreamChunk> {
    yield { type: 'token', run_id: req.runId, token: 'Hello' };
    yield { type: 'token', run_id: req.runId, token: ' world' };
    yield { type: 'metrics', run_id: req.runId, latency_ms: 100, tokens_in: 10, tokens_out: 2, cost_usd: 0.0001, model: 'mock', provider: 'mock' };
    yield { type: 'done', run_id: req.runId, finish_reason: 'stop' };
  }
}
```

### 12.2 Synthetic Data

Create `tests/fixtures/ai-features.fixtures.ts` that seeds:
- 2 prompts with 3 versions each
- 1 dataset with 20 records
- 1 evaluation with 2 criteria (1 rule, 1 LLM judge)
- 1 completed A/B test with 200 runs
- 5 compliance rules (PII, toxicity, etc.)

### 12.3 Statistical Validation

For A/B testing, add unit tests that verify:
- Welch's t-test p-value matches `scipy.stats.ttest_ind` on the same synthetic data (within 1e-6).
- Bootstrap CI contains the true mean difference in > 94% of simulations (95% nominal).
- Win rate calculation is correct for deterministic outcomes.

### 12.4 Integration Test Coverage

| Endpoint | Test File | Assertions |
|----------|-----------|------------|
| `POST /v1/playground/run` | `tests/integration/playground.test.ts` | 200 response, correct metrics, logs row created |
| `POST /v1/playground/run?stream=true` | same | NDJSON chunks, abort works, metrics chunk present |
| `GET /v1/playground/models` | same | Returns providers array, each has models |
| `POST /v1/ab-tests` → run → promote | `tests/integration/ab-testing.test.ts` | Test completes, p-value < 0.05, winner promoted |
| `POST /v1/evaluations/:id/run` | `tests/integration/evaluation.test.ts` | Eval run completes, results have scores |
| `POST /v1/compliance/score` | `tests/integration/compliance.test.ts` | Returns score < 100 when PII present |

### 12.5 Frontend Tests

- **Unit:** `StreamingOutputPanel` renders tokens, tool calls, and error states correctly with mock chunks.
- **Unit:** `ModelSelector` filters models by provider.
- **E2E (Playwright):** `ui/e2e/playground.spec.ts` — open playground, enter prompt, click Run, assert streamed output appears within 10s.
- **E2E:** `ui/e2e/ab-testing.spec.ts` — create test, run it, assert winner appears.

---

## 13. Security & Privacy

### 13.1 API Key Isolation

Provider API keys (OpenAI, Anthropic, etc.) are **never** sent to the browser. They are stored as environment variables on the PromptMetrics backend. In a multi-tenant hosted version, keys are stored per-workspace in an encrypted column (e.g., `workspace_settings.encrypted_provider_keys`).

### 13.2 Content Safety

- All prompts and outputs are scanned by the Compliance engine before being stored in `eval_run_results.output_json`.
- If `content_policy` is triggered, the output is redacted (replaced with `[REDACTED]`) and a violation is logged.
- Judge prompts for LLM-as-judge must not contain user PII. If the input contains PII, the evaluator returns `score: null` with reason `pii_detected`.

### 13.3 Audit Logging

Every playground run, A/B test execution, evaluation run, and compliance scan generates an audit log entry via the existing `auditLog()` middleware.

---

## 14. Performance & Scaling Considerations

### 14.1 Streaming Backpressure

Express's default `res.write()` can buffer indefinitely. We cap the NDJSON buffer to 64KB per write and flush explicitly:

```typescript
if (res.writableLength > 65536) {
  await new Promise<void>((resolve) => res.write('', () => resolve()));
}
```

### 14.2 Evaluation Batch Size

Eval runs process dataset records in batches of 10 (configurable). This limits concurrent provider connections and prevents memory spikes. For large datasets (10k+ records), a background job pattern (similar to `PromptReconciliationJob`) is recommended for v2.

### 14.3 Database Query Limits

Compliance violation lists and eval result tables can grow large. All list endpoints enforce:
- Max `limit` = 100
- Mandatory `workspace_id` filter (index-backed)
- Cursor-based pagination for tables expected to exceed 10k rows per workspace

---

## 15. Rollout Plan

| Phase | Features | Backend | Frontend | ETA |
|-------|----------|---------|----------|-----|
| 1 | Playground proxy + streaming + providers | Migrations 011–014, PlaygroundProxyService, provider adapters, NDJSON endpoint | Playground page, ModelSelector, StreamingOutputPanel, EditorTab | Week 6 |
| 2 | A/B Testing engine + dataset storage | ABTestEngineService, datasets API, statistical engine | ABTesting page, CreateABTestModal, Result charts | Week 8 |
| 3 | Evaluation Manager v1 (rule-based) | EvaluationRunnerService, rule evaluator, eval runs API | Evaluation page, Dataset upload, Criteria builder, Results table | Week 10 |
| 4 | Compliance & Risk v1 | ComplianceScorerService, compliance rules API, scoring endpoint | Compliance page, RiskDistributionCard, Violation table | Week 11 |
| 5 | Evaluation v2 (LLM-as-judge) + polish | Judge adapter, ensemble scoring, cost caps | Judge rubric editor, trend charts, cost alerts | Week 12 |

**Rollback:** All new endpoints are additive. If any phase introduces instability, remove the route mount from `src/app.ts` without affecting existing v1.1.0 observability dashboard functionality.
