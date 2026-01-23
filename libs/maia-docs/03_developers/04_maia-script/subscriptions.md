# Subscription Architecture

## Overview

MaiaOS uses a **decentralized, per-actor subscription system** for end-to-end reactivity. Every actor automatically subscribes to:
1. **Data dependencies** (query objects in context)
2. **Config CRDTs** (view, style, state, interface, context, brand)
3. **Message channels** (subscriptions colist, inbox costream)

When any dependency changes, actors automatically update and re-render.

---

## Architecture

### Decentralized Per-Actor Tracking

**Each actor tracks its own subscriptions:**

```javascript
actor._subscriptions = [unsubscribe1, unsubscribe2, ...];      // Data subscriptions
actor._configSubscriptions = [unsubscribe1, unsubscribe2, ...]; // Config subscriptions
```

**Benefits:**
- Simple cleanup (actor destruction → unsubscribe all)
- No centralized subscription registry needed
- Backend handles deduplication (future: `oSubscriptionCache`)

### Backend Abstraction

**Current Backend (Mocked IndexedDB):**
- `IndexedDBBackend` in `libs/maia-script/src/engines/db-engine/backend/indexeddb.js`
- Observer pattern: `this.observers = new Map()`
- Each subscription creates separate observer
- No centralized deduplication (that's future)

**Future Backend (Real CoJSON):**
- `maia-db` with `oSubscriptionCache`
- Centralized deduplication (multiple actors → one backend subscription)
- Automatic cleanup after 5 seconds
- **NOT part of this refactor** - defer to backend swap

---

## Subscription Types

### 1. Data Subscriptions

**Trigger:** Query objects in actor context

**Pattern:**
```javascript
actor.context = {
  todos: {
    schema: "co_z...",  // Schema co-id (co_z...)
    filter: { completed: false }
  }
}
```

**How it works:**
1. `SubscriptionEngine.initialize(actor)` scans context
2. Finds query objects (`{schema: "co_z...", filter: {...}}`)
3. Subscribes via `dbEngine.execute({op: 'query', schema, filter, callback})`
4. Updates `actor.context[key]` when data changes
5. Triggers batched re-render

**Example:**
```javascript
// Context has query object
actor.context = {
  todos: { schema: "co_zTodos123", filter: { done: false } }
}

// SubscriptionEngine automatically:
// 1. Subscribes to todos matching filter
// 2. Updates actor.context.todos when data changes
// 3. Triggers re-render
```

**Source:** `SubscriptionEngine._subscribeToContext()`

---

### 2. Config Subscriptions

**Trigger:** Config CRDTs referenced in actor config

**Configs subscribed to:**
- `view` - View definition CRDT
- `style` - Style definition CRDT
- `brand` - Brand style CRDT
- `state` - State machine definition CRDT
- `interface` - Interface definition CRDT
- `context` - Base context CRDT (not query objects)

**How it works:**
1. `SubscriptionEngine.initialize(actor)` calls `_subscribeToConfig(actor)`
2. Scans `actor.config` for config co-ids
3. Subscribes to each config CRDT via engine's `loadView()`/`loadStyle()`/etc.
4. When config changes, handler updates actor and triggers re-render

**Example:**
```javascript
// Actor config references view co-id
actor.config = {
  view: "co_zView123",
  style: "co_zStyle456"
}

// SubscriptionEngine automatically:
// 1. Subscribes to view CRDT
// 2. Subscribes to style CRDT
// 3. When view changes → updates actor.viewDef → re-renders
// 4. When style changes → reloads stylesheets → re-renders
```

**Source:** `SubscriptionEngine._subscribeToConfig()`

---

### 3. Message Subscriptions

**Trigger:** Subscriptions colist and inbox costream

**How it works:**
1. `ActorEngine.createActor()` loads subscriptions/inbox
2. Sets up subscriptions via `subscribeConfig()`
3. Updates `actor.subscriptions` and `actor.inbox` arrays when they change
4. Stored in `actor._configSubscriptions`

**Example:**
```javascript
// Actor config references subscriptions colist
actor.config = {
  subscriptions: "co_zSubscriptions789"
}

// ActorEngine automatically:
// 1. Loads subscriptions colist
// 2. Subscribes to changes
// 3. Updates actor.subscriptions array when colist changes
```

**Source:** `ActorEngine.createActor()` (lines 245-279)

---

## Subscription Lifecycle

### Initialization

**When:** Actor is created

**Process:**
1. `ActorEngine.createActor()` creates actor
2. Loads configs (view, style, state, etc.) - one-time load
3. Calls `SubscriptionEngine.initialize(actor)`
4. `SubscriptionEngine` subscribes to:
   - Data (query objects in context)
   - Configs (view, style, state, interface, context, brand)
5. Subscriptions stored in `actor._subscriptions` and `actor._configSubscriptions`

**Code:**
```javascript
// In ActorEngine.createActor()
if (this.subscriptionEngine) {
  await this.subscriptionEngine.initialize(actor);
}
```

---

### Updates

**Data Updates:**
- Subscription callback fires with new data
- `SubscriptionEngine._handleDataUpdate()` updates `actor.context[key]`
- Batched re-render scheduled

**Config Updates:**
- Subscription callback fires with new config
- Handler updates actor property (`actor.viewDef`, `actor.machine`, etc.)
- Cache invalidated/updated
- Batched re-render scheduled

**Message Updates:**
- Subscription callback fires with new colist/costream
- `ActorEngine` updates `actor.subscriptions` or `actor.inbox`
- Message processing triggered (if needed)

---

### Cleanup

**When:** Actor is destroyed

**Process:**
1. `ActorEngine.destroyActor()` called
2. Calls `SubscriptionEngine.cleanup(actor)`
3. Unsubscribes all data subscriptions (`actor._subscriptions`)
4. Unsubscribes all config subscriptions (`actor._configSubscriptions`)
5. Removes from pending re-renders

**Code:**
```javascript
// In ActorEngine.destroyActor()
if (this.subscriptionEngine) {
  this.subscriptionEngine.cleanup(actor);
}
```

---

## Config Update Handlers

### View Update

**Handler:** `SubscriptionEngine._handleViewUpdate()`

**What happens:**
1. Invalidates view cache
2. Updates `actor.viewDef = newViewDef`
3. Triggers re-render

**Code:**
```javascript
_handleViewUpdate(actorId, newViewDef) {
  const actor = this.actorEngine.getActor(actorId);
  if (!actor) return;
  
  // Invalidate cache
  this.viewEngine.viewCache.delete(actor.config.view);
  
  // Update actor
  actor.viewDef = newViewDef;
  
  // Re-render
  this._scheduleRerender(actorId);
}
```

---

### Style Update

**Handler:** `SubscriptionEngine._handleStyleUpdate()`

**What happens:**
1. Cache already updated by `loadStyle()` subscription callback
2. Reloads stylesheets via `styleEngine.getStyleSheets()`
3. Updates `actor.shadowRoot.adoptedStyleSheets`
4. Triggers re-render

**Code:**
```javascript
async _handleStyleUpdate(actorId, newStyleDef) {
  const actor = this.actorEngine.getActor(actorId);
  if (!actor) return;
  
  // Reload stylesheets
  const styleSheets = await this.styleEngine.getStyleSheets(actor.config);
  actor.shadowRoot.adoptedStyleSheets = styleSheets;
  
  // Re-render
  this._scheduleRerender(actorId);
}
```

---

### State Update

**Handler:** `SubscriptionEngine._handleStateUpdate()`

**What happens:**
1. Invalidates state cache
2. Destroys old state machine
3. Creates new state machine from updated definition
4. Triggers re-render

**Code:**
```javascript
async _handleStateUpdate(actorId, newStateDef) {
  const actor = this.actorEngine.getActor(actorId);
  if (!actor || !this.stateEngine) return;
  
  // Invalidate cache
  this.stateEngine.stateCache.delete(actor.config.state);
  
  // Destroy old machine
  if (actor.machine) {
    this.stateEngine.destroyMachine(actor.machine.id);
  }
  
  // Create new machine
  actor.machine = await this.stateEngine.createMachine(newStateDef, actor);
  
  // Re-render
  this._scheduleRerender(actorId);
}
```

---

### Interface Update

**Handler:** `SubscriptionEngine._handleInterfaceUpdate()`

**What happens:**
1. Updates `actor.interface = newInterfaceDef`
2. Re-validates interface (non-blocking)
3. **No re-render** (interface only affects message validation)

**Code:**
```javascript
async _handleInterfaceUpdate(actorId, newInterfaceDef) {
  const actor = this.actorEngine.getActor(actorId);
  if (!actor) return;
  
  // Update interface
  actor.interface = newInterfaceDef;
  
  // Re-validate (non-blocking)
  await this.actorEngine.toolEngine.execute('@interface/validateInterface', actor, {
    interfaceDef: newInterfaceDef,
    actorId
  });
}
```

---

### Context Update

**Handler:** `SubscriptionEngine._handleContextUpdate()`

**What happens:**
1. Merges new context with existing context
2. Re-subscribes to query objects (handles new queries)
3. Triggers re-render

**Code:**
```javascript
async _handleContextUpdate(actorId, newContext) {
  const actor = this.actorEngine.getActor(actorId);
  if (!actor) return;
  
  // Merge contexts
  const existingContext = actor.context || {};
  actor.context = { ...existingContext, ...newContext };
  
  // Re-subscribe to query objects
  await this._subscribeToContext(actor);
  
  // Re-render
  this._scheduleRerender(actorId);
}
```

---

## Batching System

**Purpose:** Prevent excessive re-renders when multiple subscriptions fire simultaneously

**How it works:**
1. Multiple subscriptions fire → multiple `_scheduleRerender()` calls
2. `_scheduleRerender()` adds actor ID to `pendingRerenders` Set
3. Schedules microtask if not already scheduled
4. Microtask flushes all pending re-renders in one batch
5. Each actor re-renders once

**Code:**
```javascript
_scheduleRerender(actorId) {
  this.pendingRerenders.add(actorId);
  
  if (!this.batchTimer) {
    this.batchTimer = queueMicrotask(() => {
      this._flushRerenders();
    });
  }
}

_flushRerenders() {
  const actorIds = Array.from(this.pendingRerenders);
  this.pendingRerenders.clear();
  
  for (const actorId of actorIds) {
    this.actorEngine.rerender(actorId);
  }
}
```

---

## Cache Invalidation

**Current Approach (Temporary):**
- Engines maintain caches (`viewCache`, `stateCache`, etc.)
- Config subscription callbacks update caches automatically
- Handlers explicitly invalidate caches before updates
- Caches repopulated on next load

**Future Approach (Backend Swap):**
- Backend handles caching automatically
- No engine-level caches needed
- Config changes automatically propagate via CRDT subscriptions

**Cache Update Flow:**
1. Config CRDT changes
2. Subscription callback fires
3. Engine's `loadView()`/`loadStyle()` callback updates cache
4. Handler invalidates cache (redundant but explicit)
5. Handler updates actor and triggers re-render
6. Re-render calls `loadView()` again → cache repopulated

---

## Runtime Code Requirements

### Co-IDs Only

**Rule:** Runtime code MUST use co-ids (`co_z...`), NEVER human-readable IDs (`@schema/...`)

**Enforcement:**
- `QueryOperation` validates: `if (schema.startsWith('@schema/')) throw new Error(...)`
- `IndexedDBBackend.get()` validates: `if (!schema.startsWith('co_z')) throw new Error(...)`

**Why:**
- Human-readable IDs are transformed to co-ids during seeding
- Runtime code operates on CRDTs directly (co-ids are CRDT identifiers)
- Backend swap will use real cojson (co-ids are native)

---

### All Queries Are Subscriptions

**Rule:** Every query MUST have a callback (subscription), no one-time queries

**Enforcement:**
- `config-loader.js` uses `subscribeConfig()` (always requires callback)
- `QueryOperation` requires callback for reactive queries
- One-time queries removed from codebase

**Why:**
- End-to-end reactivity requires subscriptions
- Configs are runtime-editable (need subscriptions)
- Data is reactive (need subscriptions)

---

## Subscription Pattern

### Config Subscription Pattern

```javascript
// Get schema co-id (must be co-id, not @schema/...)
const viewSchemaCoId = await dbEngine.getSchemaCoId('view');

// Subscribe to config CRDT
const { config: viewDef, unsubscribe } = await subscribeConfig(
  dbEngine,
  viewSchemaCoId,  // co-id (co_z...)
  actorConfig.view,  // co-id of config
  'view',
  (updatedView) => {
    // Handle update
    actor.viewDef = updatedView;
    actorEngine.rerender(actorId);
  }
);

// Store for cleanup
actor._configSubscriptions.push(unsubscribe);
```

---

### Data Subscription Pattern

```javascript
// Query object in context
actor.context = {
  todos: {
    schema: "co_zTodos123",  // Schema co-id
    filter: { completed: false }
  }
}

// SubscriptionEngine automatically subscribes:
const unsubscribe = await dbEngine.execute({
  op: 'query',
  schema: "co_zTodos123",
  filter: { completed: false },
  callback: (data) => {
    // Updates actor.context.todos automatically
    actor.context.todos = data;
    subscriptionEngine._scheduleRerender(actorId);
  }
});

// Stored in actor._subscriptions
actor._subscriptions.push(unsubscribe);
```

---

## Future: Backend Swap

**Current:** Mocked IndexedDB backend
**Future:** Real CoJSON CRDT backend

**Changes:**
- Backend will use `oSubscriptionCache` for deduplication
- Multiple actors subscribing to same CRDT → one backend subscription
- Automatic cleanup after 5 seconds of inactivity
- No engine-level caches needed (backend handles caching)

**Migration:**
- Subscription API stays the same (`dbEngine.execute({op: 'query', ...})`)
- Backend implementation swaps
- No actor-level code changes needed

---

## Troubleshooting

### Config Not Updating

**Symptoms:** Config CRDT changes but actor doesn't update

**Check:**
1. Is subscription set up? (`actor._configSubscriptions` has unsubscribe function)
2. Is config co-id valid? (starts with `co_z`)
3. Is handler being called? (add logging to handler)
4. Is cache being invalidated? (check cache before/after)

**Fix:**
- Verify `SubscriptionEngine.initialize()` is called
- Verify engines are set (`subscriptionEngine.setEngines()`)
- Check console for subscription errors

---

### Duplicate Subscriptions

**Symptoms:** Multiple subscriptions to same config

**Check:**
1. Is `loadView()` called multiple times with `onUpdate`?
2. Are subscriptions cleaned up properly?
3. Is `_subscribeToConfig()` called multiple times?

**Fix:**
- Ensure `initialize()` is only called once per actor
- Ensure `cleanup()` is called when actor is destroyed
- Check for duplicate `loadView()` calls

---

### Performance Issues

**Symptoms:** Too many re-renders, laggy UI

**Check:**
1. Is batching working? (check `pendingRerenders` size)
2. Are subscriptions deduplicated? (check backend)
3. Are caches being used? (check cache hit rate)

**Fix:**
- Verify batching system is working
- Check for unnecessary subscriptions
- Optimize handlers (avoid heavy work in callbacks)

---

## Related Documentation

- [engines.md](./engines.md) - Engine overview (includes SubscriptionEngine)
- [api-reference.md](./api-reference.md) - Complete API reference
- [patterns.md](./patterns.md) - Common patterns and best practices
