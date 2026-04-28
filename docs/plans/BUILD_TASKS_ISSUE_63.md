# PromptMetrics — Build Tasks for Issue #63

**Generated:** 2026-04-28
**Repository:** iiizzzyyy/promptmetrics
**Scope:** Issue #63
**Derived from:** [Issue #63 Resolution Plan](./issue-63-resolution-plan.md)

---

## Legend

- `[ ]` -- Not started
- `[-]` -- In progress
- `[x]` -- Complete

---

## Sprint: PostgresAdapter `RETURNING id` Fix (#63)

**Theme:** Remove automatic `RETURNING id` appending from PostgresAdapter
**Estimated Duration:** 75 minutes
**Dependencies:** None

### ISSUE-#63a — Remove auto-appending from `PostgresAdapter.run()`

- [ ] Edit `src/models/postgres.adapter.ts:25-35`
  - Delete the `if (/^\s*INSERT\b/i.test(sql) && !/\bRETURNING\b/i.test(sql))` block
  - Delete `sql += ' RETURNING id';`
  - Keep the `result.rows[0]?.id ?? 0` fallback (callers who add `RETURNING id` will still get the value)
  - Estimated: 5 min

### ISSUE-#63b — Remove auto-appending from `TransactionPreparedStatement.run()`

- [ ] Edit `src/models/postgres.adapter.ts:124-134`
  - Delete the same `INSERT` + `RETURNING` detection block
  - Keep the `result.rows[0]?.id ?? 0` fallback
  - Estimated: 5 min

### ISSUE-#63c — Add `RETURNING id` to service INSERTs that need `lastInsertRowid`

- [ ] Update `src/services/evaluation.service.ts:43`
  - Append ` RETURNING id` to the `INSERT INTO evaluations` SQL string
  - Estimated: 5 min

- [ ] Update `src/services/evaluation.service.ts:156`
  - Append ` RETURNING id` to the `INSERT INTO evaluation_results` SQL string
  - Estimated: 5 min

- [ ] Update `src/services/api-key.service.ts:41`
  - Append ` RETURNING id` to the `INSERT INTO api_keys` SQL string
  - Estimated: 5 min

- [ ] Update `src/services/log.service.ts:42`
  - Append ` RETURNING id` to the `INSERT INTO logs` SQL string
  - Estimated: 5 min

### ISSUE-#63d — Update `postgres.adapter.test.ts`

- [ ] Remove or update any test that asserts automatic `RETURNING id` appending
- [ ] Add a test asserting that `run()` with an INSERT lacking `RETURNING` does NOT append it
- [ ] Add a test asserting that `run()` with an INSERT that includes `RETURNING id` correctly returns the id
- [ ] Estimated: 20 min

### ISSUE-#63e — Build and test

- [ ] Run `npm run build` and verify zero TypeScript errors
  - Estimated: 5 min

- [ ] Run `npm test` and verify zero failures
  - Estimated: 10 min

### ISSUE-#63f — Commit

- [ ] `git commit -m "fix(postgres): remove automatic RETURNING id appending, require explicit caller opt-in (#63)"`
  - Estimated: 5 min

---

## Acceptance Criteria

- [ ] `npm run build` succeeds with zero TypeScript errors
- [ ] `npm test` reports all tests passing
- [ ] Fresh PostgreSQL database initialization works (migrations table INSERT succeeds)
- [ ] Services that need `lastInsertRowid` still get it when they include `RETURNING id`

---

*Task list generated on 2026-04-28.*
