# Hominio Vibes Architecture

**A Jazz-Native, Actor-Based UI System for Building Reactive, Collaborative Applications**

---

## 🎯 Overview

The Hominio Vibes architecture is a revolutionary approach to building user interfaces that combines:

- **Jazz-Native Reactivity**: Built on Jazz CoValues for real-time, collaborative data synchronization
- **Actor-Based Architecture**: Each UI component is an autonomous actor with its own state machine and inbox
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
│  - ActorRenderer (message-passing orchestration)        │
│  - Actor State Machines (per-component logic)           │
│  - Jazz-Native Inbox/Subscriptions (messaging)          │
│  - ID-Based Relationships (explicit hierarchies)        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                      SKILLS LAYER                        │
│  - Skill Registry (centralized action functions)        │
│  - Entity Skills (CRUD operations)                      │
│  - Relation Skills (graph operations)                   │
│  - UI Skills (view management)                          │
│  - Human Skills (domain-specific logic)                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                       VIEW LAYER                         │
│  - Composite (layout containers)                        │
│  - Leaf (content nodes)                                 │
│  - JSON-Driven UI Definitions                           │
│  - Schema-Driven Components                             │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                    JAZZ DATA LAYER                       │
│  - CoValues (CoMap, CoList, CoFeed)                     │
│  - CoState (reactive subscriptions)                     │
│  - Entity & Relation Schemas                            │
│  - Real-Time Sync & Collaboration                       │
└─────────────────────────────────────────────────────────┘
```

---

## 📚 Documentation Structure

### Core Concepts

1. **[Actors](./actors/README.md)** - Actor-based architecture fundamentals
   - [ActorRenderer](./actors/actor-renderer.md) - Core actor orchestration
   - [Message Passing](./actors/message-passing.md) - Pure message-based communication
   - [ID-Based Relationships](./actors/id-based-relationships.md) - Explicit hierarchies
   - [State Machines](./actors/state-machines.md) - Per-actor logic

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

## 🚀 Quick Start

### 1. Understand the Core Concepts

Start with the **[Actor Architecture](./actors/README.md)** to understand how the system works:

```typescript
// Each UI component is an Actor with:
// - Its own state machine
// - An inbox for receiving messages
// - A list of child actor IDs
// - Subscriptions to other actors

const myActor = Actor.create({
  currentState: 'idle',
  states: { idle: { on: { CLICK: { target: 'idle', actions: ['@ui/doSomething'] } } } },
  context: { /* local data */ },
  view: { /* CompositeConfig or LeafNode */ },
  dependencies: { entities: root.entities.$jazz.id },
  inbox: co.feed(ActorMessage).create([]),
  subscriptions: co.list(z.string()).create([]),
  children: co.list(z.string()).create([]),
  role: 'my-actor',
}, group)
```

### 2. Learn Skills

Skills are reusable action functions. See **[Skills](./skills/README.md)**:

```typescript
// Skills execute business logic
const mySkill: Skill = {
  metadata: {
    id: '@myapp/doSomething',
    name: 'Do Something',
    description: 'Does something useful',
  },
  execute: async (data: Data, payload?: unknown) => {
    // Your logic here
  },
}
```

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

### 2. **Pure Message Passing**

No prop drilling. Actors communicate via messages pushed to inboxes:

```typescript
// Actor sends message
targetActor.inbox.$jazz.push(
  ActorMessage.create({ type: 'DELETE_ITEM', payload: { id: '123' } })
)

// Actor receives and processes
$effect(() => {
  if (latestInboxMessage) {
    dataStore.send(latestInboxMessage.type, latestInboxMessage.payload)
  }
})
```

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
  states: {
    idle: { on: { REMOVE_ITEM: { target: 'idle', actions: ['@entity/deleteEntity'] } } }
  },
  // ...
}, group)

// List subscribes to itself
listActor.subscriptions.$jazz.push(listActor.$jazz.id)
```

### 5. **Skills for Business Logic**

All business logic is in reusable skills, not in UI code:

```typescript
// UI triggers skill via message
events: { click: { event: 'DELETE_ITEM', payload: { id: 'item.id' } } }

// Skill handles the logic
const deleteSkill: Skill = {
  execute: async (data, payload) => {
    await deleteEntityGeneric(account, payload.id)
  }
}
```

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
// Actor state machine is isolated
const actor = Actor.create({
  currentState: 'idle',
  states: { /* only this actor's states */ },
  context: { /* only this actor's data */ },
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

This architecture is part of the Hominio project. See the main repository for license information.
