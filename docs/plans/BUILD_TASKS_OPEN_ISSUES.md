# Build Tasks: Open Issues Resolution (#64, #65)

**Repository**: iiizzzyyy/promptmetrics  
**Date**: 2026-04-28  
**Plan**: [open-issues-resolution-plan.md](./open-issues-resolution-plan.md)

---

## Legend

- `[ ]` — Not started  
- `[-]` — In progress  
- `[x]` — Complete  
- `**BLOCKED**` — Waiting on dependency

---

## Sprint 1: Foundation & Helpers

### Task 1.1: Add `timestampColumn` helper to `dialect-helpers.ts`
**Issue**: #64  
**File**: `migrations/dialect-helpers.ts`  
**Effort**: 5 min  
**Steps**:
1. Open `migrations/dialect-helpers.ts`.
2. Add after `windowStartColumn`:
   ```typescript
   export function timestampColumn(dialect: 'sqlite' | 'postgres'): string {
     return dialect === 'postgres' ? 'BIGINT' : 'INTEGER';
   }
   ```
3. Run `npx tsc --noEmit migrations/dialect-helpers.ts` to verify.

**Acceptance Criteria**:
- `timestampColumn('postgres')` returns `'BIGINT'`
- `timestampColumn('sqlite')` returns `'INTEGER'`

---

### Task 1.2: Update initial schema to use `timestampColumn`
**Issue**: #64  
**File**: `migrations/001_initial_schema.ts`  
**Effort**: 10 min  
**Steps**:
1. Add `timestampColumn` to the import from `./dialect-helpers`.
2. Change line 86: `start_time INTEGER,` → `start_time ${timestampColumn(d)},`
3. Change line 87: `end_time INTEGER,` → `end_time ${timestampColumn(d)},`
4. Verify the template string renders correctly for both dialects.

**Acceptance Criteria**:
- `001_initial_schema.ts` compiles without errors.
- For PostgreSQL dialect, generated DDL contains `start_time BIGINT` and `end_time BIGINT`.
- For SQLite dialect, generated DDL contains `start_time INTEGER` and `end_time INTEGER`.

---

### Task 1.3: Add count-normalization helpers to `pagination.ts`
**Issue**: #65  
**File**: `src/utils/pagination.ts`  
**Effort**: 15 min  
**Steps**:
1. Open `src/utils/pagination.ts`.
2. Add after `buildPaginatedResponse`:
   ```typescript
   export function parseCount(value: unknown): number {
     if (value === null || value === undefined) return 0;
     if (typeof value === 'number') return value;
     if (typeof value === 'string') {
       const n = Number(value);
       return Number.isNaN(n) ? 0 : n;
     }
     if (typeof value === 'bigint') {
       return Number(value);
     }
     return 0;
   }

   export function parseCountRow(row: unknown): number {
     if (row === null || row === undefined) return 0;
     const r = row as Record<string, unknown>;
     const val = r.c ?? r.count ?? 0;
     return parseCount(val);
   }
   ```
3. Run `npm run lint` on the file.

**Acceptance Criteria**:
- `parseCount('5')` returns `5`
- `parseCount(5)` returns `5`
- `parseCount(null)` returns `0`
- `parseCount(undefined)` returns `0`
- `parseCount(BigInt(5))` returns `5`
- `parseCountRow({ c: '5' })` returns `5`
- `parseCountRow({ count: '5' })` returns `5`
- `parseCountRow(null)` returns `0`

---

## Sprint 2: Migration for Existing Deployments

### Task 2.1: Create migration `009_alter_spans_time_columns.ts`
**Issue**: #64  
**File**: `migrations/009_alter_spans_time_columns.ts` (new)  
**Effort**: 15 min  
**Steps**:
1. Create new file `migrations/009_alter_spans_time_columns.ts`.
2. Implement:
   ```typescript
   import { DatabaseAdapter } from '../src/models/database.interface';

   export async function up(db: DatabaseAdapter): Promise<void> {
     if (db.dialect === 'sqlite') return;
     await db.exec('ALTER TABLE spans ALTER COLUMN start_time TYPE BIGINT');
     await db.exec('ALTER TABLE spans ALTER COLUMN end_time TYPE BIGINT');
   }

   export async function down(db: DatabaseAdapter): Promise<void> {
     if (db.dialect === 'sqlite') return;
     await db.exec('ALTER TABLE spans ALTER COLUMN end_time TYPE INTEGER');
     await db.exec('ALTER TABLE spans ALTER COLUMN start_time TYPE INTEGER');
   }
   ```
