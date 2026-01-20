# CoJSON History & Time Travel API

**Understanding CRDT history, time travel, and operation logs**

Last updated: 2026-01-20

---

## Overview

Every CoValue in cojson automatically stores its **complete history** - every change ever made, by anyone, forever. This isn't an add-on feature - it's fundamental to how CRDTs work.

Think of it like Git, but built into the data structure itself:
- Every change creates a **transaction** (like a Git commit)
- You can **time travel** to see what the data looked like at any point in the past
- History is **immutable** - nobody can rewrite it
- Everything **syncs automatically** across all users

### Three Ways to Access History

1. **Time Travel API**: `coValue.atTime(timestamp)` - Jump to any moment in time
2. **Operation Logs**: `coValue.ops[key]` - See every change to a specific field
3. **Transaction Metadata**: `txID`, `madeAt`, timestamps - Reference specific states

This guide explains how it all works and how to use it for building runtime migration systems.

---

## Transaction-Based History Architecture

### How Changes Become History

```
User Action: profile.set("name", "Alice")
      ↓
┌─────────────────────────────────────────────┐
│ STEP 1: Create Transaction                  │
├─────────────────────────────────────────────┤
│ {                                           │
│   txID: "session_123_tx_5",                 │
│   madeAt: 1705766400000,  // timestamp      │
│   changes: [                                │
│     { op: "set", key: "name", value: "Alice" }│
│   ]                                         │
│ }                                           │
└─────────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────────┐
│ STEP 2: Store in SessionMap                 │
├─────────────────────────────────────────────┤
│ sessions:                                   │
│   session_123: [tx_1, tx_2, ..., tx_5]     │
│   session_456: [tx_1, tx_2, ...]           │
└─────────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────────┐
│ STEP 3: Add to Operation Log (per key)     │
├─────────────────────────────────────────────┤
│ ops: {                                      │
│   "name": [                                 │
│     { txID: "...", madeAt: 1705766300000,   │
│       change: {op: "set", value: "Bob"} },  │
│     { txID: "...", madeAt: 1705766400000,   │
│       change: {op: "set", value: "Alice"} } │
│   ]                                         │
│ }                                           │
└─────────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────────┐
│ STEP 4: Update Latest Cache                │
├─────────────────────────────────────────────┤
│ latest: {                                   │
│   "name": { txID: "...", madeAt: ...,       │
│             change: {op: "set", value: "Alice"}}│
│ }                                           │
└─────────────────────────────────────────────┘
```

### Core Data Structures

Every `RawCoMap` stores history in two properties:

```javascript
// From coMap.ts (lines 58-63)
class RawCoMap {
  // ALL operations ever made (full history)
  ops: {
    [key: string]: MapOp[]  // Array of ALL operations for this key
  }
  
  // Cache of current state (performance optimization)
  latest: {
    [key: string]: MapOp    // Just the latest operation per key
  }
}
```

### MapOp Structure

Each operation stores everything needed to reconstruct history:

```javascript
type MapOp = {
  txID: TransactionID;      // Unique transaction identifier
  madeAt: number;           // Unix timestamp (milliseconds)
  changeIdx: number;        // Index within the transaction
  change: MapOpPayload;     // The actual operation
  trusting?: boolean;       // Privacy level
};

type MapOpPayload = 
  | { op: "set", key: string, value: JsonValue }
  | { op: "del", key: string };
```

### The Two-State System

```
┌──────────────────────────────────────────────────────┐
│ ops: COMPLETE HISTORY (all operations)               │
├──────────────────────────────────────────────────────┤
│ "name": [                                            │
│   {madeAt: 100, change: {op: "set", value: "Bob"}},  │
│   {madeAt: 200, change: {op: "set", value: "Alice"}},│
│   {madeAt: 300, change: {op: "set", value: "Charlie"}}│
│ ]                                                    │
└──────────────────────────────────────────────────────┘
                    ↓ (filter by time or get last)
┌──────────────────────────────────────────────────────┐
│ latest: CURRENT STATE (cached for performance)       │
├──────────────────────────────────────────────────────┤
│ "name": {madeAt: 300, change: {op: "set", value: "Charlie"}}│
└──────────────────────────────────────────────────────┘
```

**Key Insight**: `latest` is just a cache. The source of truth is always `ops[]`.

