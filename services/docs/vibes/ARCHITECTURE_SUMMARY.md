# Vibe Composition Leaf Architecture - Summary

**Pure Jazz-Native, Actor-Based, Message-Passing System**

---

## 🎯 Core Architecture Principles

### 1. **Jazz-Native CoState Queries**

All data access flows directly through Jazz CoState subscriptions - no local state:

```typescript
// Direct CoState subscription
const queryResult = useQuery(() => accountCoState, () => 'Human', options)

// Reactive - automatically updates when Jazz data changes
const humans = queryResult.entities  // Plain JavaScript objects
```

**Key Benefits**:
- 🔥 **Direct subscriptions**: No local state copies
- 🚀 **Automatic sync**: Changes propagate across all devices
- 📦 **Plain objects**: UI gets simple objects, no `$isLoaded` checks
- ⚡ **Reactive**: `$derived.by()` re-evaluates when Jazz data changes

### 2. **Proper CoFeed Consumption Pattern**

Messages are append-only (never deleted), with proper consumption tracking:

```typescript
let processedMessageIds = $state<Set<string>>(new Set())

$effect(() => {
  // Collect ALL messages from CoFeed
  const allMessages = [/* byMe + perAccount */]
  
  // Process each unprocessed message ONCE
  for (const message of allMessages) {
    const messageId = message.$jazz?.id
    if (processedMessageIds.has(messageId)) continue
    
    // Execute skill
    const skill = getSkill(message.type)
    if (skill) {
      skill.execute(actor, message.payload, accountCoState)
    }
    
    // Mark as consumed (append-only - never delete!)
    processedMessageIds.add(messageId)
  }
})
```

**Key Benefits**:
- ✅ **Append-only**: Respects Jazz CoFeed architecture
- 🔄 **No message loss**: Process ALL messages, not just latest
- 📝 **Consumption tracking**: Mark as processed without deleting
- 🤝 **Collaboration-ready**: Messages persist for event history

### 3. **Direct Skill Execution**

Skills receive actor reference directly (no intermediate dataStore):

```typescript
// OLD PATTERN (deprecated):
type SkillFunction = (data: Data, payload?: unknown) => void

// NEW PATTERN (current):
type SkillFunction = (
  actor: any,            // Actor that triggered the skill
  payload?: unknown,     // Event payload
  accountCoState?: any   // Jazz account CoState
) => void | Promise<void>

// Example skill
execute: async (actor, payload, accountCoState) => {
  const jazzAccount = accountCoState?.current
  await createEntityGeneric(jazzAccount, 'Human', entityData)
  // Skill mutates Jazz CoValues directly - UI updates reactively
}
```

**Key Benefits**:
- 🎯 **Direct actor access**: Skills work with actor reference
- 🚫 **No dataStore**: Eliminates intermediate state layer
- 🔄 **Reactive UI**: Skills mutate Jazz, UI subscribes via useQuery
- 🧹 **Clean separation**: Skills = business logic, useQuery = data access

---

