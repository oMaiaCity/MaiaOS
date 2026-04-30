# @MaiaOS/db - Collaborative Database Layer

A collaborative database layer built on cojson with automatic CoValue loading, schema indexing, and CRUD operations.

## Overview

- **MaiaDB**: Single storage class for CRUD, resolve, indexing, seeding
- **Schema indexing**: Automatic schema-based indexing in `spark.os.indexes`
- **Universal resolver**: Single `resolve()` API for schemas, co-values, and reactive resolution
- **CoCache**: Unified cache for subscriptions, stores, and resolved data
- **Pure cojson**: Built on raw cojson (RawCoMap, RawCoList, RawCoStream)

## Architecture

```
MaiaOS Operations (maia.do({ op: 'read', ... }))
        ↓
  DataEngine → MaiaDB
        ↓
  Universal read() + resolve() + factory-index-manager
        ↓
  CoCache + collection-helpers
        ↓
  cojson (RawCoMap, RawCoList, RawCoStream)
```

## Key Exports

- `MaiaDB` - Single database class (storage layer)
- Account primitives (`createAccountWithSecret`, `loadAccount`) - in @MaiaOS/peer; db exports `ensureProfileForNewAccount`, `simpleAccountSeed` for wiring
- `resolve`, `resolveReactive`, `checkCotype`, `loadFactoriesFromAccount` - Schema/co-value resolution
- `waitForStoreReady`, `waitForReactiveResolution` - Store access helpers
- `setupSyncPeers`, `subscribeSyncState` - Sync peer configuration
- `createGroup`, `createProfile`, `createCoMap`, `createCoList`, `createCoStream`
- `createAndPushMessage`, `processInbox` - Inbox handling
- `simpleAccountSeed`, `ensureProfileForNewAccount` - Bootstrap and profile wiring

## Project Structure

```
libs/maia-db/
├── src/
│   ├── cojson/           # CoJSON layer
│   │   ├── cache/        # CoCache
│   │   ├── core/         # MaiaDB
│   │   ├── crud/         # read, create, update, delete, collection-helpers
│   │   ├── indexing/     # factory-index-manager, storage-hook-wrapper
│   │   ├── schema/       # resolver, seed
│   │   └── peers/        # sync-peers
│   ├── schemas/          # registry
│   └── migrations/       # profile-bootstrap (ensureProfileForNewAccount), seeding
└── package.json
```

## Sync Peer Setup

`@MaiaOS/db` provides client-side peer setup functions for connecting to the self-hosted sync service:

### `setupSyncPeers(options)`

Configure `LocalNode` to connect to the sync service via WebSocket.

**Parameters:**
- `options.node` (LocalNode, required) - The LocalNode instance to configure
- `options.syncDomain` (string, optional) - Sync service domain (defaults to relative `/sync` in browser, or `PEER_MOAI` env var)

**Returns:** `Promise<void>`

**Example:**
```javascript
import { setupSyncPeers } from '@MaiaOS/db';

// After creating/loading account
const { loadingPromise } = await signIn({ type: 'passkey', mode: 'signup' });
const { node, account } = await loadingPromise;

// Configure sync peers (connects to sync service automatically)
await setupSyncPeers({
  node,
  syncDomain: 'sync.next.maia.city' // Optional, defaults to relative path in dev
});
```

### `subscribeSyncState(listener)`

Subscribe to sync status changes (connection state, syncing status, errors).

**Parameters:**
- `listener` (Function) - Callback: `(state) => void`
  - `state.connected` (boolean) - WebSocket connected?
  - `state.syncing` (boolean) - Actively syncing?
  - `state.error` (string | null) - Error message if any
  - `state.status` (string | null) - Status: 'authenticating' | 'loading-account' | 'syncing' | 'connected' | 'error'

**Returns:** `Function` - Unsubscribe function

**Example:**
```javascript
import { subscribeSyncState } from '@MaiaOS/db';

const unsubscribe = subscribeSyncState((state) => {
  console.log("Sync:", state.connected ? "Online" : "Offline");
  if (state.error) {
    console.error("Sync error:", state.error);
  }
});

// Later: unsubscribe when done
unsubscribe();
```

**Note:** These functions are also available via `@MaiaOS/runtime` bundle for convenience.

## Dependencies

- **cojson** - RawCoMap, RawCoList, LocalNode
- **cojson-transport-ws** - WebSocket transport for sync
- **@MaiaOS/runtime** - DataEngine (maia.do) calls MaiaDB
- **@MaiaOS/factories** - Schema registry, validation
- **@MaiaOS/storage** - Storage adapters

## License

Part of MaiaOS project
