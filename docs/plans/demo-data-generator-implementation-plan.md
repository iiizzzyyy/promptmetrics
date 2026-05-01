# Demo Data Generator Implementation Plan

**Status**: Draft
**Last Updated**: 2026-04-28
**Related**: [PRD](demo-data-generator-prd.md) | [Architecture & Scenarios](demo-data-generator-architecture.md) | [User Guide](demo-data-generator-user-guide.md)

---

## 1. File Structure

```
src/
  cli/
    commands/
      demo.command.ts                 # Commander command registration + flag parsing
    demo/
      index.ts                        # Public API: runDemo(config) entry point
      types.ts                        # DemoConfig, DemoScenario, DemoResult interfaces
      api-client.ts                   # Raw axios wrapper for all PromptMetrics REST calls
      reset.ts                        # Reset/cleanup orchestrator
      reporter.ts                     # Console progress reporter and summary printer
      generators/
        timestamp.ts                  # Time-window + weekday-bias + volume-curve distribution
        synthetic.ts                  # Normal/lognormal distributions for tokens, latency, cost, scores
        ollama-client.ts              # Ollama /api/generate wrapper + judge prompt
      scenarios/
        scenario.interface.ts         # Shared ScenarioContext and ScenarioModule types
        support-bot.ts                # Scenario 1: Customer Support Bot
        meeting-summarizer.ts         # Scenario 2: Meeting Summarizer
        code-reviewer.ts              # Scenario 3: Code Review Assistant
        marketing-copy.ts             # Scenario 4: Marketing Copy Generator
        rag-qa.ts                     # Scenario 5: RAG Document QA
        index.ts                      # Registry: array of all 5 scenario modules

tests/
  unit/
    cli/
      demo/
        timestamp.test.ts             # Unit tests for timestamp distribution
        synthetic.test.ts             # Unit tests for random distributions
        api-client.test.ts            # Unit tests for retry logic, auth headers
        reset.test.ts                 # Unit tests for reset orchestration
        reporter.test.ts              # Unit tests for progress formatting
  integration/
    cli/
      demo.command.test.ts            # Integration test: full generator against supertest app
```

**Rationale**: We keep the demo generator inside `src/cli/demo/` (not `src/demo/`) because it is exclusively a CLI concern. It is colocated with the existing `src/cli/commands/` directory so engineers working on the CLI naturally discover it. Each scenario is its own file so that traffic patterns, failure rates, and prompt definitions are isolated and easy to modify without cross-scenario regressions.

---

## 2. Module Dependencies

### Dependency Graph

```
demo.command.ts
    -> types.ts
    -> api-client.ts
    -> reporter.ts
    -> reset.ts
    -> index.ts (runDemo)

index.ts (runDemo)
    -> api-client.ts
    -> reporter.ts
    -> reset.ts
    -> generators/timestamp.ts
    -> generators/synthetic.ts
    -> generators/ollama-client.ts
    -> scenarios/index.ts

scenarios/*.ts (each)
    -> types.ts (DemoScenario, ScenarioContext)
    -> api-client.ts (for HTTP calls)
    -> generators/timestamp.ts
    -> generators/synthetic.ts OR generators/ollama-client.ts

reset.ts
    -> api-client.ts
    -> reporter.ts
```

### Data Flow

1. `demo.command.ts` parses CLI flags and builds a `DemoConfig` object.
2. It calls `verifyServer()` (in `api-client.ts`) to ensure the PromptMetrics server is reachable.
3. If `--reset` is passed, `reset.ts` lists and deletes existing entities in reverse dependency order.
4. `index.ts` (runDemo) iterates over the 5 scenarios sequentially.
5. Each scenario receives a `ScenarioContext` containing:
   - The `ApiClient` instance
   - The `DemoConfig`
   - The `SyntheticEngine` (or `OllamaClient` when `--ollama` is set)
   - The `TimestampGenerator`
   - A callback to report progress
6. Scenarios create prompts first, then traces/spans, then runs, then logs, then evaluations/results, then labels.
7. All created entity IDs are collected into a `ScenarioResult` and returned to `index.ts`.
8. `index.ts` aggregates `ScenarioResult` objects into a `DemoResult`.
9. `reporter.ts` prints the final summary table.

---

## 3. API Integration Patterns

