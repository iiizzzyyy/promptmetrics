# Demo Data Generator: Build Tasks

**Status**: Draft
**Last Updated**: 2026-04-28
**Related**: [PRD](demo-data-generator-prd.md) | [Architecture](demo-data-generator-architecture.md) | [User Guide](demo-data-generator-user-guide.md)

---

## 0. Foundation & File Structure

### 0.1 Create directory layout

```
src/cli/commands/
  demo.command.ts              # Main command parser + orchestrator
src/cli/demo/
  types.ts                     # DemoScenario, DemoConfig, DemoTrace, DemoSpan, etc.
  api-client.ts                # Thin axios wrapper for PromptMetrics API
  generators/
    timestamp.ts               # randomTimestampInWindow, weekdayBias, volumeCurve
    tokens.ts                  # normal, lognormal, clamp, tokenCost, latencyMs, costUsd
    ollama-client.ts           # Ollama /api/generate wrapper + health check
  scenarios/
    support-bot.ts             # Scenario 1
    meeting-summarizer.ts      # Scenario 2
    code-reviewer.ts           # Scenario 3
    marketing-copy.ts          # Scenario 4
    rag-qa.ts                  # Scenario 5
```

**Acceptance Criteria**:
- [ ] All directories and files exist.
- [ ] `demo.command.ts` registers `promptmetrics demo` with all flags (`--server`, `--api-key`, `--scale`, `--days`, `--ollama`, `--model`, `--ollama-host`, `--reset`, `--workspace`).
- [ ] `--help` prints usage matching the User Guide.

---

## 1. Scenario 1: Customer Support Bot

### 1.1 Prompt Definitions

Create two prompts with `driver: 'filesystem'` (or whichever driver the server uses). The demo command writes them via `POST /v1/prompts`.

