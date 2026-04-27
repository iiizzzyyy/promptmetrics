# PromptMetrics Architecture

## Overview

PromptMetrics uses a **hybrid storage model**: prompt content lives in Git (GitHub or local filesystem) while a **SQLite or PostgreSQL** database acts as the metadata index. This gives you versioned, auditable prompt storage with sub-millisecond reads.

## Why Hybrid?

- **Git gives you versioning for free** — every prompt change is a commit with full history, branching, and rollback.
- **SQLite gives you speed** — listing versions, searching by name, and filtering by tag would be painfully slow if every query hit the GitHub API.
- **The operator stays in control** — PromptMetrics is a registry, not a proxy. It serves prompts and collects logs, but LLM inference happens in your own code.

## System Diagram

```
+-------------+      +-----------------+      +------------------------+
|  API / CLI  |----->|   Express App   |----->|  SQLite / PostgreSQL   |
+-------------+      +-----------------+      |  - prompts index       |
       |                                        |  - api_keys            |
       |                                        |  - logs                |
       v                                        |  - audit_logs          |
+-------------+      +-----------------+      |  - traces              |
|   OTel      |      |  Storage Driver |----->|  - spans               |
|  (opt-in)   |      |  - filesystem   |      +------------------------+
+-------------+      |  - github       |----->|   Git / Files          |
                     +-----------------+      |  - content             |
                                              |  - history             |
                                              +------------------------+
```

## Storage Drivers

### Filesystem Driver

Best for local development and single-node deployments.

- Prompts stored as JSON files at `./prompts/{name}/{version}.json`
- The `prompts` table stores the filesystem path in the `commit_sha` column
- No background sync needed
- Instant writes, zero external dependencies

### GitHub Driver

Best for teams and production.

- Prompts stored as JSON files in a GitHub repository
- Each version is a git tag: `prompts/{name}/{version}`
- A **local bare clone** is maintained in the container/workspace
- Reads use `git show <ref>:<path>` — sub-millisecond latency
- Writes use the GitHub Contents API with exponential backoff retry (3 attempts)
- A background `git fetch` job runs every 60s (configurable) to keep the clone fresh

## Local Bare Clone Strategy

```
GitHub Repo                  Local Machine / Container
+-----------------+          +-------------------------+
| prompts/        |          | /tmp/promptmetrics-git/ |
|   welcome/      |  <-----  |   (bare clone)          |
|     v1.0.0.json |   fetch  |                         |
|     v1.1.0.json |          | Read: git show ref:path |
+-----------------+          +-------------------------+
         ^
         | Write: GitHub Contents API (PUT /repos/.../contents/...)
```

The clone is bare (no working tree) to save disk space. The `git show` command reads file content directly from the git object database without checking out files.

## Database Schema

| Table | Purpose |
|---|---|
| `prompts` | Maps `prompt_id` → `name`, `version_tag`, `commit_sha` (or `fs_path`), `driver`, `created_at`, `author` |
| `api_keys` | Stores `key_hash`, `name`, `scopes`, `workspace_id`, `expires_at`, `created_at`, `last_used_at` |
| `logs` | Stores metadata for each LLM request: model, tokens, latency, cost, custom tags |
| `audit_logs` | Records every prompt mutation: action, prompt name, version, API key used, IP, timestamp |
| `config` | Runtime key/value settings |
| `traces` | Tracks agent/request flows: `trace_id`, `prompt_name`, `version_tag`, `metadata_json`, `created_at` |
| `spans` | Tracks individual steps within a trace: `span_id`, `parent_id`, `name`, `status`, `start_time`, `end_time`, `metadata_json` |
| `runs` | Tracks end-to-end workflow executions: `run_id`, `workflow_name`, `status`, `input_json`, `output_json`, `trace_id`, `metadata_json`, `created_at`, `updated_at` |
| `prompt_labels` | Tags prompt versions with environment labels: `prompt_name`, `name`, `version_tag`, `created_at`. UNIQUE on (`prompt_name`, `name`) |
| `evaluations` | Tracks evaluation suites: `id`, `name`, `description`, `prompt_name`, `version_tag`, `criteria_json`, `workspace_id`, `created_at` |
| `evaluation_results` | Stores individual scores: `id`, `evaluation_id`, `run_id`, `score`, `metadata_json`, `workspace_id`, `created_at` |

**SQLite Mode:** When using SQLite, WAL (Write-Ahead Logging) enables concurrent readers and a single writer without locks blocking reads.

## Request Flow

### Fetch a Prompt

