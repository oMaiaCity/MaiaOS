Create a file named `{name}.state.maia`:

```json
{
  "$schema": "@schema/state",
  "$id": "@state/todo",
  
  "initial": "idle",
  
  "states": {
    "idle": {
      "on": {
        "CREATE_TODO": {
          "target": "creating"
        }
      }
    },
    "creating": {
      "entry": {
        "tool": "@db",
        "payload": {
          "op": "create",
          "schema": "co_z...",
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

**Note:** 
- `$schema` and `$id` use schema references (`@schema/state`, `@state/todo`) that are transformed to co-ids during seeding
- The `schema` field in tool payloads must be a co-id (`co_z...`) - schema references (`@schema/todos`) are transformed to co-ids during seeding
- In your source files, you can use schema references, but at runtime they become co-ids

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

Entry and exit actions can be:
- **Single action object** - One tool or updateContext action
- **Array of actions** - Multiple actions executed in order
- **Co-id reference** - Reference to an action CoValue

**Single action:**
```json
{
  "creating": {
    "entry": {
      "tool": "@db",
      "payload": { "op": "create", ... }
    }
  }
}
```

**Multiple actions (array):**
```json
{
  "creating": {
    "entry": [
      {"tool": "@core/showLoading", "payload": {}},
      {"tool": "@db", "payload": { "op": "create", ... }},
      {"updateContext": { "newTodoText": "" }}
    ]
  }
}
```

**Important:** All `updateContext` actions in a single transition are batched together and written to the context CoValue once at the end. This ensures efficient CRDT updates.

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
      "guard": {
        "schema": {
          "type": "object",
          "properties": {
            "canSubmit": { "const": true },
            "status": { "const": "ready" }
          },
          "required": ["canSubmit", "status"]
        }
      }
    }
  }
}
```

**Note:** Guards validate against state/context conditions only. Payload validation (e.g., checking if email is not empty) happens in ActorEngine via message type schemas before the message reaches the state machine.

### Self-Transition (No State Change)
```json
{
  "on": {
    "UPDATE_INPUT": {
      "target": "idle",  // Stay in same state
      "actions": [{"updateContext": {...}}]
    }
  }
}
```

## Guards (Conditional Logic)

**CRITICAL ARCHITECTURAL SEPARATION:**

Guards are for **conditional logic** based on state/context conditions. They answer: "Should this transition happen given the current state?"

**Guards are NOT for payload validation** - payload validation happens in ActorEngine BEFORE the message reaches the state machine.

### Schema-Based Guards

Guards use JSON Schema to validate against the current state and context:

```json
{
  "guard": {
    "schema": {
      "type": "object",
      "properties": {
        "status": { "const": "ready" },
        "canSubmit": { "const": true }
      },
      "required": ["status", "canSubmit"]
    }
  }
}
```

This guard checks if `context.status` equals "ready" AND `context.canSubmit` is true.

### Guard Examples

**Check context state:**
```json
{
  "guard": {
    "schema": {
      "type": "object",
      "properties": {
        "status": { "const": "ready" }
      },
      "required": ["status"]
    }
  }
}
```

**Check multiple context conditions:**
```json
{
  "guard": {
    "schema": {
      "type": "object",
      "properties": {
        "canCreate": { "const": true },
        "isNotCreating": { "const": true }
      },
      "required": ["canCreate", "isNotCreating"]
    }
  }
}
```

**Check numeric context values:**
```json
{
  "guard": {
    "schema": {
      "type": "object",
      "properties": {
        "count": { "type": "number", "minimum": 1 }
      },
      "required": ["count"]
    }
  }
}
```

### When to Use Guards

**✅ Use guards for:**
- Checking if actor is in the right state to handle a message
- Checking context conditions (e.g., `context.canSubmit === true`)
- Conditional logic based on runtime state

**❌ Do NOT use guards for:**
- Payload validation (e.g., checking if `$$text` is not empty) - this belongs in message type schemas
- Data structure validation - this happens in ActorEngine before the state machine

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

## Computing Boolean Flags for Conditional Styling

**CRITICAL: Views contain zero conditional logic.** State machines compute boolean flags and lookup objects that views reference. This ensures clean separation of concerns and enables distributed message passing (only resolved values can be persisted to CoJSON).

**Pattern: State Machine Computes → View References → CSS Styles**

```json
{
  "SWITCH_VIEW": {
    "target": "idle",
    "actions": [{
      "updateContext": {
        "viewMode": "$$viewMode",
        "listButtonActive": {"$eq": ["$$viewMode", "list"]},      // Compute flag
        "kanbanButtonActive": {"$eq": ["$$viewMode", "kanban"]},   // Compute flag
        "currentView": {
          "$if": {
            "condition": {"$eq": ["$$viewMode", "list"]},
            "then": "@list",
            "else": "@kanban"
          }
        }
      }]
  }
}
```

**View references:**
```json
{
  "attrs": {
    "data": "$listButtonActive"  // Simple reference, no conditionals!
  }
}
```
