# Distributed Perpetual Multi-Version Schema Architecture

**Status**: Future Vision (Phase 2+)  
**Last Updated**: 2026-01-20

---

## Problem Statement

MaiaOS needs a **fully decentralized schema evolution system** where:

- **Schemas are append-only** - Never edit, only add new versions
- **Data entities maintain per-version branches forever** - `branch:v1`, `branch:v2`, `branch:v3` coexist
- **Migration triggers on read** - Actors lazily create missing branches when accessing data
- **Backwards compatibility is perpetual** - Old actors never break, new actors seamlessly access old data
- **Upgrade pressure is organic** - Actors naturally want to upgrade when they notice stale data
- **Zero coordination required** - No "migration coordinator" or batch jobs

### Core Innovation

Instead of tracking schema history in a separate CoStream and manually managing branches, we leverage **CoJSON's native branching API** (`node.checkoutBranch()`) to materialize each schema version as an **immutable native branch**. Entities reference schema timestamps, and actors lazily migrate data by creating new branches on read.

---

## Success Criteria

**Desirable**:
- Actors can upgrade at their own pace
- Old actors never break (perpetual backwards compatibility)
- New actors seamlessly access old data (lazy migration)
- Organic upgrade pressure (actors notice stale data)

**Feasible**:
- Leverages CoJSON's native CRDT branching with automatic merge
- Pure JSON migrations (deterministic, side-effect free)
- Vector clocks for conflict detection
- Lazy materialization (branches created on-demand)

**Viable**:
- Scales to thousands of entities with minimal storage overhead
- Maintains performance (lazy branches share transactions)
- No coordination overhead (fully decentralized)
- CRDT sync handles propagation automatically

---

## Architecture Overview

### Three-Layer Design

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Base Schema CoMap (Mutable, Always Latest)        │
├─────────────────────────────────────────────────────────────┤
│ TodoSchema (co_zTodoSchema)                                 │
│ ├── definition: {title, done, priority}  ← Mutable         │
│ ├── versions: co_zTodoSchemaVersions                        │
│ ├── $schemaName: "todo"                                     │
│ └── $createdAt: 1705766400000                               │
└─────────────────────────────────────────────────────────────┘
                           ↓ References
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Versions CoStream (Append-Only Metadata)          │
├─────────────────────────────────────────────────────────────┤
│ TodoSchemaVersions (co_zTodoSchemaVersions)                 │
│ ├── [0]: {                                                  │
│ │     timestamp: 1705766400000,                             │
│ │     branchId: "co_zTodoSchema_1705766400000",            │
│ │     migration: null,                                      │
│ │     description: "Initial version"                        │
│ │   }                                                        │
│ ├── [1]: {                                                  │
│ │     timestamp: 1705852800000,                             │
│ │     branchId: "co_zTodoSchema_1705852800000",            │
│ │     migration: {                                          │
│ │       operations: [                                       │
│ │         {type: "addField", path: "priority", default: 0} │
│ │       ]                                                    │
│ │     },                                                     │
│ │     description: "Added priority field"                   │
│ │   }                                                        │
│ └── [2]: { ... }                                            │
└─────────────────────────────────────────────────────────────┘
                           ↓ References
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Native CoJSON Branches (Immutable Snapshots)      │
├─────────────────────────────────────────────────────────────┤
│ Created via: node.checkoutBranch(schemaId, timestamp, owner)│
│                                                              │
│ Branch "1705766400000" (co_zTodoSchema_1705766400000)      │
│ └── definition: {title, done} ← IMMUTABLE                   │
│                                                              │
│ Branch "1705852800000" (co_zTodoSchema_1705852800000)      │
│ └── definition: {title, done, priority} ← IMMUTABLE         │
│                                                              │
│ Branch "1705939200000" (co_zTodoSchema_1705939200000)      │
│ └── definition: {title, done, priority, tags} ← IMMUTABLE   │
└─────────────────────────────────────────────────────────────┘
```

---

## Why This Structure?

### Base Schema CoMap (Mutable)
- **Always reflects latest** - Actors on latest version read directly (fast path)
- **No history lookup needed** - Current definition immediately available
- **References versions** - Links to append-only version history

### Versions CoStream (Append-Only)
- **Immutable log** - Never edit, only append
- **Timestamp-based** - No v1/v2/v3 tags (simpler, more flexible)
- **Migration metadata** - JSON DSL for transforming data between versions
- **Efficient queries** - "Find version at timestamp T" without loading branches

### Native Branches (Immutable Snapshots)
- **CoJSON native** - Created via `node.checkoutBranch()` API
- **Automatic CRDT merge** - Conflict resolution built-in via `mergeBranch()`
- **Efficient storage** - Branches share transactions with base (delta encoding)
- **Transparent sync** - Branches sync like any CoValue (no special handling)

---

## Entity Data Structure

Entities **don't maintain custom branches** - they just reference the schema timestamp:

```
account.Data (CoList)
├── [0]: co_zTodo_1 (Entity CoMap)
│   ├── title: "Setup MaiaOS"
│   ├── done: false
│   ├── priority: 5  ← Added via lazy migration
│   └── headerMeta (IMMUTABLE):
│       {
│         $schema: "co_zTodoSchema",           // Base schema CoID
│         $schemaTimestamp: 1705766400000,     // Created with v1
│         $createdAt: 1705766500000
│       }
│
└── [1]: co_zTodo_2 (Entity CoMap)
    ├── title: "Write documentation"
    ├── done: false
    ├── priority: 3
    └── headerMeta (IMMUTABLE):
        {
          $schema: "co_zTodoSchema",
          $schemaTimestamp: 1705852800000,     // Created with v2
          $createdAt: 1705852900000
        }
