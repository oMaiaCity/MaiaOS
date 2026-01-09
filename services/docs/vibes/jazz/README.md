# Jazz Integration

**Real-Time Collaborative Data with CoValues & CoState**

---

## 🎯 Overview

The Hominio Vibes system is built on **Jazz** - a framework for building local-first, collaborative applications. Jazz provides:

- **CoValues** - Collaborative data structures (CoMap, CoList, CoFeed)
- **CoState** - Reactive Svelte subscriptions to CoValues  
- **Real-time sync** - Automatic synchronization across all clients
- **Offline-first** - Works without network, syncs when reconnected
- **End-to-end encryption** - Data encrypted at rest and in transit

---

## 📐 Core Concepts

### CoValues

**Collaborative data structures** that sync automatically:

```typescript
// CoMap - Collaborative object
const human = Human.create({
  name: 'Alice',
  email: 'alice@example.com',
  dateOfBirth: new Date(1990, 0, 1),
}, group)

// CoList - Collaborative array
const todos = TodoList.create([
  todo1,
  todo2,
  todo3,
], group)

// CoFeed - Append-only log
const messages = co.feed(Message).create([
  message1,
  message2,
], group)
```

### CoState (Svelte Integration)

**Reactive subscriptions** to CoValues:

```typescript
import { CoState } from 'jazz-tools/svelte'

// Create reactive subscription
const actorCoState = $derived.by(() => new CoState(Actor, actorId))
const actor = $derived(actorCoState.current)

// Automatically re-renders when actor changes
// No manual subscriptions needed!
```

---

## 🏗️ Data Structures

### CoMap (Objects)

**Collaborative objects** with typed properties:

```typescript
// Define schema
export const Human = co.map({
  name: z.string(),
  email: z.string(),
  dateOfBirth: z.date(),
})

// Create instance
const human = Human.create({
  name: 'Alice',
  email: 'alice@example.com',
  dateOfBirth: new Date(1990, 0, 1),
}, group)

// Update properties
human.name = 'Alice Smith'
await human.$jazz.waitForSync()  // Wait for sync

// Access properties
console.log(human.name)  // 'Alice Smith'
```

### CoList (Arrays)

**Collaborative arrays** with CRDT semantics:

```typescript
// Define schema
export const TodoList = co.list(Todo)

// Create instance
const todos = TodoList.create([], group)

// Add items
todos.$jazz.push(todo1)
todos.$jazz.push(todo2)

// Remove items
todos.$jazz.splice(0, 1)  // Remove first item

// Iterate
for (const todo of todos) {
  console.log(todo.text)
}

// Array methods
const todoArray = Array.from(todos)
```

### CoFeed (Append-Only Logs)

**Append-only logs** for messages, events, history:

```typescript
// Define schema
export const ActorMessage = co.map({
  type: z.string(),
  payload: co.json<unknown>(),
  from: z.string(),
  timestamp: z.number(),
})

// Create feed
const inbox = co.feed(ActorMessage).create([], group)

// Add messages (append-only, never delete)
inbox.$jazz.push(ActorMessage.create({
  type: 'DELETE_ITEM',
  payload: { id: '123' },
  from: 'actor-id',
  timestamp: Date.now(),
}))

// Read latest message
const latest = inbox.byMe?.value  // Latest from current account
```

---

## 🔄 Reactivity in Svelte

### Basic CoState Usage

```typescript
<script lang="ts">
  import { CoState } from 'jazz-tools/svelte'
  import { Actor } from '@maia/db'
  
  const actorId = 'co_z...'
  
  // Create reactive subscription
  const actorCoState = $derived.by(() => new CoState(Actor, actorId))
  const actor = $derived(actorCoState.current)
</script>

{#if actor?.$isLoaded}
  <div>Actor: {actor.role}</div>
{:else}
  <div>Loading...</div>
{/if}
```

### Loading Nested Data

```typescript
// Load with nested resolution
const actorCoState = $derived.by(() => 
  new CoState(Actor, actorId, {
    resolve: {
      inbox: true,
      children: true,
      subscriptions: true,
    }
  })
)
```

### Manual Loading

```typescript
// Ensure data is loaded
const loadedActor = await actor.$jazz.ensureLoaded({
  resolve: {
    inbox: true,
    children: true,
  }
})

// Check if loaded
if (actor?.$isLoaded) {
  // Safe to access properties
}
```

### Jazz-Native Entity Queries (useQuery)

**The `useQuery` hook provides reactive subscriptions to Jazz entities** - no local state, just direct CoState subscriptions:

```typescript
import { useQuery } from '../compositor/useQuery.svelte'

// Reactive query - subscribes directly to Jazz CoState
const queryResult = useQuery(
  () => accountCoState,      // Jazz account (reactive)
  () => 'Human',             // Schema name to query
  {                          // Optional query options
    filter: { status: 'active' },
    sort: { field: 'name', order: 'asc' },
    limit: 10
  }
)

// Access results - automatically updates when Jazz data changes
const humans = queryResult.entities  // Plain JavaScript objects
const isLoading = queryResult.isLoading
const loadingState = queryResult.loadingState
```

