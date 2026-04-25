# PromptMetrics API Reference

Base URL: `http://localhost:3000`

Authentication: All endpoints except `/health` require `X-API-Key` header.

## Endpoints

### Health

#### GET /health
Shallow health check.

**Response:**
```json
{ "status": "ok" }
```

#### GET /health/deep
Deep health check including SQLite and driver status.

**Response:**
```json
{
  "status": "ok",
  "checks": {
    "sqlite": "ok",
    "driver": "ok"
  }
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
- `metadata`: max 50 keys
- Key length: max 128 chars
- Value length: max 1024 chars
- Supported value types: string, number, boolean
- `ollama_options`: free-form object (passed through to Ollama)
- `ollama_keep_alive`: string, max 16 chars
- `ollama_format`: string or object

**Response:** `202 Accepted`
```json
{ "id": 1, "status": "accepted" }
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
- `metadata`: max 50 keys, string/number/boolean values only.

**Response:** `201 Created`
```json
{
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "prompt_name": "welcome",
  "version_tag": "1.0.0",
  "status": "created"
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
- `metadata`: max 50 keys, string/number/boolean values only.

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
- `metadata`: max 50 keys, string/number/boolean values only.

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

### Audit Logs

#### GET /v1/audit-logs
Query audit logs. Requires `admin` scope.

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
