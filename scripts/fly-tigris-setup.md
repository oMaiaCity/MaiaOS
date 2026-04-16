# Fly.io Tigris Setup for sync-next-maia-city

Binary CoValue offloading: provision Tigris object storage so binary blobs (images, files) are stored in Tigris instead of PostgreSQL. Run this **after** the sync app exists and before first deploy with blob offloading.

**Prerequisites:** `sync-next-maia-city` app exists, Neon PG configured. See [fly-next-setup.md](./fly-next-setup.md).

## 1. Provision Tigris Bucket

From the monorepo root, in the sync app context:

```bash
cd services/sync
fly storage create -a sync-next-maia-city
```

When prompted:
- **Organization:** `maia-city`
- **Name:** leave blank or use default (e.g. `summer-grass-2004`)

This **automatically sets** secrets on `sync-next-maia-city`:
- `BUCKET_NAME`
- `AWS_ENDPOINT_URL_S3` (https://fly.storage.tigris.dev)
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

No manual secret setup needed for Tigris.

## 2. Reset Neon PostgreSQL (Clean Slate)

Because we're using a clean-slate setup (no migration), reset the Neon database:

1. Go to [Neon Console](https://console.neon.tech)
2. Select your project
3. **Reset database** or create a new branch and point `PEER_SYNC_DB_URL` to it

Alternatively, create a fresh Neon DB and update `PEER_SYNC_DB_URL` in Fly secrets.

## 3. Deploy (First Run with Tigris)

```bash
# Deploy sync (will run migrations, seed fresh)
./services/sync/deploy.sh

# Or from root
bun run deploy:sync
```

Empty Postgres + `PEER_SYNC_MODE=seed` runs genesis seed; unset afterward. Storage is never cleared by sync — wipe Postgres/PGlite/Tigris manually for a full reset. All new binary uploads go to Tigris automatically.

## 4. After First Deploy

After a one-shot `PEER_SYNC_MODE=seed` deploy, unset that Fly secret so it does not run on every restart.

## 5. Verify

- **Sync health:** https://sync.next.maia.city/health
- **Upload an image** in the app — verify it loads
- **Tigris dashboard:** `flyctl storage dashboard <bucket_name>` or `flyctl storage list`
- **Neon PG:** Check `transactions` table — binary rows should have `_blobRef` (tiny JSON), not large `encrypted_U` payloads

## Env Reference (Tigris)

| Secret | Set by | Notes |
|--------|--------|-------|
| `BUCKET_NAME` | `fly storage create` | Auto-set |
| `AWS_ENDPOINT_URL_S3` | `fly storage create` | https://fly.storage.tigris.dev |
| `AWS_ACCESS_KEY_ID` | `fly storage create` | Auto-set |
| `AWS_SECRET_ACCESS_KEY` | `fly storage create` | Auto-set |

When `BUCKET_NAME` is set, the sync service uses `TigrisBlobStore` (S3). When unset (local dev), it uses `LocalFsBlobStore` at `./binary-bucket`.

## References

- [Fly.io Tigris docs](https://fly.io/docs/tigris/)
- [Tigris S3 API compatibility](https://www.tigrisdata.com/docs/api/s3)
