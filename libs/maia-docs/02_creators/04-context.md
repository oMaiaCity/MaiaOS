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
5. Your view subscribes to context ReactiveStore and re-renders automatically

**Think of it like:** Subscribing to a newsletter - you tell them what you want, they send you updates automatically. The universal `read()` API is like the subscription service - every CoValue becomes a reactive store you can subscribe to.

**Behind the scenes:** Query objects are just a convenient way to declare queries. They use the universal `read()` API internally, which:
1. Reads from persisted CoValue (single source of truth)
2. Returns a ReactiveStore (reactive access layer)
3. Automatically keeps your context updated when CoValue changes
4. **No in-memory mutation hacks** - everything goes through persisted CoValues

**Examples:**

```json
{
  "context": {
    // All todos (no filter)
    "todos": {
      "schema": "@schema/todos",
      "filter": null
    },
    
    // Only incomplete todos
    "todosTodo": {
      "schema": "@schema/todos",
      "filter": { "done": false }
    },
    
    // Only completed todos
    "todosDone": {
      "schema": "@schema/todos",
      "filter": { "done": true }
    }
  }
}
```

**When to use:**
- ✅ When you need data from the database
- ✅ When you want automatic updates
- ✅ When data can change (todos, notes, messages, etc.)

**Best practices:**
- Use descriptive names (`todosTodo`, not `t1`)
- Use filters to get only what you need
- Don't manually update these arrays (MaiaOS does it automatically)
- Use generic reusable names that fit your view template slots (e.g., `list` for list views, `messages` for message logs)

See [Reactive Data System](../developers/06_reactive-queries.md) for detailed examples.

#### Map Transformations in Query Objects ⭐ PRIMARY PATTERN

**CRITICAL:** Map transformations are defined **directly in context query objects** using the `options.map` syntax. This is the **PRIMARY and RECOMMENDED** pattern for data transformations.

**Map transformations** let you reshape data when reading it. Think of it like a translator - you take data in one format and transform it into the format your views need.

**Format (in context file):**
```json
{
  "messages": {
    "schema": "@schema/message",
    "options": {
      "map": {
        "fromRole": "$$source.role",
        "toRole": "$$target.role",
        "fromId": "$$source.id",
        "toId": "$$target.id"
      }
    }
  }
}
```

**What this means:** "Give me all messages, but transform each item so that `source.role` becomes `fromRole`, `target.role` becomes `toRole`, etc."

**Key Rules:**
- ✅ **Strict `$$` syntax required** - All map expressions MUST use `$$` prefix (e.g., `$$source.role`, not `source.role`)
- ✅ **Generic placeholder names** - Use reusable names that fit your view template slots (e.g., `fromRole`, `toRole`, `fromId`, `toId` for log entries)
- ✅ **Works with any property path** - You can map nested properties like `$$nested.deep.property`

**Example: Log View with Generic Placeholders**

**Context:**
```json
{
  "messages": {
    "schema": "@schema/message",
    "options": {
      "map": {
        "fromRole": "$$source.role",
        "toRole": "$$target.role",
        "fromId": "$$source.id",
        "toId": "$$target.id"
      }
    }
  },
  "payloadLabel": "payload"
}
```

**View:**
```json
{
  "$each": {
    "items": "$messages",
    "template": {
      "tag": "div",
      "children": [
        {
          "tag": "span",
          "text": "$$fromRole"
        },
        {
          "tag": "span",
          "text": "$$toRole"
        },
        {
          "tag": "summary",
          "text": "$payloadLabel"
        }
      ]
    }
  }
}
```

**Why this pattern?**
- ✅ **Generic reusable names** - `fromRole`/`toRole` work for any log entry, not just messages
- ✅ **No hardcoded strings** - `payloadLabel` is extracted to context variable
- ✅ **Consistent template slots** - View template variables match context keys
- ✅ **Strict syntax** - `$$` prefix ensures consistency with MaiaScript expressions

**Common Patterns:**

**1. Flattening nested structures:**
```json
{
  "list": {
    "schema": "@schema/todos",
    "options": {
      "map": {
        "authorName": "$$author.name",
        "authorEmail": "$$author.email"
      }
    }
  }
}
```

**2. Renaming for generic template slots:**
```json
{
  "list": {
    "schema": "@schema/todos",
    "options": {
      "map": {
        "itemText": "$$text",
        "itemId": "$$id",
        "isComplete": "$$done"
      }
    }
  }
}
```

