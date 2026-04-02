# Sync Server Readiness Architecture

How we ensure the WebSocket client connects successfully on first sign-in, without client-side polling hacks.

## Problem

- **Sync** (port 4201) has async init: PGlite, agent worker, syncHandler. Until ready, `/sync` returns 503.
- **App** (client) connects to `ws://localhost:4201/sync` as soon as the page loads.
- If the client connects before sync is ready → "bad response from server" → noisy error, 3–5s until retry succeeds.

## Design Principle

**Readiness is an orchestration concern, not a client concern.**

The client assumes the server is ready when it connects. Orchestration (dev script, deployment, health checks) ensures that guarantee.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Dev (bun dev)                                                   │
│                                                                  │
│  1. Start sync (spawn, async init begins)                        │
│  2. Poll GET /health until ready: true                           │
│  3. Start app (user can load page; sync is ready)                │
│                                                                  │
│  → No client polling. No "bad response" on first load.            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Production (Fly.io)                                             │
│                                                                  │
│  - fly.toml health check: path = "/health"                        │
│  - Instance receives traffic only after healthy                   │
│  - Client connects to an already-ready instance                  │
│                                                                  │
│  → Platform enforces readiness. No extra logic.                   │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Health Endpoint (sync)

`GET /health` returns:

```json
{ "status": "ok", "service": "sync", "ready": true }
```

- `ready: true` only when `syncHandler` is set (PGlite loaded, agent created).
- Server listens immediately; `ready` reflects async init completion.

### 2. Dev Orchestration (scripts/dev.js)

```javascript
await startSync()
await waitForServiceReady('http://localhost:4201/health')
await startApp()
```

- `waitForServiceReady` polls `/health` until `ready: true` or timeout.
- On timeout: app still starts; WebSocket retries (existing behavior).
- Orchestration lives at the dev boundary; no client code changes.

### 3. Client (sync-peers.js)

- Connects immediately when enabled.
- No polling, no health checks.
- `WebSocketPeerWithReconnection` handles transient failures (retries, backoff).

## Why Not Client-Side Polling?

| Approach            | Issue                                      |
|---------------------|--------------------------------------------|
| Client polls /health| Polling lives in app; mixes orchestration with runtime |
| Client waits before connect | Delays every load; unnecessary when server is ready |
| Server queues connections | More complex; readiness at orchestration is simpler |

Orchestration (who starts what, when) belongs at process boundaries. The client’s job is to connect and retry on failure.

## Contracts

1. **Sync** exposes `/health` with `ready` reflecting sync handler availability.
2. **dev** ensures the app starts only after sync is ready (or timeout).
3. **production** uses platform health checks so traffic reaches ready instances only.
4. **client** connects; retries on failure; no readiness probing.
