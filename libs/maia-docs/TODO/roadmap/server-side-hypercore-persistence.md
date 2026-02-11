---
name: Server-Side Hypercore Persistence
overview: Implement Hyperbee/Corestore persistence layer for sync server, mapping cojson StorageAPI to Hypercore architecture with group-based permissions as trust root. Focus ONLY on server-side persistence - no Tauri, no P2P replication.
todos:
  - id: milestone-0
    content: "Capture Current State: Audit sync server, StorageAPI, session system, group ownership, map dependencies"
    status: pending
  - id: milestone-1
    content: "Implement Corestore Adapter: Create Corestore instance, Hypercore management, Hyperbee adapter"
    status: pending
  - id: milestone-2
    content: "Implement Hyperbee Storage Backend: Map StorageAPI to Hyperbee/Corestore operations"
    status: pending
  - id: milestone-3
    content: "Implement Session-to-Hypercore Mapping: Map sessions to Hypercores, load transactions for SessionMap"
    status: pending
  - id: milestone-4
    content: "Implement Group Permissions Mapping: Map group ownership to Hypercore architecture"
    status: pending
  - id: milestone-5
    content: "Testing & Documentation: Verify server persistence, test group ownership, update docs"
    status: pending
isProject: false
---

# Server-Side Hypercore Persistence Layer

## Problem Statement

The sync server currently uses **in-memory storage** (no persistence). When the server restarts, all data is lost. We need to add persistent storage using Hypercore/Corestore architecture, mapping cojson's StorageAPI to Hyperbee/Corestore, with groups as the trust root for ownership.

**First Principles:**

- **What MUST be true:** Server needs to persist CoValue data across restarts
- **What can we eliminate:** P2P replication (not needed for server persistence), Tauri (out of scope)
- **Irreducible core:** Map cojson StorageAPI → Hyperbee/Corestore → Persist to disk

## Success Criteria

- **Desirable**: Server persists all CoValue data across restarts
- **Feasible**: Implement StorageAPI using Hyperbee/Corestore (proven stack)
- **Viable**: Simple, maintainable persistence layer that integrates with existing sync server

## Solution Approach

**Architecture: cojson StorageAPI → Hyperbee/Corestore → Disk**

**Storage Backend Choice:**

- **Testing Phase:** Use **default disk storage** (random-access-file) via Corestore string path
  - Simple: `new Corestore('./storage-directory')` uses disk files by default
  - No additional dependencies needed
  - Good for testing and initial implementation
  - **Future:** Can upgrade to RocksDB (`hypercore-storage`) later if performance requires it

**Trust Root Hierarchy:**