```

**Key Insight**: 
- Entity stores **which schema timestamp** it was created with (immutable)
- Entity data is **mutable** (can be migrated)
- Query schema branch by timestamp: `versions.find(v => v.timestamp <= entity.$schemaTimestamp)`

---

## Complete Example: TODO Schema Evolution

### T0: Create Initial Schema (1705766400000)

```javascript
// 1. Create base schema CoMap
const todoSchema = account.createMap({
  definition: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://maia.city/schemas/todo",
    type: "object",
    properties: {
      title: {type: "string", description: "TODO title"},
      done: {type: "boolean", default: false}
    },
    required: ["title"],
    additionalProperties: false
  },
  $schemaName: "todo",
  $createdAt: Date.now()
}, {
  $schema: "SchemaDefinition"
});

// 2. Create versions CoStream
const versionsStream = account.createStream({
  $schema: "SchemaVersionHistory"
});

todoSchema.set("versions", versionsStream.id);

// 3. Create immutable snapshot branch (native cojson)
const timestamp = Date.now();
const v1Branch = await node.checkoutBranch(
  todoSchema.id,
  timestamp.toString(),  // Branch name = timestamp
  account.id
);

// Copy definition to branch (immutable snapshot)
v1Branch.set("definition", todoSchema.get("definition"));
v1Branch.set("$schemaName", "todo");
v1Branch.set("$createdAt", timestamp);

// 4. Record version in CoStream
versionsStream.push({
  timestamp,
  branchId: v1Branch.id,
  migration: null,  // Initial version
  createdBy: node.sessionID,
  description: "Initial TODO schema"
});

// 5. Register in schemata
account.os.schemata.set("todo", todoSchema.id);

console.log(`✅ TODO schema created: ${todoSchema.id}`);
```

**Result**:
```
TodoSchema (co_zTodoSchema)
├── definition: {title, done}
├── versions: co_zTodoSchemaVersions
├── $schemaName: "todo"
└── $createdAt: 1705766400000

Native Branch:
└── Branch "1705766400000" (co_zTodoSchema_1705766400000)
    └── definition: {title, done} (immutable)

Versions CoStream:
└── [0]: {timestamp: 1705766400000, branchId: "co_z...", migration: null}
```

---

### T0.5: Create TODO Entity (1705766500000)

```javascript
// Create entity with schema reference
const todo1 = account.createMap({
  title: "Setup MaiaOS",
  done: false
}, {
  $schema: todoSchema.id,
  $schemaTimestamp: 1705766400000,  // v1 timestamp
  $createdAt: Date.now()
});

