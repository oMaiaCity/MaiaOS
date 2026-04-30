# Sync Service

Self-hosted sync service using cojson LocalNode for reliable, direct sync without external dependencies.

## Architecture

The sync service provides a self-hosted sync server:
- **Client** connects to: `ws://localhost:4201/sync` (or production domain)
- **Service** uses cojson LocalNode to handle sync protocol directly
- **Service** stores all CoValue transactions in SQLite database
- **No external dependencies** - no API keys or third-party services needed

This architecture ensures:
- ✅ Reliable sync without proxy layer complexity
- ✅ No external API key dependency
- ✅ Direct sync protocol handling via cojson
- ✅ Persistent storage in SQLite
- ✅ Simpler, more maintainable code

## Unified Service

The sync service consolidates WebSocket sync, agent API, and LLM proxy in one process. Endpoints:
- `WS /sync` - CoJSON sync
- `POST /bootstrap` - Unified one-shot handshake for humans + agents: returns `sparks` co-id so the client can anchor `account.sparks`; atomically promotes the guardian (if applicable) and writes the human identity index entry (idempotent).
- `POST /register` - Register **spark** or **aven** in the shared registries (not used for humans; humans go through `/bootstrap`)
- `POST /api/v0/llm/chat` - LLM proxy (RedPill)

## Environment Variables

- `AVEN_MAIA_ACCOUNT`, `AVEN_MAIA_SECRET` - Required (run `bun agent:generate`)
- `PEER_SYNC_STORAGE=pglite | postgres` (required - server never runs without persistent storage)
- `PEER_DB_PATH` - Default: `./pg-lite.db` (pglite). Ignored when `postgres`.
- `PEER_BLOB_PATH` - Default: `./binary-bucket` (binary CoValue offload). Ignored when `BUCKET_NAME` set (Tigris).
- `PEER_SYNC_DB_URL` - Required when `PEER_SYNC_STORAGE=postgres` (e.g. Neon, Fly Postgres). Prefer Neon’s **pooler** host (`…-pooler…`) and `sslmode=require` in the URL. The storage adapter uses Bun `SQL` with a **connection pool** for non-transaction queries; **transactions** use `sql.begin()` (reserved connection), so the pool is not limited to a single `max` for correctness. Resilience: default `maxLifetime` 15 minutes (Bun jitter), one **pool** query retry on hard connection loss, one **`sql.begin` retry** on lifetime/idle checkout failures. Tune: `PEER_PG_MAX` (default 5), `PEER_PG_MAX_LIFETIME_SEC` (set to `0` to disable client-side `maxLifetime`), `PEER_PG_CONNECT_TIMEOUT_SEC`.
- `AVEN_MAIA_GUARDIAN` - Optional. If set (human account co-id), add as admin on startup (one-time genesis).
- `PEER_SYNC_SEED` - **Only** env gate for **genesis**: required one boot when `account.sparks` is missing; also allows optional re-genesis when scaffold exists (unset after one-shot). **Local dev only** (`NODE_ENV` not production, `PEER_SYNC_STORAGE=pglite`, `BUCKET_NAME` unset): sync clears the PGlite data dir and `./binary-bucket` before load, generates new Aven Tester credentials in-memory, then **writes tester + guardian lines to repo `.env` after** startup succeeds (avoids tools that restart when `.env` changes mid-boot). **Production, Postgres/Neon, or Tigris:** no automatic storage or credential rotation. Startup/bootstrap flows: `@MaiaOS/flows`.
- `PEER_APP_HOST` - Allowed **browser** origin for CORS and WebSocket upgrade (e.g. `https://next.maia.city`). **Required in production** (`NODE_ENV=production`); the service exits on boot if missing. For Fly, [`fly.toml`](fly.toml) sets `[env] PEER_APP_HOST` (not a secret). If sync crashes during init, the edge often returns **502**; browsers then report **CORS** failures because the error response is not the app’s CORS success path. Fix the process crash (or health) first; then confirm this origin matches the app you load.

## Dependencies

- `@MaiaOS/db`, `@MaiaOS/flows` (subpaths where possible), `@MaiaOS/logs`, `@MaiaOS/self`, `@MaiaOS/maia-ucan`, `@MaiaOS/runtime` (`sync-core` / `sync-auth` only — no runtime root barrel), `@MaiaOS/storage`, `@MaiaOS/maia-distros`. maia-distros has no app logic—only bundling. Sync owns HTTP/WS (`src/index.js`); distros bundles it to `sync-server.mjs`. Prod runs the bundle; dev runs source.

## Development

```bash
bun run dev:sync
```

## Endpoints

