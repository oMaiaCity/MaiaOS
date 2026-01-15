# State Machines

**State machines** define actor behavior through states, transitions, guards, and actions. They are **XState-like state machine definitions** that the StateEngine interprets at runtime.

## Philosophy

> State machines are the BRAIN of an actor. They define WHAT to do WHEN something happens.

- **Actors** have no logic (just configuration)
- **State Machines** define behavior flow and compute conditional values
- **Tools** execute the actual work
- **Views** reference computed values (zero conditionals in templates!)

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

## Using Reactive Queries

**Reactive queries** automatically update your actor's data when changes happen. No manual refresh needed! Think of it like a spreadsheet: when you change a cell, all formulas that depend on it update automatically.

### Quick Start: Subscribing to Data

In your state machine, add a `loading` state that subscribes to your data:

```json
{
  "initial": "loading",
  "states": {
    "loading": {
      "entry": {
        "tool": "@query/subscribe",
        "payload": {
          "schema": "todos",
          "target": "todos"
        }
      },
      "on": {
        "SUCCESS": "idle"
      }
    },
    "idle": {
      ...
    }
  }
}
```

**What happens:**
1. Actor starts in `loading` state
2. `@query/subscribe` tool runs
3. Data loads into `context.todos`
4. State machine transitions to `idle`
5. View renders with data
6. **Data automatically updates when it changes!**

### Query Tools

#### @query/subscribe (Reactive)

**Use for:** Data that changes frequently

```json
{
  "tool": "@query/subscribe",
  "payload": {
    "schema": "todos",
    "target": "todos"
  }
}
```

**Features:**
- ✅ Automatic updates
- ✅ Re-renders actor
- ✅ Supports filters
- ❌ Can't unsubscribe manually (auto-cleanup on actor destroy)

#### @query/get (One-time)

**Use for:** Static data that doesn't change

```json
{
  "tool": "@query/get",
  "payload": {
    "schema": "settings",
    "target": "settings"
  }
}
```

**Features:**
- ✅ Fast (no subscription overhead)
- ✅ Good for read-only data
- ❌ No automatic updates
- ❌ Must re-run manually to refresh

#### @query/filter (One-time + Filter)

**Use for:** One-time filtered queries

```json
{
  "tool": "@query/filter",
  "payload": {
    "schema": "todos",
    "filter": {
      "field": "priority",
      "op": "gt",
      "value": 5
    },
    "target": "highPriorityTodos"
  }
}
```

**Features:**
- ✅ Filtered results
- ✅ Fast (no subscription)
- ❌ No automatic updates

### Filters

Filter data to show only what you need:

```json
{
  "tool": "@query/subscribe",
  "payload": {
    "schema": "todos",
    "filter": {
      "field": "done",
      "op": "eq",
      "value": false
    },
    "target": "incompleteTodos"
  }
}
```

**Result:** Only incomplete todos (`done: false`) appear in `context.incompleteTodos`.

#### Filter Operations

**Equality:**
```json
{ "field": "done", "op": "eq", "value": false }  // done === false
{ "field": "done", "op": "ne", "value": false }  // done !== false
```

**Comparison:**
```json
{ "field": "priority", "op": "gt", "value": 5 }   // priority > 5
{ "field": "priority", "op": "lt", "value": 10 }  // priority < 10
{ "field": "priority", "op": "gte", "value": 5 }  // priority >= 5
{ "field": "priority", "op": "lte", "value": 10 } // priority <= 10
```

**Array / String:**
```json
{ "field": "status", "op": "in", "value": ["active", "pending"] }  // status in array
{ "field": "text", "op": "contains", "value": "urgent" }            // text contains "urgent"
```

### Mutation Tools

#### Create

```json
{
  "tool": "@mutation/create",
  "payload": {
    "schema": "todos",
    "data": {
      "text": "Buy groceries",
      "done": false,
      "priority": 5
    }
  }
}
```

**Result:** Creates new todo with auto-generated ID. All subscribed actors update automatically.

#### Update

```json
{
  "tool": "@mutation/update",
  "payload": {
    "schema": "todos",
    "id": "1234",
    "data": {
      "text": "Buy groceries and cook dinner"
    }
  }
}
```

**Result:** Updates existing todo. All subscribed actors update automatically.

#### Delete

