# State and Persistence Patterns

This document describes which state in MaiaOS is ephemeral (in-memory by design) vs persistable, and how to configure production storage.

**See also:** [Account authentication types](./account-authentication-types.md) — clarifies **passkey** vs **secret key** vs **human** identities (`type: 'human'` in the identity index) vs server **agent** accounts.

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

**simpleAccountSeed** – No top-level `account.sparks` at creation time. Used for all client signups (human + agent). The sparks registry co-id is anchored once via `POST /bootstrap` right after account creation.

**genesisAccountSeed** – Full scaffold + vibes. Gated only by **`PEER_SYNC_SEED=true`**: if the server account has no `account.sparks` and the flag is off, sync **fails fast** (operator must run one boot with the flag, then unset). Implemented as a reconcile step in `@MaiaOS/flows`.

| Trigger | Mode | Behavior |
|---------|------|----------|
| **createAccountWithSecret** (human or agent) | simpleAccountSeed | `account.sparks` anchored via `POST /bootstrap` right after creation. |
| **Sync** (`@MaiaOS/flows` genesis step + `PEER_SYNC_SEED=true`) | genesisAccountSeed | Full scaffold + vibes into sync server account (genesis). |

**SEED_VIBES** (sync server env) controls which vibes are seeded during genesis: `"all"` or comma-separated slugs such as `"todos,chat,addressbook,sparks,quickjs,profile,paper"` (`quickjs` is the **Vibe Creator** vibe; developer logs live in its **logs** tab).

---

## Account bootstrap — unified `POST /bootstrap`

Five overlapping paths (client `anchorSparksOnSignup`, `/signup`, `/register type=human`, client `ensureHumanIdentityForCurrentAccount`, server `scheduleGuardianAdminPromotion`) collapsed into **one atomic server endpoint**. One trip end-to-end, idempotent, safe to retry.

### Contract

- Request: `POST /bootstrap` with body `{ accountId: "co_z...", profileId: "co_z..." }`
- Response: `{ sparks: "co_z..." }` — the sparks registry co-id for `account.sparks`.

Crucially, `°maia → maiaSparkCoId` is **not** returned. It is written once at genesis inside the sparks CoMap (whose group is `everyone: reader`) and flows to every client via normal CoJSON sync. `MaiaDB.resolveSystemSparkCoId` reads it locally.

### Server responsibilities (atomic, idempotent, <1s warm)

1. Return the sparks registry co-id (`getSparksRegistryCoId(worker.account)`).
2. If `accountId === AVEN_MAIA_GUARDIAN`: promote to `°maia` spark admin via `tryAddGuardianToMaiaSpark` + seed `/sync/write`, `/llm/chat`, `/admin/storage` capabilities (all idempotent).
3. Run `ensureIdentity({ type: 'human', accountId, profileId })` so the identity index carries a row for this account.

