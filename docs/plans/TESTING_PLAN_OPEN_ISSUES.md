# Testing Plan: Open Issues Resolution (#64, #65)

**Repository**: iiizzzyyy/promptmetrics
**Date**: 2026-04-28
**Plan**: [open-issues-resolution-plan.md](./open-issues-resolution-plan.md)
**Build Tasks**: [BUILD_TASKS_OPEN_ISSUES.md](./BUILD_TASKS_OPEN_ISSUES.md)
**Agent**: API Tester (testing-api-tester.md)

---

## 1. Test Strategy Overview

### Scope
This testing plan covers the resolution of two PostgreSQL-specific production bugs:
- **Issue #64**: `spans.start_time` and `spans.end_time` INTEGER overflow
- **Issue #65**: `COUNT(*)` returning strings, breaking pagination `total` fields

### Testing Philosophy
- **Security-first**: All fixes must not introduce SQL injection vectors or bypass auth.
- **Backend-agnostic validation**: Tests must pass on both SQLite and PostgreSQL backends.
- **Zero-regression**: Existing functionality must remain intact.
- **Contract compliance**: API responses must match their TypeScript interfaces.

### Test Levels

| Level | Focus | Target Coverage |
|-------|-------|-----------------|
| Unit | `parseCount`, `parseCountRow`, `timestampColumn`, `dialect-helpers` | 100% |
| Integration | End-to-end API calls for paginated list endpoints | All affected endpoints |
| Migration | Schema correctness, migration idempotency, up/down reversibility | All new migrations |
| Regression | Full suite: `npm test` | 100% of existing tests |

---

## 2. Unit Testing

### 2.1 `parseCount` and `parseCountRow` (Issue #65)

**File**: `tests/unit/utils/pagination.test.ts`
**Framework**: Jest

#### Test Cases for `parseCount`

| Input | Expected Output | Rationale |
|-------|-----------------|-----------|
| `5` (number) | `5` | SQLite native path |
| `"5"` (string) | `5` | PostgreSQL `node-postgres` path |
| `BigInt(5)` | `5` | Future-proofing / edge case |
| `"0"` | `0` | Zero boundary |
| `"invalid"` | `0` | Graceful degradation |
| `null` | `0` | Null safety |
| `undefined` | `0` | Undefined safety |
| `{}` | `0` | Unexpected object safety |
| `[]` | `0` | Unexpected array safety |
| `""` | `0` | Empty string safety |
| `"  7  "` | `7` | Whitespace tolerance (Number handles this) |
| `Number.MAX_SAFE_INTEGER` | `9007199254740991` | Large number boundary |
| `"9007199254740991"` | `9007199254740991` | Large string number boundary |

#### Test Cases for `parseCountRow`

| Input | Expected Output | Rationale |
|-------|-----------------|-----------|
| `{ c: 5 }` | `5` | Standard SQLite shape |
| `{ c: "5" }` | `5` | Standard PostgreSQL shape |
| `{ count: 5 }` | `5` | `audit-log.route.ts` uses `count` alias |
| `{ count: "5" }` | `5` | PostgreSQL + `count` alias |
| `{ c: null }` | `0` | Null column safety |
| `null` | `0` | Full null safety |
| `undefined` | `0` | Undefined safety |
| `{}` | `0` | Missing keys safety |
| `{ c: "invalid", count: "also invalid" }` | `0` | Double-invalid safety |

#### Mock Implementation Pattern

```typescript
import { parseCount, parseCountRow } from '@utils/pagination';

describe('parseCount', () => {
  it.each([
    [5, 5],
    ['5', 5],
    [BigInt(5), 5],
    ['0', 0],
    ['invalid', 0],
    [null, 0],
    [undefined, 0],
    [{}, 0],
    [[], 0],
    ['', 0],
    ['  7  ', 7],
    [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
    ['9007199254740991', 9007199254740991],
  ])('parseCount(%p) => %p', (input, expected) => {
    expect(parseCount(input)).toBe(expected);
  });
});

describe('parseCountRow', () => {
  it.each([
    [{ c: 5 }, 5],
    [{ c: '5' }, 5],
    [{ count: 5 }, 5],
    [{ count: '5' }, 5],
    [{ c: null }, 0],
    [null, 0],
    [undefined, 0],
    [{}, 0],
    [{ c: 'invalid', count: 'also invalid' }, 0],
  ])('parseCountRow(%p) => %p', (input, expected) => {
    expect(parseCountRow(input)).toBe(expected);
  });
});
```

### 2.2 `timestampColumn` and `dialect-helpers` (Issue #64)

**File**: `tests/unit/migrations/dialect-helpers.test.ts` (new or extend existing)
**Framework**: Jest

#### Test Cases

