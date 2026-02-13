# MaiaOS Production Deployment Guide

Complete guide for deploying MaiaOS services to Fly.io, including DNS setup. Consolidates maia and moai deployment documentation.

## Prerequisites

1. **Install Fly.io CLI:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   # or: brew install flyctl
   ```

2. **Login:**
   ```bash
   flyctl auth login
   ```

3. **Verify organization** (create if needed):
   ```bash
   flyctl orgs list
   flyctl orgs create maia-city   # if missing
   ```

## Services Overview

1. **next-maia-city** (`services/maia/`) - Frontend SPA (port 8080)
2. **moai-next-maia-city** (`services/moai/`) - Sync + API (port 4201, WebSocket /sync)

## Quick Start

### Deploy All Services (Recommended)

From the monorepo root:

```bash
bun run deploy
# or
./scripts/deploy-all.sh
```

Deploys moai first, then maia.

### First-Time Setup

Before first deployment:

```bash
# Create apps
flyctl apps create moai-next-maia-city --org maia-city
flyctl apps create next-maia-city --org maia-city

# Moai needs a volume for PGlite persistence
flyctl volumes create moai_data --app moai-next-maia-city --region fra --size 3

# Generate credentials and sync to Fly secrets
bun agent:generate
bun run deploy:secrets

# Deploy all
bun run deploy
```

**Secrets:** Moai requires `PEER_ID` and `PEER_SECRET` (from `bun agent:generate`). Maia needs no secrets—sync domain comes from fly.toml [build.args] at build time.

### Deploy Individual Services

```bash
bun run deploy:moai    # Moai only
bun run deploy:maia   # Maia only
```

### Local Testing (Maia)

Test the production build locally before deploying:

```bash
cd services/maia
bun run build
PORT=8080 bun run start
```

Then open http://localhost:8080

## Moai Volume Configuration

Moai uses a Fly volume for PGlite persistence. Volume name must match `fly.toml` [mounts]:

- **Volume name:** `moai_data`
- **Mount point:** `/data` (database at `/data/sync.db`)
- **Region:** Must match `primary_region` in fly.toml (currently `fra`)

```bash
# List volumes
flyctl volumes list --app moai-next-maia-city

# Extend volume (cannot shrink)
flyctl volumes extend moai_data --app moai-next-maia-city --size 10
```

**Note:** Volumes are region-specific. Changing region requires a new volume and data migration.

## Migration from sync-next-maia-city

If you have the legacy `sync-next-maia-city` app:

```bash
# 1. Create new app and volume
flyctl apps create moai-next-maia-city --org maia-city
flyctl volumes create moai_data --app moai-next-maia-city --region fra --size 3

# 2. Generate credentials and set secrets
bun agent:generate
bun run deploy:secrets

# 3. Deploy
bun run deploy

# 4. DNS + certs if using custom domain
flyctl certs create moai.next.maia.city --app moai-next-maia-city

# 5. Update fly.toml [build.args] VITE_PEER_MOAI if using Fly.io domain

# 6. (Optional) Destroy old app
flyctl apps destroy sync-next-maia-city
```

## Domain Configuration

### Fly.io Domains (Default)

- **Frontend**: `https://next-maia-city.fly.dev`
- **Moai**: `https://moai-next-maia-city.fly.dev`

### Custom Domains

To use custom domains (`next.maia.city` and `moai.next.maia.city`):

