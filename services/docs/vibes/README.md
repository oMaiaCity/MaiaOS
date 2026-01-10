# MaiaCity Vibes Architecture

**A Jazz-Native, Actor-Based UI System for Building Reactive, Collaborative Applications**

---

## 🎯 Overview

The MaiaCity Vibes architecture is a revolutionary approach to building user interfaces that combines:

- **Jazz-Native Reactivity**: Built on Jazz CoValues for real-time, collaborative data synchronization
- **Actor-Based Architecture**: Each UI component is an autonomous actor with message-passing and inbox
- **Pure Message Passing**: No prop drilling - actors communicate via Jazz-synced message feeds
- **ID-Based Relationships**: Explicit parent-child relationships via CoLists of actor IDs
- **JSON-Driven UI**: Entire UI structure defined in JSON, enabling database-driven interfaces
- **Skill-Based Logic**: Reusable action functions loaded from a central registry
- **Schema-Driven Design**: Entities, relations, and UI components defined by schemas

---

## 📐 Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                     │
│  - Vibes (complete application configurations)          │
│  - Routes & Navigation                                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                      ACTOR LAYER                         │
│  - ActorRenderer (orchestration)                        │
│  - useQuery Hook (Jazz-native queries)  ⭐ NEW          │
│  - Actor Message Processing (per-component logic)       │
│  - CoFeed Inbox (append-only messaging)  ⭐ UPGRADED    │
│  - ID-Based Relationships (explicit hierarchies)        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                      SKILLS LAYER                        │
│  - Direct Skill Execution (no dataStore)  ⭐ UPGRADED   │
│  - Entity Skills (CRUD operations)                      │
│  - Relation Skills (graph operations)                   │
│  - UI Skills (view management)                          │
│  - Domain Skills (business logic)                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                       VIEW LAYER                         │
│  - Composite (layout containers)                        │
│  - Leaf (content nodes)                                 │
│  - Data Path Resolution (queries → UI)  ⭐ NEW          │
│  - JSON-Driven UI Definitions                           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                    JAZZ DATA LAYER                       │
│  - CoValues (CoMap, CoList, CoFeed)                     │
│  - CoState (direct reactive subscriptions)  ⭐ UPGRADED │
│  - Entity & Relation Schemas                            │
│  - Real-Time Sync & Collaboration                       │
└─────────────────────────────────────────────────────────┘

⭐ NEW/UPGRADED: Jazz-Native Architecture
- Direct CoState subscriptions (no local state)
- Proper CoFeed consumption (append-only)
- Skills mutate Jazz directly (UI reacts automatically)
```

---

## ⭐ Jazz-Native Architecture (Latest Upgrades)

The architecture has been upgraded to be fully Jazz-native with direct CoState subscriptions:

### 1. **useQuery Hook - Direct CoState Subscriptions**

```typescript
// Reactive Jazz-native query (no local state!)
const queryResult = useQuery(() => accountCoState, () => 'Human')
const humans = queryResult.entities  // Plain objects, updates automatically
```

**How It Works**:
- Subscribes directly to `account.root.entities` via CoState
- Filters by `@schema` ID (Jazz-native filtering)
- Converts to plain objects for easy UI consumption
- Automatically updates when Jazz data changes

### 2. **Proper CoFeed Consumption Pattern**

```typescript
// Append-only message processing
let processedMessageIds = $state<Set<string>>(new Set())

for (const message of allMessages) {
  if (processedMessageIds.has(message.$jazz.id)) continue
  
  skill.execute(actor, message.payload, accountCoState)
  processedMessageIds.add(message.$jazz.id)  // Mark as consumed
}
```

**Key Benefits**:
- Messages never deleted (append-only CoFeed)
- Process ALL messages (no message loss)
- Consumption tracking prevents duplicates

### 3. **Direct Skill Execution (No DataStore)**

```typescript
// Skills mutate Jazz CoValues directly
execute: async (actor, payload, accountCoState) => {
  const jazzAccount = accountCoState.current
  await createEntityGeneric(jazzAccount, 'Human', payload.data)
  // UI reacts automatically via useQuery - no manual updates!
}
```

**Key Benefits**:
- Skills receive actor reference directly
- Mutate Jazz CoValues (not local state)
- UI subscribes reactively via useQuery
- No intermediate dataStore layer

### 4. **Complete Data Flow**

```
Jazz CoValues → CoState → useQuery → actor.context.queries → View → UI
      ↑                                                            ↓
      └────────────── Skills mutate Jazz ←─────────── User Events
