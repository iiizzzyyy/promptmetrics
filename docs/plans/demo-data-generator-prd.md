# PRD: PromptMetrics Demo Data Generator

**Status**: Draft  
**Author**: Product Manager (Claude)  
**Last Updated**: 2026-04-30  
**Version**: 1.0  
**Stakeholders**: Engineering Lead, Design Lead, Developer Experience

---

## 1. Problem Statement

New users installing PromptMetrics for the first time see an empty dashboard with zero prompts, zero logs, zero traces, and flat charts. This makes it impossible to evaluate the product's value without first writing a custom script to populate the database. The "aha" moment of seeing rich time-series charts, trace trees, and evaluation trends is gated behind engineering effort.

**Evidence:**
- User research: (n=0, inferred) First-time open-source adopters abandon tools within 5 minutes if the initial UI is empty.
- Behavioral data: N/A — this is a pre-launch gap.
- Support signal: N/A — but "how do I see the dashboard with data?" is a predictable FAQ.
- Competitive signal: Most modern observability tools (Grafana, DataDog, Langfuse) ship with a one-click "generate demo data" button or CLI command.

---

## 1a. Scope Reduction (2026-04-30)

The original PRD described a rich CLI subcommand (`promptmetrics demo`) with scenario-based generation, Ollama integration, configurable scale/day flags, and multiple user personas. During implementation, the team shipped a simpler, pragmatic solution to unblock the v1.1.0 release:

- **What shipped**: A single TypeScript script at `src/scripts/seed-demo-data.ts` that inserts synthetic data directly into SQLite via the `DatabaseAdapter` interface. It seeds prompts (to the filesystem driver), logs, traces, spans, runs, and evaluations across a 90-day window. It supports `--force` to clear existing data and re-seed.
- **What was deferred**:
  - CLI subcommand (`promptmetrics demo`) — deferred to v1.2.0 or standalone package.
  - Scenario-based generation — replaced with a single fixed set of prompts and randomized data.
  - Ollama integration for real LLM calls — deferred; all data is synthetic.
  - Configurable `--scale`, `--days`, `--reset` flags — 90 days is hardcoded; only `--force` is supported.
  - Bulk demo-tagging for selective deletion — not implemented; `--force` uses `workspace_id = 'default'` to scope deletes.
- **Rationale**: The core pain point (empty dashboard on first install) is solved in <2 minutes by running `npx ts-node -r tsconfig-paths/register src/scripts/seed-demo-data.ts`. The deferred features can be added once the CLI architecture stabilizes and the Node SDK is complete.

---

## 2. Goals & Success Metrics

| Goal | Metric | Current Baseline | Target | Measurement Window |
|------|--------|-----------------|--------|--------------------|
| Reduce time-to-value | Minutes from `npm install` to seeing populated dashboard | ~30 min (manual scripting) | <2 min | First 100 users post-launch |
| Increase feature discovery | % of demo users who visit >3 dashboard pages | 0% (no demo exists) | >60% | First 30 days |
| Validate metrics API | Integration test coverage of metrics endpoints | 0% | >80% | CI pipeline |

---

## 3. Non-Goals

- **Not a load-testing tool.** Heavy stress testing (10K+ rows/sec) is out of scope; use a dedicated load test.
- **Not a migration or backup utility.** The generator is write-only; it does not read, export, or transform existing data.
- **Not a replacement for unit tests.** It exercises the API surface, but edge-case validation belongs in the test suite.
- **No mobile-specific scenarios.** v1 targets server-side AI apps only.
- **No multi-workspace segmentation in v1.** All demo data lands in the `default` workspace.

---

## 4. User Personas & Stories

**Primary Persona: Evaluating Developer**  
"Alex, a senior backend engineer at a mid-size SaaS company, is evaluating self-hosted prompt registries. They cloned the PromptMetrics repo, ran `npm install`, and started the server. They want to see if the dashboard is useful before integrating the SDK into their production app."

**Story 1**: As an evaluating developer, I want to populate my fresh PromptMetrics instance with realistic data so that I can see the dashboard in action without writing custom scripts.  
**Acceptance Criteria**:
- [ ] Given a fresh install with an empty DB, when I run `npx ts-node -r tsconfig-paths/register src/scripts/seed-demo-data.ts`, then the script completes in <60 seconds and prints a confirmation with entity counts.
- [ ] Given the demo has finished, when I open the dashboard at `http://localhost:3000`, then I see non-zero values in all summary cards, time-series charts with daily data, and a populated Recent Runs table.
- [ ] Given the demo has finished, when I navigate to `/logs`, `/traces`, `/runs`, `/evaluations`, and `/prompts`, then each page shows paginated demo data.

**Story 2**: As a developer re-testing the dashboard, I want to clear existing demo data and regenerate it so that I can iterate on UI changes without manual DB resets.  
**Acceptance Criteria**:
- [ ] Given the DB already contains demo data, when I run `npx ts-node -r tsconfig-paths/register src/scripts/seed-demo-data.ts --force`, then all workspace-scoped demo data is deleted and fresh data is generated.
- [ ] Given the DB contains non-demo production data in a different workspace, when I run with `--force`, then production data outside the `default` workspace is untouched.

---

## 5. Solution Overview

The demo data generator is a standalone TypeScript script at `src/scripts/seed-demo-data.ts`. It populates a fresh PromptMetrics instance with synthetic prompts, logs, traces, spans, runs, and evaluations across a 90-day window so that dashboards and charts immediately show realistic activity.

