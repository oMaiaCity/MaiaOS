# MaiaOS Documentation for maia-script

**Auto-generated:** 2026-02-11T21:30:35.375Z
**Purpose:** Complete context for LLM agents working with MaiaOS

---

# 00 OVERVIEW

*Source: developers/actor-communication/00-overview.md*

# Actor-to-Actor Communication Flow

## Overview

This document explains how actors communicate with each other in MaiaOS, using the Sparks vibe as a concrete example. Actors communicate via **inbox-based messaging** (CoStreams), not direct references, ensuring clean separation and distributed system compatibility.

**Key Principle**: Every actor is independent with its own context, state machine, view, and inbox. Actors communicate by sending messages to each other's inboxes, not by accessing each other's internal state.

---

## Complete Flow: Agent Actor → Detail Actor

### Sequence Diagram

```mermaid
sequenceDiagram
    participant User as User
    participant AgentView as Agent View
    participant AgentState as Agent State Machine
    participant AgentContext as Agent Context
    participant DetailInbox as Detail Actor Inbox<br/>(CoStream)
    participant DetailProcess as Detail processMessages
    participant DetailState as Detail State Machine
    participant DetailContext as Detail Context
    participant DetailQuery as sparkDetails Query
    participant DetailView as Detail View

    User->>AgentView: Click spark item
    AgentView->>AgentView: resolveExpressions()<br/>($$id → "co_z123...")
    AgentView->>AgentState: sendInternalEvent()<br/>{type: "SELECT_SPARK",<br/>payload: {sparkId: "co_z123..."}}
    Note over AgentView,AgentState: Message persisted to Agent Inbox<br/>(CoStream - CRDT)
    AgentState->>AgentContext: updateContext<br/>{selectedSparkId: "co_z123..."}
    AgentState->>AgentState: sendToDetailActor<br/>(custom action)
    AgentState->>DetailInbox: sendMessage()<br/>{type: "LOAD_ACTOR",<br/>payload: {id: "co_z123..."}}
    Note over DetailInbox: Message persisted to Detail Inbox<br/>(CoStream - CRDT)
    DetailInbox->>DetailProcess: Subscription fires<br/>(new message detected)
    DetailProcess->>DetailProcess: Validate message type<br/>(check messageTypes: ["LOAD_ACTOR"])
    DetailProcess->>DetailProcess: Load & validate schema<br/>(@schema/message/LOAD_ACTOR)
    DetailProcess->>DetailState: stateEngine.send()<br/>("LOAD_ACTOR", payload)
    DetailState->>DetailContext: updateContext<br/>{sparkId: "$$id"} → {sparkId: "co_z123..."}
    DetailContext->>DetailQuery: Filter re-evaluated<br/>{id: "$sparkId"} → {id: "co_z123..."}
    DetailQuery->>DetailQuery: Query re-executed<br/>(readSingleCoValue with new filter)
    DetailQuery->>DetailContext: Query results updated<br/>(sparkDetails: {...})
    DetailContext->>DetailState: Entry action triggered<br/>(context changed)
    DetailState->>DetailState: Evaluate entry actions<br/>(spark: "$sparkDetails",<br/>showEmptyMembers: ...)
    DetailContext->>DetailView: Context updated<br/>(subscription fires)
    DetailView->>DetailView: Re-render<br/>(shows spark details)
```

---

## Step-by-Step Breakdown

### 1. User Interaction → View Event

**Location**: `libs/maia-vibes/src/sparks/agent/agent.view.maia`

When a user clicks a spark item:
```json
{
  "$on": {
    "click": {
      "send": "SELECT_SPARK",
      "payload": { "sparkId": "$$id" }
    }
  }
}
```

**What happens**:
- View engine resolves `$$id` to actual co-id (e.g., `"co_z123..."`)
- View engine calls `sendInternalEvent()` with resolved payload
- Message is persisted to agent actor's inbox (CoStream)

**Key Point**: All expressions are resolved **before** sending to inbox. Only clean JSON is persisted.

---

### 2. Agent State Machine Processing

**Location**: `libs/maia-vibes/src/sparks/agent/agent.state.maia`

The agent state machine receives `SELECT_SPARK`:
```json
{
  "on": {
    "SELECT_SPARK": {
      "target": "idle",
      "actions": [
        {
          "updateContext": {
            "selectedSparkId": "$$sparkId"
          }
        },
        "sendToDetailActor"
      ]
    }
  }
}
```

**What happens**:
1. Updates context: `selectedSparkId: "co_z123..."`
2. Executes custom action: `sendToDetailActor`

---

### 3. Custom Action: Sending Message to Detail Actor

**Location**: `libs/maia-script/src/engines/state.engine.js:464-475`

The `sendToDetailActor` custom action:
```javascript
if (actionName === 'sendToDetailActor') {
  const sparkId = machine.actor.context.value?.selectedSparkId;
  if (sparkId && machine.actor?.children?.detail) {
    const detailActor = machine.actor.children.detail;
    await machine.actor.actorEngine.sendMessage(detailActor.id, {
      type: 'LOAD_ACTOR',
      payload: { id: sparkId },
      from: machine.actor.id
    });
  }
}
```

**What happens**:
1. Reads `selectedSparkId` from agent context
2. Gets reference to detail actor (child actor)
3. Sends `LOAD_ACTOR` message to detail actor's inbox via `sendMessage()`

**Key Point**: Messages are sent to actor inboxes (CoStreams), not directly to state machines. This ensures CRDT-native persistence and sync.

---

### 4. Message Persistence to Inbox

**Location**: `libs/maia-script/src/engines/actor.engine.js:753-784`

The `sendMessage()` function:
```javascript
async sendMessage(actorId, message) {
  // Validate payload is resolved (no expressions)
  if (message.payload && containsExpressions(message.payload)) {
    throw new Error(`[ActorEngine] Message payload contains unresolved expressions...`);
  }
  
  const actor = this.actors.get(actorId);
  if (actor.inboxCoId && this.dbEngine) {
    const messageData = {
      type: message.type,
      payload: message.payload || {},
      source: message.from || message.source,
      target: actorId,
      processed: false
    };
    await createAndPushMessage(this.dbEngine, actor.inboxCoId, messageData);
  }
}
```

**What happens**:
1. Validates payload is resolved (no expressions)
2. Creates message object with metadata
3. Persists to detail actor's inbox CoStream (CRDT)
4. Message syncs across devices automatically

**Key Point**: Inbox is a CoStream (append-only list), providing CRDT-native deduplication and sync.

---

### 5. Message Processing

**Location**: `libs/maia-script/src/engines/actor.engine.js:899-950`

The `processMessages()` function subscribes to inbox CoStream:
```javascript
async processMessages(actor) {
  // Subscribe to inbox CoStream
  const inboxStore = await this.dbEngine.execute({
    op: 'read',
    schema: actor.inboxSchemaCoId,
    key: actor.inboxCoId
  });
  
  // When new message arrives, subscription fires
  inboxStore.subscribe(async (inboxValue) => {
    // Process unprocessed messages
    for (const message of unprocessedMessages) {
      // Validate message type
      if (!actor.messageTypes.includes(message.type)) {
        console.warn(`[ActorEngine] Message type ${message.type} not in messageTypes`);
        continue;
      }
      
      // Load and validate message schema
      const messageSchema = await loadMessageSchema(message.type);
      await validatePayload(message.payload, messageSchema);
      
      // Route to state machine
      await this.stateEngine.send(actor.machine.id, message.type, message.payload);
    }
  });
}
```

**What happens**:
1. Subscribes to inbox CoStream
2. When new message arrives, subscription fires
3. Validates message type against `messageTypes` array
4. Loads and validates message schema
5. Routes to state machine via `stateEngine.send()`

**Key Point**: Message validation ensures type safety and prevents invalid messages from reaching state machines.

---

### 6. Detail State Machine Processing

**Location**: `libs/maia-vibes/src/sparks/detail/detail.state.maia`

The detail state machine receives `LOAD_ACTOR`:
```json
{
  "on": {
    "LOAD_ACTOR": {
      "target": "idle",
      "actions": [
        {
          "updateContext": {
            "sparkId": "$$id"
          }
        }
      ]
    }
  }
}
```

