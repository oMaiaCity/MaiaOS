# View Layer

**JSON-Driven UI with Composite & Leaf Pattern**

---

## 🎯 Overview

The View Layer defines UI structure entirely in JSON using two primitives:

- **Composite** - Layout containers (flex, grid, content)
- **Leaf** - Content nodes (buttons, inputs, text)

Views are:
- **100% JSON-driven** - No hardcoded UI components
- **Schema-backed** - Reusable templates via design system
- **Container-query responsive** - Adapt to container size, not viewport
- **Database-ready** - Store and load entire UIs from Jazz
- **Actor-integrated** - Each composite/leaf can be an actor

---

## 📐 Architecture

### Composite

**Layout containers** that provide space and structure:

```typescript
interface CompositeConfig {
  id?: string              // Unique identifier
  '@schema'?: string       // Schema reference (optional)
  parameters?: Record<string, string> // Schema params
  
  container: {
    layout: 'grid' | 'flex' | 'content'  // REQUIRED
    class?: string         // Tailwind classes
    tag?: string           // HTML tag (default: 'div')
  }
  
  children?: ViewNode[]    // Static children
  foreach?: {              // OR dynamic foreach
    items: string          // Data path to array
    key?: string           // Tracking key
    composite?: CompositeConfig  // Template
    leaf?: LeafNode        // Template
  }
  
  events?: EventHandlers   // Container events
  bindings?: {             // Container bindings
    visible?: string
    disabled?: string
  }
}
```

### Leaf

**Content nodes** that render actual UI elements:

```typescript
interface LeafNode {
  id?: string              // Unique identifier
  '@schema'?: string       // Schema reference (optional)
  parameters?: Record<string, string> // Schema params
  
  tag: string              // HTML tag or 'icon'
  classes?: string         // Tailwind classes (string!)
  attributes?: Record<string, string | boolean | number>
  elements?: (LeafNode | string)[]  // Nested HTML elements
  icon?: IconConfig        // For tag='icon'
  
  bindings?: {
    value?: string         // Data path for inputs
    text?: string          // Data path for text
    visible?: string       // Boolean expression
    disabled?: string      // Boolean expression
    foreach?: {            // List rendering
      items: string
      key?: string
      leaf: LeafNode
    }
  }
  
  events?: {
    click?: EventConfig
    input?: EventConfig
    // ... all DOM events
  }
}
```

---

## 🏗️ Layout Types

### Grid Layout

**Structural 2D layouts:**

```typescript
const gridComposite: CompositeConfig = {
  container: {
    layout: 'grid',
    class: 'grid-cols-3 gap-4'  // h-full w-full overflow-hidden grid @container added automatically
  },
  children: [
    { slot: 'header', leaf: headerLeaf },
    { slot: 'sidebar', leaf: sidebarLeaf },
    { slot: 'content', leaf: contentLeaf },
  ]
}
```

**Auto-applied defaults**:
- `h-full w-full overflow-hidden grid @container`

### Flex Layout

**Structural 1D layouts:**

```typescript
const flexComposite: CompositeConfig = {
  container: {
    layout: 'flex',
    class: 'flex-col gap-4'  // w-full overflow-hidden flex @container added automatically
  },
  children: [
    { slot: 'header', leaf: headerLeaf },
    { slot: 'content', leaf: contentLeaf },
  ]
}
```

**Auto-applied defaults**:
- `w-full overflow-hidden flex @container` (NO h-full - sizes naturally)

### Content Layout

**Natural-flow containers:**

```typescript
const contentComposite: CompositeConfig = {
  container: {
    layout: 'content',
    class: 'p-6 bg-white rounded-lg'  // @container added automatically
  },
  children: [
    { slot: 'title', leaf: titleLeaf },
    { slot: 'body', leaf: bodyLeaf },
  ]
}
```

**Auto-applied defaults**:
- `@container` only (no structural defaults)

---

## 🎨 Container Queries

**Philosophy**: Composites provide space, Leaves adapt to it.

### Why Container Queries?

