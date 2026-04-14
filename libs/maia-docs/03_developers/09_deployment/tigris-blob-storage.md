# Tigris Blob Storage for sync-next-maia-city

## Overview

**What is it?** Tigris blob storage lets the sync service store images and files in object storage instead of stuffing them into PostgreSQL.

**Why does it matter?** When users upload images or files, those binary blobs can get huge. Putting them in the database makes it slow, expensive, and hard to scale. Object storage (Tigris) is built for this—like a warehouse for big boxes instead of a filing cabinet.

---

## The Simple Version

Think of it like moving house. Your database is the filing cabinet—great for small papers and records. But when you have big boxes (images, videos, files), you don't stuff them in the cabinet. You put them in a warehouse (Tigris) and keep a small note in the cabinet that says "Box #42 is in the warehouse." When someone needs the box, you look up the note and fetch it from the warehouse.

The sync service does the same: binary CoValues go to Tigris; PostgreSQL only stores a tiny reference (`_blobRef`). Fast, cheap, scalable.

---

## How It Works

```
CoBinary upload  →  Adapter detects binary  →  Offload to BlobStore  →  PG stores {_blobRef, _blobSize, _blobKey}
                                                                                    ↓
                                                                         On read: fetch from BlobStore, reconstitute
```

**Backend selection:**

| Condition | Backend | Where data lives |
|-----------|---------|------------------|
| `BUCKET_NAME` set (prod) | TigrisBlobStore | Fly.io Tigris (S3-compatible) |
| `BUCKET_NAME` unset (local dev) | LocalFsBlobStore | `./binary-bucket/chunks/` |

**Source:** `libs/maia-storage/src/blob/` — `interface.js`, `tigris.js`, `local-fs.js`. Adapters in `libs/maia-storage/src/adapters/` detect `header.meta.type === 'binary'` and offload.

---

## Prerequisites

- **sync-next-maia-city** app exists on Fly.io
- **Neon PostgreSQL** configured (connection string in `PEER_SYNC_DB_URL`)

If you haven't set up the sync app yet, see [fly-next-setup.md](../../../../scripts/fly-next-setup.md).

---

## Setup Steps

### 1. Provision Tigris Bucket

From the monorepo root:

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

### 2. Reset Neon PostgreSQL (Clean Slate)

Because we're using a clean-slate setup (no migration from in-database blobs), reset the Neon database:

1. Go to [Neon Console](https://console.neon.tech)
2. Select your project
3. **Reset database** or create a new branch and point `PEER_SYNC_DB_URL` to it

Alternatively, create a fresh Neon DB and update `PEER_SYNC_DB_URL` in Fly secrets.

### 3. Deploy (First Run with Tigris)

```bash
# Deploy sync (will run migrations, seed fresh)
./services/sync/deploy.sh

# Or from root
bun run deploy:sync
```

Ensure `PEER_SYNC_MODE=seed` for the first deploy to run genesis seed. All new binary uploads will go to Tigris automatically.

### 4. After First Deploy

Set `PEER_SYNC_MODE=none` (or unset the secret):

```bash
flyctl secrets set PEER_SYNC_MODE=none --app sync-next-maia-city
```

### 5. Verify

- **Sync health:** https://sync.next.maia.city/health
- **Upload an image** in the app — verify it loads
- **Tigris dashboard:** `flyctl storage dashboard <bucket_name>` or `flyctl storage list`
- **Neon PG:** Check `transactions` table — binary rows should have `_blobRef` (tiny JSON), not large `encrypted_U` payloads

---

## Environment Reference

| Secret | Set by | Notes |
|--------|--------|-------|
| `BUCKET_NAME` | `fly storage create` | Auto-set |
| `AWS_ENDPOINT_URL_S3` | `fly storage create` | https://fly.storage.tigris.dev |
| `AWS_ACCESS_KEY_ID` | `fly storage create` | Auto-set |
| `AWS_SECRET_ACCESS_KEY` | `fly storage create` | Auto-set |

When `BUCKET_NAME` is set, the sync service uses `TigrisBlobStore` (S3). When unset (local dev), it uses `LocalFsBlobStore` at `./binary-bucket`.

---

## Troubleshooting

### Bucket not found / 404 on upload

- Verify bucket exists: `flyctl storage list`
- Check `BUCKET_NAME` secret: `flyctl secrets list --app sync-next-maia-city`
- Ensure `fly storage create` completed successfully and targeted the correct app

### Wrong endpoint / S3 connection errors

- `AWS_ENDPOINT_URL_S3` must be `https://fly.storage.tigris.dev` (no trailing slash)
- Tigris is S3-compatible; the sync service uses `@aws-sdk/client-s3` with this endpoint

### PG still has large payloads for binary rows

- Blob offloading only applies to **new** writes after Tigris is configured
- Reset Neon (or use a fresh DB) for a clean slate—no migration from in-database blobs
- Check that `header.meta.type === 'binary'` is set for CoBinary transactions

### Image uploads work locally but fail in prod

- Local dev uses `LocalFsBlobStore` at `./binary-bucket` (no Tigris)
- Prod requires `BUCKET_NAME` and AWS_* secrets. Re-run `fly storage create` if missing

---

## Related Documentation

- [Deployment Guide](./deployment-guide.md) - Fly.io setup, sync deploy, DNS, volumes
- [fly-next-setup.md](../../../../scripts/fly-next-setup.md) - Neon + sync-next-maia-city setup (prerequisite)
- [storage-layer.md](../05_maia-db/storage-layer.md) - Browser storage (OPFS/IndexedDB), server blob offloading
- [Fly.io Tigris docs](https://fly.io/docs/tigris/)
- [Tigris S3 API compatibility](https://www.tigrisdata.com/docs/api/s3)

**Source:** `libs/maia-storage/src/blob/`, `libs/maia-storage/src/getStorage.node.js`