**How useQuery Works (Jazz-Native Architecture)**:

```typescript
// 1. Direct CoState subscription to entities
const entities = $derived.by(() => {
  const account = accountCoState.current     // CoState.current (reactive)
  const root = account.root                  // Direct CoValue access
  const entitiesList = root.entities         // CoList subscription ✅
  const schemata = root.schemata            // CoList subscription ✅
  
  // 2. Find target schema by name
  let targetSchemaId: string | null = null
  for (const schema of schemata) {
    const schemaSnapshot = schema.$jazz?.raw?.toJSON()
    if (schemaSnapshot?.name === currentSchemaName) {
      targetSchemaId = schema.$jazz?.id
      break
    }
  }
  
  // 3. Filter entities by @schema ID (Jazz-native filtering)
  const results: any[] = []
  for (const entity of entitiesList) {
    const snapshot = entity.$jazz?.raw?.toJSON()
    if (snapshot?.['@schema'] === targetSchemaId) {
      // 4. Convert to plain object AFTER subscription
      results.push(coValueToPlainObject(entity))
    }
  }
  
  return results
})
```

**Key Benefits**:
- 🔥 **Jazz-native reactivity**: Direct CoState subscriptions
- 🚀 **Automatic sync**: Changes propagate across all devices
- 📦 **No local state**: All data comes from Jazz CoValues
- 🎯 **Plain objects**: UI gets simple objects, no `$isLoaded` checks needed
- ⚡ **Reactive**: `$derived.by()` re-evaluates when Jazz data changes

**Actor Integration**:

```typescript
// Actor declares its data needs
const listActor = Actor.create({
  context: {
    queries: {
      humans: {
        schemaName: 'Human',  // What data we need
        items: []             // Populated by useQuery
      }
    }
  },
  view: {
    foreach: {
      items: 'queries.humans.items',  // Data path to array
      // ...
    }
  }
}, group)

// ActorRenderer resolves queries automatically
const schemaName = $derived.by(() => {
  const queries = actor.context?.queries
  return Object.values(queries)[0]?.schemaName || ''
})

const queryResult = useQuery(() => accountCoState, () => schemaName)

// Populate context (derived, doesn't mutate Jazz)
const resolvedContext = $derived.by(() => ({
  ...actor.context,
  queries: {
    humans: {
      ...actor.context.queries.humans,
      items: queryResult.entities  // Plain objects
    }
  }
}))
```

---

## 🎨 Actor Integration

### Actor as CoValue

```typescript
export const Actor = co.map({
  currentState: z.string(),
  states: co.json<ActorStates>(),
  context: co.json<Record<string, unknown>>(),
  view: co.json<unknown>(),
  dependencies: co.json<Record<string, string>>(),
  inbox: co.feed(ActorMessage),
  subscriptions: co.list(z.string()),
  children: co.list(z.string()),
  role: z.string(),
})

// Create actor (Jazz CoValue)
const actor = Actor.create({
  currentState: 'idle',
  states: { idle: {} },
  context: {},
  view: { /* ... */ },
  dependencies: {},
  inbox: co.feed(ActorMessage).create([]),
  subscriptions: co.list(z.string()).create([]),
  children: co.list(z.string()).create([]),
  role: 'my-actor',
}, group)

// Jazz automatically syncs to all clients
await actor.$jazz.waitForSync()
```

### Message Passing via CoFeed

```typescript
// Send message to actor inbox
targetActor.inbox.$jazz.push(
  ActorMessage.create({
    type: 'DELETE_ITEM',
    payload: { id: '123' },
    from: sourceActor.$jazz.id,
    timestamp: Date.now(),
  })
)

// Jazz syncs message to all subscribers
// Recipient processes via ActorRenderer
```

### ID-Based Relationships via CoList

```typescript
// Parent explicitly lists children
parentActor.children.$jazz.push(childActor1.$jazz.id)
parentActor.children.$jazz.push(childActor2.$jazz.id)
await parentActor.$jazz.waitForSync()

// Load children
const childIds = Array.from(parentActor.children)
const childActors = childIds.map(id => new CoState(Actor, id))
```

---

## 🔐 Groups & Permissions

### Creating Groups

```typescript
import { Group } from 'jazz-tools'

// Create group for data sharing
const group = Group.create()
group.addMember('everyone', 'reader')  // Public read
await group.$jazz.waitForSync()

// Create CoValues in group
const actor = Actor.create({ /* ... */ }, group)
```

### Permission Levels

- **`admin`** - Full control (add/remove members, delete group)
- **`writer`** - Can edit data
- **`reader`** - Can only read data
- **`everyone`** - Public access (use with caution)

