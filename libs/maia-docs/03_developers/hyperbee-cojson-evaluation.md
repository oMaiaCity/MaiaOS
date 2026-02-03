# Hyperbee as cojson Storage Backend: Deep Evaluation

**Last Updated**: 2026-02-03

This document evaluates **Hyperbee** (the key-value database from the Pear ecosystem) as a storage backend for MaiaOS sync servers, comparing it to SQLite.

---

## TL;DR - The Verdict

**Hyperbee is actually a surprisingly good match for cojson's storage needs!**

- Key-value API maps cleanly to cojson's StorageAPI
- Batch operations support atomic transactions
- Sparse downloading = only download data you need
- P2P replication = distributed sync server mesh
- Built on mature Hypercore infrastructure

**However:** SQLite is simpler for single-server scenarios. Hyperbee shines for distributed/P2P sync architectures.

---

## Part 1: Understanding the Abstraction Layers

### Pear Ecosystem Stack

```
Application Layer
    ↓
Hyperdrive (File System)    Hyperbee (Database)    Autobase (Multi-writer)
    ↓                            ↓                        ↓
Corestore (Hypercore Factory) ←────────────────────────────
    ↓
Hypercore (Append-Only Log)
    ↓
Hyperswarm (P2P Discovery + Replication)
```

**Key Insight:** Raw Hypercore is too low-level (append-only log), but **Hyperbee** provides a key-value database abstraction - exactly what cojson needs!

### Hyperbee: Key-Value Database on Hypercore

**What is Hyperbee?**
- Append-only B-tree database built on Hypercore
- Provides key-value store API
- Supports sorted iteration, range queries
- **Sparse downloading** - only downloads blocks needed for queries
- Atomic batch operations

**API Overview:**
```javascript
const bee = new Hyperbee(core, {
  keyEncoding: 'utf-8',
  valueEncoding: 'json'
})

// Basic operations
await bee.put('key', { some: 'data' })  // Store
const node = await bee.get('key')        // Retrieve
await bee.del('key')                     // Delete

// Batch operations (atomic)
const batch = bee.batch()
await batch.put('key1', value1)
await batch.put('key2', value2)
await batch.flush()  // Atomic commit

// Range queries (sorted iteration)
for await (const { key, value } of bee.createReadStream({ gte: 'a', lt: 'z' })) {
  console.log(key, value)
}
```

---

## Part 2: cojson Storage API Requirements

### What cojson Needs

**Core Storage Interface (StorageAPI):**
```typescript
interface StorageAPI {
  // Load CoValue by ID
  load(id: string, callback: (data: NewContentMessage) => void, done?: (found: boolean) => void): void
  
  // Store CoValue content
  store(data: NewContentMessage, handleCorrection: CorrectionCallback): void
  
  // Load only known state (metadata)
  loadKnownState(id: string, callback: (knownState: CoValueKnownState | undefined) => void): void
  
  // Get cached known state
  getKnownState(id: string): CoValueKnownState
  
  // Sync tracking
  trackCoValuesSyncState(updates: { id: RawCoID; peerId: PeerID; synced: boolean }[]): void
  getUnsyncedCoValueIDs(callback: (ids: RawCoID[]) => void): void
  stopTrackingSyncState(id: RawCoID): void
  
  // Wait for storage sync
  waitForSync(id: string, coValue: CoValueCore): Promise<void>
  
  // Deletion
  markDeleteAsValid(id: RawCoID): void
  eraseAllDeletedCoValues(): Promise<void>
  
  // Cleanup
  onCoValueUnmounted(id: RawCoID): void
  close(): Promise<unknown>
}
```