```typescript
// ✅ GOOD: Adapts to container size
const adaptiveButton: LeafNode = {
  tag: 'button',
  classes: `
    px-2 py-1 text-xs
    @sm:px-4 @sm:py-2 @sm:text-base
    @md:px-6 @md:py-3 @md:text-lg
  `,
  // Works in any container: sidebar, modal, full-width card
}

// ❌ BAD: Adapts to viewport (not what we want)
const viewportButton: LeafNode = {
  tag: 'button',
  classes: 'px-2 py-1 text-xs sm:px-4 md:px-6',
  // Changes based on screen size, not container size
}
```

### Container Size Reference

| Variant | Minimum width | CSS |
|---------|---------------|-----|
| `@3xs` | 16rem (256px) | `@container (width >= 16rem)` |
| `@2xs` | 18rem (288px) | `@container (width >= 18rem)` |
| `@xs` | 20rem (320px) | `@container (width >= 20rem)` |
| `@sm` | 24rem (384px) | `@container (width >= 24rem)` |
| `@md` | 28rem (448px) | `@container (width >= 28rem)` |
| `@lg` | 32rem (512px) | `@container (width >= 32rem)` |
| `@xl` | 36rem (576px) | `@container (width >= 36rem)` |
| `@2xl` | 42rem (672px) | `@container (width >= 42rem)` |
| `@3xl` | 48rem (768px) | `@container (width >= 48rem)` |

### Adaptive Examples

```typescript
// Adaptive card
const adaptiveCard: LeafNode = {
  tag: 'div',
  classes: `
    bg-white rounded-lg
    p-2 @sm:p-4 @md:p-6
    text-xs @sm:text-sm @md:text-base
  `,
  elements: [
    {
      tag: 'h2',
      classes: 'text-sm @sm:text-base @md:text-xl font-bold mb-1 @sm:mb-2',
      children: ['Card Title']
    },
    {
      tag: 'p',
      classes: 'hidden @sm:block text-slate-600',
      children: ['This description only shows in containers ≥ 24rem']
    }
  ]
}

// Adaptive grid
const adaptiveGrid: LeafNode = {
  tag: 'div',
  classes: `
    grid gap-2
    grid-cols-1
    @xs:grid-cols-2
    @md:grid-cols-3
    @lg:grid-cols-4
  `,
  // Auto-adapts columns based on available space
}
```

---

## 🔄 Jazz-Native Data Flow

### From CoState to UI (useQuery Architecture)

**The view layer receives data via Jazz-native reactive queries:**

```typescript
// 1. Actor declares data needs
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
    container: { layout: 'flex', class: 'flex-col gap-2' },
    foreach: {
      items: 'queries.humans.items',  // Data path to query results
      key: 'id',
      composite: {
        children: [
          {
            slot: 'name',
            leaf: { tag: 'div', bindings: { text: 'item.name' } }
          }
        ]
      }
    }
  }
}, group)

// 2. ActorRenderer resolves queries
const schemaName = $derived.by(() => {
  const queries = actor.context?.queries
  return Object.values(queries)[0]?.schemaName || ''
})

// 3. useQuery subscribes directly to Jazz CoValues
const queryResult = useQuery(() => accountCoState, () => schemaName)

// 4. Populate context (derived, doesn't mutate Jazz)
const resolvedContext = $derived.by(() => ({
  ...actor.context,
  queries: {
    humans: {
      ...actor.context.queries.humans,
      items: queryResult.entities  // Plain objects for easy UI consumption
    }
  }
}))

// 5. UI renders with plain objects
<Composite 
  node={{ slot: 'root', composite: actor.view }}
  actor={actor}
  queries={resolvedContext.queries}
  onEvent={handleEvent}
/>
```

**Data Flow Architecture**:

```
Jazz CoValues (account.root.entities)
    ↓ (CoState subscription)
useQuery (reactive $derived.by)
    ↓ (plain object conversion)
actor.context.queries (derived)
    ↓ (data path resolution)
Composite/Leaf bindings
    ↓ (reactive render)
UI Display
```