### Raw HTTP Client (not the Node SDK)

The Node SDK (`clients/node/src/index.ts`) is incomplete (only `prompts` and `logs` endpoints). The generator makes raw HTTP calls via a lightweight `ApiClient` class.

**File**: `src/cli/demo/api-client.ts`

```typescript
export class ApiClient {
  private client: AxiosInstance;

  constructor(config: { baseUrl: string; apiKey: string; workspace?: string }) {
    this.client = axios.create({
      baseURL: config.baseUrl.replace(/\/$/, ''),
      headers: {
        'X-API-Key': config.apiKey,
        'Content-Type': 'application/json',
        ...(config.workspace ? { 'X-Workspace-Id': config.workspace } : {}),
      },
      timeout: 30000,
    });
  }

  async verifyServer(): Promise<void> { ... }
  async createPrompt(body: unknown): Promise<{ name: string; version_tag: string }> { ... }
  async listPrompts(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<unknown>> { ... }
  async deletePrompt(name: string): Promise<void> { ... }
  async createLog(body: unknown): Promise<{ id: number }> { ... }
  async createTrace(body: unknown): Promise<{ trace_id: string }> { ... }
  async createSpan(traceId: string, body: unknown): Promise<{ span_id: string }> { ... }
  async listTraces(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<unknown>> { ... }
  async deleteTrace(traceId: string): Promise<void> { ... }
  async createRun(body: unknown): Promise<{ run_id: string }> { ... }
  async updateRun(runId: string, body: unknown): Promise<void> { ... }
  async listRuns(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<unknown>> { ... }
  async deleteRun(runId: string): Promise<void> { ... }
  async createEvaluation(body: unknown): Promise<{ id: number }> { ... }
  async listEvaluations(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<{ id: number }>> { ... }
  async deleteEvaluation(id: number): Promise<void> { ... }
  async createEvaluationResult(evaluationId: number, body: unknown): Promise<void> { ... }
  async createLabel(promptName: string, body: unknown): Promise<void> { ... }
  async listLabels(promptName: string): Promise<PaginatedResponse<unknown>> { ... }
  async deleteLabel(promptName: string, labelName: string): Promise<void> { ... }
}
```

### Auth
- Reads `X-API-Key` from `--api-key`, then `promptmetrics.yaml`, then fails fast with exit code 1.
- Reads `X-Workspace-Id` from `--workspace` (default: `default`).

### Error Handling
- `ECONNREFUSED` / `ETIMEDOUT` -> print "Server unreachable. Is PromptMetrics running?" and exit 1.
- HTTP 401 / 403 -> print "Authentication failed. Check your API key and workspace." and exit 1.
- HTTP 422 -> print validation details and continue (single-entity failure should not abort the whole scenario).
- HTTP 429 -> apply exponential backoff (see Section 11).
- All other 4xx/5xx -> retry up to 3 times with jitter, then print warning and continue.

---

## 4. Scenario Architecture

### Scenario Interface

**File**: `src/cli/demo/scenarios/scenario.interface.ts`

```typescript
export interface ScenarioContext {
  api: ApiClient;
  config: DemoConfig;
  synthetic: SyntheticEngine;
  ollama: OllamaClient | null;
  timestamp: TimestampGenerator;
  report: (message: string) => void;
}

export interface ScenarioResult {
  name: string;
  promptsCreated: number;
  tracesCreated: number;
  spansCreated: number;
  runsCreated: number;
  logsCreated: number;
  evaluationsCreated: number;
  resultsCreated: number;
  labelsCreated: number;
}

export interface ScenarioModule {
  name: string;
  run(ctx: ScenarioContext): Promise<ScenarioResult>;
}
```

### Pluggable Module Design

Each scenario exports a single `ScenarioModule` object. The orchestrator (`index.ts`) imports the array from `scenarios/index.ts` and runs them sequentially.

**Why sequential?**
- Scenarios share no state, but running them in parallel would create thundering-herd load against the SQLite/PostgreSQL backend, especially on `--scale=heavy`.
- Sequential execution makes console output deterministic and easier to debug.

### Scenario Internal Structure