3. Verify migration compiles: `npx tsc --noEmit migrations/009_alter_spans_time_columns.ts`.

**Acceptance Criteria**:
- Migration file exists and compiles.
- `up()` is a no-op for SQLite.
- `up()` alters both columns for PostgreSQL.
- `down()` reverses the change for PostgreSQL.

---

### Task 2.2: Verify migration ordering
**Issue**: #64  
**File**: `migrations/` directory  
**Effort**: 5 min  
**Steps**:
1. List migration files: `ls migrations/*.ts`.
2. Confirm `009_alter_spans_time_columns.ts` is numerically after `008_add_prompt_status.ts`.
3. Check `src/migrations/migrator.ts` to confirm glob pattern picks up `009_*`.

**Acceptance Criteria**:
- Migration order is correct (001 -> 002 -> ... -> 009).
- Migrator glob includes the new file.

---

## Sprint 3: Service-Layer Count Query Fixes

### Task 3.1: Fix `prompt.service.ts`
**Issue**: #65  
**File**: `src/services/prompt.service.ts`  
**Effort**: 10 min  
**Steps**:
1. Add `parseCountRow` to the import from `@utils/pagination`.
2. In `listPrompts` (line 35-38), replace:
   ```typescript
   const totalRow = (await db
     .prepare("SELECT COUNT(DISTINCT name) as c FROM prompts WHERE workspace_id = ? AND status = 'active'")
     .get(workspaceId)) as { c: number };
   const total = totalRow.c;
   ```
   with:
   ```typescript
   const total = parseCountRow(await db
     .prepare("SELECT COUNT(DISTINCT name) as c FROM prompts WHERE workspace_id = ? AND status = 'active'")
     .get(workspaceId));
   ```
3. In `listVersions` (line 113-116), replace:
   ```typescript
   const totalRow = (await db
     .prepare("SELECT COUNT(*) as c FROM prompts WHERE name = ? AND workspace_id = ? AND status = 'active'")
     .get(name, workspaceId)) as { c: number };
   const total = totalRow.c;
   ```
   with:
   ```typescript
   const total = parseCountRow(await db
     .prepare("SELECT COUNT(*) as c FROM prompts WHERE name = ? AND workspace_id = ? AND status = 'active'")
     .get(name, workspaceId));
   ```

**Acceptance Criteria**:
- Both count queries use `parseCountRow`.
- No remaining `as { c: number }` casts for count queries in this file.

---

### Task 3.2: Fix `trace.service.ts`
**Issue**: #65  
**File**: `src/services/trace.service.ts`  
**Effort**: 5 min  
**Steps**:
1. Add `parseCountRow` to import.
2. In `listTraces` (line 199-201), replace:
   ```typescript
   const total = (
     (await db.prepare('SELECT COUNT(*) as c FROM traces WHERE workspace_id = ?').get(workspaceId)) as { c: number }
   ).c;
   ```
   with:
   ```typescript
   const total = parseCountRow(await db.prepare('SELECT COUNT(*) as c FROM traces WHERE workspace_id = ?').get(workspaceId));
   ```

**Acceptance Criteria**:
- Count query uses `parseCountRow`.

---

### Task 3.3: Fix `evaluation.service.ts`
**Issue**: #65  
**File**: `src/services/evaluation.service.ts`  
**Effort**: 10 min  
**Steps**:
1. Add `parseCountRow` to import.
2. In `listEvaluations` (line 74-78), replace `.c` access with `parseCountRow(...)`.
3. In `listEvaluationResults` (line 189-192), replace `.c` access with `parseCountRow(...)`.