1. Client sends `GET /v1/prompts/welcome?variables[name]=Alice`
2. Auth middleware validates the API key and checks `read` scope
3. Audit middleware captures the request (non-blocking)
4. Controller asks the driver for the prompt
5. Driver looks up the latest version in the database, then reads content from git/filesystem
6. Controller renders messages by substituting `{{variables}}` in `system` and `user` role messages
7. Response returns JSON with rendered messages and version metadata

### Create a Prompt

1. Client sends `POST /v1/prompts` with JSON body
2. Auth middleware validates the API key and checks `write` scope
3. Controller validates the request body against the prompt schema
4. Driver writes the file (filesystem or GitHub API)
5. Driver inserts a row into the `prompts` table
6. Audit middleware logs the `create` action
7. Response returns `201 Created` with version metadata

### Log Metadata

1. Client sends `POST /v1/logs` after their LLM call completes
2. Auth middleware validates the API key
3. Controller validates metadata (max 50 top-level keys, length limits; nested objects and arrays allowed)
4. Row inserted into the `logs` table
5. Structured JSON written to stdout for log aggregation
6. If OTel is enabled, a span is emitted with the metadata as attributes

### Trace Telemetry

Traces and spans provide first-class support for tracking agent loops and multi-step request flows without requiring an external APM.

**Create a Trace:**
1. Client sends `POST /v1/traces` with optional `trace_id`, `prompt_name`, `version_tag`, and `metadata`
2. Auth middleware validates the API key and checks `write` scope
3. Controller validates the body (max 50 top-level metadata keys; nested objects and arrays allowed)
4. Row inserted into the `traces` table
5. Response returns `201 Created` with the `trace_id`

**Add a Span:**
1. Client sends `POST /v1/traces/:trace_id/spans` with `name`, `status` (`ok` or `error`), optional `start_time`/`end_time`, and `metadata`
2. Controller validates the body and verifies the trace exists
3. Row inserted into the `spans` table with a foreign key to `traces.trace_id`
4. Response returns `201 Created` with `trace_id` and `span_id`

**Retrieve a Trace:**
1. Client sends `GET /v1/traces/:trace_id`
2. Auth middleware validates the API key and checks `read` scope
3. Controller fetches the trace from the database and all associated spans ordered by `start_time`
4. Response returns the trace with its full span tree

This design keeps telemetry local to the registry, making it ideal for self-hosted deployments where operators want to correlate prompt usage with agent execution steps without setting up Jaeger or Zipkin.

### Workflow Runs

Workflow runs track end-to-end executions of agent workflows or pipelines, providing a higher-level view than individual traces.

**Create a Run:**
1. Client sends `POST /v1/runs` with `workflow_name`, optional `input`, `trace_id`, and `metadata`
2. Auth middleware validates the API key and checks `write` scope
3. Controller validates the body (max 50 top-level metadata keys; nested objects and arrays allowed)
4. If `trace_id` is provided, controller verifies it exists in the `traces` table
5. Row inserted into the `runs` table with `status = 'running'`
6. Response returns `201 Created` with `run_id`

**Update a Run:**
1. Client sends `PATCH /v1/runs/:run_id` with `status` and/or `output`
2. Controller performs a partial update, refreshing `updated_at` automatically
3. Response returns `200 OK`

**List Runs:**
1. Client sends `GET /v1/runs?page=1&limit=50`
2. Controller returns paginated runs ordered by `created_at DESC`
3. Each run includes parsed `input`, `output`, and `metadata` fields

Runs can optionally link to a trace via `trace_id`, allowing operators to drill down from a high-level workflow outcome to the individual steps that produced it.

### Prompt Labels

Prompt labels allow teams to tag prompt versions with environment or release names (e.g., `production`, `staging`, `v2-test`). This makes it easy to resolve a label to a specific version without hardcoding version tags in application code.

**Create a Label:**
1. Client sends `POST /v1/prompts/:name/labels` with `name` and `version_tag`
2. Auth middleware validates the API key and checks `write` scope
3. Controller validates the body (`name` max 128 chars, alphanumeric/underscore/dot/dash only)
4. Row inserted into the `prompt_labels` table
5. If a label with the same name already exists for this prompt, a `409 Conflict` is returned
6. Response returns `201 Created`

**Resolve a Label:**
1. Client sends `GET /v1/prompts/:name/labels/:label_name`
2. Controller looks up the label in the database
3. Response returns the label with its `version_tag`
4. The client can then fetch the actual prompt content using `GET /v1/prompts/:name?version=version_tag`

This two-step resolution keeps labels lightweight (just pointers) while leveraging the existing prompt retrieval infrastructure for content.

## Authentication

API keys are hashed with HMAC-SHA256 using a server-side salt (`API_KEY_SALT`). Only the hash is stored in the database. When a client sends an `X-API-Key` header, it is hashed and compared against the database. Scopes (`read`, `write`, `admin`) are enforced at the route level.

