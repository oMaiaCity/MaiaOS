# Context (Runtime State)

**Context** is the runtime data store for an actor. It holds all the state that tools manipulate and views render.

## Philosophy

> Context is the MEMORY of an actor. It's where all runtime data lives.

- **Actors** define initial context structure
- **Tools** mutate context
- **Views** read and display context
- **State machines** orchestrate context changes

## Context Definition

Context can be defined inline in the actor file or in a separate `.context.maia` file.

### Option 1: Inline Context

```json
{
  "$type": "actor",
  "id": "actor_todo_001",
  "stateRef": "todo",
  
  "context": {
    "todos": [],
    "newTodoText": "",
    "viewMode": "list"
  }
}
```

### Option 2: Separate Context File (Recommended)

**`todo.context.maia`:**
```json
{
  "$type": "context",
  "$id": "context_todo_001",
  
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
  "$type": "actor",
  "id": "actor_todo_001",
  "contextRef": "todo",  // ← References todo.context.maia
  "stateRef": "todo"
}
```

**Benefits of Separate Files:**
- ✅ Cleaner actor definitions
- ✅ Easier to maintain large contexts
- ✅ Better separation of concerns
- ✅ Context can be shared or versioned independently

## Context Types

### 1. Collections (Arrays)
Primary data storage:

```json
{
  "todos": [
    {"id": "1", "text": "Buy milk", "done": false},
    {"id": "2", "text": "Call mom", "done": true}
  ]
}
```

**Best practices:**
- Always initialize as empty array `[]`
- Include `id` field for entity tracking
- Keep entities flat when possible

### 2. Derived Data (Computed)
Filtered or transformed collections:

```json
{
  "todos": [...],           // Source collection
  "todosTodo": [...],       // Filtered: incomplete todos
  "todosDone": [...]        // Filtered: completed todos
}
```

**Note:** Derived data is computed by tools (e.g., `@mutation/create` updates filtered arrays).

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
  "guard": {"$ne": ["$newTodoText", ""]},
  "payload": {
    "text": "$newTodoText",
    "mode": "$viewMode"
  }
}
```

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
Direct property access:

```javascript
// Read context
console.log(actor.context.todos);
console.log(actor.context.viewMode);

// Mutate context (via tools only!)
// ❌ Don't do this:
// actor.context.todos.push({...});

// ✅ Do this instead:
actor.actorEngine.stateEngine.send(
  actor.machine.id,
  'CREATE_TODO',
  {text: 'New todo'}
);
```

## Context Updates

### Via Tools
The ONLY way to mutate context:

```javascript
// @mutation/create tool
export default {
  async execute(actor, payload) {
    const { schema, data } = payload;
    const entity = { id: Date.now().toString(), ...data };
    actor.context[schema].push(entity);
  }
};
```

### Via @context/update
Generic context field update:

```json
{
  "tool": "@context/update",
  "payload": {
    "newTodoText": "$$newTodoText",
    "viewMode": "kanban"
  }
}
```

JavaScript equivalent:

```javascript
export default {
  async execute(actor, payload) {
    Object.assign(actor.context, payload);
  }
};
```

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

### ❌ DON'T:

- **Don't mutate directly** - Always use tools
- **Don't store UI elements** - No DOM references
- **Don't store functions** - Only JSON-serializable data
- **Don't mix concerns** - Separate data from UI state
- **Don't use reserved keys** - Avoid `$type`, `$id`, `inbox`, etc.
- **Don't compute in views** - All computation happens in state machine

## Context Schema Design

### Example: Todo Application

```json
{
  "context": {
    // Primary data
    "todos": [],                    // Array<Todo>
    
    // Derived/filtered (computed by tools)
    "todosTodo": [],                // Array<Todo> where done=false
    "todosDone": [],                // Array<Todo> where done=true
    
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
    "listButtonActive": boolean,    // Computed by state machine
    "kanbanButtonActive": boolean   // Computed by state machine
  }
}
```

**Entity schema:**
```typescript
interface Todo {
  id: string;           // Auto-generated by @mutation/create
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

When context changes, actors automatically re-render:

```
Tool mutates context
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

## Derived Data Patterns

### Pattern 1: Filter Arrays
```javascript
// In @mutation/create tool
actor.context.todosTodo = actor.context.todos.filter(t => !t.done);
actor.context.todosDone = actor.context.todos.filter(t => t.done);
```

### Pattern 2: Compute Aggregates
```javascript
// In @context/update tool
actor.context.todosCount = actor.context.todos.length;
actor.context.completedCount = actor.context.todosDone.length;
actor.context.progressPercent = 
  (actor.context.completedCount / actor.context.todosCount) * 100;
```

### Pattern 3: Sort Collections
```javascript
// In @mutation/sort tool
actor.context.todosSorted = [...actor.context.todos].sort(
  (a, b) => a.text.localeCompare(b.text)
);
```

## Context Debugging

```javascript
// Expose actor globally
window.actor = actor;

// Inspect context
console.log(actor.context);

// Watch for changes
const originalRerender = actor.actorEngine.rerender;
actor.actorEngine.rerender = function(actor) {
  console.log('Context changed:', actor.context);
  return originalRerender.call(this, actor);
};

// Serialize context
console.log(JSON.stringify(actor.context, null, 2));
```

## Context Persistence

Context can be serialized and persisted:

```javascript
// Save to localStorage
localStorage.setItem(
  `actor_${actor.id}`,
  JSON.stringify(actor.context)
);

// Restore from localStorage
const saved = localStorage.getItem(`actor_${actor.id}`);
if (saved) {
  Object.assign(actor.context, JSON.parse(saved));
  actor.actorEngine.rerender(actor);
}

// Export/import
function exportContext(actor) {
  return JSON.stringify(actor.context);
}

function importContext(actor, jsonString) {
  Object.assign(actor.context, JSON.parse(jsonString));
  actor.actorEngine.rerender(actor);
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
validateContext(actor.context, {
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
