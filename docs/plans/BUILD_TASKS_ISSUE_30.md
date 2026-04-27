# Build Tasks: Issue #30 — PostgreSQL Migrations Fail Because db.exec() Is Not Awaited

**Status:** Proposed — Awaiting Approval
**Plan:** `docs/plans/issue-30-resolution-plan.md`
**Date:** 2026-04-27

---

## Epic 0: Interface Normalization

### 0.1 Update `src/models/database.interface.ts`
- [ ] **0.1.1** Open `src/models/database.interface.ts`
- [ ] **0.1.2** Change `exec(sql: string): void | Promise<void>` to `exec(sql: string): Promise<void>`
- [ ] **0.1.3** Change `close(): void | Promise<void>` to `close(): Promise<void>`
- [ ] **0.1.4** Change `transaction<T>(fn: (db: DatabaseAdapter) => T | Promise<T>): T | Promise<T>` to `transaction<T>(fn: (db: DatabaseAdapter) => T | Promise<T>): Promise<T>`
- [ ] **0.1.5** Build and verify TypeScript compilation

### 0.2 Update `migrations/dialect-helpers.ts`
- [ ] **0.2.1** Open `migrations/dialect-helpers.ts`
- [ ] **0.2.2** Remove the local `DatabaseAdapter` interface
- [ ] **0.2.3** Add `import { DatabaseAdapter } from '../src/models/database.interface';`
- [ ] **0.2.4** Build and verify TypeScript compilation

### 0.3 Update `src/models/sqlite.adapter.ts`
- [ ] **0.3.1** Open `src/models/sqlite.adapter.ts`
- [ ] **0.3.2** Change `exec(sql: string): void` to `async exec(sql: string): Promise<void>`
- [ ] **0.3.3** Change `close(): void` to `async close(): Promise<void>`
- [ ] **0.3.4** Change `transaction<T>(fn): T | Promise<T>` to `async transaction<T>(fn): Promise<T>`
  - Wrap the synchronous return branch: `return Promise.resolve(result)` instead of `return result`
  - Keep the existing promise branch unchanged (it already returns a Promise)
- [ ] **0.3.5** Build and verify TypeScript compilation

---

## Epic 1: Migration Fixes

### 1.1 Fix `migrations/001_initial_schema.ts`
- [ ] **1.1.1** Open `migrations/001_initial_schema.ts`
- [ ] **1.1.2** In `up()`: Change `db.exec(\`` to `await db.exec(\``
- [ ] **1.1.3** In `down()`: Change `db.exec(\`` to `await db.exec(\``
- [ ] **1.1.4** Build and verify TypeScript compilation

### 1.2 Fix `migrations/002_add_ollama_columns.ts`
- [ ] **1.2.1** Open `migrations/002_add_ollama_columns.ts`
- [ ] **1.2.2** In `up()`: Change `db.exec(\`` to `await db.exec(\``
- [ ] **1.2.3** In `down()`: Change `db.exec(\`` to `await db.exec(\``
- [ ] **1.2.4** Build and verify TypeScript compilation

### 1.3 Fix `migrations/003_add_key_expiration.ts`
- [ ] **1.3.1** Open `migrations/003_add_key_expiration.ts`
- [ ] **1.3.2** In `up()`: Change `db.exec(\`` to `await db.exec(\``
- [ ] **1.3.3** In `down()`: Change `db.exec(\`` to `await db.exec(\``
- [ ] **1.3.4** Build and verify TypeScript compilation

### 1.4 Fix `migrations/004_add_evaluations.ts`
- [ ] **1.4.1** Open `migrations/004_add_evaluations.ts`
- [ ] **1.4.2** In `up()`: Change `db.exec(\`` to `await db.exec(\``
- [ ] **1.4.3** In `down()`: Change `db.exec(\`` to `await db.exec(\``
- [ ] **1.4.4** Build and verify TypeScript compilation

### 1.5 Fix `migrations/005_add_workspace_id.ts`
- [ ] **1.5.1** Open `migrations/005_add_workspace_id.ts`
- [ ] **1.5.2** In `up()`: Change `db.exec(\`` to `await db.exec(\``
- [ ] **1.5.3** In `down()`: Change `db.exec(\`` to `await db.exec(\``
- [ ] **1.5.4** Build and verify TypeScript compilation

### 1.6 Fix `migrations/006_add_trace_created_index.ts`
- [ ] **1.6.1** Open `migrations/006_add_trace_created_index.ts`
- [ ] **1.6.2** In `up()`: Change `db.exec(\`` to `await db.exec(\``
- [ ] **1.6.3** In `down()`: Change `db.exec(\`` to `await db.exec(\``
- [ ] **1.6.4** Build and verify TypeScript compilation

---

## Epic 2: Verification

### 2.1 Full Build
- [ ] **2.1.1** Run `npm run build`
- [ ] **2.1.2** Confirm no TypeScript errors

### 2.2 Test Suite
- [ ] **2.2.1** Run `npm test` (all 33 test suites)
- [ ] **2.2.2** Confirm all 231 tests pass
- [ ] **2.2.3** Confirm SQLite migration tests pass (no regression)

### 2.3 Spot Check
- [ ] **2.3.1** Grep for `\.exec\(` in `migrations/` and confirm every call is preceded by `await`
- [ ] **2.3.2** Grep for `db\.exec\(` in `src/` and confirm callers already await or are not affected

---

## Epic 3: Release

### 3.1 Version Bump
- [ ] **3.1.1** Bump version in `package.json` to `1.0.9`
- [ ] **3.1.2** Add v1.0.9 entry to `CHANGELOG.md`

### 3.2 Commit and Push
- [ ] **3.2.1** Commit with message: `fix(migrations): await db.exec() in all migrations and normalize exec() to Promise<void> (#30)`
- [ ] **3.2.2** Push to `origin/main`

### 3.3 Close Issue
- [ ] **3.3.1** Close GitHub issue #30 with reference to commit

### 3.4 Publish
- [ ] **3.4.1** Run `npm publish`
- [ ] **3.4.2** Verify `promptmetrics@1.0.9` is on npm

---

*Generated from `issue-30-resolution-plan.md` — Epic 0-3.*
