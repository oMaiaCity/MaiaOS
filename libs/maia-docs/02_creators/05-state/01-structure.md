# Process Structure

Create a file named `{name}.process.maia`:

```json
{
  "$factory": "°Maia/factory/process",
  "$id": "°Maia/actor/services/todos/process",
  "@label": "@maia/actor/services/todos/process",
  "handlers": {
    "CREATE_TODO": [
      {
        "op": {
          "create": {
            "factory": "°Maia/factory/data/todos",
            "data": {
              "text": "$$value",
              "done": false
            }
          }
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
    "TOGGLE_TODO": [
      {
        "op": {
          "update": {
            "id": "$$id",
            "data": {
              "done": { "$not": "$$done" }
            }
          }
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
    "DELETE_TODO": [
      {
        "op": {
          "delete": {
            "id": "$$id"
          }
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

**Note:**
- `$factory` and `$id` use factory references (`°Maia/factory/process` or `@factory/process`) that are transformed to co-ids during seeding
- The `factory` field in `op.create` can be a factory reference (`°Maia/factory/data/todos`) or co-id (`co_z...`) — references are resolved at runtime

## Handler Structure

```json
{
  "handlers": {
    "EVENT_NAME": [
      { "op": {...} },
      { "ctx": {...} },
      { "tell": {...} },
      { "ask": {...} },
      { "guard": {...} },
      { "function": true }
    ]
  }
}
```

### Action Types

| Action | Purpose |
|--------|---------|
| `op` | Data operation (create, update, delete) — calls DataEngine directly |
| `ctx` | Update context CoValue |
| `tell` | Fire-and-forget message to another actor |
| `ask` | Request-response to another actor (replyTo = sender) |
| `guard` | Conditional — only run following actions if guard passes |
| `function` | Run actor's executableFunction (for service actors like @db) |

### `op` — Data Operations

Direct DataEngine calls. No tool indirection.

**Create:**
```json
{
  "op": {
    "create": {
      "factory": "°Maia/factory/data/todos",
      "data": {
        "text": "$$value",
        "done": false
      }
    }
  }
}
```

**Update:**
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

**Delete:**
```json
{
  "op": {
    "delete": {
      "id": "$$id"
    }
  }
}
```

**Important:** If `op` fails, ProcessEngine automatically delivers `ERROR` to the event source. On success, you typically `tell` SUCCESS to the source.

### `ctx` — Context Updates

Update the actor's context CoValue. All `ctx` updates in a handler run are batched and written once at the end.

```json
{
  "ctx": {
    "newTodoText": "",
    "error": null
  }
}
```

Use MaiaScript expressions for computed values:

```json
{
  "ctx": {
    "listButtonActive": { "$eq": ["$$viewMode", "list"] },
    "kanbanButtonActive": { "$eq": ["$$viewMode", "kanban"] }
  }
}
```

### `tell` — Send Message to Another Actor

Fire-and-forget. Target can be a co-id or expression (`$$source`, `°Maia/actor/services/todos`).

```json
{
  "tell": {
    "target": "$$source",
    "type": "SUCCESS",
    "payload": {}
  }
}
```

```json
{
  "tell": {
    "target": "°Maia/actor/services/todos",
    "type": "TOGGLE_TODO",
    "payload": {
      "id": "$$id",
      "done": "$$done"
    }
  }
}
```

### `guard` — Conditional Actions

Only run the following actions if the guard passes. Guards can use `$onlyWhenOriginated` (event came from this actor's view) or schema-based context validation.

```json
{
  "guard": {
    "$onlyWhenOriginated": true
  }
},
{
  "ctx": { "phase": "submitted" }
}
```

## Payload Resolution

Use MaiaScript expressions in action configs:

### Context Variables (`$`)
```json
{
  "data": {
    "text": "$newTodoText",
    "mode": "$viewMode"
  }
}
```

### Event Payload (`$$`)
```json
{
  "data": {
    "id": "$$id",
    "value": "$$value",
    "source": "$$source"
  }
}
```

**`$$source`** — Co-id of the actor that sent the event (for `tell` back to caller).

## Computing Boolean Flags for Conditional Styling

**CRITICAL: Views contain zero conditional logic.** Process handlers compute boolean flags and lookup objects that views reference.

**Pattern: Process Handler Computes → View References → CSS Styles**

```json
{
  "SWITCH_VIEW": [
    {
      "ctx": {
        "viewMode": "$$viewMode",
        "listButtonActive": { "$eq": ["$$viewMode", "list"] },
        "kanbanButtonActive": { "$eq": ["$$viewMode", "kanban"] },
        "currentView": {
          "$if": {
            "condition": { "$eq": ["$$viewMode", "list"] },
            "then": "@list",
            "else": "@kanban"
          }
        }
      }
    }
  ]
}
```

**View references:**
```json
{
  "attrs": {
    "data": "$listButtonActive"
  }
}
```
