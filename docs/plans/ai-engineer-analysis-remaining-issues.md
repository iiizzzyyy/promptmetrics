# Technical Implementation Analysis: Issues #31, #41, #62

## Issue #31 — PostgreSQL integer overflow in rate_limits.window_start

### 1. Recommended Approach

**Option 1: Use dialect-conditional `BIGINT` for PostgreSQL, keep `INTEGER` for SQLite.**

**Rationale:**
- The project already has a `dialect-helpers.ts` abstraction (`idColumn`, `nowFn`) used in migrations for exactly this purpose.
- PostgreSQL `INTEGER` is 32-bit signed (max 2,147,483,647). A millisecond timestamp for 2026 already exceeds this (`Date.now()` ~ 1,777,306,560,000).
- SQLite `INTEGER` is 64-bit and already handles the value fine; changing it to `BIGINT` in SQLite is a no-op anyway (SQLite has no separate `BIGINT` type, it uses dynamic typing with 64-bit integer affinity).
- Option 2 (storing seconds) would require changing the middleware computation `Math.floor(now / windowMs) * windowMs` to divide by 1000 everywhere, and would require a data migration for all existing `rate_limits` rows in production PostgreSQL databases. It also loses millisecond precision for rate-limit windows smaller than 1 second, which could matter for high-throughput workloads.
- Minimal code churn: one new helper in `dialect-helpers.ts`, one line change in the migration, and type normalization in the middleware.

### 2. Files to Modify

#### `migrations/dialect-helpers.ts`
Add a new helper function:
```typescript
export function bigIntColumn(dialect: 'sqlite' | 'postgres'): string {
  return dialect === 'postgres' ? 'BIGINT' : 'INTEGER';
}
```

#### `migrations/001_initial_schema.ts`
Change line 129 from:
```sql
window_start INTEGER NOT NULL,
```
to:
```sql
window_start ${bigIntColumn(d)} NOT NULL,
```
Import `bigIntColumn` from `./dialect-helpers`.

#### `src/middlewares/rate-limit-per-key.middleware.ts`
No structural changes needed to the `windowStart` computation, but add an explicit `BigInt()` cast when binding to PostgreSQL to avoid any driver coercion warnings. In `checkSqliteRateLimit`, the parameter binding `windowStart` should be passed as-is (number). The existing code works because JavaScript numbers up to 2^53 are safe integers and fit in both `INTEGER` (SQLite) and `BIGINT` (PostgreSQL). No code path changes required.

**Important note on migration safety:** `001_initial_schema.ts` is a baseline migration. Existing SQLite databases already have the table created. Existing PostgreSQL databases need a new migration to alter the column type. Do NOT modify the baseline for existing deployments without a follow-up migration.

### 3. Migration Requirements

Create a new migration `migrations/007_fix_rate_limits_bigint.ts`:
```typescript
import { DatabaseAdapter } from '../src/models/database.interface';

export async function up(db: DatabaseAdapter): Promise<void> {
  const d = db.dialect;
  if (d === 'postgres') {
    await db.exec(`ALTER TABLE rate_limits ALTER COLUMN window_start TYPE BIGINT`);
  }
  // SQLite: no-op (INTEGER is already 64-bit)
}

export async function down(db: DatabaseAdapter): Promise<void> {
  const d = db.dialect;
  if (d === 'postgres') {
    // Reverting BIGINT -> INTEGER is destructive if rows contain values > 2^31-1.
    // This is a one-way fix; down migration should truncate or skip.
    await db.exec(`ALTER TABLE rate_limits ALTER COLUMN window_start TYPE INTEGER`);
  }
}
```

**Backward compatibility:**
- SQLite: fully backward compatible. `INTEGER` in SQLite is 64-bit; altering it changes nothing.
- PostgreSQL: the `ALTER TABLE ... TYPE BIGINT` is non-blocking for this small table but will rewrite the table. Since `rate_limits` is a high-churn cache table, the migration should be run during a low-traffic window or the table can be dropped and recreated (data is ephemeral).

### 4. Test Strategy

**File:** `tests/unit/migrations/dialect-helpers.test.ts` (new, or add to existing migration test)
- Test `bigIntColumn('sqlite')` returns `'INTEGER'`.
- Test `bigIntColumn('postgres')` returns `'BIGINT'`.

