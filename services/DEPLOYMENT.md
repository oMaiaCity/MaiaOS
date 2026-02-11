# MaiaOS Production Deployment Guide

Complete guide for deploying MaiaOS services to Fly.io.

## Services Overview

1. **next-maia-city** (`services/maia-city/`) - Frontend SPA
2. **sync-next-maia-city** (`services/sync/`) - Self-hosted sync service
3. **voice-maia-city** (`libs/maia-voice/`) - PersonaPlex voice backend (GPU-enabled, see `libs/maia-voice/DEPLOY.md`)

## Quick Start

### Deploy All Services (Recommended)

Deploy both services with a single command from the repo root:

```bash
# From monorepo root
bun run deploy
# or
./scripts/deploy-all.sh
```

This will deploy:
1. Sync service (`sync-next-maia-city`) first
2. Maia City (`next-maia-city`) second

### First-Time Setup

Before first deployment, create apps and set secrets:

```bash
# Create apps
flyctl apps create sync-next-maia-city --org maia-city
flyctl apps create next-maia-city --org maia-city

# Generate sync service credentials (from monorepo root)
bun agent:generate --service=sync

# Set sync service secrets (REQUIRED - app crashes without these)
flyctl secrets set SYNC_MAIA_AGENT_ACCOUNT_ID="<from-generate-output>" --app sync-next-maia-city
flyctl secrets set SYNC_MAIA_AGENT_SECRET="<from-generate-output>" --app sync-next-maia-city

# Set frontend secrets (REQUIRED for sync to work)
# For Fly.io domain:
flyctl secrets set PUBLIC_API_DOMAIN="sync-next-maia-city.fly.dev" --app next-maia-city

# OR for custom domain:
flyctl secrets set PUBLIC_API_DOMAIN="sync.next.maia.city" --app next-maia-city

# Deploy all
bun run deploy
```

**Important:** `PUBLIC_API_DOMAIN` is **REQUIRED** for sync to work in production. Without it, sync will fall back to same-origin which may not work if the sync service is on a different domain.

### Deploy Individual Services

You can also deploy services individually:

```bash
# Deploy server only
bun run deploy:server

# Deploy maia-city only
bun run deploy:city
```

## Domain Configuration

### Fly.io Domains (Default)

- **Frontend**: `https://next-maia-city.fly.dev`
- **Sync**: `https://sync-next-maia-city.fly.dev`

### Custom Domains

To use custom domains (`next.maia.city` and `api.next.maia.city`):

1. **Set up DNS** (see `services/DNS_SETUP.md` for detailed instructions):
   - `next.maia.city` → CNAME to `next-maia-city.fly.dev.` (note trailing dot!)
   - `sync.next.maia.city` → CNAME to `sync-next-maia-city.fly.dev.` (note trailing dot!)
   
   **Important:** Add a trailing dot (`.`) to the CNAME target to indicate it's an external domain. Without it, Hetzner DNS will try to validate it as an internal record and show an error.

2. **Add SSL certificates**:
   ```bash
   flyctl certs create next.maia.city --app next-maia-city
   flyctl certs create sync.next.maia.city --app sync-next-maia-city
   ```

3. **Update secrets**:
   ```bash
   flyctl secrets set PUBLIC_API_DOMAIN="sync.next.maia.city" --app next-maia-city
   ```

See `services/DNS_SETUP.md` for detailed DNS configuration instructions, especially for Hetzner DNS.

## Environment Variables

### Sync Service (`sync-next-maia-city`)

**Required secrets** (app crashes without these):
- `SYNC_MAIA_AGENT_ACCOUNT_ID` - Agent account ID (generate via `bun agent:generate --service=sync`)
- `SYNC_MAIA_AGENT_SECRET` - Agent secret (generate via `bun agent:generate --service=sync`)

**Configured in fly.toml:**
- `PORT` - Server port (default: 4203)
- `DB_PATH` - PGlite database path (default: `/data/sync.db`)

### Maia City (`next-maia-city`)

- `PUBLIC_API_DOMAIN` - Sync service domain (set via secrets)
  - Default: `sync-next-maia-city.fly.dev`
  - Custom: `sync.next.maia.city`
- `PORT` - Server port (default: 8080, set in fly.toml)

## Architecture

```
┌─────────────────┐
│  maia-city      │  (Frontend SPA)
│  (Port 8080)    │
└────────┬────────┘
         │ WebSocket
         │ /sync
         ▼
┌─────────────────┐
│  server         │  (Self-Hosted Sync Server)
│  (Port 4203)    │
│  PGlite Storage │
└─────────────────┘
```

The frontend connects directly to the self-hosted sync server via WebSocket. The server uses cojson LocalNode to handle sync protocol and stores all data persistently in PGlite (PostgreSQL-compatible database).

## Health Checks

```bash
# Sync service
curl https://sync-next-maia-city.fly.dev/health

# Frontend
curl https://next-maia-city.fly.dev/
```

## Monitoring

```bash
# View logs
flyctl logs --app next-maia-city
flyctl logs --app sync-next-maia-city

# Check status
flyctl status --app next-maia-city
flyctl status --app sync-next-maia-city
```

## Troubleshooting

### Frontend can't connect to server

1. Verify `PUBLIC_API_DOMAIN` is set:
   ```bash
   flyctl secrets list --app next-maia-city
   ```

2. Check sync service is running:
   ```bash
   curl https://sync-next-maia-city.fly.dev/health
   ```

3. Verify DNS/domain configuration if using custom domains

### Sync service not working

1. Check logs:
   ```bash
   flyctl logs --app sync-next-maia-city
   ```

3. Test health endpoint:
   ```bash
   curl https://sync-next-maia-city.fly.dev/health
   ```

## Deployment Scripts

Both services have deployment scripts:

```bash
# Server
cd services/sync && bun run deploy

# Maia City
cd services/maia-city && bun run deploy
```

These scripts handle deployment from the monorepo root with proper Dockerfile and config paths.
