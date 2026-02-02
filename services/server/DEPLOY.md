# Server Service Deployment Guide

Deployment guide for the server service (sync proxy) on Fly.io.

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

### 2. Set Secrets

Set the Jazz API key (server-side only):

```bash
flyctl secrets set JAZZ_API_KEY="your-jazz-api-key" --app api-next-maia-city
```

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

- `JAZZ_API_KEY` - Set via Fly.io secrets (never commit to git)
- `PORT` - Set to `4203` in fly.toml
- `NODE_ENV` - Set to `production` in fly.toml

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

Clients connect to the sync proxy via WebSocket:

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

The client code in `@MaiaOS/self` will automatically use this domain to connect to the sync proxy.

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

### WebSocket Connection Issues

1. Verify `JAZZ_API_KEY` is set:
   ```bash
   flyctl secrets list --app api-next-maia-city
   ```

2. Check health endpoint:
   ```bash
   curl https://api-next-maia-city.fly.dev/health
   ```

3. Verify domain configuration in `maia-city`:
   ```bash
   flyctl secrets list --app next-maia-city
   ```
