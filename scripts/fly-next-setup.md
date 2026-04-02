# Fly.io Next Environment Setup

Setup guide for **sync.next.maia.city** (sync) and **next.maia.city** (app) with Neon PostgreSQL.

## 1. Create Fly Apps

```bash
# Create sync app (Fly app name may still be moai-next-maia-city; service lives in services/sync)
flyctl apps create sync-next-maia-city --org maia-city

# App already exists
flyctl apps create next-maia-city --org maia-city  # skip if exists
```

**Note:** No volume needed for sync when using Neon Postgres. If you were using PGlite before, you can destroy the old Fly app after migration.

## 2. Neon PostgreSQL Setup

1. Go to [neon.tech](https://neon.tech) and create a project
2. Copy the connection string (e.g. `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`)
3. Neon is Postgres-compatible — the sync service uses standard `pg` and works with Neon

**Required:** `PEER_SYNC_DB_URL` = your Neon connection string

## 3. Set Fly Secrets from .env

**Add Neon connection string to `.env`** (for prod; local can keep PGlite):
```
PEER_SYNC_DB_URL=postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
```

Then run the setup script:
```bash
./scripts/fly-secrets-from-env.sh
```

Or set manually:
```bash
flyctl secrets set \
  PEER_SYNC_STORAGE=postgres \
  PEER_SYNC_DB_URL="<your-neon-connection-string>" \
  PEER_SYNC_SEED=true \
  AVEN_MAIA_ACCOUNT="<from .env>" \
  AVEN_MAIA_SECRET="<from .env>" \
  AVEN_MAIA_GUARDIAN="<from .env>" \
  AVEN_MAIA_NAME="Maia" \
  RED_PILL_API_KEY="<optional>" \
  --app sync-next-maia-city
```

**First deploy:** Use `PEER_SYNC_SEED=true` to run genesis seed. After successful seed, set `PEER_SYNC_SEED=false`:
```bash
flyctl secrets set PEER_SYNC_SEED=false --app sync-next-maia-city
```

**App secrets:** The app (next-maia-city) has no runtime secrets — `VITE_PEER_SYNC_HOST` and `VITE_PEER_APP_HOST` are build args in fly.toml.

**Never set on Fly:** `VITE_AVEN_TEST_ACCOUNT`, `VITE_AVEN_TEST_SECRET`, `VITE_AVEN_TEST_MODE`, `VITE_AVEN_TEST_NAME` — client-only test credentials for local dev. Sync server must never receive them.

## 4. DNS Setup

### At your DNS provider (Cloudflare, Namecheap, etc.)

| Type | Name | Value | TTL |
|------|------|-------|-----|
| **CNAME** | `next` | `next-maia-city.fly.dev` | 300 |
| **CNAME** | `sync.next` | `sync-next-maia-city.fly.dev` | 300 |

**For root domain (maia.city):** If you want `maia.city` → app, use A/AAAA records from Fly's `flyctl ips list` or a CNAME to `next-maia-city.fly.dev` (some providers allow CNAME at root, others require ALIAS/ANAME).

### Fly.io certificates

After DNS propagates (usually 1–5 min):

```bash
flyctl certs create next.maia.city --app next-maia-city
flyctl certs create sync.next.maia.city --app sync-next-maia-city
```

Verify:
```bash
flyctl certs show next.maia.city --app next-maia-city
flyctl certs show sync.next.maia.city --app sync-next-maia-city
```

## 5. Deploy

```bash
# Deploy sync first, then app
./services/sync/deploy.sh
./services/app/deploy.sh

# Or from root
bun run deploy
```

## 6. Verify

- **App:** https://next.maia.city
- **Sync health:** https://sync.next.maia.city/health
- **WebSocket:** wss://sync.next.maia.city/sync

## Env vars reference (from .env)

| Var | App | Sync | Notes |
|-----|-----|------|-------|
| `PEER_SYNC_HOST` | — | — | Local dev only |
| `PEER_SYNC_STORAGE` | — | ✓ | `postgres` (Neon) or `pglite` |
| `PEER_SYNC_DB_URL` | — | ✓ | Neon connection string |
| `PEER_DB_PATH` | — | — | Only for PGlite |
| `PEER_SYNC_SEED` | — | ✓ | `true` first run, then `false` |
| `AVEN_MAIA_ACCOUNT` | — | ✓ | Guardian account co-id |
| `AVEN_MAIA_SECRET` | — | ✓ | Guardian sealer secret |
| `AVEN_MAIA_GUARDIAN` | — | ✓ | Guardian co-id |
| `AVEN_MAIA_NAME` | — | ✓ | Display name |
| `RED_PILL_API_KEY` | — | ✓ | Optional, LLM chat |
| `VITE_PEER_SYNC_HOST` | build | — | `sync.next.maia.city` (fly.toml) |
| `VITE_PEER_APP_HOST` | build | — | `next.maia.city` (fly.toml) |
