# Demo Data Generator: Architecture & Scenarios

**Status**: Draft  
**Last Updated**: 2026-04-28  
**Related**: [PRD](demo-data-generator-prd.md) | [ADR-011](../adr/011-metrics-dashboard.md)

---

## 1. Overview

The `promptmetrics demo` command runs 5 independent AI application scenarios. Each scenario creates its own prompts, then simulates production traffic by generating logs, traces, spans, runs, evaluations, and labels that reference those prompts. All data is timestamped across a configurable window (default 30 days) to produce realistic time-series charts.

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     promptmetrics demo                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
    ┌──────────────────┼──────────────────┐
    │                  │                  │
┌───▼────┐      ┌──────▼──────┐    ┌─────▼──────┐
│ Parse  │      │   Verify    │    │   Scale    │
│ Flags  │      │   Server    │    │   Config   │
└───┬────┘      └──────┬──────┘    └─────┬──────┘
    │                  │                  │
    └──────────────────┼──────────────────┘
                       │
              ┌────────▼────────┐
              │  Run Scenarios │
              │  (sequential)  │
              └───────┬───────┘
                      │
        ┌─────────────┼─────────────┬─────────────┐
        │             │             │             │
   ┌────▼────┐  ┌────▼────┐  ┌────▼────┐  ┌────▼────┐
   │ Prompts │  │  Logs   │  │ Traces  │  │  Runs   │
   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘
        │            │            │            │
        └────────────┴────────────┴────────────┘
                       │
              ┌────────▼────────┐
              │  Evaluations   │
              │    + Labels    │
              └────────────────┘
