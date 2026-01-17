# Actor Architecture

**Pure Jazz-Native, Message-Passing Actor System**

---

## 🎯 Overview

The Actor Architecture is the foundation of the MaiaCity Vibes system. Every UI component is an autonomous **Actor** - a self-contained unit with:

- **An inbox** - Jazz CoFeed for receiving messages
- **Subscriptions** - List of actor IDs to send messages to
- **Children** - Explicit list of child actor IDs (ID-based relationships)
- **A view** - CompositeConfig or LeafNode defining its UI
- **Dependencies** - References to Jazz CoValues it needs

---

## 📐 Architecture Principles

### 1. **Each Composite and Leaf is Its Own Actor**

Every UI component - whether a composite (layout container) or leaf (content node) - is backed by an Actor:

```typescript
// Header composite = Header actor
const headerActor = Actor.create({
  view: { container: { layout: 'flex', class: '...' }, children: [...] },
  // ...
}, group)

// Button leaf = Button actor
const buttonActor = Actor.create({
  view: { tag: 'button', classes: '...', events: {...} },
  // ...
}, group)
```

### 2. **Pure Message Passing (No Prop Drilling)**

Actors communicate exclusively via messages pushed to Jazz CoFeed inboxes:

```typescript
// Actor A sends message to Actor B
actorB.inbox.$jazz.push(
  ActorMessage.create({
    type: 'DELETE_ITEM',
    payload: { id: '123' },
    from: actorA.$jazz.id,
    timestamp: Date.now(),
  })
)

// Jazz automatically syncs to all subscribers
// Actor B processes message directly via skill execution
```

### 3. **ID-Based Parent-Child Relationships**

Parents explicitly list their children's Jazz IDs in a `CoList`:

```typescript
// Parent explicitly owns children
parentActor.children.$jazz.push(childActor1.$jazz.id)
parentActor.children.$jazz.push(childActor2.$jazz.id)

// O(1) lookup, no role-based filtering needed
const childActors = Array.from(parentActor.children).map(id => loadActor(id))
```

**Benefits**:
- **Explicit**: Relationships are clear and traceable
- **Resilient**: No accidental filtering errors
- **Performant**: O(1) lookup vs O(n) filtering
- **Database-Ready**: Store and reconstruct hierarchies easily

### 4. **Each Actor Handles Its Own Events**

No event bubbling. Each actor subscribes to itself and processes its own events:

```typescript
// List actor handles DELETE_ITEM for its items
const listActor = Actor.create({
  context: {
    visible: true,
    queries: { items: { schemaName: 'Item', items: [] } }
  },
  // ... no state machine needed
}, group)

// List subscribes to itself
listActor.subscriptions.$jazz.push(listActor.$jazz.id)

// Delete button sends message to list
buttonLeaf.events.click = { event: '@entity/deleteEntity', payload: { id: 'item.id' } }
```

---

## 🏗️ Actor Structure

### Actor Schema

```typescript
export const Actor = co.map({
  // Local context data (queries, view state, etc.)
  context: co.json<Record<string, unknown>>(),
  
  // View definition (CompositeConfig or LeafNode)
  view: co.json<unknown>(),
  
  // Dependencies (CoValue IDs this actor needs)
  dependencies: co.json<Record<string, string>>(),
  
  // Inbox for receiving messages (Jazz CoFeed)
  inbox: co.feed(ActorMessage),
  
  // Actors to send messages to (Jazz CoList of IDs)
  subscriptions: co.list(z.string()),
  
  // Child actors (Jazz CoList of IDs)
  children: co.list(z.string()),
  
  // Role identifier for debugging
  role: z.string(),
})
```

### Actor Message

```typescript
export const ActorMessage = co.map({
  type: z.string(),              // Event type (e.g., 'DELETE_ITEM')
  payload: co.json<unknown>(),   // Event payload
  from: z.string(),              // Sender actor ID
  timestamp: z.number(),         // When sent
})
```

