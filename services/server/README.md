# Server Service

Self-hosted sync server using cojson LocalNode for reliable, direct sync without external dependencies.

## Architecture

The server service provides a self-hosted sync server:
- **Client** connects to: `ws://localhost:4203/sync` (or production domain)
- **Service** uses cojson LocalNode to handle sync protocol directly
- **Service** stores all CoValue transactions in SQLite database
- **No external dependencies** - no API keys or third-party services needed

This architecture ensures:
- ✅ Reliable sync without proxy layer complexity
- ✅ No external API key dependency
- ✅ Direct sync protocol handling via cojson
- ✅ Persistent storage in SQLite
- ✅ Simpler, more maintainable code

## Library

The sync server logic is implemented in `@MaiaOS/sync` library (`libs/maia-sync/`), making it reusable across services.

## Environment Variables

- `DB_PATH` - PGlite database path (default: `./local-sync.db` for dev, `/data/sync.db` for production)
- `PORT` - Server port (default: 4203)

## Development

```bash
# Run server service
bun dev:server

# Or from root
bun --env-file=.env --filter server dev
```

## Endpoints

- `GET /health` - Health check endpoint
- `WS /sync` - WebSocket sync server endpoint

## Client Usage

Clients connect via `@MaiaOS/self` library, which automatically connects to the sync server:

```javascript
import { signUpWithPasskey } from '@MaiaOS/self'

// Sync server is used automatically - no API key needed
const { node, account } = await signUpWithPasskey()
```

The client determines the sync server URL based on:
- **Dev**: Relative path `/sync` (Vite proxy forwards to `localhost:4203`)
- **Production**: `PUBLIC_API_DOMAIN` env var or same origin

## Storage

The sync server uses **PGlite (PostgreSQL-compatible) storage** for persistence:
- **Local dev**: Database stored at `./local-sync.db` (default)
- **Production**: Database stored at `/data/sync.db` on Fly.io volume
- **Persistence**: All CoValue transactions are persisted across server restarts
- **Migration path**: Easy migration to Fly Postgres when scaling to multiple machines

## How It Works

1. **Server-side LocalNode**: Creates a LocalNode instance without an account (server is relay, not participant)
2. **PGlite Storage**: Uses PGlite (PostgreSQL-compatible) for persistent storage of all CoValue transactions
3. **WebSocket Peers**: Each client connection creates a peer via `createWebSocketPeer`
4. **Automatic Sync**: cojson's `SyncManager` handles all sync protocol automatically
5. **Message Routing**: cojson routes messages between peers based on what they need

## Deployment

Deploy the server service separately from the frontend. The frontend connects to it via WebSocket.

**Note**: Uses PGlite for persistent storage. All data persists across server restarts. For production, deploy with a Fly.io volume mounted at `/data`.