**File:** `tests/integration/rate-limit.test.ts`
- Add a test that simulates a `window_start` value > 2,147,483,647 and asserts it is stored and retrieved correctly.
- Add a concurrent test (see Issue #62 gap #7) that asserts no integer truncation occurs under SQLite WAL concurrency.

**File:** `tests/unit/sqlite.test.ts`
- Assert that `PRAGMA table_info(rate_limits)` shows `window_start` as `INTEGER` (SQLite schema introspection).

### 5. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Existing PostgreSQL deployments fail on insert after code deploys but before migration runs | High if deploy/migration out of sync | High (429s or crashes) | Ensure migration runs before app startup; `initSchema()` is called in `server.ts` |
| `ALTER TABLE` locks `rate_limits` briefly in PostgreSQL | Low (tiny table) | Low | Acceptable; table is small |
| JavaScript `number` precision loss when passing > 2^53 | N/A | N/A | `Date.now()` is ~1.7e12, far below 2^53 (9e15) |
| Middleware parameter binding type mismatch with `pg` driver | Low | Medium | `pg` handles `number` -> `BIGINT` correctly for safe integers |

### 6. Estimated Effort

- **Story points:** 2
- **Hours:** 4-6
- **Breakdown:** Helper + migration (1h), middleware verification (1h), tests (2h), PostgreSQL validation in CI (2h)

---

## Issue #41 — PromptService.createPrompt() non-atomic two-phase write can orphan prompts

### 1. Recommended Approach

**Option 3: Implement proper two-phase commit with compensation on failure.**

**Rationale:**
- Option 1 (status column + background reconciliation job) is heavy: requires a new migration, a new background job (in addition to `GitSyncJob`), periodic scanning of `pending` rows, and driver-specific cleanup logic. It introduces operational complexity and a delay before prompts become visible.
- Option 2 (reverse order: DB first, then driver) moves the orphan problem to the DB side. A DB row without storage is less harmful than storage without a row (it 404s on read), but it still corrupts `listPrompts` and `listVersions` counts, and leaves garbage in the index. Since the prompts table is described as an *index* (not the source of truth), lying in the index is worse than missing data.
- Option 3 aligns with the existing `GithubDriver.createPrompt()` revert logic already in the codebase (lines 245-260). We extend this pattern to all drivers by adding a `deletePrompt` method to the `PromptDriver` interface.
- The critical bug is not just orphaning: `FilesystemDriver` and `S3Driver` currently INSERT into the DB themselves with `workspace_id = 'default'`, and then `PromptService.createPrompt()` does a separate UPDATE to the real `workspace_id`. If the UPDATE fails, the prompt is visible to the `default` workspace but invisible to the creating workspace — a **cross-tenant data leakage bug**.

### 2. Files to Modify

#### `src/drivers/promptmetrics-driver.interface.ts`
Add to `PromptDriver` interface:
```typescript
deletePrompt(name: string, version: string): Promise<void>;
```

#### `src/drivers/promptmetrics-filesystem-driver.ts`
Remove the DB `INSERT` from `createPrompt()` (lines 97-107). Add `deletePrompt`:
```typescript
async deletePrompt(name: string, version: string): Promise<void> {
  this.validateName(name);
  const filePath = path.join(this.basePath, name, `${version}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  // Optionally remove empty parent directory
  const promptDir = path.join(this.basePath, name);
  if (fs.existsSync(promptDir) && fs.readdirSync(promptDir).length === 0) {
    fs.rmdirSync(promptDir);
  }
}
```

#### `src/drivers/promptmetrics-s3-driver.ts`
Remove the `withTransaction` DB insert from `createPrompt()` (lines 117-127). Add `deletePrompt`:
```typescript
async deletePrompt(name: string, version: string): Promise<void> {
  this.validateName(name);
  const key = this.key(name, version);
  await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
}
```
Import `DeleteObjectCommand` from `@aws-sdk/client-s3`.

#### `src/drivers/promptmetrics-github-driver.ts`
Remove the `withTransaction` DB insert from `createPrompt()` (lines 231-243), keeping the GitHub API write and tag creation. The existing revert block (lines 246-259) can be simplified or removed because `PromptService` will now own compensation. Alternatively, keep the revert as a fast-path and let `PromptService` call `deletePrompt` as a fallback. **Recommended:** Keep the internal revert but also expose `deletePrompt` for consistency.

Add `deletePrompt`:
```typescript
async deletePrompt(name: string, version: string): Promise<void> {
  const filePath = `prompts/${name}/${version}.json`;
  try {
    const { data } = await axios.get(
      `${this.apiBase}/repos/${this.repo}/contents/${filePath}`,
      { headers: this.getAuthHeaders() },
    );
    const sha = (data as { sha: string }).sha;
    await axios.request({
      method: 'DELETE',
      url: `${this.apiBase}/repos/${this.repo}/contents/${filePath}`,
      headers: this.getAuthHeaders(),
      data: { message: `Revert prompt: ${name} v${version}`, sha },
    });
  } catch {
    // Already deleted or never existed; idempotent
  }
}
```

#### `src/services/prompt.service.ts`
Rewrite `createPrompt` as the single point of truth for the DB index:
```typescript
async createPrompt(workspaceId: string, prompt: PromptFile): Promise<PromptVersion> {
  const db = getDb();

  // Phase 1: Write to storage (the source of truth)
  const result = await this.driver.createPrompt(prompt);

  // Phase 2: Atomically update the index with the correct workspace_id
  try {
    await db
      .prepare(
        `INSERT INTO prompts (name, version_tag, workspace_id, driver, commit_sha, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(name, version_tag) DO UPDATE SET
           workspace_id = excluded.workspace_id,
           driver = excluded.driver,
           commit_sha = excluded.commit_sha,
           created_at = excluded.created_at`
      )
      .run(
        prompt.name,
        prompt.version,
        workspaceId,
        result.commit_sha ? 'github' : (result.fs_path ? 'filesystem' : 's3'),
        result.commit_sha ?? null,
        result.created_at,
      );
    await invalidatePrompt(workspaceId, prompt.name);
    return result;
  } catch (dbError) {
    // Compensation: revert storage write so we don't orphan content
    try {
      await this.driver.deletePrompt(prompt.name, prompt.version);
    } catch {
      // Best-effort compensation; log and surface original DB error
    }
    throw dbError;
  }
}
```

**Note:** The `driver` column inference above is heuristic. A cleaner approach is to add a `driverType` getter to each driver or pass it as a config value. `FilesystemDriver` already knows it is `'filesystem'`, `S3Driver` knows `'s3'`, etc. Alternatively, have `createPrompt` return the driver type in `PromptVersion`. **Recommended minimal change:** add `driver: string` to `PromptVersion` interface:
```typescript
export interface PromptVersion {
  name: string;
  version_tag: string;
  commit_sha?: string;
  fs_path?: string;
  created_at: number;
  driver: string; // NEW
}
```

Update all three drivers to set `driver: 'filesystem' | 'github' | 's3'` in the returned `PromptVersion`.

### 3. Migration Requirements

No new migration is strictly required for the schema. However, if existing databases have prompts with `workspace_id = 'default'` that were created by this bug, a data cleanup migration may be needed in production. This is deployment-specific and should be handled as a runbook, not a code migration.

If adding `driver` to `PromptVersion` is done (recommended), no DB schema change is needed because `driver` already exists in the `prompts` table.

### 4. Test Strategy

**File:** `tests/unit/filesystem-driver.test.ts`
- Add test for `deletePrompt` removing the file.
- Add test for `deletePrompt` being idempotent (file does not exist).
- Add test that `createPrompt` no longer touches the DB (mock `getDb` and assert no calls).

**File:** `tests/unit/s3-driver.test.ts`
- Add test for `deletePrompt` calling `DeleteObjectCommand`.
- Add test for `deletePrompt` idempotency.

**File:** `tests/unit/github-driver.test.ts`
- Add test for `deletePrompt` calling GitHub Contents API DELETE.
- Add test for `deletePrompt` handling 404 gracefully.

**File:** `tests/integration/prompts.test.ts` (or new `tests/integration/prompt-atomicity.test.ts`)
- **Critical test:** Mock `getDb().prepare(...).run()` to throw after driver write succeeds. Assert that:
  1. The prompt file/object does NOT exist in storage (compensation succeeded).
  2. The API returns 500.
  3. The DB row does not exist (or was never inserted).
- **Cross-tenant leak regression test:** Create a prompt for `workspace-a`, simulate DB update failure, then list prompts for `workspace-a` and `default`. Assert `workspace-a` sees nothing and `default` also sees nothing.

**File:** `tests/unit/services/prompt.service.test.ts` (new or existing)
- Mock driver returning `PromptVersion` with `driver: 'filesystem'`.
- Assert that `createPrompt` calls `db.prepare` with `workspace_id` bound in the INSERT, not a separate UPDATE.

### 5. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `deletePrompt` fails during compensation, leaving true orphan | Low | Medium (orphan file) | Log compensation failure; background `GitSyncJob` can reconcile for GitHub; filesystem/S3 orphans need monitoring |
| Driver interface change breaks external/custom drivers | Low | High if external | This is a breaking interface change; document in release notes; version bump to 1.1.0 or 2.0.0 |
| Removing DB inserts from drivers breaks existing direct driver usage | Very Low | Medium | Drivers are only consumed via `PromptService` in the codebase; grep confirms no direct driver DB reliance in routes |
| Race condition: two concurrent creates for same prompt | Medium | Medium | `ON CONFLICT ... DO UPDATE` in PromptService handles it; last writer wins |
| GithubDriver revert logic removed, losing fast-path cleanup | Low | Low | Keep internal revert as optimization, or rely on PromptService compensation |

### 6. Estimated Effort

- **Story points:** 5
- **Hours:** 10-14
- **Breakdown:**
  - Interface change + driver refactoring (4h)
  - PromptService rewrite (2h)
  - Unit tests for all 3 drivers (3h)
  - Integration tests for atomicity and cross-tenant isolation (3h)
  - Regression testing (2h)

---

## Issue #62 — Multiple test coverage gaps

### 1. Recommended Approach

**Prioritize by production impact × testability.** The codebase is at 82.6% coverage. The fastest path to 85%+ is targeting high-leverage, low-effort gaps first.

**Priority Tier 1 (do first):**
1. **Error handler middleware** (gap #5) — touches every request path. Currently zero unit tests. High production impact, trivial to test with `supertest`.
2. **Webhook security** (gap #3) — replay attacks and timing-safe comparison are security-critical. The existing `webhook.test.ts` only tests happy path and invalid signature; missing replay-attack window and constant-time comparison.
3. **Cache corruption** (gap #6) — one missing test for `JSON.parse` failure path in `cache.service.ts`. A 5-minute test addition.

**Priority Tier 2 (do next):**
4. **PostgreSQL adapter** (gap #1) — core infrastructure for PostgreSQL deployments. Placeholder rewriting (`?` -> `$1`) is hand-rolled and untested.
5. **GitHub driver revert logic** (gap #4) — the DB-failure cleanup path in `GithubDriver.createPrompt` is complex and currently untested.
6. **S3 path traversal** (gap #8) — `S3Driver.validateName` exists but is not exercised in `s3-driver.test.ts`.

**Priority Tier 3 (do last):**
7. **Redis-backed rate limit** (gap #2) — requires Redis infrastructure in test environment (or `ioredis-mock`). High effort relative to coverage gain.
8. **E2E workspace-isolated audit logs** (gap #9) — medium effort; extends existing `e2e/full-lifecycle.test.ts`.
9. **Multi-process SQLite rate limit** (gap #7) — hardest to test reliably in CI. SQLite WAL handles read concurrency well; the test would need to spawn child processes and coordinate timing, which is flaky.

### 2. Files to Modify / Create

#### Tier 1

**`tests/unit/middlewares/error-handler.test.ts` (NEW)**
```typescript
import { errorHandlerMiddleware } from '@middlewares/promptmetrics-error-handler.middleware';
import { AppError } from '@errors/app.error';

