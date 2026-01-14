# Reactive Queries - Technical Architecture

## Overview

The reactive query system provides observable data management through a localStorage-backed ReactiveStore with automatic context updates and actor re-rendering when data changes.

## Architecture Components

### 1. ReactiveStore

**Location:** `libs/maia-script/src/o/engines/ReactiveStore.js`

An observable wrapper around localStorage that implements the observer pattern:

```javascript
class ReactiveStore {
  constructor(storageKey = 'maiaos_data');
  
  // Core CRUD
  getCollection(schema): Array
  setCollection(schema, data): void  // Triggers observers
  
  // Reactive subscriptions
  subscribe(schema, filter, callback): unsubscribe function
  notify(schema): void
  
  // Query operations
  query(schema, filter): Array
}
```

**Key Features:**
- Observer pattern for reactive updates
- JSON-based filtering (eq, ne, gt, lt, gte, lte, in, contains)
- localStorage persistence
- Automatic notification of subscribers
- Memory leak prevention via unsubscribe functions

### 2. Query Tools

**Location:** `libs/maia-script/src/o/tools/query/`

Three tools for interacting with ReactiveStore:

#### @query/subscribe

Reactive subscription to a collection. Context auto-updates when data changes.

```javascript
{
  "tool": "@query/subscribe",
  "payload": {
    "schema": "todos",
    "filter": { "field": "done", "op": "eq", "value": false },
    "target": "todosTodo"
  }
}
```

**Behavior:**
- Immediately calls callback with current data
- Updates actor context when data changes
- Triggers actor re-render automatically
- Stores unsubscribe function in `actor._queryObservers` for cleanup

#### @query/get

One-time (non-reactive) query. Loads data into context once.

```javascript
{
  "tool": "@query/get",
  "payload": {
    "schema": "todos",
    "target": "todos"
  }
}
```

**Use Cases:**
- Initial data loading without reactivity
- Performance optimization (avoid unnecessary updates)
- Static data that doesn't change

#### @query/filter

One-time filtered query. Non-reactive.

```javascript
{
  "tool": "@query/filter",
  "payload": {
    "schema": "todos",
    "filter": { "field": "done", "op": "eq", "value": true },
    "target": "completedTodos"
  }
}
```

**Supported Operators:**
- `eq`: equals (===)
- `ne`: not equals (!==)
- `gt`: greater than (>)
- `lt`: less than (<)
- `gte`: greater than or equal (>=)
- `lte`: less than or equal (<=)
- `in`: value in array
- `contains`: string contains substring

### 3. Mutation Tools

**Location:** `libs/maia-script/src/o/tools/mutation/`

All mutation tools write to ReactiveStore and trigger observer notifications:

```javascript
// OLD (direct context manipulation)
actor.context[schema].push(entity);

// NEW (ReactiveStore with automatic notifications)
const store = actor.actorEngine.reactiveStore;
const collection = store.getCollection(schema);
collection.push(entity);
store.setCollection(schema, collection); // Triggers notify()
```

**Tools:**
- `@mutation/create`: Create new entity
- `@mutation/update`: Update existing entity
- `@mutation/delete`: Delete entity
- `@mutation/toggle`: Toggle boolean field

### 4. ActorEngine Integration

**Location:** `libs/maia-script/src/o/engines/actor-engine/actor.engine.js`

**Initialization:**

```javascript
constructor(styleEngine, viewEngine, moduleRegistry, toolEngine, stateEngine) {
  // ... existing initialization
  this.reactiveStore = new ReactiveStore('maiaos_data');
  console.log('[ActorEngine] ReactiveStore initialized');
}
```

**Actor Creation:**

```javascript
const actor = {
  id: actorId,
  config: actorConfig,
  shadowRoot,
  context,
  containerElement,
  actorEngine: this,
  inbox: actorConfig.inbox || [],
  subscriptions: actorConfig.subscriptions || [],
  inboxWatermark: actorConfig.inboxWatermark || 0,
  _queryObservers: []  // For cleanup
};
```

**Actor Destruction:**