```

See **[ARCHITECTURE_SUMMARY.md](./ARCHITECTURE_SUMMARY.md)** for complete details.

---

## 📚 Documentation Structure

### Core Concepts

1. **[Actors](./actors/README.md)** - Actor-based architecture fundamentals
   - [ActorRenderer](./actors/actor-renderer.md) - Core actor orchestration
   - [Message Passing](./actors/message-passing.md) - Pure message-based communication
   - [ID-Based Relationships](./actors/id-based-relationships.md) - Explicit hierarchies
   - [Message Passing](./actors/message-passing.md) - Per-actor logic

2. **[Skills](./skills/README.md)** - Reusable action functions
   - [Skill Registry](./skills/registry.md) - Centralized skill management
   - [Entity Skills](./skills/entity-skills.md) - CRUD operations
   - [Relation Skills](./skills/relation-skills.md) - Graph operations
   - [UI Skills](./skills/ui-skills.md) - View management
   - [Custom Skills](./skills/custom-skills.md) - Creating your own

3. **[View Layer](./view/README.md)** - JSON-driven UI
   - [Composite](./view/composite.md) - Layout containers
   - [Leaf](./view/leaf.md) - Content nodes
   - [Schema Resolver](./view/schema-resolver.md) - Template system
   - [Container Queries](./view/container-queries.md) - Responsive design

4. **[Jazz Integration](./jazz/README.md)** - Real-time collaborative data
   - [CoValues](./jazz/covalues.md) - Collaborative data structures
   - [CoState](./jazz/costate.md) - Reactive subscriptions
   - [Sync & Persistence](./jazz/sync.md) - Real-time synchronization

5. **[Schemata](./schemata/README.md)** - Type system
   - [Entity Schemas](./schemata/entities.md) - Data entities
   - [Relation Schemas](./schemata/relations.md) - Graph relations
   - [Schema Registry](./schemata/registry.md) - Type management

6. **[Vibes](./vibes/README.md)** - Complete applications
   - [Vibe Structure](./vibes/structure.md) - How vibes are organized
   - [Creating Vibes](./vibes/creating.md) - Build your first vibe
   - [Examples](./vibes/examples.md) - Real-world vibes

---

## 💡 Complete Example: Todo Vibe

The Todo vibe demonstrates the actor-based architecture with multiple view modes (list, kanban, timeline), foreach patterns, and complete CRUD operations.

### Actor Hierarchy

```
todosRootActor (handles SET_VIEW for view mode switching)
├── headerActor (composite container)
│   ├── titleActor (leaf: "Todos")
│   ├── listViewButtonActor (handles SET_VIEW → 'list')
│   ├── kanbanViewButtonActor (handles SET_VIEW → 'kanban')
│   ├── timelineViewButtonActor (handles SET_VIEW → 'timeline')
│   └── clearButtonActor (handles CLEAR_TODOS)
├── inputSectionActor (handles ADD_TODO, UPDATE_INPUT)
│   └── addButtonActor (handles ADD_TODO)
├── listContentActor (handles TOGGLE_TODO, REMOVE_TODO, UPDATE_TODO_TEXT)
│   └── foreach: todos (inline template per item)
├── kanbanContentActor (handles same CRUD actions)
│   └── nested foreach: columns → todos
└── timelineContentActor (handles same CRUD actions)
    └── foreach: timeline groups → todos