Each scenario file (e.g., `support-bot.ts`) contains:
1. **Prompt definitions** — static JSON objects matching the `createPromptSchema`.
2. **Traffic model** — a function `generateTraffic(ctx)` that loops `traceCount` times.
3. **Per-trace generator** — creates:
   - 1 trace with `prompt_name` / `version_tag`
   - N spans (some with `parent_id`, some root-level)
   - 1 run linked to the trace
   - 1-2 logs per LLM call
   - Evaluation results for a subset of runs
4. **Failure injection** — uses `Math.random()` vs the scenario's configured failure rate to mark spans/runs as failed.

---

## 5. Synthetic Data Engine

**File**: `src/cli/demo/generators/synthetic.ts`

### Distributions

| Field | Distribution | Parameters |
|-------|-------------|------------|
| `tokens_in` | Normal | mean=500, stdDev=200, min=50 |
| `tokens_out` | Normal | mean=300, stdDev=150, min=20 |
| `latency_ms` | Lognormal | mu=6.5, sigma=0.5 (median ~670ms) |
| `cost_usd` | Derived | `(tokens_in + tokens_out) * rate / 1000` |
| `score` (eval) | Normal | mean=0.82, stdDev=0.12, clamp [0, 1] |

### Implementation

```typescript
export class SyntheticEngine {
  normal(mean: number, stdDev: number, min?: number): number { ... }
  lognormal(mu: number, sigma: number): number { ... }
  cost(tokensIn: number, tokensOut: number, model: 'gpt-4o' | 'gpt-4o-mini'): number { ... }
  score(): number { ... }
  status(failureRate: number): 'completed' | 'failed' { ... }
  spanStatus(failureRate: number): 'ok' | 'error' { ... }
}
```

**Normal distribution**: Box-Muller transform.
**Lognormal**: `exp(normal(mu, sigma))`.
**Cost rates**:
- GPT-4o: $0.0015 / 1K tokens (in + out)
- GPT-4o-mini: $0.0005 / 1K tokens (in + out)

### Determinism for Tests
The `SyntheticEngine` accepts an optional `seed` number. When seeded, it uses a simple linear congruential generator (LCG) so unit tests can assert exact values.

---

## 6. Ollama Integration

**File**: `src/cli/demo/generators/ollama-client.ts`

### Interface Abstraction

The scenarios do not know whether they are in synthetic or real mode. They call `getInferenceMetrics(promptContent, model)` which returns:

```typescript
interface InferenceMetrics {
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
  response_text: string;
}
```

In synthetic mode this is produced by `SyntheticEngine`. In Ollama mode it is produced by the `OllamaClient`.

### OllamaClient Implementation

```typescript
export class OllamaClient {
  constructor(private host: string, private model: string) {}

  async verify(): Promise<void> {
    // GET /api/tags
    // Throw if model not in list
  }

  async generate(prompt: string): Promise<InferenceMetrics> {
    const start = Date.now();
    const res = await axios.post(`${this.host}/api/generate`, {
      model: this.model,
      prompt,
      stream: false,
    });
    const latency_ms = Date.now() - start;
    return {
      tokens_in: res.data.prompt_eval_count ?? 0,
      tokens_out: res.data.eval_count ?? 0,
      latency_ms,
      response_text: res.data.response ?? '',
    };
  }

  async judge(originalPrompt: string, output: string): Promise<number> {
    const judgePrompt = `You are an objective evaluator. Score the following output on a scale of 0 to 1, where 1 is perfect. Respond with only a number.\n\nTask: ${originalPrompt}\nOutput: ${output}\n\nScore:`;
    const res = await this.generate(judgePrompt);
    const score = parseFloat(res.response_text.trim());
    return Math.max(0, Math.min(1, isNaN(score) ? 0.5 : score));
  }
}
```

### Error Handling
- If Ollama is unreachable during `verify()`, fail fast with exit code 1 and a clear message.
- If a single `generate()` call fails (e.g., model unloaded mid-run), fall back to synthetic values for that trace and print a warning. This ensures partial failure does not abort the entire demo.

---

## 7. Timestamp Distribution

**File**: `src/cli/demo/generators/timestamp.ts`

### Requirements
1. All timestamps are Unix epoch **seconds** (integer).
2. Distributed across the configurable window (default 30 days).
3. Weekday bias: 70% of traffic on Mon-Fri.
4. Volume curve: 60% in last 7 days, 25% in days 8-14, 15% in days 15-30.

### Algorithm

