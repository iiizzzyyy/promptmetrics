# PromptMetrics API Reference

Base URL: `http://localhost:3000`

Authentication: All endpoints except `/health` require `X-API-Key` header.

Workspace Authorization: Pass `X-Workspace-Id` to scope requests. Normal keys are rejected if the header does not match their assigned workspace. Master keys (`workspace_id = '*'`) accept any workspace.

## Endpoints

### Health

#### GET /health
Shallow health check.

**Response:**
```json
{ "status": "ok" }
```

#### GET /health/deep
Deep health check including database and driver status.

> **Note:** This endpoint is handled by the raw HTTP server, not Express. It includes additional fields (`gitSyncLastRun`, `reconciliationRunning`) that are not available when accessed through Express.

**Response:**
```json
{
  "status": "ok",
  "checks": {
    "sqlite": "ok",
    "driver": "ok"
  },
  "dbType": "sqlite",
  "dbConnected": true,
  "driverType": "filesystem",
  "gitSyncLastRun": 1715894400,
  "reconciliationRunning": false
}
```

### Prompts

#### GET /v1/prompts
List all prompts with pagination and search.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 50 | Items per page (max 100) |
| `q` | string | — | Search prompt names |

**Response:**
```json
{
  "items": [{ "name": "welcome" }],
  "total": 1,
  "page": 1,
  "limit": 50,
  "totalPages": 1
}
```

#### GET /v1/prompts/:name
Get a prompt. Returns latest version by default.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `version` | string | latest | Specific version tag |
| `render` | boolean | true | Enable variable substitution |
| `variables[key]` | string | — | Variable values |

**Response:**
```json
{
  "content": {
    "name": "welcome",
    "version": "1.0.0",
    "messages": [
      { "role": "system", "content": "You are a helpful assistant." },
      { "role": "user", "content": "Hello Alice!" }
    ],
    "variables": { ... }
  },
  "version": {
    "name": "welcome",
    "version_tag": "1.0.0",
    "created_at": 1776849966
  }
}
```

#### GET /v1/prompts/:name/versions
List all versions of a prompt.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 50 | Items per page |

**Response:**
```json
{
  "items": [
    {
      "name": "welcome",
      "version_tag": "1.0.0",
      "created_at": 1776849966
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 50,
  "totalPages": 1
}
```

#### POST /v1/prompts
Create a new prompt.

**Request Body:**
```json
{
  "name": "welcome",
  "version": "1.0.0",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello {{name}}!" }
  ],
  "variables": {
    "name": { "type": "string", "required": true }
  },
  "model_config": {
    "model": "gpt-4o",
    "temperature": 0.7
  },
  "ollama": {
    "options": { "temperature": 0.8, "num_ctx": 4096 },
    "keep_alive": "5m",
    "format": "json"
  },
  "tags": ["greeting"]
}
```

**Response:** `201 Created`
```json
{
  "name": "welcome",
  "version_tag": "1.0.0",
  "created_at": 1776849966
}
```

### Logs

#### POST /v1/logs
Log metadata for an LLM request.

**Request Body:**
```json
{
  "prompt_name": "welcome",
  "version_tag": "1.0.0",
  "provider": "openai",
  "model": "gpt-4o",
  "tokens_in": 10,
  "tokens_out": 20,
  "latency_ms": 500,
  "cost_usd": 0.001,
  "ollama_options": { "temperature": 0.8, "num_ctx": 4096 },
  "ollama_keep_alive": "5m",
  "ollama_format": "json",
  "metadata": {
    "user_id": "user_123",
    "experiment": "headline-v2"
  }
}
```

**Validation Rules:**
- `metadata`: max 50 top-level keys
- Key length: max 128 chars
- Value length: max 1024 chars
- Supported value types: string, number, boolean, nested objects, and arrays
- `ollama_options`: free-form object (passed through to Ollama)
- `ollama_keep_alive`: string, max 16 chars
- `ollama_format`: string or object

**Response:** `202 Accepted`
```json
{ "id": 1, "status": "accepted" }
```

#### GET /v1/logs
List all logs with pagination.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 50 | Items per page (max 100) |

**Response:**
```json
{
  "items": [
    {
      "id": 1,
      "prompt_name": "welcome",
      "version_tag": "1.0.0",
      "provider": "openai",
      "model": "gpt-4o",
      "tokens_in": 10,
      "tokens_out": 20,
      "latency_ms": 500,
      "cost_usd": 0.001,
      "metadata": { "user_id": "user_123" },
      "created_at": 1776849966
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 50,
  "totalPages": 1
}
```