- `GET /health` - Health check
- `POST /bootstrap` - Body `{ accountId, profileId }` → `{ sparks }` (co-id for `account.sparks` anchoring). Atomic and idempotent: guardian promotion + capability seed + human identity index entry happen server-side. `°maia` is NOT returned — it is written once at genesis inside the sparks CoMap and reaches the client via normal CoJSON sync. (Rate-limited.)
- `WS /sync` - CoJSON sync (open read, protected write)
- `POST /register` - `type: spark | aven` only (registry rows for non-human identities)
- `POST /api/v0/llm/chat` - LLM proxy (UCAN-protected)

## Sync Access Control

- **Read**: Open — anyone can connect and receive data.
- **Write**: Protected — only accounts with `/sync/write` capability can push transactions.
- **Capability**: Granted in-app when a **guardian approves** the member (Capabilities UI) — not via `POST /register`. Humans without `/sync/write` stay read-only until approved.

## Client Usage

Clients connect via kernel bundle, which automatically connects to the sync server:

```javascript
import {
	bootstrapAccountHandshake,
	MaiaOS,
	signIn,
} from '@MaiaOS/runtime'

// Sync server is used automatically - no API key needed
const { loadingPromise } = await signIn({ type: 'passkey', mode: 'signup' })
const { node, account } = await loadingPromise

// Single POST /bootstrap call anchors account.sparks (trusting) + triggers server-side identity write.
await bootstrapAccountHandshake(account, { syncBaseUrl, node })

const maia = await MaiaOS.boot({ node, account })
```

The client connects directly to sync (CORS enabled). Sync server URL:
- **Dev**: `localhost:4201` (app on 4200, sync on 4201)
- **Production**: `VITE_PEER_SYNC_HOST` (build-time, e.g. sync.next.maia.city)

## Storage

The sync server requires persistent storage (never in-memory or sync-only):

- **PGlite** (`PEER_SYNC_STORAGE=pglite`): Local WASM Postgres. Dev: `./pg-lite.db`, prod: `/data/sync.db`.
- **Postgres** (`PEER_SYNC_STORAGE=postgres`): Remote Postgres via `PEER_SYNC_DB_URL` (e.g. Neon, Fly Postgres).

## How It Works

1. **Sync Service LocalNode**: Creates a LocalNode instance with an agent account (sync service is a participant in the CoJSON network)
2. **PGlite Storage**: Uses PGlite (PostgreSQL-compatible) for persistent storage of all CoValue transactions
3. **WebSocket Peers**: Each client connection creates a peer via `createWebSocketPeer`
4. **Automatic Sync**: cojson's `SyncManager` handles all sync protocol automatically
5. **Message Routing**: cojson routes messages between peers based on what they need

## Debugging: CoValue timeout (502 on `/bootstrap`)

Postgres (Neon) uses the CoJSON schema from `libs/maia-storage` (`covalues`, `sessions`, `transactions`, etc.). If logs show `Timeout waiting for CoValue co_z…` during `resolveSystemFactories` / `buildSystemFactoryCoIdsFromSparkOs`, run the following in the **same** database as `PEER_SYNC_DB_URL` (use Neon’s SQL editor for the project/branch the Fly app points at):

```sql
-- Header present?
SELECT "rowID", id, left(header, 500) AS header_preview
FROM covalues
WHERE id = 'co_zYOURID';

-- Any session rows to replay (join on serial rowID)?
SELECT s."rowID", s."sessionID", s."lastIdx"
FROM covalues c
JOIN sessions s ON s."coValue" = c."rowID"
WHERE c.id = 'co_zYOURID';
```

- **0 rows in `covalues`:** id never persisted, or you queried the wrong Neon database/branch.
- **Row + sessions exist** but startup used to time out: the id can still be **listed in the spark OS factory catalog** while the runtime never marks the CoValue “available” (e.g. ruleset edge cases). Current `@MaiaOS/db` builds **skip** that catalog def after logging (`maia-db.factory-os` warnings) so the process stays up; per-def wait is **capped (a few seconds)** so many bad ids do not block WebSocket for minutes—repair data if a factory is missing at runtime.
- **Tigris / `BUCKET_NAME`:** large/binary payloads may be offloaded. If `header` indicates `meta.type === 'binary'`, check the object store for that environment (missing blob can block load even when Postgres has a row).
- **Soft delete flag:** `SELECT * FROM deletedcovalues WHERE "coValueID" = 'co_zYOURID';`

## Deployment

Deploy the sync service separately from the frontend. The frontend connects to it via WebSocket.

Generate credentials using:
```bash
bun agent:generate --service sync
```

**Note**: Uses PGlite for persistent storage. All data persists across server restarts. For production, deploy with a Fly.io volume mounted at `/data`.
