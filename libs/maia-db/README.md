# @MaiaOS/db - Collaborative Database Layer

A collaborative database layer built on cojson with automatic CoValue loading, schema indexing, and CRUD operations.

## Overview

- **CoJSONBackend**: Implements `DBAdapter` for MaiaOS operations (read, create, update, delete)
- **Schema indexing**: Automatic schema-based indexing in `spark.os.indexes`
- **Universal resolver**: Single `resolve()` API for schemas, co-values, and reactive resolution
- **CoCache**: Unified cache for subscriptions, stores, and resolved data
- **Pure cojson**: Built on raw cojson (RawCoMap, RawCoList, RawCoStream)

## Architecture

```
MaiaOS Operations (maia.db({ op: 'read', ... }))
        ↓
  DBEngine → CoJSONBackend (DBAdapter)
        ↓
  Universal read() + resolve() + schema-index-manager
        ↓
  CoCache + collection-helpers
        ↓
  cojson (RawCoMap, RawCoList, RawCoStream)
```

## Key Exports

- `CoJSONBackend`, `createCoJSONAPI` - Database backend for operations layer
- `loadAccount`, `createAccountWithSecret` - Account management
- `resolve`, `resolveReactive`, `checkCotype`, `loadSchemasFromAccount` - Schema/co-value resolution
- `waitForStoreReady`, `waitForReactiveResolution` - Store access helpers
- `setupSyncPeers`, `subscribeSyncState` - Sync peer configuration
- `createGroup`, `createProfile`, `createCoMap`, `createCoList`, `createCoStream`
- `createAndPushMessage`, `processInbox` - Inbox handling
- `simpleAccountSeed`, `schemaMigration` - Bootstrap and migration

## Project Structure

```
libs/maia-db/
├── src/
│   ├── cojson/           # CoJSON layer
│   │   ├── cache/        # CoCache
│   │   ├── core/         # CoJSONBackend, factory
│   │   ├── crud/         # read, create, update, delete, collection-helpers
│   │   ├── indexing/     # schema-index-manager, storage-hook-wrapper
│   │   ├── schema/       # resolver, seed
│   │   └── peers/        # sync-peers
│   ├── schemas/          # registry
│   └── migrations/       # schema.migration
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
const { node, account } = await signUpWithPasskey();

// Configure sync peers (connects to sync service automatically)
await setupSyncPeers({
  node,
  syncDomain: 'moai.next.maia.city' // Optional, defaults to relative path in dev
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

**Note:** These functions are also available via `@MaiaOS/core` bundle for convenience.

## Dependencies

- **cojson** - RawCoMap, RawCoList, LocalNode
- **cojson-transport-ws** - WebSocket transport for sync
- **@MaiaOS/operations** - DBAdapter, DBEngine
- **@MaiaOS/schemata** - Schema registry, validation
- **@MaiaOS/storage** - Storage adapters

## License

Part of MaiaOS project