---

## The Time Travel API: `atTime()`

### Basic Usage

```javascript
const profile = group.get("myProfile");  // Current version

// Go back 30 days
const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
const oldProfile = profile.atTime(thirtyDaysAgo);

console.log(profile.get("name"));      // "Charlie" (current)
console.log(oldProfile.get("name"));   // "Alice" (30 days ago)

// Original is unchanged
console.log(profile.get("name"));      // Still "Charlie"
```

### How It Works (Implementation Details)

```javascript
// From coMap.ts (lines 185-192)
atTime(time: number): this {
  const clone = Object.create(this);  // Prototype-based clone
  
  clone.atTimeFilter = time;          // Set the filter
  clone.latest = {};                  // Reset cache (lazy evaluation)
  
  return clone;
}
```

### Three Key Features

#### 1. Non-Destructive (Original Unchanged)

```javascript
const profile = group.get("myProfile");
const jan1 = profile.atTime(new Date("2026-01-01").getTime());
const dec1 = profile.atTime(new Date("2025-12-01").getTime());

// Three independent views of the same CoValue
console.log(profile.get("status"));  // Current: "active"
console.log(jan1.get("status"));     // Jan 1: "pending"
console.log(dec1.get("status"));     // Dec 1: "inactive"
```

#### 2. Lazy Evaluation (Filters on Access)

```javascript
// Creating the time-travel view is instant (just sets a flag)
const oldView = profile.atTime(timestamp);  // ⚡ Instant!

// Filtering happens when you access data
const name = oldView.get("name");           // 🔍 Filter ops here
const keys = oldView.keys();                // 🔍 Filter ops here
```

#### 3. Prototype-Based Cloning (Memory Efficient)

```javascript
// Uses Object.create() - shares the same ops[] array
const original = profile;
const timeTravel = profile.atTime(timestamp);

original.ops === timeTravel.ops  // true! (same reference)

// Only atTimeFilter and latest are different
timeTravel.atTimeFilter  // timestamp
original.atTimeFilter    // undefined
```

### Time-Filtered Operations

When you access a key on a time-travel view, cojson filters the operations:

```javascript
// From coMap.ts (lines 195-209)
timeFilteredOps(key): MapOp[] | undefined {
  const atTimeFilter = this.atTimeFilter;
  
  if (atTimeFilter) {
    // Filter operations to only those before/at timestamp
    return this.ops[key]?.filter((op) => op.madeAt <= atTimeFilter);
  } else {
    return this.ops[key];  // All operations (current view)
  }
}

// Getting the value at that time (lines 231-256)
getRaw(key) {
  const entries = this.ops[key];
  
  if (this.atTimeFilter) {
    // Find last operation before/at timestamp
    return entries.findLast((op) => op.madeAt <= this.atTimeFilter);
  } else {
    return entries[entries.length - 1];  // Current latest
  }
}
```

### All Methods Work with Time Travel

```javascript
const historicalView = profile.atTime(timestamp);

// Read operations all work
historicalView.get("name")           // Value at that time
historicalView.keys()                // Keys that existed then
historicalView.toJSON()              // Full state at that time
historicalView.asObject()            // Object representation

// You CANNOT write to time-travel views
historicalView.set("name", "X")      // ❌ Error!
// "Cannot process transactions on a time travel entity"
```

---

## Accessing Operation History Directly

### Method 1: Direct `ops` Access (Per-Key History)

Get the complete history of changes to a specific field:

```javascript
const profile = group.get("myProfile");

// Get all operations for "name" field
const nameHistory = profile.ops["name"];

// Iterate through all changes ever made
nameHistory.forEach(op => {
  console.log({
    timestamp: new Date(op.madeAt).toISOString(),
    operation: op.change.op,         // "set" or "del"
    value: op.change.value,          // The value (for "set")
    txID: op.txID                    // Transaction ID
  });
});

// Output:
// { timestamp: "2025-12-01T10:00:00.000Z", operation: "set", value: "Bob" }
// { timestamp: "2026-01-15T14:30:00.000Z", operation: "set", value: "Alice" }
// { timestamp: "2026-01-20T09:15:00.000Z", operation: "set", value: "Charlie" }
```

### Method 2: Transaction Timestamps (Creation & Latest)