**Key Benefits**:
- **Direct CoState subscriptions**: No local state copying
- **Reactive**: UI automatically updates when Jazz data changes
- **Plain objects**: Simple property access in templates (`item.name`)
- **No $isLoaded checks**: Entities already converted before rendering
- **Collaborative**: Changes sync across all devices automatically

### Data Path Resolution

View bindings use **data paths** to access nested data:

```typescript
// Simple property
bindings: { text: 'item.name' }
// Resolves to: item.name

// Nested property
bindings: { text: 'item.profile.avatar' }
// Resolves to: item.profile.avatar

// Query results
bindings: { foreach: { items: 'queries.humans.items' } }
// Resolves to: actor.context.queries.humans.items

// Context data
bindings: { text: 'context.currentView' }
// Resolves to: actor.context.currentView
```

**Resolution Scope** (in order of precedence):
1. `item` - Current foreach item
2. `queries` - Query results from useQuery
3. `context` - Actor context data
4. `childActors` - Child actor references

---

## 📋 Data Bindings

### Value Binding (Inputs)

```typescript
const inputLeaf: LeafNode = {
  tag: 'input',
  attributes: { type: 'text', placeholder: 'Enter text...' },
  classes: 'px-4 py-2 border rounded',
  bindings: {
    value: 'context.newTodoText'  // Two-way binding to actor context
  },
  events: {
    input: { event: '@ui/updateInput', payload: { text: 'context.newTodoText' } }
  }
}
```

**Note**: Input values bind to `context` properties, which are managed by the actor's context object.

### Text Binding

```typescript
const textLeaf: LeafNode = {
  tag: 'span',
  classes: 'text-slate-700',
  bindings: {
    text: 'item.name'  // Direct property access (from foreach item)
  }
}

// Or from context
const titleLeaf: LeafNode = {
  tag: 'h1',
  classes: 'text-2xl font-bold',
  bindings: {
    text: 'context.title'  // From actor context
  }
}
```

### Visibility Binding

```typescript
const errorLeaf: LeafNode = {
  tag: 'div',
  classes: 'text-red-500 text-sm',
  bindings: {
    visible: 'context.error !== null',  // Only visible when error exists
    text: 'context.error'
  }
}
```

**Note**: Visibility can also be controlled at the actor level via `actor.context.visible` (default: `false`). Actors must explicitly set `visible: true` to render.

### Foreach Binding (Jazz-Native List Rendering)

**Foreach loops render data from Jazz-native queries:**

```typescript
// In Actor view definition
const listActor = Actor.create({
  context: {
    queries: {
      todos: {
        schemaName: 'Todo',  // useQuery subscribes to Jazz entities
        items: []            // Populated reactively by ActorRenderer
      }
    }
  },
  view: {
    container: { layout: 'flex', class: 'flex-col gap-2' },
    foreach: {
      items: 'queries.todos.items',  // Data path to query results
      key: 'id',                     // Tracking key
      composite: {
        container: { layout: 'flex', class: 'flex-row items-center gap-2' },
        children: [
          {
            slot: 'text',
            leaf: {
              tag: 'span',
              classes: 'flex-1',
              bindings: { text: 'item.text' }  // Direct property access!
            }
          },
          {
            slot: 'status',
            leaf: {
              tag: 'span',
              classes: 'text-xs',
              bindings: { 
                text: "item.processed ? '✓ Done' : '○ Pending'"  // Expressions work!
              }
            }
          },
          {
            slot: 'delete',
            leaf: {
              tag: 'button',
              elements: ['✕'],
              events: {
                click: {
                  event: 'DELETE_TODO',
                  payload: { id: 'item.id' }  // Resolved to actual ID
                }
              }
            }
          }
        ]
      }
    }
  }
}, group)
```

**How It Works**:
1. **Actor declares**: `queries.todos.schemaName = 'Todo'`
2. **useQuery subscribes**: Direct CoState subscription to `account.root.entities`
3. **Entities filtered**: By matching `@schema` IDs
4. **Converted to plain objects**: `coValueToPlainObject(entity)`
5. **Populated**: `queries.todos.items = [...]` (plain objects)
6. **Foreach iterates**: Over `queries.todos.items`
7. **Reactive updates**: When Jazz data changes, UI updates automatically

