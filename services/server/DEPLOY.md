# Server Service Deployment Guide

Deployment guide for the self-hosted sync server service on Fly.io.

## Prerequisites

- Fly.io CLI installed: `brew install flyctl` (or see [fly.io/docs](https://fly.io/docs/hands-on/install-flyctl/))
- Fly.io account and authentication: `flyctl auth login`
- Monorepo root access

## Initial Setup

### 1. Create Fly.io App

```bash
cd /path/to/MaiaOS
flyctl apps create api-next-maia-city --org maia-city
```

### 2. Create Volume for PGlite Persistence

Create a volume to persist PGlite database data:

```bash
flyctl volumes create sync_data --app api-next-maia-city --region fra --size 3
```

**Notes:**
- `sync_data` - Volume name (must match `source` in fly.toml `[mounts]` section)
- `--region fra` - Region (must match `primary_region` in fly.toml)
- `--size 3` - Volume size in GB (adjust as needed, minimum is 3GB)

**Important:** Volumes are region-specific. If you change the primary region, you'll need to create a new volume in that region.

### 3. Configure Domain (Optional)

If you want to use a custom domain:

```bash
# Add custom domain
flyctl certs create api.next.maia.city --app api-next-maia-city

# Or use Fly.io domain (api-next-maia-city.fly.dev)
```

## Deployment

### Deploy from Monorepo Root

```bash
cd /path/to/MaiaOS
flyctl deploy --dockerfile services/server/Dockerfile --config services/server/fly.toml --app api-next-maia-city
```

### Using Deployment Script

```bash
cd services/server
bun run deploy
```

## Environment Variables

The following environment variables are configured:

- `PORT` - Set to `4203` in fly.toml
- `NODE_ENV` - Set to `production` in fly.toml
- `DB_PATH` - Set to `/data/sync.db` in fly.toml (PGlite database path on volume)

## Volume Configuration

The service uses a Fly.io volume for PGlite persistence:

- **Volume name**: `sync_data` (configured in `fly.toml` `[mounts]` section)
- **Mount point**: `/data` (database stored at `/data/sync.db`)
- **Region**: Must match `primary_region` in `fly.toml` (currently `fra`)

**Volume Management:**

```bash
# List volumes
flyctl volumes list --app api-next-maia-city

# Check volume status
flyctl volumes status sync_data --app api-next-maia-city

# Extend volume size (if needed)
flyctl volumes extend sync_data --app api-next-maia-city --size 10

# Note: Volumes cannot be shrunk, only extended
```

**Important:** 
- Volumes persist data across deployments and restarts
- If you need to migrate to a different region, you'll need to create a new volume and migrate data
- Volume data persists even if you destroy and recreate the app (as long as you use the same volume name)

## Health Check

The service exposes a health check endpoint:

```bash
curl https://api-next-maia-city.fly.dev/health
# or
curl https://api.next.maia.city/health
```

Expected response:
```json
{"status":"ok","service":"server"}
```

## WebSocket Endpoint

Clients connect to the self-hosted sync server via WebSocket:

- **Fly.io domain**: `wss://api-next-maia-city.fly.dev/sync`
- **Custom domain**: `wss://api.next.maia.city/sync`

## Connecting from maia-city

The `maia-city` service should be configured with:

```bash
# In maia-city Fly.io app
flyctl secrets set PUBLIC_API_DOMAIN="api-next-maia-city.fly.dev" --app next-maia-city
# or for custom domain:
flyctl secrets set PUBLIC_API_DOMAIN="api.next.maia.city" --app next-maia-city
```

The client code in `@MaiaOS/self` will automatically use this domain to connect to the self-hosted sync server.

## Monitoring

```bash
# View logs
flyctl logs --app api-next-maia-city

# Check status
flyctl status --app api-next-maia-city

# Open app
flyctl open --app api-next-maia-city
```

## Troubleshooting

### Service Not Starting

Check logs:
```bash
flyctl logs --app api-next-maia-city
```

### Volume Not Mounted

If the service can't access the database:

1. Verify volume exists:
   ```bash
   flyctl volumes list --app api-next-maia-city
   ```

2. Check volume is attached (should show in `flyctl status`):
   ```bash
   flyctl status --app api-next-maia-city
   ```

3. Verify volume name matches `fly.toml`:
   - Volume name in Fly.io: `sync_data`
   - `source` in `fly.toml` `[mounts]` section: `sync_data`
   - These must match exactly

4. If volume doesn't exist, create it:
   ```bash
   flyctl volumes create sync_data --app api-next-maia-city --region fra --size 3
   ```

5. Redeploy after creating volume:
   ```bash
   flyctl deploy --dockerfile services/server/Dockerfile --config services/server/fly.toml --app api-next-maia-city
   ```

### WebSocket Connection Issues

1. Check health endpoint:
   ```bash
   curl https://api-next-maia-city.fly.dev/health
   ```

3. Verify domain configuration in `maia-city`:
   ```bash
   flyctl secrets list --app next-maia-city
   ```