### Traces

#### POST /v1/traces
Create a trace for an agent loop or request flow.

**Request Body:**
```json
{
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "prompt_name": "welcome",
  "version_tag": "1.0.0",
  "metadata": {
    "agent": "headline-agent",
    "loop": 1
  }
}
```

- `trace_id` is optional; a UUID will be auto-generated if omitted.
- `prompt_name` and `version_tag` are optional.
- `metadata`: max 50 top-level keys; nested objects and arrays allowed.

**Response:** `201 Created`
```json
{
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "prompt_name": "welcome",
  "version_tag": "1.0.0",
  "status": "created"
}
```

#### GET /v1/traces
List all traces with pagination.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 50 | Items per page (max 100) |

**Response:**
```json
{
  "items": [
    {
      "trace_id": "550e8400-e29b-41d4-a716-446655440000",
      "prompt_name": "welcome",
      "version_tag": "1.0.0",
      "metadata": { "agent": "headline-agent" },
      "created_at": 1776849966
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 50,
  "totalPages": 1
}
```

#### GET /v1/traces/:trace_id
Get a trace with all its spans.

**Response:**
```json
{
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "prompt_name": "welcome",
  "version_tag": "1.0.0",
  "metadata": { "agent": "headline-agent" },
  "created_at": 1776849966,
  "spans": [
    {
      "span_id": "span-1",
      "parent_id": null,
      "name": "fetch-prompt",
      "status": "ok",
      "start_time": 1000,
      "end_time": 2000,
      "metadata": {},
      "created_at": 1776849966
    }
  ]
}
```

### Spans

#### POST /v1/traces/:trace_id/spans
Add a span to an existing trace.

**Request Body:**
```json
{
  "span_id": "550e8400-e29b-41d4-a716-446655440001",
  "parent_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "llm-call",
  "status": "ok",
  "start_time": 1000,
  "end_time": 2500,
  "metadata": {
    "model": "gpt-4o",
    "tokens_in": 15
  }
}
```

- `span_id` is optional; a UUID will be auto-generated if omitted.
- `parent_id` is optional for nested spans.
- `status` must be `ok` or `error`.
- `start_time` and `end_time` are millisecond timestamps (optional).
- `metadata`: max 50 top-level keys; nested objects and arrays allowed.

**Response:** `201 Created`
```json
{
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "span_id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "llm-call",
  "status": "ok"
}
```

#### GET /v1/traces/:trace_id/spans/:span_id
Get a single span by ID.

**Response:**
```json
{
  "span_id": "550e8400-e29b-41d4-a716-446655440001",
  "parent_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "llm-call",
  "status": "ok",
  "start_time": 1000,
  "end_time": 2500,
  "metadata": { "model": "gpt-4o", "tokens_in": 15 },
  "created_at": 1776849966
}
```

### Workflow Runs

#### POST /v1/runs
Create a workflow run.

**Request Body:**
```json
{
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "workflow_name": "headline-generator",
  "status": "running",
  "input": { "topic": "AI" },
  "output": { "headline": "AI Breakthrough" },
  "trace_id": "550e8400-e29b-41d4-a716-446655440001",
  "metadata": { "agent": "headline-v2" }
}
```

- `run_id` is optional; a UUID will be auto-generated if omitted.
- `workflow_name` is required.
- `status` is optional and defaults to `running`. Valid values: `running`, `completed`, `failed`.
- `trace_id` is optional and must reference an existing trace.
- `metadata`: max 50 top-level keys; nested objects and arrays allowed.

**Response:** `201 Created`
```json
{
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "workflow_name": "headline-generator",
  "status": "running"
}
```

#### GET /v1/runs
List all runs with pagination.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 50 | Items per page (max 100) |

**Response:**
```json
{
  "items": [
    {
      "run_id": "550e8400-e29b-41d4-a716-446655440000",
      "workflow_name": "headline-generator",
      "status": "completed",
      "input": { "topic": "AI" },
      "output": { "headline": "AI Breakthrough" },
      "trace_id": "550e8400-e29b-41d4-a716-446655440001",
      "metadata": {},
      "created_at": 1776849966,
      "updated_at": 1776849970
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 50,
  "totalPages": 1
}
```

#### GET /v1/runs/:run_id
Get a single run by ID.

