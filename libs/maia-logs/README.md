# @MaiaOS/logs

Single entry point for MaiaOS logging: **modes**, **levels**, **PERF / TRACE / DEBUG / OPS** channels, **redaction**, **ring buffer** (`getRecentLogs`), and a **pluggable transport** (default: pretty console in development, JSON lines in production).

## API

| Export | Role |
|--------|------|
| `createLogger(subsystem)` | `.error` / `.warn` / `.info` / `.log` / `.debug` / `.perf(name)` / `.child(sub)` — gated by `LOG_LEVEL` |
| `createOpsLogger(subsystem)` | OPS: `.warn` / `.error` always emit; informational `.log` gated by `LOG_MODE` (`ops.all`, `ops.sync`, …) |
| `isOpsInfoEnabled` / `isDevVerboseEnabled` | Read gates after `applyLogModeFromEnv` (used by orchestrator / tests) |
| `getOpsSubsystemForPrefixedLine` | Map a child log line prefix to an OPS subsystem (orchestrator) |
| `bootstrapNodeLogging()` | Node scripts: set mode/level from env + `installDefaultTransport()` |
| `installDefaultTransport()` | Browser after `applyMaiaLoggingFromEnv` / env applied |
| `applyMaiaLoggingFromEnv` + `resolveMaiaLoggingEnv` | Full env: `LOG_LEVEL`, `NODE_ENV`, `LOG_MODE` vs `LOG_MODE_PROD` |
| `setTransport` / `getTransport` | Replace or wrap the sink (e.g. remote logging later) |
| `getRecentLogs()` | Last 500 entries for diagnostics |
| `redact` | Strip secrets from string args (Bearer, `PEER_SECRET`, etc.) |
| `debugLog` / `debugWarn`, perf/trace helpers | Existing channel gates + `emitLog` |

## Modes (`resolveMode`)

| Mode | When | Default `LOG_LEVEL` |
|------|------|---------------------|
| `development` | Default in browser/Node when not production | `debug` |
| `production` | `NODE_ENV=production` or `import.meta.env.DEV === false` | `warn` |
| `test` | `NODE_ENV=test` | `silent` |

In **production**, PERF/TRACE/DEBUG channels follow **`LOG_MODE_PROD`** (not `LOG_MODE`), so verbose dev flags do not accidentally enable noise in prod.

## Env

| Variable | Purpose |
|----------|---------|
| `LOG_LEVEL` | `silent` \| `error` \| `warn` \| `info` \| `log` \| `debug` |
| `LOG_MODE` | Dev: comma-separated tokens — PERF/TRACE/DEBUG (`perf.all`, …), OPS (`ops.all`, `ops.sync`), `bun dev` passthrough (`dev.verbose`). **Empty** on **Node** (not `production`/`test`): OPS informational `.log` defaults **on**. **`off`**: all of that off. **`dev.verbose`** also enables **`ops.all`** so sync emits Listening lines. |
| `LOG_MODE_PROD` | Production-only channel string; required to enable PERF/TRACE/DEBUG in prod |
| `NODE_ENV` | Selects mode profile |

The app dev server exposes **`/__maia_env`** (`LOG_MODE`, `LOG_LEVEL`, `LOG_MODE_PROD`, `NODE_ENV`) so the SPA applies the same matrix before boot.

## Channels (PERF / TRACE / DEBUG)

**Token examples** (see `src/log-mode.js`):

| Kind | Examples |
|------|----------|
| PERF | `perf.all`, `perf.engines.pipeline`, `engines:pipeline` |
| TRACE | `trace.all` |
| DEBUG | `debug.all`, `debug.app.maia-db` |
| OPS (informational `.log` only) | `ops.all`, `ops.sync`, `ops.storage` (subsystem names match `createOpsLogger` case-insensitively) |
| Dev orchestrator | `dev.verbose` — root `bun dev` forwards piped Vite/sync output like split terminals |

**OPS** — `.warn` / `.error` always emit. Informational `.log` uses stable bracket tags via **`OPS_PREFIX`** for grep and `scripts/dev.js` passthrough when `LOG_MODE` enables that subsystem.

## Production client bundle

`services/app/build.js` sets `globalThis.__MAIA_DEBUG__` and `globalThis.__MAIA_STRIP__` to `false` and `drop: ['debugger']`. `createLogger().debug` returns early when those flags are false.

## Pretty console

In **non-JSON** mode, `[subsystem]` prefixes use **ANSI colors** when `stdout` is a TTY and **`NO_COLOR`** is unset (see `src/transports/console.js`). Disable with `NO_COLOR=1` or pipe output to a file.

## Lint

Biome **`suspicious/noConsole`** is **error** in this repo. Only `libs/maia-logs/src/transports/console.js` may call `console.*` directly.

## Workspace

```json
"@MaiaOS/logs": "workspace:*"
```

Run `bun install` from the repo root after changing dependencies.

## Tests

```bash
bun --filter @MaiaOS/logs test
```