---

## 🔄 Actor Lifecycle

### 1. Creation (Bottom-Up)

Actors are created bottom-up, starting with leaves and building up to the root:

```typescript
// STEP 1: Create leaf actors
const titleActor = Actor.create({
  view: createTitleLeaf({ text: 'My Title' }),
  // ...
}, group)

const buttonActor = Actor.create({
  view: createButtonLeaf({ text: 'Click Me', event: 'CLICK' }),
  // ...
}, group)

// STEP 2: Create composite actors
const headerActor = Actor.create({
  view: createHeaderComposite(),
  children: co.list(z.string()).create([titleActor.$jazz.id, buttonActor.$jazz.id]),
  // ...
}, group)

// STEP 3: Create root actor
const rootActor = Actor.create({
  view: { container: { layout: 'grid', class: '...' } },
  children: co.list(z.string()).create([headerActor.$jazz.id, /* ... */]),
  // ...
}, group)

// STEP 4: Set up subscriptions
buttonActor.subscriptions.$jazz.push(rootActor.$jazz.id) // Button sends to root
headerActor.subscriptions.$jazz.push(headerActor.$jazz.id) // Header handles own events
```

### 2. Loading (Top-Down)

The `ActorEngine` loads actors top-down via Jazz CoState:

```typescript
// Load root actor
const rootActorCoState = new CoState(Actor, rootActorId)
const rootActor = rootActorCoState.current

// ActorEngine automatically loads children
const childActors = Array.from(rootActor.children)
  .map(id => new CoState(Actor, id))
  .map(cs => cs.current)
  .filter(a => a?.$isLoaded)
```

### 3. Message Processing (Direct Skill Execution)

Actors process messages from their CoFeed inbox using a **proper consumption pattern** with direct skill execution:

```typescript
// 1. Message sent to inbox (append-only CoFeed)
targetActor.inbox.$jazz.push(ActorMessage.create({ type: '@entity/deleteEntity', payload: { id: '123' } }))

// 2. ActorEngine processes ALL unprocessed messages
let consumedMessageIds = $state<Set<string>>(new Set())

$effect(() => {
  if (!actor?.$isLoaded || !browser) return
  const inbox = actor.inbox
  if (!inbox?.$isLoaded) return
  
  // Collect ALL messages from inbox (byMe + perAccount)
  const allMessages: any[] = []
  // ... collect messages ...
  
  // Sort by timestamp
  allMessages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
  
  // Process each unprocessed message ONCE
  for (const message of allMessages) {
    const messageId = message.$jazz?.id
    if (!messageId || consumedMessageIds.has(messageId)) {
      continue // Already processed
    }
    
    // Mark as consumed BEFORE execution
    consumedMessageIds.add(messageId)
    
    // 3. Call skill directly based on message type (no state machine checks)
    const skill = skillRegistry.get(message.type)
    if (skill) {
      skill.execute(actor, message.payload, accountCoState)
    }
  }
})
```

**Key Points**:
- **Append-only**: Messages are never deleted from CoFeed
- **Consumption tracking**: `consumedMessageIds` prevents duplicate processing
- **Proper queue handling**: Process ALL unprocessed messages, not just latest
- **Direct skill execution**: Skills execute based on message type alone (no state machine checks)

### 4. Rendering (Jazz-Native Data Flow)

The `ActorEngine` resolves queries and delegates rendering to `ViewEngine.svelte`:

```typescript
// Extract schemaName from actor.context.queries
const schemaName = $derived.by(() => {
  const queries = actor.context?.queries
  const firstQuery = Object.values(queries || {})[0] as any
  return firstQuery?.schemaName || ''
})

// Use Jazz-native useQuery for reactive data subscription
const queryResult = useQuery(() => accountCoState, () => schemaName, undefined)

// Populate queries reactively (derived, doesn't mutate Jazz context)
const resolvedContextWithQueries = $derived.by(() => {
  const queries = actor.context?.queries || {}
  const resolvedQueries: Record<string, any> = {}
  
  for (const [queryKey, queryConfig] of Object.entries(queries)) {
    resolvedQueries[queryKey] = {
      ...queryConfig,
      items: queryResult.entities, // Plain objects from Jazz CoValues
    }
  }
  
  return { ...actor.context, queries: resolvedQueries }
})

// Render with resolved data
{#if viewType === 'composite'}
  <Composite 
    node={{ slot: 'root', composite: actor.view }}
    actor={actor}
    queries={resolvedContextWithQueries.queries}
    onEvent={handleEvent}
    childActors={childActors}
    item={item}
    accountCoState={accountCoState}
  />
{:else if viewType === 'leaf'}
  <Leaf 
    node={{ slot: 'root', leaf: actor.view }}
    actor={actor}
    queries={resolvedContextWithQueries.queries}
    onEvent={handleEvent}
    item={item}
    accountCoState={accountCoState}
  />
{/if}
```

**Key Points**:
- **useQuery**: Direct CoState subscription to Jazz entities
- **Plain objects**: Entities converted for easy UI consumption
- **Reactive**: Automatic re-render when Jazz data changes
- **No mutations**: Derived context doesn't mutate Jazz CoValues

---

## 🔌 ActorEngine

The `ActorEngine` is the core orchestrator. It:

1. **Loads the actor** via Jazz CoState
2. **Subscribes to inbox** reactively
3. **Processes messages** directly via skills
4. **Loads child actors** via ID list
5. **Delegates rendering** to Composite/Leaf
6. **Handles events** and sends messages

### Key Features

#### Jazz-Native Reactive Loading

```typescript
// Actor loads reactively
const actorCoState = $derived.by(() => new CoState(Actor, actorId))
const actor = $derived(actorCoState.current)

// Children load reactively
const childActorCoStates = $derived.by(() => {
  if (!actor?.$isLoaded || !actor.children?.$isLoaded) return []
  return Array.from(actor.children).map(id => new CoState(Actor, id))
})
```

#### Inbox Subscription (Proper CoFeed Consumption)

```typescript
// Track processed message IDs (append-only pattern)
let processedMessageIds = $state<Set<string>>(new Set())

// Process ALL unprocessed messages in inbox
$effect(() => {
  if (!actor?.$isLoaded || !browser) return
  const inbox = actor.inbox
  if (!inbox?.$isLoaded) return
  
  // Collect ALL messages from CoFeed (byMe + perAccount)
  const allMessages: any[] = []
  
  // Get byMe message
  const byMeMessage = inbox.byMe?.value
  if (byMeMessage?.$isLoaded) {
    allMessages.push(byMeMessage)
  }
  
  // Get perAccount messages (array)
  if (inbox.perAccount?.length) {
    for (const msg of inbox.perAccount) {
      if (msg?.$isLoaded) {
        allMessages.push(msg)
      }
    }
  }
  
  // Sort by timestamp to process in order
  allMessages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
  
  // Process each unprocessed message ONCE
  for (const message of allMessages) {
    const messageId = message.$jazz?.id
    if (!messageId || processedMessageIds.has(messageId)) {
      continue // Skip already processed messages
    }
    
    // Call skill directly (no dataStore intermediary)
    const skill = getSkill(message.type)
    if (skill) {
      skill.execute(actor, message.payload, accountCoState)
    } else {
      console.warn('[ActorEngine] No tool found for:', message.type)
    }
    
    // Mark as consumed (append-only - never delete from CoFeed!)
    processedMessageIds.add(messageId)
  }
})
```

**Key Changes from Old Pattern**:
- **Process ALL messages**: Not just latest, prevents message loss
- **Proper consumption tracking**: Mark as processed without deleting
- **Append-only CoFeed**: Respects Jazz CoFeed architecture
- **Direct skill calls**: `skill.execute(actor, payload, accountCoState)` - no dataStore
- **Sorted processing**: Messages processed in chronological order

