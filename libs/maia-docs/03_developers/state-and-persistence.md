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

**StateEngine** persists `_currentState` to the actor's context CoValue on every transition:

- **On transition**: `updateContextCoValue(actor, { _currentState: targetState })` is called after `machine.currentState` changes
- **On createMachine**: Reads `actor.context?.value?._currentState`; if valid (exists in `stateDef.states`), restores instead of using `stateDef.initial`
- **Benefit**: Survives page reload and reconnect; actors restore to the last FSM state

## Could Persist (Future)

| Location | Current | Persist To | Benefit |
| -------- | ------- | ---------- | ------- |
| `machine.history` | In-memory array | CoStream (audit log) | Time-travel, debugging, compliance |
| maia-sync `inMemory=true` | PGlite in-memory | PGlite on disk (`dbPath`) | Sync server survives restart |

### Recommendations

- **machine.history** – Persist transitions to a CoStream; CRDT handles ordering/replication automatically.
- **maia-sync** – Use `inMemory: false` and `dbPath` in production (see below).

---

## maia-sync: inMemory vs dbPath

The sync service and agent use PGlite for CoValue storage. Two modes matter:

### In-Memory (`inMemory: true`)

- **Use for**: Local development, tests, ephemeral agents
- **Behavior**: PGlite runs in memory; all data is lost on process exit
- **Env**: `AGENT_STORAGE=in-memory` (sync service)

### On-Disk (`inMemory: false`, `dbPath` set)

- **Use for**: Production sync server, durable agents
- **Behavior**: PGlite writes to a file; data persists across restarts
- **Env**: `AGENT_STORAGE=pglite`, `DB_PATH=/data/sync.db` (sync service)
- **Production**: Mount a Fly.io volume at `/data` and set `DB_PATH=/data/sync.db`

### Configuration

**Sync service** (`services/sync/`):

- `AGENT_STORAGE=in-memory` → in-memory (dev default when unspecified)
- `AGENT_STORAGE=pglite` + `DB_PATH=/data/sync.db` → persistent (production)
- Uses compact env vars: `ACCOUNT_MODE`, `AGENT_ID`, `AGENT_SECRET`, `AGENT_STORAGE`

---

## Vibe Seeding: Human vs Agent Mode

**`VITE_MAIA_CITY_SEED_VIBES`** controls which vibes (todos, chat, db, sparks, creator) are auto-seeded when a new account is created. It only applies in **human mode** (browser sign-up via passkey).

| Mode | Where | `VITE_MAIA_CITY_SEED_VIBES` | Behavior |
|------|-------|-----------------------------|----------|
| **Human** | maia-city (browser) | `todos,chat,db,sparks,creator` or `all` | On sign-up, `createAccountWithSecret` reads this env (via `import.meta.env`). `filterVibesForSeeding` seeds the specified vibes into the new account. Default: `all` if unset. |
| **Agent** | sync service | N/A | `loadOrCreateAgentAccount` uses `skipAutoSeeding: true`. No vibe seeding; sync server only needs bootstrap data. |

**Values**: `"none"` (no seeding), `"all"` (all vibes), or comma-separated: `"todos,chat,db,sparks,creator"`.
