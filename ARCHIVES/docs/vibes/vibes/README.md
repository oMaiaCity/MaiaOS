# Vibes System

**Complete Applications Built with Actors, Skills, and Views**

---

## 🎯 Overview

A **Vibe** is a complete, self-contained application built on the MaiaCity architecture. Vibes combine:

- **Actors** - UI components with message-passing
- **Skills** - Reusable business logic
- **Views** - JSON-driven UI definitions
- **Schemata** - Data models
- **Jazz** - Real-time collaborative data

Examples: **Humans vibe**, **Vibes registry vibe**, **Todo vibe** (coming soon)

---

## 📐 Vibe Structure

### Anatomy of a Vibe

```
vibes/humans/
├── actors/
│   └── createHumansActors.ts       # Actor creation logic
├── config.ts                        # Legacy vibe config (deprecated)
├── README.md                        # Vibe documentation
```

### Modern Vibe Architecture

```typescript
// vibes/humans/actors/createHumansActors.ts

export async function createHumansActors(account: any) {
  // STEP 1: Create leaf actors (bottom-up)
  const titleActor = Actor.create({
    view: createTitleLeaf({ text: 'Humans', tag: 'h2' }),
    role: 'humans-header-title',
    // ...
  }, group)
  
  const createButtonActor = Actor.create({
    view: createButtonLeaf({
      text: 'Create Human',
      event: 'CREATE_HUMAN',
      variant: 'primary',
    }),
    role: 'humans-create-button',
    // ...
  }, group)
  
  // STEP 2: Create composite actors
  const headerActor = Actor.create({
    view: createHeaderComposite(),
    children: co.list(z.string()).create([
      titleActor.$jazz.id,
      createButtonActor.$jazz.id,
    ]),
    role: 'humans-header',
    // ...
  }, group)
  
  // List actor with Jazz-native queries
  const listActor = Actor.create({
    context: {
      visible: true,  // Actor visibility (default: false, must set true to render)
      queries: {
        humans: {
          schemaName: 'Human',  // Declares what data we need
          items: []             // Populated by useQuery in ActorRenderer
        }
      }
    },
    view: {
      container: { layout: 'flex', class: 'flex-col gap-2' },
      foreach: {
        items: 'queries.humans.items',  // Data path resolved by Composite.svelte
        key: 'id',                      // Track by ID
        composite: {
          // Inline template for each item
          container: { layout: 'flex', class: 'flex-row items-center gap-2' },
          children: [
            {
              slot: 'name',
              leaf: { 
                tag: 'div', 
                bindings: { text: 'item.name' }  // Direct property access
              }
            },
            {
              slot: 'delete',
              leaf: {
                tag: 'button',
                elements: ['✕'],
                events: { 
                  click: { 
                    event: 'REMOVE_HUMAN', 
                    payload: { id: 'item.id' }  // Resolved by ActorRenderer
                  } 
                }
              }
            }
          ]
        }
      }
    },
    dependencies: { entities: root.entities.$jazz.id },
    inbox: co.feed(ActorMessage).create([]),
    subscriptions: co.list(z.string()).create([]),  // Will subscribe to itself
    children: co.list(z.string()).create([]),
    role: 'humans-list',
  }, group)
  
  // List subscribes to itself - true colocation!
  listActor.subscriptions.$jazz.push(listActor.$jazz.id)
  
  // STEP 3: Create root actor
  const rootActor = Actor.create({
    context: { visible: true },
    view: {
      container: { layout: 'grid', class: 'max-w-6xl mx-auto grid-cols-1' },
    },
    children: co.list(z.string()).create([headerActor.$jazz.id, listActor.$jazz.id]),
    role: 'humans-root',
    // ...
  }, group)
  
  // STEP 4: Set up subscriptions
  createButtonActor.subscriptions.$jazz.push(rootActor.$jazz.id)  // Button → Root
  listActor.subscriptions.$jazz.push(listActor.$jazz.id)          // List → Self
  rootActor.subscriptions.$jazz.push(rootActor.$jazz.id)         // Root → Self
  
  // STEP 5: Register in vibes registry
  root.vibes.$jazz.set('humans', rootActor.$jazz.id)
  
  return rootActor.$jazz.id
}
```

---

## 🏗️ Creating a Vibe

### Step 1: Define Actor Hierarchy

Plan your actor tree:

```
RootActor (handles CREATE_*)
├── HeaderActor
│   ├── TitleActor
│   └── CreateButtonActor (sends to RootActor)
└── ListActor (handles DELETE_*, subscribes to self)
    └── ItemTemplate (foreach)
        ├── NameLeaf
        ├── EmailLeaf
        └── DeleteButtonLeaf (sends to ListActor)
```

### Step 2: Create Template Functions

