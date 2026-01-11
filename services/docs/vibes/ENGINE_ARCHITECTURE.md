# Engine Architecture

**JSON → Engine → Output: The Core Pattern of MaiaOS**

---

## 🎯 Overview

MaiaOS is built on a unified architectural pattern where **engines** transform JSON configurations into running systems. Every component—from UI rendering to business logic execution—follows this pattern.

### Core Principle

```
JSON Configuration → Engine → Running Entity
```

All engines share this interface:
1. **Input**: JSON configuration or identifier
2. **Processing**: Transformation, evaluation, or orchestration
3. **Output**: Running system (rendered UI, executed logic, reactive data)

---

## 🏗️ The 6 Engines

| Engine | Input | Output | Role |
|--------|-------|--------|------|
| **ActorEngine** | Actor ID (Jazz CoValue) | Rendered DOM + Reactive State | Actor orchestration & lifecycle |
| **ToolEngine** | Tool ID + Payload | Executed business logic | Tool execution with DSL evaluation |
| **ViewEngine** | ViewNode JSON | Rendered HTML elements | Unified Composite + Leaf rendering |
| **factoryEngine** | Factory JSON + Parameters | Resolved ViewNode | Template expansion with conditionals |
| **queryEngine** | Schema name + Options | Reactive entity list | Jazz-native reactive queries |
| **seedingEngine** | Vibe name | Actor tree (seeded) | Vibe initialization & seeding |

---

## 🔄 Data Flow Through Engines

```
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                         │
│  User Interaction → Events → Messages                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    ACTOR ENGINE                              │
│  Actor ID → Load Actor → Process Messages → Render          │
│  • Message processing (CoFeed consumption)                   │
│  • Query resolution (via queryEngine)                        │
│  • Event handling                                            │
│  • Child actor orchestration                                 │
└────────┬───────────────────────────────────┬────────────────┘
         │                                   │
         │ (tools)                           │ (view)
         ▼                                   ▼
┌──────────────────────┐          ┌──────────────────────┐
│    TOOL ENGINE       │          │    VIEW ENGINE       │
│  Tool ID + Payload   │          │  ViewNode JSON       │
│  → Execute Logic     │          │  → Render HTML       │
│                      │          │                      │
│  • DSL evaluation    │          │  • Type detection    │
│  • Module registry   │          │  • Binding resolution│
│  • Security checks   │          │  • Event handlers    │
└──────────────────────┘          └──────┬───────────────┘
         │                               │
         │                               │ (factories)
         ▼                               ▼
┌──────────────────────┐          ┌──────────────────────┐
│    QUERY ENGINE      │          │   FACTORY ENGINE     │
│  Schema + Options    │          │  Factory + Params    │
│  → Entity List       │          │  → ViewNode          │
│                      │          │                      │
│  • CoState subscribe │          │  • Parameter subst.  │
│  • Schema filtering  │          │  • Conditionals      │
│  • Query options     │          │  • Template expansion│
└──────────────────────┘          └──────────────────────┘
         │
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                        JAZZ LAYER                            │
│  CoValues (CoMap, CoList, CoFeed) → Real-time Sync          │
└─────────────────────────────────────────────────────────────┘
```

---

## 1️⃣ ActorEngine

**File**: `services/me/src/lib/compositor/engines/ActorEngine.svelte`

### Purpose
Orchestrates actor lifecycle, processes messages, resolves queries, and renders UI.

### Interface
```typescript
interface ActorEngineProps {
  actorId: string              // Jazz CoValue ID
  accountCoState?: any         // Global Jazz account
  item?: any                   // For foreach contexts
}
```

### Input
- Actor ID (e.g., `"co_z1234..."`)
- Jazz account CoState
- Optional item context (for foreach loops)

### Output
- Rendered DOM tree
- Reactive state management
- Message processing
- Query population

### Key Responsibilities

1. **Actor Loading**
   ```typescript
   const actorCoState = new CoState(Actor, actorId)
   const actor = actorCoState.current
   ```

2. **Query Resolution** (via queryEngine)
   ```typescript
   const queryResult = useQuery(() => accountCoState, () => 'Todo')
   const resolvedContext = { ...actor.context, queries: { todos: queryResult.entities } }
   ```

3. **Message Processing** (proper CoFeed pattern)
   ```typescript
   // Append-only: Mark consumed, never delete
   for (const message of allMessages) {
     if (consumedMessageIds.has(message.$jazz.id)) continue
     
     ToolEngine.execute(message.type, actor, message.payload, accountCoState)
     consumedMessageIds.add(message.$jazz.id)
   }
   ```