**Response:**
```json
{
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "workflow_name": "headline-generator",
  "status": "completed",
  "input": { "topic": "AI" },
  "output": { "headline": "AI Breakthrough" },
  "trace_id": "550e8400-e29b-41d4-a716-446655440001",
  "metadata": {},
  "created_at": 1776849966,
  "updated_at": 1776849970
}
```

#### PATCH /v1/runs/:run_id
Update a run's status, output, or metadata.

**Request Body:**
```json
{
  "status": "completed",
  "output": { "headline": "AI Breakthrough" },
  "metadata": { "reviewed": true }
}
```

- Only provided fields are updated. `updated_at` is refreshed automatically.

**Response:** `200 OK`
```json
{ "run_id": "550e8400-e29b-41d4-a716-446655440000", "status": "updated" }
```

### Prompt Labels

#### POST /v1/prompts/:name/labels
Tag a prompt version with a label (e.g., `production`, `staging`).

**Request Body:**
```json
{
  "name": "production",
  "version_tag": "1.0.0"
}
```

- `name` is required. Max 128 chars. Alphanumeric, underscore, dot, and dash only.
- `version_tag` is required.
- A prompt can only have one label with a given name (unique constraint on `prompt_name` + `name`).

**Response:** `201 Created`
```json
{
  "prompt_name": "welcome",
  "name": "production",
  "version_tag": "1.0.0"
}
```

**Error:** `409 Conflict` if a label with the same name already exists for this prompt.

#### GET /v1/prompts/:name/labels
List all labels for a prompt.

**Response:**
```json
{
  "items": [
    {
      "prompt_name": "welcome",
      "name": "production",
      "version_tag": "1.0.0",
      "created_at": 1776849966
    }
  ],
  "total": 1
}
```

#### GET /v1/prompts/:name/labels/:label_name
Get a specific label. Returns the version tag it points to.

**Response:**
```json
{
  "prompt_name": "welcome",
  "name": "production",
  "version_tag": "1.0.0",
  "created_at": 1776849966
}
```

#### DELETE /v1/prompts/:name/labels/:label_name
Remove a label from a prompt.

**Response:** `204 No Content`

### Evaluations

#### POST /v1/evaluations
Create an evaluation.

**Request Body:**
```json
{
  "name": "accuracy-check",
  "description": "Check output accuracy",
  "prompt_name": "welcome",
  "version_tag": "1.0.0",
  "criteria": { "min_score": 0.8 }
}
```

- `name` is required.
- `prompt_name` is required.
- `version_tag`, `description`, and `criteria` are optional.

**Response:** `201 Created`
```json
{
  "id": "eval-uuid",
  "name": "accuracy-check",
  "description": "Check output accuracy",
  "prompt_name": "welcome",
  "version_tag": "1.0.0",
  "criteria": { "min_score": 0.8 },
  "created_at": 1776849966
}
```

#### GET /v1/evaluations
List all evaluations.

**Response:**
```json
{
  "items": [
    {
      "id": "eval-uuid",
      "name": "accuracy-check",
      "prompt_name": "welcome",
      "version_tag": "1.0.0",
      "created_at": 1776849966
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 50,
  "totalPages": 1
}
```

#### GET /v1/evaluations/:id
Get a single evaluation.

**Response:**
```json
{
  "id": "eval-uuid",
  "name": "accuracy-check",
  "description": "Check output accuracy",
  "prompt_name": "welcome",
  "version_tag": "1.0.0",
  "criteria": { "min_score": 0.8 },
  "created_at": 1776849966
}
```

#### POST /v1/evaluations/:id/run
Run an evaluation suite.

**Request Body:**
```json
{
  "dataset_id": 1
}
```

- `dataset_id` is optional. When provided, the evaluation runs against the specified dataset.

**Response:** `201 Created`
```json
{
  "id": 1,
  "evaluation_id": 1,
  "dataset_id": 1,
  "status": "running",
  "created_at": 1776849966,
  "workspace_id": "default"
}
```

#### GET /v1/evaluations/:id/run
List evaluation runs.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 50 | Items per page (max 100) |

**Response:**
```json
{
  "items": [
    {
      "id": 1,
      "evaluation_id": 1,
      "dataset_id": 1,
      "status": "completed",
      "score": 0.95,
      "results_json": "{...}",
      "created_at": 1776849966,
      "workspace_id": "default"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 50,
  "totalPages": 1
}
```

