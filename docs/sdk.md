# PromptMetrics Client SDKs

PromptMetrics is intentionally thin. You can use it with raw `curl`, but thin wrapper SDKs make it easier to fetch prompts and automatically emit metadata logs.

## Design Philosophy

- **The SDK fetches prompts** from PromptMetrics
- **Your code calls the LLM** directly (OpenAI, Anthropic, etc.)
- **The SDK logs metadata** back to PromptMetrics after the LLM call

This keeps PromptMetrics out of the inference path — no proxy, no latency overhead, no rate-limit management.

## Node.js SDK

The Node.js SDK lives in `clients/node/`. It is published as `@promptmetrics/client`.

```bash
npm install @promptmetrics/client
```

```typescript
import { PromptMetrics } from '@promptmetrics/client';
import OpenAI from 'openai';

const pm = new PromptMetrics({
  baseUrl: 'http://localhost:3000',
  apiKey: 'pm_xxxxxxxx',
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateWelcome(userName: string) {
  // 1. Fetch prompt from PromptMetrics
  const prompt = await pm.prompts.get('welcome', {
    variables: { name: userName },
  });

  // 2. Call LLM directly in your own code
  const start = Date.now();
  const completion = await openai.chat.completions.create({
    model: prompt.model_config?.model || 'gpt-4o',
    messages: prompt.messages,
    temperature: prompt.model_config?.temperature ?? 0.7,
  });
  const latencyMs = Date.now() - start;

  // 3. Log metadata back to PromptMetrics
  await pm.logs.create({
    prompt_name: prompt.name,
    version_tag: prompt.version,
    provider: 'openai',
    model: completion.model,
    tokens_in: completion.usage?.prompt_tokens || 0,
    tokens_out: completion.usage?.completion_tokens || 0,
    latency_ms: latencyMs,
    cost_usd: estimateCost(completion), // your own function
    metadata: { user_id: 'user_123', experiment: 'headline-v2' },
  });

  return completion.choices[0].message.content;
}
```

## Python SDK (Conceptual)

```python
from promptmetrics import PromptMetrics
from openai import OpenAI

pm = PromptMetrics(
    base_url="http://localhost:3000",
    api_key="pm_xxxxxxxx",
)

openai = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

def generate_welcome(user_name: str):
    # 1. Fetch prompt
    prompt = pm.prompts.get("welcome", variables={"name": user_name})

    # 2. Call LLM
    start = time.time()
    completion = openai.chat.completions.create(
        model=prompt.model_config.get("model", "gpt-4o"),
        messages=prompt.messages,
        temperature=prompt.model_config.get("temperature", 0.7),
    )
    latency_ms = int((time.time() - start) * 1000)

    # 3. Log metadata
    pm.logs.create(
        prompt_name=prompt.name,
        version_tag=prompt.version,
        provider="openai",
        model=completion.model,
        tokens_in=completion.usage.prompt_tokens,
        tokens_out=completion.usage.completion_tokens,
        latency_ms=latency_ms,
        cost_usd=estimate_cost(completion),
        metadata={"user_id": "user_123", "experiment": "headline-v2"},
    )

    return completion.choices[0].message.content
```

## Automatic Logging Wrapper

For zero-friction logging, wrap the LLM client itself:

```typescript
import { wrapOpenAI } from 'promptmetrics-client/openai';

const openai = wrapOpenAI(new OpenAI({ ... }), {
  pm: new PromptMetrics({ baseUrl: '...', apiKey: '...' }),
  promptName: 'welcome',
  versionTag: '1.0.0',
});

// Every call is automatically logged
const completion = await openai.chat.completions.create({ ... });
```

## SDK Status

| SDK | Status | Location |
|---|---|---|
| Node.js | Implemented | `clients/node/` |
| Python | Planned | Community contribution welcome |

The REST API is complete and stable — any SDK is a thin wrapper around:

- `GET /v1/prompts/:name?variables[key]=value`
- `POST /v1/prompts` (create)
- `GET /v1/prompts` (list)
- `POST /v1/logs`
- `POST /v1/traces` — create a trace
- `GET /v1/traces/:trace_id` — get trace with spans
- `POST /v1/traces/:trace_id/spans` — add a span
- `POST /v1/runs` — create a workflow run
- `PATCH /v1/runs/:run_id` — update run status/output
- `GET /v1/runs` — list runs
- `POST /v1/prompts/:name/labels` — tag a version
- `GET /v1/prompts/:name/labels/:label_name` — resolve a label

If you build one, open a PR to add it to this list.