**3. Combining with filters:**
```json
{
  "messages": {
    "schema": "@schema/message",
    "options": {
      "filter": { "type": "notification" },
      "map": {
        "fromRole": "$$source.role",
        "toRole": "$$target.role"
      }
    }
  }
}
```

**Best Practices:**
- ✅ Use generic placeholder names (`fromRole`, `toRole`, `list`, `messages`) that fit your view template slots
- ✅ Extract hardcoded strings to context variables (`payloadLabel`, `toggleButtonText`, etc.)
- ✅ Always use strict `$$` syntax in map expressions
- ✅ Keep mapped property names consistent across your app
- ✅ Use descriptive names that indicate the perspective (e.g., `fromRole`/`toRole` for log entries)

### 2. Collections (Arrays)
Static array data (not reactive):

```json
{
  "colors": ["red", "green", "blue"],
  "options": ["option1", "option2"]
}
```

**When to use:**
- Static configuration data
- Hardcoded options (not from database)
- Local temporary collections

**Best practices:**
- Use query objects for database data (reactive)
- Use arrays for static/local data only
- Keep entities flat when possible

### 3. UI State
View-related state:

```json
{
  "viewMode": "list",           // "list" | "kanban" | "grid"
  "isModalOpen": false,
  "selectedId": null,
  "activeTab": "all"
}
```

### 4. Form State
Input field values:

```json
{
  "newTodoText": "",
  "searchQuery": "",
  "filterTerm": ""
}
```

### 5. Transient State
Temporary runtime data:

```json
{
  "draggedItemId": null,
  "hoveredItemId": null,
  "loadingState": "idle"
}
```

### 6. Computed Boolean Flags
State machine computes boolean flags for conditional styling (no `$if` in views!):

```json
{
  "listButtonActive": true,        // Computed: viewMode === "list"
  "kanbanButtonActive": false,     // Computed: viewMode === "kanban"
  "isModalOpen": false             // Computed: modalState === "open"
}
```

**Pattern:** State machine computes → Context stores → View references → CSS styles

### 7. Item Lookup Objects
For item-specific conditional styling in lists:

```json
{
  "draggedItemIds": {              // Object mapping item IDs to boolean states
    "item-123": true,              // This item is being dragged
    "item-456": false              // This item is not being dragged
  },
  "selectedItemIds": {             // Multiple selections
    "item-123": true,
    "item-789": true
  }
}
```

**Pattern:** State machine maintains lookup object → View uses `"$draggedItemIds.$$id"` → ViewEngine looks up value → CSS styles

## Accessing Context

### From State Machines
Use `$` prefix to reference context fields:

```json
{
  "payload": {
    "text": "$newTodoText",
    "mode": "$viewMode"
  }
}
```

**Note:** Guards are schema-based and validate against state/context conditions only. Payload validation happens in ActorEngine via message type schemas before messages reach the state machine.

### From Views
Use `$` prefix in expressions:

```json
{
  "tag": "input",
  "attrs": {
    "value": "$newTodoText",
    "placeholder": "What needs to be done?"
  }
}
```

### From JavaScript
Context is a ReactiveStore - access current value and subscribe to changes:

```javascript
// Read current context value (read-only!)
console.log(actor.context.value.todos);
console.log(actor.context.value.viewMode);

// Subscribe to context changes
const unsubscribe = actor.context.subscribe((context) => {
  console.log('Context updated:', context);
});

// Mutate context (via state machines only - goes through CoValue persistence!)
// ❌ Don't do this (bypasses CoValue persistence):
// actor.context.value.todos.push({...});
// actor.context.value.newTodoText = "New text";

// ✅ Do this instead (goes through persisted CoValue):
actor.actorEngine.stateEngine.send(
  actor.machine.id,
  'CREATE_TODO',
  {text: 'New todo'}
);
```

**Key Pattern:** 
- Context is a ReactiveStore backed by a persisted CoValue
- Use `.value` to read current data (read-only!)
- Use `.subscribe()` to watch for changes
- **Never mutate `.value` directly** - always go through state machine → CoValue persistence
- This is the universal pattern - every CoValue is accessible as a ReactiveStore via `read()` API
- **Single source of truth** - CoValue is the authoritative data store, ReactiveStore is the reactive access layer

## Context Updates

### Universal read() API Pattern

**CRITICAL:** Every CoValue is accessible as a ReactiveStore via the universal `read()` API:

```javascript
// Read any CoValue as ReactiveStore
const store = await dbEngine.execute({
  op: 'read',
  schema: 'co_zTodos123',  // Schema co-id
  key: 'co_zItem456'       // Item co-id (optional)
});

// Access current value
console.log('Current data:', store.value);

// Subscribe to updates
const unsubscribe = store.subscribe((data) => {
  console.log('Data updated:', data);
});
```

**This is the foundational pattern** - all data access uses this unified API. Context itself is a ReactiveStore, query objects use `read()` internally, and all CoValues are accessible this way.

### Via updateContext (Infrastructure Action)
Generic context field update (infrastructure, not a tool):

```json
{
  "updateContext": {
    "newTodoText": "$$newTodoText",
    "viewMode": "kanban"
  }
}
```

**Note:** `updateContext` is infrastructure that directly calls `updateContextCoValue()` to persist changes to the context CoValue (CRDT). It's not a tool - it's pure infrastructure.

**How it works:**
1. State machine action evaluates payload (resolves `$` and `$$` references)
2. Calls `actor.actorEngine.updateContextCoValue(actor, updates)` directly
3. Persists changes to context CoValue (CRDT)
4. Context ReactiveStore automatically updates (read-only derived data)
5. Views subscribe to context ReactiveStore and re-render automatically

## Context Best Practices

### ✅ DO:

- **Initialize all fields** - Avoid `undefined` values
- **Keep flat** - Avoid deeply nested objects
- **Use clear names** - `newTodoText` not `text` or `input`
- **Separate concerns** - Collections, UI state, form state
- **Store serializable data** - No functions, DOM refs, or classes
- **Use consistent naming** - `todosTodo`, `notesTodo` (pattern: `{schema}Todo`)
- **Compute boolean flags** - State machine computes, context stores, views reference
- **Use item lookup objects** - For item-specific conditional styling (e.g., `draggedItemIds`)
- **Always go through CoValue persistence** - Everything must be persisted, no in-memory hacks
- **Access via ReactiveStore** - Use universal `read()` API pattern
- **Use generic reusable context keys** - Names like `list`, `messages` that fit view template slots
- **Extract hardcoded strings** - Put all UI text in context variables (e.g., `toggleButtonText`, `payloadLabel`)
- **Use strict `$$` syntax** - All map expressions must use `$$` prefix for item properties

### ❌ DON'T:

- **Don't mutate directly** - Always use `updateContext` action in state machines
- **Don't bypass CoValue persistence** - Never mutate `actor.context.value` directly
- **Don't use in-memory mutation hacks** - Everything must go through persisted CoValues
- **Don't use `@context/update` tool** - Removed, use `updateContext` infrastructure action instead
- **Don't store UI elements** - No DOM references
- **Don't store functions** - Only JSON-serializable data
- **Don't mix concerns** - Separate data from UI state
- **Don't use reserved keys** - Avoid `$schema`, `$id`, `@actors`, `inbox`, etc.
- **Don't compute in views** - All computation happens in state machine
- **Don't hardcode strings in views** - Extract all UI text to context variables
- **Don't use specific names** - Avoid `todos`, `allMessages` - use generic `list`, `messages` instead
- **Don't skip `$$` prefix** - Map expressions must use strict `$$` syntax (e.g., `$$source.role`, not `source.role`)

## Extracting Hardcoded Strings to Context Variables

**CRITICAL:** Never hardcode strings in views. Always extract them to context variables!

**Why?**
- ✅ **Reusable** - Same view can work with different text
- ✅ **Maintainable** - Change text in one place (context)
- ✅ **Consistent** - Same variable names across your app
- ✅ **AI-friendly** - LLMs can understand and generate correct patterns

**Example: List View**

**Context:**
```json
{
  "list": {
    "schema": "@schema/todos"
  },
  "toggleButtonText": "✓",
  "deleteButtonText": "✕"
}
```

**View:**
```json
{
  "$each": {
    "items": "$list",
    "template": {
      "children": [
        {
          "tag": "button",
          "text": "$toggleButtonText"
        },
        {
          "tag": "button",
          "text": "$deleteButtonText"
        }
      ]
    }
  }
}
```

**Example: Agent View with Labels**

**Context:**
```json
{
  "listViewLabel": "List",
  "logsViewLabel": "Logs",
  "inputPlaceholder": "Add a new todo...",
  "addButtonText": "Add"
}
```