4. **View Rendering** (delegates to ViewEngine)
   ```typescript
   <ViewEngine 
     node={viewNode}
     data={{ context, childActors, item, accountCoState }}
     onEvent={handleEvent}
   />
   ```

### Data Flow
```
Actor ID
  → Load via CoState
  → Resolve queries (queryEngine)
  → Process messages (ToolEngine)
  → Render view (ViewEngine)
  → Handle events (publish to inboxes)
```

---

## 2️⃣ ToolEngine

**File**: `services/me/src/lib/compositor/engines/ToolEngine.ts`

### Purpose
Executes tools with MaiaScript DSL payload evaluation and security checks.

### Interface
```typescript
class ToolEngine {
  static async execute(
    toolId: string,           // e.g., '@core/createEntity'
    actor: any,               // Actor reference
    payload?: unknown,        // Payload (may contain DSL)
    accountCoState?: any      // Jazz account
  ): Promise<void>
}
```

### Input
- Tool ID (e.g., `"@core/createEntity"`, `"@context/update"`)
- Actor reference
- Payload (plain objects, string paths, or MaiaScript expressions)
- Jazz account CoState

### Output
- Executed business logic
- Mutated Jazz CoValues
- Updated actor context

### Key Responsibilities

1. **Tool Lookup** (from module registry)
   ```typescript
   const tool = toolModuleRegistry.getTool(toolId)
   ```

2. **Payload Evaluation** (MaiaScript DSL)
   ```typescript
   // String paths: 'context.newTodoText' → actual value
   // MaiaScript expressions: { $add: [...] } → computed result
   // Recursive evaluation for nested objects/arrays
   const evaluatedPayload = this.evaluatePayload(payload, actor)
   ```

3. **Tool Execution**
   ```typescript
   await tool.execute(actor, evaluatedPayload, accountCoState)
   ```

4. **Security** (whitelist-based)
   - Only allowed data path roots: `context`, `dependencies`, `item`
   - Prototype pollution prevention
   - No `eval()` or unsafe code execution

### Data Flow
```
Tool ID + Payload
  → Load tool from registry
  → Evaluate payload (MaiaScript DSL)
  → Execute tool logic
  → Mutate Jazz CoValues
  → UI reacts automatically
```

### Example
```typescript
// User types "Buy milk" and clicks "Add"
ToolEngine.execute('@core/createEntity', actor, {
  schemaName: 'Todo',
  entityData: {
    name: 'context.newTodoText',  // ← String path (DSL resolves)
    endDate: {                     // ← MaiaScript expression
      "$toISOString": [
        { "$add": [{ "$now": [] }, { "$multiply": [7, 86400000] }] }
      ]
    }
  },
  clearFieldPath: 'newTodoText'
}, accountCoState)

// Result:
// - Creates todo with name "Buy milk"
// - Sets endDate to 7 days from now
// - Clears input field
// - UI updates automatically via queryEngine
```

---

## 3️⃣ ViewEngine

**File**: `services/me/src/lib/compositor/engines/ViewEngine.svelte`

### Purpose
Unified rendering engine for Composite and Leaf nodes with data binding and event handling.

### Interface
```typescript
interface ViewEngineProps {
  node: ViewNode               // Composite or Leaf definition
  data: Record<string, any>    // Context + item + childActors
  config?: VibeConfig
  onEvent?: (event: string, payload?: unknown) => void
}
```

### Input
- ViewNode JSON (either Composite or Leaf)
- Data context (actor context, item, childActors)
- Event callback

### Output
- Rendered HTML elements
- Data bindings (reactive)
- Event handlers

### Key Responsibilities

1. **Node Type Detection**
   ```typescript
   const nodeType = node.composite ? 'composite' : 'leaf'
   ```

2. **Binding Resolution** (via MaiaScript DSL)
   ```typescript
   // Static: "Buy milk"
   // String path: "item.name" → actor data
   // MaiaScript: { $if: {...} } → conditional result
   const boundText = resolveText(leaf.bindings.text, data)
   ```

3. **Event Handling**
   ```typescript
   onclick={() => {
     const resolvedPayload = resolvePayload(event.payload, data)
     onEvent(event.event, resolvedPayload)
   }}
   ```

4. **Foreach Rendering**
   ```typescript
   {#each items as item}
     <ViewEngine node={template} data={{ ...data, item }} {onEvent} />
   {/each}
   ```

5. **Self-Recursion**
   - Renders children by recursively calling itself
   - Handles nested structures (Composite inside Composite)

### Data Flow
```
ViewNode JSON
  → Detect type (Composite or Leaf)
  → Resolve bindings (MaiaScript DSL)
  → Render HTML
  → Attach event handlers
  → Recurse for children
```

