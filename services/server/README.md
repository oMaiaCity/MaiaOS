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

- `DB_PATH` - SQLite database path (default: `./sync.db`)
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

The sync server currently uses **in-memory storage** (no persistence):
- **Current**: In-memory storage (data lost on server restart)
- **Future**: SQLite storage support when Bun supports `better-sqlite3`
- **Note**: This is fine for development and testing. For production, consider deploying with persistent storage when SQLite support is available.

## How It Works

1. **Server-side LocalNode**: Creates a LocalNode instance without an account (server is relay, not participant)
2. **In-Memory Storage**: Currently uses in-memory storage (no persistence)
3. **WebSocket Peers**: Each client connection creates a peer via `createWebSocketPeer`
4. **Automatic Sync**: cojson's `SyncManager` handles all sync protocol automatically
5. **Message Routing**: cojson routes messages between peers based on what they need

## Deployment

Deploy the server service separately from the frontend. The frontend connects to it via WebSocket.

**Note**: Currently using in-memory storage. Data is lost on server restart. This is fine for development and testing.