```

### Key Patterns Demonstrated

**1. Foreach Pattern for Lists** - Use inline templates instead of creating separate actors per item  
**2. Nested Foreach** - Kanban columns use nested foreach with filter expressions  
**3. True Colocation** - Each interactive element has its own actor with inbox  
**4. Visibility Bindings** - View modes toggle via root context + visibility bindings  
**5. Responsive Design** - Container query classes (`@xs:`, `@sm:`, `@md:`)  
**6. Generic Skills** - Reuse `@entity/*` skills for CRUD operations

See [`services/me/src/lib/vibes/todo/actors/createTodosActors.ts`](../../../services/me/src/lib/vibes/todo/actors/createTodosActors.ts) for full implementation.

---

## 🚀 Quick Start

### 1. Understand the Core Concepts

Start with the **[Actor Architecture](./actors/README.md)** to understand how the system works:

```typescript
// Each UI component is an Actor with:
// - An inbox for receiving messages
// - A list of child actor IDs
// - Subscriptions to other actors
// - Context for local data

const myActor = Actor.create({
  context: { visible: true /* local data */ },
  view: { /* CompositeConfig or LeafNode */ },
  dependencies: { entities: root.entities.$jazz.id },
  inbox: co.feed(ActorMessage).create([]),
  subscriptions: co.list(z.string()).create([]),
  children: co.list(z.string()).create([]),
  role: 'my-actor',
}, group)
```

### 2. Learn Skills

Skills are reusable action functions that mutate Jazz CoValues directly. See **[Skills](./skills/README.md)**:

```typescript
// Skills execute business logic (NEW SIGNATURE)
const mySkill: Skill = {
  metadata: {
    id: '@myapp/doSomething',
    name: 'Do Something',
    description: 'Does something useful',
  },
  execute: async (actor: any, payload?: unknown, accountCoState?: any) => {
    const jazzAccount = accountCoState?.current
    // Mutate Jazz CoValues directly
    await createEntityGeneric(jazzAccount, 'MyEntity', payload.data)
    // UI updates reactively via useQuery - no manual updates needed!
  },
}
```

**Key Change**: Skills now receive `(actor, payload, accountCoState)` instead of `(data, payload)`. They mutate Jazz directly - no intermediate state layer!

### 3. Build Views

Views are JSON-driven UI definitions. See **[View Layer](./view/README.md)**:

```typescript
// Composites are layout containers
const myComposite: CompositeConfig = {
  container: { layout: 'flex', class: 'flex-col gap-4' },
  children: [
    { slot: 'header', leaf: headerLeaf },
    { slot: 'content', leaf: contentLeaf },
  ],
}

// Leafs are content nodes
const myLeaf: LeafNode = {
  tag: 'button',
  classes: 'px-4 py-2 bg-blue-500 text-white rounded',
  events: { click: { event: 'MY_EVENT', payload: { id: 'item.id' } } },
  children: ['Click Me'],
}
```

### 4. Create a Vibe

Vibes combine everything. See **[Creating Vibes](./vibes/creating.md)**:

```typescript
// Create actors with ID-based relationships
const parentActor = Actor.create({ /* ... */ }, group)
const childActor = Actor.create({ /* ... */ }, group)

// Link them explicitly
parentActor.children.$jazz.push(childActor.$jazz.id)

// Set up subscriptions for message passing
childActor.subscriptions.$jazz.push(parentActor.$jazz.id)
```

---

## 🎨 Key Principles

### 1. **Jazz-Native Everything**

All data is stored in Jazz CoValues, enabling real-time sync and collaboration:

```typescript
// Entities, relations, actors - all Jazz CoValues
const human = Human.create({ name: 'Alice', email: 'alice@example.com' }, group)
const actor = Actor.create({ /* ... */ }, group)
```

### 2. **Pure Message Passing (Append-Only CoFeed)**

No prop drilling. Actors communicate via messages pushed to Jazz CoFeed inboxes:

```typescript
// Actor sends message (append-only)
targetActor.inbox.$jazz.push(
  ActorMessage.create({ 
    type: 'DELETE_ITEM', 
    payload: { id: '123' },
    from: actorId,
    timestamp: Date.now(),
  })
)

// Actor receives and processes (proper consumption pattern)
let processedMessageIds = $state<Set<string>>(new Set())

