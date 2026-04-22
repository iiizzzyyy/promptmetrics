# Prompt File Format

Prompts are stored as individual JSON (or YAML) files. The filename is arbitrary — the `name` and `version` fields inside the file are what matter.

## JSON Schema

```json
{
  "name": "user-onboarding",
  "version": "1.2.0",
  "template": "Welcome, {{name}}! Your account {{email}} has been created.",
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
  "tags": ["onboarding", "user"]
}
```

## Fields

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `name` | Yes | string | Unique identifier for the prompt. Used in API paths. |
| `version` | Yes | string | Semantic version (e.g., `1.0.0`). Used for git tags. |
| `template` | Yes | string | The prompt text. Supports `{{variable}}` substitution. |
| `variables` | No | object | Map of variable names to their type and required flag. |
| `model_config` | No | object | Default LLM model settings when this prompt is used. |
| `tags` | No | string[] | Arbitrary labels for filtering and organization. |

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

## Template Rendering

Variables are substituted using Mustache-style `{{variable}}` syntax.

- `GET /v1/prompts/welcome?variables[name]=Alice` renders `Hello Alice!`
- Pass `render=false` to receive the raw template without substitution.
- Missing required variables do **not** block rendering — the API returns the raw template with unreplaced placeholders. Validation happens in your application code.

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
template: "Welcome, {{name}}!"
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
- `template`: non-empty string
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
- Breaking template changes bump the major version
- Additive variable changes (new optional variables) bump the minor version
- Bug fixes in template text bump the patch version

There is no enforced versioning scheme — any string is accepted, but semantic versioning is strongly recommended.