#### POST /v1/evaluations/:id/results
Add a result to an evaluation.

**Request Body:**
```json
{
  "run_id": "run-1",
  "score": 0.95,
  "metadata": { "judge": "gpt-4" }
}
```

- `score` is required.
- `run_id` and `metadata` are optional.

**Response:** `201 Created`
```json
{
  "id": "result-uuid",
  "evaluation_id": "eval-uuid",
  "run_id": "run-1",
  "score": 0.95,
  "metadata": { "judge": "gpt-4" },
  "created_at": 1776849966
}
```

#### GET /v1/evaluations/:id/results
List results for an evaluation.

**Response:**
```json
{
  "items": [
    {
      "id": "result-uuid",
      "evaluation_id": "eval-uuid",
      "run_id": "run-1",
      "score": 0.95,
      "metadata": { "judge": "gpt-4" },
      "created_at": 1776849966
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 50,
  "totalPages": 1
}
```

#### DELETE /v1/evaluations/:id
Delete an evaluation and cascade its results.

**Response:** `204 No Content`

### A/B Tests

#### POST /v1/ab-tests
Create an A/B test comparing two prompt versions.

**Request Body:**
```json
{
  "prompt_name": "welcome",
  "version_a": "1.0.0",
  "version_b": "1.1.0",
  "dataset_id": 1,
  "metric": "latency"
}
```

- `prompt_name` is required. Max 255 chars.
- `version_a` is required. Max 255 chars.
- `version_b` is required. Max 255 chars.
- `dataset_id` is optional.
- `metric` is optional. Valid values: `latency`, `cost`, `win_rate`. Defaults to `latency`.

**Response:** `201 Created`
```json
{
  "id": 1,
  "prompt_name": "welcome",
  "version_a": "1.0.0",
  "version_b": "1.1.0",
  "dataset_id": 1,
  "status": "running",
  "metric": "latency",
  "created_at": 1776849966,
  "updated_at": 1776849966,
  "workspace_id": "default"
}
```

#### GET /v1/ab-tests
List A/B tests with pagination.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 50 | Items per page (max 100) |

**Response:**
```json
{
  "items": [
    {
      "id": 1,
      "prompt_name": "welcome",
      "version_a": "1.0.0",
      "version_b": "1.1.0",
      "dataset_id": 1,
      "status": "running",
      "metric": "latency",
      "created_at": 1776849966,
      "updated_at": 1776849966,
      "workspace_id": "default"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 50,
  "totalPages": 1
}
```

#### GET /v1/ab-tests/:id
Get an A/B test, including its latest result if available.

**Response:**
```json
{
  "id": 1,
  "prompt_name": "welcome",
  "version_a": "1.0.0",
  "version_b": "1.1.0",
  "dataset_id": 1,
  "status": "completed",
  "metric": "latency",
  "created_at": 1776849966,
  "updated_at": 1776849970,
  "workspace_id": "default",
  "latest_result": {
    "id": 1,
    "ab_test_id": 1,
    "version_a_score": 245.5,
    "version_b_score": 198.2,
    "p_value": 0.03,
    "winner": "B",
    "created_at": 1776849970,
    "workspace_id": "default"
  }
}
```

#### POST /v1/ab-tests/:id/run
Run the A/B test by submitting scores for both variants. The test status is updated to `completed` and a statistical analysis is stored.

**Request Body:**
```json
{
  "scoresA": [250, 240, 260, 245, 255],
  "scoresB": [200, 195, 205, 190, 210]
}
```

- `scoresA` is required. Array of numbers with at least one element.
- `scoresB` is required. Array of numbers with at least one element.

**Response:** `200 OK`
```json
{
  "id": 1,
  "ab_test_id": 1,
  "version_a_score": 250,
  "version_b_score": 200,
  "p_value": 0.0012,
  "winner": "B",
  "created_at": 1776849966,
  "workspace_id": "default"
}
```

#### POST /v1/ab-tests/:id/promote
Promote the winning variant of a completed A/B test.

**Response:** `200 OK`
```json
{
  "winner": "B",
  "version": "1.1.0"
}
```

**Error:** `400 Bad Request` if the test has not been run or no winner was determined.

#### DELETE /v1/ab-tests/:id
Delete an A/B test and its results.

**Response:** `204 No Content`

### Datasets

#### POST /v1/datasets
Create a dataset for evaluation or A/B testing.