account.Data.append(todo1.id);

console.log(`✅ TODO entity created: ${todo1.id}`);
```

**Result**:
```
Entity: todo1 (co_zTodo_1)
├── title: "Setup MaiaOS"
├── done: false
└── headerMeta:
    {
      $schema: "co_zTodoSchema",
      $schemaTimestamp: 1705766400000,  // v1
      $createdAt: 1705766500000
    }
```

---

### T1: Evolve Schema - Add Priority Field (1705852800000)

```javascript
// Actor wants to add "priority" field

// 1. Load base schema
const todoSchema = node.getCoValue("co_zTodoSchema");
const currentDefinition = todoSchema.get("definition");

// 2. Create new definition (add priority)
const newDefinition = {
  ...currentDefinition,
  properties: {
    ...currentDefinition.properties,
    priority: {
      type: "number",
      description: "Priority level (0-10)",
      default: 0
    }
  }
};

// 3. Update base schema (mutable)
todoSchema.set("definition", newDefinition);

// 4. Create immutable snapshot branch
const timestamp = Date.now();
const v2Branch = await node.checkoutBranch(
  todoSchema.id,
  timestamp.toString(),
  account.id
);

// Copy new definition to branch (immutable snapshot)
v2Branch.set("definition", newDefinition);
v2Branch.set("$schemaName", "todo");
v2Branch.set("$createdAt", timestamp);

// 5. Record version in CoStream
const versionsStream = node.getCoValue(todoSchema.get("versions"));
versionsStream.push({
  timestamp,
  branchId: v2Branch.id,
  migration: {
    operations: [
      {
        type: "addField",
        path: "priority",
        default: 0,
        required: false
      }
    ]
  },
  createdBy: node.sessionID,
  description: "Added priority field for task sorting"
});

console.log(`✅ Schema evolved: ${todoSchema.id} @ ${timestamp}`);
```

**Result**:
```
TodoSchema (co_zTodoSchema) - UPDATED
├── definition: {title, done, priority}  ← Changed (mutable)
├── versions: co_zTodoSchemaVersions
└── ...

Native Branches:
├── Branch "1705766400000" → {title, done} (immutable)
└── Branch "1705852800000" → {title, done, priority} (immutable)

Versions CoStream - APPENDED:
├── [0]: {timestamp: 1705766400000, branchId: "co_z...", migration: null}
└── [1]: {timestamp: 1705852800000, branchId: "co_z...", migration: {add priority}}

Entity: todo1 - UNCHANGED (still uses v1 timestamp):
├── title: "Setup MaiaOS"
├── done: false
└── headerMeta: {$schemaTimestamp: 1705766400000}  ← Still v1!
```

---

### T2: Actor Reads TODO (Lazy Migration on Read)

```javascript
// Actor using v2 schema reads todo1 (created with v1)

async function readEntityWithSchema(entityCoID, node) {
  // 1. Load entity
  const entity = node.getCoValue(entityCoID);
  const entitySchemaTimestamp = entity.headerMeta.$schemaTimestamp;
  
  // 2. Load schema
  const schema = node.getCoValue(entity.headerMeta.$schema);
  
  // 3. Get versions stream
  const versionsStream = node.getCoValue(schema.get("versions"));
  const versions = versionsStream.toJSON();
  
  // 4. Find latest version
  const latestVersion = versions[versions.length - 1];
  
  // 5. Detect: entity uses old schema version
  const needsMigration = entitySchemaTimestamp < latestVersion.timestamp;
  
  if (needsMigration) {
    console.log(`🔄 Migrating entity from ${entitySchemaTimestamp} → ${latestVersion.timestamp}`);
    
    // 6. Find migration path (v1 → v2)
    const migrations = versions.filter(v => 
      v.timestamp > entitySchemaTimestamp && 
      v.timestamp <= latestVersion.timestamp
    );
    
    // 7. Apply migrations sequentially
    let data = entity.toJSON();
    for (const version of migrations) {
      if (version.migration) {
        data = applyMigration(data, version.migration);
      }
    }
    
    // 8. Update entity with migrated data
    for (const [key, value] of Object.entries(data)) {
      if (!(key in entity.toJSON())) {
        entity.set(key, value);  // Add new fields
      }
    }
    
    console.log(`✅ Entity migrated: ${entity.id}`);
  }
  
  return {
    data: entity.toJSON(),
    schema: schema.get("definition"),
    schemaVersion: latestVersion.timestamp,
    schemaTimestamp: entitySchemaTimestamp,
    migrated: needsMigration
  };
}