```typescript
// vibes/myapp/design-templates/composites/header.template.ts
export function createHeaderComposite(): CompositeConfig {
  return {
    container: {
      layout: 'flex',
      class: 'flex-row justify-between items-center p-4',
    },
  }
}

// vibes/myapp/design-templates/leafs/button.template.ts
export function createButtonLeaf(params: {
  text: string
  event: string
  variant?: 'primary' | 'secondary'
}): LeafNode {
  return {
    tag: 'button',
    classes: params.variant === 'primary'
      ? 'px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600'
      : 'px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300',
    events: {
      click: { event: params.event, payload: {} }
    },
    children: [params.text],
  }
}
```

### Step 3: Create Actors (Bottom-Up)

```typescript
// Create leaves first
const leaf1 = Actor.create({ view: createLeaf1(), /* ... */ }, group)
const leaf2 = Actor.create({ view: createLeaf2(), /* ... */ }, group)

// Then composites
const composite = Actor.create({
  view: createComposite(),
  children: co.list(z.string()).create([leaf1.$jazz.id, leaf2.$jazz.id]),
  // ...
}, group)

// Finally root
const root = Actor.create({
  children: co.list(z.string()).create([composite.$jazz.id]),
  // ...
}, group)
```

### Step 4: Set Up Subscriptions

**Key Rule**: Each actor handles its own events!

```typescript
// Root handles creation
rootActor.states = {
  idle: { on: { CREATE_ITEM: { target: 'idle', actions: ['@entity/createEntity'] } } }
}
rootActor.subscriptions.$jazz.push(rootActor.$jazz.id)

// List handles deletion
listActor.states = {
  idle: { on: { DELETE_ITEM: { target: 'idle', actions: ['@entity/deleteEntity'] } } }
}
listActor.subscriptions.$jazz.push(listActor.$jazz.id)

// Button sends to appropriate actor
createButtonActor.subscriptions.$jazz.push(rootActor.$jazz.id)
deleteButtonLeaf.events.click = { event: 'DELETE_ITEM', payload: { id: 'item.id' } }
```

### Step 5: Register in Vibes Registry

```typescript
// Register root actor ID
root.vibes.$jazz.set('myapp', rootActor.$jazz.id)
await root.vibes.$jazz.waitForSync()

// Now accessible at /vibes?vibe=myapp
```

---

## 🔄 Vibe Lifecycle

### Initialization

```svelte
<!-- routes/vibes/+page.svelte -->
<script lang="ts">
  import { useJazz } from '$lib/hooks/useJazz.svelte'
  import { Actor } from '@maia/db'
  import { CoState } from 'jazz-tools/svelte'
  
  const account = useJazz()
  const root = account.root
  
  // Get vibe ID from URL
  const vibeId = $page.url.searchParams.get('vibe') || 'vibes'
  
  // Create or load vibe
  $effect(() => {
    if (!root?.$isLoaded) return
    
    const registry = root.vibes
    let rootActorId = registry[vibeId]
    
    if (!rootActorId) {
      // Create vibe actors
      if (vibeId === 'humans') {
        rootActorId = await createHumansActors(account)
      }
    }
  })
  
  // Load root actor
  const rootActorId = $derived(root?.vibes?.[vibeId])
</script>

{#if rootActorId}
  <ActorRenderer actorId={rootActorId} accountCoState={account} />
{/if}
```

### Hot Reloading

```typescript
// Global lock prevents double-creation during HMR
const getGlobalLock = () => {
  if (typeof window === 'undefined') return { vibes: false, humans: false }
  if (!(window as any).__actorCreationLocks) {
    (window as any).__actorCreationLocks = { vibes: false, humans: false }
  }
  return (window as any).__actorCreationLocks
}

export async function createHumansActors(account: any) {
  const locks = getGlobalLock()
  
  if (locks.humans) {
    console.log('Already creating, waiting...')
    throw new Error('Already creating humans actors')
  }
  locks.humans = true
  
  try {
    // Create actors...
  } finally {
    locks.humans = false
  }
}
```

---

## 🎨 Vibe Patterns

### Pattern 1: CRUD Vibe

**Create, Read, Update, Delete** for an entity type:

```typescript
// Form handles CREATE (self-subscription)
const formActor = Actor.create({
  context: { visible: true, newItemText: '' },
  // ... no state machine
}, group)
formActor.subscriptions.$jazz.push(formActor.$jazz.id)

// List handles DELETE (self-subscription)
const listActor = Actor.create({
  context: { visible: true, queries: { items: { schemaName: 'Item', items: [] } } },
  // ... no state machine
}, group)
listActor.subscriptions.$jazz.push(listActor.$jazz.id)
```

### Pattern 2: View-Switching Vibe

**Multiple views** (list, kanban, timeline):

