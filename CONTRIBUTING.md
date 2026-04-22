# Contributing to PromptMetrics

Thank you for your interest in contributing to PromptMetrics. This document covers everything you need to know to get started, from setting up your development environment to opening a pull request.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Commit Messages](#commit-messages)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Reporting Issues](#reporting-issues)
- [Release Process](#release-process)

---

## Code of Conduct

Be respectful, constructive, and inclusive. Disagreement is healthy; personal attacks are not. We follow the [Contributor Covenant](https://www.contributor-covenant.org/) in spirit if not in letter.

---

## Getting Started

### Prerequisites

- **Node.js** >= 20.0.0
- **npm** >= 10.0.0
- **Git**
- **SQLite3** (usually bundled; only needed for some platforms)

### Fork and Clone

```bash
git clone https://github.com/your-username/promptmetrics.git
cd promptmetrics
```

### Install Dependencies

```bash
npm install
```

### Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

```
API_KEY_SALT=your-development-salt-here-change-in-production
```

### Initialize Database

```bash
npm run db:init
```

### Verify Setup

```bash
npm run build
npm test
```

All tests should pass before you make any changes.

---

## Development Workflow

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/my-feature
   ```
   Branch naming conventions:
   - `feature/description` — new features
   - `fix/description` — bug fixes
   - `docs/description` — documentation changes
   - `refactor/description` — code refactoring

2. **Make your changes.** Keep changes focused and atomic.

3. **Add or update tests** for any new behavior.

4. **Ensure the build passes:**
   ```bash
   npm run build
   npm run lint
   npm run test
   ```

5. **Commit** using the guidelines below.

6. **Push** and open a pull request.

---

## Code Style

We use automated tooling to enforce consistency. Run these before committing:

```bash
npm run lint       # Check for issues
npm run lint:fix   # Auto-fix where possible
npm run format     # Run Prettier
```

### TypeScript

- **Strict mode** is enabled. No `any` without a comment explaining why.
- Prefer `interface` over `type` for object shapes.
- Use `async/await` over raw Promises.
- Explicit return types on exported functions.

### Naming

- Files: `kebab-case.ts`
- Classes: `PascalCase`
- Functions and variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Environment variables: `UPPER_SNAKE_CASE`

### Error Handling

- Never swallow errors silently.
- Use typed errors where possible.
- Return proper HTTP status codes from controllers.
- Log unexpected errors with context.

---

## Testing

### Test Levels

| Command | Description |
|---------|-------------|
| `npm run test:unit` | Unit tests (isolated logic, mocks) |
| `npm run test:integration` | Integration tests (database, HTTP) |
| `npm run test:e2e` | End-to-end tests (full lifecycle) |
| `npm test` | All tests with coverage |

### Writing Tests

- Place unit tests in `tests/unit/`, integration tests in `tests/integration/`, and E2E tests in `tests/e2e/`.
- Use descriptive test names: `it('returns 404 when prompt does not exist', ...)`
- Mock external APIs (GitHub) using `nock`.
- Clean up database state between integration tests.

### Coverage

We aim for >80% coverage on new code. Coverage reports are generated in `coverage/`.

---

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body> (optional)

<footer> (optional)
```

Types:
- `feat` — new feature
- `fix` — bug fix
- `docs` — documentation only
- `style` — formatting, missing semicolons, etc.
- `refactor` — code change that neither fixes a bug nor adds a feature
- `test` — adding or correcting tests
- `chore` — build process, dependencies, etc.

Examples:
```
feat(api): add support for workflow runs
fix(driver): handle GitHub API rate limiting with exponential backoff
docs(readme): update environment variable table
test(integration): add e2e test for trace lifecycle
```

---

## Pull Request Guidelines

### Before Opening

- [ ] Branch is up to date with `main`
- [ ] Tests pass locally (`npm test`)
- [ ] Lint passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Changes are focused on a single concern

### PR Description

Include:
1. **What** changed and **why**
2. **How** to test the changes
3. Links to related issues (`Fixes #123`)

### Review Process

- A maintainer will review within 48 hours.
- Address feedback promptly; force-push only if requested.
- Squash commits if asked.

---

## Reporting Issues

### Bugs

Include:
- Node.js version (`node -v`)
- PromptMetrics version (`npm list promptmetrics`)
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs or error messages

### Feature Requests

Include:
- Use case description
- Proposed API or CLI interface
- Why existing features don't solve the problem

### Security Issues

See [SECURITY.md](SECURITY.md) for responsible disclosure.

---

## Release Process

Releases are cut by maintainers from `main`:

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Tag: `git tag -a v1.0.0 -m "Release v1.0.0"`
4. Push tags: `git push origin v1.0.0`
5. GitHub Actions publishes the npm package

---

## Questions?

Open a [discussion](https://github.com/your-username/promptmetrics/discussions) or [issue](https://github.com/your-username/promptmetrics/issues). We are happy to help.