| Function | Dialect | Expected | Rationale |
|----------|---------|----------|-----------|
| `timestampColumn` | `'sqlite'` | `'INTEGER'` | SQLite uses 64-bit INTEGER natively |
| `timestampColumn` | `'postgres'` | `'BIGINT'` | PostgreSQL needs explicit BIGINT |
| `idColumn` | `'sqlite'` | `'INTEGER PRIMARY KEY AUTOINCREMENT'` | Existing helper regression check |
| `idColumn` | `'postgres'` | `'SERIAL PRIMARY KEY'` | Existing helper regression check |
| `windowStartColumn` | `'sqlite'` | `'INTEGER'` | Existing helper regression check |
| `windowStartColumn` | `'postgres'` | `'BIGINT'` | Existing helper regression check |

---

## 3. Integration Testing

### 3.1 Pagination `total` Field Contract (Issue #65)

**Goal**: Verify that `total` is always a `number` in JSON responses, regardless of backend.

**Approach**: Use `supertest` to hit endpoints and assert `typeof res.body.total === 'number'`.

#### Endpoints to Test

| Endpoint | Method | Service File | Route File |
|----------|--------|--------------|------------|
| `/v1/prompts` | GET | `prompt.service.ts` | `promptmetrics-prompt.route.ts` |
| `/v1/prompts/:name/versions` | GET | `prompt.service.ts` | `promptmetrics-prompt.route.ts` |
| `/v1/traces` | GET | `trace.service.ts` | `promptmetrics-trace.route.ts` |
| `/v1/evaluations` | GET | `evaluation.service.ts` | `promptmetrics-evaluation.route.ts` |
| `/v1/evaluations/:id/results` | GET | `evaluation.service.ts` | `promptmetrics-evaluation.route.ts` |
| `/v1/logs` | GET | `log.service.ts` | `promptmetrics-log.route.ts` |
| `/v1/runs` | GET | `run.service.ts` | `promptmetrics-run.route.ts` |
| `/v1/audit-logs` | GET | `audit-log.route.ts` (inline) | `audit-log.route.ts` |

#### Test Pattern for Each Endpoint

```typescript
// Example for /v1/prompts
describe('GET /v1/prompts', () => {
  it('returns total as a number, not a string', async () => {
    // Seed 2 prompts
    await seedPrompts(2);

    const res = await request(app)
      .get('/v1/prompts?page=1&limit=10')
      .set('X-API-Key', apiKey)
      .set('X-Workspace-Id', workspaceId);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(typeof res.body.total).toBe('number');
    expect(res.body.total).toBe(2);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('limit', 10);
    expect(res.body).toHaveProperty('totalPages', 1);
  });
});
```

**Critical Assertion**: `expect(typeof res.body.total).toBe('number')` -- this would fail before the fix on PostgreSQL because `total` would be `"2"` (string).

### 3.2 Span Timestamp Insertion (Issue #64)

**Goal**: Verify that spans with large millisecond timestamps can be inserted without INTEGER overflow.

**Test Setup**: Requires a PostgreSQL-backed test environment or a mock that validates column types.

#### SQLite Path (Default CI)

```typescript
describe('POST /v1/traces/:trace_id/spans', () => {
  it('accepts large millisecond timestamps without overflow', async () => {
    const traceRes = await request(app)
      .post('/v1/traces')
      .set('X-API-Key', apiKey)
      .send({ trace_id: 'trace-123' });
    expect(traceRes.status).toBe(201);

    const largeTimestamp = 1777359830616; // The exact value from the bug report

    const spanRes = await request(app)
      .post(`/v1/traces/trace-123/spans`)
      .set('X-API-Key', apiKey)
      .send({
        name: 'test-span',
        status: 'ok',
        start_time: largeTimestamp,
        end_time: largeTimestamp + 100,
      });

    expect(spanRes.status).toBe(201);
    expect(spanRes.body.start_time).toBe(largeTimestamp);
    expect(spanRes.body.end_time).toBe(largeTimestamp + 100);
  });
});
```

**Note**: The SQLite test path validates that the service layer handles large timestamps correctly. The PostgreSQL-specific overflow is validated by the migration test and schema inspection.

### 3.3 Migration Test: `009_alter_spans_time_columns`

**Goal**: Verify migration applies correctly and is reversible.

```typescript
describe('Migration 009: alter_spans_time_columns', () => {
  it('up() alters start_time and end_time to BIGINT on postgres', async () => {
    const mockPgDb = {
      dialect: 'postgres' as const,
      exec: jest.fn().mockResolvedValue(undefined),
    };

    const { up } = require('../../migrations/009_alter_spans_time_columns');
    await up(mockPgDb);

    expect(mockPgDb.exec).toHaveBeenCalledWith('ALTER TABLE spans ALTER COLUMN start_time TYPE BIGINT');
    expect(mockPgDb.exec).toHaveBeenCalledWith('ALTER TABLE spans ALTER COLUMN end_time TYPE BIGINT');
  });

  it('up() is a no-op on sqlite', async () => {
    const mockSqliteDb = {
      dialect: 'sqlite' as const,
      exec: jest.fn().mockResolvedValue(undefined),
    };

    const { up } = require('../../migrations/009_alter_spans_time_columns');
    await up(mockSqliteDb);

    expect(mockSqliteDb.exec).not.toHaveBeenCalled();
  });
});
```

