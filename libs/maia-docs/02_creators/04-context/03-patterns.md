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
