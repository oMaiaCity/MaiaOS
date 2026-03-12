---
name: ""
overview: ""
todos: []
isProject: false
---

# Fix sync-next-maia-city OOM crash and secrets

## Root Cause

The sync service on Fly.io is OOM-killed during genesis seed. Logs show:

- **16:08:13** - `Out of memory: Killed process 648 (bun)` (~385MB RSS, VM limit 512MB)
- Machine stops, all requests get 503

The genesis seed (`PEER_SYNC_SEED=true`) loads all avens, schemas, and bootstraps the scaffold. With Postgres + Bun + cojson, 512MB is insufficient.

---

## Issue 1: OOM - Increase VM memory

**Fix**: Update [services/sync/fly.toml](services/sync/fly.toml):

```toml
[vm]
  memory = "1024mb"
  swap_size_mb = 256
```

---

## Issue 2: Health check grace period too short

Init (account load + seed + scaffold) takes ~25s. Grace period is 5s.

**Fix**: In [services/sync/fly.toml](services/sync/fly.toml):

```toml
[[services.http_checks]]
  interval = "15s"
  timeout = "5s"
  grace_period = "60s"
  method = "GET"
  path = "/health"
  protocol = "http"
```

---

## Issue 3: Never push VITE_AVEN_TEST_* to Fly

`VITE_AVEN_TEST_ACCOUNT`, `VITE_AVEN_TEST_SECRET`, `VITE_AVEN_TEST_MODE`, `VITE_AVEN_TEST_NAME` are **client-only** test credentials. They must never be set as Fly secrets on the sync server.

**Actions:**

1. Remove from Fly if present: `fly secrets unset VITE_AVEN_TEST_ACCOUNT VITE_AVEN_TEST_SECRET VITE_AVEN_TEST_MODE VITE_AVEN_TEST_NAME -a sync-next-maia-city`
2. Update [scripts/fly-secrets-from-env.sh](scripts/fly-secrets-from-env.sh): Add an explicit allowlist so only required vars are ever pushed. The script already uses a fixed list (no VITE_AVEN_TEST_*), but add a comment and/or validation that blocks these vars if someone tries to add them.
3. Document in [scripts/fly-next-setup.md](scripts/fly-next-setup.md): "Never set VITE_AVEN_TEST_* on Fly - client-only, local dev."

---

## Keep PEER_SYNC_SEED=true

Do **not** set `PEER_SYNC_SEED=false`. Keep it true for now as requested.

---

## Execution Steps

1. Update `services/sync/fly.toml`: memory 1024mb, swap 256mb, health check grace_period 60s
2. Remove VITE_AVEN_TEST_* from Fly secrets (if present)
3. Add allowlist comment/guard in `fly-secrets-from-env.sh` and doc in `fly-next-setup.md`
4. Redeploy sync service
5. Verify machine stays running and health checks pass

---

## Cojson: trusting vs private (reference)

**trusting** – Transaction stored in plaintext (`changes`). The sync server and storage backend can read the full content. Use for: public data, group membership, anything where server visibility is acceptable.

**private** – Transaction encrypted (`encryptedChanges`). Only group members with the read key can decrypt. The server sees only ciphertext and metadata (e.g. `keyUsed`). Use for: passwords, private notes, sensitive data.


| Privacy  | Server sees     | Who can read         |
| -------- | --------------- | -------------------- |
| trusting | Full content    | Anyone with the data |
| private  | Ciphertext only | Group members only   |


