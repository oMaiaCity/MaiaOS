# MaiaOS Production Deployment Guide

Complete guide for deploying MaiaOS services to Fly.io.

## Services Overview

1. **next-maia-city** (`services/maia-city/`) - Frontend SPA
2. **api-next-maia-city** (`services/server/`) - Sync proxy service

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
1. Server service (`api-next-maia-city`) first
2. Maia City (`next-maia-city`) second

### First-Time Setup

Before first deployment, create apps and set secrets:

```bash
# Create apps
flyctl apps create api-next-maia-city --org maia-city
flyctl apps create next-maia-city --org maia-city

# Set secrets (REQUIRED)
# Server service needs Jazz API key
flyctl secrets set JAZZ_API_KEY="your-jazz-api-key" --app api-next-maia-city

# Frontend service needs API domain (REQUIRED for sync to work)
# For Fly.io domain:
flyctl secrets set PUBLIC_API_DOMAIN="api-next-maia-city.fly.dev" --app next-maia-city

# OR for custom domain:
flyctl secrets set PUBLIC_API_DOMAIN="api.next.maia.city" --app next-maia-city

# Deploy all
bun run deploy
```

**Important:** `PUBLIC_API_DOMAIN` is **REQUIRED** for sync to work in production. Without it, sync will fall back to same-origin which may not work if the server service is on a different domain.

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
- **Server**: `https://api-next-maia-city.fly.dev`

### Custom Domains

To use custom domains (`next.maia.city` and `api.next.maia.city`):

1. **Set up DNS** (see `services/DNS_SETUP.md` for detailed instructions):
   - `next.maia.city` → CNAME to `next-maia-city.fly.dev.` (note trailing dot!)
   - `api.next.maia.city` → CNAME to `api-next-maia-city.fly.dev.` (note trailing dot!)
   
   **Important:** Add a trailing dot (`.`) to the CNAME target to indicate it's an external domain. Without it, Hetzner DNS will try to validate it as an internal record and show an error.

2. **Add SSL certificates**:
   ```bash
   flyctl certs create next.maia.city --app next-maia-city
   flyctl certs create api.next.maia.city --app api-next-maia-city
   ```

3. **Update secrets**:
   ```bash
   flyctl secrets set PUBLIC_API_DOMAIN="api.next.maia.city" --app next-maia-city
   ```

See `services/DNS_SETUP.md` for detailed DNS configuration instructions, especially for Hetzner DNS.

## Environment Variables

### Server Service (`api-next-maia-city`)

- `JAZZ_API_KEY` - Jazz API key (set via secrets)
- `PORT` - Server port (default: 4203, set in fly.toml)

### Maia City (`next-maia-city`)

- `PUBLIC_API_DOMAIN` - Server service domain (set via secrets)
  - Default: `api-next-maia-city.fly.dev`
  - Custom: `api.next.maia.city`
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
│  server         │  (Sync Proxy)
│  (Port 4203)    │
└────────┬────────┘
         │ WebSocket
         │ wss://cloud.jazz.tools
         ▼
┌─────────────────┐
│  Jazz Cloud     │
└─────────────────┘
```

The frontend connects to the server service via WebSocket, and the server service proxies to Jazz cloud with the API key kept server-side.

## Health Checks

```bash
# Server service
curl https://api-next-maia-city.fly.dev/health

# Frontend
curl https://next-maia-city.fly.dev/
```

## Monitoring

```bash
# View logs
flyctl logs --app next-maia-city
flyctl logs --app api-next-maia-city

# Check status
flyctl status --app next-maia-city
flyctl status --app api-next-maia-city
```

## Troubleshooting

### Frontend can't connect to server

1. Verify `PUBLIC_API_DOMAIN` is set:
   ```bash
   flyctl secrets list --app next-maia-city
   ```

2. Check server is running:
   ```bash
   curl https://api-next-maia-city.fly.dev/health
   ```

3. Verify DNS/domain configuration if using custom domains

### Server service not working

1. Verify `JAZZ_API_KEY` is set:
   ```bash
   flyctl secrets list --app api-next-maia-city
   ```

2. Check logs:
   ```bash
   flyctl logs --app api-next-maia-city
   ```

3. Test health endpoint:
   ```bash
   curl https://api-next-maia-city.fly.dev/health
   ```

## Deployment Scripts

Both services have deployment scripts:

```bash
# Server
cd services/server && bun run deploy

# Maia City
cd services/maia-city && bun run deploy
```

These scripts handle deployment from the monorepo root with proper Dockerfile and config paths.
