# Data Subscriptions

## Overview

Data subscriptions automatically keep actor context in sync with database queries. When you define a query object in an actor's context, SubscriptionEngine automatically subscribes to that data and updates the context whenever it changes.

**Think of it like:** Setting up a Google Doc notification - whenever someone edits the document, you get notified automatically.

---

## The Simple Version

Query objects in actor context automatically create reactive subscriptions:

```javascript
actor.context = {
  todos: {
    schema: "co_zTodos123",  // Which data to watch
    filter: { completed: false }  // Filter criteria
  }
}

// SubscriptionEngine automatically:
// 1. Uses read() API to get reactive store
// 2. Subscribes to store updates
// 3. Updates actor.context.todos when data changes
// 4. Triggers re-render so UI updates
```

---

## How It Works

### Query Objects

Query objects are simple objects in actor context that tell SubscriptionEngine what data to watch:

```javascript
{
  schema: "co_zTodos123",  // Schema co-id (co_z...)
  filter: { completed: false }  // Optional filter criteria
}
```

**Detection:**
- SubscriptionEngine scans `actor.context` for objects with `schema` property
- If `schema` is a string starting with `co_z`, it's a query object
- Query objects are automatically subscribed to

### Subscription Process

1. **Scan Context:**
   ```javascript
   // SubscriptionEngine.initialize(actor) scans context
   for (const [key, value] of Object.entries(actor.context)) {
     if (value && typeof value === 'object' && value.schema) {
       // Found query object!
     }
   }
   ```

2. **Use read() API:**
   ```javascript
   // read() always returns reactive store
   const store = await dbEngine.execute({
     op: 'read',
     schema: value.schema,  // co_zTodos123
     filter: value.filter || null
   });
   ```

3. **Subscribe to Store:**
   ```javascript
   // Subscribe to store updates
   const unsubscribe = store.subscribe((data) => {
     handleDataUpdate(subscriptionEngine, actor.id, key, data);
   });
   ```

4. **Store Unsubscribe Function:**
   ```javascript
   // Store for cleanup when actor is destroyed
   actor._subscriptions.push(unsubscribe);
   ```

### Update Handling

When data changes, the store subscription fires:

```javascript
function handleDataUpdate(subscriptionEngine, actorId, contextKey, data) {
  const actor = subscriptionEngine.actorEngine.getActor(actorId);
  if (!actor) return; // Actor may have been destroyed

  // Update context with new data
  actor.context[contextKey] = data;
  
  // Trigger batched re-render
  subscriptionEngine._scheduleRerender(actorId);
}
```

---

## Examples

### Basic Example

```javascript
// Actor context with query object
actor.context = {
  todos: {
    schema: "co_zTodos123",
    filter: { completed: false }
  }
}

// SubscriptionEngine automatically subscribes:
// 1. Calls dbEngine.execute({op: 'read', schema: "co_zTodos123", filter: {...}})
// 2. Gets reactive store
// 3. Subscribes to store updates
// 4. Updates actor.context.todos when data changes
```

### Multiple Queries

```javascript
// Actor can have multiple query objects
actor.context = {
  todos: {
    schema: "co_zTodos123",
    filter: { completed: false }
  },
  notes: {
    schema: "co_zNotes456",
    filter: { archived: false }
  }
}

// SubscriptionEngine subscribes to both automatically
```

### Filtered Queries

```javascript
// Query objects can have filters
actor.context = {
  activeTodos: {
    schema: "co_zTodos123",
    filter: { 
      completed: false,
      priority: 'high'
    }
  }
}

// Only todos matching filter are returned
```

---

## Key Concepts

### Reactive Stores

The `read()` API always returns a `ReactiveStore`:

```javascript
const store = await dbEngine.execute({
  op: 'read',
  schema: "co_zTodos123",
  filter: { completed: false }
});

// Store has current value
console.log('Current:', store.value);  // Array of todos

// Subscribe to updates
const unsubscribe = store.subscribe((data) => {
  console.log('Updated:', data);  // New data when it changes
});
```

**Store Properties:**
- `store.value` - Current data value
- `store.subscribe(callback)` - Subscribe to updates, returns unsubscribe function

### Initial Data

Stores always have initial data loaded immediately:

```javascript
const store = await dbEngine.execute({
  op: 'read',
  schema: "co_zTodos123"
});

// Initial value is available immediately
console.log('Initial todos:', store.value);  // Already loaded!

// Subscribe for future updates
store.subscribe((data) => {
  console.log('Updated:', data);
});
```

### CoList Loading (Backend Implementation)

**Important:** Collection queries (queries that return arrays of items) use CoLists as the single source of truth. The backend automatically loads CoLists from IndexedDB before querying to ensure data is available after re-login.

**How it works:**
1. When `read()` is called for a collection query, the backend resolves the collection name from the schema
2. It gets the CoList ID from `account.data.<collectionName>`
3. It loads the CoList from IndexedDB and waits for it to be available (jazz-tools pattern)
4. Only then does it read items from the CoList and return them in the store

