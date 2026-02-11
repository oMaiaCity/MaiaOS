
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
