
## Managing Item Lookup Objects

For item-specific conditional styling, **state machines compute lookup objects** in context:

**State Machine:**
```json
{
  "SELECT_ITEM": {
    "target": "idle",
    "actions": [
      {
        "updateContext": {
          "selectedItems": { "$$itemId": true }  // Lookup object: { "co_z123": true }
        }
      }
    ]
  }
}
```

**View uses lookup (simple reference - no conditionals!):**
```json
{
  "attrs": {
    "data": {
      "selected": "$selectedItems.$$id"  // Looks up selectedItems[item.id] → true/false
    }
  }
}
```

**CSS handles styling:**
```json
{
  "item": {
    "data": {
      "selected": {
        "true": {
          "background": "{colors.primary}",
          "color": "white"
        }
      }
    }
  }
}
```

**Why lookup objects instead of `$eq` in views?**
- Views are dumb templates - no conditional logic allowed
- Lookup objects are resolved values (can be persisted to CoJSON)
- State machines handle all logic, views just reference computed values

## Working with Data (Reactive Queries)

**CRITICAL:** Reactive data queries are defined **directly in context files**, not in state machines. State machines handle **mutations** (create, update, delete), while **queries** are declared in context.

### The Correct Pattern: Query Objects in Context

**✅ DO:** Define query objects directly in your context file (`.context.maia`):

```json
{
  "$schema": "@schema/context",
  "$id": "@context/todo",
  "todos": {
    "schema": "@schema/todos",
    "filter": null
  },
  "todosTodo": {
    "schema": "@schema/todos",
    "filter": { "done": false }
  },
  "todosDone": {
    "schema": "@schema/todos",
    "filter": { "done": true }
  }
}
```

**What happens:**
1. Query objects are declared in context (`.context.maia` file)
2. MaiaOS automatically creates reactive query stores from these declarations
3. Stores are stored in `actor._queryStores[contextKey]`
4. Stores are marked in `context.@stores` for ViewEngine discovery
5. ViewEngine subscribes to stores and re-renders when data changes

**Accessing data in views:**
```json
{
  "$each": {
    "items": "$todos",
    "template": {
      "tag": "div",
      "text": "$$text"
    }
  }
}
```

**Important:**
- Query objects are defined in **context files**, not state machines
- State machines handle **mutations only** (create, update, delete via `@db` tool)
- Schema can be a schema reference (`@schema/todos`) or co-id (`co_z...`) - references are resolved automatically
- Query stores are ReactiveStore objects (can't be stored in CoValues)
- Stores are stored in `actor._queryStores` and marked in `context.@stores`

**See [Context - Reactive Data](./04-context.md#1-reactive-data-query-objects-) for complete documentation on query objects.**

### Creating, Updating, Deleting Data

Use the `@db` tool with different `op` values:

#### Create

```json
{
  "tool": "@db",
  "payload": {
    "op": "create",
    "schema": "@schema/todos",
    "data": {
      "text": "$newTodoText",
      "done": false
    }
  }
}
```

#### Update

```json
{
  "tool": "@db",
  "payload": {
    "op": "update",
    "schema": "@schema/todos",
    "id": "$$id",
    "data": {
      "text": "Updated text"
    }
  }
}
```

#### Delete

```json
{
  "tool": "@db",
  "payload": {
    "op": "delete",
    "schema": "@schema/todos",
    "id": "$$id"
  }
}
```

#### Toggle (Using Update with Expression)

Toggle is not a separate operation. Use `update` with an expression:

```json
{
  "tool": "@db",
  "payload": {
    "op": "update",
    "id": "$$id",
    "data": {
      "done": { "$not": "$existing.done" }
    }
  }
}
```

**Note:** For `update` and `delete` operations, `schema` is not required - it's extracted from the CoValue's headerMeta automatically.

### Complete Example: Todo List

**Context (`todo.context.maia`):**
```json
{
  "$schema": "@schema/context",
  "$id": "@context/todo",
  "todos": {
    "schema": "@schema/todos",
    "filter": null
  },
  "todosTodo": {
    "schema": "@schema/todos",
    "filter": { "done": false }
  },
  "todosDone": {
    "schema": "@schema/todos",
    "filter": { "done": true }
  },
  "newTodoText": "",
  "viewMode": "list"
}
```

**State Machine (`todo.state.maia`):**
```json
{
  "$schema": "@schema/state",
  "$id": "@state/todo",
  "initial": "idle",
  "states": {
    "idle": {
      "on": {
        "UPDATE_INPUT": {
          "target": "idle",
          "actions": [{
            "updateContext": { "newTodoText": "$$value" }
          }]
        },
        "CREATE_TODO": {
          "target": "creating",
        }
      }
    },
    "creating": {
      "entry": [
        {
          "tool": "@db",
          "payload": {
            "op": "create",
            "schema": "@schema/todos",
            "data": {
              "text": "$newTodoText",
              "done": false
            }
          }
        },
        {
          "updateContext": { "newTodoText": "" }
        }
      ],
      "on": {
        "SUCCESS": "idle",
        "ERROR": "error"
      }
    },
    "error": {
      "on": {
        "RETRY": "idle"
      }
    }
  }
}
```

**What happens:**
1. Query objects (`todos`, `todosTodo`, `todosDone`) are declared in context file
2. MaiaOS automatically creates reactive query stores from these declarations
3. Stores are stored in `actor._queryStores` and marked in `context.@stores`
4. ViewEngine subscribes to stores and re-renders when data changes
5. When creating a todo via `@db` tool, all query stores automatically update

**View:**
```json
{
  "children": [
    {
      "tag": "input",
      "attrs": {
        "value": "$newTodoText",
        "placeholder": "What needs to be done?"
      },
      "$on": {
        "input": {
          "send": "UPDATE_INPUT",
          "payload": { "value": "@inputValue" }
        },
        "keydown": {
          "send": "CREATE_TODO",
          "key": "Enter"
        }
      }
    },
    {
      "$each": {
        "items": "$todos",
        "template": {
          "tag": "div",
          "text": "$$text"
        }
      }
    }
  ]
}
```

### Best Practices

**✅ DO:**
- Define query objects **in context files** (`.context.maia`), not state machines
- Use `@db` tool in state machines for all data mutations (create, update, delete)
- Use descriptive names (`todosTodo`, not `data1`)
- Filter in query objects (context), not in views
