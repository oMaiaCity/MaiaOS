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
- `POST /on-added`, `/register-human`, `/trigger`, `/profile` - Agent API
- `POST /api/v0/llm/chat` - LLM proxy (RedPill)

## Environment Variables

**Compact format** (preferred):
- `ACCOUNT_MODE=agent`
- `AGENT_ID` - Agent account ID (required)
- `AGENT_SECRET` - Agent secret (required)
- `AGENT_STORAGE=pglite` - Storage backend
- `DB_PATH` - PGlite path (default: `./local-sync.db` for dev, `/data/sync.db` for production)
- `PORT` - Server port (default: 4201)
- `RED_PILL_API_KEY` - Optional, for LLM chat

## Development

```bash
# Run sync service
bun dev:sync

# Or from root
bun --env-file=.env --filter sync dev
```

## Endpoints

- `GET /health` - Health check
- `WS /sync` - WebSocket sync
- `POST /on-added`, `/register-human`, `/trigger`, `/profile` - Agent API
- `POST /api/v0/llm/chat` - LLM proxy

## Client Usage

Clients connect via kernel bundle, which automatically connects to the sync server:

```javascript
import { signUpWithPasskey, setupSyncPeers, subscribeSyncState } from '@MaiaOS/kernel'

// Sync server is used automatically - no API key needed
const { node, account } = await signUpWithPasskey()

// Peer setup and sync state are handled automatically via kernel bundle
```

The client determines the sync server URL based on:
- **Dev**: Relative path `/sync` (Vite proxy forwards to `localhost:4201`)
- **Production**: `PUBLIC_API_DOMAIN` env var or same origin

## Storage

The sync server uses **PGlite (PostgreSQL-compatible) storage** for persistence:
- **Local dev**: Database stored at `./local-sync.db` (default)
- **Production**: Database stored at `/data/sync.db` on Fly.io volume
- **Persistence**: All CoValue transactions are persisted across server restarts
- **Migration path**: Easy migration to Fly Postgres when scaling to multiple machines

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