// Migration engine (JSON DSL)
function applyMigration(data, migration) {
  let result = {...data};
  
  for (const op of migration.operations) {
    switch (op.type) {
      case "addField":
        if (!(op.path in result)) {
          result[op.path] = op.default;
        }
        break;
      case "removeField":
        delete result[op.path];
        break;
      case "renameField":
        result[op.to] = result[op.from];
        delete result[op.from];
        break;
      // ... other operations
    }
  }
  
  return result;
}

// Usage
const result = await readEntityWithSchema("co_zTodo_1", node);
console.log("Entity data:", result.data);
// {title: "Setup MaiaOS", done: false, priority: 0}  ← priority added!
```

**Result**:
```
Entity: todo1 (co_zTodo_1) - AFTER MIGRATION
├── title: "Setup MaiaOS"
├── done: false
├── priority: 0  ← ADDED via lazy migration
└── headerMeta:
    {
      $schema: "co_zTodoSchema",
      $schemaTimestamp: 1705766400000,  // Still v1 (immutable)
      $createdAt: 1705766500000
    }
```

**Note**: `headerMeta.$schemaTimestamp` stays immutable (records creation version), but entity data is migrated.

---

## How Distributed System Works: Zero Coordination

### CRDT Sync Handles Everything

```
┌─────────────────────────────────────────────────────────────┐
│ Actor A (Node 1)                                            │
│                                                              │
│ 1. Evolves schema:                                          │
│    - Updates base schema CoMap (set "definition")           │
│    - Creates branch via node.checkoutBranch()               │
│    - Appends to versions CoStream                           │
│                                                              │
│ 2. CRDT sync automatically propagates:                      │
│    - Base schema CoMap updates                              │
│    - Branch creation (BranchPointerCommit)                  │
│    - Versions CoStream append                               │
└─────────────────────────────────────────────────────────────┘
                           ↓
              (CRDT Sync via WebSocket)
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Actor B (Node 2)                                            │
│                                                              │
│ 3. Receives CRDT sync messages:                             │
│    - CONTENT: base schema updated                           │
│    - CONTENT: branch pointer added                          │
│    - CONTENT: versions stream has new item                  │
│                                                              │
│ 4. Actor B reads entity:                                    │
│    - Checks entity's $schemaTimestamp (v1)                  │
│    - Checks schema's latest version (v2)                    │
│    - Detects: entity is stale                               │
│    - Applies migration automatically (lazy)                 │
└─────────────────────────────────────────────────────────────┘
```

**Key Points**:
1. **No explicit notification** - CRDT sync is the notification mechanism
2. **Eventual consistency** - All nodes eventually see schema changes
3. **Lazy migration** - Entities migrate when read, not when schema changes
4. **Proactive check** - Actors compare entity timestamp vs schema timestamp

---

## Migration DSL (JSON)

### Supported Operations

```typescript
type MigrationOperation =
  | AddFieldOperation
  | RemoveFieldOperation
  | RenameFieldOperation
  | TransformFieldOperation
  | MoveFieldOperation;

interface AddFieldOperation {
  type: "addField";
  path: string;
  default: any;
  required: boolean;
}

interface RemoveFieldOperation {
  type: "removeField";
  path: string;
}

interface RenameFieldOperation {
  type: "renameField";
  from: string;
  to: string;
}

interface TransformFieldOperation {
  type: "transformField";
  path: string;
  transform: string;  // Built-in transform name
}