```typescript
// Root actor with view state
const rootActor = Actor.create({
  context: {
    visible: true,
    viewMode: 'list',
    viewActors: {
      list: listActor.$jazz.id,
      kanban: kanbanActor.$jazz.id,
      timeline: timelineActor.$jazz.id
    }
  },
  view: {
    container: { layout: 'grid', class: 'grid-cols-1' },
    children: [
      { slot: 'header', /* view buttons */ },
      { slot: 'content', /* dynamic actor swapping */ }
    ]
  },
  // ...
}, group)
// Content actor handles @view/swapActors
contentActor.subscriptions.$jazz.push(contentActor.$jazz.id)
```

### Pattern 3: Master-Detail Vibe

**List with detail modal**:

```typescript
// Root handles OPEN_MODAL
const rootActor = Actor.create({
  context: {
    visible: true,
    showModal: false,
    selectedItem: null
  },
  view: {
    container: { layout: 'grid' },
    children: [
      { slot: 'list', /* list composite */ },
      {
        slot: 'modal',
        leaf: { /* modal leaf */ },
        bindings: { visible: 'view.showModal' }
      }
    ]
  },
  // ...
}, group)
```

---

## 🔍 Debugging Vibes

### Check Registry

```typescript
console.log('Registered vibes:', {
  vibes: root.vibes.vibes,
  humans: root.vibes.humans,
  // ...
})
```

### Trace Actor Creation

```typescript
console.log('[createActors] Starting...')
const actor1 = Actor.create({ /* ... */ }, group)
console.log('[createActors] Created actor1:', actor1.$jazz.id)
await actor1.$jazz.waitForSync()
console.log('[createActors] Actor1 synced')
```

### Verify Subscriptions

```typescript
console.log('[createActors] Subscriptions setup:', {
  button: Array.from(buttonActor.subscriptions || []),
  list: Array.from(listActor.subscriptions || []),
  root: Array.from(rootActor.subscriptions || []),
})
```

### Check Child Relationships

```typescript
console.log('[createActors] Actor hierarchy:', {
  root: {
    id: rootActor.$jazz.id,
    children: Array.from(rootActor.children || []),
  },
  composite: {
    id: compositeActor.$jazz.id,
    children: Array.from(compositeActor.children || []),
  },
})
```

---

## 📚 Related Documentation

- **[Vibe Structure](./structure.md)** - Detailed vibe organization
- **[Creating Vibes](./creating.md)** - Step-by-step guide
- **[Examples](./examples.md)** - Real-world vibe implementations
- **[Actors](../actors/README.md)** - Actor architecture
- **[Skills](../skills/README.md)** - Business logic
- **[View Layer](../view/README.md)** - UI definitions

---

## ✅ Best Practices

### 1. Bottom-Up Creation

```typescript
// ✅ GOOD: Leaves → Composites → Root
const leaf1 = Actor.create({ /* ... */ }, group)
const leaf2 = Actor.create({ /* ... */ }, group)
const composite = Actor.create({ children: [leaf1.id, leaf2.id], /* ... */ }, group)
const root = Actor.create({ children: [composite.id], /* ... */ }, group)

// ❌ BAD: Top-down (IDs don't exist yet)
```

### 2. Each Actor Handles Its Own Events

```typescript
// ✅ GOOD: List handles delete
listActor.states.idle.on.DELETE_ITEM = { /* ... */ }
listActor.subscriptions.$jazz.push(listActor.$jazz.id)

// ❌ BAD: Bubbling to parent
listActor.subscriptions.$jazz.push(parentActor.$jazz.id)
```

### 3. Use Template Functions

```typescript
// ✅ GOOD: Reusable templates
view: createButtonLeaf({ text: 'Submit', event: 'SUBMIT' })

// ❌ BAD: Inline definitions
view: { tag: 'button', classes: '...', /* ... */ }
```

### 4. Global Lock for HMR

```typescript
// ✅ GOOD: Prevent double-creation
if (locks.myapp) throw new Error('Already creating')
locks.myapp = true
try {
  // Create actors...
} finally {
  locks.myapp = false
}

// ❌ BAD: No lock (creates duplicates on HMR)
```

### 5. Wait for Sync

```typescript
// ✅ GOOD: Wait before next operation
await actor.$jazz.waitForSync()
actor.children.$jazz.push(childId)

// ❌ BAD: Don't wait (race conditions)
actor.children.$jazz.push(childId)  // Might fail
```

---

## 🎯 Summary

The Vibes System provides:

- **Complete applications** - Actors + Skills + Views + Data
- **Self-contained** - Everything needed in one place
- **Reusable** - Share actors, skills, templates across vibes
- **Database-driven** - Load entire vibes from Jazz
- **Hot-reloadable** - Develop with instant feedback
- **Collaborative** - Real-time multi-user by default

Next: See **[Examples](./examples.md)** for real implementations.
