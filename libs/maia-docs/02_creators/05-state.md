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

**CRITICAL ARCHITECTURE:**
- **State Machines define the state** - All logic, computation, and state transitions
- **Context is the realtime reactive snapshot** - Current reflection of state, automatically updated
- **Templates are "dumb"** - Pure declarative structure, zero logic, just render context

## State Machine Responsibility: Single Source of Truth

**CRITICAL:** State machines are the **single source of truth** for all context changes.

**Your state machine is responsible for:**
- ✅ All context updates (via `updateContext` infrastructure action)
- ✅ All data mutations (via `@db` tool)
- ✅ All error handling (via ERROR event handlers)
- ✅ All UI state changes (view mode, button states, form values)

**State machines update context by:**
1. Receiving events from inbox (unified event flow)
2. Using `updateContext` action (infrastructure, not a tool) to update context
3. Handling tool success/failure via SUCCESS/ERROR events (routed through inbox)

## Separation of Concerns: Context vs State Machine

**CRITICAL PRINCIPLE:** Clean separation between **data storage** (context) and **logic/computation** (state machine).

### Context = Pure Data Storage

**Context files (`*.context.maia`) should contain:**
- ✅ Simple values (strings, numbers, booleans)
- ✅ Simple references (`@actor/list`, `@view/kanban`)
- ✅ Default/initial values
- ❌ **NO complex MaiaScript expressions** (`$if`, `$eq`, nested logic)
- ❌ **NO computation or conditional logic**

**Example - Good Context:**
```json
{
  "$schema": "@schema/context",
  "$id": "@context/composite",
  "viewMode": "list",
  "currentView": "@list",
  "listButtonActive": true,
  "kanbanButtonActive": false,
  "newTodoText": ""
}
```

### State Machine = All Logic & Computation

**State machines (`*.state.maia`) handle:**
- ✅ All conditional logic (`$if`, `$eq`, `$and`, `$or`)
- ✅ All value computation
- ✅ All expressions that determine what values to set
- ✅ Complex nested logic

**When updating context, structure actions for clarity:**

**❌ Bad - Complex expressions in one action:**
```json
{
  "updateContext": {
    "viewMode": "$$viewMode",
    "currentView": {
      "$if": {
        "condition": { "$eq": ["$$viewMode", "list"] },
        "then": "@list",
        "else": { /* nested $if */ }
      }
    },
    "listButtonActive": { "$eq": ["$$viewMode", "list"] },
    "kanbanButtonActive": { "$eq": ["$$viewMode", "kanban"] }
  }
}
```

**✅ Good - Separate actions, one expression per update:**
```json
{
  "actions": [
    {
      "updateContext": { "viewMode": "$$viewMode" }
    },
    {
      "updateContext": {
        "currentView": {
          "$if": {
            "condition": { "$eq": ["$$viewMode", "list"] },
            "then": "@list",
            "else": { /* nested $if */ }
          }
        }
      }
    },
    {
      "updateContext": {
        "listButtonActive": { "$eq": ["$$viewMode", "list"] }
      }
    },
    {
      "updateContext": {
        "kanbanButtonActive": { "$eq": ["$$viewMode", "kanban"] }
      }
    }
  ]
}
```

**Why this matters:**
- **Clear separation:** Context = data, State = logic
- **Easier debugging:** Each action computes one value
- **Better readability:** One expression per action is easier to understand
- **Maintainable:** Changes to logic don't affect context structure
- **Testable:** Can test state machine logic independently