**Underlying Database Schema (SQLite):**
```sql
-- CoValues table
CREATE TABLE coValues (
  id TEXT PRIMARY KEY,
  header TEXT  -- JSON
);

-- Sessions table (one-to-many with coValues)
CREATE TABLE sessions (
  rowID INTEGER PRIMARY KEY,
  coValue INTEGER,  -- Foreign key to coValues.rowID
  sessionID TEXT,
  lastIdx INTEGER,
  lastSignature TEXT,
  FOREIGN KEY (coValue) REFERENCES coValues(rowID)
);

-- Transactions table (one-to-many with sessions)
CREATE TABLE transactions (
  ses INTEGER,  -- Foreign key to sessions.rowID
  idx INTEGER,
  tx TEXT,  -- JSON
  FOREIGN KEY (ses) REFERENCES sessions(rowID)
);

-- Signatures table
CREATE TABLE signatureAfter (
  ses INTEGER,
  idx INTEGER,
  signature TEXT,
  FOREIGN KEY (ses) REFERENCES sessions(rowID)
);

-- Sync state tracking
CREATE TABLE syncState (
  coValueId TEXT,
  peerId TEXT,
  synced INTEGER,
  PRIMARY KEY (coValueId, peerId)
);

-- Deleted CoValues queue
CREATE TABLE deletedCoValues (
  id TEXT PRIMARY KEY,
  status INTEGER  -- 0 = pending, 1 = done
);
```

**Key Operations:**
1. **Store CoValue**: Insert/update header, sessions, transactions, signatures
2. **Load CoValue**: Join tables to reconstruct full CoValue
3. **Load Known State**: Get header + session counters (no transactions)
4. **Sync Tracking**: Track which peers have synced which CoValues
5. **Deletion**: Mark as deleted, queue for erasure, preserve tombstone

---

## Part 3: Mapping Hyperbee to cojson Storage

### Approach 1: Flat Key-Value with Composite Keys

**Idea:** Use composite keys to store hierarchical data in Hyperbee's flat key-value structure.

**Key Structure:**
```
CoValue:
  ${coValueId}:header                    → CoValueHeader (JSON)
  ${coValueId}:meta                      → { created, updated } (metadata)

Sessions:
  ${coValueId}:session:${sessionId}      → SessionRow (JSON)

Transactions:
  ${coValueId}:tx:${sessionId}:${idx}    → Transaction (JSON)

Signatures:
  ${coValueId}:sig:${sessionId}:${idx}   → Signature

Sync State:
  sync:${coValueId}:${peerId}            → { synced: boolean }

Known States (cached):
  ${coValueId}:knownState                → CoValueKnownState (JSON)

Deleted Queue:
  deleted:${coValueId}                   → { status: 'pending' | 'done' }
```

**Implementation Example:**
```javascript
class HyperbeeStorage implements StorageAPI {
  constructor(bee) {
    this.bee = bee
    this.knownStates = new Map()  // In-memory cache
  }
  
  async load(id, callback, done) {
    // Load header
    const headerNode = await this.bee.get(`${id}:header`)
    if (!headerNode) {
      done?.(false)
      return
    }
    
    const header = headerNode.value
    
    // Load all sessions for this CoValue
    const sessions = []
    for await (const { key, value } of this.bee.createReadStream({
      gte: `${id}:session:`,
      lt: `${id}:session:\xFF`  // \xFF sorts after all UTF-8
    })) {
      sessions.push(value)
    }
    
    // Load transactions for each session
    const transactions = []
    for (const session of sessions) {
      for await (const { key, value } of this.bee.createReadStream({
        gte: `${id}:tx:${session.sessionID}:`,
        lt: `${id}:tx:${session.sessionID}:\xFF`
      })) {
        transactions.push(value)
      }
    }
    
    // Construct NewContentMessage
    callback({ id, header, sessions, transactions })
    done?.(true)
  }
  
  async store(data, handleCorrection) {
    const batch = this.bee.batch()
    
    // Store header
    if (data.header) {
      await batch.put(`${data.id}:header`, data.header)
    }
    
    // Store sessions
    for (const session of data.sessions || []) {
      await batch.put(`${data.id}:session:${session.sessionID}`, session)
    }
    
    // Store transactions
    for (const tx of data.transactions || []) {
      await batch.put(`${data.id}:tx:${tx.sessionID}:${tx.idx}`, tx)
    }
    
    // Atomic commit
    await batch.flush()
    
    // Update known state cache
    this.updateKnownState(data.id, data)
  }
  
  async loadKnownState(id, callback) {
    // Check cache first
    if (this.knownStates.has(id)) {
      callback(this.knownStates.get(id))
      return
    }
    
    // Load from storage
    const cachedNode = await this.bee.get(`${id}:knownState`)
    if (cachedNode) {
      this.knownStates.set(id, cachedNode.value)
      callback(cachedNode.value)
      return
    }
    
    // Compute from header + sessions
    const headerNode = await this.bee.get(`${id}:header`)
    if (!headerNode) {
      callback(undefined)
      return
    }
    
    const sessions = []
    for await (const { value } of this.bee.createReadStream({
      gte: `${id}:session:`,
      lt: `${id}:session:\xFF`
    })) {
      sessions.push(value)
    }
    
    const knownState = {
      header: !!headerNode,
      sessions: sessions.reduce((acc, s) => {
        acc[s.sessionID] = s.lastIdx
        return acc
      }, {})
    }
    
    // Cache for future use
    this.knownStates.set(id, knownState)
    await this.bee.put(`${id}:knownState`, knownState)
    
    callback(knownState)
  }
  
  async trackCoValuesSyncState(updates) {
    const batch = this.bee.batch()
    for (const { id, peerId, synced } of updates) {
      await batch.put(`sync:${id}:${peerId}`, { synced })
    }
    await batch.flush()
  }
  
  async getUnsyncedCoValueIDs(callback) {
    const unsyncedIds = new Set()
    
    for await (const { key, value } of this.bee.createReadStream({
      gte: 'sync:',
      lt: 'sync:\xFF'
    })) {
      if (!value.synced) {
        const [_, coValueId] = key.split(':')
        unsyncedIds.add(coValueId)
      }
    }
    
    callback(Array.from(unsyncedIds))
  }
}
```