---

## 4. Regression Testing

### 4.1 Full Test Suite Execution

**Command**: `npm test`

**Expected Result**:
- Exit code: `0`
- All 31+ test suites pass
- No new warnings or errors introduced

### 4.2 Build Verification

**Command**: `npm run build`

**Expected Result**:
- TypeScript compilation succeeds with zero errors
- No type mismatches introduced by removing `{ c: number }` casts

### 4.3 Lint Verification

**Command**: `npm run lint`

**Expected Result**:
- Zero ESLint errors
- Zero ESLint warnings related to the changed files

---

## 5. Performance Testing

### 5.1 Count Query Performance (Issue #65)

**Concern**: Does `parseCountRow` add meaningful overhead?

**Test**:
```typescript
it('parseCountRow overhead is negligible', () => {
  const iterations = 1_000_000;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    parseCountRow({ c: String(i) });
  }
  const duration = performance.now() - start;
  expect(duration).toBeLessThan(100); // Should complete in under 100ms
});
```

**Acceptance Criteria**: `parseCountRow` adds <0.0001ms per call.

---

## 6. Security Testing

### 6.1 SQL Injection Check

**Concern**: The new migration uses raw SQL strings.

**Validation**:
- `ALTER TABLE spans ALTER COLUMN start_time TYPE BIGINT` contains no user input.
- No parameterized queries are modified in a way that introduces injection.

**Test**: Run `npm audit` and confirm zero SQL injection vulnerabilities.

### 6.2 Type Safety Check

**Concern**: Removing `as { c: number }` casts could hide type errors.

**Validation**:
- `parseCountRow` returns `number`, satisfying all downstream type requirements.
- `buildPaginatedResponse` parameter `total: number` is still satisfied.

---

## 7. Test Environment Matrix

| Backend | Node Version | Test Suite | Priority |
|---------|--------------|------------|----------|
| SQLite | 20.x | Unit + Integration + E2E | P0 (CI default) |
| PostgreSQL 16 | 20.x | Integration (key endpoints) | P1 (manual or CI with service container) |

**PostgreSQL Integration Test Setup** (if available):
```yaml
# Example GitHub Actions service container
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_PASSWORD: test
      POSTGRES_DB: promptmetrics_test
    ports:
      - 5432:5432
```

---

## 8. Test Deliverables

1. `tests/unit/utils/pagination.test.ts` -- Unit tests for `parseCount` and `parseCountRow`
2. `tests/unit/migrations/dialect-helpers.test.ts` -- Unit tests for `timestampColumn`
3. `tests/integration/prompts.test.ts` -- Updated/extended with `typeof total === 'number'` assertions
4. `tests/integration/traces.test.ts` -- Updated/extended with span timestamp overflow test
5. `tests/integration/evaluations.test.ts` -- Updated/extended with `typeof total === 'number'` assertions
6. `tests/integration/logs.test.ts` -- Updated/extended with `typeof total === 'number'` assertions
7. `tests/integration/runs.test.ts` -- Updated/extended with `typeof total === 'number'` assertions
8. `tests/integration/audit-logs.test.ts` -- Updated/extended with `typeof total === 'number'` assertions

---

## 9. Go/No-Go Criteria

Before deployment, ALL of the following must be true:

- [ ] `npm test` passes with exit code 0
- [ ] `npm run build` compiles cleanly
- [ ] `npm run lint` passes with zero errors
- [ ] Unit tests for `parseCount` / `parseCountRow` achieve 100% coverage
- [ ] All paginated list endpoints return `total` as a `number` (verified by integration tests)
- [ ] Spans accept millisecond timestamps > `2,147,483,647` without error
- [ ] Migration `009` applies cleanly on both SQLite and PostgreSQL
- [ ] No existing tests are broken (zero regression)

---

## 10. Post-Deployment Monitoring

After release:

1. **Monitor error logs** for PostgreSQL deployments:
   - Search for: `out of range for type integer`
   - Search for: `value "..." is out of range for type integer`
2. **Monitor API response shapes**:
   - Alert if `typeof response.total !== 'number'` in production telemetry
3. **Schema validation**:
   - Run `\d spans` on PostgreSQL production DB to confirm `start_time` and `end_time` are `bigint`

---

*Testing plan generated by API Tester agent analysis.*
*Proposed 2026-04-28.*