## 📐 Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Jazz CoValues (account.root.entities, account.root.schemata)│
└────────────────────┬────────────────────────────────────────┘
                     │ CoState subscription ($derived.by)
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ useQuery Hook                                               │
│ - Subscribes to Jazz entities                               │
│ - Filters by @schema ID                                     │
│ - Converts to plain objects                                 │
└────────────────────┬────────────────────────────────────────┘
                     │ Plain objects
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ actor.context.queries (derived, doesn't mutate Jazz)        │
│ { humans: { schemaName: 'Human', items: [...] } }           │
└────────────────────┬────────────────────────────────────────┘
                     │ Data path resolution
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ View Layer (Composite.svelte / Leaf.svelte)                 │
│ foreach { items: 'queries.humans.items' }                   │
│ bindings: { text: 'item.name' }                             │
└────────────────────┬────────────────────────────────────────┘
                     │ Reactive render
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ UI Display (DOM)                                            │
│ Automatically updates when Jazz data changes                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Actor Architecture

### Actor Structure

```typescript
export const Actor = co.map({
  context: co.json<Record<string, unknown>>(),     // Queries, view state
  view: co.json<unknown>(),                        // CompositeConfig or LeafNode
  dependencies: co.json<Record<string, string>>(), // CoValue IDs
  inbox: co.feed(ActorMessage),                    // Messages (append-only)
  subscriptions: co.list(z.string()),              // Target actor IDs
  children: co.list(z.string()),                   // Child actor IDs
  role: z.string(),                                // For debugging
})
```

### Actor Lifecycle

1. **Creation (Bottom-Up)**
   - Create leaf actors → composite actors → root actor
   - Set up subscriptions after all actors created

2. **Loading (Top-Down)**
   - `ActorRenderer` loads root via CoState
   - Children loaded recursively via ID list

3. **Message Processing**
   - Messages arrive in CoFeed inbox
   - `ActorRenderer` detects via `$effect`
   - Skills executed directly
   - Jazz CoValues mutated
   - UI updates reactively

4. **Rendering**
   - Queries resolved via `useQuery`
   - Context populated (derived)
   - View rendered via `Composite/Leaf`

---

## 🔄 Message Passing

### Event Flow

```typescript
// 1. User clicks button
<button @click={() => handleEvent('DELETE_ITEM', { id: 'item.id' })}>Delete</button>

// 2. ActorRenderer handles event
function handleEvent(event: string, payload?: unknown) {
  const resolvedPayload = resolvePayload(payload)  // 'item.id' → actual ID
  
  // Create message
  const message = ActorMessage.create({
    type: event,
    payload: resolvedPayload,
    from: actorId,
    timestamp: Date.now(),
  })
  
  // Publish to subscribed actors
  for (const subscriberId of actor.subscriptions) {
    const targetActor = getActor(subscriberId)
    targetActor.inbox.$jazz.push(message)
  }
}

// 3. Target actor processes message
$effect(() => {
  for (const message of unprocessedMessages) {
    const skill = getSkill(message.type)
    if (skill) {
      skill.execute(actor, message.payload, accountCoState)
    }
    processedMessageIds.add(message.$jazz.id)
  }
})

// 4. Skill mutates Jazz CoValue
execute: async (actor, payload, accountCoState) => {
  const { id } = payload
  await deleteEntityGeneric(accountCoState.current, id)
  // Jazz automatically syncs to all clients
}

// 5. UI updates reactively
// useQuery detects change → re-evaluates → UI re-renders
```

---

## 📦 Key Components

### 1. useQuery Hook

**Purpose**: Reactive Jazz entity queries

**Location**: `services/me/src/lib/compositor/useQuery.svelte.ts`

**Usage**:
```typescript
const queryResult = useQuery(
  () => accountCoState,
  () => 'Human',
  { filter, sort, limit }
)
```

### 2. ActorRenderer

**Purpose**: Orchestrates actor loading, message processing, query resolution, rendering

**Location**: `services/me/src/lib/compositor/actors/ActorRenderer.svelte`

**Key Features**:
- Jazz-native CoState loading
- Proper CoFeed consumption
- Direct skill execution
- Query resolution via useQuery

### 3. Composite & Leaf Components

**Purpose**: Render view definitions

**Location**: 
- `services/me/src/lib/compositor/view/Composite.svelte`
- `services/me/src/lib/compositor/view/Leaf.svelte`

**Key Features**:
- Data path resolution
- Event handling
- Foreach rendering
- Reactive bindings

### 4. Skills Registry

**Purpose**: Centralized business logic

**Location**: `services/me/src/lib/compositor/skills/`

**Categories**:
- Entity skills: `@entity/createEntity`, `@entity/deleteEntity`, etc.
- Relation skills: `@relation/createRelation`, etc.
- UI skills: `@ui/navigate`, `@ui/updateInput`, etc.
- Domain skills: `@human/createRandom`, etc.

---

## ✅ Best Practices

### 1. Use Jazz-Native Queries

```typescript
// ✅ GOOD: Direct CoState subscription
const queryResult = useQuery(() => accountCoState, () => 'Human')
const humans = queryResult.entities

// ❌ BAD: Local state copy
let humans = $state([])
$effect(() => {
  humans = queryEntities(accountCoState, 'Human')
})
```

### 2. Proper CoFeed Consumption

```typescript
// ✅ GOOD: Append-only, mark as consumed
for (const message of allMessages) {
  if (processedMessageIds.has(message.$jazz.id)) continue
  processSkill(message)
  processedMessageIds.add(message.$jazz.id)
}

// ❌ BAD: Delete messages
inbox.$jazz.splice(0, inbox.length)
```

### 3. Direct Skill Execution

```typescript
// ✅ GOOD: Direct actor reference
skill.execute(actor, payload, accountCoState)

// ❌ BAD: Intermediate dataStore
skill.execute(dataStore.snapshot(), payload)
```

### 4. True Colocation

```typescript
// ✅ GOOD: Actor handles its own events
const listActor = Actor.create({
  states: {
    idle: { on: { DELETE_ITEM: { target: 'idle', actions: ['@entity/deleteEntity'] } } }
  },
  // ...
}, group)
listActor.subscriptions.$jazz.push(listActor.$jazz.id)

// ❌ BAD: Event bubbling
buttonActor.subscriptions.$jazz.push(rootActor.$jazz.id)
```

---

## 🚀 Migration from Old Architecture

### Old Pattern (Deprecated)

```typescript
// OLD: Local state with dataStore
const dataStore = createDataStore(account)

// OLD: Skills mutate local state (deprecated)
execute: (data: Data, payload) => {
  data.todos.push(newTodo)
}

// OLD: Manual UI updates (deprecated)
dataStore.send('UPDATE_TODOS', todos)
```

### New Pattern (Current)

```typescript
// NEW: Direct CoState subscriptions
const queryResult = useQuery(() => accountCoState, () => 'Todo')

// NEW: Skills mutate Jazz CoValues
execute: async (actor, payload, accountCoState) => {
  await createEntityGeneric(accountCoState.current, 'Todo', todoData)
  // UI updates automatically via useQuery
}

// NEW: Reactive UI
// No manual updates - Jazz reactivity handles everything!
```

---

## 📚 Documentation Index

- **[Actors](./actors/README.md)** - Actor architecture, message passing
- **[Jazz Integration](./jazz/README.md)** - CoValues, CoState, useQuery, reactivity
- **[Schemata](./schemata/README.md)** - Type system for entities, relations, UI
- **[Skills](./skills/README.md)** - Business logic, skill categories, custom skills
- **[Vibes](./vibes/README.md)** - Complete applications, vibe structure
- **[View Layer](./view/README.md)** - JSON-driven UI, composite/leaf pattern

---

## 🎯 Summary

The Vibe Composition Leaf Architecture provides:

- **Jazz-Native**: Direct CoState subscriptions, no local state
- **Reactive**: Automatic UI updates when Jazz data changes
- **Scalable**: Pure message passing, no prop drilling
- **Debuggable**: Trace messages through actor subscriptions
- **Collaborative**: Real-time sync across all devices
- **Clean Code**: Each actor handles its own events
- **Append-Only**: Proper CoFeed consumption pattern

**Core Innovation**: Skills mutate Jazz CoValues directly, UI subscribes reactively via useQuery. No intermediate state layer, no manual UI updates - just pure Jazz reactivity! 🎉