**Why this matters:**
- After re-login, CoLists exist in IndexedDB but aren't loaded into node memory
- Without explicit loading, queries would return empty results initially
- By waiting for CoList to be available, we ensure queries always return correct data

**Example:**
```javascript
// Backend automatically handles CoList loading
const store = await dbEngine.execute({
  op: 'read',
  schema: "co_zTodos123"  // Collection query
});

// Store.value contains all items from CoList (already loaded)
console.log('Todos:', store.value);  // Array of todos, not empty!
```

### Deduplication

SubscriptionEngine checks if data actually changed before updating:

```javascript
function handleDataUpdate(subscriptionEngine, actorId, contextKey, data) {
  const actor = subscriptionEngine.actorEngine.getActor(actorId);
  const oldData = actor.context[contextKey];
  
  // Check if data changed
  if (isSameData(oldData, data)) {
    return; // Skip if unchanged
  }
  
  // Update context
  actor.context[contextKey] = data;
  subscriptionEngine._scheduleRerender(actorId);
}
```

---

## Common Patterns

### Dynamic Queries

Query objects can be updated dynamically:

```javascript
// Initial query
actor.context = {
  todos: {
    schema: "co_zTodos123",
    filter: { completed: false }
  }
}

// Later, update filter
actor.context.todos.filter = { completed: true };

// SubscriptionEngine will re-subscribe automatically
// (handled by context update handler)
```

### Empty Results

Stores handle empty results gracefully:

```javascript
// Query with no results
const store = await dbEngine.execute({
  op: 'read',
  schema: "co_zTodos123",
  filter: { completed: true }  // No completed todos
});

console.log(store.value);  // [] (empty array)

// Subscribe still works - will fire when todos are completed
store.subscribe((data) => {
  console.log('Todos updated:', data);
});
```

---

## Troubleshooting

### Data Not Updating

**Symptoms:** Query object in context but data doesn't update

**Check:**
1. Is schema a co-id? (must start with `co_z`)
2. Is subscription set up? (`actor._subscriptions` has unsubscribe function)
3. Is store subscription working? (check console for errors)

**Fix:**
- Verify schema is transformed to co-id during seeding
- Check that `SubscriptionEngine.initialize()` is called
- Verify `read()` operation succeeds

### Duplicate Updates

**Symptoms:** Same data triggers multiple updates

**Check:**
1. Is deduplication working? (check `isSameData()` function)
2. Are multiple subscriptions to same query?
3. Is batching working? (check `pendingRerenders`)

**Fix:**
- Verify deduplication logic
- Check for duplicate query objects in context
- Ensure batching system is working

---

## CRDT-Safe Watermark Pattern

### Distributed Inbox Message Processing

In a distributed multi-browser scenario, actors share inboxes (CoStreams) across browser instances. To prevent duplicate message processing, MaiaOS uses a CRDT-safe watermark pattern.

**The Problem:**
- Two browser instances can both read the same message timestamp before either updates the watermark
- Both browsers process the message, then both update the watermark
- Result: Message is processed twice (duplicate actions)

**The Solution:**
CRDT-safe max() logic for watermark updates:

```javascript
// Before processing messages, read current watermark from persisted config
const actorConfig = await dbEngine.execute({
  op: 'read',
  schema: actorSchemaCoId,
  key: actorId
});
const currentWatermark = actorConfig.inboxWatermark || 0;

// Only process messages after current watermark
const newMessages = inboxItems.filter(msg => msg.timestamp > currentWatermark);

// When updating watermark, use max() logic
if (newWatermark > currentWatermark) {
  // Only update if new watermark is greater than current
  await dbEngine.execute({
    op: 'update',
    schema: actorSchemaCoId,
    id: actorId,
    data: { inboxWatermark: newWatermark }
  });
}
```

**Key Points:**
- Watermark is always read from persisted config (not just in-memory) before processing
- Watermark updates use max(current, new) logic - only update if new > current
- This ensures that even if two browsers both try to update, the max() logic prevents duplicate processing
- Watermark is stored in actor config CoMap, which is CRDT-based and syncs across browsers

**Implementation:**
- `ActorEngine.processMessages()` reads watermark from persisted config before filtering messages
- `ActorEngine._persistWatermark()` implements CRDT-safe max() logic
- Watermark updates are idempotent - multiple updates with the same value are safe

---

## Related Documentation

- [subscriptions.md](./subscriptions.md) - Subscription overview
- [subscriptions-config.md](./subscriptions-config.md) - Config subscriptions
- [subscriptions-patterns.md](./subscriptions-patterns.md) - Patterns and troubleshooting
- [engines.md](./engines.md) - DBEngine and SubscriptionEngine details

---

## References

- Source: `libs/maia-script/src/engines/subscription-engine/data-subscriptions.js`
- DB Engine: `libs/maia-script/src/engines/db-engine/operations/read.js`
- Reactive Store: `libs/maia-script/src/utils/reactive-store.js`