describe('Error Handler Middleware', () => {
  let req: any, res: any, next: any;

  beforeEach(() => {
    req = { requestId: 'test-req-1' };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    next = jest.fn();
    jest.resetModules();
  });

  it('returns 400 for SyntaxError with body', () => {
    const err = Object.assign(new SyntaxError('Unexpected token'), { body: '{bad' });
    errorHandlerMiddleware(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].code).toBe('BAD_REQUEST');
  });

  it('serializes AppError with details', () => {
    const err = AppError.validationFailed([{ field: 'name', message: 'required' }]);
    errorHandlerMiddleware(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json.mock.calls[0][0].details).toEqual([{ field: 'name', message: 'required' }]);
  });

  it('masks 500 message in production', async () => {
    process.env.NODE_ENV = 'production';
    const { errorHandlerMiddleware: prodHandler } = await import('@middlewares/promptmetrics-error-handler.middleware');
    const err = new Error('database password is wrong');
    prodHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].message).toBeUndefined();
    delete process.env.NODE_ENV;
  });

  it('exposes 500 message in development', () => {
    process.env.NODE_ENV = 'development';
    const err = new Error('dev detail');
    errorHandlerMiddleware(err, req, res, next);
    expect(res.json.mock.calls[0][0].message).toBe('dev detail');
  });
});
```
**Note:** The error handler imports `config.nodeEnv`. To make the test work without module cache issues, either mock `@config/index` or re-import the handler after setting `NODE_ENV`. Using `jest.isolateModules` or dynamic import is recommended.

**`tests/integration/webhook.test.ts`** (append)
- Replay attack test: send a valid signature but with a timestamp > 5 minutes old (if timestamp verification exists; if not, this identifies a missing security feature).
- **Wait:** Looking at `src/middlewares/` files, there is no webhook middleware file shown. The webhook route likely lives elsewhere. Looking at the test file, the webhook handler validates `X-Hub-Signature-256`. The test should add:
  - Replay attack test: capture a valid signature, wait (or mock time), resend with same signature, assert 401.
  - Constant-time comparison test: send a signature that differs in the last byte, assert 401 (prevents timing side-channel leakage).

**`tests/unit/services/cache.service.test.ts`** (append)
```typescript
it('should handle corrupted Redis JSON gracefully', async () => {
  const { getRedisClient } = await import('@services/redis.service');
  const redis = getRedisClient();
  if (!redis) return; // skip if no Redis

  const key = cacheKey(WORKSPACE, 'corrupt');
  await redis.set(key, 'not-json');

  const result = await getCachedPrompt(key);
  expect(result).toBeUndefined();
  // Ensure the corrupt key was deleted
  const remaining = await redis.get(key);
  expect(remaining).toBeNull();
});
```

#### Tier 2

**`tests/unit/postgres-adapter.test.ts` (NEW)**
```typescript
import { PostgresAdapter } from '@models/postgres.adapter';
import { Pool } from 'pg';