**Acceptance Criteria**:
- Both count queries use `parseCountRow`.

---

### Task 3.4: Fix `log.service.ts`
**Issue**: #65  
**File**: `src/services/log.service.ts`  
**Effort**: 5 min  
**Steps**:
1. Add `parseCountRow` to import.
2. In `listLogs` (line 76-78), replace `.c` access with `parseCountRow(...)`.

**Acceptance Criteria**:
- Count query uses `parseCountRow`.

---

### Task 3.5: Fix `run.service.ts`
**Issue**: #65  
**File**: `src/services/run.service.ts`  
**Effort**: 5 min  
**Steps**:
1. Add `parseCountRow` to import.
2. In `listRuns` (line 158-160), replace `.c` access with `parseCountRow(...)`.

**Acceptance Criteria**:
- Count query uses `parseCountRow`.

---

### Task 3.6: Fix `label.service.ts`
**Issue**: #65  
**File**: `src/services/label.service.ts`  
**Effort**: 5 min  
**Steps**:
1. Add `parseCountRow` to import.
2. Find the count query (around line 45) and replace `.c` access with `parseCountRow(...)`.

**Acceptance Criteria**:
- Count query uses `parseCountRow`.

---

### Task 3.7: Fix `api-key.service.ts`
**Issue**: #65  
**File**: `src/services/api-key.service.ts`  
**Effort**: 5 min  
**Steps**:
1. Add `parseCountRow` to import.
2. Find the count query (around line 67) and replace `.c` access with `parseCountRow(...)`.

**Acceptance Criteria**:
- Count query uses `parseCountRow`.

---

### Task 3.8: Fix `audit-log.route.ts`
**Issue**: #65  
**File**: `src/routes/audit-log.route.ts`  
**Effort**: 5 min  
**Steps**:
1. Add `parseCountRow` to import.
2. In the GET handler (line 19-23), replace `.count` access with `parseCountRow(...)`.

**Acceptance Criteria**:
- Count query uses `parseCountRow`.

---

### Task 3.9: Fix `promptmetrics-github-driver.ts`
**Issue**: #65  
**File**: `src/drivers/promptmetrics-github-driver.ts`  
**Effort**: 5 min  
**Steps**:
1. Add `parseCountRow` to import.
2. Find the count query (around line 277) and replace `.count` access with `parseCountRow(...)`.

**Acceptance Criteria**:
- Count query uses `parseCountRow`.

---

### Task 3.10: Final grep audit for remaining COUNT(*) casts
**Issue**: #65  
**Effort**: 10 min  
**Steps**:
1. Run: `grep -rn "COUNT(\*)" src/ --include="*.ts"`
2. Run: `grep -rn "COUNT(DISTINCT" src/ --include="*.ts"`
3. Verify every result either:
   - Uses `parseCountRow(...)` for the `.get()` call, OR
   - Is in a test file that intentionally tests raw behavior.
4. If any missed call sites are found, create follow-up tasks.

**Acceptance Criteria**:
- Zero unhandled `COUNT(*)` `.get()` call sites in `src/` (excluding tests).

---

## Sprint 4: Unit & Integration Tests

### Task 4.1: Create unit tests for `parseCount` and `parseCountRow`
**Issue**: #65  
**File**: `tests/unit/utils/pagination.test.ts` (new)  
**Effort**: 20 min  
**Steps**:
1. Create `tests/unit/utils/pagination.test.ts`.
2. Import `parseCount`, `parseCountRow` from `@utils/pagination`.
3. Write test cases:
   - `parseCount('5')` -> `5`
   - `parseCount(5)` -> `5`
   - `parseCount(BigInt(5))` -> `5`
   - `parseCount('invalid')` -> `0`
   - `parseCount(null)` -> `0`
   - `parseCount(undefined)` -> `0`
   - `parseCount({})` -> `0`
   - `parseCountRow({ c: '5' })` -> `5`
   - `parseCountRow({ count: '5' })` -> `5`
   - `parseCountRow({ c: 5 })` -> `5`
   - `parseCountRow(null)` -> `0`
