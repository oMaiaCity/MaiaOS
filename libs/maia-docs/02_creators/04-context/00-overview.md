# Context (The Memory)

Think of context as your actor's **memory** - like a notebook where it writes things down!

**CRITICAL:** Context is the **realtime reactive snapshot** of the current reflection of state. It's automatically updated when the state machine changes state.

**What's in the notebook?**
- What todos you have (`todos: [...]`)
- Whether a modal is open (`isModalOpen: false`)
- What text is in the input field (`newTodoText: "Buy milk"`)

**The Architecture:**
- **State Machine** → Defines the state (all logic and transitions)
- **Context** → Realtime reactive snapshot of current state reflection
- **View Template** → Dumb template that just renders context (zero logic)

Your actor looks at this notebook to know what to show and what to do!

## How It Works

```
1. You type "Buy milk" → Tool updates context: { newTodoText: "Buy milk" }
2. You click "Add" → Tool creates todo → Context updates: { todos: [...new todo] }
3. View looks at context → Sees new todo → Shows it on screen!
```

**The magic:** Your view automatically shows whatever is in context. Change the context, change what you see!

## Architectural Roles: Single Source of Truth

**CRITICAL PRINCIPLE:** MaiaOS follows a strict single source of truth architecture. Everything is persisted to CoValues under the hood, accessed reactively via the universal `read()` API.

### Clear Separation of Responsibilities

**State Machine** → Defines ALL state transitions
- ✅ **Single source of truth** for behavior
- ✅ Defines when and how state changes
- ✅ All transitions flow through state machine

**Context** → Contains ALL data and current state
- ✅ **Single source of truth** for data
- ✅ Always persisted to CoValue under the hood
- ✅ Accessed reactively via ReactiveStore (universal `read()` API)
- ✅ Never mutated directly - always through state machine

**View** → Dumb template that renders from context variables
- ✅ **Read-only** - only reads from context
- ✅ **Zero logic** - pure declarative structure, no conditionals
- ✅ Sends events to state machine (never updates context directly)
- ✅ Automatically re-renders when context changes (realtime reactive snapshot)

### Single Source of Truth: CoValue Under the Hood

**CRITICAL:** Everything is persisted to CoValues under the hood. No in-memory mutation hacks!

**How it works:**
```
State Machine Action
  ↓
updateContextCoValue() → Persists to Context CoValue (CRDT)
  ↓
Context ReactiveStore automatically updates
  ↓
View subscribes to ReactiveStore → Re-renders
```

**Key Points:**
- ✅ **Context is a CoValue** - Always persisted, never in-memory only
- ✅ **Accessed via ReactiveStore** - Universal `read()` API pattern
- ✅ **No mutation hacks** - Everything goes through persisted CoValues
- ✅ **Automatic reactivity** - ReactiveStore notifies subscribers when CoValue changes
- ✅ **Single source of truth** - CoValue is the authoritative data store

## State Machine as Single Source of Truth

**CRITICAL PRINCIPLE:** State machines are the **single source of truth** for all context changes.

**What this means:**
- ✅ All context updates MUST flow through state machines
- ✅ State machines use `updateContext` action (infrastructure, not a tool) to update context
- ✅ Views send events to state machines, never update context directly
- ✅ Context updates are infrastructure - pure CRDT persistence via ReactiveStore pattern

**Universal read() API Pattern (read-only reactive):**
- ✅ **Every CoValue is accessible as ReactiveStore** via universal `read()` API
- ✅ Query objects use `read()` internally - automatic reactivity
- ✅ Context itself is a ReactiveStore - automatic updates when data changes
- ✅ All updates are read-only derived data (reactive subscriptions via ReactiveStore)

**Why this matters:**
- **Predictable:** All context changes happen in one place (state machines)
- **Debuggable:** Easy to trace where context changes come from
- **Testable:** State machines define clear contracts for context updates
- **AI-friendly:** LLMs can understand and generate correct patterns

**Correct Pattern (Single Source of Truth):**
```
User clicks button
  ↓
View sends event to state machine (via inbox)
  ↓
State machine uses updateContext action (infrastructure)
  ↓
updateContextCoValue() persists to Context CoValue (CRDT) ← SINGLE SOURCE OF TRUTH
  ↓
Context ReactiveStore automatically updates (read-only derived data)
  ↓
View subscribes to ReactiveStore → sees update → re-renders
```

**No shortcuts, no hacks:**
- ❌ Never mutate context directly: `actor.context.field = value`
- ❌ Never bypass CoValue persistence
- ❌ Never use in-memory only data structures
- ✅ Always go through persisted CoValues
- ✅ Always access via ReactiveStore (universal `read()` API)