### Master API Keys

Keys with `workspace_id = '*'` act as master keys and can access any workspace. The auth middleware accepts any `X-Workspace-Id` header for these keys instead of requiring an exact match. This is useful for administration and cross-workspace tooling. Non-master keys are rejected if the `X-Workspace-Id` header does not match their assigned workspace.

### API Key Management Endpoints

The `POST /v1/api-keys`, `GET /v1/api-keys`, and `DELETE /v1/api-keys/:id` endpoints allow administrators to manage keys programmatically. All three require `admin` scope.

**Create a Key:**
1. Client sends `POST /v1/api-keys` with `name`, `scopes`, optional `workspace_id`, and optional `expires_in_days`
2. Controller validates the body and generates a random plaintext key
3. The key is hashed with HMAC-SHA256 and inserted into the `api_keys` table
4. The plaintext key is returned **once** in the response

**List Keys:**
1. Client sends `GET /v1/api-keys?page=1&limit=10`
2. Controller returns paginated keys ordered by `created_at DESC`
3. The `key_hash` field is never included in the response

**Revoke a Key:**
1. Client sends `DELETE /v1/api-keys/:id`
2. Controller deletes the row from `api_keys`
3. Response returns `204 No Content`

Admin keys can create keys for any workspace. Non-admin keys receive `403 Forbidden` on these endpoints.

## Graceful Shutdown

On `SIGTERM` or `SIGINT`:
1. HTTP server stops accepting new connections
2. OpenTelemetry SDK is shut down (flushes pending spans)
3. Git sync background job is stopped
4. Database connection is closed
5. Process exits cleanly

## Horizontal Scaling Considerations

PromptMetrics defaults to single-node deployment with SQLite. SQLite WAL mode handles concurrent reads and a single writer well. For multiple nodes or networked deployments, you can switch to PostgreSQL by setting `DATABASE_URL`. You would also need to replace the local bare clone with a shared git cache or object store (for example, the S3 driver).

## Evaluations

The evaluations system lets teams define quality checks for prompts and record scores over time.

**Create an Evaluation:**
1. Client sends `POST /v1/evaluations` with `name`, `prompt_name`, optional `version_tag`, `description`, and `criteria`
2. Auth middleware validates the API key and checks `write` scope
3. Controller validates the body via Joi schema
4. Row inserted into the `evaluations` table
5. Response returns `201 Created` with evaluation metadata

**Add a Result:**
1. Client sends `POST /v1/evaluations/:id/results` with `run_id`, `score`, and `metadata`
2. Controller validates the body and verifies the evaluation exists
3. Row inserted into the `evaluation_results` table with foreign key to `evaluations.id`
4. Response returns `201 Created`

**Delete an Evaluation:**
1. Client sends `DELETE /v1/evaluations/:id`
2. Controller performs a cascading delete: results are removed first, then the evaluation
3. Response returns `204 No Content`

## Additional Systems

### Redis Integration
When `REDIS_URL` is configured, PromptMetrics uses Redis for:
- **LRU Cache** — Prompt lookups are cached with TTL-based eviction
- **Rate Limiting** — Per-API-key sliding window counters with atomic increments via `MULTI/EXEC`

If Redis is unavailable, the system falls back to in-memory LRU cache and database-based rate limiting.

### PostgreSQL Backend
Set `DATABASE_URL` to use PostgreSQL instead of SQLite. The `DatabaseAdapter` interface abstracts database operations, with SQLite and PostgreSQL implementations. All SQL is compatible with both backends.

### S3 Storage Driver
Set `DRIVER=s3` to store prompt JSON as objects in S3 with keys like `prompts/{name}/{version}.json`. Supports custom endpoints for S3-compatible stores (MinIO, etc.).

### Multi-Tenancy
All tables include a `workspace_id` column. The `tenantMiddleware` reads the `X-Workspace-Id` header and attaches it to `req.workspaceId`. API keys are scoped to workspaces. If no header is provided, the `default` workspace is used.

### Circuit Breaker
GitHub API calls are wrapped in an Opossum circuit breaker with exponential backoff on 429 responses. This prevents cascading failures when GitHub's API is rate-limiting.

### Async Audit Log Queue
The `AuditLogService` batches audit entries in memory and flushes them to the database asynchronously via `setImmediate`. This keeps the request path fast while ensuring durable audit records.

## Security

- API keys are never stored in plain text
- All prompt mutations are audited (who, what, when, from which IP)
- GitHub tokens are never exposed to clients
- Metadata values are validated for length and type to prevent log injection
- No user input is executed as code (no `eval`, no dynamic requires)
- Prompt names are sanitized to prevent path traversal
- SQL identifiers are whitelisted before interpolation