interface MoveFieldOperation {
  type: "moveField";
  from: string;  // Nested: "address.street"
  to: string;    // Flat: "street"
}
```

### Example: Complex Migration (T2 → T3)

```javascript
// Add tags field + rename title → description
{
  operations: [
    {
      type: "addField",
      path: "tags",
      default: [],
      required: false
    },
    {
      type: "renameField",
      from: "title",
      to: "description"
    },
    {
      type: "transformField",
      path: "priority",
      transform: "numberToString"  // Built-in transform
    }
  ]
}
```

### Built-in Transforms

```javascript
const BuiltInTransforms = {
  stringToNumber: (value) => parseFloat(value) || null,
  numberToString: (value) => value?.toString() || "",
  booleanToString: (value) => value ? "true" : "false",
  stringToBoolean: (value) => value === "true",
  arrayToString: (value) => value.join(", "),
  stringToArray: (value) => value.split(",").map(s => s.trim()),
  toLowercase: (value) => value?.toLowerCase(),
  toUppercase: (value) => value?.toUpperCase(),
  trim: (value) => value?.trim()
};
```

---

## When to Use What

| Question | Answer | Mechanism |
|----------|--------|-----------|
| "What's current schema?" | Read `schema.definition` | Base CoMap field (mutable) |
| "What was schema at T?" | Query versions, load branch | CoStream + native branch |
| "How did field change in v2?" | Check branch ops history | `branchCoValue.ops["field"]` |
| "When was field added?" | Query versions CoStream | CoStream metadata |
| "Which entities need migration?" | Compare timestamps | Entity headerMeta + CoStream |
| "How to migrate entity?" | Apply JSON DSL operations | Migration engine |

---

## Benefits of This Architecture

### 1. Zero Custom Infrastructure
- ✅ Leverage cojson's native branching (battle-tested)
- ✅ Automatic CRDT conflict resolution (built-in)
- ✅ No custom merge logic needed

### 2. Perpetual Backwards Compatibility
- ✅ Old actors never break (entities keep old timestamps)
- ✅ New actors seamlessly access old data (lazy migration)
- ✅ Branches coexist forever (immutable snapshots)

### 3. Organic Upgrade Pressure
- ✅ Actors notice stale data (compare timestamps)
- ✅ Upgrade is pull-based (actors choose when)
- ✅ No forced migrations (actors opt-in)

### 4. Zero Coordination
- ✅ No migration coordinator actor
- ✅ No batch jobs or cron tasks
- ✅ CRDT sync handles propagation
- ✅ Fully decentralized (peer-to-peer)

### 5. Efficient Storage
- ✅ Branches share transactions with base (delta encoding)
- ✅ Lazy materialization (branches created on-demand)
- ✅ CoStream is append-only (efficient)

### 6. Time-Travel & Auditing
- ✅ Every schema version is immutable (snapshots)
- ✅ CRDT ops history within each version
- ✅ Full replayability across all time horizons

---

## Phase 2 Implementation Roadmap

### Phase 2.1: Add Versions Infrastructure

**Goal**: Add versions CoStream and initial branch to existing schemas

**Changes**:
1. Update `schema.migration.js`:
   - Create versions CoStream for each schema
   - Create initial version branch via `node.checkoutBranch()`
   - Record version entry in CoStream
   - Add `$schemaTimestamp` to entity headerMeta

2. Idempotent checks:
   - Check if versions CoStream exists
   - Check if initial branch exists
   - Don't duplicate if already migrated

**Expected Structure**:
```javascript
// Human schema
humanSchema.set("versions", versionsStreamId);

// TODO schema
todoSchema.set("versions", versionsStreamId);

// Entity
entity.headerMeta = {
  $schema: schemaId,
  $schemaTimestamp: timestamp,  // NEW
  $createdAt: Date.now()
};
```

---

### Phase 2.2: Schema Evolution Service

**Goal**: Implement schema evolution (add new versions)

**Files to Create**:
- `libs/maia-db/src/services/schema-service.js`
- `libs/maia-db/src/services/migration-engine.js`

**API**:
```javascript
// Evolve schema
const {timestamp, branchId} = await schemaService.evolveSchema(
  schemaCoID,
  newDefinition,
  {
    operations: [
      {type: "addField", path: "newField", default: null}
    ]
  },
  "Description of change",
  account,
  node
);

