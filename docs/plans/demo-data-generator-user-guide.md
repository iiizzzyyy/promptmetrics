# Demo Data Generator User Guide

> Populate your PromptMetrics dashboard with realistic AI app data in under 60 seconds.

---

## Quick Start

### 1. Install PromptMetrics

```bash
npm install -g promptmetrics
```

### 2. Start the Server

```bash
promptmetrics-server
```

### 3. Generate an API Key

```bash
node $(npm root -g)/promptmetrics/dist/scripts/generate-api-key.js --workspace default read,write
# => pm_xxxxxxxx... (store this)
```

### 4. Run the Demo

```bash
promptmetrics demo
```

### 5. Open the Dashboard

Visit [http://localhost:3000](http://localhost:3000) and explore:
- **Overview** — Time-series charts, summary cards, recent runs
- **Prompts** — 10 production-ready prompts across 5 AI apps
- **Logs** — ~500 execution logs with tokens, latency, and cost
- **Traces** — ~155 distributed traces with nested spans
- **Runs** — ~155 workflow runs with realistic status distributions
- **Evaluations** — 8 evaluation suites with trending scores
- **Labels** — Environment tags (`production`, `staging`)

---

## CLI Reference

### `promptmetrics demo`

Generate synthetic demo data to populate the PromptMetrics dashboard.

```
Usage: promptmetrics demo [options]

Populate the PromptMetrics server with realistic demo data for evaluation.

Options:
  -s, --server <url>       PromptMetrics server URL (default: "http://localhost:3000")
  -k, --api-key <key>      API key for authentication (auto-detected from promptmetrics.yaml)
  --scale <level>          Data volume: light | medium | heavy (default: "medium")
  -d, --days <n>           Time window in days: 7 | 30 | 90 (default: 30)
  --ollama                 Use local Ollama for real LLM calls (default: synthetic)
  --model <name>           Ollama model to use (default: "llama3.2")
  --ollama-host <url>      Ollama server URL (default: "http://localhost:11434")
  --reset                  Delete existing demo data before generating
  --workspace <id>         Workspace ID (default: "default")
  -h, --help               Display help
```

---

## Examples

### Basic Demo (Synthetic Data)

Fastest way to see the dashboard. No Ollama required.

```bash
promptmetrics demo
```

Output:
```
🚀 PromptMetrics Demo Data Generator
   Server:    http://localhost:3000
   Scale:     medium
   Window:    30 days
   Mode:      synthetic

Creating prompts...          10/10 ✅
Running scenarios...           5/5 ✅
   ├─ Customer Support Bot    30 traces, 100 logs
   ├─ Meeting Summarizer      20 traces, 80 logs
   ├─ Code Review Assistant   40 traces, 120 logs
   ├─ Marketing Copy Gen      15 traces, 60 logs
   └─ RAG Document QA         50 traces, 140 logs

Summary:
   Prompts:       10
   Logs:          500
   Traces:        155
   Spans:         465
   Runs:          155
   Evaluations:   8
   Eval Results:  ~400
   Labels:        5

✨ Done! Open http://localhost:3000 to see your dashboard.
```

### Real LLM Calls with Ollama

Uses your local Ollama instance for authentic token counts, latency, and evaluation scores.

```bash
# Ensure Ollama is running
ollama serve

# Pull the model first (optional — the generator will prompt if missing)
ollama pull llama3.2

# Run the demo with real inference
promptmetrics demo --ollama --model llama3.2
```

Output:
```
🚀 PromptMetrics Demo Data Generator
   Server:       http://localhost:3000
   Scale:        medium
   Window:       30 days
   Mode:         ollama (llama3.2)
   Ollama Host:  http://localhost:11434

Verifying Ollama...            ✅ llama3.2 available
Creating prompts...            10/10 ✅
Running scenarios...             5/5 ✅
   ├─ Customer Support Bot      30 traces, 100 logs
   ├─ Meeting Summarizer        20 traces, 80 logs
   ├─ Code Review Assistant     40 traces, 120 logs
   ├─ Marketing Copy Gen        15 traces, 60 logs
   └─ RAG Document QA           50 traces, 140 logs

Summary:
   Prompts:       10
   Logs:          500 (real tokens + latency from Ollama)
   Traces:        155
   Spans:         465
   Runs:          155
   Evaluations:   8 (judge: llama3.2)
   Eval Results:  ~400
   Labels:        5

✨ Done! Open http://localhost:3000 to see your dashboard.
```

### Heavy Scale for Performance Testing

Generates ~1,650 logs and ~500 traces. Useful for testing dashboard performance or metrics query speed.

```bash
promptmetrics demo --scale=heavy --days=90
```

### Light Scale for CI

Minimal data for automated testing or quick smoke checks.

```bash
promptmetrics demo --scale=light --days=7
```

### Reset and Regenerate

Wipe all existing demo data and start fresh.

```bash
promptmetrics demo --reset
```

### Custom Server or API Key

Point the generator at a remote PromptMetrics instance.

```bash
promptmetrics demo \
  --server https://promptmetrics.internal.example.com \
  --api-key pm_abcdef123456 \
  --workspace engineering
```

---

## Scenarios Explained

The generator simulates 5 distinct AI applications. Each has its own prompts, traffic patterns, and failure modes.

### 1. Customer Support Bot

**Prompts**: `support-classifier`, `support-responder`

Simulates a support ticket pipeline: classify incoming tickets by urgency/category, then draft a response.

- **Traffic**: ~1 ticket/day, higher on weekdays
- **Failure mode**: 10% of runs fail (LLM timeout or malformed classification JSON)
- **Evaluations**: Classification accuracy, response tone

### 2. Meeting Summarizer

**Prompts**: `meeting-summarizer`, `action-item-extractor`

Simulates post-meeting processing: summarize a transcript, then extract action items.

- **Traffic**: ~0.7 meetings/day
- **Failure mode**: 5% fail (very short transcripts)
- **Evaluations**: Summary quality

### 3. Code Review Assistant

**Prompts**: `pr-reviewer`, `security-scanner`

Simulates automated PR review: review the diff for bugs/style, then scan for security issues.

- **Traffic**: ~1.3 PRs/day, concentrated on weekdays
- **Failure mode**: 15% fail (diff too large for context window)
- **Evaluations**: Review coverage, security accuracy

### 4. Marketing Copy Generator

**Prompts**: `ad-copy-generator`, `email-subject-generator`

Simulates marketing content generation: produce ad copy and email subject lines for A/B testing.

- **Traffic**: ~0.5 campaigns/day
- **Failure mode**: 5% fail
- **Evaluations**: Copy engagement score

### 5. RAG Document QA

**Prompts**: `rag-retriever`, `rag-answerer`

Simulates a knowledge-base Q&A system: generate a search query from a user question, then synthesize an answer from retrieved chunks.

- **Traffic**: ~1.7 questions/day
- **Failure mode**: 8% fail (retrieval returns no results)
- **Evaluations**: Answer relevance, retrieval recall

---

## Data Realism

### Without Ollama (Synthetic)

All data is statistically realistic:

- **Token counts** follow a normal distribution (mean 500 in, 300 out)
- **Latency** follows a lognormal distribution (median ~670ms)
- **Cost** is computed from tokens using OpenAI pricing rates
- **Evaluation scores** follow a normal distribution (mean 0.82, σ 0.12)
- **Traffic** is higher on weekdays and skewed toward the last 7 days

### With Ollama (Real)

Data comes from actual local LLM inference:

- **Token counts** are exact counts from the Ollama response
- **Latency** is the real wall-clock HTTP round-trip time
- **Cost** is $0 (local inference) unless you pass a custom rate
- **Evaluation scores** are produced by a judge model evaluating the output quality

---

## Troubleshooting

### "Failed to connect to PromptMetrics server"

- Make sure `promptmetrics-server` is running.
- Check the `--server` URL matches your server.
- Verify your API key has `read,write` scope.

### "Ollama is not reachable"

- Ensure `ollama serve` is running in another terminal.
- Check the `--ollama-host` URL (default: `http://localhost:11434`).
- Verify the model is pulled: `ollama pull llama3.2`.

### "Dashboard is still empty after running demo"

- Hard-refresh the browser (`Cmd+Shift+R` or `Ctrl+Shift+R`).
- Check the browser console for API errors.
- Verify the `--workspace` matches the dashboard workspace.

### "Generator is slow"

- Use `--scale=light` for a quick run.
- Without `--ollama`, the generator completes in ~5 seconds.
- With `--ollama`, expect 2-5 minutes depending on your hardware.

---

## FAQ

**Q: Can I customize the scenarios?**  
A: Not via CLI flags in v1. The scenarios are hardcoded for consistency. You can fork the generator source in `src/cli/demo/scenarios/` if you need custom data.

**Q: Will the demo data interfere with my real data?**  
A: No. Demo data is scoped to the workspace you specify (`default` by default). If you use a dedicated workspace (e.g., `--workspace demo`), it is fully isolated.

**Q: Can I delete demo data without `--reset`?**  
A: Not yet. v1 does not tag demo data for bulk deletion. Use `--reset` to wipe and regenerate. A future version may add a `DELETE /v1/demo` endpoint.

**Q: Does the generator use the Node SDK?**  
A: No. It makes raw HTTP calls to ensure it works even if the SDK is incomplete.

**Q: Can I run the generator against a remote PromptMetrics server?**  
A: Yes. Pass `--server` and `--api-key` to target any accessible instance.

---
