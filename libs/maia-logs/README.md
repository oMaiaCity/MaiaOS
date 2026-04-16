# @MaiaOS/logs

Single entry point for MaiaOS logging: **modes**, **levels**, **PERF / TRACE / DEBUG / OPS** channels, **redaction**, **ring buffer** (`getRecentLogs`), and a **pluggable transport** (default: pretty console in development, JSON lines in production).

## API

| Export | Role |
|--------|------|
| `createLogger(subsystem)` | `.error` / `.warn` / `.info` / `.log` / `.debug` / `.perf(name)` / `.child(sub)` — gated by `LOG_LEVEL` unless you use `createOpsLogger` |
| `createOpsLogger(subsystem)` | Operational lines (sync, storage, hooks); not suppressed by `LOG_LEVEL` |
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
| `LOG_MODE` | Dev: comma-separated PERF/TRACE/DEBUG tokens (`perf.all`, `debug.app.maia-db`, …) |
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

**OPS** (`createOpsLogger`) is not gated by `LOG_MODE`. Use stable bracket tags via **`OPS_PREFIX`** for grep and orchestration.

## Production client bundle

`services/app/build.js` sets `globalThis.__MAIA_DEBUG__` and `globalThis.__MAIA_STRIP__` to `false` and `drop: ['debugger']`. `createLogger().debug` returns early when those flags are false.

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