Every CoValue tracks when it was created and last modified:

```javascript
// From coMap.ts (lines 48-55)
const profile = group.get("myProfile");

// When was this CoValue first created?
const createdAt = profile.core.earliestTxMadeAt;
console.log(new Date(createdAt).toISOString());
// "2025-12-01T10:00:00.000Z"

// When was the last change made?
const lastModified = profile.core.latestTxMadeAt;
console.log(new Date(lastModified).toISOString());
// "2026-01-20T09:15:00.000Z"

// How old is this CoValue?
const ageInDays = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
console.log(`This profile is ${ageInDays.toFixed(0)} days old`);
```

### Method 3: Transaction IDs (Reference Specific States)

Every operation has a unique transaction ID:

```javascript
const profile = group.get("myProfile");
const operation = profile.getRaw("name");

console.log({
  txID: operation.txID,           // Full transaction identifier
  timestamp: operation.madeAt,    // Unix timestamp
  value: operation.change.value   // The actual value
});

// Example output:
// {
//   txID: {
//     sessionID: "co_z123...account_session_z456",
//     txIndex: 42
//   },
//   timestamp: 1705766400000,
//   value: "Charlie"
// }
```

### Finding When a Value Was Set

```javascript
function findWhenValueWasSet(coValue, key, targetValue) {
  const history = coValue.ops[key];
  
  if (!history) return null;
  
  // Find the operation that set this value
  const op = history.find(op => 
    op.change.op === "set" && 
    op.change.value === targetValue
  );
  
  return op ? new Date(op.madeAt) : null;
}

// Usage
const whenAliceWasSet = findWhenValueWasSet(profile, "name", "Alice");
console.log(`Name was changed to "Alice" on ${whenAliceWasSet.toISOString()}`);
```

---

## Transaction IDs and References

### TransactionID Structure

```javascript
type TransactionID = {
  sessionID: SessionID;        // Which session created it
  txIndex: number;             // Index within that session
  branch?: RawCoID;            // Optional: if in a branch
}
```

### SessionID Format

```
Format: co_z{accountID}_session_z{random}

Example:
  co_zAUKYP4hf6SpfXLaDq1hPDDAcKh_session_zBpQr8sTkLmNxYz3
  ↑                              ↑
  Account ID                     Session ID (random)
```

### Session-Based Organization

Multiple users = Multiple sessions:

```
Account A creates session_1:
  tx_1: {madeAt: 100, changes: [{op: "set", key: "name", value: "Alice"}]}
  tx_2: {madeAt: 200, changes: [{op: "set", key: "age", value: 25}]}

Account B creates session_2:
  tx_1: {madeAt: 150, changes: [{op: "set", key: "name", value: "Bob"}]}
  tx_2: {madeAt: 250, changes: [{op: "set", key: "age", value: 30}]}

CRDT merge result (sorted by madeAt):
  100: name = "Alice" (session_1)
  150: name = "Bob"   (session_2) ← wins (later timestamp)
  200: age = 25       (session_1)
  250: age = 30       (session_2) ← wins (later timestamp)

Final state: {name: "Bob", age: 30}
```

### Immutability Guarantees

```javascript
// Transactions are IMMUTABLE once created
const op = profile.ops["name"][0];

op.madeAt = Date.now();        // ⚠️ Don't do this! (but won't break CRDT)
op.change.value = "Hacked!";   // ⚠️ Don't do this! (but won't break CRDT)

// Why? Because they're already committed to the CRDT log
// Modifying them doesn't change history - just your local reference

// The SAFE way to reference a transaction
const txID = op.txID;
const timestamp = op.madeAt;
const value = op.change.value;

// Store these if you need to reference this state later
```

---

## Time Travel for All CoValue Types

Different CoValue types store history differently:

| Type | History Storage | Operations Tracked | Time Travel Support |
|------|----------------|-------------------|-------------------|
| **CoMap** | Per-key operation arrays | `set(key, value)`, `delete(key)` | ✅ Full |
| **CoList** | Per-item operation arrays | `insert(idx, val)`, `delete(idx)`, `move(from, to)` | ✅ Full |
| **CoStream** | Session-based append logs | `push(item)` (append-only) | ✅ Full (naturally historical) |
| **CoPlainText** | Character-level CRDT | `insert(pos, char)`, `delete(pos)` | ✅ Full |