1. **Set up DNS** (see [DNS Setup](#dns-setup) below)
2. **Add SSL certificates**:
   ```bash
   flyctl certs create next.maia.city --app next-maia-city
   flyctl certs create moai.next.maia.city --app moai-next-maia-city
   ```
3. **Update fly.toml** [build.args] if using Fly.io domain:
   ```toml
   VITE_PEER_MOAI = "moai-next-maia-city.fly.dev"
   ```

---

## DNS Setup

Guide for setting up DNS records (Hetzner DNS and other providers).

### Hetzner DNS Error Fix

If you see the error: **"Record verweist auf ein Ziel innerhalb dieser Zone, das nicht existiert"** (Record refers to a target within this zone that does not exist), this means Hetzner is trying to validate the CNAME target as an internal record.

### Correct DNS Configuration

#### For `moai.next.maia.city` CNAME Record

**Correct Configuration:**
- **Type:** CNAME
- **Name:** `moai.next` (or `moai.next.maia.city` depending on Hetzner's interface)
- **Value:** `moai-next-maia-city.fly.dev.` (note the trailing dot!)
- **TTL:** 3600

#### For `next.maia.city` CNAME Record

**Correct Configuration:**
- **Type:** CNAME
- **Name:** `next` (or `next.maia.city`)
- **Value:** `next-maia-city.fly.dev.` (with trailing dot)
- **TTL:** 3600

**Important:** The trailing dot (`.`) at the end tells Hetzner that this is an **external** domain, not an internal record within the `maia.city` zone.

### Step-by-Step Setup in Hetzner

1. **Log into Hetzner DNS Console**
   - Go to your Hetzner DNS zone for `maia.city`

2. **Add CNAME for moai subdomain:**
   - Click "Add Record" or "New Record"
   - **Type:** Select `CNAME`
   - **Name:** Enter `moai.next` (Hetzner will automatically append `.maia.city`)
   - **Value:** Enter `moai-next-maia-city.fly.dev.` (with trailing dot!)
   - **TTL:** 3600
   - **Comment:** (optional) "Moai (sync+API) service"
   - Save

3. **Add CNAME for main domain:**
   - Click "Add Record" or "New Record"
   - **Type:** Select `CNAME`
   - **Name:** Enter `next` (Hetzner will automatically append `.maia.city`)
   - **Value:** Enter `next-maia-city.fly.dev.` (with trailing dot!)
   - **TTL:** 3600
   - **Comment:** (optional) "Frontend service"
   - Save

### Why the Trailing Dot?

The trailing dot (`.`) in DNS records indicates an **absolute domain name** (FQDN - Fully Qualified Domain Name). Without it, DNS resolvers treat the value as relative to the current zone.

- `moai-next-maia-city.fly.dev` → Hetzner thinks: "moai-next-maia-city.fly.dev.maia.city" (doesn't exist!)
- `moai-next-maia-city.fly.dev.` → Hetzner knows: "moai-next-maia-city.fly.dev" (external domain)

### DNS Verification

After setting up DNS:

1. **Check DNS propagation:**
   ```bash
   dig moai.next.maia.city CNAME
   dig next.maia.city CNAME
   ```

2. **Test connectivity:**
   ```bash
   curl https://moai.next.maia.city/health
   curl https://next.maia.city/
   ```

3. **Sync domain** for maia is set at build time (fly.toml [build.args] VITE_PEER_MOAI). Redeploy if you change domains.

### DNS Common Issues

**"Record refers to a target within this zone that does not exist"**
- Solution: Add trailing dot to CNAME value
- ❌ Wrong: `moai-next-maia-city.fly.dev`
- ✅ Correct: `moai-next-maia-city.fly.dev.`

**DNS not resolving**
1. Wait for DNS propagation (can take up to 48 hours, usually < 1 hour)
2. Check DNS with: `dig moai.next.maia.city CNAME`
3. Verify Fly.io app is running: `flyctl status --app moai-next-maia-city`

**SSL certificate errors**
1. Add SSL certificate in Fly.io: `flyctl certs create moai.next.maia.city --app moai-next-maia-city`
2. Wait for certificate provisioning (usually < 5 minutes)
3. Verify: `flyctl certs show moai.next.maia.city --app moai-next-maia-city`

---

## Environment Variables

### Moai Service (`moai-next-maia-city`)

**Required Fly secrets** (app crashes without these):
- `PEER_ID` - Account ID (from `bun agent:generate`)
- `PEER_SECRET` - Agent secret (from `bun agent:generate`)

**Optional:** `RED_PILL_API_KEY` for LLM chat.

**Sync from .env:** `bun run deploy:secrets` copies PEER_ID, PEER_SECRET, RED_PILL_API_KEY from root `.env` to Fly.

**fly.toml:** `PORT` (4201), `PEER_DB_PATH` (`/data/sync.db`)

### Maia City (`next-maia-city`)

**No Fly secrets.** Sync domain is build-time only:
- `VITE_PEER_MOAI` from fly.toml [build.args] (default: `moai.next.maia.city`)
- Override: `fly deploy --build-arg VITE_PEER_MOAI=moai-next-maia-city.fly.dev`

**fly.toml:** `PORT` (8080)

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
│  moai           │  (Self-Hosted Sync Server)
│  (Port 4201)    │
│  PGlite Storage │
└─────────────────┘
```

The frontend connects directly to the self-hosted sync server via WebSocket. The server uses cojson LocalNode to handle sync protocol and stores all data persistently in PGlite (PostgreSQL-compatible database).

## Health Checks

```bash
# Sync service
curl https://moai-next-maia-city.fly.dev/health
# Expected: {"status":"ok","service":"server"}

# Frontend
curl https://next-maia-city.fly.dev/
```

## WebSocket Endpoint

Clients connect to moai sync via:
- **Fly.io:** `wss://moai-next-maia-city.fly.dev/sync`
- **Custom domain:** `wss://moai.next.maia.city/sync`

## Monitoring

```bash
# View logs
flyctl logs --app next-maia-city
flyctl logs --app moai-next-maia-city

# Check status
flyctl status --app next-maia-city
flyctl status --app moai-next-maia-city
```

## Troubleshooting

### WebSocket "bad response from server" / Sync won't connect

1. **Verify TLS cert for custom domain** (required for wss://):
   ```bash
   flyctl certs create moai.next.maia.city --app moai-next-maia-city
   flyctl certs show moai.next.maia.city --app moai-next-maia-city
   ```

2. **Verify sync domain in build** (from fly.toml [build.args]):
   ```bash
   # Check fly.toml has: VITE_PEER_MOAI = "moai.next.maia.city"
   # Redeploy if you changed domains
   ```

3. **Test sync service health**:
   ```bash
   curl https://moai.next.maia.city/health
   # or: curl https://moai-next-maia-city.fly.dev/health
   ```

4. **Verify DNS**: `moai.next.maia.city` → CNAME to `moai-next-maia-city.fly.dev.`

### API calls to localhost / Mixed content blocked

The API (LLM chat) and sync use the same domain. Sync domain comes from `VITE_PEER_MOAI` in fly.toml [build.args] (build-time). Ensure fly.toml has the correct domain and redeploy.

### Frontend can't connect to server

1. Verify fly.toml [build.args] VITE_PEER_MOAI matches your moai domain
2. Check sync service is running: `curl https://moai-next-maia-city.fly.dev/health`
3. Verify DNS/domain configuration if using custom domains

### Sync service not working

1. Check logs: `flyctl logs --app moai-next-maia-city`
2. Test health: `curl https://moai-next-maia-city.fly.dev/health`

### "The app appears to be crashing" (Moai)

Usually missing secrets. Run:
```bash
flyctl secrets list --app moai-next-maia-city
bun agent:generate
bun run deploy:secrets
```

### Volume not mounted (Moai)

1. Verify volume exists: `flyctl volumes list --app moai-next-maia-city`
2. Volume name must match fly.toml [mounts] `source`: `moai_data`
3. Create if missing: `flyctl volumes create moai_data --app moai-next-maia-city --region fra --size 3`
4. Redeploy after creating volume

## Deployment Scripts

Both services have deployment scripts:

```bash
# Moai (sync+API)
cd services/moai && bun run deploy

# Maia City
cd services/maia && bun run deploy
```

These scripts handle deployment from the monorepo root with proper Dockerfile and config paths.