**Request Body:**
```json
{
  "name": "qa-dataset",
  "rows": [
    {
      "input": { "question": "What is the capital of France?" },
      "expectedOutput": { "answer": "Paris" }
    },
    {
      "input": { "question": "What is 2 + 2?" },
      "expectedOutput": { "answer": "4" }
    }
  ]
}
```

- `name` is required. Max 128 chars.
- `rows` is required. Array of objects, each with:
  - `input` (required): free-form object
  - `expectedOutput` (optional): free-form object
- `rows` is limited to 10,000 items.
- Total payload size is limited to 10 MB.

**Response:** `201 Created`
```json
{
  "id": 1,
  "name": "qa-dataset",
  "row_count": 2,
  "created_at": 1776849966
}
```

#### GET /v1/datasets
List datasets with pagination.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 50 | Items per page (max 100) |

**Response:**
```json
{
  "items": [
    {
      "id": 1,
      "name": "qa-dataset",
      "row_count": 2,
      "schema": {},
      "created_at": 1776849966
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 50,
  "totalPages": 1
}
```

#### GET /v1/datasets/:id
Get a dataset, including a preview of the first 5 rows.

**Response:**
```json
{
  "id": 1,
  "name": "qa-dataset",
  "row_count": 2,
  "schema": {},
  "created_at": 1776849966,
  "preview": [
    {
      "id": 1,
      "input": { "question": "What is the capital of France?" },
      "expectedOutput": { "answer": "Paris" }
    }
  ]
}
```

#### DELETE /v1/datasets/:id
Delete a dataset and its rows.

**Response:** `204 No Content`

### Compliance

#### POST /v1/compliance/scan
Scan prompt text for compliance violations (PII, security risks, and sensitive data).

**Request Body:**
```json
{
  "prompt_name": "welcome",
  "version_tag": "1.0.0",
  "text": "Hello, my email is alice@example.com and my SSN is 123-45-6789."
}
```

- `prompt_name` is required.
- `version_tag` is required.
- `text` is required. Max 100,000 characters.

**Response:** `200 OK`
```json
{
  "score": 45,
  "riskLevel": "high",
  "violations": [
    {
      "rule": "Email Detection",
      "severity": "high",
      "category": "pii",
      "matchedText": "alice@example.com"
    },
    {
      "rule": "SSN Detection",
      "severity": "critical",
      "category": "pii",
      "matchedText": "123-45-6789"
    }
  ]
}
```

- `score` ranges from 0 to 100. Higher is better (fewer violations).
- `riskLevel` is derived from the score: `low` (>=90), `medium` (>=70), `high` (>=40), `critical` (<40).
- The scan result is persisted to the `compliance_scores` table.

#### GET /v1/compliance/scores
List persisted compliance scores with pagination.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 50 | Items per page (max 100) |

**Response:**
```json
{
  "items": [
    {
      "id": 1,
      "prompt_name": "welcome",
      "version_tag": "1.0.0",
      "score": 45,
      "risk_level": "high",
      "violations": [
        {
          "rule": "Email Detection",
          "severity": "high",
          "category": "pii",
          "matchedText": "alice@example.com"
        }
      ],
      "created_at": 1776849966
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 50,
  "totalPages": 1
}
```

#### GET /v1/compliance/scores/:id
Get a single compliance score by ID.

**Response:**
```json
{
  "id": 1,
  "prompt_name": "welcome",
  "version_tag": "1.0.0",
  "score": 45,
  "risk_level": "high",
  "violations": [
    {
      "rule": "Email Detection",
      "severity": "high",
      "category": "pii",
      "matchedText": "alice@example.com"
    }
  ],
  "created_at": 1776849966
}
```

### Playground

#### GET /v1/playground/models
List available LLM models from all registered providers.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 50 | Items per page (max 100) |

**Response:**
```json
{
  "items": [
    {
      "id": "gpt-4o",
      "name": "GPT-4o",
      "provider": "openai",
      "contextWindow": 128000
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 50,
  "totalPages": 1
}
```

#### POST /v1/playground/chat
Chat completion proxy.

**Request Body:**
```json
{
  "provider": "openai",
  "model": "gpt-4o",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello {{name}}!" }
  ],
  "variables": { "name": "Alice" },
  "temperature": 0.7,
  "maxTokens": 256,
  "topP": 1.0
}
```