```json
{
  "tool": "@mutation/delete",
  "payload": {
    "schema": "todos",
    "id": "1234"
  }
}
```

**Result:** Deletes todo. All subscribed actors update automatically.

#### Toggle

```json
{
  "tool": "@mutation/toggle",
  "payload": {
    "schema": "todos",
    "id": "1234",
    "field": "done"
  }
}
```

**Result:** Toggles `done` from `true` to `false` (or vice versa). All subscribed actors update automatically.

### Common Query Patterns

#### Pattern 1: Simple List

**State Machine:**
```json
{
  "initial": "loading",
  "states": {
    "loading": {
      "entry": {
        "tool": "@query/subscribe",
        "payload": {
          "schema": "todos",
          "target": "todos"
        }
      },
      "on": { "SUCCESS": "idle" }
    },
    "idle": {}
  }
}
```

**View:**
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

#### Pattern 2: Filtered Lists (Kanban Board)

**State Machine:**
```json
{
  "initial": "loading",
  "states": {
    "loading": {
      "entry": [
        {
          "tool": "@query/subscribe",
          "payload": {
            "schema": "todos",
            "filter": { "field": "done", "op": "eq", "value": false },
            "target": "todosTodo"
          }
        },
        {
          "tool": "@query/subscribe",
          "payload": {
            "schema": "todos",
            "filter": { "field": "done", "op": "eq", "value": true },
            "target": "todosDone"
          }
        }
      ],
      "on": { "SUCCESS": "idle" }
    },
    "idle": {}
  }
}
```

**View:**
```json
{
  "tag": "div",
  "attrs": {
    "class": "kanban-board"
  },
  "children": [
    {
      "tag": "div",
      "attrs": {
        "class": "column"
      },
      "children": [
        {
          "tag": "h3",
          "text": "To Do"
        },
        {
          "$each": {
            "items": "$todosTodo",
            "template": {
              "tag": "div",
              "text": "$$text"
            }
          }
        }
      ]
    },
    {
      "tag": "div",
      "attrs": {
        "class": "column"
      },
      "children": [
        {
          "tag": "h3",
          "text": "Done"
        },
        {
          "$each": {
            "items": "$todosDone",
            "template": {
              "tag": "div",
              "text": "$$text"
            }
          }
        }
      ]
    }
  ]
}
```

#### Pattern 3: Create with Input

**Context:**
```json
{
  "newTodoText": "",
  "todos": []
}
```

**State Machine:**
```json
{
  "initial": "loading",
  "states": {
    "loading": {
      "entry": {
        "tool": "@query/subscribe",
        "payload": {
          "schema": "todos",
          "target": "todos"
        }
      },
      "on": { "SUCCESS": "idle" }
    },
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
          "tool": "@mutation/create",
          "payload": {
            "schema": "todos",
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
      "on": { "SUCCESS": "idle" }
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
        "value": "$newTodoText"
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

### Query Best Practices

**✅ DO:**
- Always subscribe in the `loading` state
- Use meaningful target names (`incompleteTodos`, not `data1`)
- Filter data at subscription time (not in view)
- Use mutation tools for all data changes
- Test with empty data (handle empty arrays gracefully)
- Document which actors subscribe to which data

**❌ DON'T:**
- Modify `actor.context[schema]` directly
- Create data without using `@mutation/create`
- Forget to add `on: { SUCCESS: "idle" }` after loading
- Mix reactive (`@query/subscribe`) and non-reactive (`@query/get`) for same data
- Subscribe to entire collections when you only need filtered data
- Use filters in views (use filtered subscriptions instead)

### Query Troubleshooting

**Data Not Appearing:**
1. Is your actor in the `loading` state?
2. Is the `@query/subscribe` tool running?
3. Is the `target` field correct? (e.g., `"target": "todos"`)
4. Is there data in localStorage? (Open DevTools → Application → Local Storage)

**Data Not Updating:**
1. Are you using `@query/subscribe` (not `@query/get`)?
2. Are you using mutation tools (`@mutation/*`) to modify data?
3. Is the schema name correct in both subscribe and mutation?

**Multiple Actors Not Syncing:**
1. All actors subscribe to the same schema name
2. All actors use mutation tools (not direct context modification)
3. Actors are properly initialized (check console logs)

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