### Pros of Hyperbee Approach

1. **Simple Key-Value Mapping**: cojson's storage needs map cleanly to Hyperbee's key-value API
2. **Atomic Operations**: Hyperbee's `batch()` provides atomic multi-put/delete
3. **Range Queries**: Can load all sessions/transactions for a CoValue efficiently
4. **Sorted Iteration**: Keys are sorted lexicographically (useful for range queries)
5. **Sparse Downloading**: Only downloads blocks needed for queries (huge win!)
6. **P2P Replication**: Multiple sync servers can share data via Hyperswarm
7. **Immutable History**: Append-only B-tree preserves history (good for auditing)

### Cons of Hyperbee Approach

1. **No Joins**: Can't do SQL-style joins - need multiple range queries
2. **No Foreign Keys**: Need to manually maintain referential integrity
3. **No Indexes**: Can't create secondary indexes - only primary key lookups
4. **Encoding Overhead**: JSON encoding/decoding on every read/write
5. **Complexity**: More complex than SQLite's relational model
6. **Maturity**: Less mature than SQLite for server-side storage

---

## Part 4: Comparison - SQLite vs Hyperbee

| Aspect | SQLite | Hyperbee |
|--------|--------|----------|
| **Data Model** | Relational (tables, joins) | Key-value (flat, sorted) |
| **Query Language** | SQL | Programmatic API |
| **Transactions** | Full ACID | Batch operations (atomic) |
| **Indexes** | Multiple indexes | Primary key only |
| **Storage** | Single file | Hypercore blocks |
| **Replication** | Manual (rsync, etc.) | Built-in (Hyperswarm) |
| **Sparse Loading** | No | Yes (only download needed blocks) |
| **Distributed** | No | Yes (P2P mesh) |
| **Maturity** | Very mature | Mature (used in production) |
| **Complexity** | Simple (SQL) | Moderate (key-value + composite keys) |
| **Performance** | Excellent (local) | Good (network + sparse) |
| **Use Case** | Single server | Distributed servers |

---

## Part 5: Use Cases for Each Approach

### Use SQLite When:

1. **Single Sync Server**: You have one centralized sync server
2. **Simplicity**: You want the simplest possible implementation
3. **SQL Expertise**: Your team knows SQL well
4. **Local Storage**: All data fits on one server
5. **No Distribution**: No need for P2P replication between servers
6. **Mature Tooling**: You want battle-tested tools (backups, monitoring, etc.)

**Example:**
- Single Fly.io instance serving all clients
- All CoValue data stored locally
- No need for server-to-server replication

### Use Hyperbee When:

