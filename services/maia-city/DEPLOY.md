# First-Time Deployment to Fly.io

## Prerequisites

1. **Install Fly.io CLI:**
```bash
curl -L https://fly.io/install.sh | sh
```

2. **Login to Fly.io:**
```bash
flyctl auth login
```

3. **Verify you have access to maia-city organization:**
```bash
flyctl orgs list
```

If `maia-city` organization doesn't exist, create it:
```bash
flyctl orgs create maia-city
```

## First-Time Deployment Steps

### Step 1: Create the App in maia-city Organization

From the **monorepo root**:
```bash
flyctl apps create next-maia-city --org maia-city
```

This creates the app in your organization (not personal account).

### Step 2: Set Environment Variables

Configure the API domain so maia-city can connect to the sync service:

```bash
# Use Fly.io domain
flyctl secrets set PUBLIC_API_DOMAIN="sync-next-maia-city.fly.dev" --app next-maia-city

# Or use custom domain (after setting up DNS)
flyctl secrets set PUBLIC_API_DOMAIN="sync.next.maia.city" --app next-maia-city
```

### Step 3: Deploy

From the **monorepo root**:
```bash
flyctl deploy --dockerfile services/maia-city/Dockerfile --config services/maia-city/fly.toml --app next-maia-city
```

Or use the deploy script (from maia-city directory):
```bash
cd services/maia-city
bun run deploy
```

### Step 4: Verify Deployment

```bash
# Check app status
flyctl status --app next-maia-city

# View logs
flyctl logs --app next-maia-city

# Open in browser
flyctl open --app next-maia-city
```

## Troubleshooting

**If you get "organization not found":**
- Make sure you're logged in: `flyctl auth whoami`
- Check organizations: `flyctl orgs list`
- Create organization if needed: `flyctl orgs create maia-city`

**If deployment fails:**
- Check logs: `flyctl logs --app next-maia-city`
- Verify Dockerfile builds locally first
- Make sure you're in the monorepo root when deploying

## Domain Configuration

The maia-city service needs to know where the sync service is located. Set the `PUBLIC_API_DOMAIN` secret:

```bash
# Fly.io domain
flyctl secrets set PUBLIC_API_DOMAIN="sync-next-maia-city.fly.dev" --app next-maia-city

# Custom domain (requires DNS setup)
flyctl secrets set PUBLIC_API_DOMAIN="sync.next.maia.city" --app next-maia-city
```

The client code will automatically use this domain to connect to the sync proxy.

## Custom Domains

To use custom domains:

1. **Set up DNS** for your domains:
   - `next.maia.city` → points to `next-maia-city.fly.dev`
   - `sync.next.maia.city` → points to `sync-next-maia-city.fly.dev`

2. **Add certificates**:
   ```bash
   flyctl certs create next.maia.city --app next-maia-city
   flyctl certs create sync.next.maia.city --app sync-next-maia-city
   ```

3. **Update secrets**:
   ```bash
   flyctl secrets set PUBLIC_API_DOMAIN="sync.next.maia.city" --app next-maia-city
   ```

## Subsequent Deployments

After the first deployment, you can simply run:
```bash
cd services/maia-city
bun run deploy
```

The `fly.toml` file already has `org = "maia-city"` configured, so it will use the organization automatically.
