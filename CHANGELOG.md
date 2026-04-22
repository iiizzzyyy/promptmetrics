# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-04-22

### Added

- Prompt registry with REST API and CLI for storing, versioning, and retrieving prompts.
- Filesystem and GitHub storage drivers for prompt content.
- Variable rendering with Mustache-style `{{variable}}` substitution.
- Metadata logging for LLM calls (model, tokens, latency, cost, custom tags).
- Agent telemetry with traces and spans for tracking agent loops.
- Workflow runs with input/output tracking and status updates.
- Prompt version labels for environment tagging (production, staging, etc.).
- SQLite metadata index with WAL mode.
- API key authentication with hashed HMAC-SHA256 and scoped permissions (read, write, admin).
- Audit logging for all write operations.
- OpenTelemetry OTLP export support.
- CLI with global `--server` and `--api-key` flags and `promptmetrics.yaml` config.
- Docker Compose setup with health checks and smoke tests.
- Node.js SDK client.

### Security

- API keys are hashed with HMAC-SHA256 before storage.
- Rate limiting enabled on all endpoints.
- Input validation with Joi schemas on all routes.

## [0.9.0-beta] - 2026-04-20

### Added

- Initial beta release for human validation.
- 50+ test cases across 13 capability areas.

### Fixed

- CLI error handling for HTTP 4xx/5xx responses.
- Invalid JSON body now returns 400 instead of 500.
- Label upsert behavior (update existing labels instead of rejecting duplicates).
- Required variable validation on explicit `?render=true`.
- Docker signal forwarding for graceful shutdown.
- Audit log action naming consistency.
