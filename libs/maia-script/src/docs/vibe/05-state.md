# State Machines

**State machines** define actor behavior through states, transitions, guards, and actions. They are **XState-like state machine definitions** that the StateEngine interprets at runtime.

## Philosophy

> State machines are the BRAIN of an actor. They define WHAT to do WHEN something happens.

- **Actors** have no logic (just configuration)
- **State Machines** define behavior flow
- **Tools** execute the actual work

## Basic Structure

Create a file named `{name}.state.maia`:

```json
{
  "$type": "state",
  "$id": "state_todo_001",
  
  "initial": "idle",
  
  "states": {
    "idle": {
      "on": {
        "CREATE_TODO": {
          "target": "creating",
          "guard": {"$ne": ["$newTodoText", ""]}
        }
      }
    },
    "creating": {
      "entry": {
        "tool": "@mutation/create",
        "payload": {
          "schema": "todos",
          "data": {"text": "$newTodoText", "done": false}
        }
      },
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

## State Definition

```json
{
  "stateName": {
    "entry": {...},      // Action(s) when entering state
    "exit": {...},       // Action(s) when leaving state
    "on": {              // Event handlers
      "EVENT_NAME": {...}
    }
  }
}
```

### Entry/Exit Actions

```json
{
  "creating": {
    "entry": {
      "tool": "@mutation/create",
      "payload": {...}
    }
  }
}
```

Or multiple actions:

```json
{
  "creating": {
    "entry": [
      {"tool": "@core/showLoading", "payload": {}},
      {"tool": "@mutation/create", "payload": {...}}
    ]
  }
}
```

## Transitions

### Simple Transition
```json
{
  "on": {
    "CANCEL": "idle"  // Just target state
  }
}
```

### Guarded Transition
```json
{
  "on": {
    "SUBMIT": {
      "target": "submitting",
      "guard": {"$ne": ["$formData.email", ""]}  // Only if email not empty
    }
  }
}
```

### Self-Transition (No State Change)
```json
{
  "on": {
    "UPDATE_INPUT": {
      "target": "idle",  // Stay in same state
      "actions": [{"tool": "@context/update", "payload": {...}}]
    }
  }
}
```

## Guards (Conditions)

Guards determine if a transition should occur:

```json
{
  "guard": {"$ne": ["$field", ""]}  // Field not empty
}

{
  "guard": {"$eq": ["$status", "ready"]}  // Status equals "ready"
}

{
  "guard": {
    "$and": [
      {"$ne": ["$email", ""]},
      {"$gt": ["$email.length", 5]}
    ]
  }
}
```

### Guard Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `$eq` | Equal | `{"$eq": ["$status", "active"]}` |
| `$ne` | Not equal | `{"$ne": ["$text", ""]}` |
| `$gt` | Greater than | `{"$gt": ["$count", 0]}` |
| `$lt` | Less than | `{"$lt": ["$count", 100]}` |
| `$gte` | Greater/equal | `{"$gte": ["$age", 18]}` |
| `$lte` | Less/equal | `{"$lte": ["$length", 500]}` |
| `$and` | Logical AND | `{"$and": [guard1, guard2]}` |
| `$or` | Logical OR | `{"$or": [guard1, guard2]}` |
| `$not` | Logical NOT | `{"$not": guard}` |

## Payload Resolution

Use MaiaScript expressions in payloads:

### Context Variables (`$`)
```json
{
  "payload": {
    "text": "$newTodoText",      // From actor.context.newTodoText
    "mode": "$viewMode"
  }
}
```

### Event Payload (`$$`)
```json
{
  "payload": {
    "id": "$$id",                // From event payload (e.g., {id: "123"})
    "value": "$$value"
  }
}
```

### Nested Objects (Recursive Evaluation)
```json
{
  "payload": {
    "schema": "todos",
    "data": {
      "text": "$newTodoText",    // Evaluated recursively
      "done": false,             // Literal value
      "timestamp": "$now"
    }
  }
}
```

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
            "tool": "@context/update",
            "payload": {"newTodoText": "$$newTodoText"}
          }]
        },
        "CREATE_TODO": {
          "target": "creating",
          "guard": {"$ne": ["$newTodoText", ""]}
        },
        "TOGGLE_TODO": {
          "target": "toggling",
          "guard": {"$ne": ["$$id", null]}
        },
        "DELETE_TODO": {
          "target": "deleting"
        },
        "SET_VIEW_MODE": {
          "target": "settingViewMode"
        }
      }
    },
    
    "creating": {
      "entry": {
        "tool": "@mutation/create",
        "payload": {
          "schema": "todos",
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
        "tool": "@mutation/toggle",
        "payload": {
          "schema": "todos",
          "id": "$$id",
          "field": "done"
        }
      },
      "on": {
        "SUCCESS": "idle",
        "ERROR": "error"
      }
    },
    
    "deleting": {
      "entry": {
        "tool": "@mutation/delete",
        "payload": {
          "schema": "todos",
          "id": "$$id"
        }
      },
      "on": {
        "SUCCESS": "idle",
        "ERROR": "error"
      }
    },
    
    "settingViewMode": {
      "entry": {
        "tool": "@core/setViewMode",
        "payload": {"viewMode": "$$viewMode"}
      },
      "on": {
        "SUCCESS": "idle"
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
- Tool succeeds → StateEngine auto-sends `SUCCESS` event
- Tool fails → StateEngine auto-sends `ERROR` event

Handle these in your state definition:

```json
{
  "creating": {
    "entry": {"tool": "@mutation/create", "payload": {...}},
    "on": {
      "SUCCESS": "idle",  // ← Automatic on tool success
      "ERROR": "error"    // ← Automatic on tool failure
    }
  }
}
```

## Best Practices

### ✅ DO:

- Keep states focused (single responsibility)
- Use guards to validate transitions
- Handle both SUCCESS and ERROR events
- Name states as nouns (idle, creating, loading)
- Name events as verbs (CREATE_TODO, TOGGLE_TODO)
- Use `$$` for event payloads, `$` for context

### ❌ DON'T:

- Put logic in state machines (use tools)
- Create deeply nested states (keep flat)
- Forget error handling
- Use `$` for event payload fields
- Create cycles without exit conditions

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
