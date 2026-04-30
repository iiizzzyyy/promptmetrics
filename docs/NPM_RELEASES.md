# NPM Release Tracker

This document tracks all published versions of the `promptmetrics` package on [npm](https://www.npmjs.com/package/promptmetrics).

---

## Release Checklist Template

Before every publish, verify:

- [ ] `package.json` version bumped (semver)
- [ ] `CHANGELOG.md` updated with release date
- [ ] `docs/openapi.yaml` version bumped
- [ ] All tests pass (`npm test`)
- [ ] TypeScript builds cleanly (`npm run build`)
- [ ] Docker smoke tests pass (`docker compose up --build`)
- [ ] `files` array in `package.json` includes any new runtime directories
- [ ] README screenshots/examples are current (if changed)
- [ ] `npm publish --dry-run` inspected for unexpected omissions

---

## Published Versions

### 1.0.2 — 2026-04-25

**Status:** Published
**Git Tag:** `v1.0.2`
**Changes:**

#### Changed
- Update README for v1.0.1 release — expanded feature list, added Python SDK section, fixed duplicate env vars, updated architecture diagram, added evaluations and dashboard context.
- Add release blog post at `docs/blog/v1.0.1-release.md`.

**Publish Command:**
```bash
npm run build
npm publish
```

---

### 1.0.1 — 2026-04-25

**Status:** Ready to publish  
**Git Tag:** (pending `git tag v1.0.1`)  
**Changes:**

#### Security
- Fix path traversal in `FilesystemDriver` and `GithubDriver` (`validateName()`)
- Fix missing input validation in `EvaluationController` (Joi schemas)
- Fix race condition in SQLite rate limiter (atomic `db.transaction()`)
- Fix webhook secret fallback to `GITHUB_TOKEN` (now fails closed)
- Fix sensitive data logged to stdout (removed `console.log` in `LogController`)
- Fix SQL injection in migration storage (regex whitelist for identifiers)

#### Added
- Evaluation Framework (`POST /v1/evaluations`, results, cascading delete)
- Python SDK (`clients/python/`)
- Web UI Dashboard (`ui/` — Next.js)
- GitHub Webhook Support (`POST /webhooks/github`)
- Redis Integration (LRU cache + rate limiting)
- PostgreSQL Backend (`DatabaseAdapter` interface)
- S3-Compatible Storage Driver
- Multi-Tenancy (`X-Workspace-Id` header)
- Circuit Breaker for GitHub API (Opossum)
- Per-API-Key Rate Limiting (sliding window)
- API Key Expiration (`expires_at` column)
- OpenAPI Documentation (`/docs` Swagger UI)
- LRU Cache for prompt lookups
- Database Transactions (`withTransaction()`)
- Migration System (`umzug` + TypeScript migrations with dialect-conditional DDL)
- Async Audit Log Queue (`AuditLogService`)

#### Changed
- `DRIVER` env var now supports `filesystem`, `github`, or `s3`
- `EvaluationController` standardized on throwing `AppError`
- `express@5.2.1` handles async errors natively

**Publish Command:**
```bash
npm run build
npm publish
```

---

### 1.0.0 — 2026-04-22

**Status:** Published  
**Git Tag:** `v1.0.0`  
**Initial stable release.**

#### Added
- Prompt registry with REST API and CLI
- Filesystem and GitHub storage drivers
- Variable rendering with Mustache-style substitution
- Metadata logging for LLM calls
- Agent telemetry with traces and spans
- Workflow runs with input/output tracking
- Prompt version labels
- SQLite metadata index with WAL mode
- API key authentication (HMAC-SHA256)
- Audit logging for all write operations
- OpenTelemetry OTLP export support
- CLI with global `--server` and `--api-key` flags
- Docker Compose setup with health checks
- Node.js SDK client

---

### 1.1.0 — 2026-04-30

**Status:** Ready to publish
**Git Tag:** `v1.1.0`
**Changes:**

#### Added

- **A/B Testing Engine** — Define A/B tests comparing two prompt versions, run both variants through the LLM provider registry, collect performance metrics, and promote the winning version.
- **Dataset Management** — Create and manage test datasets (collections of input/expected pairs) used by evaluation runs. Datasets are stored with workspace scoping.
- **Evaluation Runs** — Execute evaluation suites against datasets. `EvalRunService` orchestrates running evaluation criteria over dataset items, tracks completion status, error rates, and scores. Integrated with `BudgetService` for cost tracking.
- **Compliance Engine** — Built-in rule engine that scans prompt content for PII (email, SSN, phone, credit card), API keys (via Shannon entropy), URLs, and IP addresses. Uses regex patterns and Luhn validation. Produces a 0–100 risk score with severity-weighted deductions. Results stored in `compliance_scores` table.
- **Playground Proxy** — Direct LLM proxy that routes chat/completion requests through registered provider adapters (OpenAI, Anthropic, Cohere, Ollama, Azure OpenAI). Supports streaming responses. Provider registry uses lazy-loaded dynamic imports.
- **Observability Dashboard** — Next.js UI with pages for prompts, logs, traces, runs, labels, evaluations, A/B tests, datasets, compliance, playground, and settings. Includes time-series charts, token usage, prompt metrics, and evaluation trends.
- **Budget Service** — Tracks evaluation run costs against configurable budgets to prevent overspend.
- **Metrics Dashboard** — Query-time aggregation for time-series metrics (daily request counts, tokens, latency, error rates), per-prompt usage metrics, evaluation score trends, and activity summaries.
- **LLM Provider Registry** — Lazy-loaded adapter pattern for multiple LLM providers. Adapters are instantiated on first use via dynamic `import()`.
- **New migrations** for A/B testing (`011`), datasets and eval runs (`012`), compliance (`013`), log run IDs (`014`), A/B test promotion (`015`), cascade deletes (`016`), and cascade eval runs (`017`).
- **ON DELETE CASCADE** for foreign key relationships.
- **`safeJsonParse`** utility for robust JSON parsing.
- **`parseIdParam`** helper for route parameter validation.

#### Changed

- Provider registry uses dynamic `import()` instead of `require()` for lazy loading.
- CI workflow: PostgreSQL schema reset between test runs for idempotency.
- CI workflow: npm audit threshold raised to high (moderate vulnerabilities in umzug transitive deps).
- Migration 005 made idempotent for PostgreSQL via DO EXCEPTION blocks.

#### Fixed

- ESLint `no-undef` errors for DOM globals in Node.js context (used `globalThis.*` prefix).
- ESLint `no-require-imports` in provider registry (converted to dynamic imports).
- Regex escape sequence in compliance engine URL pattern.
- `NodeJS.ErrnoException` type annotation in GitHub driver.

**Publish Command:**
```bash
npm run build
npm publish
```

---

### 1.2.0 (Tentative)

- [ ] Driver singleton bug fix (pass driver instance from `server.ts` into `createApp()`)
- [ ] Request ID middleware (`X-Request-Id`)
- [ ] Compression middleware
- [ ] Centralized `AppError` class + global error handler
- [ ] Service layer extraction (PromptService, LogService, etc.)
- [ ] Standardized pagination helper
- [ ] Query parameter validation middleware

---

## How to Publish

1. Ensure you are logged in to npm:
   ```bash
   npm whoami
   ```

2. Run the release checklist above.

3. Create a git tag:
   ```bash
   git tag v$(node -p "require('./package.json').version")
   git push origin --tags
   ```

4. Publish:
   ```bash
   npm publish
   ```

5. Verify on npm:
   ```bash
   npm view promptmetrics versions --json
   ```

---

## Files Included in Package

The `files` array in `package.json` controls what gets published:

| Path | Purpose |
|------|---------|
| `dist/` | Compiled TypeScript output |
| `migrations/` | TypeScript migration files with dialect-conditional DDL for `umzug` |
| `docs/` | OpenAPI spec for Swagger UI at `/docs` |
| `clients/node/` | Node.js SDK source |
| `README.md` | Package landing page on npm |
| `LICENSE` | MIT license |
| `CHANGELOG.md` | Release history |
| `SECURITY.md` | Security policy and disclosure timeline |

**Note:** `ui/` (Next.js dashboard) and `clients/python/` are **not** included in the npm package. They are separate projects with their own release cycles.
