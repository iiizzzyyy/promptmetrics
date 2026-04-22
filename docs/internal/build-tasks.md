# PromptMetrics Build Tasks
## Multi-Phase Feature Expansion

**Date:** 2026-04-22
**Last Updated:** 2026-04-22
**Total Phases:** 6

---

## Legend
- `[ ]` = Not started
- `[~]` = In progress
- `[x]` = Complete

---

## Phase 1: Messages Array Refactor
> Replace `template` with OpenAI-style `messages` array throughout codebase

### Schema & Interfaces
- [x] Update `src/validation-schemas/promptmetrics-prompt.schema.ts` — replace `template` with `messages` array
- [x] Update `src/drivers/promptmetrics-driver.interface.ts` — `PromptFile` interface
- [x] Add/update `src/interfaces/` types for message format

### Controller
- [x] Rewrite `src/controllers/promptmetrics-prompt.controller.ts` — rendering logic for messages
- [x] Handle `render=true/false` with messages array

### SDK
- [x] Update `clients/node/src/index.ts` — `Prompt` interface

### Tests
- [x] Update `tests/unit/filesystem-driver.test.ts` — fixtures & assertions
- [x] Update `tests/unit/github-driver.test.ts` — fixtures & assertions
- [x] Update `tests/integration/prompts.test.ts` — assertions
- [x] Rewrite `tests/integration/rendering.test.ts` — messages rendering
- [x] Update `tests/integration/audit.test.ts` — fixtures
- [x] Update `tests/e2e/full-lifecycle.test.ts` — all prompt assertions

### Verification
- [x] `npm run build` passes
- [x] `npx eslint src/` passes
- [x] `npm test` all passing (65 tests, up from 64)
- [ ] Manual curl smoke test

### Documentation
- [x] Update `PROMPT_FORMAT.md`
- [x] Update `API.md`
- [x] Update `SDK.md`
- [x] Update `README.md`
- [x] Update `ARCHITECTURE.md`
- [x] Update `TEST_CASES.md`

---

## Phase 2: Ollama First-Class Support
> Add Ollama-specific fields to prompts and logs

### Schema
- [x] Update `src/validation-schemas/promptmetrics-prompt.schema.ts` — add `ollama` object
- [x] Update `src/validation-schemas/promptmetrics-log.schema.ts` — add ollama fields

### Controller
- [x] Update `src/controllers/promptmetrics-log.controller.ts` — handle new fields

### Database
- [x] Update `src/models/promptmetrics-sqlite.ts` — add columns to `logs` table
- [x] Add migration logic for existing databases

### Interface
- [x] Update `src/drivers/promptmetrics-driver.interface.ts` — add ollama fields

### Tests
- [x] Add Ollama fixtures to unit tests
- [x] Add Ollama log tests to integration tests
- [x] Add Ollama prompt creation to E2E tests

### Verification
- [x] `npm run build` passes
- [x] `npx eslint src/` passes
- [x] `npm test` all passing (69 tests)
- [ ] Manual curl smoke test with Ollama fields

### Documentation
- [x] Update `PROMPT_FORMAT.md`
- [x] Update `API.md`
- [x] Update `TEST_CASES.md`

---

## Phase 3: Agent Telemetry — Traces/Spans
> Add trace and span tracking for agent loops

### Database
- [x] Update `src/models/promptmetrics-sqlite.ts` — create `traces` and `spans` tables

### Schema
- [x] Create `src/validation-schemas/promptmetrics-trace.schema.ts`

### Controller
- [x] Create `src/controllers/promptmetrics-trace.controller.ts`

### Routes
- [x] Create `src/routes/promptmetrics-trace.route.ts`

### App
- [x] Update `src/app.ts` — mount trace routes

### Tests
- [x] Create `tests/unit/trace.test.ts`
- [x] Create `tests/integration/traces.test.ts`
- [x] Add trace CRUD to `tests/e2e/full-lifecycle.test.ts`

### Verification
- [x] `npm run build` passes
- [x] `npx eslint src/` passes
- [x] `npm test` all passing (92 tests)
- [ ] Manual curl smoke test of trace endpoints

