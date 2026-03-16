# Process Handlers and Data

## Managing Item Lookup Objects

For item-specific conditional styling, **process handlers compute lookup objects** in context:

**Process Handler:**
```json
{
  "SELECT_ITEM": [
    {
      "ctx": {
        "selectedItems": { "$$itemId": true }
      }
    }
  ]
}
```

**View uses lookup (simple reference - no conditionals!):**
```json
{
  "attrs": {
    "data": {
      "selected": "$selectedItems.$$id"
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
- Views are dumb templates — no conditional logic allowed
- Lookup objects are resolved values (can be persisted to CoJSON)
- Process handlers handle all logic, views just reference computed values

## Working with Data (Reactive Queries)

**CRITICAL:** Reactive data queries are defined **directly in context files**, not in process handlers. Process handlers handle **mutations** (create, update, delete via `op`), while **queries** are declared in context.

### The Correct Pattern: Query Objects in Context

**✅ DO:** Define query objects directly in your context file (`.context.maia`):

```json
{
  "$factory": "@factory/context",
  "$id": "@context/todo",
  "todos": {
    "factory": "@factory/todos",
    "filter": null
  },
  "todosTodo": {
    "factory": "@factory/todos",
    "filter": { "done": false }
  },
  "todosDone": {
    "factory": "@factory/todos",
    "filter": { "done": true }
  }
}
```

**What happens:**
1. Query objects are declared in context (`.context.maia` file)
2. MaiaOS automatically creates reactive query stores from these declarations
3. ViewEngine subscribes to stores and re-renders when data changes
4. When you create/update/delete via `op`, all query stores automatically update

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
- Query objects are defined in **context files**, not process handlers
- Process handlers handle **mutations only** (create, update, delete via `op`)
- Factory can be a factory reference (`@factory/todos` or `°Maia/factory/data/todos`) or co-id (`co_z...`) — references are resolved at runtime

### Creating, Updating, Deleting Data

Use the `op` action with create, update, or delete:

#### Create

```json
{
  "op": {
    "create": {
      "factory": "°Maia/factory/data/todos",
      "data": {
        "text": "$newTodoText",
        "done": false
      }
    }
  }
}
```

#### Update

```json
{
  "op": {
    "update": {
      "id": "$$id",
      "data": {
        "text": "Updated text"
      }
    }
  }
}
```

#### Delete

```json
{
  "op": {
    "delete": {
      "id": "$$id"
    }
  }
}
```

#### Toggle (Using Update with Expression)

Toggle is not a separate operation. Use `update` with an expression:

```json
{
  "op": {
    "update": {
      "id": "$$id",
      "data": {
        "done": { "$not": "$$done" }
      }
    }
  }
}
```

**Note:** For `update` and `delete` operations, `factory` is not required — it's extracted from the CoValue's headerMeta automatically.

### Complete Example: Todo List

**Context (`todo.context.maia`):**
```json
{
  "$factory": "@factory/context",
  "$id": "@context/todo",
  "todos": {
    "factory": "@factory/todos",
    "filter": null
  },
  "todosTodo": {
    "factory": "@factory/todos",
    "filter": { "done": false }
  },
  "todosDone": {
    "factory": "@factory/todos",
    "filter": { "done": true }
  },
  "newTodoText": "",
  "viewMode": "list"
}
```

**Process Handler (`todo.process.maia`):**
```json
{
  "$factory": "°Maia/factory/process",
  "$id": "°Maia/actor/services/todos/process",
  "handlers": {
    "UPDATE_INPUT": [
      {
        "ctx": {
          "newTodoText": "$$value"
        }
      }
    ],
    "CREATE_TODO": [
      {
        "op": {
          "create": {
            "factory": "°Maia/factory/data/todos",
            "data": {
              "text": "$newTodoText",
              "done": false
            }
          }
        }
      },
      {
        "ctx": {
          "newTodoText": ""
        }
      },
      {
        "tell": {
          "target": "$$source",
          "type": "SUCCESS",
          "payload": {}
        }
      }
    ],
    "SUCCESS": [
      { "ctx": {} }
    ],
    "ERROR": [
      {
        "ctx": {
          "error": "$$errors.0.message"
        }
      }
    ]
  }
}
```

**What happens:**
1. Query objects (`todos`, `todosTodo`, `todosDone`) are declared in context file
2. MaiaOS creates reactive query stores from these declarations
3. ViewEngine subscribes to stores and re-renders when data changes
4. When creating a todo via `op.create`, all query stores automatically update

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
- Define query objects **in context files** (`.context.maia`), not process handlers
- Use `op` in process handlers for all data mutations (create, update, delete)
- Use descriptive names (`todosTodo`, not `data1`)
- Filter in query objects (context), not in views
- Use factory references (`@factory/todos` or `°Maia/factory/data/todos`) in context — they're resolved automatically

**❌ DON'T:**
- Don't define queries in process handlers (use context files instead)
- Don't manually modify query stores directly
- Don't use process handlers for queries (only for mutations)
- Don't filter data in views (use query object filters in context instead)
- Don't forget to handle SUCCESS/ERROR events (via `tell` or `ctx`)
- Don't forget to `tell` SUCCESS to the source actor after successful `op` (so the UI can clear loading state)
