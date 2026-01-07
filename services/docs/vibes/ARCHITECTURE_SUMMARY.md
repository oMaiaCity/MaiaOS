# Hominio Vibes Architecture Summary

**Quick Reference for the Complete System**

---

## 🎯 Core Architecture

The Hominio Vibes system is built on **5 core layers**:

```
Application Layer (Vibes)
    ↓
Actor Layer (Message Passing)
    ↓
Skills Layer (Business Logic)
    ↓
View Layer (UI Rendering)
    ↓
Jazz Layer (Collaborative Data)
```

---

## 📚 Documentation Index

### 1. [Main README](./README.md)
- **Overview** of the entire architecture
- **Quick start** guide
- **Key principles** and benefits
- **Navigation** to all sub-docs

### 2. [Actors](./actors/README.md)
- **Actor-based architecture** fundamentals
- **Message passing** (no prop drilling)
- **ID-based relationships** (explicit hierarchies)
- **State machines** per component
- **ActorRenderer** orchestration

**Key Concept**: Each UI component (composite or leaf) is its own actor with a state machine, inbox, and child list.

### 3. [Skills](./skills/README.md)
- **Skill registry** and types
- **Entity skills** (CRUD operations)
- **Relation skills** (graph operations)
- **UI skills** (view management)
- **Custom skills** (domain logic)

**Key Concept**: All business logic is in reusable skills, referenced by ID in state machines.

### 4. [View Layer](./view/README.md)
- **Composite** (layout containers)
- **Leaf** (content nodes)
- **Container queries** (responsive design)
- **Schema resolver** (design system)
- **JSON-driven UI** definitions

**Key Concept**: Entire UI structure defined in JSON, with composites providing space and leaves adapting to it.

### 5. [Jazz Integration](./jazz/README.md)
- **CoValues** (CoMap, CoList, CoFeed)
- **CoState** (reactive subscriptions)
- **Real-time sync** across clients
- **Offline-first** architecture
- **End-to-end encryption**

**Key Concept**: All data is stored in Jazz CoValues, enabling automatic real-time collaboration.

### 6. [Schemata](./schemata/README.md)
- **Entity schemas** (data models)
- **Relation schemas** (graph connections)
- **Leaf schemas** (UI templates)
- **Composite schemas** (layout templates)
- **Schema registry** and CRUD

**Key Concept**: Unified type system for data and UI, stored as Jazz CoValues.

### 7. [Vibes](./vibes/README.md)
- **Complete applications** combining all layers
- **Actor hierarchies** (bottom-up creation)
- **Subscription setup** (message routing)
- **Registry integration** (vibe discovery)
- **Examples** and patterns

**Key Concept**: A vibe is a complete, self-contained application built with actors, skills, views, and data.

---

## 🔑 Key Principles

### 1. Jazz-Native Everything
All data is Jazz CoValues for real-time sync and collaboration.

### 2. Pure Message Passing
No prop drilling. Actors communicate via messages pushed to Jazz CoFeed inboxes.

### 3. ID-Based Relationships
Parents explicitly list child actor IDs in CoLists for O(1) lookup and clarity.

### 4. Each Actor Handles Its Own Events
No event bubbling. Each actor subscribes to itself and processes its own events.

### 5. Skills for Business Logic
All logic is in reusable skills, not UI code. State machines reference skills by ID.

### 6. JSON-Driven UI
Entire UI structure defined in JSON (Composite/Leaf), enabling database-driven interfaces.

### 7. Container-Query Responsive
Leaves adapt to their container size using `@md:`, `@lg:`, etc., not viewport media queries.

### 8. Bottom-Up Creation
Actors created from leaves → composites → root, ensuring IDs exist before relationships.

### 9. Database-Ready
Entire vibes (actors, views, data) can be stored and loaded from Jazz.

### 10. Schema-Driven Design
Reusable UI component templates via design system schemas.

---

## 🚀 Quick Reference

### Create an Actor

```typescript
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

### Send a Message

```typescript
targetActor.inbox.$jazz.push(
  ActorMessage.create({
    type: 'DELETE_ITEM',
    payload: { id: '123' },
    from: sourceActor.$jazz.id,
    timestamp: Date.now(),
  })
)
```

### Create a Skill

```typescript
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

registerSkillsFromConfig({ '@myapp/doSomething': mySkill })
```

### Define a Composite

```typescript
const myComposite: CompositeConfig = {
  container: { layout: 'flex', class: 'flex-col gap-4' },
  children: [
    { slot: 'header', leaf: headerLeaf },
    { slot: 'content', leaf: contentLeaf },
  ],
}
```

### Define a Leaf

```typescript
const myLeaf: LeafNode = {
  tag: 'button',
  classes: 'px-4 py-2 bg-blue-500 text-white rounded @md:px-6 @md:py-3',
  events: { click: { event: 'MY_EVENT', payload: { id: 'item.id' } } },
  children: ['Click Me'],
}
```

### Create an Entity

```typescript
await createEntityGeneric(account, 'Human', {
  name: 'Alice',
  email: 'alice@example.com',
  dateOfBirth: new Date(1990, 0, 1),
})
```

### Create a Vibe

```typescript
// 1. Create actors (bottom-up)
const leafActor = Actor.create({ /* ... */ }, group)
const compositeActor = Actor.create({ children: [leafActor.id], /* ... */ }, group)
const rootActor = Actor.create({ children: [compositeActor.id], /* ... */ }, group)

