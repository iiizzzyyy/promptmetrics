# Issue Resolution Plan: Restore CLI `--json` Output Flag

**Date:** 2026-04-26  
**GitHub Issue:** [#23 -- CLI removed --json flag breaking programmatic use and integration tests](https://github.com/iiizzzyyy/promptmetrics/issues/23)  
**Status:** Proposed -- Awaiting Approval  
**Agents Consulted:** AI Engineer, Software Architect

---

## Executive Summary

The CLI no longer accepts a `--json` flag on any command, causing `error: unknown option '--json'` for all programmatic consumers. This breaks integration tests, CI pipelines, and shell scripts that parse structured output.

The root cause is that the current CLI implementation never registers `--json` as a valid option. Most commands already output JSON via `console.log(JSON.stringify(...))`, but `list-prompts` and `import` use `console.table()` unconditionally. Because `--json` is not registered, Commander throws before any command logic runs.

The fix is to add `--json` as a top-level/global CLI option and conditionally route output through a JSON formatter when the flag is present.

---

## Problem Analysis

### Current Behaviour

| Command | Current Output | `--json` Accepted? |
|---------|---------------|-------------------|
| `list-prompts` | `console.table()` | No (unknown option) |
| `import` | `console.table()` | No (unknown option) |
| `create-prompt` | `JSON.stringify()` | No (unknown option) |
| `get-prompt` | `JSON.stringify()` | No (unknown option) |
| `log` | `JSON.stringify()` | No (unknown option) |
| `create-trace` | `JSON.stringify()` | No (unknown option) |
| `get-trace` | `JSON.stringify()` | No (unknown option) |
| `add-span` | `JSON.stringify()` | No (unknown option) |
| `create-run` | `JSON.stringify()` | No (unknown option) |
| `update-run` | `JSON.stringify()` | No (unknown option) |
| `add-label` | `JSON.stringify()` | No (unknown option) |
| `get-label` | `JSON.stringify()` | No (unknown option) |
| `export` | plain string | No (unknown option) |
| `init` | plain string | No (unknown option) |

### Impact

- Integration tests that invoke the CLI and pipe output through `jq` fail immediately with exit code 1.
- CI pipelines using the CLI for health checks or data extraction are broken.
- Shell scripts that relied on `--json` for structured parsing need manual workarounds.

---

## Architectural Decision Records

### ADR-001: Add `--json` as a Top-Level Commander Option

**Status:** Proposed

**Context:** Commander.js supports global options via `program.option()`. These are available in `program.opts()` and can be read inside any command action. This is simpler than adding `--json` to every individual command definition.

**Decision:** Register `--json` once at the program level. Read it via `program.opts().json` inside command actions.

**Consequences:**
- **Easier:** One-line registration, no per-command boilerplate.
- **Harder:** The flag appears in help for all commands, even `init` which has no structured data to emit. This is acceptable -- `init` can simply ignore the flag.

**Trade-off accepted:** Slight help-text noise vs. maintaining `--json` on ~14 individual commands.

---

### ADR-002: Centralise Output Formatting in a `print()` Helper

**Status:** Proposed

**Context:** Two commands (`list-prompts`, `import`) use `console.table()`. All others already emit JSON. To keep behaviour consistent, we need a single helper that checks the `--json` flag and routes to the right formatter.

**Decision:** Create a `print(data: unknown)` function that:
- If `--json` is set -- `console.log(JSON.stringify(data, null, 2))`
- If `--json` is NOT set -- use `console.table()` for arrays, `console.log()` for plain objects/strings

**Consequences:**
- **Easier:** One place to change formatting logic. Future commands automatically get dual-format support.
- **Harder:** Slightly more indirection for readers of the CLI code.

**Trade-off accepted:** Consistency and maintainability vs. minimal indirection.

---

## Implementation Strategy

### Phase 1: Add Global `--json` Flag
**File:** `src/cli/promptmetrics-cli.ts`
- Add `.option('--json', 'Output as JSON')` to the program definition.

### Phase 2: Create Output Helper
**File:** `src/cli/promptmetrics-cli.ts`
- Add `function print(data: unknown): void` that reads `program.opts().json`.
- When `json` is true: `console.log(JSON.stringify(data, null, 2))`
- When `json` is false:
  - If `Array.isArray(data)`: `console.table(data)`
  - Else: `console.log(data)`

### Phase 3: Update Commands
**File:** `src/cli/promptmetrics-cli.ts`
- Replace `console.table(...)` calls in `list-prompts` and `import` with `print(...)`.
- For commands already using `console.log(JSON.stringify(...))`, keep the JSON output (which is the same as `--json`) but route through `print()` so the default path is consistent.
- For `export` and `init` (plain strings), wrap the string in an object when `--json` is set, or keep plain text otherwise.

### Phase 4: Add Tests
**File:** `tests/unit/cli.test.ts`
- Add test: `list-prompts --json outputs valid JSON`
- Add test: `list-prompts without --json outputs table`
- Add test: `import --json outputs valid JSON`
- Add test: `create-prompt --json` does not throw unknown option

### Phase 5: Regression Testing
- Run `npm test` (all suites)
- Run `npm run build` (TypeScript compilation)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `--json` flag conflicts with future per-command option | Low | Low | Global options in Commander do not conflict with command-specific options |
| `console.table()` output changes for non-JSON consumers | Low | Medium | Default path preserves `console.table()` for arrays; only `--json` changes output |
| Tests fail due to mocked `console.log`/`console.table` | Medium | Medium | Update mocks in `cli.test.ts` to handle the new `print()` helper |

---

## Success Metrics

- [ ] `promptmetrics list-prompts --json` outputs valid parseable JSON
- [ ] `promptmetrics list-prompts` outputs table format (no regression)
- [ ] `promptmetrics create-prompt --json --file welcome.json` does not throw "unknown option"
- [ ] All existing CLI unit tests pass
- [ ] `npm test` passes with exit code 0

---

## Files Affected

| File | Change Type |
|------|------------|
| `src/cli/promptmetrics-cli.ts` | Modify |
| `tests/unit/cli.test.ts` | Modify |

---

*Plan generated by AI Engineer & Software Architect agent analysis.*