**Key Benefits**:
- **Direct property access**: `item.text`, `item.processed` (no `$isLoaded` checks!)
- **Reactive**: Automatically updates when Jazz entities change
- **Collaborative**: Changes sync across all devices
- **Simple**: Plain objects, no Jazz internals exposed to UI

---

## 🎯 Events

### Click Events

```typescript
const buttonLeaf: LeafNode = {
  tag: 'button',
  classes: 'px-4 py-2 bg-blue-500 text-white rounded',
  events: {
    click: {
      event: 'ADD_TODO',
      payload: { text: 'New todo' }
    }
  },
  children: ['Add Todo']
}
```

### Input Events

```typescript
const inputLeaf: LeafNode = {
  tag: 'input',
  classes: 'px-4 py-2 border rounded',
  bindings: { value: 'context.newTodoText' },
  events: {
    input: {
      event: '@ui/updateInput',
      payload: { text: 'context.newTodoText' }  // Data path resolved by ActorRenderer
    }
  }
}
```

**How It Works**:
1. User types in input
2. Event fires: `@ui/updateInput` with payload `{ text: <actual_value> }`
3. Skill mutates Jazz CoValue or actor context
4. UI re-renders reactively with new value

### Form Events

```typescript
const formLeaf: LeafNode = {
  tag: 'form',
  classes: 'flex flex-col gap-4',
  events: {
    submit: {
      event: 'SUBMIT_FORM',
      payload: { /* ... */ }
    }
  },
  elements: [/* form elements */]
}
```

### Payload Resolution

```typescript
// String payload → resolved from data
payload: 'item.id'  // Resolves to { id: '123' }

// Object payload → resolves data paths
payload: { id: 'item.id', name: 'item.name' }  // Resolves all paths

// Static payload → used as-is
payload: { action: 'delete' }
```

---

## 🎨 Schema-Driven Components

### Design System Templates

Reusable UI components via schemas:

```typescript
// Define schema
export const buttonSchemaDefinition = {
  type: 'Leaf',
  name: 'design-system.button',
  
  definition: {
    tag: 'button',
    attributes: { type: 'button' },
    classes: 'px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600',
    events: {
      click: { event: '{{clickEvent}}' }  // Placeholder
    },
    children: ['{{buttonText}}']  // Placeholder
  },
  
  parameterSchema: {
    type: 'object',
    properties: {
      clickEvent: { type: 'string', description: 'Event to trigger' },
      buttonText: { type: 'string', description: 'Button text', default: 'Click Me' },
    },
    required: ['clickEvent'],
  },
}

// Register schema
registerJsonSchema('design-system.button', buttonSchemaDefinition)

// Use schema (create instances)
const submitButton: LeafNode = {
  id: 'form.button.submit',
  '@schema': 'design-system.button',
  parameters: {
    clickEvent: 'SUBMIT_FORM',
    buttonText: 'Submit',
  },
}

const cancelButton: LeafNode = {
  id: 'form.button.cancel',
  '@schema': 'design-system.button',
  parameters: {
    clickEvent: 'CANCEL',
    buttonText: 'Cancel',
  },
}
```

### Benefits

- **Single source of truth** - Update schema, all instances update
- **Type safety** - Parameters validated via JSON Schema
- **Consistency** - Same component looks same everywhere
- **Database-ready** - Store schemas as CoValues (future)

---

## 🔄 Rendering Flow

### Composite.svelte

