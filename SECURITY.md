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

### Environment
- Never commit `.env` files. Use `.env.example` as a template.
- Run PromptMetrics behind a reverse proxy (nginx, traefik, etc.) in production.
- Use HTTPS for all external traffic.

### Rate Limiting
- PromptMetrics includes `express-rate-limit` (100 requests/minute by default).
- Health endpoints (`/health`, `/health/deep`) are exempt from rate limiting.
- Adjust the limit via environment-specific proxy rules if needed.

### GitHub Token
- Use a GitHub App installation token instead of a PAT for production.
- Scope the token to the minimum required permissions (Contents: Read & Write).
- Rotate tokens regularly.

### SQLite
- SQLite is suitable for single-node deployments.
- For horizontal scaling, migrate to PostgreSQL.
- Back up the database file regularly.

## Disclosure Timeline

- **Day 0:** Vulnerability reported.
- **Day 7:** Acknowledgment and initial assessment.
- **Day 30:** Fix released (sooner for critical issues).
- **Day 45:** Public disclosure with CVE if applicable.