```javascript
destroyActor(actorId) {
  const actor = this.actors.get(actorId);
  if (actor) {
    // Cleanup query observers
    if (actor._queryObservers && actor._queryObservers.length > 0) {
      actor._queryObservers.forEach(unsubscribe => unsubscribe());
      actor._queryObservers = [];
    }
    // ... rest of cleanup
  }
}
```

## Data Flow

### Reactive Subscription Flow

```
1. State Machine Entry Action
   └─> @query/subscribe tool
       └─> ReactiveStore.subscribe(schema, filter, callback)
           ├─> Store observer in observers Map
           ├─> Immediately call callback with current data
           │   └─> Update actor.context[target]
           │       └─> Trigger actor.rerender()
           └─> Return unsubscribe function
               └─> Store in actor._queryObservers

2. Data Mutation
   └─> @mutation/* tool
       └─> ReactiveStore.setCollection(schema, data)
           ├─> Save to localStorage
           └─> ReactiveStore.notify(schema)
               └─> Call all observer callbacks
                   └─> Update actor.context[target]
                       └─> Trigger actor.rerender()
```

### Example: Todo App

**Root Actor (vibe_root):**
- Creates todos via `@mutation/create`
- Publishes `TODO_CREATED` message to children

**Child Actor (todo_list):**
- Subscribes to entire `todos` collection
- Automatically updates when any todo changes

**Child Actor (kanban_view):**
- Subscribes to filtered `todos` (done: false)
- Subscribes to filtered `todos` (done: true)
- Each filter updates independently

```javascript
// State machine entry for kanban_view
"loading": {
  "entry": [
    {
      "tool": "@query/subscribe",
      "payload": {
        "schema": "todos",
        "filter": { "field": "done", "op": "eq", "value": false },
        "target": "todosTodo"
      }
    },
    {
      "tool": "@query/subscribe",
      "payload": {
        "schema": "todos",
        "filter": { "field": "done", "op": "eq", "value": true },
        "target": "todosDone"
      }
    }
  ],
  "on": {
    "SUCCESS": "idle"
  }
}
```

## Memory Management

### Observer Cleanup

Observers are automatically cleaned up when actors are destroyed:

```javascript
// Automatic cleanup in ActorEngine.destroyActor()
if (actor._queryObservers && actor._queryObservers.length > 0) {
  actor._queryObservers.forEach(unsubscribe => unsubscribe());
  actor._queryObservers = [];
}
```

### Preventing Memory Leaks

1. **Unsubscribe functions:** Every `subscribe()` call returns an unsubscribe function
2. **Tracked observers:** All observers are stored in `actor._queryObservers`
3. **Cascading cleanup:** When an actor is destroyed, all its query observers are unsubscribed
4. **Parent-child cleanup:** Destroying a parent actor automatically destroys child actors and their observers

## Performance Considerations

### Filtered Queries

Filtered queries only notify relevant subscribers:

```javascript
// Only actors subscribed to "done: false" will be notified
store.subscribe('todos', { field: 'done', op: 'eq', value: false }, callback);
```

### localStorage Limits

- **Size Limit:** ~5-10MB per domain
- **Performance:** Synchronous read/write (fast for small datasets)
- **Recommendation:** Use localStorage for prototyping, migrate to Jazz CRDTs for production

### Optimization Tips

1. **Use filtered subscriptions:** Only subscribe to the data you need
2. **Minimize re-renders:** Use `@query/get` for static data
3. **Batch mutations:** Group multiple mutations when possible
4. **Clear cache:** Use `ReactiveStore.clear()` for testing

## Testing

### Unit Tests

**Location:** `libs/maia-script/src/o/engines/ReactiveStore.test.js`

Tests cover:
- CRUD operations
- Observer subscriptions and notifications
- Filter operations (all operators)
- Memory cleanup
- Edge cases (corrupted data, empty collections, multiple filters)

### Running Tests

```bash
bun test libs/maia-script/src/o/engines/ReactiveStore.test.js
```

### Mock localStorage

For Bun tests, a localStorage mock is required:

```javascript
class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  clear() { this.store = {}; }
  getItem(key) { return this.store[key] || null; }
  setItem(key, value) { this.store[key] = String(value); }
  removeItem(key) { delete this.store[key]; }
}

global.localStorage = new LocalStorageMock();
```