---

## 💾 Data Persistence

### Account Root

All app data stored under account root:

```typescript
export const AppRoot = co.map({
  schemata: co.list(Schema),      // Schema definitions
  entities: co.list(Entity),      // All entities
  relations: co.list(Relation),   // All relations
  actors: co.list(Actor),          // All actors
  vibes: VibesRegistry,            // Vibe registry
})

// Access root
const account = useJazz()
const root = account.root

// Add entity
root.entities.$jazz.push(newEntity)
await root.$jazz.waitForSync()
```

### Migrations

Handle schema changes gracefully:

```typescript
export const AppRoot = co.map(
  {
    schemata: co.list(Schema),
    entities: co.list(Entity),
    relations: co.list(Relation),
    actors: co.list(Actor),
    vibes: VibesRegistry,
  },
  {
    withMigration: (rawRoot: any, migrate: any) => {
      // Migrate legacy data
      if (rawRoot.$jazz.has('oldProperty')) {
        const oldValue = rawRoot.$jazz.get('oldProperty')
        rawRoot.$jazz.set('newProperty', oldValue)
        rawRoot.$jazz.delete('oldProperty')
      }
      return migrate(rawRoot)
    },
  }
)
```

---

## 🔍 Querying Data

### Filter Entities

```typescript
// Load all entities
const entities = account.root.entities

// Filter by schema
const humans = Array.from(entities).filter(entity => {
  const snapshot = entity.$jazz?.raw?.toJSON()
  const schemaId = snapshot?.['@schema']
  const humanSchema = root.schemata.find(s => s.name === 'Human')
  return schemaId === humanSchema?.$jazz?.id
})
```

### useQuery Hook

```typescript
import { useQuery } from '$lib/compositor/useQuery.svelte'

// Query entities reactively
const queryResult = useQuery(
  () => accountCoState,
  () => 'Human',  // Schema name
  undefined       // Options
)

// Access results
const humans = queryResult.entities  // Plain objects, not CoValues
```

---

## 🚀 Real-Time Sync

### Automatic Sync

```typescript
// Update data - syncs automatically
human.name = 'Bob'
await human.$jazz.waitForSync()

// All clients see change immediately
// No manual sync code needed!
```

### Conflict Resolution

Jazz uses CRDTs (Conflict-free Replicated Data Types):

```typescript
// Client A
human.name = 'Alice'

// Client B (simultaneously)
human.name = 'Bob'

// Jazz automatically resolves conflict
// Last-write-wins for most properties
// Deterministic resolution for all conflicts
```

---

## 📚 Related Documentation

- **[CoValues](./covalues.md)** - Deep dive into collaborative data structures
- **[CoState](./costate.md)** - Reactive subscriptions in Svelte
- **[Sync](./sync.md)** - Real-time synchronization details
- **[Actors](../actors/README.md)** - How actors use Jazz
- **[Schemata](../schemata/README.md)** - Data schema definitions

---

## ✅ Best Practices

### 1. Use CoState for Reactivity

```typescript
// ✅ GOOD: Reactive subscription
const actorCoState = $derived.by(() => new CoState(Actor, actorId))
const actor = $derived(actorCoState.current)

// ❌ BAD: Manual loading (misses updates)
const actor = await loadActor(actorId)
```

### 2. Wait for Sync on Critical Paths

```typescript
// ✅ GOOD: Wait for sync before continuing
actor.children.$jazz.push(childId)
await actor.$jazz.waitForSync()

// ❌ BAD: Don't wait (race conditions)
actor.children.$jazz.push(childId)
// Immediate read might miss the change
```

### 3. Check $isLoaded Before Access

```typescript
// ✅ GOOD: Check loaded state
if (actor?.$isLoaded) {
  console.log(actor.role)
}

// ❌ BAD: Access without checking
console.log(actor.role)  // Might error if not loaded
```

### 4. Use Groups for Sharing

```typescript
// ✅ GOOD: Create group for shared data
const group = Group.create()
group.addMember('everyone', 'reader')
const actor = Actor.create({ /* ... */ }, group)

// ❌ BAD: No group (data not shared)
const actor = Actor.create({ /* ... */ })
```

### 5. CoList for Ordered Collections

```typescript
// ✅ GOOD: CoList for arrays
const children = co.list(z.string()).create([])
children.$jazz.push(childId)

// ❌ BAD: Array property (doesn't sync properly)
actor.children = [childId]  // Lost on sync!
```

---

## 🎯 Summary

Jazz Integration provides:

- **Real-time sync** - Automatic across all clients
- **Offline-first** - Works without network
- **Type-safe** - Zod schemas for validation
- **Reactive** - CoState integrates with Svelte
- **Collaborative** - Built-in conflict resolution
- **Encrypted** - End-to-end security

Next: Learn about **[Schemata](../schemata/README.md)** for data modeling.