jest.mock('pg', () => {
  const mPool = {
    query: jest.fn(),
    connect: jest.fn(),
    on: jest.fn(),
    end: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

describe('PostgresAdapter', () => {
  let adapter: PostgresAdapter;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    adapter = new PostgresAdapter('postgres://test');
    mockPool = (Pool as unknown as jest.Mock).mock.results[0].value;
  });

  it('rewrites ? placeholders to $1, $2...', async () => {
    mockPool.query.mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 } as any);
    const stmt = adapter.prepare('SELECT * FROM t WHERE a = ? AND b = ?');
    await stmt.run('x', 'y');
    expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM t WHERE a = $1 AND b = $2', ['x', 'y']);
  });

  it('appends RETURNING id to INSERT without RETURNING', async () => {
    mockPool.query.mockResolvedValue({ rows: [{ id: 42 }], rowCount: 1 } as any);
    const stmt = adapter.prepare('INSERT INTO t (a) VALUES (?)');
    const result = await stmt.run('x');
    expect(mockPool.query).toHaveBeenCalledWith('INSERT INTO t (a) VALUES ($1) RETURNING id', ['x']);
    expect(result.lastInsertRowid).toBe(42);
  });

  it('throws on nested transaction', async () => {
    mockPool.connect.mockResolvedValue({
      query: jest.fn(),
      release: jest.fn(),
    } as any);
    await adapter.transaction(async (db) => {
      await expect(db.transaction(async () => {})).rejects.toThrow('Nested transactions are not supported');
    });
  });
});
```

**`tests/unit/github-driver.test.ts`** (append)
- Test DB failure compensation path: mock the GitHub content creation to succeed, mock `withTransaction` to throw, assert that the DELETE revert API call is made with the correct `blobSha`.

**`tests/unit/s3-driver.test.ts`** (append)
```typescript
it('should reject path traversal in createPrompt', async () => {
  await expect(driver.createPrompt({ name: '../../../etc/passwd', version: '1.0.0', messages: [] }))
    .rejects.toThrow('Invalid prompt name');
});