- `provider` is required. Max 64 chars.
- `model` is required. Max 128 chars.
- `messages` is required. Array of objects with `role` (`system`, `user`, or `assistant`) and `content`.
- `variables` is optional. Used for Mustache variable substitution in message content.
- `temperature` is optional. Range: 0 to 2.
- `maxTokens` is optional. Minimum 1.
- `topP` is optional. Range: 0 to 1.

**Response:** `200 OK`
```json
{
  "id": "chatcmpl-123",
  "model": "gpt-4o",
  "output": "Hello Alice! How can I help you today?",
  "tokensIn": 15,
  "tokensOut": 10,
  "latencyMs": 420,
  "costUsd": 0.00015,
  "finishReason": "stop"
}
```

**Error Responses:**
- `429 Too Many Requests` — provider rate limit exceeded
- `400 Bad Request` — content policy violation or invalid request
- `504 Gateway Timeout` — provider timeout
- `502 Bad Gateway` — provider error

#### POST /v1/playground/chat/stream
Streaming chat completion proxy. Response is `application/x-ndjson`.

**Request Body:**
Same as `POST /v1/playground/chat`.

**Response Stream:**
Each line is a JSON object:
```json
{ "type": "token", "content": "Hello" }
{ "type": "token", "content": " Alice" }
{ "type": "metrics", "tokensIn": 15, "tokensOut": 10, "latencyMs": 420, "costUsd": 0.00015 }
{ "type": "done", "finishReason": "stop" }
```

Possible chunk types:
- `token`: `{ type: "token", content: string }`
- `tool_call`: `{ type: "tool_call", name: string, arguments: string }`
- `metrics`: `{ type: "metrics", tokensIn: number, tokensOut: number, latencyMs: number, costUsd: number }`
- `done`: `{ type: "done", finishReason: string }`
- `error`: `{ type: "error", message: string, code?: string }`

#### POST /v1/playground/completions
Text completion proxy.

**Request Body:**
```json
{
  "provider": "openai",
  "model": "gpt-4o",
  "prompt": "Write a haiku about {{topic}}.",
  "variables": { "topic": "clouds" },
  "temperature": 0.7,
  "maxTokens": 256,
  "topP": 1.0
}
```

- `provider` is required. Max 64 chars.
- `model` is required. Max 128 chars.
- `prompt` is required.
- `variables`, `temperature`, `maxTokens`, and `topP` follow the same rules as the chat endpoint.

**Response:** `200 OK`
Same shape as `POST /v1/playground/chat`.

### API Keys

#### POST /v1/api-keys
Create a new API key. Requires `admin` scope.

**Request Body:**
```json
{
  "name": "ci-runner",
  "scopes": ["read", "write"],
  "workspace_id": "default",
  "expires_in_days": 30
}
```

- `name` is required.
- `scopes` is required. Array of `read`, `write`, `admin`.
- `workspace_id` is optional and defaults to `default`. Use `"*"` for a master key.
- `expires_in_days` is optional.

**Response:** `201 Created`
```json
{
  "id": 1,
  "name": "ci-runner",
  "scopes": ["read", "write"],
  "workspace_id": "default",
  "expires_at": 1779441966,
  "key": "pm_xxxxxxxx...",
  "created_at": 1776849966
}
```

> The plaintext `key` is returned **once** on creation and never again.

#### GET /v1/api-keys
List all API keys. Requires `admin` scope.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 50 | Items per page (max 100) |

**Response:**
```json
{
  "items": [
    {
      "id": 1,
      "name": "ci-runner",
      "scopes": ["read", "write"],
      "workspace_id": "default",
      "expires_at": 1779441966,
      "created_at": 1776849966
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 50,
  "totalPages": 1
}
```

> `key_hash` is never included in the response.

#### DELETE /v1/api-keys/:id
Revoke an API key. Requires `admin` scope.

**Response:** `204 No Content`

### Audit Logs

#### GET /v1/audit-logs
Query audit logs. Requires `X-API-Key` header with `admin` scope. Rate-limited per key.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 50 | Items per page |

**Response:**
```json
{
  "items": [
    {
      "action": "create",
      "prompt_name": "welcome",
      "version_tag": "1.0.0",
      "api_key_name": "default",
      "ip_address": "::1",
      "timestamp": 1776849966
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 50,
  "totalPages": 1
}
```

## API Scopes

| Scope | Description |
|-------|-------------|
| `read` | GET endpoints |
| `write` | POST/PUT endpoints |
| `admin` | Audit logs and config |
