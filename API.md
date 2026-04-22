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
    "template": "Hello Alice!",
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
  "template": "Hello {{name}}!",
  "variables": {
    "name": { "type": "string", "required": true }
  },
  "model_config": {
    "model": "gpt-4o",
    "temperature": 0.7
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

**Response:** `202 Accepted`
```json
{ "id": 1, "status": "accepted" }
```

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