**Anti-Patterns (DON'T DO THIS):**
- ❌ Direct context mutation: `actor.context.field = value` (bypasses CoValue persistence)
- ❌ In-memory mutation hacks: `actor.context.value.todos.push(...)` (bypasses CoValue)
- ❌ Using `@context/update` tool (removed - context updates are infrastructure)
- ❌ Calling `ActorEngine.updateContextCoValue()` directly from views
- ❌ Setting error context directly in ToolEngine (should use ERROR events)
- ❌ Mutating context outside of state machines
- ❌ Bypassing CoValue persistence - everything must go through persisted CoValues

**Error Handling:**
When tools fail, state machines receive ERROR events (via inbox) with payload `{ errors: [{ type, message, path? }] }` — aligned with OperationResult. Use `$$errors.0.message` to extract the first error for display:
```json
{
  "creating": {
    "entry": {
      "tool": "@db",
      "payload": { "op": "create", ... }
    },
    "on": {
      "ERROR": {
        "target": "error",
        "actions": [
          {
            "updateContext": { "error": "$$errors.0.message" }
          }
        ]
      }
    }
  }
}
```

**Note:** `updateContext` is infrastructure (not a tool). It directly calls `updateContextCoValue()` to persist changes to the context CoValue (CRDT).

## Context Definition

Context can be defined inline in the actor file or in a separate `.context.maia` file.

### Option 1: Inline Context

```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/todo",
  "state": "@state/todo",
  
  "context": {
    "todos": [],
    "newTodoText": "",
    "viewMode": "list"
  }
}
```

**Note:** Inline context is rarely used. It's recommended to use separate context files.

### Option 2: Separate Context File (Recommended)

**`todo.context.maia`:**
```json
{
  "$schema": "@schema/context",
  "$id": "@context/todo",
  
  // Collections
  "todos": [],
  "notes": [],
  
  // Derived/filtered data
  "todosTodo": [],
  "todosDone": [],
  
  // UI state
  "viewMode": "list",
  "isModalOpen": false,
  
  // Form state
  "newTodoText": "",
  "editingId": null,
  
  // Drag-drop state
  "draggedItemId": null,
  "draggedItemSchema": null,
  "draggedItemIds": {},           // Item lookup object for conditional styling
  
  // Computed boolean flags (for conditional styling)
  "listButtonActive": true,
  "kanbanButtonActive": false
}
```

**`todo.actor.maia`:**
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/todo",
  "context": "@context/todo",  // ← References todo.context.maia (co-id reference)
  "state": "@state/todo"
}
```

**Benefits of Separate Files:**
- ✅ Cleaner actor definitions
- ✅ Easier to maintain large contexts
- ✅ Better separation of concerns
- ✅ Context can be shared or versioned independently

## Universal read() API Pattern: Single Source of Truth

**CRITICAL:** Every CoValue in MaiaOS is accessible as a ReactiveStore via the universal `read()` API. This is the foundational pattern for all data access. **Everything is persisted to CoValues under the hood - no in-memory mutation hacks!**

**How it works:**
```javascript
// Read any CoValue as ReactiveStore
const store = await dbEngine.execute({
  op: 'read',
  schema: 'co_zTodos123',  // Schema co-id (co_z...)
  key: 'co_zItem456'       // Item co-id (optional - omit for collections)
});

// Access current value (read-only!)
console.log('Current data:', store.value);

// Subscribe to updates (automatic when CoValue changes)
const unsubscribe = store.subscribe((data) => {
  console.log('Data updated:', data);
});
```

**Key Points:**
- ✅ **Every CoValue → ReactiveStore** - Single, unified pattern
- ✅ **CoValue is single source of truth** - Always persisted, never in-memory only
- ✅ **ReactiveStore is access layer** - Read-only reactive interface to CoValue
- ✅ **Automatic reactivity** - Subscribe once, get updates forever when CoValue changes
- ✅ **Progressive loading** - Store has initial value, updates as data loads
- ✅ **Context is a ReactiveStore** - `actor.context` is itself a ReactiveStore backed by Context CoValue
- ✅ **Query objects use read() internally** - They're just a convenient way to declare queries
- ✅ **No mutation hacks** - Everything goes through persisted CoValues

**This pattern applies to:**
- Context (actor runtime data) - Persisted to Context CoValue
- Database collections (todos, notes, etc.) - Persisted to Collection CoValues
- Individual items (single todo, single note) - Persisted to Item CoValues
- Configs (actor definitions, views, states) - Persisted to Config CoValues
- Schemas (schema definitions) - Persisted to Schema CoValues
- Everything! Every CoValue is accessible this way.

**Single Source of Truth Flow:**
```
CoValue (persisted, CRDT) ← SINGLE SOURCE OF TRUTH
  ↓
Universal read() API
  ↓
ReactiveStore (reactive access layer)
  ↓
Context/View (read-only, subscribes to ReactiveStore)
```

See [Operations](./07-operations.md) for complete documentation on the universal `read()` API.

## Context Types

### 1. Reactive Data (Query Objects) ⭐

**Query objects** are special objects that tell MaiaOS "I want this data, and keep me updated when it changes."

**Format:**
```json
{
  "todos": {
    "schema": "@schema/todos",
    "filter": null
  }
}
```

**What this means:** "Give me all items from the 'todos' collection, and automatically update me when they change."

**How it works internally:**
1. You declare the query object in context
2. MaiaOS uses universal `read()` API to get a ReactiveStore for that data
3. The ReactiveStore automatically updates when data changes
4. Context ReactiveStore subscribes to the data ReactiveStore