### Data Generated

The script creates a fixed set of 4 prompts (`customer-support`, `summarizer`, `code-reviewer`, `onboarding`) with multiple versions, then randomly generates the following entities:

| Entity | Count | Notes |
|--------|-------|-------|
| Prompts | 4 | Written to the filesystem driver (`./prompts/{name}/{version}.json`) and indexed in SQLite |
| Logs | ~1,000–2,000 | Distributed across 90 days; random tokens, latency, cost; ~30% linked to a workflow run via `run_id` |
| Traces | ~270 | 2–4 traces per day; each linked to a prompt version |
| Spans | ~810 | 2–4 spans per trace; 20% randomly marked `error` |
| Runs | ~540 | 4–10 per day; 70% `completed`, 15% `running`, 15% `failed` |
| Evaluations | 3 (`Accuracy`, `Relevance`, `Safety`) | Each tied to a random prompt/version |
| Evaluation Results | ~1,500 | 3–6 per day per evaluation; scores between 0.65–0.95 |
| API Keys | 1 | `pm_smoke_test_key` with `read,write` scopes |

**Key Design Decisions:**
- **Decision 1**: We chose a standalone script over a CLI subcommand to avoid coupling with the incomplete `promptmetrics` CLI and Node SDK. Trade-off: users must run it via `ts-node`, but it is immediately available and easy to refactor into a CLI later.
- **Decision 2**: All data is synthetic. No external LLM calls are made. Trade-off: token counts and latency are randomized, but the dashboard still looks realistic and the generator has zero external dependencies.
- **Decision 3**: Timestamps are distributed uniformly across the 90-day window with per-day random variation. Trade-off: no weekday/weekend skew, but charts still show natural variance.
- **Decision 4**: The script detects existing data in the last 90 days and skips by default to avoid duplicates. Use `--force` to clear workspace-scoped data and re-seed.

---

## 6. Technical Considerations

**Dependencies:**
- `better-sqlite3` (already a core dependency)
- `dotenv` (already a core dependency, used to read `.env` for `API_KEY_SALT`)

**Known Risks:**
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| SQLite write contention on large inserts | Low | Medium | Each seed function reuses a single prepared statement; force-mode deletes are wrapped in a transaction |
| `API_KEY_SALT` missing | Medium | Medium | Falls back to a hardcoded dev salt; warns in console |
| Clock skew causes future timestamps | Low | Low | Cap all timestamps at `Date.now() / 1000` |
| Duplicate data on re-run | Medium | Medium | Skip if >100 rows exist in last 90 days; `--force` required to overwrite |

**Open Questions** (resolved):
- [x] Should demo data be tagged with a `demo: true` metadata flag so it can be bulk-deleted later? — **Resolved**: No; deletion is scoped by `workspace_id = 'default'` and `--force` clears all entities in that workspace.
- [x] Should the generator reuse the existing Node SDK or make raw SQL calls? — **Resolved**: Makes raw SQL calls via the `DatabaseAdapter` interface; avoids coupling to the incomplete Node SDK.

---

## 7. Launch Plan

| Phase | Date | Audience | Success Gate |
|-------|------|----------|-------------|
| Internal alpha | 2026-04-30 | Core team | `ts-node src/scripts/seed-demo-data.ts` runs on fresh SQLite DB in <60s, dashboard shows data |
| Closed beta | 2026-05-02 | 5 design partners | Feedback on data realism and ease of re-seeding |
| GA (ships with v1.1.0) | 2026-05-05 | All users | Zero reported "empty dashboard" support tickets |

**Rollback Criteria:** If the script fails on >10% of fresh installs (detected via CI or user reports), revert to manual README instructions for populating data.

---

## 8. Appendix

### Script Usage Reference

```bash
# Quick start — synthetic data, 90 days
npx ts-node src/scripts/seed-demo-data.ts

# Wipe existing demo data and regenerate
npx ts-node src/scripts/seed-demo-data.ts --force
```

**Prerequisites:**
- SQLite DB initialized (`npm run db:init`)
- `API_KEY_SALT` set in `.env` (or a hardcoded dev salt will be used)

### Data Distribution (90-Day Window)

| Entity | Count | Time Distribution |
|--------|-------|-------------------|
| Prompts | 4 | Created at random times across the window |
| Logs | ~1,000–2,000 | 8–20 per day; uniform across window |
| Traces | ~270 | 2–4 per day |
| Spans | ~810 | 2–4 per trace; 20% `error` status |
| Runs | ~540 | 4–10 per day; 15% failed, 15% running |
| Evaluations | 3 | `Accuracy`, `Relevance`, `Safety` |
| Evaluation Results | ~1,500 | 3–6 per day per evaluation |
| API Keys | 1 | `pm_smoke_test_key` with `read,write` scopes |

### Script Architecture

The script is a single self-contained module:
1. Reads `.env` via `dotenv` to get `API_KEY_SALT`.
2. Connects to SQLite via the async `DatabaseAdapter` interface (`getDb()`).
3. Checks for existing data in the last 90 days; skips if >100 rows exist (unless `--force`).
4. In force mode, wraps `DELETE` statements in `db.transaction()` to clear workspace-scoped data atomically.
5. Seeds prompts to the filesystem driver (`./prompts/{name}/{version}.json`) and upserts into the `prompts` table.
6. Seeds logs, traces, spans, runs, evaluations, and evaluation results with randomized timestamps, tokens, latency, and scores.
7. Prints counts to console and exits cleanly with `db.close()`.

---