// Read entity with schema
const result = await schemaService.readEntityWithSchema(
  entityCoID,
  node
);
// {data, schema, schemaVersion, schemaTimestamp, migrated}

// Migrate entity to target version
const migratedData = await schemaService.migrateEntity(
  entityCoID,
  targetTimestamp,
  node
);
```

---

### Phase 2.3: Lazy Migration on Read

**Goal**: Automatically migrate entities when accessed

**Implementation**:
1. Intercept entity reads in query operation
2. Check entity timestamp vs schema latest
3. If stale, apply migrations
4. Update entity data
5. Return migrated entity

**Integration Point**:
```javascript
// libs/maia-db/src/cojson/operations/query.js
async function queryEntities(op) {
  const entities = await queryCoValues(op);
  
  // For each entity, check schema version
  const results = [];
  for (const entity of entities) {
    const result = await readEntityWithSchema(entity.id, node);
    results.push(result);
  }
  
  return results;
}
```

---

### Phase 2.4: Schema Subscription

**Goal**: Notify actors when new schema versions available

**Implementation**:
1. Subscribe to versions CoStream
2. On new version appended, emit event
3. Actors can show "upgrade available" notification

**API**:
```javascript
// Subscribe to schema updates
const unsubscribe = schemaService.subscribeToSchemaUpdates(
  "todo",
  (newVersion) => {
    console.log(`New TODO schema: ${newVersion.timestamp}`);
    console.log(`Description: ${newVersion.description}`);
    // Show UI notification
  },
  account,
  node
);

// Unsubscribe
unsubscribe();
```

---

### Phase 2.5: Cross-Branch Merging

**Goal**: Handle concurrent edits across versions

**Scenario**: 
- Actor A (v1) edits title
- Actor B (v2) edits priority
- Need to merge changes

**Implementation**:
1. Compare entity CRDT vector clocks
2. Detect concurrent edits
3. Merge using CRDT rules (LWW)
4. Apply to both versions

**Note**: This is complex and may be deferred to Phase 3.

---

## Storage Optimization

### Lazy Branch Materialization

**Concept**: Don't create branches until needed

**Implementation**:
1. Check if branch exists for target version
2. If not, create it on-demand
3. Cache branch reference

**Benefit**: Thousands of entities × 10 versions = 10,000 branches (only if accessed)

---

### Garbage Collection (Optional)

**Concept**: Delete unused branches after grace period

**Heuristics**:
- No v1 actors active for 90 days → delete v1 branches
- Keep latest 3 versions always
- Keep branches with recent activity

**Note**: This is optional - storage is cheap, backwards compatibility is valuable.

---

## Trade-offs & Decisions

### Why Base CoMap is Mutable

**Rationale**: Actors on latest version read directly (fast path)

**Trade-off**: Base changes over time, but branches preserve history

**Benefit**: 90% of actors use latest → optimize for common case

---

### Why Versions CoStream is Separate

**Rationale**: Efficient append-only log, optimized for time-range queries

**Trade-off**: Extra CoValue reference

**Benefit**: Query "all versions between T1-T2" without loading branches

---

### Why Entity headerMeta.$schemaTimestamp is Immutable

**Rationale**: Records creation version (historical anchor)

**Trade-off**: Can't update timestamp after migration

**Benefit**: Always know original version, even after data migrated

---

## Security & Permissions

### Schema Evolution Permissions

**Who can evolve schemas?**
- Account owner (always)
- Group admins (if schema is group-owned)
- Specific roles (via ruleset)

**Implementation**:
```javascript
// Check permissions before evolving schema
const canEvolve = await checkPermission(
  account,
  schema.id,
  "evolve",
  actor
);