- **Passkeys** = Ultimate trust root (hardware-backed, controls groups)
- **Groups** = Ownership layer (user's personal "safe", owns CoValues)
- **Hypercores/Sessions** = Storage layer (sessions map to Hypercores)

**Key Principles:**

- **Skip Autobase** - cojson's CRDT logic already coordinates sessions
- **Group Ownership** - Groups own all CoValues (`ruleset.type === "ownedByGroup"`)
- **Mapping:** Group ownership → CoValues → Sessions → Hypercores
- **Session → Hypercore** - Each SessionID = one Hypercore (1-to-1 mapping)
- **StorageAPI Implementation** - Map all StorageAPI methods to Hyperbee/Corestore operations
- **Default Disk Storage** - Use Corestore with string path (simplest approach for testing phase)

## Architecture Overview

### Current State

```
Sync Server (libs/maia-sync/src/sync-server.js)
├─ LocalNode (cojson)
├─ Storage: In-memory (no persistence) ❌
└─ WebSocket: Receives messages from browsers ✅
```

### Target State

```
Sync Server (libs/maia-sync/src/sync-server.js)
├─ LocalNode (cojson)
├─ Storage: Hyperbee/Corestore (persistent) ✅
│  ├─ Group Hypercores (group metadata)
│  ├─ Session Hypercores (one per SessionID)
│  └─ CoValue metadata (in Hyperbee)
└─ WebSocket: Receives messages from browsers ✅
```

### Trust Root Hierarchy

**Complete Trust Chain:**

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Passkeys (Ultimate Trust Root)                │
│ ├─ Hardware-backed (Secure Enclave/TPM)                │
│ ├─ PRF evaluation → prfOutput (deterministic)          │
│ ├─ agentSecret → accountID (deterministic)             │
│ └─ Controls group membership (add/remove passkeys)     │
└─────────────────────────────────────────────────────────┘
                         ↓ Controls
┌─────────────────────────────────────────────────────────┐
│ Layer 2: Groups (User's Personal "Safe")                │
│ ├─ Each user has their own group                         │
│ ├─ Owns all CoValues (ruleset.type === "ownedByGroup") │
│ ├─ Group's Hypercore key (controls replication)          │
│ └─ Group's read key (encrypts transactions)            │
└─────────────────────────────────────────────────────────┘
                         ↓ Owns
┌─────────────────────────────────────────────────────────┐
│ Layer 3: CoValues (Owned by Groups)                     │
│ ├─ All CoValues owned by groups                         │
│ ├─ Group controls permissions                            │
│ └─ Group's read key encrypts transactions                │
└─────────────────────────────────────────────────────────┘
                         ↓ Sessions map to
┌─────────────────────────────────────────────────────────┐
│ Layer 4: Hypercores/Sessions (Storage Layer)           │
│ ├─ Each session = one Hypercore                         │
│ ├─ Stores encrypted transaction bytes                  │
│ ├─ Ed25519 signatures (block integrity)                │
│ └─ Blake3 hashing (merkle tree)                        │
└─────────────────────────────────────────────────────────┘
```

**Trust Root Model:**

**1. Passkeys = Ultimate Trust Root:**

- Hardware-backed (Secure Enclave/TPM)
- PRF evaluation → deterministic secrets
- Cannot be extracted by software
- Same passkey + salt → same accountID (always!)
- **Controls group membership** (can add/remove passkeys from groups)

**2. Groups = User's Personal "Safe" (Ownership Layer):**

- Each human/user has their own personal group (their "safe")
- Controlled by 1+ passkey accounts (multi-device support)
- Group owns all CoValues (`ruleset.type === "ownedByGroup"`)
- Group's Hypercore key = Controls replication (immutable, stable)
- Group's read key = Encrypts transactions (rotates when passkeys added/removed)
- Accounts (passkeys) are members of groups (can be added/removed)

**3. CoValues = Owned by Groups:**

- All CoValues owned by groups (`ruleset.type === "ownedByGroup"`)
- Group controls permissions and encryption
- Group's read key encrypts all transactions

**4. Sessions → Hypercores = Storage Layer:**

- Each session = one Hypercore (stores transactions)
- Sessions belong to accounts, accounts belong to groups
- **Mapping:** Group ownership → CoValues → Sessions → Hypercores

**4. Hypercores/Sessions = Store Data:**

- Each session = one Hypercore (stores transactions)
- Sessions belong to accounts
- CoValues owned by groups
- Transactions encrypted with group's read key

### Storage Mapping

**CoValue Headers → Hyperbee:**

```
Hyperbee Key: `covalue/${coValueID}/header`
Hyperbee Value: CoValueHeader (JSON)
```

**Sessions → Hypercores:**

```
Corestore Name: `session/${sessionID}`
Hypercore Blocks: Transactions (one transaction = one block)
```

**Groups → Hypercores:**

```
Corestore Name: `group/${groupID}`
Hypercore Blocks: Group metadata, member changes, key rotations
```

**Known States → Hyperbee:**

```
Hyperbee Key: `covalue/${coValueID}/knownState`
Hyperbee Value: CoValueKnownState (JSON)
```

## Implementation Milestones

### Milestone 0: Capture Current State & System Audit

**CRITICAL: This MUST be completed before all other milestones**

**System Audit:**

- Audit sync server (`libs/maia-sync/src/sync-server.js`)
  - Current storage: in-memory only
  - LocalNode initialization
  - WebSocket handling
- Audit cojson StorageAPI (`libs/maia-db/node_modules/cojson/src/storage/types.ts`)
  - All required methods: `load()`, `store()`, `getKnownState()`, etc.
  - Callback-based API (not promises)
  - Transaction handling
- Audit cojson session system (`libs/maia-db/node_modules/cojson/src/coValueCore/SessionMap.ts`)
  - SessionLog structure
  - Transaction storage
  - CRDT merge logic
- Audit group ownership (`libs/maia-db/node_modules/cojson/src/coValues/group.ts`)
  - Group owns CoValues (`ruleset.type === "ownedByGroup"`)
  - Group read key rotation
  - Member management
- Map dependencies
  - Corestore, Hyperbee, Hypercore packages
  - Integration points with LocalNode
- Document current state (how things work NOW)

**Output**: Complete baseline understanding before making changes

**Human Checkpoint:** ✋ Present audit findings before proceeding

### Milestone 1: Implement Corestore Adapter

**Goal:** Create Corestore instance and basic Hypercore management

**Implementation:**

- Install dependencies
  - `corestore` package
  - `hyperbee` package
  - `hypercore` package (if needed)
  - **Note:** Using default disk storage (no `hypercore-storage`/RocksDB needed for testing phase)
- Create `libs/maia-sync/src/storage/corestore-adapter.ts`
  - Initialize Corestore instance with storage path (string path = default disk storage)
  - Uses `random-access-file` automatically (no explicit storage backend needed)
  - Create/retrieve Hypercores by name
  - Handle Corestore lifecycle (ready, close)
- Create `libs/maia-sync/src/storage/hyperbee-adapter.ts`
  - Create Hyperbee instance on top of Hypercore
  - Key-value operations (put, get, del)
  - Batch operations support
- Test Corestore initialization
  - Verify Corestore creates storage directory on disk
  - Verify Hypercores can be created/retrieved
  - Verify data persists across restarts
  - Verify storage directory contains Hypercore files

**Key Implementation:**

```typescript
import Corestore from 'corestore';
import Hyperbee from 'hyperbee';
import path from 'path';

export class CorestoreAdapter {
  private store: Corestore;
  private storagePath: string;

  constructor(storagePath: string) {
    this.storagePath = storagePath;
    // Passing string path uses default disk storage (random-access-file)
    // No need for hypercore-storage/RocksDB for testing phase
    this.store = new Corestore(storagePath);
  }

  async ready() {
    await this.store.ready();
  }

  getCore(name: string) {
    return this.store.get({ name });
  }

  async createHyperbee(coreName: string) {
    const core = this.getCore(coreName);
    await core.ready();
    return new Hyperbee(core, {
      keyEncoding: 'utf-8',
      valueEncoding: 'json'
    });
  }

  async close() {
    await this.store.close();
  }
}
```

**Storage Backend:**
- **Default disk storage** - Corestore automatically uses `random-access-file` when given a string path
- **No RocksDB needed** - Simple file-based storage is sufficient for testing phase
- **Future upgrade path** - Can switch to `hypercore-storage` (RocksDB) later if performance requires it

**Cleanup & Migration:**

- Remove any in-memory storage fallback logic
- Verify Corestore works correctly
- Update storage path configuration

**Human Checkpoint:** ✋ Pause for manual testing and feedback

### Milestone 2: Implement Hyperbee Storage Backend

**Goal:** Implement cojson StorageAPI using Hyperbee/Corestore

**Implementation:**

- Create `libs/maia-sync/src/storage/hyperbee-storage.ts`
  - Implement `StorageAPI` interface
  - Map `store()` → Hyperbee/Corestore operations
  - Map `load()` → Load from Hyperbee/Corestore
  - Map `getKnownState()` → Load from Hyperbee
- Map CoValue headers to Hyperbee:
  ```typescript
  // Store header
  await bee.put(`covalue/${coValueID}/header`, header)

  // Load header
  const headerNode = await bee.get(`covalue/${coValueID}/header`)
  const header = headerNode?.value
  ```
- Map Sessions to Hypercores:
  ```typescript
  // Store session transactions
  const sessionCore = store.get({ name: `session/${sessionID}` })
  await sessionCore.ready()
  for (const tx of transactions) {
    await sessionCore.append(JSON.stringify(tx))
  }

  // Load session transactions
  const sessionCore = store.get({ name: `session/${sessionID}` })
  await sessionCore.ready()
  const transactions = []
  for (let i = 0; i < sessionCore.length; i++) {
    const block = await sessionCore.get(i)
    transactions.push(JSON.parse(block.toString()))
  }
  ```
- Map Known States to Hyperbee:
  ```typescript
  // Store known state
  await bee.put(`covalue/${coValueID}/knownState`, knownState)

  // Load known state
  const knownStateNode = await bee.get(`covalue/${coValueID}/knownState`)
  const knownState = knownStateNode?.value
  ```
- Implement all StorageAPI methods:
  - `store()` - Store CoValue data
  - `load()` - Load CoValue data
  - `getKnownState()` - Get known state
  - `loadKnownState()` - Load known state only
  - `markDeleteAsValid()` - Mark CoValue as deleted
  - `trackCoValuesSyncState()` - Track sync status
  - `getUnsyncedCoValueIDs()` - Get unsynced CoValues
  - `stopTrackingSyncState()` - Stop tracking
  - `onCoValueUnmounted()` - Cleanup
  - `close()` - Close storage

**Key Implementation:**

```typescript
import { StorageAPI } from 'cojson/storage/types';
import { CorestoreAdapter } from './corestore-adapter.js';
import Hyperbee from 'hyperbee';

export class HyperbeeStorage implements StorageAPI {
  private store: CorestoreAdapter;
  private bee: Hyperbee;
  private metadataBee: Hyperbee;

  constructor(storagePath: string) {
    this.store = new CorestoreAdapter(storagePath);
  }

  async initialize() {
    await this.store.ready();
    // Create main Hyperbee for CoValue metadata
    this.bee = await this.store.createHyperbee('metadata');
    // Create Hyperbee for sync state tracking
    this.metadataBee = await this.store.createHyperbee('sync-state');
  }

  store(data: NewContentMessage, handleCorrection: CorrectionCallback): void {
    // Store header
    this.bee.put(`covalue/${data.id}/header`, data.header);
    
    // Store each session's transactions
    for (const [sessionID, sessionData] of Object.entries(data.new)) {
      const sessionCore = this.store.getCore(`session/${sessionID}`);
      for (const tx of sessionData.newTransactions) {
        sessionCore.append(JSON.stringify(tx));
      }
    }
    
    // Store known state
    this.bee.put(`covalue/${data.id}/knownState`, data.knownState);
  }

  load(id: string, callback: (data: NewContentMessage) => void, done?: (found: boolean) => void): void {
    // Load header
    const headerNode = await this.bee.get(`covalue/${id}/header`);
    if (!headerNode) {
      done?.(false);
      return;
    }
    
    // Load all sessions for this CoValue
    const sessions = new Map();
    // ... load sessions from Hypercores
    
    // Load known state
    const knownStateNode = await this.bee.get(`covalue/${id}/knownState`);
    
    callback({
      id,
      header: headerNode.value,
      new: sessions,
      knownState: knownStateNode?.value
    });
    
    done?.(true);
  }

  getKnownState(id: string): CoValueKnownState {
    const knownStateNode = await this.bee.get(`covalue/${id}/knownState`);
    return knownStateNode?.value || new CoValueKnownState();
  }

  // ... implement all other StorageAPI methods
}
```

**Cleanup & Migration:**

- Remove in-memory storage fallback
- Update sync server to use HyperbeeStorage
- Verify 100% migration complete

**Human Checkpoint:** ✋ Pause for manual testing and feedback

### Milestone 3: Implement Session-to-Hypercore Mapping

**Goal:** Map cojson sessions to Hypercores, load transactions for SessionMap

**Implementation:**

- Create `libs/maia-sync/src/storage/session-to-hypercore.ts`
  - Map SessionID → Hypercore name (deterministic)
  - Map Transaction → Hypercore block
  - Load transactions from session Hypercores
- Integrate with cojson's SessionMap
  - Load transactions from all session Hypercores
  - Pass to SessionMap for CRDT merge
  - No Autobase needed - use cojson's merge logic directly
- Handle session updates
  - Append new transactions to session Hypercore
  - Update session metadata (lastIdx, lastSignature)
- Test CRDT merging
  - Multiple sessions writing concurrently
  - Verify cojson's SessionMap merges correctly
  - Verify no data loss or conflicts

**Key Implementation:**

```typescript
// Load transactions from session Hypercores
async function loadSessionTransactions(
  store: CorestoreAdapter,
  sessionID: SessionID
): Promise<Transaction[]> {
  const sessionCore = store.getCore(`session/${sessionID}`);
  await sessionCore.ready();
  
  const transactions = [];
  for (let i = 0; i < sessionCore.length; i++) {
    const block = await sessionCore.get(i);
    transactions.push(JSON.parse(block.toString()));
  }
  return transactions;
}

// Load all sessions for a CoValue
async function loadCoValueSessions(
  store: CorestoreAdapter,
  coValueID: string
): Promise<Map<SessionID, SessionLog>> {
  // Get all session IDs for this CoValue from metadata
  const sessionIDs = await getSessionIDsForCoValue(coValueID);
  
  const sessions = new Map();
  for (const sessionID of sessionIDs) {
    const transactions = await loadSessionTransactions(store, sessionID);
    sessions.set(sessionID, {
      sessionID,
      transactions
    });
  }
  
  return sessions;
}
```

**Cleanup & Migration:**

- Remove any Autobase references (if added)
- Verify cojson's SessionMap handles merging correctly
- Update all session loading to use Hypercores

**Human Checkpoint:** ✋ Pause for manual testing and feedback

### Milestone 4: Implement Group Permissions Mapping

**Goal:** Map group ownership to Hypercore architecture

**Implementation:**

- Create `libs/maia-sync/src/storage/group-permissions.ts`
  - Map group ownership model
  - Groups own CoValues (`ruleset.type === "ownedByGroup"`)
  - Group's Hypercore key controls replication
  - Group's read key encrypts transactions
- Store group metadata in Hyperbee:
  ```typescript
  // Store group metadata
  await bee.put(`group/${groupID}/metadata`, {
    readKey: currentReadKey,
    members: memberList,
    ownedCoValues: coValueIDs
  })
  ```
- Map CoValue → Group ownership:
  ```typescript
  // When storing CoValue, also store group ownership
  const groupID = getGroupIDFromCoValue(coValue);
  await bee.put(`covalue/${coValueID}/group`, groupID);
  await bee.put(`group/${groupID}/covalues/${coValueID}`, true);
  ```
- Handle key rotation:
  - When group rotates read key, update group metadata
  - Group's Hypercore key unchanged (stable)
  - Only read key rotates (for encryption)
- Test group ownership:
  - Verify groups own CoValues
  - Verify group read key rotation works
  - Verify group Hypercore key unchanged

**Key Implementation:**

```typescript
// Get group that owns a CoValue
async function getGroupForCoValue(
  bee: Hyperbee,
  coValueID: string
): Promise<string | null> {
  const groupNode = await bee.get(`covalue/${coValueID}/group`);
  return groupNode?.value || null;
}

// Get all CoValues owned by a group
async function getCoValuesForGroup(
  bee: Hyperbee,
  groupID: string
): Promise<string[]> {
  const coValues = [];
  // Iterate over group's CoValues
  for await (const node of bee.createReadStream({
    gt: `group/${groupID}/covalues/`,
    lt: `group/${groupID}/covalues/\xff`
  })) {
    coValues.push(node.key.split('/').pop());
  }
  return coValues;
}
```

**Cleanup & Migration:**

- Remove any direct Hypercore key rotation logic
- Verify group permissions map correctly
- Update all group access checks

**Human Checkpoint:** ✋ Pause for manual testing and feedback

### Milestone 5: Testing & Documentation

**Goal:** Verify server persistence works correctly

**Testing:**

- Test server persistence
  - Start server, create CoValues
  - Restart server, verify data persists
  - Verify sessions load correctly
  - Verify transactions load correctly
- Test group ownership
  - Verify groups own CoValues
  - Verify group read key rotation
  - Verify group Hypercore key unchanged
- Test WebSocket sync (unchanged)
  - Verify browsers can still sync via WebSocket
  - Verify server persists received data
  - Verify server can serve persisted data

**Documentation:**

- Update developer docs (`libs/maia-docs/03_developers/`)
  - Document Hyperbee storage architecture
  - Document session-to-Hypercore mapping
  - Document group-as-trust-root model
- Update sync server README
  - Document storage configuration
  - Document storage path setup
- ❌ Skip `libs/maia-docs/agents/LLM_*.md` (auto-generated)

**Human Checkpoint:** ✋ Final approval before shipping

## File Structure

**New Files:**

- `libs/maia-sync/src/storage/corestore-adapter.ts` - Corestore adapter
- `libs/maia-sync/src/storage/hyperbee-adapter.ts` - Hyperbee adapter
- `libs/maia-sync/src/storage/hyperbee-storage.ts` - Hyperbee StorageAPI implementation
- `libs/maia-sync/src/storage/session-to-hypercore.ts` - Session-to-Hypercore mapping
- `libs/maia-sync/src/storage/group-permissions.ts` - Group permissions mapping

**Modified Files:**

- `libs/maia-sync/src/sync-server.js` - Add Hyperbee storage backend
- `libs/maia-sync/package.json` - Add Corestore/Hyperbee dependencies
  - Required: `corestore`, `hyperbee`
  - Optional (not needed for testing): `hypercore-storage` (RocksDB backend - can add later if needed)

**Files NOT Modified:**

- ❌ Browser storage (IndexedDB) - stays in cojson universe
- ❌ Browser sync (WebSocket) - stays in cojson protocol
- ❌ All browser client code - no changes needed

## Manual Testing Strategy

- **Server Testing**: 
  - Start server, create CoValues via WebSocket
  - Restart server, verify data persists
  - Verify sessions load correctly
  - Verify transactions load correctly
- **Group Testing**: 
  - Create group, add CoValues
  - Rotate group read key
  - Verify group Hypercore key unchanged
  - Verify group ownership persists

## Risks & Mitigation

**Risk 1: StorageAPI callback complexity**

- **Mitigation**: Follow cojson's StorageAPI interface exactly, test thoroughly

**Risk 2: Session-to-Hypercore mapping**

- **Mitigation**: Use deterministic mapping (SessionID → Hypercore name), test CRDT merging

**Risk 3: Group permissions mapping**

- **Mitigation**: Use layered security model (Hypercore keys + cojson read keys), test key rotation

**Risk 4: Performance with many sessions**

- **Mitigation**: Use Corestore's efficient core management, test with realistic load

## Cryptographic Compatibility Verification

### cojson's Cryptographic Primitives

**Signing:**

- **Ed25519** - Digital signatures for transaction authorization
- `signerSecret` → `signerID` (public key)
- `sign(message, signerSecret)` → `signature`
- `verify(signature, message, signerID)` → boolean

**Encryption/Sealing:**

- **X25519** - Key exchange (for sealing/sealing keys)
- **XSalsa20** - Symmetric encryption (for transaction data)
- `sealerSecret` → `sealerID` (public key)
- `encrypt(data, keySecret)` → `encrypted_U...`
- `decrypt(encrypted, keySecret)` → data

**Key Derivation:**

- **Blake3** - Hash function for deriving secrets
- `agentSecretFromSecretSeed(prfOutput)` → `agentSecret`
- Uses Blake3 with context: `"seal"` and `"sign"`

**Read Keys:**

- **KeySecret** - 32-byte random keys (encrypted with XSalsa20)
- Format: `keySecret_z${base58(32 bytes)}`
- Used to encrypt transaction data in CoValues

### Hypercore's Cryptographic Primitives

**Signing:**

- **Ed25519** - Digital signatures for block signing ✅ **COMPATIBLE**
- `core.keyPair` - Ed25519 keypair
- Signs blocks for tamper-proof append-only log

**Hashing:**

- **Blake3** - Hash function for merkle tree ✅ **COMPATIBLE**
- Used for tree hashing and discovery keys

**Storage:**

- Stores **raw bytes** - No application-level encryption
- Transport encryption only (for P2P replication)
- ✅ **Can store cojson's encrypted transactions as-is**

### Compatibility Analysis

**✅ FULLY COMPATIBLE:**

1. **Ed25519 Signing:**
  - cojson: Uses Ed25519 for transaction signatures
  - Hypercore: Uses Ed25519 for block signatures
  - **Result:** Same primitive, fully compatible
2. **Blake3 Hashing:**
  - cojson: Uses Blake3 for key derivation (`agentSecretFromSecretSeed`)
  - Hypercore: Uses Blake3 for merkle tree hashing
  - **Result:** Same hash function, fully compatible
3. **Storage Format:**
  - cojson: Encrypts transactions with XSalsa20 → produces bytes
  - Hypercore: Stores raw bytes in blocks
  - **Result:** Hypercore can store cojson's encrypted transactions directly

**✅ INDEPENDENT (No Conflict):**

1. **Application-Level Encryption:**
  - cojson: Handles encryption internally (XSalsa20)
  - Hypercore: Doesn't do application-level encryption (just transport)
  - **Result:** No conflict - cojson encrypts, Hypercore stores encrypted bytes
2. **Passkey → AccountID Mapping:**
  - **PRF** → `prfOutput` (32 bytes, deterministic)
  - `prfOutput` → `agentSecret` (via `agentSecretFromSecretSeed()`)
  - `agentSecret` → `accountID` (via `idforHeader()`)
  - **Result:** Pure cojson logic, independent of Hypercore
3. **Group Read Keys:**
  - cojson: Generates `KeySecret` (32-byte random keys)
  - Encrypts transactions with `KeySecret` using XSalsa20
  - Stores encrypted transactions in Hypercore blocks
  - **Result:** Group read keys work independently of Hypercore's keys

### Trust Root Hierarchy & Layered Security Model

**Complete Trust Chain:**

```
┌─────────────────────────────────────────────────────────┐
│ Layer 4: Passkeys (Ultimate Trust Root)                │
│ ├─ Hardware-backed (Secure Enclave/TPM)                │
│ ├─ PRF → agentSecret (deterministic)                    │
│ ├─ agentSecret → accountID (deterministic)             │
│ └─ Controls group membership (add/remove passkeys)      │
└─────────────────────────────────────────────────────────┘
                         ↓ Controls
┌─────────────────────────────────────────────────────────┐
│ Layer 3: Groups (User's Personal "Safe")                │
│ ├─ Each user has their own group                        │
│ ├─ Owns all CoValues (ruleset.type === "ownedByGroup") │
│ ├─ Group's Hypercore key (controls replication)         │
│ └─ Group's read key (encrypts transactions)            │
└─────────────────────────────────────────────────────────┘
                         ↓ Owns
┌─────────────────────────────────────────────────────────┐
│ Layer 2: CoValues (Owned by Groups)                    │
│ ├─ All CoValues owned by groups                         │
│ ├─ Group controls permissions                            │
│ └─ Group's read key encrypts transactions               │
└─────────────────────────────────────────────────────────┘
                         ↓ Sessions map to
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Hypercores/Sessions (Storage Layer)           │
│ ├─ Each session = one Hypercore                         │
│ ├─ Stores encrypted transaction bytes                  │
│ ├─ Ed25519 signatures (block integrity)                │
│ └─ Blake3 hashing (merkle tree)                        │
└─────────────────────────────────────────────────────────┘
```

**Key Points:**

1. **Passkeys = Ultimate Trust Root**
  - Hardware-backed (Secure Enclave/TPM)
  - Deterministic: Same passkey → same accountID
  - Controls group membership (can add/remove passkeys)
2. **Groups = Ownership Layer**
  - Each user has their own personal group (their "safe")
  - Owns all CoValues (`ruleset.type === "ownedByGroup"`)
  - Group's Hypercore key controls replication
  - Group's read key encrypts transactions
3. **Mapping: Group Ownership → Hypercore Sessions**
  - Groups own CoValues
  - CoValues' sessions map to Hypercores
  - Group membership controls access to Hypercores

**Key Insights:**

1. **No Cryptographic Conflicts:**
  - cojson's encryption (XSalsa20) is independent of Hypercore's signing (Ed25519)
  - Both use Blake3, but for different purposes (no conflict)
  - Hypercore stores bytes, cojson encrypts bytes → perfect fit
2. **Passkey Mapping Preserved:**
  - PRF → agentSecret → accountID chain is pure cojson logic
  - Works independently of Hypercore
  - Deterministic mapping preserved ✅
3. **Group Read Keys Preserved:**
  - Group read keys (KeySecret) encrypt transactions
  - Encrypted transactions stored in Hypercore blocks
  - Key rotation works as-is (stored in Group CoMap) ✅
4. **Security Model Intact:**
  - Hypercore provides: Block integrity (Ed25519), tamper-proof log
  - cojson provides: Transaction encryption (XSalsa20), access control
  - **Layered security:** Both layers work together ✅

### Verification Checklist

- ✅ **Ed25519 Signing:** Compatible (both use Ed25519)
- ✅ **Blake3 Hashing:** Compatible (both use Blake3)
- ✅ **Storage Format:** Compatible (Hypercore stores bytes, cojson encrypts bytes)
- ✅ **Passkey Mapping:** Preserved (independent of Hypercore)
- ✅ **Group Read Keys:** Preserved (encrypt transactions, stored in Hypercore)
- ✅ **Key Rotation:** Works (stored in Group CoMap, independent of Hypercore)
- ✅ **Security Model:** Intact (layered security, both layers work together)

## Key Insights Summary

1. **Trust Root Hierarchy:**
  - **Passkeys** = Ultimate trust root (hardware-backed, controls groups)
  - **Groups** = Ownership layer (user's personal "safe", owns CoValues)
  - **Hypercores/Sessions** = Storage layer (sessions map to Hypercores)
2. **Skip Autobase** - cojson's CRDT logic already coordinates sessions
3. **Group Ownership** - Groups own all CoValues (`ruleset.type === "ownedByGroup"`)
4. **Mapping: Group Ownership → Hypercore Sessions**
  - Groups own CoValues
  - CoValues' sessions map to Hypercores
  - Group membership controls access to Hypercores
5. **Session → Hypercore** - Each session = one Hypercore (1-to-1 mapping)
6. **StorageAPI Implementation** - Map all StorageAPI methods to Hyperbee/Corestore
7. **Server-Side Only** - No P2P, no Tauri, just persistence
8. **Cryptographic Compatibility** - ✅ Fully compatible (Ed25519, Blake3, byte storage)
9. **Passkey Mapping Preserved** - ✅ Deterministic PRF → agentSecret → accountID chain works independently
10. **Group Read Keys Preserved** - ✅ Encrypt transactions with XSalsa20, store encrypted bytes in Hypercore
