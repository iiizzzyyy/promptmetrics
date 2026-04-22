# PromptMetrics Pre-Launch Beta Checklist

Use this checklist to validate PromptMetrics is ready for open-source promotion.

## Automated Checks (CI)

- [x] **CI badge is green** — `.github/workflows/ci.yml` runs on push/PR with Node 20 and 22 matrix. Steps: install, build, lint, test, audit, CLI smoke test.
- [x] **Build passes** — `npm run build` produces zero TypeScript errors.
- [x] **Lint passes** — `npx eslint src/` reports zero errors.
- [x] **Tests pass** — `npm test` runs 145 tests across unit, integration, and E2E suites.
- [x] **Audit clean** — `npm audit` shows 0 vulnerabilities.

## Clean Clone / Fresh Machine

### Docker Compose (Recommended)

- [x] `docker compose up --build` works on a fresh clone.
- [x] Health check passes for the `promptmetrics` service.
- [x] Smoke-test container completes all 10 assertions (health, prompt, render, log, trace, span, run, update, label, get-label).

**Steps to verify:**

```bash
git clone <repo-url>
cd promptmetrics
docker compose up --build --abort-on-container-exit
```

Expected: `smoke-test-1 | All smoke tests passed.`

### npm Local Install (Alternative)

- [x] `npm install -g promptmetrics` works (tested via `npm pack` + `npm install <tgz>`).
- [x] `promptmetrics init` creates `promptmetrics.yaml`.
- [x] `promptmetrics create-prompt --file welcome.json` works after generating an API key.
- [x] `promptmetrics get-prompt <name> --var key=value` renders variables correctly.
- [x] `promptmetrics log --prompt-name <name> --version <v>` logs metadata.
- [x] `promptmetrics add-label <name> <label> --version <v>` tags versions.

**Steps to verify:**

```bash
# 1. Install
npm install -g promptmetrics

# 2. Start server
API_KEY_SALT=your-salt promptmetrics-server

# 3. Generate key (in another terminal)
node $(npm root -g)/promptmetrics/dist/scripts/generate-api-key.js default read,write

# 4. Configure CLI
promptmetrics init
# Edit promptmetrics.yaml with server URL and API key

# 5. Create a prompt
cat > welcome.json << 'EOF'
{
  "name": "welcome",
  "version": "1.0.0",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello {{name}}!" }
  ],
  "variables": { "name": { "type": "string", "required": true } }
}
EOF
promptmetrics create-prompt --file welcome.json

# 6. Fetch and render
promptmetrics get-prompt welcome --var name=Alice

# 7. Log metadata
promptmetrics log \
  --prompt-name welcome \
  --version 1.0.0 \
  --provider openai \
  --model gpt-4o \
  --tokens-in 10 \
  --tokens-out 20 \
  --latency-ms 500 \
  --cost-usd 0.001

# 8. Tag version
promptmetrics add-label welcome production --version 1.0.0
promptmetrics get-label welcome production
```

## README Quickstart Time

- [x] **README quickstart takes under 5 minutes** on a fresh machine.

**Dry run timing (local clone simulation in `/tmp/pm-beta-test`):**
| Step | Time |
|------|------|
| `npm install` | ~12s |
| `cp .env.example .env` | ~0s |
| `npm run build` | ~3s |
| `npm run db:init` | ~1s |
| `node dist/scripts/generate-api-key.js` | ~1s |
| Start server | ~2s |
| `promptmetrics init` | ~1s |
| `promptmetrics create-prompt` | ~1s |
| `promptmetrics get-prompt` + render | ~1s |
| `promptmetrics log` | ~1s |
| `promptmetrics create-trace` + `add-span` | ~2s |
| `promptmetrics create-run` + `update-run` | ~2s |
| `promptmetrics add-label` + `get-label` | ~2s |
| `npm test` | ~10s |
| **Total** | **~40s** |

**Friction found:**
1. **Missing `.env` file:** `.env` is gitignored but `API_KEY_SALT` is a required env var. Clean clones fail immediately on `npm run build`, `npm test`, and `generate-api-key.js` with `Missing required environment variable: API_KEY_SALT`.
   - **Fix:** Added `cp .env.example .env` to the README "From Source" quickstart.
2. **Missing DB initialization:** For repo clone (not `npm install -g`), the SQLite DB must be initialized before generating an API key.
   - **Fix:** README now includes `npm run db:init` before `generate-api-key.js`.
3. **Tests fail on clean clone:** `tests/setup.ts` imports `@models/promptmetrics-sqlite` which imports `@config/index` that requires `API_KEY_SALT`. Also, the SQLite schema isn't auto-created for tests.
   - **Fix:** Added `tests/env-setup.ts` that sets `process.env.API_KEY_SALT` BEFORE requiring the schema module, then calls `initSchema()`. Registered in `jest.config.js` as `setupFiles`.

## Human Beta Testing

- [ ] **A friend successfully runs the full beta test guide without help.**

**Instructions to give your friend:**
1. Open `BETA_TEST_GUIDE.md` — this is their test script.
2. Pick Path A (Docker Compose, recommended) or Path B (From Source).
3. Follow the setup steps, then execute every test case.
4. Fill in the Pass/Notes columns and the Wrap-Up section.
5. If anything is unclear, breaks, or surprising, file an issue with the test case number.

**Watch for:**
- Missing prerequisites (Docker, Node version)
- Confusing error messages
- Steps that require domain knowledge (e.g., "what is an API key salt?")
- Gaps between "install" and "working"
- Test cases that feel too hard or assume too much knowledge

**Test coverage:** The guide includes 50+ test cases across 13 areas: installation, auth, prompt CRUD, rendering, import/export, logging, traces/spans, runs, labels, audit logs, CLI config, error handling, and Ollama support.

## CLI Completeness

- [x] `init` creates `promptmetrics.yaml`.
- [x] `create-prompt` accepts JSON and YAML.
- [x] `get-prompt` supports `--version` and `--var`.
- [x] `list-prompts` supports pagination.
- [x] `import` bulk-imports from a directory.
- [x] `export` exports with `--limit`.
- [x] `log` logs metadata with all LLM fields.
- [x] `create-trace` / `get-trace` / `add-span` for telemetry.
- [x] `create-run` / `update-run` for workflow runs.
- [x] `add-label` / `get-label` for prompt versioning.
- [x] CLI reads `promptmetrics.yaml` for `--server` and `--api-key` defaults.

## Documentation

- [x] `README.md` quickstart uses CLI commands.
- [x] `CLI.md` documents all commands with examples.
- [x] `API.md` covers all endpoints.
- [x] `SDK.md` updated with new features.
- [x] `PROMPT_FORMAT.md` documents `messages` array and Ollama fields.

## Known Gaps / Wontfix for Launch

- Python SDK is conceptual only (community contribution welcome).
- No web UI (programmatic backend by design).
- No built-in cost estimation (SDK consumer provides their own).

## Verification

- [x] README quickstart works end-to-end on clean clone (source path)
- [x] Docker compose works on clean clone
- [x] All 145 tests pass after `npm install && npm test` on clean clone
- [x] No dev artifacts leaked into the clean clone
- [x] Total quickstart time under 5 minutes (~40s)

## Sign-off

| Person | Role | Date | Result |
|--------|------|------|--------|
| | | | |

When all boxes are checked and at least one external human has validated the quickstart without help, PromptMetrics is ready for promotion.