1. **Distributed Sync**: You want multiple sync servers sharing data
2. **Sparse Storage**: Servers don't need all CoValues (sparse downloading)
3. **P2P Architecture**: Servers should discover and replicate via DHT
4. **Mesh Topology**: No single point of failure (distributed mesh)
5. **Selective Replication**: Only replicate CoValues you need
6. **Immutable History**: Want append-only audit trail

**Example:**
- Multiple sync servers in different regions
- Each server only stores CoValues for local users
- Servers replicate via Hyperswarm (P2P)
- Sparse downloading = don't need all data locally
- Mesh topology = no single point of failure

---

## Part 6: The Killer Feature - Sparse Downloading

### What is Sparse Downloading?

**Traditional database sync:**
```
Server A                          Server B
  ↓                                  ↓
Full DB (100GB)   →  Replicate  →  Full DB (100GB)
```

Every server needs a complete copy of the entire database.

**Hyperbee sparse downloading:**
```
Server A                          Server B
  ↓                                  ↓
Full Hyperbee    →  Replicate  →  Partial Hyperbee (only needed data)
(100GB)                            (5GB - just what B needs)
```

Server B only downloads blocks for queries it actually makes!

### How It Works

**Hyperbee is a B-tree stored in Hypercore blocks:**
```
Hypercore Block 0: Root node
Hypercore Block 1: Left branch node
Hypercore Block 2: Right branch node
Hypercore Block 3: Leaf node (keys a-m)
Hypercore Block 4: Leaf node (keys n-z)
...
```

**When you query:**
```javascript
await bee.get('hello')  // Only downloads: Root → Branch → Leaf containing 'hello'
```

Hyperbee only downloads the blocks needed to traverse the B-tree to 'hello'. It doesn't download the entire database!

### Why This Matters for Sync Servers

**Scenario: Multi-Region Sync**

```
MaiaOS User A (US)  →  US Sync Server (Hyperbee)
                             ↓ (sparse replication)
                       EU Sync Server (Hyperbee)
                             ↓
MaiaOS User B (EU)
```

- US server has User A's CoValues
- EU server has User B's CoValues
- EU server can query US server for User A's data **without downloading all of US server's data**
- Only the specific CoValues needed are downloaded (sparse!)

**This enables:**
1. **Distributed storage** - Servers don't need all data
2. **Regional optimization** - Servers store local users' data primarily
3. **On-demand replication** - Only replicate what's needed
4. **Scalability** - Add more servers without each storing everything

---

## Part 7: Hybrid Approach - Best of Both Worlds?

### Idea: SQLite + Hyperbee Sync Layer

**Architecture:**
```
┌────────────────────────────────────────┐
│  Sync Server A                         │
│                                        │
│  ┌──────────────┐     ┌─────────────┐ │
│  │  SQLite DB   │ ←→  │  Hyperbee   │ │
│  │  (local)     │     │  (P2P sync) │ │
│  └──────────────┘     └─────────────┘ │
│                            ↕            │
└────────────────────────────────────────┘
                             ↕
┌────────────────────────────────────────┐
│  Sync Server B                         │
│                                        │
│  ┌──────────────┐     ┌─────────────┐ │
│  │  SQLite DB   │ ←→  │  Hyperbee   │ │
│  │  (local)     │     │  (P2P sync) │ │
│  └──────────────┘     └─────────────┘ │
└────────────────────────────────────────┘
```

**How It Works:**
1. **Local storage**: Each server uses SQLite for local CoValue storage (simple, fast)
2. **P2P sync**: Servers replicate via Hyperbee (distributed, sparse)
3. **Sync layer**: When a CoValue is stored in SQLite, it's also put into Hyperbee
4. **Query layer**: Queries check SQLite first, then fallback to Hyperbee if not local

**Benefits:**
- Simple local storage (SQLite)
- Distributed replication (Hyperbee)
- Sparse downloading (only replicate what you need)
- Best of both worlds!

**Tradeoffs:**
- More complexity (two storage layers)
- Need sync logic between SQLite ↔ Hyperbee
- Storage overhead (data stored twice)

---

## Part 8: Recommended Approach

### Phase 1: Start with SQLite (Simplest)