```

---

## 2. Scenario Definitions

Each scenario is a self-contained TypeScript module with:
- `name`: Human-readable scenario name
- `prompts`: Array of `Prompt` objects to create
- `simulate(config)`: Async generator function that yields API calls

### Scenario 1: Customer Support Bot

**Purpose**: Simulate a support ticket classification and response pipeline.

**Prompts**:

| Name | Version | Description |
|------|---------|-------------|
| `support-classifier` | `1.0.0` | Classifies incoming support tickets by urgency and category |
| `support-responder` | `1.0.0` | Generates a draft response based on ticket classification |

**support-classifier** prompt content:
```json
{
  "name": "support-classifier",
  "version": "1.0.0",
  "messages": [
    { "role": "system", "content": "You are a support ticket classifier. Categorize the ticket into one of: billing, technical, account_access, feature_request. Assign urgency: low, medium, high, critical." },
    { "role": "user", "content": "Ticket: {{ticket_body}}" }
  ],
  "variables": {
    "ticket_body": { "type": "string", "required": true }
  },
  "model_config": { "model": "gpt-4o-mini", "temperature": 0.2 },
  "tags": ["production", "support"]
}
```

**support-responder** prompt content:
```json
{
  "name": "support-responder",
  "version": "1.0.0",
  "messages": [
    { "role": "system", "content": "You are a helpful customer support agent. Draft a professional, empathetic response to the customer's issue." },
    { "role": "user", "content": "Category: {{category}}\nUrgency: {{urgency}}\nTicket: {{ticket_body}}" }
  ],
  "variables": {
    "category": { "type": "string", "required": true },
    "urgency": { "type": "string", "required": true },
    "ticket_body": { "type": "string", "required": true }
  },
  "model_config": { "model": "gpt-4o", "temperature": 0.7 },
  "tags": ["production", "support"]
}
```

**Traffic Simulation**:
- 30 traces over 30 days (1 per day on average)
- Each trace = 1 classification call + 1 response call
- 3 spans per trace: `ticket.receive`, `llm.classify`, `llm.respond`
- 30 runs, one per trace, workflow_name = `support-pipeline`
- 10% of runs marked `failed` (simulating LLM timeout or parsing error)
- Logs: ~100 (2 per trace + retry logs for failed runs)
- Evaluations: 2 (`classification-accuracy`, `response-tone`)

### Scenario 2: Meeting Summarizer

**Purpose**: Summarize meeting transcripts and extract action items.

**Prompts**:

| Name | Version | Description |
|------|---------|-------------|
| `meeting-summarizer` | `1.0.0` | Produces a concise summary of a meeting transcript |
| `action-item-extractor` | `1.0.0` | Extracts action items from a meeting summary |

**Traffic Simulation**:
- 20 traces over 30 days (~0.7 per day)
- Each trace = 1 summary call + 1 action-item extraction
- 3 spans per trace: `transcript.load`, `llm.summarize`, `llm.extract-actions`
- 20 runs, workflow_name = `meeting-pipeline`
- 5% failed rate
- Logs: ~80
- Evaluations: 1 (`summary-quality`)

### Scenario 3: Code Review Assistant

**Purpose**: Review pull requests for style issues, bugs, and security risks.

**Prompts**:

| Name | Version | Description |
|------|---------|-------------|
| `pr-reviewer` | `1.0.0` | Reviews a PR diff and flags issues |
| `security-scanner` | `1.0.0` | Scans code for common security vulnerabilities |

**Traffic Simulation**:
- 40 traces over 30 days (~1.3 per day, higher on weekdays)
- Each trace = 1 review call + 1 security scan
- 4 spans per trace: `git.fetch-diff`, `llm.review`, `llm.security-scan`, `comment.post`
- 40 runs, workflow_name = `code-review-pipeline`
- 15% failed rate (simulating large diffs that exceed context window)
- Logs: ~120
- Evaluations: 2 (`review-coverage`, `security-accuracy`)

### Scenario 4: Marketing Copy Generator

**Purpose**: Generate marketing copy variants for A/B testing.

**Prompts**:

| Name | Version | Description |
|------|---------|-------------|
| `ad-copy-generator` | `1.0.0` | Generates short-form ad copy for social media |
| `email-subject-generator` | `1.0.0` | Generates email subject lines with urgency scoring |

**Traffic Simulation**:
- 15 traces over 30 days (~0.5 per day)
- Each trace = 2-3 variant generations
- 3 spans per trace: `audience.load`, `llm.generate-variant-a`, `llm.generate-variant-b`
- 15 runs, workflow_name = `marketing-pipeline`
- 5% failed rate
- Logs: ~60
- Evaluations: 1 (`copy-engagement-score`)

### Scenario 5: RAG Document QA

**Purpose**: Answer questions from a knowledge base using retrieval-augmented generation.

**Prompts**:

| Name | Version | Description |
|------|---------|-------------|
| `rag-retriever` | `1.0.0` | Generates search queries from a user question |
| `rag-answerer` | `1.0.0` | Synthesizes an answer from retrieved document chunks |

**Traffic Simulation**:
- 50 traces over 30 days (~1.7 per day)
- Each trace = 1 retrieval call + 1 answer synthesis
- 4 spans per trace: `query.parse`, `vector-search`, `llm.retrieve`, `llm.synthesize`
- 50 runs, workflow_name = `rag-pipeline`
- 8% failed rate (simulating retrieval returning no results)
- Logs: ~140
- Evaluations: 2 (`answer-relevance`, `retrieval-recall`)

---

## 3. Data Flow & Timestamp Distribution

### Timestamp Strategy

All `created_at` timestamps are Unix epoch **seconds** (not milliseconds), distributed across the requested window with a weekday bias:

```typescript
function randomTimestampInWindow(days: number, now: number): number {
  const start = now - days * 86400;
  const randomOffset = Math.random() * days * 86400;
  let ts = Math.floor(start + randomOffset);

  // Weekday bias: 70% of traffic on Mon-Fri
  const date = new Date(ts * 1000);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  if (isWeekend && Math.random() > 0.3) {
    // 70% chance to move to nearest weekday
    const shift = date.getDay() === 0 ? -2 : -1; // Sun→Fri, Sat→Fri
    ts += shift * 86400;
  }

  return Math.min(ts, now); // Cap at now
}
```

### Volume Curve

Within the window, data is skewed toward the recent past (mimicking organic growth):

| Time Bucket | % of Total Volume |
|-------------|-------------------|
| Last 7 days | 60% |
| Days 8-14 | 25% |
| Days 15-30 | 15% |

This produces a natural "ramp up" curve in time-series charts.

### Entity Creation Order

Entities must be created in dependency order:

1. **Prompts** — No dependencies. Created first with timestamps spread across the window.
2. **Traces** — Reference `prompt_name` and `version_tag`.
3. **Spans** — Reference `trace_id` and optionally `parent_id`.
4. **Runs** — Reference `trace_id` (optional). Created with `status = 'running'`, then updated to `completed` or `failed`.
5. **Logs** — Reference `prompt_name` and `version_tag`. Timestamped to match the trace/run they belong to.
6. **Evaluations** — Reference `prompt_name` and `version_tag`.
7. **Evaluation Results** — Reference `evaluation_id` and `run_id`.
8. **Labels** — Reference `prompt_name` and `version_tag`. Created after all prompts exist.

---

## 4. Synthetic vs. Real Data

### Synthetic Mode (Default)

When `--ollama` is **not** passed:

| Field | Source | Formula / Distribution |
|-------|--------|------------------------|
| `tokens_in` | Synthetic | Normal distribution: μ = 500, σ = 200, min = 50 |
| `tokens_out` | Synthetic | Normal distribution: μ = 300, σ = 150, min = 20 |
| `latency_ms` | Synthetic | Lognormal distribution: μ = 6.5, σ = 0.5 (median ~670ms) |
| `cost_usd` | Synthetic | `(tokens_in + tokens_out) * model_rate` where `model_rate` is $0.0015/1K for GPT-4o, $0.0005/1K for GPT-4o-mini |
| `score` (eval) | Synthetic | Normal distribution: μ = 0.82, σ = 0.12, clamped [0, 1] |
| `status` (run) | Synthetic | 90% `completed`, 10% `failed` |
| `status` (span) | Synthetic | 95% `ok`, 5% `error` (only on `llm.*` spans) |

### Real Mode (`--ollama`)

When `--ollama` is passed:

1. The generator calls the Ollama `/api/generate` endpoint with the prompt content.
2. `tokens_in` and `tokens_out` are extracted from the Ollama response (`prompt_eval_count` and `eval_count`).
3. `latency_ms` is measured as wall-clock time of the HTTP call.
4. `cost_usd` is set to `0` (local inference has no direct cost) unless the user passes `--cost-per-mtok`.
5. For evaluations, a second Ollama call acts as a judge:
   ```
   System: You are an objective evaluator. Score the following output on a scale of 0 to 1,
   where 1 is perfect. Respond with only a number.

   Task: {original_prompt}
   Output: {model_output}

   Score:
   ```

---

## 5. Scale Configurations

### Light (`--scale=light`)

For CI and quick smoke tests:

| Scenario | Prompts | Traces | Runs | Logs | Evals |
|----------|---------|--------|------|------|-------|
| Customer Support Bot | 2 | 5 | 5 | 15 | 1 |
| Meeting Summarizer | 2 | 3 | 3 | 10 | 1 |
| Code Review Assistant | 2 | 5 | 5 | 15 | 1 |
| Marketing Copy Generator | 2 | 3 | 3 | 10 | 1 |
| RAG Document QA | 2 | 5 | 5 | 15 | 1 |
| **Total** | **10** | **21** | **21** | **65** | **5** |

### Medium (`--scale=medium`, default)

For a realistic first-time demo:

| Scenario | Prompts | Traces | Runs | Logs | Evals |
|----------|---------|--------|------|------|-------|
| Customer Support Bot | 2 | 30 | 30 | 100 | 2 |
| Meeting Summarizer | 2 | 20 | 20 | 80 | 1 |
| Code Review Assistant | 2 | 40 | 40 | 120 | 2 |
| Marketing Copy Generator | 2 | 15 | 15 | 60 | 1 |
| RAG Document QA | 2 | 50 | 50 | 140 | 2 |
| **Total** | **10** | **155** | **155** | **500** | **8** |

### Heavy (`--scale=heavy`)

For performance testing:

| Scenario | Prompts | Traces | Runs | Logs | Evals |
|----------|---------|--------|------|------|-------|
| Customer Support Bot | 2 | 100 | 100 | 350 | 2 |
| Meeting Summarizer | 2 | 70 | 70 | 250 | 1 |
| Code Review Assistant | 2 | 130 | 130 | 400 | 2 |
| Marketing Copy Generator | 2 | 50 | 50 | 200 | 1 |
| RAG Document QA | 2 | 150 | 150 | 450 | 2 |
| **Total** | **10** | **500** | **500** | **1,650** | **8** |

---

## 6. API Interaction Pattern

The generator uses **raw HTTP calls** (not the Node SDK) because the SDK is incomplete (missing traces, runs, evaluations). Each call uses the same axios config:

```typescript
const client = axios.create({
  baseURL: serverUrl.replace(/\/$/, ''),
  headers: {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
  },
});
```

### Batch Insertion

To minimize API overhead, the generator uses a simple batch strategy:
- **Prompts**: Created individually (required by API)
- **Traces + Spans**: Created individually (spans are sub-resources)
- **Runs**: Created individually, then updated in a second pass
- **Logs**: Created individually (no bulk endpoint)
- **Evaluations**: Created individually
- **Evaluation Results**: Created individually
- **Labels**: Created individually

For heavy scale, a future optimization could add `POST /v1/batch` endpoints to the server. This is out of scope for v1.

---

## 7. Reset Behavior (`--reset`)

When `--reset` is passed:

1. Query the API for all demo-scoped entities:
   - `GET /v1/prompts` — filter by `tag:demo` (if supported) or delete all
   - `GET /v1/runs` — collect all run IDs
   - `GET /v1/traces` — collect all trace IDs
   - `GET /v1/evaluations` — collect all evaluation IDs
2. Delete in reverse dependency order:
   - Evaluation results → Evaluations
   - Logs
   - Runs
   - Spans → Traces
   - Labels
   - Prompts
3. Re-run the generator from scratch.

**Note**: If the server does not support bulk deletion, `--reset` may be slow on heavy scale. A `DELETE /v1/demo` server endpoint is a candidate for v2.

---

## 8. File Structure

```
src/
  cli/
    commands/
      demo.command.ts          # Main command parser + orchestrator
    demo/
      scenarios/
        support-bot.ts         # Scenario 1
        meeting-summarizer.ts  # Scenario 2
        code-reviewer.ts       # Scenario 3
        marketing-copy.ts      # Scenario 4
        rag-qa.ts              # Scenario 5
      generators/
        timestamp.ts           # Timestamp distribution utilities
        tokens.ts              # Synthetic token/latency/cost generators
        ollama-client.ts       # Ollama API wrapper
      types.ts                 # DemoScenario, DemoConfig interfaces
```

---
