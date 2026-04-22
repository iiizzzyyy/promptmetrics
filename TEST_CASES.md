# Test Cases & Results

Last run: 2026-04-22
Status: **64/64 passing**

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
| Template Rendering | renders template with variables from query string | PASS |
| Template Rendering | returns raw template when render=false | PASS |
| Template Rendering | renders template with variables from POST body | PASS |
| Audit Logging | creates audit log on prompt creation | PASS |
| Audit Logging | returns 403 for audit-logs without admin scope | PASS |
| Audit Logging | returns audit logs with admin scope | PASS |

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
| Template Rendering | renders template with query variables | PASS |
| Template Rendering | returns raw template when render=false | PASS |
| Logging | accepts a log entry with all fields | PASS |
| Logging | accepts a log entry with minimal fields | PASS |
| Logging | rejects log with too many metadata keys | PASS |
| Logging | rejects log with invalid metadata value type | PASS |
| Audit Logs | returns audit logs for admin scope | PASS |
| Audit Logs | returns 403 for non-admin scope | PASS |
| Validation | rejects prompt without name | PASS |
| Validation | rejects prompt without version | PASS |
| Validation | rejects prompt without template | PASS |
| Concurrent Writes | handles multiple prompt creations concurrently | PASS |
| Concurrent Writes | handles multiple log entries concurrently | PASS |

## Coverage Summary

| Metric | Value |
|---|---|
| Statements | 81.85% |
| Branches | 66.9% |
| Functions | 80.51% |
| Lines | 84.09% |

### Known Coverage Gaps
- `promptmetrics-shutdown.ts` (20.83%) — shutdown signal handlers are hard to unit test without process-level mocking
- `promptmetrics-github-driver.ts` (53.94%) — many paths require real GitHub API access or complex mocking
- `promptmetrics-logger.service.ts` (63.63%) — stdout JSON logging paths not fully exercised
- `promptmetrics-driver.factory.ts` (75%) — github branch only hit in integration tests with mocked env