```typescript
export class TimestampGenerator {
  constructor(private days: number, private now: number = Math.floor(Date.now() / 1000)) {}

  next(): number {
    // Step 1: pick a bucket using the volume curve
    const bucketRoll = Math.random();
    let bucketDays: number;
    if (bucketRoll < 0.60) {
      bucketDays = Math.random() * 7;           // last 7 days
    } else if (bucketRoll < 0.85) {
      bucketDays = 7 + Math.random() * 7;       // days 8-14
    } else {
      bucketDays = 14 + Math.random() * (this.days - 14); // days 15-30 (or longer)
    }

    // Step 2: compute raw timestamp
    let ts = Math.floor(this.now - bucketDays * 86400);

    // Step 3: weekday bias
    const date = new Date(ts * 1000);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    if (isWeekend && Math.random() > 0.30) {
      const shift = date.getDay() === 0 ? -2 : -1; // Sun->Fri, Sat->Fri
      ts += shift * 86400;
    }

    return Math.min(ts, this.now);
  }
}
```

### Idempotency / Replay
The `TimestampGenerator` is instantiated once per scenario run and consumed in order. Because scenarios run sequentially, there is no risk of timestamp collision across scenarios.

---

## 8. Scale Configuration

**File**: `src/cli/demo/types.ts`

```typescript
export type ScaleLevel = 'light' | 'medium' | 'heavy';

export const SCALE_MULTIPLIERS: Record<ScaleLevel, number> = {
  light: 0.17,
  medium: 1.0,
  heavy: 3.33,
};
```

### Application
Each scenario defines its "medium" baseline counts (e.g., 30 traces, 100 logs). During execution, the scenario multiplies these baselines by the scale multiplier and rounds to the nearest integer, with a floor of 1.

```typescript
const traceCount = Math.max(1, Math.round(baseTraces * SCALE_MULTIPLIERS[config.scale]));
```

### Baselines (Medium)

| Scenario | Traces | Logs | Evaluations |
|----------|--------|------|-------------|
| Customer Support Bot | 30 | 100 | 2 |
| Meeting Summarizer | 20 | 80 | 1 |
| Code Review Assistant | 40 | 120 | 2 |
| Marketing Copy Generator | 15 | 60 | 1 |
| RAG Document QA | 50 | 140 | 2 |

### Heavy Scale Limits
On `--scale=heavy`, the generator prints a warning: "Heavy scale generates ~1,650 logs. Ensure your server has adequate resources."

---

## 9. Reset / Cleanup Strategy

**File**: `src/cli/demo/reset.ts`

### Approach
The generator does **not** tag demo data with a special flag in v1 (the server schema has no `demo` column). Instead, reset uses the workspace boundary as the deletion scope.

### Algorithm

```typescript
export async function resetWorkspace(api: ApiClient, reporter: Reporter): Promise<void> {
  reporter.log('Resetting workspace...');

  // 1. List all entities (paginated, 100 at a time)
  const evaluations = await paginateAll((p, l) => api.listEvaluations({ page: p, limit: l }));
  const runs = await paginateAll((p, l) => api.listRuns({ page: p, limit: l }));
  const traces = await paginateAll((p, l) => api.listTraces({ page: p, limit: l }));
  const prompts = await paginateAll((p, l) => api.listPrompts({ page: p, limit: l }));

  // 2. Delete in reverse dependency order
  for (const evalEntity of evaluations) {
    await api.deleteEvaluation(evalEntity.id);
  }
  for (const run of runs) {
    await api.deleteRun(run.run_id);
  }
  for (const trace of traces) {
    await api.deleteTrace(trace.trace_id);
  }
  for (const prompt of prompts) {
    await api.deletePrompt(prompt.name);
  }

  reporter.log('Workspace reset complete.');
}
```

### Deletion Order
1. Evaluation results (cascading delete via `DELETE /v1/evaluations/:id` which deletes results first in `EvaluationService`)
2. Runs
3. Traces (spans cascade in DB, but the API has no span-level delete; deleting the trace removes spans)
4. Prompts
5. Labels (deleted before prompts, or rely on DB cascade if configured)

