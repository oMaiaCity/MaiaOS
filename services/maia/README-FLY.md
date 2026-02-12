# Fly.io Deployment Guide for Maia City

## Prerequisites

1. Install Fly.io CLI:
```bash
curl -L https://fly.io/install.sh | sh
```

2. Login to Fly.io:
```bash
flyctl auth login
```

## Deployment Steps

### 1. Create Fly.io App

From the **monorepo root**:
```bash
# Create app in maia-city organization
flyctl apps create next-maia-city --org maia-city
```

### 2. Deploy

From the **monorepo root**:
```bash
flyctl deploy --dockerfile services/maia-city/Dockerfile --org maia-city
```

Or use the deploy script (automatically uses org):
```bash
cd services/maia-city
bun run deploy
```

### 3. Verify Deployment

```bash
flyctl status
flyctl logs
flyctl open
```

## Local Testing

Test the production build locally:

```bash
cd services/maia-city
bun run build
PORT=8080 bun run start
```

Then open http://localhost:8080

## Configuration

- **Port**: 8080 (internal)
- **Region**: fra (Frankfurt, Germany)
- **Organization**: maia-city
- **HTTPS**: Enabled automatically
- **SPA Routing**: All routes serve `index.html` for client-side routing

## Notes

- The Dockerfile builds from the monorepo root to access `libs/maia-kernel`
- Kernel bundle is built first, then maia-city frontend
- Static files are served with proper caching headers
- SPA routing is handled by serving `index.html` for all routes
