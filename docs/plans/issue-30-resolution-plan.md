# Issue Resolution Plan: PostgreSQL Migrations Fail Because db.exec() Is Not Awaited (#30)

**Date:** 2026-04-27
**Status:** Proposed — Awaiting Approval
**Agents Consulted:** AI Engineer, Software Architect

---

## Executive Summary

Issue #30 reports that PostgreSQL migrations fail randomly with `relation "X" does not exist` because all 6 migration files call `db.exec(sql)` without `await`. `SqliteAdapter.exec()` is synchronous (`void`), but `PostgresAdapter.exec()` is asynchronous (`Promise<void>`). Umzug sees the async `up()` function return immediately, logs the migration as completed, and the SQL executes in the background. Subsequent migrations then run against a database that hasn't finished applying the prior DDL.

**In short: the `void | Promise<void>` union type on `DatabaseAdapter.exec()` is a footgun that silently drops PostgreSQL promises.**

This plan normalizes the adapter interface to always return `Promise<void>`, making the async contract explicit and turning the bug into a compile-time error.

---

## Problem Inventory

| Issue | Severity | Layer | Description |
|-------|----------|-------|-------------|
| `db.exec(sql)` without `await` in migrations | **Blocking** | Migrations | 12 call sites across 6 files; causes random DDL ordering failures on Postgres |
| `void \| Promise<void>` return type on `exec()` | **Root Cause** | Interface | Union type masks dialect difference; TypeScript can't flag unawaited calls |
| Duplicate `DatabaseAdapter` interface | Risk | Migrations | `migrations/dialect-helpers.ts` defines its own copy of the interface |

---

## Architectural Decision

**ADR-00Y: Normalize `DatabaseAdapter.exec()` to always return `Promise<void>`.**

### Why Approach B (Interface Fix) over Approach A (Minimal Fix)

| Dimension | Approach A: Minimal Fix | Approach B: Interface Fix |
|-----------|------------------------|---------------------------|
| What changes | Add `await` to 12 calls in 6 migrations | Change `exec()` to `Promise<void>`, update `SqliteAdapter`, add `await` to migrations |
| Blast radius | 6 migration files | Interface, `SqliteAdapter`, `dialect-helpers.ts`, 6 migrations |
| Future bugs prevented | No — the interface still allows dropping a Promise | Yes — TypeScript enforces `await` on every `exec()` call |
| SQLite impact | None | Negligible (`SqliteAdapter.exec()` returns `Promise.resolve()`) |
| Backward compatibility | Zero risk | Very low; no production code outside migrations calls `exec()` |

**Rationale:** The project already committed to supporting PostgreSQL. Once an async driver exists, the adapter abstraction should present an honest async contract. Making `exec()` universally `Promise<void>` turns a runtime failure into a compile-time error. The blast radius is small, the SQLite overhead is negligible, and the fix eliminates the entire class of "forgot to await DDL" bugs.

### Optional: Normalize `close()` and `transaction()` for consistency

`close()` and `transaction()` also use union return types (`void | Promise<void>` and `T | Promise<T>`). They are currently safe because all callers already `await` them. Normalizing them to always return `Promise<void>` / `Promise<T>` is low-risk and eliminates the category of risk entirely. This is recommended as part of the same fix.

### Consolidate duplicate `DatabaseAdapter` interface

`migrations/dialect-helpers.ts` defines its own `DatabaseAdapter` interface with only `exec()` and `dialect`. The canonical interface lives in `src/models/database.interface.ts`. The fix should either:
- Import the canonical interface into `dialect-helpers.ts`, OR
- Update the local interface to match and add a TODO to consolidate later

Importing is preferred because `database.interface.ts` has no external imports and is safe to reference from `migrations/`.

---

## Implementation Strategy

### Phase 1: Interface Normalization
1. Update `src/models/database.interface.ts`:
   - `exec(sql: string): Promise<void>`
   - `close(): Promise<void>`
   - `transaction<T>(fn): Promise<T>`
2. Update `migrations/dialect-helpers.ts` to import the canonical `DatabaseAdapter` from `../src/models/database.interface.ts`
3. Update `src/models/sqlite.adapter.ts`:
   - Make `exec()` async
   - Make `close()` async
   - Make `transaction()` return `Promise<T>` (wrap sync branch in `Promise.resolve()`)

### Phase 2: Migration Fixes
4. Add `await` to all 12 `db.exec(...)` calls across the 6 migration files

### Phase 3: Verification
5. Build compiles cleanly (`npm run build`)
6. All tests pass (`npm test`)
7. Verify backward compatibility: SQLite migrations still work correctly with the now-async `exec()`

---

## Success Metrics

- [ ] `npm run build` compiles cleanly
- [ ] All 33 test suites pass (231 tests)
- [ ] SQLite migrations work correctly (no regression)
- [ ] `DatabaseAdapter.exec()` always returns `Promise<void>`
- [ ] No `db.exec()` calls in migrations without `await`

---

## Related Work

- Issue #29: The PostgreSQL migration infrastructure was added in v1.0.7. Issue #30 is a follow-up bug discovered after that release.

---

*Plan generated by AI Engineer & Software Architect agent analysis.*
*Proposed 2026-04-27.*