**Prompt A: `support-classifier` v1.0.0**
```json
{
  "name": "support-classifier",
  "version_tag": "1.0.0",
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

**Prompt B: `support-responder` v1.0.0**
```json
{
  "name": "support-responder",
  "version_tag": "1.0.0",
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

**Acceptance Criteria**:
- [ ] Both prompts are created successfully via API.
- [ ] Prompts contain exact messages, variables, and model_config shown above.
- [ ] `created_at` timestamp is distributed within the demo window.

### 1.2 Synthetic Data Formulas

For each log/span in this scenario, generate:

| Field | Distribution | Parameters |
|-------|--------------|------------|
| `tokens_in` | Normal | mu = 350, sigma = 120, min = 80 |
| `tokens_out` | Normal | mu = 220, sigma = 90, min = 30 |
| `latency_ms` | Lognormal | mu = 6.3, sigma = 0.55 (median ~550ms) |
| `cost_usd` | Deterministic | `(tokens_in + tokens_out) * model_rate` where gpt-4o-mini rate = $0.0005/1K, gpt-4o rate = $0.0015/1K |
| `status` (run) | Categorical | 90% `completed`, 10% `failed` |
| `status` (span) | Categorical | 95% `ok`, 5% `error` (only on `llm.*` spans) |

**Acceptance Criteria**:
- [ ] Token counts are within +/- 3 sigma and clamped at min.
- [ ] Latency values are positive integers.
- [ ] Cost rounds to 6 decimal places.
- [ ] Failed runs are randomly distributed across the time window, not clustered.

### 1.3 Trace / Span Structure

Per trace:

1. `ticket.receive` (root span)
   - `status`: `ok`
   - Duration: 50-150ms
2. `llm.classify` (child of `ticket.receive`)
   - `status`: `ok` (95%) or `error` (5%)
   - Duration: 400-1200ms
   - Linked prompt: `support-classifier`
3. `llm.respond` (child of `ticket.receive`)
   - `status`: `ok` (95%) or `error` (5%)
   - Duration: 600-1800ms
   - Linked prompt: `support-responder`

If `llm.classify` fails, `llm.respond` is still created but `status` = `error` and duration is truncated to ~100ms (simulating early exit).

**Acceptance Criteria**:
- [ ] Every trace has exactly 3 spans with correct parent-child relationships.
- [ ] Span durations are positive and child end_times do not exceed parent end_times.
- [ ] Span names match exactly: `ticket.receive`, `llm.classify`, `llm.respond`.

### 1.4 Run Lifecycle

Each trace creates exactly 1 run.

1. `POST /v1/runs` with `status: 'running'`, `workflow_name: 'support-pipeline'`, `trace_id` set.
   - `input`: `{ ticket_body: "..." }`
2. After spans are created, `PATCH /v1/runs/{id}`:
   - If failed: `status: 'failed'`, `output: { error: "LLM timeout or malformed classification JSON" }`
   - If completed: `status: 'completed'`, `output: { category: "...", urgency: "...", response: "..." }`

**Acceptance Criteria**:
- [ ] Runs transition from `running` to final status in a second API call.
- [ ] Failed runs include a realistic error message in `output`.
- [ ] Run count equals trace count.

### 1.5 Evaluation Criteria

Create 2 evaluations per prompt (4 total eval definitions, but 2 distinct eval names):

**A. `classification-accuracy`** (attached to `support-classifier`)
- Evaluated on every run.
- Synthetic score formula: `clamp(normal(mu=0.80, sigma=0.12), 0, 1)`
- With `--ollama`: judge prompt = `System: You are an objective evaluator...\nTask: Classify the following support ticket.\nOutput: {{model_output}}\nScore:`

**B. `response-tone`** (attached to `support-responder`)
- Evaluated on every run.
- Synthetic score formula: `clamp(normal(mu=0.84, sigma=0.10), 0, 1)`
- With `--ollama`: judge prompt = `System: You are an objective evaluator...\nTask: Draft a professional empathetic support response.\nOutput: {{model_output}}\nScore:`

**Trend Rule**: Scores increase linearly by ~0.15 from the oldest run to the newest run (simulating prompt improvement). Apply as `score + (day_offset / days) * 0.15` before clamping.

**Acceptance Criteria**:
- [ ] Each evaluation definition is created via `POST /v1/evaluations`.
- [ ] Each run gets 1-2 evaluation results.
- [ ] Synthetic scores are in [0, 1].
- [ ] Mean score of last 7 days is higher than mean score of first 7 days.

### 1.6 Log Generation

Logs per trace:
- 1 log for `llm.classify` span
- 1 log for `llm.respond` span
- For failed runs: 1 additional retry log (same prompt, `status: 'error'`, latency ~50% of normal)

Total logs per trace: 2 (success) or 3 (failure).

Log fields:
- `prompt_name`: maps to the prompt used by the span
- `version_tag`: `1.0.0`
- `provider`: `openai`
- `model`: from prompt `model_config.model`
- `tokens_in`, `tokens_out`, `latency_ms`, `cost_usd`: from synthetic formulas
- `metadata`: `{ scenario: 'support-bot', span_name: '...', trace_id: '...' }`

**Acceptance Criteria**:
- [ ] Log count matches architecture spec: ~100 logs at medium scale.
- [ ] Every log references a valid `prompt_name` and `version_tag`.
- [ ] Failed-run logs have `error` metadata and lower latency.

---

## 2. Scenario 2: Meeting Summarizer

### 2.1 Prompt Definitions

**Prompt A: `meeting-summarizer` v1.0.0**
```json
{
  "name": "meeting-summarizer",
  "version_tag": "1.0.0",
  "messages": [
    { "role": "system", "content": "You are an executive assistant. Summarize the following meeting transcript into 3-5 bullet points covering key decisions and outcomes." },
    { "role": "user", "content": "Transcript:\n{{transcript}}" }
  ],
  "variables": {
    "transcript": { "type": "string", "required": true }
  },
  "model_config": { "model": "gpt-4o", "temperature": 0.3 },
  "tags": ["production", "meetings"]
}
```

**Prompt B: `action-item-extractor` v1.0.0**
```json
{
  "name": "action-item-extractor",
  "version_tag": "1.0.0",
  "messages": [
    { "role": "system", "content": "You are a project manager. Read the meeting summary and extract all action items. Format each as: - [ ] Action (Owner: @name, Due: YYYY-MM-DD)." },
    { "role": "user", "content": "Summary:\n{{summary}}" }
  ],
  "variables": {
    "summary": { "type": "string", "required": true }
  },
  "model_config": { "model": "gpt-4o-mini", "temperature": 0.2 },
  "tags": ["production", "meetings"]
}
```

**Acceptance Criteria**:
- [ ] Both prompts created via API with exact content above.

### 2.2 Synthetic Data Formulas

| Field | Distribution | Parameters |
|-------|--------------|------------|
| `tokens_in` | Normal | mu = 1200, sigma = 400, min = 200 (transcripts are long) |
| `tokens_out` | Normal | mu = 350, sigma = 120, min = 50 |
| `latency_ms` | Lognormal | mu = 6.7, sigma = 0.5 (median ~810ms) |
| `cost_usd` | Deterministic | `(tokens_in + tokens_out) * model_rate` |
| `status` (run) | Categorical | 95% `completed`, 5% `failed` |
| `status` (span) | Categorical | 97% `ok`, 3% `error` (only on `llm.*` spans) |

**Acceptance Criteria**:
- [ ] Token counts reflect long-input nature of meeting transcripts.
- [ ] Failure rate is 5%, the lowest of all scenarios.

### 2.3 Trace / Span Structure

Per trace:

1. `transcript.load` (root)
   - `status`: `ok`
   - Duration: 80-200ms
2. `llm.summarize` (child of root)
   - `status`: `ok` (97%) or `error` (3%)
   - Duration: 800-2500ms
   - Linked prompt: `meeting-summarizer`
3. `llm.extract-actions` (child of root)
   - `status`: `ok` (97%) or `error` (3%)
   - Duration: 300-900ms
   - Linked prompt: `action-item-extractor`

If `llm.summarize` fails, `llm.extract-actions` gets `status: 'error'` and ~100ms duration.

**Acceptance Criteria**:
- [ ] Every trace has exactly 3 spans with correct hierarchy.
- [ ] Span names match exactly.

### 2.4 Run Lifecycle

1. `POST /v1/runs` with `status: 'running'`, `workflow_name: 'meeting-pipeline'`.
   - `input`: `{ transcript: "..." }`
2. `PATCH /v1/runs/{id}`:
   - Failed: `status: 'failed'`, `output: { error: "Transcript too short or empty" }`
   - Completed: `status: 'completed'`, `output: { summary: "...", actions: [...] }`

**Acceptance Criteria**:
- [ ] Run count equals trace count.
- [ ] Failed runs reference "short transcript" error.

### 2.5 Evaluation Criteria

**`summary-quality`** (attached to `meeting-summarizer`)
- Evaluated on every run.
- Synthetic score: `clamp(normal(mu=0.78, sigma=0.14), 0, 1)`
- Trend Rule: +0.12 linear improvement over the window.
- With `--ollama`: judge prompt = `System: You are an objective evaluator...\nTask: Summarize a meeting transcript into 3-5 bullet points.\nOutput: {{model_output}}\nScore:`

**Acceptance Criteria**:
- [ ] One evaluation definition created.
- [ ] Each run gets exactly 1 evaluation result.
- [ ] Scores trend upward over time.

### 2.6 Log Generation

Logs per trace:
- 1 log for `llm.summarize`
- 1 log for `llm.extract-actions`
- Failed runs: +1 retry log

Total: ~80 logs at medium scale.

**Acceptance Criteria**:
- [ ] Log count matches spec.
- [ ] Logs link to correct prompts and include `scenario: 'meeting-summarizer'` metadata.

---

## 3. Scenario 3: Code Review Assistant

### 3.1 Prompt Definitions

**Prompt A: `pr-reviewer` v1.0.0**
```json
{
  "name": "pr-reviewer",
  "version_tag": "1.0.0",
  "messages": [
    { "role": "system", "content": "You are a senior software engineer reviewing a pull request. Identify style issues, potential bugs, and architectural concerns. Be concise and actionable." },
    { "role": "user", "content": "PR Diff:\n```diff\n{{diff}}\n```" }
  ],
  "variables": {
    "diff": { "type": "string", "required": true }
  },
  "model_config": { "model": "gpt-4o", "temperature": 0.2 },
  "tags": ["production", "code-review"]
}
```

**Prompt B: `security-scanner` v1.0.0**
```json
{
  "name": "security-scanner",
  "version_tag": "1.0.0",
  "messages": [
    { "role": "system", "content": "You are a security auditor. Scan the provided code diff for common vulnerabilities: SQL injection, XSS, hardcoded secrets, unsafe deserialization, and path traversal. Report severity and remediation." },
    { "role": "user", "content": "Code Diff:\n```diff\n{{diff}}\n```" }
  ],
  "variables": {
    "diff": { "type": "string", "required": true }
  },
  "model_config": { "model": "gpt-4o", "temperature": 0.1 },
  "tags": ["production", "code-review", "security"]
}
```

**Acceptance Criteria**:
- [ ] Prompts created with exact content.

### 3.2 Synthetic Data Formulas

| Field | Distribution | Parameters |
|-------|--------------|------------|
| `tokens_in` | Normal | mu = 900, sigma = 350, min = 150 (diffs vary widely) |
| `tokens_out` | Normal | mu = 280, sigma = 140, min = 30 |
| `latency_ms` | Lognormal | mu = 6.6, sigma = 0.55 (median ~735ms) |
| `cost_usd` | Deterministic | `(tokens_in + tokens_out) * model_rate` |
| `status` (run) | Categorical | 85% `completed`, 15% `failed` (highest failure rate) |
| `status` (span) | Categorical | 90% `ok`, 10% `error` (only on `llm.*` spans) |

**Acceptance Criteria**:
- [ ] Failure rate is exactly 15% (highest of all scenarios).
- [ ] Token counts reflect variable-length diffs.

### 3.3 Trace / Span Structure

Per trace:

1. `git.fetch-diff` (root)
   - `status`: `ok`
   - Duration: 100-400ms
2. `llm.review` (child of root)
   - `status`: `ok` (90%) or `error` (10%)
   - Duration: 700-2000ms
   - Linked prompt: `pr-reviewer`
3. `llm.security-scan` (child of root)
   - `status`: `ok` (90%) or `error` (10%)
   - Duration: 600-1800ms
   - Linked prompt: `security-scanner`
4. `comment.post` (child of root)
   - `status`: `ok` (always, simulating posting to GitHub)
   - Duration: 150-350ms
   - Only created when run is `completed`

If `llm.review` fails, `llm.security-scan` is still created with `status: 'error'` and ~100ms duration, but `comment.post` is omitted.

**Acceptance Criteria**:
- [ ] Completed traces have 4 spans; failed traces have 3 spans (no `comment.post`).
- [ ] Span names match exactly.

### 3.4 Run Lifecycle

1. `POST /v1/runs` with `status: 'running'`, `workflow_name: 'code-review-pipeline'`.
   - `input`: `{ repo: "acme/app", pr_number: 123 }`
2. `PATCH /v1/runs/{id}`:
   - Failed: `status: 'failed'`, `output: { error: "Diff exceeds context window ({{tokens_in}} tokens)" }`
   - Completed: `status: 'completed'`, `output: { issues_found: N, security_flags: N }`

**Acceptance Criteria**:
- [ ] Failed runs cite "context window exceeded" with the synthetic token count.
- [ ] Run count equals trace count.

### 3.5 Evaluation Criteria

**A. `review-coverage`** (attached to `pr-reviewer`)
- Synthetic score: `clamp(normal(mu=0.75, sigma=0.15), 0, 1)`
- Trend: +0.18 over window.
- Judge prompt: `System: You are an objective evaluator...\nTask: Review a PR diff for bugs and style issues.\nOutput: {{model_output}}\nScore:`

**B. `security-accuracy`** (attached to `security-scanner`)
- Synthetic score: `clamp(normal(mu=0.88, sigma=0.10), 0, 1)`
- Trend: +0.10 over window.
- Judge prompt: `System: You are an objective evaluator...\nTask: Scan code for security vulnerabilities.\nOutput: {{model_output}}\nScore:`

**Acceptance Criteria**:
- [ ] Two evaluation definitions created.
- [ ] Each run gets 2 evaluation results.
- [ ] `security-accuracy` mean is higher than `review-coverage` mean (security is more deterministic).

### 3.6 Log Generation

Logs per trace:
- 1 log for `llm.review`
- 1 log for `llm.security-scan`
- Failed runs: +1 retry log

Total: ~120 logs at medium scale.

**Acceptance Criteria**:
- [ ] Log count matches spec.
- [ ] Logs include `scenario: 'code-reviewer'` metadata.

---

## 4. Scenario 4: Marketing Copy Generator

### 4.1 Prompt Definitions

**Prompt A: `ad-copy-generator` v1.0.0**
```json
{
  "name": "ad-copy-generator",
  "version_tag": "1.0.0",
  "messages": [
    { "role": "system", "content": "You are a creative marketing copywriter. Generate 3 short-form ad copy variants for social media. Each variant must be under 140 characters and include a call to action." },
    { "role": "user", "content": "Product: {{product_name}}\nAudience: {{audience}}\nTone: {{tone}}" }
  ],
  "variables": {
    "product_name": { "type": "string", "required": true },
    "audience": { "type": "string", "required": true },
    "tone": { "type": "string", "required": true }
  },
  "model_config": { "model": "gpt-4o-mini", "temperature": 0.9 },
  "tags": ["production", "marketing"]
}
```

**Prompt B: `email-subject-generator` v1.0.0**
```json
{
  "name": "email-subject-generator",
  "version_tag": "1.0.0",
  "messages": [
    { "role": "system", "content": "You are an email marketing specialist. Generate 5 email subject lines with urgency scoring (1-10) for each. Optimize for open rate." },
    { "role": "user", "content": "Campaign: {{campaign_name}}\nOffer: {{offer}}" }
  ],
  "variables": {
    "campaign_name": { "type": "string", "required": true },
    "offer": { "type": "string", "required": true }
  },
  "model_config": { "model": "gpt-4o-mini", "temperature": 0.8 },
  "tags": ["production", "marketing"]
}
```

**Acceptance Criteria**:
- [ ] Prompts created with exact content.

### 4.2 Synthetic Data Formulas

| Field | Distribution | Parameters |
|-------|--------------|------------|
| `tokens_in` | Normal | mu = 180, sigma = 60, min = 40 (short creative prompts) |
| `tokens_out` | Normal | mu = 150, sigma = 50, min = 20 |
| `latency_ms` | Lognormal | mu = 6.2, sigma = 0.5 (median ~492ms) |
| `cost_usd` | Deterministic | `(tokens_in + tokens_out) * model_rate` (uses gpt-4o-mini rate) |
| `status` (run) | Categorical | 95% `completed`, 5% `failed` |
| `status` (span) | Categorical | 97% `ok`, 3% `error` (only on `llm.*` spans) |

**Acceptance Criteria**:
- [ ] Token counts are the lowest of all scenarios (short creative prompts).
- [ ] Failure rate is 5%.

### 4.3 Trace / Span Structure

Per trace:

1. `audience.load` (root)
   - `status`: `ok`
   - Duration: 30-100ms
2. `llm.generate-variant-a` (child of root)
   - `status`: `ok` (97%) or `error` (3%)
   - Duration: 300-800ms
   - Linked prompt: `ad-copy-generator`
3. `llm.generate-variant-b` (child of root)
   - `status`: `ok` (97%) or `error` (3%)
   - Duration: 300-800ms
   - Linked prompt: `email-subject-generator`

**Acceptance Criteria**:
- [ ] Every trace has exactly 3 spans.
- [ ] Span names match exactly.

### 4.4 Run Lifecycle

1. `POST /v1/runs` with `status: 'running'`, `workflow_name: 'marketing-pipeline'`.
   - `input`: `{ product_name: "...", audience: "...", tone: "..." }`
2. `PATCH /v1/runs/{id}`:
   - Failed: `status: 'failed'`, `output: { error: "Generation timeout" }`
   - Completed: `status: 'completed'`, `output: { variants: [...] }`

**Acceptance Criteria**:
- [ ] Run count equals trace count.

### 4.5 Evaluation Criteria

**`copy-engagement-score`** (attached to `ad-copy-generator`)
- Evaluated on every run.
- Synthetic score: `clamp(normal(mu=0.72, sigma=0.16), 0, 1)`
- Trend: +0.20 over window (marketing benefits heavily from iteration).
- Judge prompt: `System: You are an objective evaluator...\nTask: Generate engaging marketing copy with a CTA.\nOutput: {{model_output}}\nScore:`

**Acceptance Criteria**:
- [ ] One evaluation definition created.
- [ ] Each run gets 1 evaluation result.
- [ ] Engagement scores show the steepest upward trend of all scenarios.

### 4.6 Log Generation

Logs per trace:
- 1 log for `llm.generate-variant-a`
- 1 log for `llm.generate-variant-b`
- Failed runs: +1 retry log

Total: ~60 logs at medium scale.

**Acceptance Criteria**:
- [ ] Log count matches spec.
- [ ] Logs include `scenario: 'marketing-copy'` metadata.

---

## 5. Scenario 5: RAG Document QA

### 5.1 Prompt Definitions

**Prompt A: `rag-retriever` v1.0.0**
```json
{
  "name": "rag-retriever",
  "version_tag": "1.0.0",
  "messages": [
    { "role": "system", "content": "You are a retrieval query generator. Given a user's natural language question, produce an optimized search query for a vector database. Output only the query string." },
    { "role": "user", "content": "Question: {{question}}" }
  ],
  "variables": {
    "question": { "type": "string", "required": true }
  },
  "model_config": { "model": "gpt-4o-mini", "temperature": 0.1 },
  "tags": ["production", "rag"]
}
```

**Prompt B: `rag-answerer` v1.0.0**
```json
{
  "name": "rag-answerer",
  "version_tag": "1.0.0",
  "messages": [
    { "role": "system", "content": "You are a knowledge-base assistant. Synthesize a concise, accurate answer from the retrieved document chunks. If the chunks do not contain the answer, say 'I don't have enough information.' Cite sources when possible." },
    { "role": "user", "content": "Question: {{question}}\nRetrieved Chunks:\n{{chunks}}" }
  ],
  "variables": {
    "question": { "type": "string", "required": true },
    "chunks": { "type": "string", "required": true }
  },
  "model_config": { "model": "gpt-4o", "temperature": 0.3 },
  "tags": ["production", "rag"]
}
```

**Acceptance Criteria**:
- [ ] Prompts created with exact content.

### 5.2 Synthetic Data Formulas

| Field | Distribution | Parameters |
|-------|--------------|------------|
| `tokens_in` | Normal | mu = 2500, sigma = 800, min = 500 (RAG chunks are long) |
| `tokens_out` | Normal | mu = 400, sigma = 150, min = 50 |
| `latency_ms` | Lognormal | mu = 6.9, sigma = 0.5 (median ~992ms) |
| `cost_usd` | Deterministic | `(tokens_in + tokens_out) * model_rate` |
| `status` (run) | Categorical | 92% `completed`, 8% `failed` |
| `status` (span) | Categorical | 94% `ok`, 6% `error` (only on `llm.*` spans) |

**Acceptance Criteria**:
- [ ] Token counts are the highest of all scenarios (long RAG context).
- [ ] Failure rate is 8%.

### 5.3 Trace / Span Structure

Per trace:

1. `query.parse` (root)
   - `status`: `ok`
   - Duration: 20-80ms
2. `vector-search` (child of root)
   - `status`: `ok`
   - Duration: 100-300ms
   - Metadata: `{ retrieved_chunks: N, db: 'pinecone' }`
3. `llm.retrieve` (child of root)
   - `status`: `ok` (94%) or `error` (6%)
   - Duration: 300-700ms
   - Linked prompt: `rag-retriever`
4. `llm.synthesize` (child of root)
   - `status`: `ok` (94%) or `error` (6%)
   - Duration: 800-2500ms
   - Linked prompt: `rag-answerer`

If `vector-search` returns 0 chunks (simulated), `llm.synthesize` gets `status: 'error'` and the run fails.

**Acceptance Criteria**:
- [ ] Every trace has exactly 4 spans.
- [ ] Span names match exactly.
- [ ] `vector-search` span metadata includes `retrieved_chunks` count.

### 5.4 Run Lifecycle

1. `POST /v1/runs` with `status: 'running'`, `workflow_name: 'rag-pipeline'`.
   - `input`: `{ question: "..." }`
2. `PATCH /v1/runs/{id}`:
   - Failed: `status: 'failed'`, `output: { error: "Retrieval returned 0 relevant chunks" }`
   - Completed: `status: 'completed'`, `output: { answer: "...", sources: [...] }`

**Acceptance Criteria**:
- [ ] Failed runs cite "0 relevant chunks".
- [ ] Run count equals trace count.

### 5.5 Evaluation Criteria

**A. `answer-relevance`** (attached to `rag-answerer`)
- Synthetic score: `clamp(normal(mu=0.76, sigma=0.13), 0, 1)`
- Trend: +0.14 over window.
- Judge prompt: `System: You are an objective evaluator...\nTask: Synthesize an accurate answer from retrieved document chunks.\nOutput: {{model_output}}\nScore:`

**B. `retrieval-recall`** (attached to `rag-retriever`)
- Synthetic score: `clamp(normal(mu=0.85, sigma=0.09), 0, 1)`
- Trend: +0.08 over window.
- Judge prompt: `System: You are an objective evaluator...\nTask: Generate an effective vector search query from a user question.\nOutput: {{model_output}}\nScore:`

**Acceptance Criteria**:
- [ ] Two evaluation definitions created.
- [ ] Each run gets 2 evaluation results.
- [ ] `retrieval-recall` mean is higher than `answer-relevance` mean.

### 5.6 Log Generation

Logs per trace:
- 1 log for `llm.retrieve`
- 1 log for `llm.synthesize`
- Failed runs: +1 retry log

Total: ~140 logs at medium scale.

**Acceptance Criteria**:
- [ ] Log count matches spec.
- [ ] Logs include `scenario: 'rag-qa'` metadata.

---

## 6. Cross-Cutting Concerns

### 6.1 Ollama Integration

Implement `src/cli/demo/generators/ollama-client.ts`.

**Responsibilities**:
1. **Health Check**: `GET {OLLAMA_HOST}/api/tags` before generation. If unreachable, print `Error: Ollama is not reachable at {host}. Ensure 'ollama serve' is running.` and exit with code 1.
2. **Model Check**: Verify requested model exists in tag list. If missing, print `Error: Model '{name}' not found. Run: ollama pull {name}` and exit with code 1.
3. **Generation**: `POST {OLLAMA_HOST}/api/generate`
   - Body: `{ model, prompt, stream: false, options: { temperature } }`
   - Timeout: 300s
4. **Response Parsing**:
   - `tokens_in` = `response.prompt_eval_count` (fallback to approximate tokenizer count if undefined)
   - `tokens_out` = `response.eval_count`
   - `latency_ms` = measured wall-clock `Date.now()` delta
   - `response_text` = `response.response`
5. **Error Handling**:
   - Network errors: treated as synthetic generation fallback (with warning)
   - Model errors (e.g., context length): `status: 'error'`, `tokens_out = 0`

**Acceptance Criteria**:
- [ ] `--ollama` fails fast with clear message if Ollama is unreachable.
- [ ] `--ollama` fails fast if model is not pulled.
- [ ] Real `tokens_in` and `tokens_out` are extracted from Ollama JSON response.
- [ ] Latency is measured as actual HTTP round-trip.
- [ ] With `--ollama`, `cost_usd` defaults to `0` unless `--cost-per-mtok` is passed.

### 6.2 Evaluation Judge

When `--ollama` is passed, evaluation scores are produced by a judge model.

**Judge Prompt Template**:
```
System: You are an objective evaluator. Score the following output on a scale of 0 to 1, where 1 is perfect. Respond with only a number.

Task: {original_task_description}
Output: {model_output}

Score:
```

**Score Extraction**:
1. Call Ollama with judge prompt and `stream: false`.
2. Parse response text for the first floating-point number.
3. Clamp to `[0, 1]`.
4. If parsing fails, fallback to synthetic score.

**Acceptance Criteria**:
- [ ] Judge prompt includes the original task description and model output.
- [ ] Extracted score is a float in [0, 1].
- [ ] Unparseable judge responses fall back to synthetic score with a warning.

### 6.3 Synthetic Data Engine

Implement `src/cli/demo/generators/tokens.ts` with the following utilities:

**Functions**:
- `normal(mu: number, sigma: number): number` — Box-Muller transform.
- `lognormal(mu: number, sigma: number): number` — `exp(normal(mu, sigma))`.
- `clamp(val: number, min: number, max: number): number`.
- `tokenCost(tokensIn: number, tokensOut: number, modelRate: number): number`.
- `syntheticLatency(model: string): number` — returns lognormal sample based on model complexity.
- `syntheticTokensIn(scenarioComplexity: 'low' | 'medium' | 'high'): number` — returns normal sample tuned to scenario.

**Weekday Bias** (`timestamp.ts`):
```typescript
function randomTimestampInWindow(days: number, now: number): number {
  const start = now - days * 86400;
  const randomOffset = Math.random() * days * 86400;
  let ts = Math.floor(start + randomOffset);
  const date = new Date(ts * 1000);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  if (isWeekend && Math.random() > 0.3) {
    const shift = date.getDay() === 0 ? -2 : -1;
    ts += shift * 86400;
  }
  return Math.min(ts, now);
}
```

**Volume Curve** (`timestamp.ts`):
```typescript
function applyVolumeCurve(timestamps: number[]): number[] {
  // Skew 60% of items into the last 7 days, 25% into days 8-14, 15% into days 15-30
  // Implementation: shuffle, then reassign timestamps by weighted bucket selection.
}
```

**Acceptance Criteria**:
- [ ] `normal` and `lognormal` produce reproducible distributions ( seeded or not; non-seeded is fine for demo ).
- [ ] `clamp` ensures no negative tokens or costs.
- [ ] Weekday bias moves ~70% of weekend timestamps to Friday.
- [ ] Volume curve places 60% of entities in the last 7 days of the window.

### 6.4 Scale Multipliers

Implement a `ScaleConfig` map:

```typescript
const SCALE_CONFIG = {
  light: {
    traces: 0.17,   // 5/30
    logs: 0.15,
    runs: 0.17,
  },
  medium: {
    traces: 1.0,
    logs: 1.0,
    runs: 1.0,
  },
  heavy: {
    traces: 3.33,   // 100/30
    logs: 3.5,
    runs: 3.33,
  },
};
```

Each scenario module exports a `baseCounts` object (medium scale). The orchestrator multiplies by the scale factor and rounds to integer.

**Per-Scenario Base Counts (Medium)**:

| Scenario | Traces | Runs | Logs | Evals |
|----------|--------|------|------|-------|
| Customer Support Bot | 30 | 30 | 100 | 2 |
| Meeting Summarizer | 20 | 20 | 80 | 1 |
| Code Review Assistant | 40 | 40 | 120 | 2 |
| Marketing Copy Generator | 15 | 15 | 60 | 1 |
| RAG Document QA | 50 | 50 | 140 | 2 |

**Acceptance Criteria**:
- [ ] `--scale=light` produces exactly the counts in the Architecture doc light table.
- [ ] `--scale=medium` produces exactly the counts in the Architecture doc medium table.
- [ ] `--scale=heavy` produces exactly the counts in the Architecture doc heavy table.
- [ ] Scale is applied uniformly to traces, runs, and logs.

---

## 7. Reset Behavior (`--reset`)

### 7.1 Implementation

1. Query API for all demo-scoped entities:
   - `GET /v1/prompts?limit=1000`
   - `GET /v1/runs?limit=10000`
   - `GET /v1/traces?limit=10000`
   - `GET /v1/evaluations?limit=1000`
   - `GET /v1/labels?limit=1000`
2. Delete in reverse dependency order:
   - For each evaluation: `GET /v1/evaluations/{id}/results` then `DELETE` each result, then `DELETE /v1/evaluations/{id}`
   - `DELETE /v1/logs/{id}` (or `DELETE /v1/logs` if bulk exists)
   - `DELETE /v1/runs/{id}`
   - For each trace: `DELETE` spans then `DELETE /v1/traces/{id}`
   - `DELETE /v1/labels/{prompt_name}/{label_name}`
   - `DELETE /v1/prompts/{name}`
3. Re-run generator from scratch.

**Note**: If bulk DELETE is not available, loop individually. Print progress.

**Acceptance Criteria**:
- [ ] `--reset` deletes all existing demo data before creating new data.
- [ ] No orphan entities remain after reset.
- [ ] Generator prints entity counts during deletion.

---

## 8. Orchestrator & CLI Integration

### 8.1 Command Registration

In `src/cli/commands/demo.command.ts`, register the command with Commander:

```typescript
program
  .command('demo')
  .description('Populate the PromptMetrics server with realistic demo data')
  .option('-s, --server <url>', 'Server URL', 'http://localhost:3000')
  .option('-k, --api-key <key>', 'API key')
  .option('--scale <level>', 'Data volume: light | medium | heavy', 'medium')
  .option('-d, --days <n>', 'Time window in days', '30')
  .option('--ollama', 'Use local Ollama for real LLM calls')
  .option('--model <name>', 'Ollama model to use', 'llama3.2')
  .option('--ollama-host <url>', 'Ollama server URL', 'http://localhost:11434')
  .option('--reset', 'Delete existing demo data before generating')
  .option('--workspace <id>', 'Workspace ID', 'default')
  .action(async (options) => { ... });
```

### 8.2 Orchestration Flow

1. Parse and validate flags.
2. Verify server is reachable (`GET /v1/health` or `GET /v1/prompts`).
3. If `--reset`: run reset sequence.
4. If `--ollama`: verify Ollama health and model availability.
5. For each scenario (in order):
   a. Create prompts.
   b. Generate traces + spans.
   c. Create runs (running -> completed/failed).
   d. Create logs.
   e. Create evaluations.
   f. Create evaluation results.
6. Create labels (`production`, `staging`) on popular prompts.
7. Print summary table.

**Acceptance Criteria**:
- [ ] `promptmetrics demo --help` prints all options.
- [ ] Server unreachable prints clear error and exits code 1.
- [ ] Summary output matches User Guide format (emoji optional).
- [ ] Total runtime for medium scale without Ollama is < 60 seconds.

---

## 9. Labels

After all scenarios finish, create 5 labels:

1. `production` on `support-classifier` v1.0.0
2. `production` on `pr-reviewer` v1.0.0
3. `production` on `rag-answerer` v1.0.0
4. `staging` on `ad-copy-generator` v1.0.0
5. `staging` on `meeting-summarizer` v1.0.0

**Acceptance Criteria**:
- [ ] Exactly 5 labels created.
- [ ] Labels reference existing prompts and versions.

---

## 10. Global Acceptance Criteria

### 10.1 Data Integrity
- [ ] All `created_at` timestamps are Unix epoch **seconds** (integers, not milliseconds).
- [ ] No timestamp exceeds `now`.
- [ ] Timestamps are monotonic within a trace (root span <= child spans).
- [ ] Every log references a prompt that exists.
- [ ] Every span `trace_id` references a trace that exists.
- [ ] Every run `trace_id` references a trace that exists (if set).
- [ ] Evaluation results reference existing `evaluation_id` and `run_id`.

### 10.2 Realism
- [ ] Token counts correlate with prompt complexity: RAG > Meeting > Code Review > Support > Marketing.
- [ ] Latency correlates with model (`gpt-4o` > `gpt-4o-mini`) and token count.
- [ ] Failure rates vary by scenario: Code Review (15%) > RAG (8%) > Support (10%) > Meeting (5%) = Marketing (5%).
   - *Note: Architecture says Support is 10%, RAG is 8%. The user explicitly said Code Review has highest at 15%. This ordering is correct.*
- [ ] Evaluation scores trend upward over the time window for every scenario.
- [ ] Weekend traffic is reduced compared to weekdays.
- [ ] Last 7 days contain ~60% of total volume.

### 10.3 Modes
- [ ] Synthetic mode (default) produces realistic data without any Ollama dependency.
- [ ] `--ollama` mode produces actual tokens, latency, and judge scores from local LLM.
- [ ] `--ollama` mode gracefully degrades to synthetic on Ollama failure (with warning).

### 10.4 Performance
- [ ] Light scale completes in < 5 seconds.
- [ ] Medium scale completes in < 60 seconds (synthetic) or < 5 minutes (Ollama).
- [ ] Heavy scale completes in < 3 minutes (synthetic).

### 10.5 Testing
- [ ] Unit tests for `normal`, `lognormal`, `clamp`, `tokenCost`, `randomTimestampInWindow`.
- [ ] Unit tests for each scenario's `simulate()` generator (mocked API client).
- [ ] Integration test: run `promptmetrics demo --scale=light --days=7` against a test server and assert counts match expected light-scale counts.
- [ ] Integration test: `--reset` wipes all demo data.
- [ ] Integration test: `--ollama` health check fails when Ollama is not running.
