# @MaiaOS/logs

Structured logging for MaiaOS: **PERF**, **TRACE**, **DEBUG**, and **OPS** channels.

## Channels

| Channel | Purpose |
|--------|---------|
| **PERF** | Timings (`createPerfTracer`, pipeline/chat/upload keys) |
| **TRACE** | Engine tracing (`traceView`, `traceInbox`, `traceProcess`) |
| **DEBUG** | Feature-gated (`debugLog` / `debugWarn`, channel keys in `log-config`) |
| **OPS** | Node/server lifecycle, storage, sync; `createOpsLogger(subsystem)` and `OPS_PREFIX` for stable bracket tags |

## Configuration

**Env only (no `localStorage` for gating):** set **`LOG_MODE`** in the repo root **`.env`**, or prefix the command: `LOG_MODE=debug.all bun dev`.

On **localhost**, `services/app` exposes **`/__maia_env`** so the client applies PERF / TRACE / DEBUG **in memory** before app boot. Empty or `off` / `none` / `0` / `false` → all three off.

**Token examples** (comma / semicolon / whitespace separated; see `src/log-mode.js` for full rules):

| Kind | Examples |
|------|----------|
| PERF | `perf.all`, `perf.engines.pipeline`, `engines:pipeline` |
| TRACE | `trace.all` |
| DEBUG | `debug.all`, `debug.engines.loadBinary`, `debug.app.cobinary` |

**OPS** is not gated by `LOG_MODE`. Loggers use bracket prefixes such as `[sync]`, `[Storage]`, `[STORAGE]`, `[peer]`, `[ValidationHook]`, `[ActorEngine]`, `[ViewEngine]`.

## Shared prefixes (`OPS_PREFIX`)

Export **`OPS_PREFIX`** from this package so grep and orchestration stay aligned:

- **`scripts/dev.js`** imports it (via `../libs/maia-logs/src/index.js`) to detect sync readiness lines without hardcoding `[sync]`.
- **`throw new Error(\`…\`)`** and user-facing strings that must remain stable should use the same prefixes (e.g. `` `${OPS_PREFIX.sync} …` ``).

Do not duplicate raw `[sync]` / `[STORAGE]` strings outside this package for new code.

## Workspace

Add to `package.json`:

```json
"@MaiaOS/logs": "workspace:*"
```

Run `bun install` from the repo root after changing dependencies.