**What happens**:
1. Receives `LOAD_ACTOR` message with `payload: {id: "co_z123..."}`
2. Updates context: `sparkId: "co_z123..."`
3. Entry action runs (because state is `idle`)

---

### 7. Query Reactivity: Dynamic Filter Re-evaluation

**Location**: `libs/maia-db/src/cojson/crud/read.js:99-471`

The detail context contains a query with dynamic filter:
```json
{
  "sparkDetails": {
    "schema": "@schema/data/spark",
    "filter": {
      "id": "$sparkId"
    }
  }
}
```

**What happens**:
1. Context update changes `sparkId: null` → `sparkId: "co_z123..."`
2. Unified store detects context change
3. Re-evaluates query filters: `{id: "$sparkId"}` → `{id: "co_z123..."}`
4. Detects `findOne` pattern (single ID filter)
5. Executes query: `readSingleCoValue(backend, "co_z123...")`
6. Returns single object (not array)
7. Updates `sparkDetails` in context with query result

**Key Point**: Queries automatically re-execute when their filters change. This is reactive - no manual refresh needed.

---

### 8. Entry Action: Deriving UI State

**Location**: `libs/maia-vibes/src/sparks/detail/detail.state.maia:25-51`

The entry action runs when context changes:
```json
{
  "entry": {
    "updateContext": {
      "spark": "$sparkDetails",
      "showContent": {
        "$and": [
          { "$ne": ["$sparkId", null] },
          { "$ne": ["$sparkDetails", null] }
        ]
      },
      "showEmptyMembers": {
        "$if": {
          "condition": {
            "$and": [
              { "$ne": ["$sparkDetails", null] },
              {
                "$or": [
                  { "$eq": ["$sparkDetails.members", null] },
                  { "$eq": [{ "$length": "$sparkDetails.members" }, 0] }

---

# 01 REFERENCE

*Source: developers/actor-communication/01-reference.md*

]
              }
            ]
          },
          "then": true,
          "else": false
        }
      }
    }
  }
}
```

**What happens**:
1. Sets `spark: "$sparkDetails"` (single object from query)
2. Computes `showContent` (boolean flag for UI)
3. Computes `showEmptyMembers` (boolean flag for UI)

**Key Point**: UI flags are computed in state machines, not views. Views only reference boolean flags from context.

---

### 9. View Re-rendering

**Location**: `libs/maia-vibes/src/sparks/detail/detail.view.maia`

The view subscribes to context changes:
```json
{
  "tag": "h2",
  "class": "detail-title",
  "text": "$spark.name"
}
```

**What happens**:
1. Context subscription fires when `spark` updates
2. View engine re-renders with new context value
3. View displays spark details and members

**Key Point**: Views are reactive - they automatically re-render when context changes.

---

## Key Architectural Patterns

### 1. Inbox-Based Communication

**Why**: 
- CRDT-native persistence and sync
- Complete event traceability
- Distributed system compatibility
- No direct actor references needed

**How**:
- Messages sent to actor inboxes (CoStreams)
- Inbox subscriptions process messages automatically
- Messages validated before routing to state machines

### 2. Independent Actors

**Why**:
- Each actor has its own context, state, view, inbox
- No parent-child dependencies
- Actors can be created/destroyed independently
- Enables lazy loading and reuse

**How**:
- Child actors created lazily via `_createChildActorIfNeeded()`
- Parent references child via `actor.children[namekey]`
- Communication via inboxes, not direct state access

### 3. Reactive Queries

**Why**:
- Automatic updates when filters change
- No manual refresh needed
- Declarative data needs
- Backend handles all query resolution

**How**:
- Query objects declared in context: `{schema: "...", filter: {...}}`
- Unified store detects queries, evaluates filters, executes queries
- Query results merged into context automatically
- Context subscriptions trigger view re-renders

### 4. Expression Resolution

**Why**:
- Only resolved values can be persisted to CRDTs
- Expressions require evaluation context that may not exist remotely
- Clean JSON is portable across devices

**How**:
- Views resolve ALL expressions before sending to inbox
- Messages contain only resolved values (no expressions)
- State machines receive resolved payloads
- Filters re-evaluated when context changes

---

## File Reference

### Core Engine Files

- **Actor Engine** (`libs/maia-script/src/engines/actor.engine.js`):
  - `sendMessage()` - Send message to actor inbox
  - `sendInternalEvent()` - Send internal event to own inbox
  - `processMessages()` - Process messages from inbox
  - `_createChildActorIfNeeded()` - Create child actor lazily

- **State Engine** (`libs/maia-script/src/engines/state.engine.js`):
  - `send()` - Route event to state machine
  - `_executeNamedAction()` - Execute custom actions (e.g., `sendToDetailActor`)

- **View Engine** (`libs/maia-script/src/engines/view.engine.js`):
  - `_renderSlot()` - Render child actors in slots
  - `_handleEvent()` - Handle DOM events, resolve expressions, send to inbox

- **Unified Store** (`libs/maia-db/src/cojson/crud/read.js`):
  - `createUnifiedStore()` - Wrap context, detect queries, merge results
  - `resolveQueries()` - Evaluate filters, execute queries
  - `evaluateFilter()` - Resolve filter expressions dynamically

### Sparks Vibe Files

- **Agent Actor** (`libs/maia-vibes/src/sparks/agent/`):
  - `agent.view.maia` - Renders spark list, sends `SELECT_SPARK` event
  - `agent.state.maia` - Handles `SELECT_SPARK`, calls `sendToDetailActor`
  - `agent.context.maia` - Contains `sparks` query, `selectedSparkId`, `@actors`

- **Detail Actor** (`libs/maia-vibes/src/sparks/detail/`):
  - `detail.actor.maia` - Defines `messageTypes: ["LOAD_ACTOR"]`
  - `detail.context.maia` - Contains `sparkDetails` query with dynamic filter
  - `detail.state.maia` - Handles `LOAD_ACTOR`, computes UI flags
  - `detail.view.maia` - Renders spark details and members

---

## Common Patterns

### Pattern 1: Parent → Child Communication

**Use Case**: Parent actor needs to send data to child actor

**Steps**:
1. Parent state machine updates its context
2. Parent state machine calls custom action (e.g., `sendToDetailActor`)
3. Custom action reads from parent context
4. Custom action sends message to child inbox
5. Child processes message, updates its context
6. Child queries re-evaluate if filters changed

**Example**: Agent actor → Detail actor (Sparks vibe)

### Pattern 2: Dynamic Query Filters

**Use Case**: Query should filter by value from context

**Steps**:
1. Define query in context with dynamic filter: `{id: "$sparkId"}`
2. Update context value that filter references: `sparkId: "co_z123..."`
3. Unified store detects filter change
4. Query re-executes with new filter
5. Query results update in context
6. Views re-render with new data

**Example**: `sparkDetails` query filters by `sparkId`

### Pattern 3: Child Actor Creation

**Use Case**: Render child actor in parent view

**Steps**:
1. Define child in parent context: `@actors: {detail: "@sparks/actor/detail"}`
2. Reference child in view: `currentDetail: "@detail"`
3. Use slot in view: `$slot: "$currentDetail"`
4. View engine extracts namekey from `currentDetail`
5. View engine calls `_createChildActorIfNeeded()`
6. Child actor created lazily, attached to slot element

**Example**: Agent view renders detail actor in slot

---

## Troubleshooting

### Issue: Detail view not updating when clicking spark

**Symptoms**: Clicking spark item doesn't update detail view

**Possible Causes**:
1. Expression validation error in state machine entry action
2. Message not being sent to detail actor inbox
3. Detail actor not created yet
4. Query filter not re-evaluating

**Debug Steps**:
1. Check console for expression validation errors
2. Verify `sendToDetailActor` action is called
3. Verify message appears in detail actor inbox
4. Verify `sparkId` updates in detail context
5. Verify query filter re-evaluates

**Fix**: Use `$sparkDetails.members` instead of `$spark.members` in entry action (see bug fix above)

### Issue: Messages not being processed

**Symptoms**: Messages sent but not reaching state machine