#### Event Handling (Append-Only Message Pushing)

```typescript
function handleEvent(event: string, payload?: unknown) {
  if (!browser || !actor?.$isLoaded) return
  
  // Resolve payload (data paths like 'item.id' → actual values)
  const resolvedPayload = resolvePayload(payload)
  
  console.log(`[ActorEngine] ${actor.role} sending event: ${event}, payload:`, resolvedPayload)
  
  // Create message
  const message = ActorMessage.create({
    type: event,
    payload: resolvedPayload || {},
    from: actorId,
    timestamp: Date.now(),
  })
  
  // Publish to own inbox (for self-subscribed actors)
  if (actor.inbox?.$isLoaded) {
    actor.inbox.$jazz.push(message)
  }
  
  // Publish to subscribed actors
  if (actor.subscriptions?.$isLoaded) {
    for (const subscriberId of actor.subscriptions) {
      if (subscriberId === actorId) continue // Skip self (already published above)
      
      const targetActor = subscribedActors.find(a => a.$jazz?.id === subscriberId)
      if (targetActor?.$isLoaded && targetActor.inbox?.$isLoaded) {
        targetActor.inbox.$jazz.push(message)
        console.log(`[ActorEngine] → Sent to ${targetActor.role}`)
      }
    }
  }
}
```

**Key Points**:
- **Append-only**: All messages persisted in CoFeed (good for collaboration!)
- **Consumption pattern**: Messages marked as consumed after processing
- **Self-subscription**: Actor can handle its own events (true colocation)
- **Explicit subscriptions**: Only send to actors in subscriptions list

---

## 🎭 Actor Patterns

### Pattern 1: List with Items

**Clean Architecture for List/List Items**

```typescript
// List actor handles its own events
const listActor = Actor.create({
  context: {
    visible: true,
    queries: {
      items: { schemaName: 'Item', items: [] }
    }
  },
  view: {
    container: { layout: 'flex', class: 'flex-col gap-2' },
    foreach: {
      items: 'context.queries.items.items',
      key: 'id',
      composite: {
        // Template for each item
        container: { layout: 'flex', class: 'flex-row items-center gap-2' },
        children: [
          { slot: 'name', leaf: { tag: 'span', bindings: { text: 'item.name' } } },
          {
            slot: 'delete',
            leaf: {
              tag: 'button',
              events: { click: { event: '@entity/deleteEntity', payload: { id: 'item.id' } } },
              elements: ['✕']
            }
          }
        ]
      }
    }
  },
  dependencies: { entities: root.entities.$jazz.id },
  inbox: co.feed(ActorMessage).create([]),
  subscriptions: co.list(z.string()).create([]), // Will subscribe to itself
  children: co.list(z.string()).create([]),
  role: 'list',
}, group)

// List subscribes to itself - handles its own events!
listActor.subscriptions.$jazz.push(listActor.$jazz.id)
```

**Key Points**:
- List actor handles `@entity/deleteEntity` event directly (no state machine)
- List subscribes to itself (no event bubbling)
- Delete button payload uses data path: `{ id: 'item.id' }`
- ActorEngine resolves payload to actual ID and executes tool directly

### Pattern 2: Form with Submit Button

```typescript
// Input actor handles its own submission
const inputSectionActor = Actor.create({
  context: {
    visible: true,
    newItemText: '',
    error: null
  },
  view: createInputSectionComposite({
    valuePath: 'context.newItemText',
    inputEvent: '@input/updateContext',
    submitEvent: '@entity/createEntity',
    submitPayload: { name: 'context.newItemText' }
  }),
  inbox: co.feed(ActorMessage).create([]),
  subscriptions: co.list(z.string()).create([]), // Will subscribe to itself
  // ...
}, group)

// Input actor subscribes to itself - handles both input changes AND submission!
inputSectionActor.subscriptions.$jazz.push(inputSectionActor.$jazz.id)
```