### CoMap Time Travel (Key-Value History)

```javascript
const profile = group.createMap({name: "Alice"});

// Later...
profile.set("name", "Bob", "trusting");
profile.set("age", 25, "trusting");

// Time travel
const before = profile.atTime(beforeTimestamp);
console.log(before.get("name"));  // "Alice"
console.log(before.get("age"));   // undefined (didn't exist yet)
```

### CoList Time Travel (Ordered Items)

```javascript
const todos = group.createList([{task: "Buy milk"}]);

todos.append({task: "Walk dog"}, "trusting");
todos.append({task: "Code"}, "trusting");

// Time travel
const before = todos.atTime(beforeTimestamp);
console.log(before.length);    // 1
console.log(before[0].task);   // "Buy milk"
```

### CoStream Time Travel (Append-Only Log)

```javascript
const activityLog = group.createStream();

activityLog.push({action: "login"}, "trusting");
activityLog.push({action: "edit"}, "trusting");

// CoStreams are NATURALLY historical (append-only)
// Time travel just filters by timestamp
const before = activityLog.atTime(beforeTimestamp);
console.log(before.toJSON());  // Only events before timestamp
```

### CoPlainText Time Travel (Text Editing)

```javascript
const doc = group.createPlainText("Hello");

doc.append(" world", "trusting");
doc.append("!", "trusting");

// Time travel
const before = doc.atTime(beforeTimestamp);
console.log(before.toString());  // "Hello" (before edits)
```

---

## Use Cases for Runtime Migrations

The history system enables powerful migration scenarios:

### Use Case 1: Detecting Schema Version at Creation

```javascript
/**
 * Check if a CoValue needs migration based on when it was created
 */
function needsMigration(coValue, schemaRegistry) {
  // Get schema reference from headerMeta
  const { $schema } = coValue.headerMeta;
  
  // Load current schema definition
  const schemaCoMap = schemaRegistry.get($schema);
  const currentVersion = schemaCoMap.get("version");
  
  // When was this CoValue created?
  const createdAt = coValue.core.earliestTxMadeAt;
  
  // What version was the schema at that time?
  const schemaAtCreation = schemaCoMap.atTime(createdAt);
  const versionAtCreation = schemaAtCreation.get("version");
  
  // Migration needed if created with older version
  return versionAtCreation < currentVersion;
}

// Usage
const profile = node.getCoValue("co_z...");
if (needsMigration(profile, schemaRegistry)) {
  console.log("⚠️ This profile needs migration!");
  applyMigration(profile);
}
```

### Use Case 2: Querying Schema History

```javascript
/**
 * See how a schema evolved over time
 */
function getSchemaTimeline(schemaCoMap) {
  const versionHistory = schemaCoMap.ops["version"];
  
  return versionHistory.map(op => ({
    version: op.change.value,
    date: new Date(op.madeAt).toISOString(),
    txID: op.txID
  }));
}

// Usage
const timeline = getSchemaTimeline(profileSchema);
console.log(timeline);

// Output:
// [
//   { version: 1, date: "2025-12-01T10:00:00Z", txID: {...} },
//   { version: 2, date: "2026-01-01T14:00:00Z", txID: {...} },
//   { version: 3, date: "2026-01-15T09:00:00Z", txID: {...} }
// ]
```

### Use Case 3: Time-Range Migration Queries

```javascript
/**
 * Find which migrations were applied between two versions
 */
function getMigrationsBetweenVersions(schemaCoMap, fromVersion, toVersion) {
  const versionOps = schemaCoMap.ops["version"];
  
  // Find timestamps for each version
  const fromTime = versionOps
    .find(op => op.change.value === fromVersion)?.madeAt;
  const toTime = versionOps
    .find(op => op.change.value === toVersion)?.madeAt;
  
  if (!fromTime || !toTime) return [];
  
  // Get all version changes in this range
  return versionOps
    .filter(op => op.madeAt >= fromTime && op.madeAt <= toTime)
    .map(op => ({
      version: op.change.value,
      timestamp: op.madeAt,
      date: new Date(op.madeAt).toISOString()
    }));
}

// Usage
const migrations = getMigrationsBetweenVersions(profileSchema, 1, 3);
console.log(`Need to apply ${migrations.length} migrations`);
```