### Historical Note
ViewEngine **replaces** the previous separate `Composite.svelte` and `Leaf.svelte` components. The architecture (ViewNode, Composite, Leaf concepts) remains the same.

---

## 4️⃣ factoryEngine

**File**: `services/me/src/lib/compositor/engines/factoryEngine.ts`

### Purpose
Expands factory templates with parameter substitution and conditionals.

### Interface
```typescript
function createFromFactory<T extends ViewNode>(
  factoryDef: UniversalFactoryDef,
  params: Record<string, any>
): T

// Type-safe helpers
function createComposite(factoryDef, params): CompositeNode
function createLeaf(factoryDef, params): LeafNode
```

### Input
- Factory JSON definition
- Parameters (key-value pairs)

### Output
- Fully resolved ViewNode (Composite or Leaf)

### Key Responsibilities

1. **Parameter Validation**
   ```typescript
   // Check required parameters
   // Apply defaults
   // Merge user params
   ```

2. **Conditional Processing** (MaiaScript $if, $switch)
   ```typescript
   // Evaluated at factory-load time (not runtime)
   {
     "$if": {
       "test": { "$eq": ["{{variant}}", "primary"] },
       "then": { "classes": "bg-blue-500" },
       "else": { "classes": "bg-gray-500" }
     }
   }
   ```

3. **Parameter Substitution**
   ```typescript
   // Single parameter: "{{text}}" → "Hello"
   // In string: "px-{{size}}" → "px-4"
   // Preserves MaiaScript objects
   ```

4. **Template Expansion**
   - Recursively processes nested structures
   - Preserves MaiaScript expressions for runtime

### Data Flow
```
Factory JSON + Parameters
  → Validate parameters
  → Process conditionals ($if, $switch)
  → Substitute {{placeholders}}
  → Return resolved ViewNode
```

### Example
```typescript
// Factory definition
{
  "$schema": "leaf-factory",
  "parameters": {
    "text": { "type": "string", "required": true },
    "variant": { "type": "string", "default": "primary" }
  },
  "factory": {
    "tag": "button",
    "classes": {
      "$if": {
        "test": { "$eq": ["{{variant}}", "primary"] },
        "then": "bg-blue-500 text-white",
        "else": "bg-gray-500 text-white"
      }
    },
    "elements": ["{{text}}"]
  }
}

// Usage
const button = createLeaf(buttonFactory, {
  text: 'Click Me',
  variant: 'primary'
})
// → { tag: 'button', classes: 'bg-blue-500 text-white', elements: ['Click Me'] }
```

---

## 5️⃣ queryEngine

**File**: `services/me/src/lib/compositor/engines/queryEngine.svelte.ts`

### Purpose
Provides Jazz-native reactive entity queries with filtering, sorting, and pagination.

### Interface
```typescript
function useQuery(
  accountCoState: any | (() => any),
  schemaName: string | (() => string),
  queryOptions?: QueryOptions | (() => QueryOptions | undefined)
): {
  entities: Array<any>      // Plain objects (not CoValues)
  isLoading: boolean
  loadingState: 'loading' | 'loaded' | 'unauthorized' | 'unavailable'
}
```

### Input
- Jazz account CoState
- Schema name (e.g., `"Todo"`, `"Human"`)
- Query options (filter, sort, limit, offset)

### Output
- Reactive entity list (plain objects)
- Loading state

### Key Responsibilities

1. **CoState Subscription** (Jazz-native)
   ```typescript
   const entities = $derived.by(() => {
     const account = accountCoState.current
     const entities = account.root.entities
     // Filter by @schema ID
     // Convert to plain objects
   })
   ```

2. **Schema Filtering**
   ```typescript
   // Find schema ID by name
   // Match entities where entity['@schema'] === schemaId
   ```

3. **Query Options**
   ```typescript
   // Filter: { status: { eq: 'done' } }
   // Sort: { field: 'name', order: 'asc' }
   // Limit: 10
   // Offset: 20
   ```

4. **CoValue Conversion**
   ```typescript
   // CoValue → Plain object (for easy UI consumption)
   // Preserves id, _coValueId
   // Copies all properties
   ```

### Data Flow
```
Schema Name + Options
  → Subscribe to account.root.entities (CoState)
  → Find schema by name
  → Filter entities by @schema ID
  → Apply query options (filter, sort, limit)
  → Convert to plain objects
  → Return reactive result
```

### Example
```typescript
// In ActorEngine
const queryResult = useQuery(
  () => accountCoState,
  () => 'Todo',
  { filter: { status: { eq: 'done' } }, sort: { field: 'name', order: 'asc' } }
)

// Populate actor context
const resolvedContext = {
  ...actor.context,
  queries: {
    todos: {
      schemaName: 'Todo',
      items: queryResult.entities  // Plain objects, updates automatically
    }
  }
}
```