### Note on Prompt Deletion
The current API **does not expose** `DELETE /v1/prompts/:name`. If this endpoint is missing at implementation time, reset will:
- Delete all logs, traces, runs, evaluations, and labels.
- Print a warning: "Prompts cannot be deleted via API. Run `npm run db:init` to wipe the database, or use a fresh workspace."
- Continue generating new prompts (which may share names with old ones, causing `createPrompt` to return existing versions depending on driver semantics).

**Mitigation**: Before v1 ships, verify whether prompt deletion is needed. If the server gains `DELETE /v1/prompts/:name`, the reset code works as-is. If not, document the limitation.

---

## 10. CLI Integration

**File**: `src/cli/commands/demo.command.ts`

### Registration

```typescript
import { Command } from 'commander';

export function registerDemoCommand(program: Command): void {
  program
    .command('demo')
    .description('Populate the PromptMetrics server with realistic demo data for evaluation.')
    .option('-s, --server <url>', 'PromptMetrics server URL', 'http://localhost:3000')
    .option('-k, --api-key <key>', 'API key for authentication')
    .option('--scale <level>', 'Data volume: light | medium | heavy', 'medium')
    .option('-d, --days <n>', 'Time window in days', '30')
    .option('--ollama', 'Use local Ollama for real LLM calls', false)
    .option('--model <name>', 'Ollama model to use', 'llama3.2')
    .option('--ollama-host <url>', 'Ollama server URL', 'http://localhost:11434')
    .option('--reset', 'Delete existing demo data before generating', false)
    .option('--workspace <id>', 'Workspace ID', 'default')
    .action(async (options) => {
      const config = buildConfig(options);
      await runDemo(config);
    });
}
```

### Integration into `promptmetrics-cli.ts`

At the bottom of `src/cli/promptmetrics-cli.ts`, before `program.parse()`:

```typescript
import { registerDemoCommand } from './commands/demo.command';

registerDemoCommand(program);
program.parse();
```

### Config Resolution

```typescript
function buildConfig(options: DemoCommandOptions): DemoConfig {
  const server = options.server || loadConfig().server || 'http://localhost:3000';
  const apiKey = options.apiKey || loadConfig().api_key;
  if (!apiKey) {
    console.error('Error: API key is required. Run `promptmetrics init` or pass --api-key.');
    process.exit(1);
  }
  return {
    server,
    apiKey,
    workspace: options.workspace,
    scale: validateScale(options.scale),
    days: parseInt(options.days, 10),
    ollama: options.ollama,
    ollamaModel: options.model,
    ollamaHost: options.ollamaHost,
    reset: options.reset,
  };
}
```

---

## 11. Error Handling & Resilience

### Retry Policy

```typescript
async function withRetry<T>(fn: () => Promise<T>, label: string, maxRetries = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const axiosErr = err as { response?: { status?: number }; code?: string };
      if (axiosErr.response?.status === 429 || axiosErr.response?.status === 503) {
        const delay = Math.min(1000 * 2 ** i + Math.random() * 1000, 10000);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      if (axiosErr.response?.status && axiosErr.response.status >= 400 && axiosErr.response.status < 500) {
        break; // client error: don't retry
      }
    }
  }
  throw lastErr;
}
```

### Partial Failure Handling
- **Single entity failure** (e.g., one trace fails to create) logs a warning, increments a failure counter, and continues. The final summary prints: `Warnings: 3 entities failed`.
- **Scenario failure** (e.g., prompt creation fails because the name already exists) catches the error, prints a warning, and skips to the next scenario.
- **Ollama failure** falls back to synthetic generation for the current trace (see Section 6).

### Idempotency
The generator does not guarantee idempotency on re-runs because:
- Prompt names are hardcoded (e.g., `support-classifier`). Re-running without `--reset` will cause `409` or `422` conflicts on prompt creation.
- Traces and runs use server-generated UUIDs, so duplicates are impossible.

**Recommendation**: Always use `--reset` when re-running the demo against the same workspace.

---

## 12. Performance Considerations

### Batching
v1 does **not** use batch endpoints because the server does not expose them. Each entity is created via individual HTTP POST.

### Concurrency
Scenarios run **sequentially**. Within a scenario, the per-trace loop is also **sequential** by default to avoid overwhelming SQLite.

**Exception**: On `--scale=heavy` with PostgreSQL, we may add a `--concurrency` flag in a future version. For v1, sequential is sufficient.

### Rate Limiting Awareness
The server has `express-rate-limit` middleware. The generator handles 429 responses with exponential backoff (see Section 11).

