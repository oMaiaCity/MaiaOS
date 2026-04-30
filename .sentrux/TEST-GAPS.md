# Test gaps (Sentrux `test_gaps` MCP)

Sentrux reports many **untested** source files vs test files. Treat this as a **backlog**, not a one-shot requirement.

## How to refresh the list

In Cursor with Sentrux MCP enabled, after `scan` on the repo root, call **`test_gaps`** (optionally `limit: 25`). Prioritize:

1. **`libs/maia-db`** and **`libs/maia-runtime`** — core data path
2. **`libs/maia-peer`** / **`libs/maia-sync`-related** imports
3. Hot paths surfaced by **`git_stats`** (change coupling)

## Done in repo (incremental)

- [`libs/maia-db/tests/resolve-helpers.test.js`](../libs/maia-db/tests/resolve-helpers.test.js) — coverage for helpers moved from runtime (guards `readStore`, `resolveToCoId`, etc.).

## Next

Add tests for the next **N** files returned by `test_gaps` after each structural refactor; do not block features on 100% coverage.
