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
- `POST /register-human`, `GET /profile` - Agent API
- `POST /api/v0/llm/chat` - LLM proxy (RedPill)

## Environment Variables

- `AVEN_MAIA_ACCOUNT`, `AVEN_MAIA_SECRET` - Required (run `bun agent:generate`)
- `PEER_SYNC_STORAGE=pglite | postgres` (required - server never runs without persistent storage)
- `PEER_DB_PATH` - Default: `./local-sync.db` (pglite). Ignored when `postgres`.
- `PEER_DB_URL` - Required when `PEER_SYNC_STORAGE=postgres` (e.g. Fly Postgres)
- `AVEN_MAIA_GUARDIAN` - Optional. If set (human account co-id), add as admin on startup (one-time genesis).
- `PEER_SYNC_SEED` - Set `true` for genesis seed (bootstrap + schemas + avens). Default: `false`.

## Dependencies

- `@MaiaOS/maia-distros` + `@MaiaOS/loader`. Sync imports only from loader; loader re-exports schemata, tools, avens, cojson-transport-ws. maia-distros has no app logic—only bundling. Sync owns the logic (src/index.js); distros bundles it to sync-server.mjs. Prod runs the bundle; dev runs source.

## Development

```bash
bun run dev:sync
```

## Endpoints

- `GET /health` - Health check
- `GET /syncRegistry` - Sync registry (°Maia spark co-id)
- `WS /sync` - WebSocket sync
- `POST /register-human`, `GET /profile` - Agent API
- `POST /api/v0/llm/chat` - LLM proxy

## Client Usage

Clients connect via kernel bundle, which automatically connects to the sync server:

```javascript
import { signUpWithPasskey, setupSyncPeers, subscribeSyncState } from '@MaiaOS/loader'

// Sync server is used automatically - no API key needed
const { node, account } = await signUpWithPasskey()

// Peer setup and sync state are handled automatically via kernel bundle
```

The client connects directly to sync (CORS enabled). Sync server URL:
- **Dev**: `localhost:4201` (app on 4200, sync on 4201)
- **Production**: `VITE_PEER_SYNC_HOST` (build-time, e.g. sync.next.maia.city)

## Storage

The sync server requires persistent storage (never in-memory or sync-only):

- **PGlite** (`PEER_SYNC_STORAGE=pglite`): Local WASM Postgres. Dev: `./local-sync.db`, prod: `/data/sync.db`.
- **Postgres** (`PEER_SYNC_STORAGE=postgres`): Remote Postgres via `PEER_DB_URL` (e.g. Fly Postgres).

## How It Works

1. **Sync Service LocalNode**: Creates a LocalNode instance with an agent account (sync service is a participant in the CoJSON network)
2. **PGlite Storage**: Uses PGlite (PostgreSQL-compatible) for persistent storage of all CoValue transactions
3. **WebSocket Peers**: Each client connection creates a peer via `createWebSocketPeer`
4. **Automatic Sync**: cojson's `SyncManager` handles all sync protocol automatically
5. **Message Routing**: cojson routes messages between peers based on what they need

## Deployment

Deploy the sync service separately from the frontend. The frontend connects to it via WebSocket.

Generate credentials using:
```bash
bun agent:generate --service sync
```

**Note**: Uses PGlite for persistent storage. All data persists across server restarts. For production, deploy with a Fly.io volume mounted at `/data`.