### Expected Runtime

| Scale | Mode | Approx. Runtime |
|-------|------|---------------|
| light | synthetic | ~2s |
| medium | synthetic | ~5s |
| heavy | synthetic | ~15s |
| medium | ollama | ~2-5 min |

---

## 13. Testing Strategy

### Unit Tests

**`tests/unit/cli/demo/timestamp.test.ts`**
- Assert that 70% of generated timestamps fall on Mon-Fri (chi-square test or threshold assertion).
- Assert that timestamps are within `[now - days*86400, now]`.
- Assert volume curve: at least 50% of timestamps in the last 7 days.

**`tests/unit/cli/demo/synthetic.test.ts`**
- With a fixed seed, assert exact reproducibility of `normal()`, `lognormal()`, and `cost()`.
- Assert `tokens_in` never falls below 50.
- Assert `score` is always in `[0, 1]`.

**`tests/unit/cli/demo/api-client.test.ts`**
- Mock axios with `jest.mock('axios')`.
- Assert retry logic fires exactly 3 times on 503.
- Assert no retry on 422.
- Assert headers include `X-API-Key` and `X-Workspace-Id`.

**`tests/unit/cli/demo/reset.test.ts`**
- Mock `ApiClient` methods.
- Assert deletion order: evaluations first, then runs, traces, prompts.

### Integration Tests

**`tests/integration/cli/demo.command.test.ts`**

```typescript
describe('demo command', () => {
  it('generates light-scale synthetic data in under 10 seconds', async () => {
    const app = createApp(driver);
    // Generate API key via service or seed DB directly
    const result = await runDemo({
      server: `http://localhost:${port}`,
      apiKey: testKey,
      workspace: 'demo-test',
      scale: 'light',
      days: 7,
      ollama: false,
      reset: false,
    });
    expect(result.prompts).toBe(10);
    expect(result.logs).toBeGreaterThan(50);
    expect(result.traces).toBeGreaterThan(15);
  });
});
```

**Test Setup**:
- Use the existing `tests/env-setup.ts` and `tests/setup.ts`.
- Spin up the Express app via `supertest` (or a real server on a random port).
- Generate a test API key with `read,write` scope before each test.
- Clean up the workspace DB rows in `afterEach`.

### E2E Test
Add a step to the existing E2E test suite that runs `promptmetrics demo --scale=light --days=7` against the full server and asserts that the metrics endpoint returns non-zero counts.

---

## Open Questions to Resolve Before Dev Start

| Question | Recommendation | Owner |
|----------|---------------|-------|
| Does the server support `DELETE /v1/prompts/:name`? | Verify. If not, reset will skip prompt deletion and print a warning. | Eng Lead |
| Does the server support `DELETE /v1/traces/:trace_id`? | Verify. Currently no route file exposes it. May need to add it for `--reset` to work cleanly. | Eng Lead |
| Does the server support `DELETE /v1/runs/:run_id`? | Verify. Currently no route file exposes it. | Eng Lead |
| Should we add a `DELETE /v1/demo` bulk endpoint? | Out of scope for v1. Document as v2 candidate. | Eng Lead |
| Should the generator use the Node SDK for prompts/logs and raw HTTP for the rest? | **No** — use raw HTTP for everything to avoid mixing paradigms and because the SDK is incomplete. | Eng Lead |

---

## ADR-012: Demo Data Generator (Proposed)

### Status
Proposed

### Context
New users see an empty dashboard on first install. We need a CLI command that populates the system with realistic data without requiring users to write scripts.

### Decision
Add a `promptmetrics demo` subcommand that makes raw HTTP calls against the local (or remote) PromptMetrics server. It runs 5 hardcoded scenarios, supports synthetic and Ollama modes, and respects the existing CLI config patterns.

### Consequences
- **Easier**: First-time users see a populated dashboard in under 60 seconds.
- **Easier**: Integration tests can use the generator to produce consistent fixture data.
- **Harder**: The generator must maintain parity with the REST API as endpoints evolve.
- **Harder**: Without server-side bulk deletion, `--reset` requires many individual DELETE calls.
- **Trade-off**: We chose raw HTTP over the incomplete Node SDK. This adds ~400 lines of API client code but avoids SDK dependency issues.