4. Run: `npx jest tests/unit/utils/pagination.test.ts`

**Acceptance Criteria**:
- All tests pass.
- Coverage for `parseCount` and `parseCountRow` is 100%.

---

### Task 4.2: Update existing service tests for count assertions
**Issue**: #65  
**Effort**: 15 min  
**Steps**:
1. Grep for tests that mock `db.prepare(...).get(...)` returning `{ c: ... }`.
2. Verify those tests still pass (the value type shouldn't matter since `parseCountRow` normalizes).
3. If any test explicitly asserts `typeof total === 'string'`, update it.

**Acceptance Criteria**:
- All existing unit tests pass without modification (since `parseCountRow` handles both types).

---

### Task 4.3: Run full test suite
**Issue**: #64, #65  
**Effort**: 10 min  
**Steps**:
1. Run: `npm test`
2. Verify all unit, integration, and e2e tests pass.
3. If failures occur, triage and create fix tasks.

**Acceptance Criteria**:
- `npm test` exits with code 0.

---

## Sprint 5: Static Analysis & Build Verification

### Task 5.1: TypeScript compilation
**Issue**: #64, #65  
**Effort**: 5 min  
**Steps**:
1. Run: `npm run build`
2. Verify no TypeScript errors.

**Acceptance Criteria**:
- `npm run build` succeeds.

---

### Task 5.2: Lint check
**Issue**: #64, #65  
**Effort**: 5 min  
**Steps**:
1. Run: `npm run lint`
2. Fix any lint errors.

**Acceptance Criteria**:
- `npm run lint` passes with no errors.

---

### Task 5.3: Format check
**Issue**: #64, #65  
**Effort**: 5 min  
**Steps**:
1. Run: `npm run format`
2. Stage any formatting changes.

**Acceptance Criteria**:
- No uncommitted formatting changes.

---

## Sprint 6: Documentation & Release Prep

### Task 6.1: Update CHANGELOG.md
**Issue**: #64, #65  
**File**: `CHANGELOG.md`  
**Effort**: 10 min  
**Steps**:
1. Add entries under `## [Unreleased]`:
   - Fixed: PostgreSQL `spans.start_time` and `spans.end_time` INTEGER overflow by using BIGINT (#64)
   - Fixed: PostgreSQL `COUNT(*)` returning strings by normalizing count results in pagination helpers (#65)

**Acceptance Criteria**:
- CHANGELOG accurately describes both fixes.

---

### Task 6.2: Close GitHub issues
**Issue**: #64, #65  
**Effort**: 5 min  
**Steps**:
1. Create commit(s) with conventional commit messages referencing issues.
2. Push branch.
3. Close issues #64 and #65 via commit message or PR description.

**Acceptance Criteria**:
- Issues #64 and #65 are closed.

---

## Task Summary

| Sprint | Tasks | Est. Total Time |
|--------|-------|-----------------|
| Sprint 1: Foundation | 3 | 30 min |
| Sprint 2: Migration | 2 | 20 min |
| Sprint 3: Service Fixes | 10 | 60 min |
| Sprint 4: Tests | 3 | 45 min |
| Sprint 5: Build Verification | 3 | 15 min |
| Sprint 6: Documentation | 2 | 15 min |
| **Total** | **23** | **~3 hours** |

---

## Dependencies

```
Task 1.1 -> Task 1.2
Task 1.2 -> Task 2.1
Task 1.3 -> Task 3.1
Task 1.3 -> Task 3.2
Task 1.3 -> Task 3.3
Task 1.3 -> Task 3.4
Task 1.3 -> Task 3.5
Task 1.3 -> Task 3.6
Task 1.3 -> Task 3.7
Task 1.3 -> Task 3.8
Task 1.3 -> Task 3.9
Task 3.1..3.9 -> Task 3.10
Task 2.1..2.2, Task 3.10 -> Task 4.3
Task 4.3 -> Task 5.1
Task 5.1 -> Task 5.2
Task 5.2 -> Task 5.3
Task 5.3 -> Task 6.1
Task 6.1 -> Task 6.2
```
