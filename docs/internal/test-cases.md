# Test Cases & Results

Last run: 2026-04-22
Status: **130/130 passing**

## Unit Tests

| Suite | Test | Status |
|---|---|---|
| Config | loads default values | PASS |
| Config | parses integer values | PASS |
| Config | throws on missing required variable | PASS |
| SQLite | initializes schema | PASS |
| SQLite | inserts and retrieves prompts | PASS |
| SQLite | inserts and retrieves logs | PASS |
| FilesystemDriver | creates a prompt | PASS |
| FilesystemDriver | gets a prompt by name and version | PASS |
| FilesystemDriver | lists prompts | PASS |
| FilesystemDriver | lists versions | PASS |
| FilesystemDriver | searches prompts | PASS |
| FilesystemDriver | creates a prompt with ollama config | PASS |
| FilesystemDriver | handles missing prompt | PASS |
| FilesystemDriver | handles missing version | PASS |
| FilesystemDriver | deletes a prompt | PASS |
| Shutdown | registers cleanup jobs | PASS |
| GitHubDriver | throws if GITHUB_REPO or GITHUB_TOKEN is missing | PASS |
| GitHubDriver | creates prompt via GitHub API with retry on rate limit | PASS |
| GitHubDriver | retries on rate limit (429) | PASS |
| GitSyncJob | starts and stops | PASS |
| GitSyncJob | runs sync on interval | PASS |
| GitSyncJob | handles sync errors gracefully | PASS |
| GitSyncJob | does not start sync if not github driver | PASS |
| Rate Limiting | should not rate limit health endpoints | PASS |
| Rate Limiting | should return 429 after exceeding rate limit | PASS |
| TraceController | creates a trace with auto-generated trace_id | PASS |
| TraceController | creates a trace with provided trace_id | PASS |
| TraceController | returns 422 for invalid trace body | PASS |
| TraceController | gets a trace with its spans | PASS |
| TraceController | returns 404 for non-existent trace | PASS |
| TraceController | creates a span under a trace | PASS |
| TraceController | returns 404 when creating span for non-existent trace | PASS |
| TraceController | returns 422 for invalid span body | PASS |
| TraceController | gets a single span | PASS |
| TraceController | returns 404 for non-existent span | PASS |
| LabelController | creates a label | PASS |
| LabelController | returns 409 for duplicate label on same prompt | PASS |
| LabelController | returns 422 for invalid label body | PASS |
| LabelController | lists labels for a prompt | PASS |
| LabelController | gets a specific label | PASS |
| LabelController | returns 404 for non-existent label | PASS |
| LabelController | deletes a label | PASS |
| LabelController | returns 404 when deleting non-existent label | PASS |
| RunController | creates a run with auto-generated run_id | PASS |
| RunController | creates a run with provided run_id | PASS |
| RunController | returns 422 for invalid run body | PASS |
| RunController | returns 404 when trace_id does not exist | PASS |
| RunController | gets a run by id | PASS |
| RunController | returns 404 for non-existent run | PASS |
| RunController | updates run status and output | PASS |
| RunController | returns 404 when updating non-existent run | PASS |
| RunController | lists runs with pagination | PASS |

## Integration Tests