it('should reject path traversal in getPrompt', async () => {
  await expect(driver.getPrompt('../../../etc/passwd')).rejects.toThrow('Invalid prompt name');
});
```

#### Tier 3

**`tests/integration/rate-limit.test.ts`** (append Redis path)
- Requires `process.env.REDIS_URL` set in test environment, or skip conditionally.
- Test that Redis pipeline sets TTL correctly.
- Test that Redis rate limit blocks after max requests.

**`tests/e2e/full-lifecycle.test.ts`** (append)
- Add workspace-isolated audit log test: create prompts in `workspace-a` and `workspace-b`, query audit logs scoped to each workspace, assert isolation.

**`tests/integration/rate-limit.test.ts`** (append concurrent SQLite test)
- Fire 20 rapid requests from the same key with limit=10, assert exactly 10 succeed and 10 return 429. This indirectly tests WAL concurrency without spawning processes.

### 3. Migration Requirements

None. All changes are test-only or in application code.

### 4. Test Count and Files Needed Summary

| Gap | File | New Tests | Est. Effort |
|-----|------|-----------|-------------|
| Error handler | `tests/unit/middlewares/error-handler.test.ts` | 4 | 1h |
| Webhook security | `tests/integration/webhook.test.ts` | 2 | 1h |
| Cache corruption | `tests/unit/services/cache.service.test.ts` | 1 | 0.5h |
| PostgreSQL adapter | `tests/unit/postgres-adapter.test.ts` | 3 | 2h |
| GitHub revert | `tests/unit/github-driver.test.ts` | 1 | 1.5h |
| S3 path traversal | `tests/unit/s3-driver.test.ts` | 2 | 0.5h |
| Redis rate limit | `tests/integration/rate-limit.test.ts` | 2 | 2h |
| E2E workspace audit | `tests/e2e/full-lifecycle.test.ts` | 1 | 1h |
| Multi-process SQLite | `tests/integration/rate-limit.test.ts` | 1 | 3h |
| **Total** | **2 new files, 5 modified** | **17 tests** | **12.5h** |

### 5. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Mocking `pg` Pool diverges from real driver behavior | Medium | Medium (false confidence) | Add a smoke test against a real PostgreSQL container in CI |
| Redis tests flaky in CI without dedicated Redis | High | Low (tests skip) | Use `process.env.REDIS_URL` guard; skip gracefully |
| Error handler test sensitive to `config.nodeEnv` module cache | Medium | Low | Use `jest.isolateModules` or mock `@config/index` |
| Concurrent SQLite test flaky due to timing | Medium | Low | Increase windowMs in test; use deterministic sequence |
| Adding 17 tests increases CI time significantly | Low | Low | Total added time < 30s; acceptable |

### 6. Estimated Effort

- **Story points:** 5
- **Hours:** 12-16
- **Breakdown:** Tier 1 (2.5h), Tier 2 (4h), Tier 3 (5.5h), CI verification (2h)
- **Coverage target:** 82.6% -> 86-87% lines

---

## Cross-Cutting Concerns

### Dependency Between Issues
- **Issue #31 and #62:** The PostgreSQL adapter tests (#62 gap #1) should be delivered alongside the rate-limit BIGINT fix (#31) because both exercise PostgreSQL-specific behavior.
- **Issue #41 and #62:** The GitHub driver revert test (#62 gap #4) becomes more important after Issue #41 refactors the revert logic into a formal `deletePrompt` method.

### Recommended Implementation Order
1. **Issue #31** (2 SP) — smallest change, unblocks PostgreSQL production deployments
2. **Issue #62 Tier 1 + Tier 2** (3 SP) — quick wins, establishes safety net
3. **Issue #41** (5 SP) — largest refactor; do it after test coverage is higher to catch regressions
4. **Issue #62 Tier 3** (2 SP) — finish coverage target
