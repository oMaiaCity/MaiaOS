# Context (The Memory)

Think of context as your actor's **memory** — like a notebook where it writes things down!

**CRITICAL:** Context is the **single source of truth** for all UI state and data. Everything is persisted to CoValues. No in-memory hacks.

**What's in the notebook?**
- What todos you have (`todos: [...]`) — from query objects, CoValue-backed
- Whether a modal is open (`isModalOpen: false`) — UI state in context
- What text is in the input field (`newTodoText: "Buy milk"`) — form state in context

**The Architecture:**
- **Process handlers** → All logic, computation, conditionals. Updates context via `ctx`.
- **Context** → Single source of truth. All UI state. CoValue-backed. Realtime reactive.
- **View Template** → Dumb template that just renders context (zero logic)

### UI State: Always in Context, Always CoValue

**All UI state lives in context.** No ephemeral state, no in-memory shortcuts.

- ✅ `viewMode`, `newTodoText`, `selectedItems`, `draggedItemId` — all in context
- ✅ Context = CoValue — persisted, syncable, offline-first
- ✅ Every update: `ctx` → CoValue (CRDT) → ReactiveStore → View

## How It Works

```
1. You type "Buy milk" → Process handler ctx: { newTodoText: "Buy milk" } → CoValue
2. You click "Add" → op.create → CoValue → Query stores update → Context reflects
3. View looks at context → Sees new todo → Shows it on screen!
```

**The magic:** Your view automatically shows whatever is in context. Change the context (via `ctx`), change what you see. All roundtrips are CoValue-native.

## Architectural Roles: Single Source of Truth

**CRITICAL PRINCIPLE:** MaiaOS follows a strict single source of truth architecture. Everything is persisted to CoValues. No in-memory hacks. Full local-first, CoValue-native roundtrip.

### Clear Separation of Responsibilities

**Process handlers** → All logic and computation
- ✅ **Single source of truth** for behavior
- ✅ Computes values, updates context via `ctx`
- ✅ All context updates flow through process handlers

**Context** → Contains ALL data and UI state
- ✅ **Single source of truth** for data
- ✅ **Always persisted to CoValue** — never in-memory only
- ✅ Accessed reactively via ReactiveStore (universal `read()` API)
- ✅ Never mutated directly — always through process handler `ctx`

**View** → Dumb template (zero logic)
- ✅ **Read-only** — only reads from context
- ✅ **Zero conditional logic** — pure declarative structure (Nue.js-style)
- ✅ Sends events to process handlers (never updates context directly)
- ✅ Automatically re-renders when context changes

### Local-First, CoValue-Native Roundtrip

**CRITICAL:** All data flows through CoValues. No optimizing updates, no in-memory caches that bypass persistence.

**How it works:**
```
Process handler ctx action
  ↓
Persists to Context CoValue (CRDT)
  ↓
Context ReactiveStore automatically updates
  ↓
View subscribes to ReactiveStore → Re-renders
```

**Key Points:**
- ✅ **Context is a CoValue** — Always persisted, never in-memory only
- ✅ **Accessed via ReactiveStore** — Universal `read()` API pattern
- ✅ **No mutation hacks** — Everything goes through persisted CoValues
- ✅ **Full offline-first** — CoValues sync when connected; local-first when not
- ✅ **CoValue-native roundtrip** — Create/update/delete → CoValue → reactive update. No shortcuts.

### Process Handlers Update Context

**CRITICAL PRINCIPLE:** Process handlers are the **single source of truth** for all context changes.

**What this means:**
- ✅ All context updates MUST flow through process handlers via `ctx`
- ✅ Views send events to process handlers, never update context directly
- ✅ Every update persists to CoValue — full local-first architecture

**Universal read() API Pattern (read-only reactive):**
- ✅ **Every CoValue is accessible as ReactiveStore** via universal `read()` API
- ✅ Query objects use `read()` internally — automatic reactivity, CoValue-backed
- ✅ Context itself is a ReactiveStore — automatic updates when CoValue changes

**Why this matters:**
- **Predictable:** All context changes happen in one place (process handlers)
- **Debuggable:** Easy to trace where context changes come from
- **Offline-first:** Full CoValue roundtrip — sync, conflict resolution, local-first
- **AI-friendly:** LLMs can understand and generate correct patterns

**Correct Pattern (Single Source of Truth):**
```
User clicks button
  ↓
View sends event to process handler (via inbox)
  ↓
Process handler uses ctx action → persists to Context CoValue (CRDT) ← SINGLE SOURCE OF TRUTH
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
- ❌ Using `@context/update` tool (removed — context updates via `ctx` in process handlers)
- ❌ Calling `ActorEngine.updateContextCoValue()` directly from views
- ❌ Setting error context directly in ToolEngine (should use ERROR events)
- ❌ Mutating context outside of process handlers
- ❌ Bypassing CoValue persistence - everything must go through persisted CoValues

**Error Handling:**
When `op` fails, process handlers receive ERROR events (via inbox) with payload `{ errors: [{ type, message, path? }] }` — aligned with OperationResult. Use `$$errors.0.message` to extract the first error for display:
```json
{
  "ERROR": [
    {
      "ctx": { "error": "$$errors.0.message" }
    }
  ]
}
```

**Note:** `ctx` persists to the context CoValue (CRDT). No in-memory hacks — full CoValue roundtrip.

## Context Definition

Context can be defined inline in the actor file or in a separate `.context.maia` file.

### Option 1: Inline Context

```json
{
  "$factory": "@factory/actor",
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
  "$factory": "@factory/context",
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
  "$factory": "@factory/actor",
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
  factory: 'co_zTodos123',  // Factory co-id (co_z...)
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
    "factory": "@factory/todos",
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
