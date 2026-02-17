
### Architecture: Everything Through State Machines

**Strict Rule:** All tool calls MUST flow through state machines. No exceptions.

**Event Flow Pattern:**
```
Infrastructure (ActorEngine, ViewEngine) → sends events → inbox (CRDT) → processMessages() → StateEngine.send() → state machine → tool
```

**Key Principles:**
- ✅ **Single source of truth**: State machines
- ✅ **Fully traceable**: All operations flow through inbox → state machine → tool
- ✅ **Consistent**: One pattern for everything
- ✅ **Declarative**: All behavior defined in state machine configs
- ✅ **CRDT-aligned**: Events persisted in inbox costream, context updates via operations API

### What Flows Through State Machines

**✅ All Tool Calls:**
- All `tool:` actions in state machine definitions
- All business logic operations (`@db`, `@core/publishMessage`, `@dragdrop/*`)
- All lifecycle hooks (RENDER_COMPLETE events)

**✅ All Context Updates:**
- All context updates via `updateContext` action (infrastructure, not a tool)
- Context updates flow: state machine → `updateContextCoValue()` → operations API → CRDT

**❌ NO Infrastructure Tool Calls:**
- ❌ NO direct tool calls from engines (ActorEngine, ViewEngine, etc.)
- ❌ NO fallback patterns - all actors must have state machines
- ❌ NO hardcoded workarounds - everything declarative via state machines

### Infrastructure Actions vs Tools

**Infrastructure Actions** (not tools):
- `updateContext` - Infrastructure action, directly calls `updateContextCoValue()` → operations API
- SubscriptionEngine updates - Read-only reactive subscriptions (infrastructure)
- Config subscriptions - View/style/state changes (infrastructure)

**State Machine Actions:**
- All `tool:` actions in state machine definitions
- All business logic operations
- All context updates via `updateContext` action

### RENDER_COMPLETE Event Pattern

**Lifecycle Hook Pattern:**
- ActorEngine sends `RENDER_COMPLETE` event to inbox after render completes
- State machine handles `RENDER_COMPLETE` event and calls tools as needed
- Use for post-render actions like cleanup or state updates

### All Actors Must Have State Machines

**Requirement:** All actors MUST have state machines. No exceptions.

**Enforcement:**
- If actor has no state machine, `processMessages()` logs error and skips message
- No fallback pattern - all messages MUST flow through state machines
- Single pattern: inbox → state machine → tool

**Why This Matters:**
- **Predictable:** All behavior flows through one path
- **Debuggable:** Easy to trace where operations come from
- **Testable:** State machines define clear contracts
- **AI-friendly:** LLMs can understand and generate correct patterns

### CRDT Alignment

**Single Source of Truth:**
- Co-values are ALWAYS the single source of truth (under the hood)
- ReactiveStore pattern: Stores subscribe to co-value changes
- 100% reactive: Everything updates reactively when co-values change
- All mutations via operations API (`dbEngine.execute({ op: 'update', ... })`)

**Context Updates:**
- `updateContext` action → `updateContextCoValue()` → `dbEngine.execute({ op: 'update', ... })`
- Operations API → `update()` → `content.set(key, value)` on CoMap CRDT
- Context co-value changes → ReactiveStore updates → Views re-render

**Event Flow:**
- Events sent to inbox costream (CRDT)
- Events persisted for traceability
- Events marked as `processed: true` after handling

---

## DataEngine

**Purpose:** Public data API – **maia.do({ op, schema, key, filter, ... })**

**What it does:**
- Executes all data operations (read, create, update, delete, seed, etc.)
- Routes operations to modular handlers
- Supports operations: `read`, `create`, `update`, `delete`, `seed`
- Uses MaiaDB (CoJSON CRDT) for storage
- Validates operations against schemas
- **Unified `read()` API** - Always returns reactive stores
- **MaiaScript expression evaluation** - Supports expressions in update operations

**Key Methods:**
- `execute(payload)` - Execute a database operation
- `getSchemaCoId(schemaName)` - Resolve human-readable schema name to co-id
- `resolveCoId(humanReadableId)` - Resolve human-readable ID to co-id

**Operations:**
- `read` - **Primary API** - Load configs/schemas/data (always returns reactive store)
- `create` - Create new records
- `update` - Update existing records (unified for data collections and configs, supports MaiaScript expressions)
- `delete` - Delete records
- `seed` - Flush + seed database (dev only, IndexedDB backend)

**Example:**
```javascript
// maia = booted MaiaOS instance (from MaiaOS.boot())

// Read (always returns reactive store)
const store = await maia.do({
  op: 'read',
  schema: 'co_zTodos123',  // Schema co-id (co_z...)
  filter: { completed: false }
});

// Store has current value
console.log('Current todos:', store.value);

// Subscribe to updates
const unsubscribe = store.subscribe((data) => {
  console.log('Todos updated:', data);
});

// Create
const newTodo = await maia.do({
  op: 'create',
  schema: 'co_zTodos123',
  data: { text: 'Buy milk', completed: false }
});

// Update with MaiaScript expression
const updated = await maia.do({
  op: 'update',
  id: 'co_zTodo456',
  data: {
    done: { $not: '$existing.done' }  // Toggle using MaiaScript
  }
});
```

**Important:** 
- All schemas must be co-ids (`co_z...`). Human-readable IDs (`@schema/...`) are transformed to co-ids during seeding.
- DataEngine lives in maia-engines; all engines use maia.do for data.
- Operations are in `libs/maia-engines/src/operations/`.

**Dependencies:**
- `@MaiaOS/db` - MaiaDB (storage layer)
- `Evaluator` - For expression evaluation in updates

**Source:** 
- `libs/maia-engines/src/engines/data.engine.js` - DataEngine
- `libs/maia-engines/src/operations/` - Operation implementations

---

## SubscriptionEngine

**Purpose:** Context-driven reactive subscription manager with end-to-end reactivity.

**What it does:**
- Watches actor context for query objects (data subscriptions)
- Auto-subscribes to reactive data
- **Subscribes to config CRDTs** (view, style, state, interface, context, brand) for runtime-editable configs
- Auto-resolves `@` references
- Batches re-renders for performance
- Updates actor context automatically (infrastructure exception)
- Handles config updates reactively (view/style/state changes trigger re-renders)

**Key Methods:**
- `initialize(actor)` - Initialize subscriptions for an actor (data + config)
- `setEngines(engines)` - Set view/style/state engines for config subscriptions
- `cleanup(actor)` - Clean up all subscriptions when actor is destroyed

**Subscription Types:**
1. **Data Subscriptions** - Query objects in context (`{schema: "co_z...", filter: {...}}`)
2. **Config Subscriptions** - Config CRDTs (view, style, state, interface, context, brand)
3. **Message Subscriptions** - Subscriptions/inbox colists (handled in ActorEngine)

**Dependencies:**
- `maia.do` - For all data operations (read, create, update, delete, etc.)
- `ActorEngine` - For triggering re-renders and loading configs
- `ViewEngine` - For view subscriptions
- `StyleEngine` - For style/brand subscriptions
- `StateEngine` - For state machine subscriptions

**Important:** This engine directly updates actor context for reactive query objects. This is the ONLY exception to the rule that state machines are the single source of truth for context changes.
