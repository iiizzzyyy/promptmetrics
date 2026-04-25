# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in PromptMetrics, please report it responsibly:

1. **Do not** open a public issue.
2. Email security concerns to the maintainers directly.
3. Allow reasonable time for a fix before disclosure.

## Security Best Practices

### API Key Storage
- API keys are hashed with HMAC-SHA256 using `API_KEY_SALT`.
- Only the hash is stored in SQLite. If you lose a key, generate a new one.
- Set `API_KEY_SALT` to a long random string (32+ characters) in production.
- Configure `expires_at` on API keys to enforce rotation.

### Environment
- Never commit `.env` files. Use `.env.example` as a template.
- Run PromptMetrics behind a reverse proxy (nginx, traefik, etc.) in production.
- Use HTTPS for all external traffic.
- Do not rely on `GITHUB_TOKEN` as a fallback for webhook secret verification. Always set `GITHUB_WEBHOOK_SECRET` explicitly.

### Rate Limiting
- PromptMetrics includes per-API-key sliding window rate limiting (100 requests/minute by default).
- Health endpoints (`/health`, `/health/deep`) are exempt from rate limiting.
- When `REDIS_URL` is configured, rate limits are backed by Redis with atomic increments.
- Adjust the limit via environment-specific proxy rules if needed.

### Input Validation
- All request payloads are validated with Joi schemas before reaching the service layer.
- Prompt names are sanitized to prevent path traversal (`../`, path separators).
- SQL identifiers (table names, column names) are whitelisted against `/^[a-z_][a-z0-9_]*$/i`.

### GitHub Token
- Use a GitHub App installation token instead of a PAT for production.
- Scope the token to the minimum required permissions (Contents: Read & Write).
- Rotate tokens regularly.
- Webhook handlers fail closed (return 500) if `GITHUB_WEBHOOK_SECRET` is not configured.

### SQLite
- SQLite is suitable for single-node deployments.
- For horizontal scaling, migrate to PostgreSQL via `DATABASE_URL`.
- Back up the database file regularly.

## Fixed Vulnerabilities (1.0.1)

The following issues were identified and fixed in the 1.0.1 release:

| Issue | Fix |
|-------|-----|
| Path traversal in `FilesystemDriver` and `GithubDriver` | `validateName()` rejects names containing `..` or path separators and checks resolved paths stay within the base directory. |
| Missing input validation in `EvaluationController` | Joi schemas validate all evaluation and result creation payloads. |
| Race condition in SQLite rate limiter | Read-and-update logic wrapped in `db.transaction()` for atomicity. |
| Webhook secret fallback to `GITHUB_TOKEN` | Removed fallback; handler fails closed if `GITHUB_WEBHOOK_SECRET` is missing. |
| Sensitive data logged to stdout | Removed `console.log(JSON.stringify(...))` in `LogController` that leaked LLM metadata. |
| SQL injection in migration storage | `tableName` and `columnName` validated against strict regex whitelist before interpolation. |

## Disclosure Timeline

- **Day 0:** Vulnerability reported.
- **Day 7:** Acknowledgment and initial assessment.
- **Day 30:** Fix released (sooner for critical issues).
- **Day 45:** Public disclosure with CVE if applicable.