All three steps no-op on repeat calls. Failures in step 2 or 3 are logged and swallowed (the client's anchor succeeds and the server retries on the next call).

### Client responsibilities

1. Load/create the `RawAccount` locally (secret key or passkey).
2. Call `bootstrapAccountHandshake(account, { syncBaseUrl, node })` — single helper in `@MaiaOS/peer`.
3. The helper calls `POST /bootstrap`, then `account.set('sparks', sparksId)` (private — see below), then `node.syncManager.waitForStorageSync` for both `accountId` and `sparksId`.
4. Only after that does `MaiaOS.boot({ node, account })` run. `MaiaDB.resolveSystemSparkCoId` reads `account.sparks` + the sparks CoMap directly — bounded by `TIMEOUT_COVALUE_LOAD` (5s), no 20s × N cascades.

### Account pointer privacy

CoJSON's account/group permission rules only accept `'trusting'` writes for a fixed set of keys (`readKey`, `groupSealer`, `profile`, `root`, key-reveal entries, parent-extension entries, write keys) or valid member-role assignments. An arbitrary account key such as `sparks` with a `co_z…` value is interpreted as `setRole('sparks', '<co_z…>')` and marked invalid — the write silently does not persist.

Therefore:

- `account.profile` is written with `'trusting'` (whitelisted key; used by CoJSON's own validation before migrations run, so must stay public).
- `account.sparks` is written with default **private** privacy. Any signed-in agent holds the agentSecret and can decrypt the readKey immediately (it is sealed for the sealer secret derived from that agentSecret), so no cross-peer readKey sync is needed for a local-first read.

### Centralized timeouts

Single source in [`libs/maia-peer/src/timeouts.js`](libs/maia-peer/src/timeouts.js). No scattered literals.

| Constant | Value | Purpose |
|----------|-------|---------|
| `TIMEOUT_WS_CONNECT` | 10s | Initial WS handshake to sync |
| `TIMEOUT_COVALUE_LOAD` | 5s | `waitForStoreReady` for a single CoValue |
| `TIMEOUT_HTTP` | 30s | `POST /bootstrap` (covers Fly cold start + guardian promote + identity index write) |
| `TIMEOUT_STORAGE_PERSIST` | 30s | PGlite / IndexedDB flush |

### Observable bootstrap phases

`@MaiaOS/peer` exports `BOOTSTRAP_PHASES`, `setBootstrapPhase`, `subscribeBootstrapPhase`, and `BootstrapError`. The app renders a phase-to-label map in the loading overlay subtitle; on failure it shows `"phase 'handshake': HTTP 502"` instead of a generic timeout. Perf timings are routed through `perfBootstrap` in `@MaiaOS/logs` (gated by `LOG_MODE=perf.app.bootstrap`).

Linear phase sequence on a cold boot:

```
init → connecting_sync → loading_account → handshake → anchoring_sparks
     → reading_system_spark → initializing_maiadb → ready
                                                   ↘ failed (BootstrapError.phase pinned)
```

### Resilience guarantees

- **Fresh browser + existing secret key** — `bootstrapAccountHandshake` re-anchors `account.sparks` (private) and re-writes the identity index row; ready in <3s warm.
- **Account has no profile** — CoJSON's validation trips before migrations. `loadAccount` in `@MaiaOS/peer` recovers via `recoverAccountWithMissingProfile` (constructs `LocalNode`, loads account, runs `ensureProfileForNewAccount`).
- **Account unavailable from all peers** — wrapped as `{ isAccountNotFound: true }`; the app treats it as first-time setup and creates via `ensureAccount`.
- **Guardian race** — if `AVEN_MAIA_GUARDIAN` is not yet in storage at sync startup, the one-shot `tryAddGuardianToMaiaSpark` defers to the first `POST /bootstrap` call, which promotes inline. No retry scheduler.

## Sparks and identities

- **`account.sparks`** – CoMap co-id (`spark name → spark co-id`). The `°maia` entry is seeded once at genesis by the sync server. Clients link by calling `POST /bootstrap`, which returns the registry co-id for `account.set('sparks', id)` (default private — see "Account pointer privacy" above).
- **Identities** – One factory `identity.factory.maia` with `{ type: 'human' | 'aven', account, profile }` and `indexing: true`. Instances are listed under `spark.os.indexes[<identityFactoryCoId>]` (auto-maintained). Display names come from `profile.name`.

### POST /register — aven + spark only

Register an **aven** (server self-registration at startup) or a **spark** (server-created scaffold). Humans are NOT registered here; they go through `POST /bootstrap`.

```json
{ "type": "spark" | "aven", "username?": "custom-name", "accountId?": "co_z...", "profileId?": "co_z...", "sparkCoId?": "co_z..." }
```

- `type=aven`: requires `accountId` + `profileId`; server runs `ensureIdentity({ type: 'aven', ... })`.
- `type=spark`: requires `sparkCoId`; optional `username`.
- Uniqueness: 409 if `username` already maps to a different co-id. Same co-id is idempotent.

### Guardians

A **guardian** (an account listed as admin of the `°maia` spark guardian group) can approve members in the Capabilities UI to grant `/sync/write` + `/llm/chat` + `/admin/storage`. Separate from `POST /bootstrap` — which only ever touches the caller's own identity + (if they are the guardian configured via `AVEN_MAIA_GUARDIAN`) their own capabilities.
