# State Machines (The Brain)

Imagine a traffic light:
- It has **states**: Green, Yellow, Red
- It **changes states**: Green → Yellow → Red → Green
- **Rules** decide when to change: "After 30 seconds, go to next state"

**That's a state machine!** Your actor has states too, and rules for when to change them.

## A Simple Example: Creating a Todo

Your todo app might have these states:
- **idle**: Waiting for you to do something
- **creating**: Adding a new todo to the database
- **error**: Something went wrong

**What happens when you click "Add Todo":**

```
State: idle
  ↓
User clicks "Add Todo" button
  ↓
State machine says: "Go to 'creating' state"
  ↓
State: creating
  ↓
Tool creates the todo in database
  ↓
Tool says: "SUCCESS!"
  ↓
State machine says: "Go back to 'idle' state"
  ↓
State: idle (with your new todo!)
```

The state machine is like a traffic controller - it decides what happens next!

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
      "tool": "@db",
      "payload": { "op": "create", ... }
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
      {"tool": "@db", "payload": { "op": "create", ... }}
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

## Computing Boolean Flags for Conditional Styling

**Views contain zero conditional logic.** State machines compute boolean flags that views reference:

```json
{
  "SWITCH_VIEW": {
    "target": "idle",
    "actions": [{
      "tool": "@context/update",
      "payload": {
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

## Managing Item Lookup Objects

For item-specific conditional styling, tools maintain lookup objects in context:

```json
{
  "DRAG_START": {
    "target": "dragging",
    "actions": [{
      "tool": "@dragdrop/start",
      "payload": {"schema": "$$schema", "id": "$$id"}
    }]
  }
}
```

**Tool maintains lookup object:**
```javascript
// In @dragdrop/start tool
actor.context.draggedItemIds = actor.context.draggedItemIds || {};
actor.context.draggedItemIds[id] = true;  // Set this item as dragged
```

**View uses item lookup:**
```json
{
  "attrs": {
    "data": {
      "isDragged": "$draggedItemIds.$$id"  // Looks up draggedItemIds[item.id]
    }
  }
}
```

## Working with Data (Automatic Reactive Queries)

MaiaOS automatically keeps your data in sync - no tools needed! Just define what data you want in your context, and MaiaOS handles the rest.

### Think of it like a spreadsheet:
- You write formulas that reference other cells
- When you change a cell, all formulas update automatically
- You never have to manually "refresh" the spreadsheet

**That's how reactive queries work!**

### Quick Start: Getting Data

In your context file, define **query objects** that tell MaiaOS what data you want:

**`todos.context.maia`:**
```json
{
  "$type": "context",
  "todos": {
    "schema": "@schema/todos",
    "filter": null
  },
  "newTodoText": ""
}
```

**What happens:**
1. MaiaOS sees `todos` is a query object (has `schema` property)
2. MaiaOS automatically subscribes to the database
3. Data flows into `context.todos`
4. When data changes, MaiaOS updates `context.todos` automatically
5. Your view re-renders with fresh data

**No tools, no manual subscriptions - it just works!**

### Filtering Data

Want only incomplete todos? Use a filter:

```json
{
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

**Result:**
- `context.todos` = All todos
- `context.todosTodo` = Only incomplete todos (`done: false`)
- `context.todosDone` = Only completed todos (`done: true`)

All three automatically update when you create, update, or delete a todo!

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

#### Toggle

```json
{
  "tool": "@db",
  "payload": {
    "op": "toggle",
    "schema": "@schema/todos",
    "id": "$$id",
    "field": "done"
  }
}
```

### Complete Example: Todo List

**Context:**
```json
{
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

**State Machine:**
```json
{
  "initial": "idle",
  "states": {
    "idle": {
      "on": {
        "UPDATE_INPUT": {
          "target": "idle",
          "actions": [{
            "tool": "@context/update",
            "payload": { "newTodoText": "$$value" }
          }]
        },
        "CREATE_TODO": {
          "target": "creating",
          "guard": {"$ne": ["$newTodoText", ""]}
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
          "tool": "@context/update",
          "payload": { "newTodoText": "" }
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
- Define query objects in context (with `schema` property)
- Use `@db` tool for all data changes
- Use descriptive names (`todosTodo`, not `data1`)
- Filter in context, not in views
- Test with empty data (handle empty arrays gracefully)

**❌ DON'T:**
- Don't manually modify `context.todos` directly
- Don't use old `@mutation/*` or `@query/*` tools (deprecated)
- Don't filter data in views (use context filters instead)
- Don't forget to handle SUCCESS/ERROR events

### Troubleshooting

**Data Not Appearing:**
1. Is your context property a query object? (has `schema` property)
2. Check browser console for errors
3. Is the schema name correct? (e.g., `@schema/todos`)

**Data Not Updating:**
1. Are you using `@db` tool to modify data?
2. Is the schema name consistent between context and tool?
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
        "SWITCH_VIEW": {
          "target": "idle",
          "actions": [{
            "tool": "@context/update",
            "payload": {
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
          "op": "toggle",
          "schema": "@schema/todos",
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
- Tool succeeds → StateEngine auto-sends `SUCCESS` event
- Tool fails → StateEngine auto-sends `ERROR` event

Handle these in your state definition:

```json
{
  "creating": {
    "entry": {"tool": "@db", "payload": { "op": "create", ... }},
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
- **Compute boolean flags** - State machine computes, context stores, views reference
- **Maintain item lookup objects** - For item-specific conditional styling

### ❌ DON'T:

- Put logic in state machines (use tools)
- Create deeply nested states (keep flat)
- Forget error handling
- Use `$` for event payload fields
- Create cycles without exit conditions
- **Don't put conditionals in views** - Compute flags in state machine instead

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