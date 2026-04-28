# @promptmetrics/client

Official Node.js client for [PromptMetrics](https://github.com/iiizzzyyy/promptmetrics).

## Installation

```bash
npm install @promptmetrics/client
```

## Quick Start

```typescript
import { PromptMetrics } from '@promptmetrics/client';

const client = new PromptMetrics({
  baseUrl: 'http://localhost:3000',
  apiKey: 'pm_xxxxxxxx',
});

// Create a prompt
await client.prompts.create({
  name: 'welcome',
  version: '1.0.0',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello {{name}}!' },
  ],
  variables: { name: { type: 'string', required: true } },
});

// Retrieve and render
const rendered = await client.prompts.get('welcome', {
  variables: { name: 'Alice' },
});

// Log metadata
await client.logs.create({
  prompt_name: 'welcome',
  version_tag: '1.0.0',
  provider: 'openai',
  model: 'gpt-4o',
  tokens_in: 10,
  tokens_out: 20,
  latency_ms: 500,
  cost_usd: 0.001,
});
```

## API

### Prompts

- `client.prompts.list(params?)` — List prompts
- `client.prompts.get(name, options?)` — Get a prompt (with optional rendering)
- `client.prompts.getVersions(name)` — List versions
- `client.prompts.create(data)` — Create a prompt

### Logs

- `client.logs.list(params?)` — List logs
- `client.logs.create(data)` — Log metadata

### Traces

- `client.traces.list(params?)` — List traces
- `client.traces.get(traceId)` — Get a trace with spans
- `client.traces.create(data)` — Create a trace
- `client.traces.addSpan(traceId, data)` — Add a span

### Runs

- `client.runs.list(params?)` — List runs
- `client.runs.get(runId)` — Get a run
- `client.runs.create(data)` — Create a run
- `client.runs.update(runId, data)` — Update a run

### Evaluations

- `client.evaluations.list(params?)` — List evaluations
- `client.evaluations.get(id)` — Get an evaluation
- `client.evaluations.create(data)` — Create an evaluation
- `client.evaluations.addResult(id, data)` — Add a result

### Labels

- `client.labels.list(promptName, params?)` — List labels for a prompt
- `client.labels.create(promptName, data)` — Create a label
- `client.labels.delete(promptName, labelName)` — Delete a label

### Metrics

- `client.metrics.timeSeries(params?)` — Get time-series metrics
- `client.metrics.prompts(params?)` — Get per-prompt metrics
- `client.metrics.evaluations(params?)` — Get evaluation trends
- `client.metrics.activity(params?)` — Get activity summary

## License

MIT
