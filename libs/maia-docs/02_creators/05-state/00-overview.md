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
View sends event → deliverEvent()
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

