# Prompt File Format

Prompts are stored as individual JSON (or YAML) files. The filename is arbitrary — the `name` and `version` fields inside the file are what matter.

## JSON Schema

```json
{
  "name": "user-onboarding",
  "version": "1.2.0",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Welcome, {{name}}! Your account {{email}} has been created." }
  ],
  "variables": {
    "name": {
      "type": "string",
      "required": true
    },
    "email": {
      "type": "string",
      "required": true
    }
  },
  "model_config": {
    "model": "gpt-4o",
    "temperature": 0.7,
    "max_tokens": 500
  },
  "ollama": {
    "options": { "temperature": 0.8, "num_ctx": 4096, "seed": 42 },
    "keep_alive": "5m",
    "format": "json"
  },
  "tags": ["onboarding", "user"]
}
```

## Fields

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `name` | Yes | string | Unique identifier for the prompt. Used in API paths. |
| `version` | Yes | string | Semantic version (e.g., `1.0.0`). Used for git tags. |
| `messages` | Yes | array | Array of message objects. Each has `role`, `content`, and optional `name`. |
| `variables` | No | object | Map of variable names to their type and required flag. |
| `model_config` | No | object | Default LLM model settings when this prompt is used. |
| `ollama` | No | object | Ollama-specific settings: `options`, `keep_alive`, `format`. |
| `tags` | No | string[] | Arbitrary labels for filtering and organization. |

## Messages Format

Each message in the `messages` array follows the OpenAI Chat Completions format:

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `role` | Yes | string | One of: `system`, `user`, `assistant` |
| `content` | Yes | string | The message text. Supports `{{variable}}` substitution for `system` and `user` roles. |
| `name` | No | string | Optional name for function/tool responses. |

`assistant` role messages are **not** rendered — their content is returned as-is. This allows storing few-shot examples or assistant responses with literal placeholders.

## Variable Types

Each variable in the `variables` object supports these fields:

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `type` | Yes | string | One of: `string`, `number`, `boolean` |
| `required` | No | boolean | Whether the variable must be provided. Defaults to `false`. |

Example:

```json
{
  "variables": {
    "user_name": { "type": "string", "required": true },
    "tone": { "type": "string", "required": false },
    "max_items": { "type": "number", "required": false }
  }
}
```

## Message Rendering

Variables are substituted using Mustache-style `{{variable}}` syntax in `system` and `user` role messages. `assistant` role messages are left untouched.

- `GET /v1/prompts/welcome?variables[name]=Alice` renders `Hello Alice!` in the matching message
- Pass `render=false` to receive the raw messages without substitution.
- Missing required variables do **not** block rendering — the API returns the raw messages with unreplaced placeholders. Validation happens in your application code.

## Ollama Config

The `ollama` object is optional and used when your client calls an Ollama server instead of a cloud LLM API.

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `options` | No | object | Ollama generation options (temperature, num_ctx, seed, etc.). |
| `keep_alive` | No | string | Duration to keep the model loaded (e.g., `"5m"`, `"1h"`). |
| `format` | No | string / object | Response format: `"json"` or a JSON schema object for structured output. |

Example:

```json
{
  "ollama": {
    "options": { "temperature": 0.8, "num_ctx": 4096, "seed": 42 },
    "keep_alive": "5m",
    "format": "json"
  }
}
```

## Model Config

The `model_config` object is optional and purely advisory. PromptMetrics does not call LLM APIs — these settings are documentation for the client code that does.

```json
{
  "model_config": {
    "model": "gpt-4o",
    "temperature": 0.7,
    "max_tokens": 500,
    "top_p": 1.0,
    "frequency_penalty": 0.0,
    "presence_penalty": 0.0
  }
}
```

## YAML Equivalent

PromptMetrics accepts YAML files if your driver stores them as such. The schema is identical.

```yaml
name: user-onboarding
version: "1.2.0"
messages:
  - role: system
    content: "You are a helpful assistant."
  - role: user
    content: "Welcome, {{name}}!"
variables:
  name:
    type: string
    required: true
model_config:
  model: gpt-4o
  temperature: 0.7
tags:
  - onboarding
  - user
```

## Validation Rules

When creating a prompt via `POST /v1/prompts`, the API enforces:

- `name`: non-empty string, max 128 characters
- `version`: non-empty string, max 64 characters
- `messages`: non-empty array of objects with valid `role` and `content`
- `variables`: if provided, each key must have a valid `type`
- `tags`: if provided, must be an array of strings

Invalid prompts return `422 Unprocessable Entity` with details.

## File Storage Layout

### Filesystem Driver

```
prompts/
  welcome/
    1.0.0.json
    1.1.0.json
  farewell/
    1.0.0.json
```

### GitHub Driver

Same layout, but inside the configured repository. Versions are tracked as git tags:

```
prompts/welcome/1.0.0.json  -> tag: prompts/welcome/1.0.0
prompts/welcome/1.1.0.json  -> tag: prompts/welcome/1.1.0
```

## Versioning Strategy

- Use **semantic versioning** for clarity: `1.0.0`, `1.1.0`, `2.0.0`
- Breaking message changes bump the major version
- Additive variable changes (new optional variables) bump the minor version
- Bug fixes in message text bump the patch version

There is no enforced versioning scheme — any string is accepted, but semantic versioning is strongly recommended.