### Pattern 3: Header with Actions

```typescript
// Header actor is usually just a container (no event handling needed)
const headerActor = Actor.create({
  context: { visible: true },
  view: createHeaderComposite(),
  inbox: co.feed(ActorMessage).create([]),
  subscriptions: co.list(z.string()).create([]),
  children: co.list(z.string()).create([titleActor.$jazz.id, viewButtonActor.$jazz.id]),
  // ...
}, group)

// If header needs to handle events, subscribe to itself
// headerActor.subscriptions.$jazz.push(headerActor.$jazz.id)
```

---

## 🔍 Debugging Actors

### Log Subscriptions

```typescript
console.log('[ActorEngine] Subscriptions:', {
  raw: actor.subscriptions ? Array.from(actor.subscriptions) : [],
  subscribedActorRoles: subscribedActors.map(a => a.role),
  subscribedActorIds: subscribedActors.map(a => a.$jazz?.id),
  thisActorId: actorId,
})
```

### Trace Message Flow

```typescript
console.log(`[ActorEngine] ${actor.role} sending event: ${event}, payload:`, payload)
console.log(`[ActorEngine] → Sending to ${targetActor.role} (${targetActor.$jazz?.id})`)
```

### Verify Actor Setup

```typescript
console.log('[createActors] Subscriptions setup:', {
  button: Array.from(buttonActor.subscriptions || []),
  list: Array.from(listActor.subscriptions || []),
  root: Array.from(rootActor.subscriptions || []),
})
```

---

## 📚 Related Documentation

- **[Message Passing](./message-passing.md)** - Deep dive into message-passing architecture
- **[ID-Based Relationships](./id-based-relationships.md)** - Why and how we use IDs
- **[Skills](../skills/README.md)** - Business logic execution
- **[View Layer](../view/README.md)** - How actors render UI

---

## ✅ Best Practices

### 1. Each Actor Handles Its Own Events

```typescript
// ✅ GOOD: List handles delete (self-subscription)
const listActor = Actor.create({
  context: { visible: true, queries: { ... } },
  // ... no state machine
}, group)
listActor.subscriptions.$jazz.push(listActor.$jazz.id)

// ❌ BAD: Bubbling delete to parent
listActor.subscriptions.$jazz.push(parentActor.$jazz.id) // Don't bubble!
```

### 2. Use ID-Based Relationships

```typescript
// ✅ GOOD: Explicit children list
parentActor.children.$jazz.push(childActor.$jazz.id)

// ❌ BAD: Role-based filtering (removed)
// const children = allActors.filter(a => a.containerRole === 'parent-id')
```

### 3. Bottom-Up Creation

```typescript
// ✅ GOOD: Create leaves, then composites, then root
const leaf1 = Actor.create({ /* ... */ }, group)
const leaf2 = Actor.create({ /* ... */ }, group)
const composite = Actor.create({ children: [leaf1.id, leaf2.id], /* ... */ }, group)
const root = Actor.create({ children: [composite.id], /* ... */ }, group)

// ❌ BAD: Top-down (IDs don't exist yet)
```

### 4. Subscribe After Creation

```typescript
// ✅ GOOD: Set subscriptions after all actors created
await Promise.all([actor1.$jazz.waitForSync(), actor2.$jazz.waitForSync()])
actor1.subscriptions.$jazz.push(actor2.$jazz.id)

// ❌ BAD: Subscribe before actor2 is synced
```

---

## 🎯 Summary

The Actor Architecture provides:

- **Autonomy**: Each actor is self-contained
- **Explicitness**: Relationships are clear via IDs
- **Scalability**: No prop drilling, pure message passing
- **Debuggability**: Trace messages through subscriptions
- **Jazz-Native**: Everything syncs automatically
- **Clean Code**: Each actor handles its own events

Next: Learn about **[Message Passing](./message-passing.md)** for details on inter-actor communication.
