# Open Issues Resolution Plan

**Repository**: iiizzzyyy/promptmetrics  
**Date**: 2026-04-28  
**Issues**: #64, #65  
**Version**: 1.0.12  
**Status**: Proposed

---

## Executive Summary

Two PostgreSQL-specific production bugs have been identified in promptmetrics v1.0.12:

1. **Issue #64**: `spans.start_time` and `spans.end_time` columns use `INTEGER` which overflows with millisecond timestamps on PostgreSQL.
2. **Issue #65**: `COUNT(*)` queries return JavaScript strings on PostgreSQL (via `node-postgres` bigint handling), breaking pagination `total` fields across all list endpoints.

Both issues share the same root cause class: **SQLite/PostgreSQL dialect differences not fully abstracted**. Issue #31 previously fixed the same overflow for `rate_limits.window_start`; these two issues are the remaining gaps.

This plan provides a unified, minimal-delta resolution that leverages existing patterns (`dialect-helpers.ts`) to fix both issues without introducing new bugs.

---

## Issue #64: PostgreSQL INTEGER Overflow on spans.start_time / spans.end_time

### Architectural Analysis (Software Architect Perspective)

**Root Cause**: The initial schema migration (`001_initial_schema.ts`) declares `start_time INTEGER` and `end_time INTEGER`. PostgreSQL's `INTEGER` is a signed 32-bit type with max value `2,147,483,647`. Millisecond timestamps such as `1777359830616` exceed this by ~800x, causing insert failures.

**Why SQLite is unaffected**: SQLite's `INTEGER` is a 64-bit type (up to `9,223,372,036,854,775,807`), so it silently handles millisecond timestamps.

**Trade-off Analysis**:

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| A. Change `INTEGER` → `BIGINT` unconditionally | Simple, works for both DBs | Incompatible with SQLite (SQLite has no `BIGINT` keyword; `INTEGER` is already 64-bit) | Rejected |
| B. Dialect-conditional DDL (`postgres ? BIGINT : INTEGER`) | Matches existing pattern from #31; zero risk to SQLite | Adds one helper function | **Accepted** |
| C. Store timestamps as seconds instead of ms | Reduces value magnitude | Breaking change to API contract; requires migration of existing data | Rejected |

**Decision**: Use Approach B, consistent with the existing `windowStartColumn` helper in `dialect-helpers.ts`.

### Implementation Details

1. **Add helper** `timestampColumn(dialect)` in `migrations/dialect-helpers.ts`:
   ```typescript
   export function timestampColumn(dialect: 'sqlite' | 'postgres'): string {
     return dialect === 'postgres' ? 'BIGINT' : 'INTEGER';
   }
   ```

2. **Update initial schema** `migrations/001_initial_schema.ts`:
   - Import `timestampColumn`
   - Change `start_time INTEGER` → `start_time ${timestampColumn(d)}`
   - Change `end_time INTEGER` → `end_time ${timestampColumn(d)}`

3. **Add dedicated migration** `migrations/009_alter_spans_time_columns.ts`:
   - For PostgreSQL: `ALTER TABLE spans ALTER COLUMN start_time TYPE BIGINT`
   - For PostgreSQL: `ALTER TABLE spans ALTER COLUMN end_time TYPE BIGINT`
   - For SQLite: no-op (already 64-bit INTEGER)

4. **No service-layer changes required**: `TraceService.createSpan()` already passes `start_time` and `end_time` as numbers; the type is preserved through the adapter layer.

---

## Issue #65: PostgreSQL COUNT(*) Returns String, Breaking Pagination

### Architectural Analysis (Software Architect Perspective)

**Root Cause**: `node-postgres` returns PostgreSQL `bigint` values as JavaScript strings to avoid precision loss. SQLite returns `number` natively. The codebase casts `COUNT(*)` results directly as `{ c: number }` and accesses `.c`, which yields a string on PostgreSQL. This string is then passed to `buildPaginatedResponse()`, which expects `number` for `total` and `totalPages` calculations. While `Math.ceil("5" / 10)` happens to work via JavaScript coercion, the JSON response contains `"total": "5"` instead of `"total": 5`, breaking API contracts and client-side TypeScript assumptions.

**Scope**: All paginated list endpoints and internal count queries.

**Affected Files**:
- `src/services/prompt.service.ts` (2 count queries: `listPrompts`, `listVersions`)
- `src/services/trace.service.ts` (1 count query: `listTraces`)
- `src/services/evaluation.service.ts` (2 count queries: `listEvaluations`, `listEvaluationResults`)
- `src/services/log.service.ts` (1 count query: `listLogs`)
- `src/services/run.service.ts` (1 count query: `listRuns`)
- `src/services/label.service.ts` (1 count query)
- `src/services/api-key.service.ts` (1 count query)
- `src/routes/audit-log.route.ts` (1 count query)
- `src/drivers/promptmetrics-github-driver.ts` (1 count query)

**Trade-off Analysis**:

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| A. Inline `Number(result?.c ?? 0)` at every call site | Minimal abstraction; explicit | Repetitive; risk of missing call sites; inconsistency | Rejected |
| B. Helper function `parseCount(row)` in `dialect-helpers.ts` or `pagination.ts` | Single point of truth; easy to test; catches all cases | Slightly more abstraction | **Accepted** |
| C. Configure `node-postgres` `types.setTypeParser(20, parseInt)` | Global fix; no code changes | Overrides all bigint parsing globally; may break other legitimate bigint use cases (IDs, etc.); hidden side effect | Rejected |
| D. Use `parseInt()` instead of `Number()` | Handles strings | Fails on `null`/`undefined` without coalescing | Rejected |

