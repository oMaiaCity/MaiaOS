# Context (The Memory)

Think of context as your actor's **memory** - like a notebook where it writes things down!

**What's in the notebook?**
- What todos you have (`todos: [...]`)
- Whether a modal is open (`isModalOpen: false`)
- What text is in the input field (`newTodoText: "Buy milk"`)

Your actor looks at this notebook to know what to show and what to do!

## How It Works

```
1. You type "Buy milk" → Tool updates context: { newTodoText: "Buy milk" }
2. You click "Add" → Tool creates todo → Context updates: { todos: [...new todo] }
3. View looks at context → Sees new todo → Shows it on screen!
```

**The magic:** Your view automatically shows whatever is in context. Change the context, change what you see!

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

**How it works:**
1. You declare the query object in context
2. MaiaOS automatically subscribes to the database
3. When data changes, MaiaOS updates your context
4. Your view automatically re-renders

**Think of it like:** Subscribing to a newsletter - you tell them what you want, they send you updates automatically.

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

See [Reactive Data System](../developers/06_reactive-queries.md) for detailed examples.

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
// @db tool with op: "create"
export default {
  async execute(actor, payload) {
    const { op, schema, data } = payload;
    if (op === "create") {
      const entity = { id: Date.now().toString(), ...data };
      actor.context[schema].push(entity);
    }
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
    // Reactive data (query objects)
    "todos": {
      "schema": "@schema/todos",
      "filter": null
    },
    
    // Derived/filtered reactive data
    "todosTodo": {
      "schema": "@schema/todos",
      "filter": { "done": false }
    },
    "todosDone": {
      "schema": "@schema/todos",
      "filter": { "done": true }
    },
    
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
Database notifies observers: "Data changed!"
  ↓
SubscriptionEngine receives notification
  ↓
SubscriptionEngine updates context.todos = [new data]
  ↓
SubscriptionEngine schedules re-render (batched)
  ↓
ActorEngine.rerender(actor)
  ↓
ViewEngine re-renders with new context
  ↓
User sees new todo in the list! ✨
```

**Key insight:** You never manually update `context.todos`. SubscriptionEngine does it automatically when the database changes.

### 2. UI State - Manual (via Tools)

When you update **UI state** (like form inputs, view modes, etc.), you explicitly update context via tools:

```
Tool mutates context (via @context/update)
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
  "tool": "@context/update",
  "payload": {
    "newTodoText": "",
    "viewMode": "kanban"
  }
}
```

### Summary

- **Query objects** → Automatic reactivity (MaiaOS watches for changes)
- **UI state** → Manual updates (you explicitly update via tools)
- **Both trigger re-renders** → Your view stays in sync

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
        "tool": "@context/update",
        "payload": {
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