## Migration Path to Jazz CRDTs

This reactive architecture is designed to be compatible with Jazz's reactive patterns:

### Similarities

- **Observable/reactive patterns:** Jazz CoMaps are reactive by default
- **Subscription-based updates:** Jazz auto-syncs between clients
- **JSON-based queries:** Jazz queries are also declarative
- **Collection-based organization:** Jazz uses CoLists and CoMaps

### Migration Steps

1. Replace `ReactiveStore` with Jazz `Group`
2. Replace `@query/subscribe` with Jazz `useCoState()` equivalent
3. Replace `@mutation/*` tools with Jazz CoMap mutations
4. localStorage becomes Jazz's CRDT sync layer (automatic)
5. No changes to tool interfaces required!

### Example Migration

```javascript
// BEFORE (ReactiveStore)
const store = actor.actorEngine.reactiveStore;
const todos = store.getCollection('todos');

// AFTER (Jazz)
const group = actor.actorEngine.jazzGroup;
const todos = group.todos; // Reactive CoList
```

## Debugging

### Enable Logging

ReactiveStore and query tools include console.log statements:

```javascript
console.log('[query/subscribe] Subscribing actor_001 to todos (filtered) → context.todosTodo');
console.log('[query/subscribe] Updated actor_001.context.todosTodo with 3 items');
```

### Inspect Observers

```javascript
const store = actorEngine.reactiveStore;
console.log(store.getObservers()); // Map of schema -> Set<observer>
```

### Check localStorage

```javascript
console.log(localStorage.getItem('maiaos_data'));
// {"todos":[{"id":"1","text":"Test","done":false}]}
```

### Verify Actor Observers

```javascript
const actor = actorEngine.actors.get('actor_todo_list_001');
console.log(actor._queryObservers.length); // Number of active subscriptions
```

## Best Practices

1. **Always subscribe in loading state:** Use state machine entry actions
2. **Clean filters:** Keep filter logic simple and predictable
3. **Use filtered subscriptions:** Avoid subscribing to entire collections when you only need a subset
4. **Test with empty data:** Ensure views handle empty arrays gracefully
5. **Document data flow:** Use comments to explain which actors subscribe to which data
6. **Avoid circular dependencies:** Don't create subscription loops
7. **Profile re-renders:** Monitor actor re-render frequency in production
8. **Prepare for Jazz:** Structure code to make Jazz migration straightforward

## API Reference

### ReactiveStore

```typescript
class ReactiveStore {
  constructor(storageKey: string = 'maiaos_data')
  
  getCollection(schema: string): Array
  setCollection(schema: string, data: Array): void
  subscribe(schema: string, filter: Object | null, callback: Function): Function
  notify(schema: string): void
  query(schema: string, filter: Object | null): Array
  clear(): void
  getObservers(): Map
}
```

### Query Tools

```typescript
// @query/subscribe
{
  schema: string,      // Required
  filter?: {           // Optional
    field: string,
    op: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains',
    value: any
  },
  target: string       // Required
}

// @query/get
{
  schema: string,      // Required
  target: string       // Required
}

// @query/filter
{
  schema: string,      // Required
  filter: {            // Required
    field: string,
    op: string,
    value: any
  },
  target: string       // Required
}
```

### Mutation Tools

```typescript
// @mutation/create
{
  schema: string,      // Required
  data: Object         // Required
}

// @mutation/update
{
  schema: string,      // Required
  id: string,          // Required
  data: Object         // Required
}

// @mutation/delete
{
  schema: string,      // Required
  id: string           // Required
}

// @mutation/toggle
{
  schema: string,      // Required
  id: string,          // Required
  field?: string       // Optional, defaults to 'done'
}
```

## Summary

The reactive query system provides:
- **Automatic context updates:** No manual refresh needed
- **Observable localStorage:** Single source of truth
- **JSON-configured queries:** Extensible filter syntax
- **Memory-safe:** Automatic observer cleanup
- **Jazz-ready:** Clean migration path to CRDTs

This foundation enables building reactive, data-driven applications while maintaining clean separation between data management and UI rendering.