### Use Case 4: Storing Schemas as CoValues

```javascript
/**
 * Schemas are themselves CoValues with full history!
 */

// Create a schema (stored as CoMap)
const profileSchema = group.createMap({
  name: "ProfileSchema",
  version: 1,
  definition: {
    type: "object",
    properties: {
      name: { type: "string" }
    }
  }
}, { $schema: "MetaSchema" });

// Later: Upgrade the schema
profileSchema.set("version", 2, "trusting");
profileSchema.set("definition", {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "number" }  // ← Added field
  }
}, "trusting");

// Even later: Query schema history
const schemaHistory = profileSchema.ops["definition"];
console.log(`Schema has ${schemaHistory.length} versions`);

// Time travel to see old schema
const v1Timestamp = schemaHistory[0].madeAt;
const schemaV1 = profileSchema.atTime(v1Timestamp);
console.log(schemaV1.get("definition"));
// { type: "object", properties: { name: { type: "string" } } }
```

### Use Case 5: Migration Audit Trail

```javascript
/**
 * Track migration execution as CoStream events
 */

// Create migration log (append-only)
const migrationLog = group.createStream({ $schema: "MigrationLogSchema" });

// Apply migration and log it
async function applyMigration(coValue, fromVersion, toVersion, migrationFn) {
  const startTime = Date.now();
  
  try {
    await migrationFn(coValue);
    
    // Log success
    migrationLog.push({
      coValueId: coValue.id,
      fromVersion,
      toVersion,
      status: "success",
      timestamp: startTime,
      duration: Date.now() - startTime
    }, "trusting");
    
  } catch (error) {
    // Log failure
    migrationLog.push({
      coValueId: coValue.id,
      fromVersion,
      toVersion,
      status: "failed",
      error: error.message,
      timestamp: startTime
    }, "trusting");
  }
}

// Query migrations applied today
const todayStart = new Date().setHours(0, 0, 0, 0);
const todayMigrations = migrationLog.atTime(Date.now());
const events = todayMigrations.toJSON();

const todayOnly = Object.values(events)
  .flat()
  .filter(e => e.timestamp >= todayStart);

console.log(`${todayOnly.length} migrations applied today`);
```

---

## Key Insights & Limitations

### Advantages ✅

1. **Full History Preserved Forever**
   - Every change is stored permanently
   - No data loss (unless explicitly pruned)
   - Complete audit trail built-in

2. **Time Travel is "Free"**
   - No extra storage required (history is the storage)
   - Just filters existing data
   - Memory efficient (prototype-based cloning)

3. **Collaborative by Default**
   - Multiple users' changes merge automatically
   - Conflict resolution handled by CRDT
   - No merge conflicts to resolve manually

4. **Immutable Audit Trail**
   - Historical states can't be changed
   - True tamper-proof log
   - Perfect for compliance & debugging

5. **Works Across All CoValue Types**
   - CoMap, CoList, CoStream, CoPlainText all support time travel
   - Consistent API across types
   - Learn once, use everywhere

### Limitations ⚠️

1. **Timestamp-Based (Not Semantic Versions)**
   - Use Unix timestamps, not "v1.0.0" style versions
   - Must track version-to-timestamp mapping yourself
   - No built-in version tags

2. **Memory Grows Indefinitely**
   - History accumulates forever
   - Need pruning strategy for long-lived CoValues
   - No automatic garbage collection

3. **Can't Label Specific States Directly**
   - Can't "tag" a specific state as "v2.0"
   - Must use timestamps or transaction IDs
   - Workaround: Store version metadata separately

4. **Time Travel is Read-Only**
   - Can't modify historical views
   - Can't "fork" from a historical state directly
   - Must create new CoValue if you want to branch

5. **No Built-in Pruning**
   - Old transactions remain forever
   - Must implement custom pruning if needed
   - Careful: Pruning can break time travel to pruned times

### Perfect For ✅

- **Runtime Migration Systems**: Detect schema version at creation time
- **Audit Trails**: See who changed what and when
- **Debugging**: Reproduce bugs by replaying history
- **Rollback Detection**: Find when a value was changed
- **Version Control**: Git-like history for data

### Not Ideal For ⚠️