```svelte
<!-- Pure composition engine -->
<div class={containerClasses}>
  {#if foreach}
    {#each foreachItems as item (item[key])}
      {#if foreach.composite}
        <svelte:self node={{ slot, composite: foreach.composite }} data={{ ...data, item }} />
      {:else if foreach.leaf}
        <Leaf node={{ slot, leaf: foreach.leaf }} data={{ ...data, item }} onEvent={handleEvent} />
      {/if}
    {/each}
  {:else}
    {#each children as child}
      {#if child.composite}
        <svelte:self node={child} {data} {onEvent} />
      {:else if child.leaf}
        <Leaf node={child} {data} {onEvent} />
      {:else if child.compositeId}
        <!-- Resolve from registry -->
      {:else if child.leafId}
        <!-- Resolve from registry -->
      {/if}
    {/each}
  {/if}
</div>
```

### Leaf.svelte

```svelte
<!-- Render actual HTML elements -->
{#if leaf.bindings?.visible !== false}
  {@const Element = leaf.tag}
  {@const resolvedAttrs = resolveAttributes(leaf.attributes)}
  {@const resolvedClasses = sanitizeClasses(leaf.classes || '')}
  
  <Element
    {...resolvedAttrs}
    class={resolvedClasses}
    onclick={leaf.events?.click ? () => handleEvent(leaf.events.click) : undefined}
    oninput={leaf.events?.input ? () => handleEvent(leaf.events.input) : undefined}
    <!-- ... all events -->
  >
    {#if leaf.bindings?.foreach}
      <!-- Render foreach items -->
    {:else if leaf.elements}
      {#each leaf.elements as element}
        {#if typeof element === 'string'}
          {element}
        {:else}
          <svelte:self node={{ slot: 'element', leaf: element }} {data} {onEvent} />
        {/if}
      {/each}
    {:else if leaf.bindings?.text}
      {resolveDataPath(data, leaf.bindings.text)}
    {:else if leaf.children}
      {#each leaf.children as child}
        {typeof child === 'string' ? child : renderLeaf(child)}
      {/each}
    {/if}
  </Element>
{/if}
```

---

## 📚 Related Documentation

- **[Composite](./composite.md)** - Composite patterns and examples
- **[Leaf](./leaf.md)** - Leaf patterns and examples
- **[Schema Resolver](./schema-resolver.md)** - Design system templates
- **[Container Queries](./container-queries.md)** - Responsive design guide
- **[Actors](../actors/README.md)** - How actors render views

---

## ✅ Best Practices

### 1. Use Container Queries in Leaves

```typescript
// ✅ GOOD: Container-based responsive
classes: 'p-2 @sm:p-4 @md:p-6'

// ❌ BAD: Viewport-based responsive
classes: 'p-2 sm:p-4 md:p-6'
```

### 2. Choose the Right Layout Type

```typescript
// ✅ GOOD: Structural grid for app layout
{ layout: 'grid', class: 'grid-cols-[auto_1fr] gap-4' }

// ✅ GOOD: Flex for header/footer
{ layout: 'flex', class: 'flex-row justify-between' }

// ✅ GOOD: Content for article blocks
{ layout: 'content', class: 'prose prose-slate' }
```

### 3. Use Schemas for Reusable Components

```typescript
// ✅ GOOD: Schema for buttons, headers, cards
'@schema': 'design-system.button'

// ❌ BAD: Duplicate button definitions everywhere
```

### 4. String Classes, Not Arrays

```typescript
// ✅ GOOD: Space-separated string
classes: 'px-4 py-2 bg-blue-500 text-white rounded'

// ❌ BAD: Array (breaks sanitization)
classes: ['px-4', 'py-2', 'bg-blue-500']
```

### 5. Payload Data Paths

```typescript
// ✅ GOOD: Use data paths for dynamic values
payload: { id: 'item.id', name: 'item.name' }

// ❌ BAD: Static values (loses context)
payload: { id: '123' }
```

---

## 🎯 Summary

The View Layer provides:

- **JSON-driven UI** - Entire UI in JSON
- **Composite/Leaf pattern** - Clear separation of layout & content
- **Container queries** - Component-based responsive design
- **Schema system** - Reusable design system templates
- **Actor integration** - Each component can be an actor
- **Database-ready** - Store and load UIs from Jazz

Next: Learn about **[Composite Patterns](./composite.md)** for advanced layouts.