if (!canEvolve) {
  throw new Error("Permission denied: cannot evolve schema");
}
```

---

### Entity Migration Permissions

**Who can migrate entities?**
- Entity owner (always)
- Readers (lazy migration on read)
- Writers (explicit migration)

**Note**: Lazy migration on read is safe (read-only until actor writes)

---

## Comparison: Other Schema Evolution Patterns

### Event Sourcing (Kafka, Datomic)

**Similarities**:
- ✅ Append-only event log
- ✅ Time-travel queries
- ✅ Immutable history

**Differences**:
- ❌ Centralized event store (we're decentralized)
- ❌ Requires coordination (we're zero-coordination)
- ❌ Schema registry as separate service (we embed in CoStream)

---

### Protobuf/Avro Schema Registry

**Similarities**:
- ✅ Schema versioning
- ✅ Backwards compatibility checks
- ✅ Migration DSL

**Differences**:
- ❌ Centralized registry (we're P2P)
- ❌ Pre-migration required (we're lazy)
- ❌ No time-travel (we have full CRDT history)

---

### MongoDB Schema Validation

**Similarities**:
- ✅ JSON Schema for validation
- ✅ Flexible schema evolution

**Differences**:
- ❌ No versioning (we track all versions)
- ❌ No migration support (we have JSON DSL)
- ❌ Centralized DB (we're distributed)

---

## Future Enhancements (Phase 3+)

### 1. Schema Diffing

**Feature**: Show visual diff between schema versions

```javascript
const diff = schemaService.diffSchemas(
  "co_zTodoSchema_1705766400000",
  "co_zTodoSchema_1705852800000"
);
// [
//   {type: "add", path: "priority", value: {type: "number"}},
//   {type: "change", path: "$schemaTimestamp", from: T1, to: T2}
// ]
```

---

### 2. Migration Preview

**Feature**: Preview migration without applying

```javascript
const preview = await schemaService.previewMigration(
  entityCoID,
  targetTimestamp
);
// {
//   before: {title, done},
//   after: {title, done, priority: 0},
//   changes: [{type: "add", path: "priority", value: 0}]
// }
```

---

### 3. Rollback Support

**Feature**: Rollback entity to previous schema version

```javascript
await schemaService.rollbackEntity(
  entityCoID,
  previousTimestamp,
  node
);
```

**Implementation**: Use CRDT time-travel (`entity.atTime(timestamp)`)

---

### 4. Schema Linting

**Feature**: Validate schema evolution (breaking changes)

```javascript
const lint = schemaService.lintSchemaChange(
  currentDefinition,
  newDefinition
);
// {
//   errors: [],
//   warnings: ["Removing required field 'title' is breaking"],
//   suggestions: ["Mark 'title' as optional instead"]
// }
```

---

## References

### CoJSON Native Branching

- **API**: `node.checkoutBranch(coValueId, branchName, ownerId)`
- **Merge**: `mergeBranch(branchCoValue)` - Automatic CRDT conflict resolution
- **Source**: `/libs/maia-db/node_modules/cojson/src/coValueCore/branching.ts`
- **Tests**: `/libs/maia-db/node_modules/cojson/src/tests/sync.*.test.ts`

### Design Patterns

- **Append-Only Log**: Event Sourcing, CQRS
- **CRDT Branches**: Operational Transformation, Conflict-Free Replicated Data Types
- **Lazy Migration**: Copy-On-Write, Lazy Loading
- **Schema Registry**: Kafka Schema Registry, Protobuf, Avro

### Related Docs

- `libs/maia-docs/architecture/cojson.md` - CoJSON basics
- `libs/maia-docs/architecture/cojson-history-timetravel.md` - CRDT history API
- `libs/maia-docs/architecture/cojson-migrations.md` - Current migration system
- `libs/maia-db/src/types/schema.types.ts` - TypeScript interfaces
- `libs/maia-db/src/services/schema-service.interface.ts` - Service API

---

## Summary

**This Architecture Provides**:
1. **Fully decentralized** - No coordination required
2. **Perpetual backwards compatibility** - Old actors never break
3. **Organic upgrade pressure** - Actors choose when to upgrade
4. **Zero infrastructure** - Leverage native cojson branching
5. **Efficient storage** - Lazy branches, delta encoding
6. **Time-travel & auditing** - Full CRDT history preserved

**Next Steps**:
1. Phase 2.1: Add versions infrastructure to current schemas
2. Phase 2.2: Implement schema evolution service
3. Phase 2.3: Implement lazy migration on read
4. Phase 2.4: Add schema subscription
5. Phase 2.5: Cross-branch merging (if needed)

**The Future is Distributed, Perpetual, and Lazy** ✨