- **Ephemeral Data**: If you don't need history, CoValues add overhead
- **Large Binary Data**: History of large files = lots of storage
- **Real-Time Performance**: Time travel adds filtering overhead
- **Memory-Constrained Devices**: Unlimited history = unlimited memory

---

## Practical Examples

### Example 1: "Git-like" History Browsing

```javascript
/**
 * Browse the complete history of a field, like `git log`
 */
function showFieldHistory(coValue, key) {
  const history = coValue.ops[key];
  
  if (!history || history.length === 0) {
    console.log(`No history for field "${key}"`);
    return;
  }
  
  console.log(`\n📜 History for "${key}" (${history.length} changes):\n`);
  
  history.forEach((op, idx) => {
    const date = new Date(op.madeAt);
    const isLatest = idx === history.length - 1;
    
    console.log([
      isLatest ? "→" : " ",
      date.toISOString(),
      op.change.op === "set" 
        ? `SET: ${JSON.stringify(op.change.value)}`
        : `DELETE`,
      `(tx: ${op.txID.txIndex})`
    ].join(" "));
  });
}

// Usage
const profile = group.get("myProfile");
showFieldHistory(profile, "name");

// Output:
// 📜 History for "name" (3 changes):
//
//   2025-12-01T10:00:00.000Z SET: "Bob" (tx: 1)
//   2026-01-15T14:30:00.000Z SET: "Alice" (tx: 5)
// → 2026-01-20T09:15:00.000Z SET: "Charlie" (tx: 12)
```

### Example 2: Rollback Detection

```javascript
/**
 * Find when a specific value was set (rollback detection)
 */
function findValueChange(coValue, key, targetValue) {
  const history = coValue.ops[key];
  
  if (!history) return null;
  
  // Find when this value was set
  const matchingOps = history.filter(op => 
    op.change.op === "set" && 
    op.change.value === targetValue
  );
  
  if (matchingOps.length === 0) {
    return { found: false };
  }
  
  // Get first and last time this value was set
  const first = matchingOps[0];
  const last = matchingOps[matchingOps.length - 1];
  const current = coValue.get(key);
  
  return {
    found: true,
    firstSet: new Date(first.madeAt),
    lastSet: new Date(last.madeAt),
    timesSet: matchingOps.length,
    isCurrent: current === targetValue
  };
}

// Usage
const result = findValueChange(profile, "status", "archived");

if (result.found) {
  console.log(`Status was "archived":`);
  console.log(`  First set: ${result.firstSet.toISOString()}`);
  console.log(`  Last set: ${result.lastSet.toISOString()}`);
  console.log(`  Times set: ${result.timesSet}`);
  console.log(`  Currently archived: ${result.isCurrent}`);
}

// Output:
// Status was "archived":
//   First set: 2025-11-20T08:00:00.000Z
//   Last set: 2026-01-18T16:30:00.000Z
//   Times set: 3
//   Currently archived: false
```

### Example 3: Migration Timeline

