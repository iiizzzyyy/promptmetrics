# Issue #63 — Resolution Plan

**Repository:** `iiizzzyyy/promptmetrics`
**Date:** 2026-04-28
**Status:** Proposed
**Scope:** Issue #63

---

## ADR-010: PostgresAdapter blind `RETURNING id` breaks INSERTs on tables without `id` column

### Status
Proposed

### Context

`PostgresAdapter.run()` (and `TransactionPreparedStatement.run()`) unconditionally append `RETURNING id` to every INSERT statement:

```typescript
// src/models/postgres.adapter.ts:27-29
if (/^\s*INSERT\b/i.test(sql) && !/\bRETURNING\b/i.test(sql)) {
  sql += ' RETURNING id';
}
```

This was introduced to provide `lastInsertRowid` for callers that need the generated primary key. However, not all tables have an `id` column. The `migrations` table — created by `MigrationStorage.ensureTable()` — has this schema:

```sql
CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY)
```

No `id` column exists. When `umzug` tries to log a migration, it runs:

```sql
INSERT INTO migrations (name) VALUES ($1) RETURNING id
```

PostgreSQL errors with:
```
ERROR:  column "id" does not exist at character 53
STATEMENT:  INSERT INTO migrations (name) VALUES ($1) RETURNING id
```

This makes **fresh PostgreSQL database initialization impossible**.

### Decision

**Remove the automatic `RETURNING id` appending and require callers to include it explicitly when needed.**

#### Why not check table metadata before appending?
Querying `information_schema.columns` for every INSERT adds latency, complexity, and a new query path. It's simpler and more correct to let the caller decide.

#### Why not make `RETURNING id` the default and fix the migrations table?
Adding an `id` column to the migrations table would require a migration to migrate the migrations table, which is conceptually awkward and may conflict with `umzug`'s expectations.

### Implementation

1. **Remove auto-appending from `PostgresAdapter.run()`** (`src/models/postgres.adapter.ts:27-29`)
2. **Remove auto-appending from `TransactionPreparedStatement.run()`** (`src/models/postgres.adapter.ts:126-128`)
3. **Add `RETURNING id` to INSERTs that need `lastInsertRowid`:**
   - `src/services/evaluation.service.ts:43` — `evaluations` table
   - `src/services/evaluation.service.ts:156` — `evaluation_results` table
   - `src/services/api-key.service.ts:41` — `api_keys` table
   - `src/services/log.service.ts:42` — `logs` table
4. **Update `postgres.adapter.test.ts`** — adjust tests to reflect that `run()` no longer auto-appends `RETURNING id`
5. **Run full test suite** to verify zero regressions

### Consequences

**Easier:**
- No magic behavior hidden in the adapter
- Callers explicitly declare when they need the inserted row's ID
- Works with any table schema, not just tables with an `id` column

**Harder:**
- Four service INSERTs must be updated to include `RETURNING id`
- Future developers must remember to add `RETURNING id` when they need `lastInsertRowid` on PostgreSQL

### Rollback Plan

1. Revert `postgres.adapter.ts` changes
2. Revert the four service INSERT changes
3. Revert test changes

### Estimated Effort

- Implementation: 30 minutes
- Testing: 30 minutes
- Review & merge: 15 minutes
- **Total: 75 minutes**

---

*Plan generated on 2026-04-28.*
