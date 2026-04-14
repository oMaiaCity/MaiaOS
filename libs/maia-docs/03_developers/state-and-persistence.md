# State and Persistence Patterns

This document describes which state in MaiaOS is ephemeral (in-memory by design) vs persistable, and how to configure production storage.

## Ephemeral by Design (Keep In-Memory)

The following state is correctly held in memory only. Don't persist it:

| Location | Purpose | Reason to Keep In-Memory |
| -------- | ------- | ------------------------- |
| `subscriptionCache` | Reactive subscription deduplication | Performance; node-scoped |
| `StyleEngine.cache` | Compiled CSS | Performance |
| `pendingRerenders` | UI batching | Must be in-memory |
| `pendingMessages` | In-flight before processInbox | Comes from CoStream, processed then discarded |
| `machine.eventPayload` | Per-transition payload | Ephemeral; discarded after action |
| `_cachedMaiaOsId` | Backend lookup cache | Performance |
| `agentIdCache` (jazz) | CoJSON internal | Library implementation |
| `ReactiveStore._subscribers` | Subscription set | Runtime only |

## Implemented: machine.currentState → Context

**ProcessEngine** persists `_currentState` to the actor's context CoValue on every transition:

- **On transition**: `updateContextCoValue(actor, { _currentState: targetState })` is called after `machine.currentState` changes
- **On createMachine**: Reads `actor.context?.value?._currentState`; if valid (exists in `stateDef.states`), restores instead of using `stateDef.initial`
- **Benefit**: Survives page reload and reconnect; actors restore to the last FSM state

## Could Persist (Future)

| Location | Current | Persist To | Benefit |
| -------- | ------- | ---------- | ------- |
| `machine.history` | In-memory array | CoStream (audit log) | Time-travel, debugging, compliance |
| sync service | PGlite/Postgres required | See below | Sync server survives restart |

### Recommendations

- **machine.history** – Persist transitions to a CoStream; CRDT handles ordering/replication automatically.
- **sync service** – Use `PEER_SYNC_STORAGE=pglite` or `postgres` with `PEER_DB_PATH` or `PEER_SYNC_DB_URL` in production (see below).

---

## Sync Service: PEER_SYNC_STORAGE

The sync service requires persistent storage (never in-memory). Two backends are supported:

### PGlite (`PEER_SYNC_STORAGE=pglite`)

- **Use for**: Local development, single-instance production
- **Behavior**: PGlite (WASM Postgres) writes to a file; data persists across restarts
- **Env**: `PEER_SYNC_STORAGE=pglite`, `PEER_DB_PATH=./local-sync.db` (default)
- **Production**: Mount a Fly.io volume at `/data` and set `PEER_DB_PATH=/data/sync.db`

### Postgres (`PEER_SYNC_STORAGE=postgres`)

- **Use for**: Production with Neon, Fly Postgres, or other hosted Postgres
- **Behavior**: Remote Postgres via connection URL
- **Env**: `PEER_SYNC_STORAGE=postgres`, `PEER_SYNC_DB_URL=<connection-string>`

### Configuration

**Sync service** (`services/sync/`):

- `PEER_SYNC_STORAGE=pglite | postgres` – Required; server never runs without persistent storage
- `PEER_DB_PATH` – Default: `./local-sync.db` (pglite). Ignored when postgres.
- `PEER_SYNC_DB_URL` – Required when `PEER_SYNC_STORAGE=postgres` (e.g. Neon, Fly Postgres)
- `AVEN_MAIA_ACCOUNT`, `AVEN_MAIA_SECRET` – Required (run `bun agent:generate`)

---

## Seeding: Two Modes

**simpleAccountSeed** – No account.sparks. Used for all signups (human + agent). Registries set via linkAccountToRegistries.

**genesisAccountSeed** – Full scaffold + vibes. Only when **PEER_MODE=sync** (sync server).

| Trigger | Mode | Behavior |
|---------|------|----------|
| **createAccountWithSecret** (human or agent) | simpleAccountSeed | No account.sparks. Vibes come from sync; registries via link. |
| **Sync PEER_MODE=sync** | genesisAccountSeed | Full scaffold + vibes into sync server account. |
| **handleSeed** (agent mode, manual) | genesisAccountSeed | Manual reseed for dev. |

**SEED_VIBES** (sync server env) controls which vibes are seeded when PEER_MODE=sync: `"all"` or comma-separated `"todos,chat,db,sparks,logs"`.

---

## Registries (Humans and Sparks)

Top-level `account.registries` stores human and spark identity mappings. Only the sync agent seeds it during genesis. Humans and agents link by setting `account.registries` to the sync server's registries co-id.

### Structure

- `account.registries` – CoMap co-id (Maia guardian, public read)
- `registries.sparks` – username → spark co-id (e.g. `°Maia` → maia spark)
- `registries.humans` – username → account co-id

### GET /syncRegistry

Returns `{ registries: "co_z...", "°Maia": "co_z..." }` for linking. Client calls `account.set('registries', registriesId)` once after sign-in or agent init. Sparks resolve via `registries.sparks`.

### POST /register

Register human or spark in the registry:

```json
{ "type": "human" | "spark", "username?": "custom-name", "accountId?": "co_z...", "sparkCoId?": "co_z..." }
```

- `type=human`: requires `accountId`; optional `username` (auto-generated if omitted).
- `type=spark`: requires `sparkCoId`; optional `username`.
- Uniqueness: 409 if username exists and maps to a different co-id. Same co-id is idempotent.

### Auto-Register Human

On sign-in and sign-up, `linkAccountToRegistries` runs and automatically calls `POST /register` with `{ type: "human", accountId }`. Fire-and-forget; server auto-generates name (e.g. `human:brave-dolphin-71234567`).