**View:**
```json
{
  "children": [
    {
      "tag": "button",
      "text": "$listViewLabel"
    },
    {
      "tag": "button",
      "text": "$logsViewLabel"
    },
    {
      "tag": "input",
      "attrs": {
        "placeholder": "$inputPlaceholder"
      }
    },
    {
      "tag": "button",
      "text": "$addButtonText"
    }
  ]
}
```

**Pattern:**
- ✅ Extract all UI text to context variables
- ✅ Use descriptive names (`toggleButtonText`, not `btn1`)
- ✅ Keep variable names consistent across views
- ✅ Use generic names that can be reused (`listViewLabel`, not `todoListViewLabel`)

## Context Schema Design

### Example: Todo Application

```json
{
  "context": {
    // Reactive data (query objects) - use generic names
    "list": {
      "schema": "@schema/todos",
      "filter": null
    },
    
    // Derived/filtered reactive data
    "listTodo": {
      "schema": "@schema/todos",
      "filter": { "done": false }
    },
    "listDone": {
      "schema": "@schema/todos",
      "filter": { "done": true }
    },
    
    // UI text (extracted from views)
    "toggleButtonText": "✓",
    "deleteButtonText": "✕",
    "addButtonText": "Add",
    "inputPlaceholder": "Add a new todo...",
    
    // UI state
    "viewMode": "list",             // "list" | "kanban"
    "isModalOpen": false,           // boolean
    
    // Form state
    "newTodoText": "",              // string
    
    // Transient drag-drop state
    "draggedItemId": null,          // string | null
    "draggedItemSchema": null,      // string | null
    "draggedItemIds": {},           // { [itemId: string]: boolean } - Item lookup object
    
    // Computed boolean flags (for conditional styling)
    "listButtonActive": true,       // Computed by state machine
    "kanbanButtonActive": false     // Computed by state machine
  }
}
```

**Entity schema:**
```typescript
interface Todo {
  id: string;           // Auto-generated by @db tool
  text: string;         // User input
  done: boolean;        // Completion status
  createdAt?: number;   // Optional timestamp
}
```

### Example: Notes Application

```json
{
  "context": {
    "notes": [],                    // Array<Note>
    "selectedNoteId": null,         // string | null
    "searchQuery": "",              // string
    "filteredNotes": [],            // Array<Note> (search results)
    "editorContent": "",            // string
    "isSaving": false               // boolean
  }
}
```

## Context Reactivity

MaiaOS automatically updates your UI when data changes. There are two types of reactivity:

### 1. Reactive Data (Query Objects) - Automatic ✨

When you use **query objects** in context, MaiaOS automatically keeps them up to date:

```
User creates a todo (via @db tool)
  ↓
Database stores the new todo
  ↓
Database ReactiveStore notifies subscribers: "Data changed!"
  ↓
Context ReactiveStore (from query object) receives update
  ↓
Context ReactiveStore updates context.todos = [new data]
  ↓
ViewEngine re-renders (batched via ReactiveStore subscriptions)
  ↓
User sees new todo in the list! ✨
```

**Key insight:** You never manually update `context.todos`. The universal `read()` API:
1. Reads from persisted CoValue (single source of truth)
2. Returns a ReactiveStore that automatically updates when the CoValue changes
3. Context ReactiveStore subscribes to the data ReactiveStore
4. View subscribes to context ReactiveStore and re-renders

**Everything is persisted to CoValues under the hood - no in-memory mutation hacks!** Every CoValue is accessible as a reactive store via `read()` API.

### 2. UI State - Manual (via Tools)

When you update **UI state** (like form inputs, view modes, etc.), you explicitly update context via tools:

```
State machine uses updateContext action (infrastructure)
  ↓
Tool completes successfully
  ↓
StateEngine sends SUCCESS event
  ↓
State machine transitions
  ↓
ActorEngine.rerender(actor)
  ↓
ViewEngine re-renders with new context
  ↓
User sees updated UI
```

**Example:**

```json
{
        "updateContext": {
  "payload": {
    "newTodoText": "",
    "viewMode": "kanban"
  }
}
```

### Summary

- **Query objects** → Automatic reactivity via universal `read()` API (ReactiveStore watches for changes)
- **UI state** → Manual updates (you explicitly update via `updateContext` infrastructure action)
- **Both trigger re-renders** → Your view stays in sync
- **Universal Pattern** → Every CoValue is accessible as ReactiveStore via `read()` API