**For initial deployment:**
- Use Bun's native SQLite for sync server storage
- Single server, centralized architecture
- Simple, battle-tested, well-understood
- Get to production fast

**Implementation:**
- Implement cojson's StorageAPI using SQLite (as planned)
- Deploy to Fly.io or similar
- All clients connect to single sync server

### Phase 2: Add Hyperbee for Distribution (If Needed)

**When you need:**
- Multiple sync servers in different regions
- Distributed storage (not all servers have all data)
- P2P mesh topology (no single point of failure)

**Implementation:**
- Add Hyperbee as secondary storage layer
- SQLite for local queries (fast)
- Hyperbee for distributed replication (sparse)
- Sync layer between SQLite ↔ Hyperbee

### Phase 3: Pure Hyperbee (Advanced)

**When you're ready:**
- Replace SQLite entirely with Hyperbee
- Pure P2P architecture
- No central server needed
- Maximum distribution and resilience

**This is the endgame for truly decentralized MaiaOS!**

---

## Part 9: Implementation Roadmap

### Option A: SQLite First (Recommended for MVP)

**Step 1: SQLite Storage Adapter**
- Implement cojson's StorageAPI using Bun's SQLite
- Follow cojson's existing SQLite implementation patterns
- Deploy single sync server

**Step 2: Production Testing**
- Test with real users
- Monitor performance, storage usage
- Identify bottlenecks

**Step 3: Evaluate Distribution Needs**
- Do you need multiple regions?
- Do you need distributed storage?
- If yes, proceed to Option B

### Option B: Hyperbee Storage Adapter (Experimental)

**Step 1: Proof of Concept**
- Implement basic StorageAPI with Hyperbee
- Test load/store/loadKnownState operations
- Validate composite key approach

**Step 2: Full Implementation**
- Implement all StorageAPI methods
- Add sync state tracking
- Add deletion queue
- Test with real CoValue data

**Step 3: Distributed Testing**
- Deploy multiple sync servers
- Test P2P replication via Hyperswarm
- Validate sparse downloading
- Measure performance vs SQLite

**Step 4: Production Deployment**
- Roll out gradually
- Monitor for issues
- Compare to SQLite baseline

### Option C: Hybrid SQLite + Hyperbee (Future)

**Step 1: SQLite as Primary**
- Use SQLite for local storage
- All queries hit SQLite first

**Step 2: Hyperbee as Sync Layer**
- Add Hyperbee for server-to-server replication
- Sync CoValues from SQLite → Hyperbee
- Replicate via Hyperswarm

**Step 3: Fallback to P2P**
- If CoValue not in local SQLite, query Hyperbee
- Sparse download from other servers
- Cache in local SQLite

---

## Summary

### Key Insights

1. **Hyperbee is a surprisingly good match** for cojson's StorageAPI
   - Key-value API maps cleanly
   - Batch operations for transactions
   - Range queries for loading sessions/transactions

2. **Sparse downloading is the killer feature**
   - Only download data you need
   - Perfect for distributed sync servers
   - Enables mesh topology without full replication

3. **SQLite is simpler for single-server scenarios**
   - Battle-tested, mature tooling
   - SQL is well-understood
   - Perfect for MVP

4. **Hyperbee shines for distributed architectures**
   - P2P replication via Hyperswarm
   - No single point of failure
   - Regional optimization

### Recommended Path

**Phase 1 (Now):** SQLite storage adapter
- Simplest path to production
- Single sync server
- Get users on board

**Phase 2 (Later):** Evaluate Hyperbee
- If distribution is needed
- Build proof of concept
- Test in production

**Phase 3 (Future):** Hybrid or pure Hyperbee
- Multiple regions
- Distributed mesh
- True P2P architecture

### The Answer

**Can Hyperbee work as cojson storage?** Yes! It's actually a great fit.

**Should you use it now?** Probably not - start with SQLite for simplicity.

**Should you explore it later?** Absolutely - it enables powerful distributed architectures that SQLite can't match.

---

**Bottom Line:** Hyperbee isn't just a drop-in replacement for SQLite - it's a fundamentally different architecture that enables distributed, sparse, P2P sync server meshes. Start with SQLite, but keep Hyperbee in mind for future scaling.