**Remember:** Expressions ARE evaluated in the state machine (that's fine!), but structure them clearly with separate actions for each computed value.

## Inbox as Single Source of Truth for Events

**CRITICAL PRINCIPLE:** Actor inbox is the **single source of truth** for ALL events (internal, external, SUCCESS, ERROR).

**What this means:**
- ✅ All events MUST flow through actor inbox
- ✅ View events → inbox → state machine
- ✅ External messages → inbox → state machine
- ✅ Tool SUCCESS/ERROR → inbox → state machine
- ✅ StateEngine.send() only called from processMessages()

**Event Flow Pattern:**
```
User clicks button
  ↓
View sends event → sendInternalEvent()
  ↓
Event added to inbox
  ↓
processMessages() processes inbox
  ↓
StateEngine.send() receives event
  ↓
State machine transitions
  ↓
Tool executes (SUCCESS/ERROR)
  ↓
SUCCESS/ERROR routed through inbox
  ↓
processMessages() processes SUCCESS/ERROR
  ↓
State machine handles SUCCESS/ERROR
```

**Why this matters:**
- **Unified Event Log:** All events appear in inbox for complete traceability
- **Consistent Pattern:** Single source of truth for all events
- **Better Debugging:** Can trace all events through inbox log
- **Per-Message Processed Flags:** Each message has a `processed` boolean flag (distributed CRDT-native deduplication)
- **AI-Friendly:** LLMs can understand complete event flow

**Anti-Patterns:**
- ❌ Calling StateEngine.send() directly (bypasses inbox)
- ❌ Sending SUCCESS/ERROR directly to state machine
- ❌ Bypassing inbox for any events

**Example:**
```json
{
  "idle": {
    "on": {
      "UPDATE_INPUT": {
        "target": "idle",
        "actions": [
          {
            "updateContext": { "newTodoText": "$$newTodoText" }
          }
        ]
      }
    }
  }
}
```

**Note:** `updateContext` is infrastructure (not a tool). It directly calls `updateContextCoValue()` to persist changes to the context CoValue (CRDT).

**Batching:** All `updateContext` actions in a single transition are batched together and written to the context CoValue once at the end. This ensures efficient CRDT updates.

**Why this matters:**
- **Predictable:** All context changes happen in state machines
- **Debuggable:** Easy to trace context changes
- **Testable:** State machines define clear contracts
- **AI-friendly:** LLMs understand this pattern
- **Efficient:** Batched updates reduce CRDT write operations

**Remember:** Views send events, state machines update context, tools execute operations. Never update context directly from views or tools!

## Deterministic State Machines: Sequential Processing

**CRITICAL PRINCIPLE:** State machines are **deterministic** - only ONE state at a time, transitions happen sequentially.

**What this means:**
- ✅ Events are processed **one at a time** (sequential, not parallel)
- ✅ State machine always has a **single current state**
- ✅ Transitions happen **sequentially** - one completes before the next starts
- ✅ **No parallel states** - impossible to be in multiple states simultaneously

**How it works:**
- Generic sequential processing handled in engines (ActorEngine, StateEngine)
- Processing guard prevents concurrent execution
- Events queue in inbox and process sequentially
- **You don't need to handle this in your state configs** - engines handle it generically

**Unhandled Events:**
- Events not handled by current state are **processed and removed** (marked `processed: true`)
- They are **not rejected** - just removed from queue
- This ensures clean inbox management without errors

**Example - Simplified Kanban Flow:**
```json
{
  "idle": {
    "on": {
      "DRAG_START": { "target": "dragging" }
    }
  },
  "dragging": {
    "on": {
      "DRAG_ENTER": { "target": "dragOver" },
      "DRAG_END": { "target": "idle" },
      "DROP": { "target": "dropping" }
    }
  },
  "dragOver": {
    "on": {
      "DRAG_LEAVE": { "target": "dragging" },
      "DROP": { "target": "dropping" }
    }
  },
  "dropping": {
    "entry": { "tool": "@dragdrop/drop" },
    "exit": {
      "updateContext": {
        "draggedItemId": null,
        "dragOverColumn": null
      }
    },
    "on": {
      "SUCCESS": { "target": "idle" }
    }
  }
}
```

**Key Points:**
- Linear flow: idle → dragging → dragOver → dropping → idle
- No self-transitions (no "what if already in dragging" logic)
- Cleanup in exit actions (not separate cleanup states)
- Sequential processing handled generically - you just define the flow

**Anti-Patterns:**
- ❌ Handling events "while already in this state" (engines handle sequential processing)
- ❌ Creating cleanup states (use exit actions instead)
- ❌ Self-transitions for parallel state handling (not needed with sequential processing)

## Basic Structure

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