**Possible Causes**:
1. Message type not in `messageTypes` array
2. Message schema validation failing
3. Inbox subscription not set up
4. Actor not created yet

**Debug Steps**:
1. Verify message type in `messageTypes` array
2. Check message schema exists and validates
3. Verify inbox subscription is active
4. Verify actor exists before sending message

---

## Related Documentation

- [Actor Engine API](../engines/#actor-engine) - Actor lifecycle and messaging
- [State Engine API](../engines/#state-engine) - State machine execution
- [View Engine API](../engines/#view-engine) - View rendering and events
- [Query Reactivity](../05_maia-db/README.md) - How queries work with dynamic filters
- [MaiaScript Expressions](../04_maia-script/expressions.md) - Expression syntax and evaluation

---

## Summary

**Actor-to-actor communication in MaiaOS**:
1. ✅ **Inbox-based** - Messages sent to actor inboxes (CoStreams)
2. ✅ **Independent** - Each actor has its own context, state, view, inbox
3. ✅ **Reactive** - Queries re-execute when filters change
4. ✅ **Validated** - Messages validated before routing to state machines
5. ✅ **CRDT-native** - All messages persist to CRDTs, sync across devices

**Key Files**:
- `libs/maia-script/src/engines/actor.engine.js` - Message passing
- `libs/maia-script/src/engines/state.engine.js` - State machine execution
- `libs/maia-db/src/cojson/crud/read.js` - Query reactivity

**Example**: Sparks vibe agent → detail actor communication flow (documented above)

---

# README

*Source: developers/actor-communication/README.md*

# Actor Communication Documentation

1. **[00-overview.md](./00-overview.md)** - Communication overview
2. **[01-reference.md](./01-reference.md)** - Reference details

---

# API REFERENCE

*Source: developers/api-reference.md*

# API Reference

Complete API reference for `@MaiaOS/script` package.

---

## Exported Engines

All engines are exported from `@MaiaOS/script`:

```javascript
import {
  ActorEngine,
  ViewEngine,
  StyleEngine,
  StateEngine,
  ToolEngine,
  MaiaScriptEvaluator,
  ModuleRegistry,
  DBEngine,
  IndexedDBBackend,
  SubscriptionEngine,
  MessageQueue
} from '@MaiaOS/script';
```

---

## Subpath Exports

Modules and engines are available via subpath exports:

```javascript
// Modules
import { register } from '@MaiaOS/script/modules/db.module.js';

// Engines (if needed)
import { ActorEngine } from '@MaiaOS/script/engines/actor-engine/actor.engine.js';
```

---

## Using Engines Directly

For advanced use cases, you can use engines independently:

### Custom Evaluator

```javascript
import { MaiaScriptEvaluator } from '@MaiaOS/script';

const evaluator = new MaiaScriptEvaluator(null, {
  maxDepth: 100,
  validateExpressions: true
});

const result = await evaluator.evaluate(
  { $if: { condition: true, then: 'yes', else: 'no' } },
  { context: {}, item: {} }
);
```

### Custom View Renderer

```javascript
import { ViewEngine, MaiaScriptEvaluator, ModuleRegistry } from '@MaiaOS/script';

const evaluator = new MaiaScriptEvaluator();
const registry = new ModuleRegistry();
const viewEngine = new ViewEngine(evaluator, null, registry);

// Render a view without full actor system
await viewEngine.render(viewDef, { context: {} }, shadowRoot, [], 'custom');
```

### Custom Database Operations

```javascript
import { DBEngine, IndexedDBBackend } from '@MaiaOS/script';

const backend = new IndexedDBBackend();
await backend.init();
const dbEngine = new DBEngine(backend);

// Use read() API (always returns reactive store)
const store = await dbEngine.execute({
  op: 'read',
  schema: 'co_zTodos123'  // Schema co-id (co_z...)
});

// Store has current value
console.log('Current data:', store.value);

// Subscribe to updates
const unsubscribe = store.subscribe((data) => {
  console.log('Data updated:', data);
});
```

---

## Package Exports

The package exports are defined in `libs/maia-script/package.json`:

```json
{
  "exports": {
    ".": "./src/index.js",
    "./modules/*": "./src/modules/*",
    "./engines/*": "./src/engines/*"
  }
}
```

---

## Related Documentation

- [Main README](./README.md) - Package overview
- [engines/](./engines/) - Detailed engine descriptions
- [modules.md](./modules.md) - Module system
- [expressions.md](./expressions.md) - Expression language
- [patterns.md](./patterns.md) - Common patterns

---

# 00 OVERVIEW

*Source: developers/engines/00-overview.md*

# Engines

The `@MaiaOS/script` package provides 10 core engines that work together to execute MaiaScript and manage actor lifecycles.

---

## Evaluator (MaiaScriptEvaluator)

**Purpose:** Evaluates MaiaScript expressions safely.

**What it does:**
- Evaluates JSON-based expressions (`$if`, `$eq`, `$context`, `$$item`, etc.)
- Resolves data paths (`$context.title`, `$$item.id`)
- Validates expressions against schema before evaluation
- Enforces depth limits to prevent DoS attacks
- Supports shortcut syntax: `$key` (context) and `$$key` (item)

**Key Methods:**
- `evaluate(expression, data, depth)` - Evaluate an expression
- `evaluateShortcut(expression, data)` - Handle `$key` and `$$key` shortcuts
- `isDSLOperation(value)` - Check if value is a DSL operation

**Example:**
```javascript
import { Evaluator as MaiaScriptEvaluator } from '@MaiaOS/script';

const evaluator = new MaiaScriptEvaluator();

// Evaluate a simple expression
const result = await evaluator.evaluate(
  { $if: { condition: { $eq: ['$context.status', 'active'] }, then: 'green', else: 'gray' } },
  { context: { status: 'active' } }
);
// Returns: 'green'

// Shortcut syntax
const title = await evaluator.evaluate('$context.title', { context: { title: 'Hello' } });
// Returns: 'Hello'
```

**Security:**
- Validates expressions against `maia-script-expression` schema before evaluation
- Enforces maximum recursion depth (default: 50) to prevent DoS
- Sandboxed - only whitelisted operations allowed
- No code execution - pure JSON expression evaluation

**Source:** `libs/maia-script/src/utils/evaluator.js`

---

## ActorEngine

**Purpose:** Orchestrates actor lifecycle and coordinates all engines.

**What it does:**
- Creates and manages actors
- Handles message passing (inbox/subscriptions)
- Coordinates ViewEngine, StyleEngine, StateEngine
- Manages actor context and state
- Processes messages and triggers state transitions
- **Sequential processing**: Ensures events process one at a time (deterministic state machines)

**Key Methods:**
- `createActor(actorConfig, container)` - Create an actor
- `loadActor(actorId)` - Load actor config from database
- `sendMessage(actorId, message)` - Send message to actor
- `processMessages(actorId)` - Process pending messages sequentially (guarded against concurrent execution)
- `getActor(actorId)` - Get actor by ID
- `rerenderActor(actorId)` - Re-render actor view

**Sequential Processing:**
- `processMessages()` uses `_isProcessing` guard to prevent concurrent execution
- Events process one at a time, ensuring deterministic state transitions
- Unhandled events are marked as processed (not rejected)
- Sequential processing handled generically in engine - no need to handle in state configs

**Message Validation Pipeline:**
- **Step 1: Message Contract Validation** - Checks if message type is in actor's `messageTypes` array
- **Step 2: Message Type Schema Loading** - Loads message type schema from registry (`@schema/message/{TYPE}`)
- **Step 3: Payload Validation** - Validates message payload against the message type schema (the schema IS the payload schema - merged concept)
- **Step 4: State Machine Routing** - If validation passes, routes validated message to StateEngine
- Invalid messages are rejected early with clear error messages before reaching the state machine

**Note:** Message type schemas directly represent the payload schema. There is no separate `payloadSchema` property - the message type schema itself validates the payload.

**Dependencies:**
- `StyleEngine` - For style compilation
- `ViewEngine` - For view rendering
- `ModuleRegistry` - For module access
- `ToolEngine` - For tool execution
- `StateEngine` - For state machine interpretation
- `SubscriptionEngine` - For reactive subscriptions

**Example:**
```javascript
import { ActorEngine } from '@MaiaOS/script';

// ActorEngine is typically created by kernel during boot
// But you can create it manually for advanced use cases:
const actorEngine = new ActorEngine(
  styleEngine,
  viewEngine,
  moduleRegistry,
  toolEngine,
  stateEngine
);

// Create an actor
const actor = await actorEngine.createActor(
  actorConfig,
  document.getElementById('container')
);
```

**Source:** `libs/maia-script/src/engines/actor-engine/actor.engine.js`

---

## ViewEngine

**Purpose:** Renders `.maia` view definitions to Shadow DOM.

**What it does:**
- Converts view definitions to DOM elements
- Handles `$each` loops for iteration
- Processes `$slot` for actor composition
- Manages event handlers (`$on`)
- Uses Shadow DOM for style isolation
- Sanitizes HTML to prevent XSS
- **Reactive rendering** - Automatically re-renders when context changes
- **Resolves ALL expressions before sending to inbox** - Only resolved values (clean JS objects/JSON) are sent
- **Rejects conditional logic** - Views are "dumb" templates, no `$if`, `$eq`, ternary operators allowed

**Key Methods:**
- `loadView(coId)` - Load view definition from database
- `render(viewDef, context, shadowRoot, styleSheets, actorId)` - Render view
- `renderNode(nodeDef, data, actorId)` - Render a single node
- `_handleEvent(event, element, actorId)` - Handle view events, resolves expressions, validates payloads

**Dependencies:**
- `Evaluator` - For expression evaluation
- `ActorEngine` - For action handling
- `ModuleRegistry` - For module access

**Architectural Boundaries:**
- ✅ **ONLY displays current state** - Views read from context reactively (ReactiveStore subscriptions)
- ✅ **ONLY sends events** - Views send events via `send` syntax, never update context directly
- ✅ **ONLY manipulates DOM reactively** - DOM updates happen in response to context changes
- ✅ **Resolves ALL expressions before sending** - ViewEngine fully resolves all expressions before sending to inbox (only clean JS objects/JSON persist to CoJSON)
- ✅ **Validates payloads are resolved** - Throws error if unresolved expressions found in payloads
- ❌ **SHOULD NOT update context directly** - All context updates flow through state machines
- ❌ **SHOULD NOT trigger state transitions directly** - Views send events, state machines handle transitions
- ❌ **Should NOT contain conditional logic** (`$if`, `$eq`, ternary operators) - All conditionals belong in state machines
- ❌ **Should NOT contain DSL operations** - Views only resolve simple context/item references (`$key`, `$$key`)
- **Reactive UI behavior** - Use data attributes (e.g., `data-auto-focus="true"`) for declarative UI behavior

**Expression Resolution:**
- Views resolve ALL expressions before sending to inbox via `resolveExpressions()`
- Only resolved values (clean JS objects/JSON) are persisted to CoJSON
- State machines receive pre-resolved payloads (no re-evaluation needed)
- Action configs in state machines still support expressions (evaluated in state machine context)

**Correct Pattern - Views Handle UI Reactively:**
```json
// State machine computes boolean flag
{
  "updateContext": {
    "isSelected": {"$eq": ["$$id", "$selectedId"]}
  }
}

// View references resolved context value
{
  "tag": "div",
  "attrs": {
    "data-selected": "$isSelected"  // Simple context reference, resolved to true/false
  }
}

// CSS handles conditional styling
{
  "div": {
    "data-selected": {
      "true": { "background": "blue" }
    }
  }
}
```

**Example:**
```javascript
import { ViewEngine } from '@MaiaOS/script';

const viewEngine = new ViewEngine(evaluator, actorEngine, moduleRegistry);

// Render a view
await viewEngine.render(
  viewDef,
  { context: { title: 'Hello' } },
  shadowRoot,
  styleSheets,
  'actor-123'
);
```

**Security:**
- Uses `textContent` for text (auto-escapes HTML)
- Uses `createElement`/`appendChild` for DOM (safe)
- Sanitizes attribute values
- Shadow DOM isolation prevents style leakage

**Source:** `libs/maia-script/src/engines/view-engine/view.engine.js`

---

## StyleEngine

**Purpose:** Compiles `.maia` style definitions to CSS.

**What it does:**
- Compiles style definitions to Constructable Stylesheets
- Merges brand styles with actor overrides
- Interpolates token references (`{token.color}`)
- Caches compiled stylesheets
- Supports CSS-in-JS approach

**Key Methods:**
- `loadStyle(coId)` - Load style definition from database
- `compile(brandStyleId, actorStyleId)` - Compile styles
- `clearCache()` - Clear style cache (dev only)

**Dependencies:**
- `DBEngine` - For loading style definitions

**Example:**
```javascript
import { StyleEngine } from '@MaiaOS/script';

const styleEngine = new StyleEngine();

// Compile styles
const styleSheets = await styleEngine.compile(
  'co_z...brand',  // Brand style co-id
  'co_z...actor'   // Actor style co-id (optional)
);
```

**Source:** `libs/maia-script/src/engines/style-engine/style.engine.js`

---

## StateEngine

**Purpose:** Interprets state machine definitions (XState-like).

**What it does:**
- Loads state machine definitions from `.state.maia` files
- Creates state machine instances
- Handles state transitions with schema-based guards (JSON Schema validation)
- Executes entry/exit actions
- Processes events (`send('EVENT_NAME')`)
- Supports side effects (invoke, after delays)
- **Deterministic**: Only one state at a time, sequential transitions

**Key Methods:**
- `loadStateDef(stateRef)` - Load state definition
- `createMachine(stateDef, actor)` - Create state machine instance
- `send(machineId, event, payload)` - Send event to state machine (called only from ActorEngine.processMessages())
- `_evaluateGuard(guard, context, payload, actor)` - Evaluate guard using JSON Schema validation

**Dependencies:**
- `ToolEngine` - For executing actions
- `ValidationEngine` - For schema-based guard evaluation (JSON Schema validation)
- `ActorEngine` - For unified event flow and sequential processing

**Guard Evaluation:**
- Guards use JSON Schema to validate against current state and context
- Guards check conditional logic (should transition happen?), NOT payload validation
- Payload validation happens in ActorEngine BEFORE messages reach the state machine

**Architectural Boundaries:**
- ✅ **ONLY updates state transitions and context** - State machines are the single source of truth for context changes
- ✅ **ONLY calls tools that update state/context** - Tools should update state, not manipulate views
- ❌ **SHOULD NOT manipulate views directly** - No DOM operations, no view manipulation
- ❌ **SHOULD NOT call view manipulation tools** - State machines should not manipulate views directly

**Deterministic State Machines:**
- State machines are deterministic - only ONE state at a time
- Events process sequentially (guarded by ActorEngine)
- No parallel states possible
- Unhandled events are processed and removed (not rejected)
- Sequential processing handled generically - state configs don't need "what if already in state X" logic

**Example:**
```javascript
import { StateEngine } from '@MaiaOS/script';

const stateEngine = new StateEngine(toolEngine, evaluator);

// Load and create state machine
const stateDef = await stateEngine.loadStateDef('co_z...');
const machine = await stateEngine.createMachine(stateDef, actor);

// Send event
stateEngine.sendEvent('actor-123', { type: 'CLICK_BUTTON' });
```

**Source:** `libs/maia-script/src/engines/state-engine/state.engine.js`

---

## ToolEngine

**Purpose:** Executes tools with parameter validation.

**What it does:**
- Registers tools from modules
- Validates tool parameters against schemas
- Executes tool functions
- Supports namespaced tools (`@core/noop`, `@db/query`)

**Key Methods:**
- `registerTool(namespacePath, toolId, options)` - Register a tool
- `executeTool(toolId, payload, actor)` - Execute a tool
- `getTool(toolId)` - Get tool definition

**Dependencies:**
- `ModuleRegistry` - For module access

**Example:**
```javascript
import { ToolEngine } from '@MaiaOS/script';

const toolEngine = new ToolEngine(moduleRegistry);

// Execute a tool
const result = await toolEngine.executeTool(
  '@db/query',
  { schema: '@schema/todos', filter: { completed: false } },
  actor
);
```

**Source:** `libs/maia-script/src/engines/tool-engine/tool.engine.js`

---

## Tool Call Architecture

**CRITICAL PRINCIPLE:** **100% State Machine Pattern - All tool calls MUST flow through state machines.**

---

# 01 DETAIL

*Source: developers/engines/01-detail.md*

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

## DBEngine

**Purpose:** Unified database operation router (extends shared operations layer).

**What it does:**
- Extends `DBEngine` from `@MaiaOS/operations` with MaiaScript evaluator support
- Routes operations to modular handlers
- Supports operations: `read`, `create`, `update`, `delete`, `seed`
- Works with swappable backends (IndexedDB, CoJSON CRDT)
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
import { DBEngine, IndexedDBBackend } from '@MaiaOS/script';

const backend = new IndexedDBBackend();
await backend.init();
const dbEngine = new DBEngine(backend);

// Read (unified API - always returns reactive store)
const store = await dbEngine.execute({
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
const newTodo = await dbEngine.execute({
  op: 'create',
  schema: 'co_zTodos123',
  data: { text: 'Buy milk', completed: false }
});

// Update with MaiaScript expression (maia-script specific)
const updated = await dbEngine.execute({
  op: 'update',
  schema: 'co_zTodos123',
  id: 'co_zTodo456',
  data: {
    done: { $not: '$existing.done' }  // Toggle using MaiaScript
  }
});
```

**Important:** 
- All schemas must be co-ids (`co_z...`). Human-readable IDs (`@schema/...`) are transformed to co-ids during seeding.
- The `DBEngine` in `maia-script` extends the shared `DBEngine` from `@MaiaOS/operations` to add MaiaScript evaluator support.
- Operations are implemented in `@MaiaOS/operations` and shared across all backends.

**Dependencies:**
- `@MaiaOS/operations` - Shared operations layer (DBEngine, operations, ReactiveStore)
- `Evaluator` - For expression evaluation in updates

**Source:** 
- `libs/maia-script/src/engines/db-engine/db.engine.js` - maia-script wrapper
- `libs/maia-operations/src/engine.js` - Shared DBEngine implementation
- `libs/maia-operations/src/operations/` - Shared operation implementations

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
- `DBEngine` - For read operations (unified `read()` API)
- `ActorEngine` - For triggering re-renders and loading configs
- `ViewEngine` - For view subscriptions
- `StyleEngine` - For style/brand subscriptions
- `StateEngine` - For state machine subscriptions

**Important:** This engine directly updates actor context for reactive query objects. This is the ONLY exception to the rule that state machines are the single source of truth for context changes.

---

# 02 REFERENCE

*Source: developers/engines/02-reference.md*

**Config Reactivity:**
When config CRDTs change (view, style, state, etc.), SubscriptionEngine automatically:
- Updates caches
- Updates actor properties (`actor.viewDef`, `actor.machine`, etc.)
- Triggers re-renders
- Reloads stylesheets (for style changes)
- Recreates state machines (for state changes)

**Source:** `libs/maia-script/src/engines/subscription-engine/subscription.engine.js`

**See also:** [subscriptions.md](./subscriptions.md) - Detailed subscription architecture documentation

---

## ModuleRegistry

**Purpose:** Central plugin system for MaiaScript extensions.

**What it does:**
- Registers modules dynamically
- Provides module discovery
- Stores module configuration
- Manages module lifecycle

**Key Methods:**
- `registerModule(name, module, config)` - Register a module
- `getModule(name)` - Get module by name
- `loadModule(name)` - Dynamically load a module
- `listModules()` - List all registered modules

**Example:**
```javascript
import { ModuleRegistry } from '@MaiaOS/script';

const registry = new ModuleRegistry();

// Register a module
registry.registerModule('myModule', MyModuleClass, {
  version: '1.0.0',
  description: 'My custom module'
});

// Load a module dynamically
await registry.loadModule('db');
```

**Source:** `libs/maia-script/src/engines/ModuleRegistry.js`

---

## MessageQueue

**Purpose:** Resilient message queue with persistence and retry.

**What it does:**
- Queues messages for actors
- Persists messages to localStorage (survives page refresh)
- Retries failed messages with exponential backoff
- Maintains dead letter queue for failed messages
- Guarantees message ordering

**Key Methods:**
- `enqueue(message)` - Add message to queue
- `getStats()` - Get queue statistics
- `clear()` - Clear queue (testing/cleanup)

**Features:**
- Persistent storage (localStorage)
- Retry mechanism (max 5 retries)
- Dead letter queue
- At-least-once delivery semantics

**Source:** `libs/maia-script/src/engines/message-queue/message.queue.js`

---

---

## Separation of Concerns

**CRITICAL ARCHITECTURAL PRINCIPLE:** Each engine has a single, well-defined responsibility. Engines should NOT cross boundaries into other engines' responsibilities.

### Event Flow

```
User Action (DOM Event)
  ↓
ViewEngine.handleEvent() - Extracts DOM values, resolves expressions
  ↓
ActorEngine.sendInternalEvent() - Routes to actor's inbox
  ↓
ActorEngine.processMessages() - Processes inbox sequentially
  ↓
StateEngine.send() - Triggers state machine transition
  ↓
StateEngine._executeTransition() - Executes actions
  ↓
StateEngine._executeActions() - Updates context via updateContextCoValue()
  ↓
Context CoValue updated (CRDT)
  ↓
ReactiveStore subscription triggers
  ↓
ViewEngine.render() - Re-renders view reactively
```

### Engine Responsibilities

**StateEngine:**
- ✅ Updates state transitions
- ✅ Updates context (single source of truth)
- ✅ Executes guards and actions
- ❌ Should NOT manipulate views directly
- ❌ Should NOT call view manipulation tools

**ViewEngine:**
- ✅ Renders DOM from context reactively
- ✅ Sends events (never updates context directly)
- ✅ Handles DOM manipulation reactively
- ✅ Resolves ALL expressions before sending to inbox (only resolved values)
- ❌ Should NOT update context directly
- ❌ Should NOT trigger state transitions directly
- ❌ Should NOT contain conditional logic (`$if`, `$eq`, ternary operators)
- ❌ Should NOT contain DSL operations (views are dumb templates)

**ActorEngine:**
- ✅ Orchestrates actors and engines
- ✅ Routes messages (inbox → state machine)
- ✅ Schedules rerenders
- ❌ Should NOT update state transitions directly
- ❌ Should NOT manipulate views directly

**Context:**
- ✅ Holds current state (ReactiveStore)
- ✅ Updated ONLY by state machines via `updateContext` actions
- ✅ Read reactively by views
- ❌ Should NOT be mutated directly outside state machines

### Common Violations to Avoid

**❌ State Machine Manipulating View:**
```json
// BAD - State machine should not manipulate views directly
{
  "actions": [
    { "tool": "@some/viewManipulationTool", "payload": {} }
  ]
}
```

**✅ Correct Pattern - Views Handle UI Reactively:**
```json
// GOOD - Views react to context changes, no direct manipulation needed
// State machine computes boolean flags, view references them
{
  "tag": "input",
  "value": "$inputValue",
  "attrs": {
    "data": {
      "hasError": "$hasError"  // State machine computed this flag, view just references it
    }
  }
}
// CSS handles styling: input[data-has-error="true"] { border-color: red; }
```

**❌ View Updating Context Directly:**
```json
// BAD - View updating context
{
  "$on": {
    "click": { "updateContext": { "isOpen": true } }
  }
}
```

**✅ Correct Pattern - View Sends Event:**
```json
// GOOD - View sends event, state machine updates context
{
  "$on": {
    "click": { "send": "OPEN_MODAL" }
  }
}
```

---

## Related Documentation

- [Main README](./README.md) - Package overview
- [modules.md](./modules.md) - Module system details
- [expressions.md](./expressions.md) - MaiaScript expressions
- [api-reference.md](./api-reference.md) - Complete API reference

---

# README

*Source: developers/engines/README.md*

# Engine Documentation

1. **[00-overview.md](./00-overview.md)** - Engine overview
2. **[01-detail.md](./01-detail.md)** - Engine details
3. **[02-reference.md](./02-reference.md)** - Reference

---

# EXPRESSIONS

*Source: developers/expressions.md*

# MaiaScript Expressions

MaiaScript expressions are JSON-based and evaluated safely by `MaiaScriptEvaluator`.

---

## Expression Syntax

**Basic Syntax:**
```json
{
  "$operation": [arguments...]
}
```

---

## Supported Operations

### Data Access

- `$context` - Access context data: `{ "$context": "title" }`
- `$item` - Access item data (in loops): `{ "$item": "id" }`
- `$` - Shortcut: `"$title"` = `{ "$context": "title" }`
- `$$` - Shortcut: `"$$id"` = `{ "$item": "id" }`

### Comparison

- `$eq` - Equal: `{ "$eq": ["$context.status", "active"] }`
- `$neq` - Not equal: `{ "$neq": ["$context.status", "inactive"] }`
- `$gt` - Greater than: `{ "$gt": ["$context.count", 10] }`
- `$gte` - Greater than or equal
- `$lt` - Less than
- `$lte` - Less than or equal

### Logical

- `$and` - Logical AND: `{ "$and": [{ "$eq": ["$context.status", "active"] }, { "$gt": ["$context.count", 0] }] }`
- `$or` - Logical OR
- `$not` - Logical NOT

### Control Flow

- `$if` - Conditional: `{ "$if": { "condition": { "$eq": ["$context.status", "active"] }, "then": "green", "else": "gray" } }`
- `$switch` - Switch statement

### String

- `$concat` - Concatenate strings
- `$trim` - Trim whitespace: `{ "$trim": "$$text" }` (removes leading/trailing whitespace from string)
- `$toLowerCase` - Convert to lowercase
- `$toUpperCase` - Convert to uppercase

### Date

- `$formatDate` - Format date

### Array

- `$length` - Get array length
- `$includes` - Check if array includes value
- `$map` - Map over array
- `$filter` - Filter array

### Math

- `$add` - Add numbers
- `$subtract` - Subtract numbers
- `$multiply` - Multiply numbers
- `$divide` - Divide numbers

---

## Expression Validation

Expressions are validated against `maia-script-expression` schema before evaluation:

```javascript
// Validation happens automatically
const evaluator = new MaiaScriptEvaluator();
await evaluator.evaluate(expression, data);
// Throws if expression is invalid
```

---

## Security

- **Sandboxed** - Only whitelisted operations allowed
- **Depth limits** - Maximum recursion depth (default: 50) prevents DoS
- **Schema validation** - Expressions validated before evaluation
- **No code execution** - Pure JSON, no JavaScript execution

---

## Examples

### Basic Conditional

```json
{
  "$if": {
    "condition": { "$eq": ["$context.status", "active"] },
    "then": "green",
    "else": "gray"
  }
}
```

### Complex Logic

```json
{
  "$if": {
    "condition": {
      "$and": [
        { "$eq": ["$context.status", "active"] },
        { "$gt": ["$context.count", 0] }
      ]
    },
    "then": "visible",
    "else": "hidden"
  }
}
```

### Array Operations

```json
{
  "$map": {
    "array": "$context.items",
    "as": "item",
    "do": { "$item": "name" }
  }
}
```

---

## Related Documentation

- [Main README](./README.md) - Package overview
- [engines/](./engines/) - MaiaScriptEvaluator details
- [api-reference.md](./api-reference.md) - API reference
- [patterns.md](./patterns.md) - Common patterns

---

# MODULES

*Source: developers/modules.md*

# Module System

Modules are plugins that extend MaiaOS functionality. They register tools and provide configuration.

---

## What Are Modules?

Modules are plugins that extend MaiaOS functionality. They register tools and provide configuration.

**Module Structure:**
```javascript
export class MyModule {
  static async register(registry) {
    const toolEngine = getToolEngine(registry, 'MyModule');
    
    // Register tools
    await registerToolsFromRegistry(registry, toolEngine, 'mymodule', ['tool1', 'tool2'], '@mymodule');
    
    // Register module config
    registerModuleConfig(registry, 'mymodule', MyModule, {
      version: '1.0.0',
      description: 'My module description',
      namespace: '@mymodule',
      tools: ['@mymodule/tool1', '@mymodule/tool2']
    });
  }
  
  static query(query) {
    // Return module configuration
    return null;
  }
}

export async function register(registry) {
  return await MyModule.register(registry);
}
```

---

## Available Modules

### db.module.js

**Purpose:** Database operations module.

**Tools:**
- `@db` - Unified database operations

**Usage:**
```javascript
// Tools are automatically available after module loads
// Use in state machines or views:
{
  tool: '@db',
  payload: {
    op: 'read',
    schema: 'co_zTodos123'  // Schema co-id (co_z...)
  }
}

// read() always returns a reactive store
const store = await os.db({op: 'read', schema: 'co_zTodos123'});
console.log('Current todos:', store.value);
store.subscribe((todos) => {
  console.log('Todos updated:', todos);
});
```

---

### core.module.js

**Purpose:** Core UI tools module.

**Tools:**
- `@core/noop` - No-operation (for testing)
- `@core/preventDefault` - Prevent default events
- `@core/publishMessage` - Publish messages to subscribed actors

---

### dragdrop.module.js

**Purpose:** Drag-and-drop functionality module.

**Tools:**
- `@dragdrop/start` - Start drag operation
- `@dragdrop/end` - End drag operation
- `@dragdrop/drop` - Handle drop
- `@dragdrop/dragEnter` - Handle drag enter
- `@dragdrop/dragLeave` - Handle drag leave

**Configuration:**
```javascript
// Access module config
const config = registry.getModule('dragdrop').query('config');
```

---

## Creating Custom Modules

### Step 1: Create Module File

Create `libs/maia-script/src/modules/mymodule.module.js`:

```javascript
import { getToolEngine, registerToolsFromRegistry, registerModuleConfig } from '../utils/module-registration.js';

export class MyModule {
  static async register(registry) {
    const toolEngine = getToolEngine(registry, 'MyModule');
    
    const toolNames = ['tool1', 'tool2'];
    
    await registerToolsFromRegistry(registry, toolEngine, 'mymodule', toolNames, '@mymodule');
    
    registerModuleConfig(registry, 'mymodule', MyModule, {
      version: '1.0.0',
      description: 'My custom module',
      namespace: '@mymodule',
      tools: toolNames.map(t => `@mymodule/${t}`)
    });
  }
  
  static query(query) {
    return null;
  }
}

export async function register(registry) {
  return await MyModule.register(registry);
}
```

### Step 2: Create Tools

Create tools in `@MaiaOS/tools` package (see `@MaiaOS/tools` documentation).

### Step 3: Load Module

Load module during boot:

```javascript
const os = await MaiaOS.boot({
  modules: ['db', 'core', 'mymodule'] // Add your module
});
```

---

## Module Registration Utilities

Modules use shared utilities from `module-registration.js`:

- `getToolEngine(registry, moduleName)` - Get ToolEngine from registry
- `registerToolsFromRegistry(registry, toolEngine, moduleName, toolNames, namespace)` - Register tools
- `registerModuleConfig(registry, moduleName, ModuleClass, config)` - Register module config

These utilities ensure consistent module registration patterns across all modules.

---

## Related Documentation

- [Main README](./README.md) - Package overview
- [engines/](./engines/) - Engine details
- [api-reference.md](./api-reference.md) - API reference
- [patterns.md](./patterns.md) - Common patterns

---

# PATTERNS

*Source: developers/patterns.md*

# Common Patterns and Troubleshooting

Common usage patterns and solutions to frequent problems.

---

## Common Patterns

### Pattern 1: Custom Module with Tools

```javascript
// 1. Create module
export class MyModule {
  static async register(registry) {
    const toolEngine = getToolEngine(registry, 'MyModule');
    await registerToolsFromRegistry(registry, toolEngine, 'mymodule', ['tool1'], '@mymodule');
    registerModuleConfig(registry, 'mymodule', MyModule, {
      version: '1.0.0',
      description: 'My module',
      namespace: '@mymodule',
      tools: ['@mymodule/tool1']
    });
  }
}

// 2. Create tools in @MaiaOS/tools package
// 3. Load module during boot
```

---

### Pattern 2: Custom Expression Evaluator

```javascript
const evaluator = new MaiaScriptEvaluator(null, {
  maxDepth: 100,
  validateExpressions: true
});

// Use in custom context
const result = await evaluator.evaluate(expression, { context: myData });
```

---

### Pattern 3: Direct Database Access

```javascript
const backend = new IndexedDBBackend();
await backend.init();
const dbEngine = new DBEngine(backend);

// Use read() API (always returns reactive store)
const store = await dbEngine.execute({
  op: 'read',
  schema: 'co_zMySchema123'  // Schema co-id (co_z...)
});

// Store has current value
console.log('Current data:', store.value);

// Subscribe to updates
const unsubscribe = store.subscribe((data) => {
  console.log('Data updated:', data);
});
```

---

## Troubleshooting

### Problem: Expression evaluation fails

**Solution:** Check expression syntax and validation:

```javascript
// ❌ Wrong - invalid syntax
{ "$if": { "condition": true } } // Missing 'then' and 'else'

// ✅ Correct
{ "$if": { "condition": true, "then": "yes", "else": "no" } }
```

---

### Problem: Module not loading

**Solution:** Check module registration:

```javascript
// Ensure module exports register function
export async function register(registry) {
  return await MyModule.register(registry);
}

// Ensure module is in boot config
const os = await MaiaOS.boot({
  modules: ['mymodule'] // Add your module
});
```

---

### Problem: Tool not found

**Solution:** Check tool registration:

```javascript
// Ensure tool is registered in module
await registerToolsFromRegistry(registry, toolEngine, 'mymodule', ['mytool'], '@mymodule');

// Ensure tool exists in @MaiaOS/tools package
// Check namespace path matches: 'mymodule/mytool' → '@mymodule/mytool'
```

---

### Problem: Expression depth exceeded

**Solution:** Increase depth limit or simplify expression:

```javascript
// Increase depth limit
const evaluator = new MaiaScriptEvaluator(null, {
  maxDepth: 100 // Default is 50
});

// Or simplify nested expressions
```

---

## Related Documentation

- [Main README](./README.md) - Package overview
- [engines/](./engines/) - Engine details
- [modules.md](./modules.md) - Module system
- [expressions.md](./expressions.md) - Expression language
- [api-reference.md](./api-reference.md) - API reference

---

# README

*Source: developers/README.md*

# maia-script: Execution Engines and Modules

## Overview

The `@MaiaOS/script` package provides the reusable execution components that power MaiaOS. Think of it as the factory floor where all the work happens - engines process your definitions, modules provide tools, and utilities handle common tasks.

**What it is:**
- ✅ **Execution engines** - Process actors, views, styles, state machines, and tools
- ✅ **Module system** - Plugin architecture for extending functionality
- ✅ **MaiaScript evaluator** - Evaluates JSON-based expressions safely
- ✅ **Utilities** - Shared helpers for config loading, path resolution, etc.

**What it isn't:**
- ❌ **Not the kernel** - Boot process is in `@MaiaOS/kernel`
- ❌ **Not tool definitions** - Tools are in `@MaiaOS/tools`
- ❌ **Not schemas** - Schema validation is in `@MaiaOS/schemata`

---

## The Simple Version

Think of `maia-script` like a factory with specialized workers (engines):

- **MaiaScriptEvaluator** = The translator (converts JSON expressions to values)
- **ActorEngine** = The manager (orchestrates everything)
- **ViewEngine** = The painter (renders UI)
- **StyleEngine** = The stylist (compiles CSS)
- **StateEngine** = The conductor (runs state machines)
- **ToolEngine** = The executor (runs tools)
- **DBEngine** = The librarian (manages data)
- **SubscriptionEngine** = The watcher (keeps data in sync)

**Analogy:**
Imagine you're building a house:
- You write blueprints (`.maia` files) - these are your definitions
- The factory workers (engines) read the blueprints and do the work
- Modules are like toolboxes - they provide specialized tools
- The evaluator translates your instructions into actions

---

## Architecture

### Package Structure

```
libs/maia-script/src/
├── engines/              # Core execution engines
│   ├── MaiaScriptEvaluator.js    # Expression evaluator
│   ├── ModuleRegistry.js          # Module loader
│   ├── actor-engine/              # Actor lifecycle
│   ├── view-engine/               # UI rendering
│   ├── style-engine/              # Style compilation
│   ├── state-engine/              # State machines
│   ├── tool-engine/               # Tool execution
│   ├── db-engine/                 # Database operations
│   ├── subscription-engine/       # Reactive subscriptions
│   └── message-queue/             # Message queuing
├── modules/              # Module definitions
│   ├── db.module.js               # Database module
│   ├── core.module.js             # Core UI tools
│   └── dragdrop.module.js         # Drag-and-drop
├── utils/                # Shared utilities
│   ├── module-registration.js     # Module helpers
│   ├── config-loader.js            # Config loading
│   ├── path-resolver.js           # Path resolution
│   ├── html-sanitizer.js          # HTML sanitization
│   └── co-id-validator.js         # Co-ID validation
└── index.js              # Public API exports
```

### Engine Dependencies

```mermaid
graph TD
    ModuleRegistry[ModuleRegistry]
    Evaluator[MaiaScriptEvaluator]
    ToolEngine[ToolEngine]
    StateEngine[StateEngine]
    ViewEngine[ViewEngine]
    StyleEngine[StyleEngine]
    ActorEngine[ActorEngine]
    DBEngine[DBEngine]
    SubscriptionEngine[SubscriptionEngine]
    
    ModuleRegistry --> ToolEngine
    Evaluator --> ToolEngine
    Evaluator --> StateEngine
    Evaluator --> ViewEngine
    ToolEngine --> StateEngine
    ToolEngine --> ActorEngine
    StateEngine --> ActorEngine
    ViewEngine --> ActorEngine
    StyleEngine --> ActorEngine
    DBEngine --> SubscriptionEngine
    SubscriptionEngine --> ActorEngine
    ActorEngine --> ViewEngine
```

**Dependency Flow:**
1. `ModuleRegistry` loads modules and registers tools
2. `MaiaScriptEvaluator` evaluates expressions (used by all engines)
3. `ToolEngine` executes tools (used by StateEngine and ActorEngine)
4. `StateEngine` interprets state machines (used by ActorEngine)
5. `ViewEngine` renders UI (used by ActorEngine)
6. `StyleEngine` compiles styles (used by ActorEngine)
7. `ActorEngine` orchestrates everything
8. `DBEngine` handles data operations
9. `SubscriptionEngine` manages reactive subscriptions (used by ActorEngine)

---

## Documentation Structure

This package documentation is organized into focused topics:

- **[engines/](./engines/)** - Detailed descriptions of all 10 engines
- **[modules.md](./modules.md)** - Module system and creating custom modules
- **[expressions.md](./expressions.md)** - MaiaScript expression language reference
- **[api-reference.md](./api-reference.md)** - Complete API reference
- **[subscriptions-overview.md](./subscriptions-overview.md)** - Subscription architecture
- **[subscriptions-reference.md](./subscriptions-reference.md)** - Config/data details, patterns, troubleshooting
- **[patterns.md](./patterns.md)** - Common patterns and troubleshooting

---

## Quick Start

Here's a simple example of using engines directly:

```javascript
import { MaiaScriptEvaluator } from '@MaiaOS/script';

const evaluator = new MaiaScriptEvaluator();

// Evaluate a simple expression
const result = await evaluator.evaluate(
  { $if: { condition: { $eq: ['$context.status', 'active'] }, then: 'green', else: 'gray' } },
  { context: { status: 'active' } }
);
// Returns: 'green'
```

For full system usage, see the [maia-kernel Package](../02_maia-kernel/README.md).

---

## Related Documentation

- [maia-kernel Package](../02_maia-kernel/README.md) - Boot process and orchestration
- [maia-operations Package](../06_maia-operations/README.md) - Shared database operations layer
- [maia-schemata Package](../03_maia-schemata/README.md) - Schema validation
- [maia-db Package](../05_maia-db/cojson.md) - Database backends
- [DSL Fundamentals](../02_dsl.md) - MaiaScript language reference
- [Engines](../04_engines.md) - High-level engine overview

---

## Source Files

**Package:** `libs/maia-script/`

**Key Files:**
- `src/index.js` - Public API exports
- `src/engines/` - All engine implementations
- `src/modules/` - Module definitions
- `src/utils/` - Shared utilities

**Dependencies:**
- `@MaiaOS/operations` - Shared database operations layer
- `@MaiaOS/tools` - Tool definitions
- `@MaiaOS/schemata` - Schema validation
- `@MaiaOS/db` - Database layer

---

# SUBSCRIPTIONS OVERVIEW

*Source: developers/subscriptions-overview.md*

# Subscription Architecture

## Overview

MaiaOS uses a **decentralized, per-actor subscription system** for end-to-end reactivity. Every actor automatically subscribes to:
1. **Data dependencies** (query objects in context)
2. **Config CRDTs** (view, style, state, interface, context, brand)
3. **Message channels** (subscriptions colist, inbox costream)

When any dependency changes, actors automatically update and re-render.

---

## The Simple Version

Think of subscriptions like automatic notifications. When you tell an actor "watch this data," it automatically gets notified whenever that data changes—like getting a text when someone updates a shared document.

**Data example:**
```javascript
actor.context = {
  todos: { schema: "co_zTodos123", filter: { completed: false } }
}
// SubscriptionEngine subscribes automatically, updates context, triggers re-render
```

**Config example:**
```javascript
actor.config = { view: "co_zView123", style: "co_zStyle456" }
// When view/style CRDTs change → actor updates → re-renders
```

---

## Architecture

### Decentralized Per-Actor Tracking

Each actor tracks its own subscriptions:
- `actor._subscriptions` - Data subscriptions
- `actor._configSubscriptions` - Config subscriptions

**Benefits:** Simple cleanup (actor destruction → unsubscribe all), no centralized registry.

### Unified `read()` API

All data access uses `read()`, which always returns a reactive store:

```javascript
const store = await dbEngine.execute({
  op: 'read',
  schema: "co_zTodos123",
  filter: { completed: false }
});
// store.value - current data
// store.subscribe(callback) - get updates
```

### Co-IDs Only

Runtime code MUST use co-ids (`co_z...`), never human-readable IDs. `ReadOperation` validates this. Human-readable IDs transform to co-ids during seeding.

---

## Lifecycle

**Initialization:** Actor created → SubscriptionEngine.initialize(actor) → subscribes to data + configs.

**Updates:** Store subscription fires → context/config updated → batched re-render scheduled.

**Cleanup:** Actor destroyed → SubscriptionEngine.cleanup(actor) → unsubscribes all.

---

## Related Documentation

- [subscriptions-reference.md](./subscriptions-reference.md) - Config/data details, patterns, troubleshooting
- [engines/](./engines/) - Engine overview
- [api-reference.md](./api-reference.md) - Complete API reference

---

## References

- Source: `libs/maia-script/src/engines/subscription-engine/`
- DB Engine: `libs/maia-script/src/engines/db-engine/`
- Reactive Store: `libs/maia-script/src/utils/reactive-store.js`

---

# SUBSCRIPTIONS REFERENCE

*Source: developers/subscriptions-reference.md*

# Subscription Reference

Detailed reference for config subscriptions, data subscriptions, patterns, and troubleshooting.

---

## Config Subscriptions

### Config Types

SubscriptionEngine subscribes to: `view`, `style`, `brand`, `state`, `interface`, `context`.

### Engine vs Direct Subscriptions

**View/Style/State:** Go through engines (caching, batch subscriptions).

```javascript
await viewEngine.loadView(config.view, (updatedView) => {
  handleViewUpdate(actorId, updatedView);
});
```

**Interface/Context:** Use read() API directly.

```javascript
const store = await dbEngine.execute({
  op: 'read',
  schema: interfaceSchemaCoId,
  key: config.interface
});
store.subscribe((updatedInterface) => handleInterfaceUpdate(actorId, updatedInterface));
```

### Update Handlers

| Config | Handler | Result |
|--------|---------|--------|
| View | `_handleViewUpdate` | Invalidate cache, update viewDef, re-render |
| Style | `_handleStyleUpdate` | Reload stylesheets, update shadowRoot, re-render |
| State | `_handleStateUpdate` | Destroy old machine, create new, re-render |
| Interface | `_handleInterfaceUpdate` | Update interface, re-validate (no re-render) |
| Context | `_handleContextUpdate` | Merge context, re-subscribe queries, re-render |

### Cache Invalidation

View/state updates invalidate caches before applying changes. Caches repopulate on next load.

---

## Data Subscriptions

### Query Objects

Objects in context with `schema` (co-id) and optional `filter`. SubscriptionEngine scans context, subscribes automatically.

```javascript
actor.context = {
  todos: { schema: "co_zTodos123", filter: { completed: false } }
}
```

### Reactive Stores

`read()` always returns ReactiveStore. Properties: `store.value`, `store.subscribe(callback)`.

### CoList Loading

Collection queries auto-load CoLists from IndexedDB before querying. Ensures data available after re-login.

### Deduplication

SubscriptionEngine checks `isSameData()` before updating context to avoid redundant re-renders.

---

## Batching System

Svelte-style microtask batching prevents excessive re-renders. Multiple subscriptions in same tick → one rerender per actor.

**Flow:** `_scheduleRerender(actorId)` → add to `pendingRerenders` Set → queueMicrotask → flush all in batch.

**Usage:** All engines call `_scheduleRerender()` instead of `rerender()` directly.

---

## Runtime Requirements

**Co-IDs only:** Runtime MUST use `co_z...`, never `@schema/...`. ReadOperation validates.

**Unified read():** All data access via `read()` → returns ReactiveStore. Single pattern, always reactive.

---

## CRDT-Safe Watermark Pattern

Distributed inboxes (CoStreams) across browsers require watermark to prevent duplicate processing.

**Rule:** Read watermark from persisted config before processing. Update with max(current, new) logic. Prevents duplicate actions when two browsers process same message.

**Implementation:** `ActorEngine.processMessages()` reads persisted watermark. `_persistWatermark()` uses max() logic.

---

## Actor Lifecycle and Cleanup

**Container tracking:** Actors registered with container. `destroyActorsForContainer()` bulk cleanup on vibe unload.

**Automatic cleanup:** `destroyActor()` → `SubscriptionEngine.cleanup()` → unsubscribe all → ReactiveStore auto-cleans backend when last subscriber leaves.

**Flow:** destroyActor → cleanup → unsubscribe → last subscriber leaves → store._unsubscribe() → backend cleanup.

---

## Troubleshooting

### Config Not Updating

Check: `_configSubscriptions` has unsubscribe, co-id valid, handler called, cache invalidated. Fix: Verify initialize(), setEngines(), check console.

### Duplicate Subscriptions

Check: loadView() called multiple times, cleanup on destroy. Fix: initialize() once, cleanup() on destroy.

### Data Not Updating

Check: schema is co-id, `_subscriptions` has unsubscribe, store works. Fix: Verify seeding transforms to co-id, initialize() called, read() succeeds.

### Performance Issues

Check: batching (pendingRerenders), deduplication, cache hit rate. Fix: Verify batching, reduce subscriptions, optimize handlers.

---

## Future: Backend Swap

**Current:** IndexedDB backend with reactive stores.

**Future:** Real CoJSON with `oSubscriptionCache` for deduplication. Multiple actors → one backend subscription. Auto-cleanup after 5s inactivity.

**Migration:** API unchanged. Backend implementation swaps. No actor-level changes.

---

## References

- Config: `libs/maia-script/src/engines/subscription-engine/config-subscriptions.js`
- Data: `libs/maia-script/src/engines/subscription-engine/data-subscriptions.js`
- Handlers: `libs/maia-script/src/engines/subscription-engine/update-handlers.js`
- DB: `libs/maia-script/src/engines/db-engine/operations/read.js`
- Store: `libs/maia-script/src/utils/reactive-store.js`

---