```javascript
/**
 * Show all schema versions over time
 */
function showMigrationTimeline(schemaCoMap) {
  const versionHistory = schemaCoMap.ops["version"];
  const definitionHistory = schemaCoMap.ops["definition"];
  
  if (!versionHistory) {
    console.log("No version history found");
    return;
  }
  
  console.log("\n🔄 Schema Migration Timeline:\n");
  
  versionHistory.forEach((versionOp, idx) => {
    const version = versionOp.change.value;
    const date = new Date(versionOp.madeAt);
    
    // Find corresponding definition at this time
    const schemaAtTime = schemaCoMap.atTime(versionOp.madeAt);
    const definition = schemaAtTime.get("definition");
    const fields = Object.keys(definition.properties || {});
    
    // Check if this is the current version
    const isCurrent = idx === versionHistory.length - 1;
    
    console.log([
      isCurrent ? "→" : " ",
      `v${version}`,
      date.toISOString().split('T')[0],
      `(${fields.length} fields:`,
      fields.join(", ") + ")"
    ].join(" "));
  });
  
  console.log();
}

// Usage
const profileSchema = schemaRegistry.get("ProfileSchema");
showMigrationTimeline(profileSchema);

// Output:
// 🔄 Schema Migration Timeline:
//
//   v1 2025-12-01 (2 fields: name, email)
//   v2 2026-01-01 (3 fields: name, email, age)
// → v3 2026-01-15 (4 fields: name, email, age, avatar)
```

### Example 4: Advanced - Compare States Across Time

```javascript
/**
 * Compare a CoValue's state at two different points in time
 */
function compareStates(coValue, timestamp1, timestamp2) {
  const state1 = coValue.atTime(timestamp1).toJSON();
  const state2 = coValue.atTime(timestamp2).toJSON();
  
  const allKeys = new Set([...Object.keys(state1), ...Object.keys(state2)]);
  
  const changes = [];
  
  for (const key of allKeys) {
    const val1 = state1[key];
    const val2 = state2[key];
    
    if (val1 === undefined && val2 !== undefined) {
      changes.push({ key, type: "added", value: val2 });
    } else if (val1 !== undefined && val2 === undefined) {
      changes.push({ key, type: "removed", value: val1 });
    } else if (val1 !== val2) {
      changes.push({ key, type: "modified", from: val1, to: val2 });
    }
  }
  
  return changes;
}

// Usage
const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
const now = Date.now();

const changes = compareStates(profile, oneWeekAgo, now);

console.log(`\n📊 Changes in the last week:\n`);
changes.forEach(change => {
  switch (change.type) {
    case "added":
      console.log(`  + ${change.key}: ${JSON.stringify(change.value)}`);
      break;
    case "removed":
      console.log(`  - ${change.key}: ${JSON.stringify(change.value)}`);
      break;
    case "modified":
      console.log(`  ~ ${change.key}: ${JSON.stringify(change.from)} → ${JSON.stringify(change.to)}`);
      break;
  }
});

// Output:
// 📊 Changes in the last week:
//
//   ~ name: "Alice" → "Charlie"
//   + age: 30
//   - oldField: "deprecated"
```

---

## References

### CoJSON Source Files

- **[`coMap.ts`](../../../libs/maia-db/node_modules/cojson/src/coValues/coMap.ts)**: Core `RawCoMap` implementation with `atTime()`, `ops[]`, and `latest`
- **[`coValueCore.ts`](../../../libs/maia-db/node_modules/cojson/src/coValueCore/coValueCore.ts)**: CRDT engine with transaction processing
- **[`SessionMap.ts`](../../../libs/maia-db/node_modules/cojson/src/coValueCore/SessionMap.ts)**: Session-based transaction storage
- **[`verifiedState.ts`](../../../libs/maia-db/node_modules/cojson/src/coValueCore/verifiedState.ts)**: Header and transaction validation
- **[`coValue.ts`](../../../libs/maia-db/node_modules/cojson/src/coValue.ts)**: `RawCoValue` interface with time travel API

### Related MaiaOS Documentation

- **[`cojson.md`](./cojson.md)**: Complete cojson architecture layers (Layer 0-8)
- **[`cojson-migrations.md`](./cojson-migrations.md)**: Migration system architecture
- **[`cojson-schema-hierarchy.md`](./cojson-schema-hierarchy.md)**: Schema type hierarchy
- **[`migration-quick-reference.md`](./migration-quick-reference.md)**: Practical migration guide

### MaiaOS Integration Points

- **[`libs/maia-db/src/cojson/operations/query.js`](../../maia-db/src/cojson/operations/query.js)**: Query operations that respect time filters
- **[`libs/maia-db/src/utils/meta.js`](../../maia-db/src/utils/meta.js)**: Schema metadata utilities
- **[`libs/maia-db/src/services/schema-service.js`](../../maia-db/src/services/schema-service.js)**: Schema registry with versioning

---

## Summary

CoJSON's built-in history system gives you:

1. **Automatic History** - Every change is preserved forever
2. **Time Travel API** - Jump to any moment with `atTime(timestamp)`
3. **Operation Logs** - See every change to every field with `ops[]`
4. **Transaction Metadata** - Reference specific states with timestamps and IDs
5. **CRDT Guarantees** - Collaborative, conflict-free, immutable

**Perfect for building runtime migration systems** where:
- Schemas are CoValues (with full history)
- Migrations are CoValues (with full history)
- You can query "what version was this created with?"
- You can replay migrations based on time ranges
- Everything syncs automatically across users

The history isn't an add-on - it's how CRDTs work. You get an immutable, tamper-proof audit trail for free! 🎉
