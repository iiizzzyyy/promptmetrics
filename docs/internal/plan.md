# Plan: Post-Dry Run — Fix README Friction + Local Beta Tester

## Context

The automated dry run is complete. All 145 tests pass, Docker compose smoke tests pass, and the README quickstart takes ~44 seconds on a clean clone. One friction point was found: for users cloning the repo (not `npm install -g`), the SQLite database must be initialized before generating an API key. The README quickstart currently only shows the global npm install path where `promptmetrics-server` auto-initializes the DB.

## Goal

Fix the documentation friction, then get a local beta tester to validate the quickstart on this machine without help. Only push to GitHub after human validation passes.

## Remaining Steps

### 1. Fix README for Git Clone / Local Dev Path

**File:** `README.md`

**Problem:** The quickstart jumps from `npm install -g promptmetrics` to `node dist/scripts/generate-api-key.js`. A git clone user who runs `npm install && npm run build` will fail at the generate-api-key step because `api_keys` table doesn't exist yet.

**Fix:** Add a "From Source / Local Development" quickstart section that includes:
1. `git clone <repo>`
2. `cd promptmetrics && npm install`
3. `npm run build`
4. `npm run db:init` (or start the server first in another terminal)
5. `node dist/scripts/generate-api-key.js default read,write`
6. Continue with existing CLI quickstart steps

Keep the existing `npm install -g` path as the primary quickstart since it's the fastest.

### 2. Prepare Clean Beta Tester Environment

The clean clone already exists at `/tmp/pm-fresh-test` from the dry run. However, it may have test artifacts. Prepare a fresh copy:
- Create `/tmp/pm-beta-test` with a clean copy of the source
- Ensure `node_modules/`, `data/`, `coverage/`, `.env`, `dist/`, and any `.tgz` files are excluded
- Verify `npm install && npm run build && npm test` passes there

### 3. Find a Local Beta Tester

Ask someone on this machine (or the user themselves acting as a naive user) to:
1. Open a terminal
2. `cd /tmp/pm-beta-test`
3. Follow the README quickstart exactly without asking questions
4. File any issues or confusion

**Instructions to give them:**
```
Hey, can you test something for me? I need to know if a brand-new user can follow the quickstart without getting stuck.

1. Open your terminal.
2. Run: cd /tmp/pm-beta-test
3. Open README.md and follow the "Quickstart" section exactly as written.
4. If anything is unclear, confusing, or breaks, tell me exactly what happened.
5. Do not Google anything or ask me questions — just tell me where you got stuck.
```

### 4. Triage Beta Feedback

After the tester reports back:
- If they got stuck on the DB init step → our README fix in step 1 should address it; verify they used the updated README
- If they got stuck on something else → fix it immediately
- If they completed it without help → mark the human beta test as passed

### 5. Final GitHub Push Prep

Once human validation passes:
1. Clean up `/tmp/pm-beta-test` and any other temp artifacts
2. Verify `.gitignore` excludes dev artifacts
3. Review `npm pack --dry-run` output
4. Commit all changes with a clear message
5. Push to GitHub

## What NOT to Do

- Don't push to GitHub before the human beta test passes
- Don't add new features — this is validation and docs only
- Don't skip the README fix even if the beta tester is a global npm install user; the git clone path must also work
