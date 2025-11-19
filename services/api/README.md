# API Service

Elysia + Bun server for Hominio monorepo. Handles Zero sync endpoints (get-queries, push) and API endpoints.

## Architecture

- **Client** → Connects directly to Zero sync service (`sync.hominio.me`)
- **Zero sync** → Forwards cookies to this API service for authentication
- **API service** → Handles get-queries and push endpoints (verifies cookies via wallet service `/api/auth/verify` endpoint)
- **Wallet service** → Verifies cookies and returns auth data (API service has NO auth database access)

## Port

- **Development**: `4204`
- **Production**: `api.hominio.me` (port 4204 internally)

## Environment Variables

Set these in Fly.io secrets and root `.env`:

- `SECRET_ZERO_DEV_PG` or `ZERO_POSTGRES_SECRET` - Postgres connection string (non-pooler, same as sync service)
- `PUBLIC_DOMAIN_WALLET` or `WALLET_URL` - Wallet service URL (e.g., `wallet.hominio.me` or `localhost:4201`) - **Required for cookie verification**
- `GOOGLE_AI_API_KEY` - Google Gemini API key (required for voice API)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - OAuth (optional, not used by API service)
- `ADMIN` - Admin user IDs (comma-separated, checked by wallet service)

**Removed (no longer needed):**
- ~~`AUTH_SECRET`~~ - No longer needed (wallet service handles all auth)
- ~~`SECRET_NEON_PG_AUTH` / `WALLET_POSTGRES_SECRET`~~ - No longer needed (API service no longer has auth database access)

## Endpoints

### Zero Sync Endpoints
- `POST /api/v0/zero/get-queries` - Zero synced queries endpoint
- `POST /api/v0/zero/push` - Zero custom mutators endpoint

### Voice API Endpoints
- `WS /api/v0/voice/live` - Google Live Voice API WebSocket proxy (requires authentication)

### API Endpoints
- `GET /api/v0/projects` - Returns list of projects

### Authentication
- Cookie verification is delegated to wallet service via `POST /api/auth/verify` endpoint
- API service has NO auth database access (security improvement)
- All `/api/auth/*` routes are handled by wallet service, not this API service

## Deployment

```bash
cd services/api
fly deploy -c fly.toml
fly secrets set SECRET_ZERO_DEV_PG="..." PUBLIC_DOMAIN_WALLET="wallet.hominio.me" ADMIN="..."
```

## Development

```bash
cd services/api
bun install
bun run dev
```