---

## 6️⃣ seedingEngine

**File**: `services/me/src/lib/compositor/engines/seedingEngine.ts`

### Purpose
Manages vibe initialization and actor tree creation with registry integration.

### Interface
```typescript
async function getOrCreateVibe(
  account: any,
  vibeName: string
): Promise<string>  // Returns root actor ID

async function seedVibes(
  account: any,
  vibeNames: string[]
): Promise<Record<string, string>>  // Vibe name → root actor ID
```

### Input
- Jazz account
- Vibe name(s)

### Output
- Root actor ID
- Actor tree (created in Jazz)

### Key Responsibilities

1. **Registry Check**
   ```typescript
   const registry = await getVibesRegistry(account)
   const existingRootId = registry[vibeName]
   if (existingRootId) return existingRootId
   ```

2. **Vibe Creation** (delegates to vibe-specific function)
   ```typescript
   const vibeConfig = VIBE_REGISTRY[vibeName]
   const rootActorId = await vibeConfig.createActors(account)
   ```

3. **Registry Update**
   ```typescript
   vibesRegistry.$jazz.set(vibeName, rootActorId)
   ```

4. **Global Locking** (prevents duplicates)
   ```typescript
   // Persists across hot reloads
   // Per-vibe locking
   ```

### Data Flow
```
Vibe Name
  → Check VibesRegistry
  → If exists: return existing root actor ID
  → If not: create actor tree
  → Register root actor ID
  → Return root actor ID
```

### Example
```typescript
// Get or create todos vibe
const todosRootId = await getOrCreateVibe(account, 'todos')
// → Creates entire actor tree if needed
// → Returns 'co_z1234...' (root actor ID)

// Batch seeding
const results = await seedVibes(account, ['vibes', 'humans', 'todos'])
// → { vibes: 'co_z123...', humans: 'co_z456...', todos: 'co_z789...' }
```

---

## 🔗 Engine Integration Patterns

### Pattern 1: Actor → Tool → Query

```
User clicks "Add Todo"
  → ActorEngine handles event
  → Sends message to actor inbox
  → ToolEngine.execute('@core/createEntity', ...)
  → Tool mutates Jazz CoValue
  → queryEngine detects change
  → ActorEngine re-renders with new data
```

### Pattern 2: Factory → View

```
Create actor with factory-based view
  → factoryEngine.createComposite(inputSectionFactory, params)
  → Returns ViewNode JSON
  → Store in actor.view
  → ActorEngine loads actor
  → ViewEngine renders ViewNode
```

### Pattern 3: Query → View → Tool

```
ActorEngine starts
  → queryEngine.useQuery('Todo') → entities
  → Populate actor.context.queries
  → ViewEngine renders foreach with entities
  → User clicks delete on item
  → ViewEngine resolves payload: { id: 'item.id' }
  → ToolEngine.execute('@core/deleteEntity', ...)
  → queryEngine updates automatically
```

---

## 🔐 Security Model

All engines integrate with MaiaScript DSL's security model:

1. **Whitelist-Based Property Traversal**
   - Only allowed roots: `context`, `dependencies`, `item`
   - No `__proto__`, `constructor`, `prototype`

2. **No Code Execution**
   - No `eval()`, `new Function()`
   - Pure JSON expressions

3. **Operation Whitelisting**
   - Only registered MaiaScript operations
   - Module-based extension

See [MaiaScript DSL](./MAIASCRIPT_DSL.md) for complete security details.

---

## 📚 Related Documentation

- **[MaiaScript DSL](./MAIASCRIPT_DSL.md)** - Expression language used across engines
- **[Factory System](./FACTORY_SYSTEM.md)** - Deep dive into factoryEngine
- **[Tools System](./skills/README.md)** - ToolEngine and tool modules
- **[Actor Architecture](./actors/README.md)** - ActorEngine deep dive
- **[View Layer](./view/README.md)** - ViewEngine and ViewNode architecture
- **[Jazz Integration](./jazz/README.md)** - queryEngine and CoState patterns

---

## ✅ Summary

MaiaOS's engine architecture provides:

- **Unified Pattern**: JSON → Engine → Output everywhere
- **Composability**: Engines work together seamlessly
- **Security**: Whitelist-based, no code execution
- **Reactivity**: Jazz-native, automatic UI updates
- **Extensibility**: Module-based tool system
- **Performance**: Optimized CoState subscriptions

**Core Innovation**: Every component follows the same pattern, making the system predictable, debuggable, and maintainable.