| Suite | Test | Status |
|---|---|---|
| Prompt API | GET /health returns 200 | PASS |
| Prompt API | GET /v1/prompts without API key returns 401 | PASS |
| Prompt API | POST /v1/prompts creates a prompt | PASS |
| Prompt API | GET /v1/prompts lists prompts | PASS |
| Prompt API | GET /v1/prompts/:name returns latest version | PASS |
| Prompt API | GET /v1/prompts/:name/versions lists versions | PASS |
| Prompt API | POST /v1/logs accepts metadata | PASS |
| Prompt API | POST /v1/prompts accepts ollama config | PASS |
| Prompt API | POST /v1/logs accepts ollama fields | PASS |
| Message Rendering | renders messages with variables from query string | PASS |
| Message Rendering | returns raw messages when render=false | PASS |
| Message Rendering | renders messages with variables from POST body | PASS |
| Audit Logging | creates audit log on prompt creation | PASS |
| Audit Logging | returns 403 for audit-logs without admin scope | PASS |
| Audit Logging | returns audit logs with admin scope | PASS |
| Trace API | POST /v1/traces creates a trace with auto trace_id | PASS |
| Trace API | POST /v1/traces creates a trace with provided trace_id | PASS |
| Trace API | GET /v1/traces/:trace_id returns trace with spans | PASS |
| Trace API | GET /v1/traces/:trace_id returns 404 for missing trace | PASS |
| Trace API | POST /v1/traces/:trace_id/spans creates a span | PASS |
| Trace API | POST /v1/traces/:trace_id/spans returns 404 for missing trace | PASS |
| Trace API | GET /v1/traces/:trace_id/spans/:span_id returns a single span | PASS |
| Trace API | POST /v1/traces rejects invalid metadata | PASS |
| Trace API | POST /v1/traces/:trace_id/spans rejects invalid status | PASS |
| Run API | POST /v1/runs creates a run with auto run_id | PASS |
| Run API | POST /v1/runs creates a run with provided run_id | PASS |
| Run API | POST /v1/runs returns 404 for non-existent trace_id | PASS |
| Run API | GET /v1/runs/:run_id returns a run | PASS |
| Run API | GET /v1/runs/:run_id returns 404 for missing run | PASS |
| Run API | PATCH /v1/runs/:run_id updates status and output | PASS |
| Run API | PATCH /v1/runs/:run_id returns 404 for missing run | PASS |
| Run API | GET /v1/runs lists runs with pagination | PASS |
| Run API | POST /v1/runs rejects invalid status | PASS |
| Run API | POST /v1/runs rejects missing workflow_name | PASS |
| Label API | POST /v1/prompts/:name/labels creates a label | PASS |
| Label API | POST /v1/prompts/:name/labels returns 409 for duplicate | PASS |
| Label API | GET /v1/prompts/:name/labels lists labels | PASS |
| Label API | GET /v1/prompts/:name/labels/:label_name returns a label | PASS |
| Label API | GET /v1/prompts/:name/labels/:label_name returns 404 for missing | PASS |
| Label API | DELETE /v1/prompts/:name/labels/:label_name deletes a label | PASS |
| Label API | DELETE /v1/prompts/:name/labels/:label_name returns 404 for missing | PASS |

## E2E Tests

| Suite | Test | Status |
|---|---|---|
| Health | GET /health returns ok | PASS |
| Health | GET /health/deep returns ok with checks | PASS |
| Authentication | rejects requests without API key | PASS |
| Authentication | rejects requests with invalid API key | PASS |
| Authentication | allows read scope to access GET endpoints | PASS |
| Authentication | rejects write endpoints for read-only key | PASS |
| Authentication | allows write endpoints for write key | PASS |
| Prompt CRUD | creates a prompt with all fields | PASS |
| Prompt CRUD | creates a second version of the same prompt | PASS |
| Prompt CRUD | lists all prompts with pagination | PASS |
| Prompt CRUD | searches prompts by name | PASS |
| Prompt CRUD | gets latest version by default | PASS |
| Prompt CRUD | gets specific version | PASS |
| Prompt CRUD | lists all versions | PASS |
| Prompt CRUD | returns 404 for non-existent prompt | PASS |
| Message Rendering | renders messages with query variables | PASS |
| Message Rendering | returns raw messages when render=false | PASS |
| Logging | accepts a log entry with all fields | PASS |
| Logging | accepts a log entry with minimal fields | PASS |
| Logging | accepts a log entry with ollama fields | PASS |
| Logging | rejects log with too many metadata keys | PASS |
| Logging | rejects log with invalid metadata value type | PASS |
| Audit Logs | returns audit logs for admin scope | PASS |
| Audit Logs | returns 403 for non-admin scope | PASS |
| Validation | rejects prompt without name | PASS |
| Validation | rejects prompt without version | PASS |
| Validation | rejects prompt without messages | PASS |
| Concurrent Writes | handles multiple prompt creations concurrently | PASS |
| Concurrent Writes | handles multiple log entries concurrently | PASS |
| Trace Telemetry | creates a trace and adds spans | PASS |
| Trace Telemetry | returns 404 for missing trace | PASS |
| Workflow Runs | creates a run and updates it | PASS |
| Workflow Runs | lists runs with pagination | PASS |
| Workflow Runs | returns 404 for missing run | PASS |
| Prompt Labels | creates, lists, gets, and deletes a label | PASS |
| Prompt Labels | returns 409 for duplicate label | PASS |
| Prompt Labels | returns 404 for missing label | PASS |

## Coverage Summary

| Metric | Value |
|---|---|
| Statements | 85.23% |
| Branches | 73.16% |
| Functions | 86.08% |
| Lines | 86.48% |

### Known Coverage Gaps
- `promptmetrics-shutdown.ts` (20.83%) — shutdown signal handlers are hard to unit test without process-level mocking
- `promptmetrics-github-driver.ts` (53.94%) — many paths require real GitHub API access or complex mocking
- `promptmetrics-logger.service.ts` (63.63%) — stdout JSON logging paths not fully exercised
- `promptmetrics-driver.factory.ts` (75%) — github branch only hit in integration tests with mocked env