$effect(() => {
  // Collect ALL unprocessed messages from CoFeed
  for (const message of allMessages) {
    const messageId = message.$jazz?.id
    if (processedMessageIds.has(messageId)) continue
    
    // Call skill directly
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
- **Append-only**: Messages persist for event history
- **No message loss**: Process ALL messages, not just latest
- **Collaborative**: Message history syncs across devices

### 3. **ID-Based Relationships**

Explicit parent-child relationships via actor ID lists:

```typescript
// Parent explicitly lists children
parentActor.children.$jazz.push(childActor1.$jazz.id)
parentActor.children.$jazz.push(childActor2.$jazz.id)

// O(1) lookup, no filtering needed
const childActors = Array.from(parentActor.children).map(id => loadActor(id))
```

### 4. **Each Actor Handles Its Own Events**

No event bubbling. Each actor processes its own events:

```typescript
// ✅ GOOD: List actor handles its own delete events
const listActor = Actor.create({
  context: {
    visible: true,
    queries: { items: { schemaName: 'Item', items: [] } }
  },
  // ... no state machine needed
}, group)

// List subscribes to itself
listActor.subscriptions.$jazz.push(listActor.$jazz.id)
```

### 5. **Skills for Business Logic (Direct Execution)**

All business logic is in reusable skills - they mutate Jazz CoValues directly:

```typescript
// UI triggers skill via message
events: { click: { event: '@entity/deleteEntity', payload: { id: 'item.id' } } }

// Skill mutates Jazz CoValue directly (NEW PATTERN)
const deleteSkill: Skill = {
  execute: async (actor, payload, accountCoState) => {
    const jazzAccount = accountCoState?.current
    await deleteEntityGeneric(jazzAccount, payload.id)
    // Jazz automatically syncs to all clients
    // UI updates reactively via useQuery - no manual updates!
  }
}

// UI subscribes to Jazz data (reactive)
const queryResult = useQuery(() => accountCoState, () => 'Todo')
const todos = queryResult.entities  // Automatically updates when skill mutates Jazz
```

**Key Benefits**:
- **Direct mutations**: Skills mutate Jazz, no intermediate state
- **Reactive UI**: UI subscribes via useQuery, updates automatically
- **No manual updates**: Jazz reactivity handles everything!

---

## 🔑 Core Benefits

### Real-Time Collaboration

Built on Jazz, everything syncs automatically across all clients:

```typescript
// Update once, syncs everywhere
human.name = 'Bob'
await human.$jazz.waitForSync()
// All clients see the change immediately
```

### Explicit Relationships

ID-based relationships make the system explicit and debuggable:

```typescript
// See exactly which actors are children
console.log(Array.from(parentActor.children)) // ['co_z...', 'co_z...']

// Trace message flow through subscriptions
console.log(Array.from(actor.subscriptions)) // ['co_z...']
```

### Clean Architecture

Each actor is self-contained with its own logic:

```typescript
// Actor context is isolated
const actor = Actor.create({
  context: { visible: true /* only this actor's data */ },
  inbox: co.feed(ActorMessage).create([]),
  subscriptions: co.list(z.string()).create([]),
  // ...
}, group)
```

### Database-Driven UIs

Entire UI structure stored in Jazz CoValues:

```typescript
// Load actor hierarchy from database
const rootActorId = vibesRegistry.humans
const rootActor = await loadActor(rootActorId)
// Entire UI tree loads and renders
```

---

## 📖 Next Steps

1. **Start with Actors**: Read **[Actor Architecture](./actors/README.md)** to understand the foundation
2. **Learn Skills**: Explore **[Skills](./skills/README.md)** to see how logic is organized
3. **Build Views**: Study **[View Layer](./view/README.md)** to create UIs
4. **Master Jazz**: Deep dive into **[Jazz Integration](./jazz/README.md)** for real-time sync
5. **Create Vibes**: Follow **[Creating Vibes](./vibes/creating.md)** to build complete applications

---

## 🤝 Contributing

This architecture is designed to be:

- **Extensible**: Add new skills, actors, and vibes easily
- **Composable**: Mix and match components
- **Collaborative**: Built for real-time multi-user applications
- **Future-Proof**: Database-driven, enabling dynamic UI generation

See each sub-section for detailed documentation on contributing to specific areas.

---

## 📝 License

This architecture is part of the MaiaCity project. See the main repository for license information.