### Documentation
- [x] Update `API.md`
- [x] Update `ARCHITECTURE.md`
- [x] Update `TEST_CASES.md`

---

## Phase 4: Workflow Runs
> Track end-to-end workflow/agent executions

### Database
- [x] Update `src/models/promptmetrics-sqlite.ts` — create `runs` table

### Schema
- [x] Create `src/validation-schemas/promptmetrics-run.schema.ts`

### Controller
- [x] Create `src/controllers/promptmetrics-run.controller.ts`

### Routes
- [x] Create `src/routes/promptmetrics-run.route.ts`

### App
- [x] Update `src/app.ts` — mount run routes

### Tests
- [x] Create `tests/unit/run.test.ts`
- [x] Create `tests/integration/runs.test.ts`
- [x] Add run CRUD to `tests/e2e/full-lifecycle.test.ts`

### Verification
- [x] `npm run build` passes
- [x] `npx eslint src/` passes
- [x] `npm test` all passing (112 tests)
- [ ] Manual curl smoke test of run endpoints

### Documentation
- [x] Update `API.md`
- [x] Update `ARCHITECTURE.md`
- [x] Update `TEST_CASES.md`

---

## Phase 5: Prompt Labels
> Tag prompt versions with environment labels

### Database
- [x] Update `src/models/promptmetrics-sqlite.ts` — create `prompt_labels` table

### Schema
- [x] Create `src/validation-schemas/promptmetrics-label.schema.ts`

### Controller
- [x] Create `src/controllers/promptmetrics-label.controller.ts`

### Routes
- [x] Create `src/routes/promptmetrics-label.route.ts`

### App
- [x] Update `src/app.ts` — mount label routes

### Tests
- [x] Create `tests/unit/label.test.ts`
- [x] Create `tests/integration/labels.test.ts`
- [x] Add label CRUD to `tests/e2e/full-lifecycle.test.ts`

### Verification
- [x] `npm run build` passes
- [x] `npx eslint src/` passes
- [x] `npm test` all passing (130 tests)
- [ ] Manual curl smoke test of label endpoints

### Documentation
- [x] Update `API.md`
- [x] Update `TEST_CASES.md`

---

## Phase 6: E2E Testing & Documentation
> Full integration testing and comprehensive documentation update

### Integration Testing
- [x] Run complete `npm test` — all phases together (130 tests)
- [x] Fix any cross-phase integration issues — none found
- [x] Run `npm run build` — verify production build
- [x] Run `npm run lint` — verify code quality

### End-to-End Manual Testing
- [x] Start server: `API_KEY_SALT=test node dist/server.js`
- [x] Generate API key
- [x] Create prompt with messages array + Ollama fields
- [x] Retrieve and render prompt
- [x] Create trace with spans
- [x] Create workflow run
- [x] Create prompt labels
- [x] Query audit logs
- [x] Verify graceful shutdown

### Documentation Update
- [x] Rewrite `README.md` with new features
- [x] Rewrite `API.md` with all new endpoints
- [x] Update `ARCHITECTURE.md` with telemetry flow
- [x] Rewrite `PROMPT_FORMAT.md` with messages format
- [x] Update `SDK.md` with new SDK methods
- [x] Update `CONFIGURATION.md` with new env vars
- [x] Update `TEST_CASES.md` with final results
- [x] Update `CLI.md` with new commands if any

### Final Verification
- [x] `npm run build` passes
- [x] `npm test` passes (all suites)
- [x] `npm run lint` passes
- [x] `npm audit` shows 0 vulnerabilities
- [x] `npm pack --dry-run` shows correct files
- [x] Git status clean (no uncommitted changes)

---

## Next Action
**Current Phase:** Phase 6 Complete — All 6 phases finished
**Status:** 130 tests passing, build clean, lint clean, 0 vulnerabilities
**Next Step:** Manual smoke testing of running server (optional)
**Blocked By:** None

---

## Notes
- Each phase builds on the previous; do not skip phases.
- Update this file after every task completion.
- If context is lost, refer to `CONTEXT.md` for project setup instructions.
