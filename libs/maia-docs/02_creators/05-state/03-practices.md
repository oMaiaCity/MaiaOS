- Test with empty data (handle empty arrays gracefully)
- Use schema references (`@schema/todos`) in context - they're resolved automatically

**❌ DON'T:**
- Don't define queries in state machines (use context files instead)
- Don't manually modify query stores directly
- Don't use state machines for queries (only for mutations)
- Don't filter data in views (use query object filters in context instead)
- Don't forget to handle SUCCESS/ERROR events for mutations
- Don't use `mapData` action in state machines (deprecated pattern)

### Troubleshooting

**Data Not Appearing:**
1. Are query objects defined in your context file (`.context.maia`)?
2. Check browser console for errors
3. Is the schema reference correct? (`@schema/todos` or `co_z...`)

**Data Not Updating:**
1. Are you using `@db` tool in state machines to modify data?
2. Are query stores properly subscribed? (check `context.@stores`)
3. Check console logs for SUCCESS/ERROR events

## Complete Example: Todo State Machine

```json
{
  "$type": "state",
  "$id": "state_todo_001",
  "initial": "idle",
  
  "states": {
    "idle": {
      "on": {
        "UPDATE_INPUT": {
          "target": "idle",
          "actions": [{
            "updateContext": {"newTodoText": "$$newTodoText"}
          }]
        },
        "CREATE_TODO": {
          "target": "creating",
        },
        "TOGGLE_TODO": {
          "target": "toggling",
        },
        "DELETE_TODO": {
          "target": "deleting"
        },
        "SWITCH_VIEW": {
          "target": "idle",
          "actions": [{
            "updateContext": {
              "viewMode": "$$viewMode",
              "listButtonActive": {"$eq": ["$$viewMode", "list"]},
              "kanbanButtonActive": {"$eq": ["$$viewMode", "kanban"]},
              "currentView": {
                "$if": {
                  "condition": {"$eq": ["$$viewMode", "list"]},
                  "then": "@list",
                  "else": "@kanban"
                }
              }
            }
          }]
        }
      }
    },
    
    "creating": {
      "entry": {
        "tool": "@db",
        "payload": {
          "op": "create",
          "schema": "@schema/todos",
          "data": {"text": "$newTodoText", "done": false}
        }
      },
      "on": {
        "SUCCESS": "idle",
        "ERROR": "error"
      }
    },
    
    "toggling": {
      "entry": {
        "tool": "@db",
        "payload": {
          "op": "update",
          "id": "$$id",
          "data": {
            "done": { "$not": "$existing.done" }
          }
        }
      },
      "on": {
        "SUCCESS": "idle",
        "ERROR": "error"
      }
    },
    
    "deleting": {
      "entry": {
        "tool": "@db",
        "payload": {
          "op": "delete",
          "schema": "@schema/todos",
          "id": "$$id"
        }
      },
      "on": {
        "SUCCESS": "idle",
        "ERROR": "error"
      }
    },
    
    "error": {
      "on": {
        "RETRY": "idle",
        "DISMISS": "idle"
      }
    }
  }
}
```

## Event Flow

```
User clicks button
  ↓
ViewEngine captures event
  ↓
StateEngine.send("CREATE_TODO", {text: "..."})
  ↓
StateEngine checks current state's "on" handlers
  ↓
Evaluates guard (if present)
  ↓
Executes exit actions (if leaving state)
  ↓
Transitions to target state
  ↓
Executes entry actions (tool invocations)
  ↓
Tool mutates actor.context
  ↓
StateEngine sends SUCCESS/ERROR event (auto)
  ↓
Handles SUCCESS/ERROR transition
  ↓
ActorEngine.rerender() (if state changed)
```

## Automatic Tool Events

When a tool executes in an `entry` action:
- Tool succeeds → StateEngine auto-sends `SUCCESS` event with tool result in payload
- Tool fails → StateEngine auto-sends `ERROR` event

Handle these in your state definition:

```json
{
  "creating": {
    "entry": {"tool": "@db", "payload": { "op": "create", ... }},
    "on": {
      "SUCCESS": {
        "target": "idle",
        "actions": [
          {
            "tool": "@core/publishMessage",
            "payload": {
              "type": "TODO_CREATED",
              "payload": {
                "id": "$$result.id",      // ← Access tool result via $$result
                "text": "$$result.text"   // ← Tool result is available in SUCCESS handler
              }
            }
          }
        ]
      },
      "ERROR": "error"
    }
  }
}
```

**Accessing Tool Results:**
- Tool results are available in SUCCESS event payload as `$$result`
- Use `$$result.propertyName` to access specific result properties
- Example: `$$result.id`, `$$result.text`, `$$result.draggedItemId`

## Best Practices

### ✅ DO:

- Keep states focused (single responsibility)
- Use guards to validate transitions
- Handle both SUCCESS and ERROR events
- Name states as nouns (idle, creating, loading)
- Name events as verbs (CREATE_TODO, TOGGLE_TODO)
- Use `$$` for event payloads, `$` for context
- **Compute boolean flags** - State machine computes, context stores, views reference
- **Maintain item lookup objects** - For item-specific conditional styling
- **Update context via infrastructure** - Always use `updateContext` action, never mutate directly
- **Handle errors in state machines** - Use ERROR event handlers to update error context

### ❌ DON'T:

- Put logic in state machines (use tools)
- Create deeply nested states (keep flat)
- Forget error handling
- Use `$` for event payload fields
- Create cycles without exit conditions
- **Don't put conditionals in views** - Compute flags in state machine instead
- **Don't mutate context directly** - Always use `updateContext` infrastructure action
- **Don't update context from views** - Views send events, state machines update context
- **Don't update context from tools** - Tools are invoked by state machines, not the other way around

## Debugging State Machines

```javascript
// Access state machine
actor.machine.currentState  // "idle", "creating", etc.

// Send events manually
actor.actorEngine.stateEngine.send(
  actor.machine.id,
  'CREATE_TODO',
  {text: 'Test todo'}
);

// View state definition
actor.machine.definition
```

## Next Steps

- Explore [Tools](./06-tools.md) - Actions state machines invoke
- Learn about [Views](./07-views.md) - How UI sends events
- Understand [Context](./04-context.md) - Data state machines manipulate
- Build a [Kanban Board](../examples/kanban-board.md) - See queries in action