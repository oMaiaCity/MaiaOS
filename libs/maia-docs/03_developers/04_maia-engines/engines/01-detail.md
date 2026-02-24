# Engine Details

---

## Architecture: Process Handlers (100% Inbox → Process → Actions)

**Strict Rule:** All tool calls and context updates flow through process handlers. No exceptions.

**Event Flow Pattern:**
```
Infrastructure (ActorEngine, ViewEngine) → deliverEvent() → inbox (CoStream CRDT) 
  → processEvents() → ProcessEngine.send() → handlers[event] → actions
```

**Key Principles:**
- Single source of truth: Process handlers
- Fully traceable: All operations flow through inbox → ProcessEngine → actions
- GenServer-style: Handlers keyed by event type, no state machine states/transitions
- CRDT-aligned: Events persisted in inbox costream, context updates via operations API

### What Flows Through Process Handlers

**All Tool Calls:**
- `op` actions in process definitions (DB operations via maia.do)
- All business logic operations

**All Context Updates:**
- `ctx` action - Direct context updates evaluated by ProcessEngine
- Context updates flow: ProcessEngine → `updateContextCoValue()` → operations API → CRDT

**Infrastructure (not process handlers):**
- Config subscriptions - View/style/process changes (backend $stores)
- Backend unified store - Query objects in context, reactive resolution

### All Actors Must Have Process Definitions

**Requirement:** All actors MUST have process definitions with handlers. No exceptions.

**Flow:** inbox → processEvents() → ProcessEngine.send() → handlers[event] → _executeActions()

### CRDT Alignment

- Co-values are ALWAYS the single source of truth
- ReactiveStore pattern: Stores subscribe to co-value changes
- All mutations via operations API (`maia.do({ op: 'update', ... })`)
- Events sent to inbox costream, marked `processed: true` after handling

---

## DataEngine (Full Operations Reference)

**Purpose:** maia.do({ op, schema, key, filter, ... })

### CRUD Operations
- **read** - Load configs/schemas/data (always returns reactive store)
- **create** - Create new records (supports idempotencyKey)
- **update** - Update records (supports MaiaScript expressions in data)
- **delete** - Delete records

### Schema & Resolution
- **schema** - Load schema definition
- **resolve** - Resolve identifier to co-id/schema/coValue

### Collection Operations
- **append** - Append to CoList
- **push** - Push to CoStream
- **spliceCoList** - Splice CoList

### Inbox
- **processInbox** - Process unprocessed inbox messages (called by ActorEngine)

### Spark Operations
- createSpark, readSpark, updateSpark, deleteSpark
- addSparkMember, removeSparkMember, updateSparkMemberRole
- addSparkParentGroup, removeSparkParentGroup
- getSparkMembers

### Extensibility
```javascript
dataEngine.registerOperation('myOp', {
  execute: async (params) => { /* ... */ }
});
```

**Example:**
```javascript
const store = await maia.do({ op: 'read', schema: 'co_z...', filter: { done: false } });
const created = await maia.do({ op: 'create', schema: 'co_z...', data: { text: 'New' } });
const updated = await maia.do({ op: 'update', id: 'co_z...', data: { done: { $not: '$existing.done' } } });
```

---

## Subscriptions (Backend Architecture, Not an Engine)

Subscriptions are handled by the **backend $stores architecture** (CoCache, unified store in maia-db). No SubscriptionEngine.

**How it works:**
- Query objects in context: `{ schema: "co_z...", filter: {...} }`
- Backend unified store merges context + query results
- Subscriptions managed by CoCache (5s timeout, auto-cleanup)
- Config CRDTs (view, style, process) subscribed by backend

**See:** [subscriptions-overview.md](../subscriptions-overview.md)

---

## ModuleRegistry

**Purpose:** Central plugin system for MaiaScript extensions.

**What it does:** Registers modules (core, ai, db) that provide tools. ProcessEngine executes tools via `op` actions.

**Key Methods:** `registerModule()`, `getModule()`, `loadModule()`, `listModules()`

**Source:** `libs/maia-engines/src/modules/registry.js`

---

## Separation of Concerns

**ProcessEngine:**
- Updates context via `ctx` actions
- Calls maia.do via `op` actions
- Does NOT manipulate views directly

**ViewEngine:**
- Renders DOM from context reactively
- Sends events (never updates context directly)
- Resolves ALL expressions before sending to inbox

**ActorEngine:**
- Orchestrates actors and engines
- Routes messages (inbox → ProcessEngine)

---

## Related Documentation

- [00-overview.md](./00-overview.md) - Engine summaries
- [02-reference.md](./02-reference.md) - Method signatures
- [../subscriptions-overview.md](../subscriptions-overview.md) - Subscription architecture