// 2. Set up subscriptions
leafActor.subscriptions.$jazz.push(compositeActor.$jazz.id)
compositeActor.subscriptions.$jazz.push(compositeActor.$jazz.id)

// 3. Register in vibes registry
root.vibes.$jazz.set('myapp', rootActor.$jazz.id)
```

---

## 🎓 Learning Path

### 1. Start with Basics
- Read **[Main README](./README.md)** for overview
- Understand **[Actors](./actors/README.md)** - the foundation

### 2. Learn Business Logic
- Study **[Skills](./skills/README.md)** - how logic is organized
- Explore entity and UI skills

### 3. Master UI Layer
- Read **[View Layer](./view/README.md)** - JSON-driven UI
- Learn Composite/Leaf pattern
- Practice with container queries

### 4. Understand Data Layer
- Deep dive **[Jazz Integration](./jazz/README.md)** - CoValues & CoState
- Learn **[Schemata](./schemata/README.md)** - type system

### 5. Build Complete Apps
- Follow **[Vibes](./vibes/README.md)** - putting it all together
- Study real examples (Humans vibe, Vibes vibe)

---

## 🔍 Common Patterns

### Pattern: CRUD List

```typescript
// List actor handles its own delete events
const listActor = Actor.create({
  states: { idle: { on: { DELETE_ITEM: { actions: ['@entity/deleteEntity'] } } } },
  view: {
    foreach: {
      items: 'queries.items.items',
      composite: {
        children: [
          { slot: 'name', leaf: { bindings: { text: 'item.name' } } },
          {
            slot: 'delete',
            leaf: {
              events: { click: { event: 'DELETE_ITEM', payload: { id: 'item.id' } } }
            }
          }
        ]
      }
    }
  },
  subscriptions: co.list(z.string()).create([]),  // Subscribe to self
}, group)
listActor.subscriptions.$jazz.push(listActor.$jazz.id)
```

### Pattern: View Switching

```typescript
// Root actor with dynamic content composite
const rootActor = Actor.create({
  context: { view: { contentCompositeId: 'myapp.composite.list' } },
  states: { idle: { on: { SET_VIEW: { actions: ['@ui/swapViewNode'] } } } },
  view: {
    children: [
      { slot: 'content', compositeId: 'view.contentCompositeId' }  // Dynamic!
    ]
  },
}, group)
```

### Pattern: Master-Detail

```typescript
// Root actor with modal
const rootActor = Actor.create({
  context: { view: { showModal: false, selectedItem: null } },
  states: {
    idle: {
      on: {
        OPEN_MODAL: { actions: ['@ui/openModal'] },
        CLOSE_MODAL: { actions: ['@ui/closeModal'] },
      }
    }
  },
  view: {
    children: [
      { slot: 'list', /* ... */ },
      {
        slot: 'modal',
        leaf: { /* ... */ },
        bindings: { visible: 'view.showModal' }
      }
    ]
  },
}, group)
```

---

## ✅ Checklist for Building a Vibe

- [ ] Plan actor hierarchy (leaves → composites → root)
- [ ] Create template functions for reusable components
- [ ] Create actors bottom-up with `Actor.create()`
- [ ] Set up subscriptions (each actor handles its own events)
- [ ] Link children via `parent.children.$jazz.push(child.$jazz.id)`
- [ ] Wait for sync with `await actor.$jazz.waitForSync()`
- [ ] Register skills with `registerSkillsFromConfig()`
- [ ] Register in vibes registry with `root.vibes.$jazz.set()`
- [ ] Test with `/vibes?vibe=myapp`
- [ ] Add global lock for HMR safety

---

## 🐛 Debugging Checklist

- [ ] Check actor exists in registry: `root.vibes.myapp`
- [ ] Verify subscriptions: `Array.from(actor.subscriptions)`
- [ ] Trace children: `Array.from(actor.children)`
- [ ] Check actor loaded: `actor?.$isLoaded`
- [ ] Verify inbox messages: `actor.inbox.byMe?.value`
- [ ] Test skill execution: `skillRegistry.get('@entity/createEntity')`
- [ ] Check payload resolution: Log in `handleEvent`
- [ ] Verify state machine: `actor.states.idle.on`

---

## 🎯 Remember

- **Actors** = UI components with state machines
- **Messages** = Pure event passing (no prop drilling)
- **Skills** = Reusable business logic
- **Views** = JSON-driven UI (Composite/Leaf)
- **Jazz** = Real-time collaborative data
- **Schemata** = Type system for everything
- **Vibes** = Complete applications

---

**See individual docs for detailed information!**