**Decision**: Use Approach B — introduce a `parseCount()` helper that safely converts count results to numbers, handling both string (PostgreSQL) and number (SQLite) inputs, plus null/undefined fallback.

### Implementation Details

1. **Add helper** in `src/utils/pagination.ts`:
   ```typescript
   export function parseCount(result: unknown): number {
     if (result === null || result === undefined) return 0;
     if (typeof result === 'number') return result;
     if (typeof result === 'string') return Number(result);
     if (typeof result === 'bigint') return Number(result);
     return 0;
   }
   ```

2. **Add typed wrapper** for the common `COUNT(*) as c` pattern:
   ```typescript
   export function parseCountRow(row: unknown): number {
     if (row === null || row === undefined) return 0;
     const r = row as Record<string, unknown>;
     const val = r.c ?? r.count ?? 0;
     return parseCount(val);
   }
   ```

3. **Update all affected service files** to use `parseCountRow()` instead of direct `.c` access.

4. **Update tests** that mock or assert on count values to handle both types.

---

## Risk Mitigation & Regression Prevention

### What Could Go Wrong

1. **Migration 009 fails on PostgreSQL**: If existing `spans` rows contain out-of-range values, `ALTER COLUMN TYPE BIGINT` could fail. However, the column was already failing on INSERT, so out-of-range rows are unlikely to exist.
2. **Missing a COUNT(*) call site**: If any count query is missed, that endpoint will still return strings on PostgreSQL.
3. **`parseCount` breaks on unexpected input**: Must handle `null`, `undefined`, `string`, `number`, and `bigint` defensively.
4. **SQLite behavior changes**: The plan explicitly preserves `INTEGER` for SQLite, so no SQLite regression.
5. **Build breaks**: Adding a new migration file requires the migrator to pick it up. The existing `umzug` setup uses glob patterns that will automatically include `009_*.ts`.

### Prevention Measures

1. **Comprehensive grep audit**: Before and after the fix, grep for all `COUNT(*)` occurrences to ensure completeness.
2. **Unit tests for `parseCount` and `parseCountRow`**: Test all input types (string, number, bigint, null, undefined, object).
3. **Integration tests on both backends**: Run the full test suite against SQLite (default) and verify PostgreSQL behavior via mocked adapter or dedicated integration tests.
4. **Static analysis**: Run `npm run lint` and `npm run build` after all changes.
5. **No changes to `buildPaginatedResponse`**: The function signature remains unchanged; only the callers provide the correct type.

---

## ADR-009: PostgreSQL Dialect Normalization for COUNT and BIGINT

### Status
Proposed

### Context
PostgreSQL and SQLite have divergent type systems. SQLite uses dynamic typing (`INTEGER` is 64-bit), while PostgreSQL uses strict static typing (`INTEGER` is 32-bit, `BIGINT` is 64-bit). Our abstraction layer (`DatabaseAdapter`) does not currently normalize `COUNT(*)` return types or timestamp column widths, leading to production bugs #64 and #65.

### Decision
1. Introduce dialect-conditional DDL helpers for timestamp columns (`timestampColumn`).
2. Introduce a runtime count-normalization helper (`parseCountRow`) in the pagination utility layer.
3. Apply these helpers consistently across all migrations and services.

### Consequences
- **Easier**: Adding future PostgreSQL support for new tables; adding new paginated endpoints.
- **Harder**: None. The abstraction is thin and localized.
- **Risk**: Very low. The patterns are proven by #31 and #63.

---

## Files to Modify

### Issue #64
1. `migrations/dialect-helpers.ts` — add `timestampColumn`
2. `migrations/001_initial_schema.ts` — use `timestampColumn` for `spans.start_time`, `spans.end_time`
3. `migrations/009_alter_spans_time_columns.ts` — new migration for existing PostgreSQL deployments

### Issue #65
4. `src/utils/pagination.ts` — add `parseCount` and `parseCountRow`
5. `src/services/prompt.service.ts` — 2 call sites
6. `src/services/trace.service.ts` — 1 call site
7. `src/services/evaluation.service.ts` — 2 call sites
8. `src/services/log.service.ts` — 1 call site
9. `src/services/run.service.ts` — 1 call site
10. `src/services/label.service.ts` — 1 call site
11. `src/services/api-key.service.ts` — 1 call site
12. `src/routes/audit-log.route.ts` — 1 call site
13. `src/drivers/promptmetrics-github-driver.ts` — 1 count query

### Tests
14. `tests/unit/utils/pagination.test.ts` — new unit tests for `parseCount` / `parseCountRow`
15. Update any existing tests that assert on raw count types

---

## Deliverables

1. `docs/plans/open-issues-resolution-plan.md` (this document)
2. `docs/plans/BUILD_TASKS_OPEN_ISSUES.md` — step-by-step implementation tasks
3. `docs/plans/TESTING_PLAN_OPEN_ISSUES.md` — comprehensive testing strategy

---

## Approval

| Role | Name | Status |
|------|------|--------|
| Software Architect | — | Proposed |
| AI Engineer | — | Proposed |
| API Tester | — | Pending (see testing plan) |