See [Reactive Data System](../developers/06_reactive-queries.md) for detailed examples.

## Derived Data Patterns

### Pattern 1: Filtered Query Objects (Recommended) ⭐

Use **query objects with filters** to get filtered data automatically:

```json
{
  "context": {
    "todosTodo": {
      "schema": "@schema/todos",
      "filter": { "done": false }
    },
    "todosDone": {
      "schema": "@schema/todos",
      "filter": { "done": true }
    }
  }
}
```

**What happens:**
- MaiaOS automatically fetches filtered data
- When a todo is toggled, it automatically moves between lists
- No manual filtering needed!

### Pattern 2: Compute Aggregates

Use computed values for counts, percentages, etc.:

```json
{
  "states": {
    "idle": {
      "entry": {
        "updateContext": {
          "todosCount": { "$length": "$todos" },
          "completedCount": { "$length": "$todosDone" },
          "progressPercent": {
            "$divide": [
              { "$multiply": ["$completedCount", 100] },
              "$todosCount"
            ]
          }
        }
      }
    }
  }
}
```

**Or compute in a custom tool:**

```javascript
// In custom @compute/stats tool
export default {
  async execute(actor, payload) {
    const todos = actor.context.todos;
    const completed = todos.filter(t => t.done);
    
    Object.assign(actor.context, {
      todosCount: todos.length,
      completedCount: completed.length,
      progressPercent: (completed.length / todos.length) * 100
    });
  }
};
```

### Pattern 3: Client-Side Filtering (For Search/Sort)

Use client-side filtering for dynamic UI filtering (search, sort):

```json
{
  "container": {
    "tag": "ul",
    "$each": {
      "items": {
        "$filter": {
          "items": "$todos",
          "condition": {
            "$contains": ["$$item.text", "$searchQuery"]
          }
        }
      },
      "template": {
        "tag": "li",
        "text": "$$item.text"
      }
    }
  }
}
```

**When to use each:**
- ✅ **Query object filters** - For persistent filters (incomplete vs. completed)
- ✅ **Client-side filters** - For temporary UI filters (search, sort)
- ✅ **Computed values** - For calculations (counts, percentages)

## Context Debugging

```javascript
// Expose actor globally
window.actor = actor;

// Inspect context (ReactiveStore)
console.log('Current context:', actor.context.value);

// Subscribe to context changes
const unsubscribe = actor.context.subscribe((context) => {
  console.log('Context changed:', context);
});

// Serialize context
console.log(JSON.stringify(actor.context.value, null, 2));
```

## Context Persistence

Context can be serialized and persisted:

```javascript
// Save to localStorage
localStorage.setItem(
  `actor_${actor.id}`,
  JSON.stringify(actor.context.value)
);

// Restore from localStorage
const saved = localStorage.getItem(`actor_${actor.id}`);
if (saved) {
  // Update context via state machine, not direct mutation
  actor.actorEngine.stateEngine.send(
    actor.machine.id,
    'RESTORE_CONTEXT',
    JSON.parse(saved)
  );
}

// Export/import
function exportContext(actor) {
  return JSON.stringify(actor.context.value);
}

function importContext(actor, jsonString) {
  // Update context via state machine, not direct mutation
  actor.actorEngine.stateEngine.send(
    actor.machine.id,
    'RESTORE_CONTEXT',
    JSON.parse(jsonString)
  );
}
```

## Context Validation

You can validate context structure:

```javascript
function validateContext(context, schema) {
  for (const [key, type] of Object.entries(schema)) {
    const value = context[key];
    
    if (type === 'array' && !Array.isArray(value)) {
      throw new Error(`Expected ${key} to be array`);
    }
    if (type === 'string' && typeof value !== 'string') {
      throw new Error(`Expected ${key} to be string`);
    }
    if (type === 'boolean' && typeof value !== 'boolean') {
      throw new Error(`Expected ${key} to be boolean`);
    }
  }
}

// Usage
validateContext(actor.context.value, {
  todos: 'array',
  newTodoText: 'string',
  viewMode: 'string',
  isModalOpen: 'boolean'
});
```

## Next Steps

- Learn about [State Machines](./05-state.md) - How context is orchestrated
- Explore [Tools](./06-tools.md) - How context is mutated
- Understand [Views](./07-views.md) - How context is rendered
- Read [Skills](./03-skills.md) - How AI queries context
