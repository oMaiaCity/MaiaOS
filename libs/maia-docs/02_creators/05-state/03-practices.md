# Process Handler Practices

## Complete Example: Todo Process Handler

```json
{
  "$factory": "°Maia/factory/process",
  "$id": "°Maia/actor/services/todos/process",
  "@label": "@maia/actor/services/todos/process",
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
    ],
    "SUCCESS": [
      {
        "ctx": {}
      }
    ],
    "ERROR": [
      {
        "ctx": {
          "error": "$$errors.0.message"
        }
      }
    ],
    "RETRY": [
      {
        "ctx": {
          "error": null
        }
      }
    ],
    "DISMISS": [
      {
        "ctx": {
          "error": null
        }
      }
    ]
  }
}
```

## Event Flow

```
User clicks button
  ↓
ViewEngine captures event
  ↓
deliverEvent() adds to actor inbox
  ↓
processMessages() processes inbox
  ↓
ProcessEngine.send(eventType, payload)
  ↓
Handler for event runs actions in order
  ↓
op executes → DataEngine
  ↓
On failure: ProcessEngine delivers ERROR to source actor
  ↓
On success: tell(SUCCESS) to source actor
  ↓
ctx updates written to context CoValue
  ↓
ViewEngine re-renders (reactive subscriptions)
```

## Op Failure Handling

When an `op` action fails:
- ProcessEngine automatically delivers `ERROR` to the actor that sent the event (`$$source`)
- The ERROR payload includes `{ errors: [...] }`
- Handle ERROR in your process to update context (e.g. show error message):

```json
{
  "ERROR": [
    {
      "ctx": {
        "error": "$$errors.0.message"
      }
    }
  ]
}
```

## Accessing Op Results

When `op` succeeds, the result is stored in `process.lastToolResult` and available to subsequent actions in the same handler. For `tell`, you can pass result data:

```json
{
  "CREATE_TODO": [
    {
      "op": {
        "create": {
          "factory": "°Maia/factory/data/todos",
          "data": { "text": "$$value", "done": false }
        }
      }
    },
    {
      "tell": {
        "target": "$$source",
        "type": "SUCCESS",
        "payload": {
          "id": "$$result.id",
          "text": "$$result.text"
        }
      }
    }
  ]
}
```

**Note:** `$$result` refers to the result of the previous `op` in the same handler run.

## Best Practices

### ✅ DO:

- Keep handlers focused (single responsibility per event)
- Use guards for conditional logic when needed
- Handle both SUCCESS and ERROR events (via `tell` or `ctx`)
- Name events as verbs (CREATE_TODO, TOGGLE_TODO, DELETE_TODO)
- Use `$$` for event payloads, `$` for context
- **Compute boolean flags** — Process handler computes, context stores, views reference
- **Maintain item lookup objects** — For item-specific conditional styling
- **Update context via ctx** — Always use `ctx` action, never mutate directly
- **Tell SUCCESS/ERROR to source** — So UI actors can clear loading state or show errors

### ❌ DON'T:

- Create deeply nested handler logic (keep flat)
- Forget error handling (ERROR handler with ctx)
- Use `$` for event payload fields (use `$$`)
- **Don't put conditionals in views** — Compute flags in process handler instead
- **Don't mutate context directly** — Always use `ctx` action
- **Don't update context from views** — Views send events, process handlers update context

## Debugging Process Handlers

```javascript
// Access process
actor.process?.definition

// Send events manually (for testing)
actor.actorOps.deliverEvent(
  'test-sender-id',
  actor.id,
  'CREATE_TODO',
  { value: 'Test todo' }
);
```

## Next Steps

- Explore [Tools](./06-tools/) — How service actors (e.g. @db) work
- Learn about [Views](./08-views/) — How UI sends events
- Understand [Context](./04-context/) — Data process handlers manipulate
