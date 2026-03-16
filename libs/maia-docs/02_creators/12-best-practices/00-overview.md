# Best Practices: Actor Architecture

**Comprehensive guide to building scalable, maintainable MaiaOS applications**

## Core Principles

### Separation of Concerns (Nue.js-Style)

**Views have zero conditional logic.** Only process handlers and CSS have logic.

| Layer | Conditional Logic? | Responsibility |
|-------|--------------------|----------------|
| **Views** | **No** | Pure declarative structure. Reference context, send events. |
| **Context** | **No** | Single source of truth. All UI state persisted to CoValues. |
| **Process handlers** | **Yes** | All logic, computation, conditionals. |
| **CSS** | **Yes** (styling) | Conditional styling via data-attributes. |

### UI State: Single Source of Truth in Context

**All UI state lives in context.** No in-memory hacks, no ephemeral state.

- ✅ Context = CoValue — persisted, syncable, offline-first
- ✅ Every update: `ctx` → CoValue (CRDT) → ReactiveStore → View
- ✅ No shortcuts — no `useState`-style local variables, no bypassing persistence

### Local-First, CoValue-Native Roundtrip

**All data flows through CoValues.** No optimizing updates, no in-memory caches that bypass persistence.

- ✅ Create/update/delete → CoValue (CRDT) → ReactiveStore → View
- ✅ Query objects declared in context → resolved via `read()` → CoValue-backed
- ✅ Full offline-first — CoValues sync when connected; local-first when not
- ✅ Leverage CoJSON end-to-end. No shortcuts.

---

## Vibe-First Development

**Always create the vibe root service actor first when building a vibe.**

**Naming convention:** Use `@actor/vibe` for the vibe's root service actor (not `@actor/agent`—avoids confusion with AI agents).

**Why?**
- **Clear Architecture** - Root actor defines the app's structure and data flow
- **Data First** - Root actor handles all data operations before UI concerns
- **UI Second** - UI actors receive data from root actor, keeping them simple
- **Consistent Pattern** - Every vibe follows the same structure (`@actor/vibe`)
- **AI-Friendly** - LLMs understand this pattern and can generate vibes correctly

**Development Order:**
1. ✅ **Create vibe root service actor** (`vibe/vibe.actor.maia`) - ALWAYS FIRST
2. ✅ Create vibe manifest (`manifest.vibe.maia`) - References `@actor/vibe`
3. ✅ Create composite actor (`composite/composite.actor.maia`) - First UI actor
4. ✅ Create UI actors (`list/list.actor.maia`, etc.) - Leaf components

---

## 1. State Separation Pattern

### Principle: Co-location & Single Responsibility

**Rule of thumb:** State should be co-located with the component that renders it and uses it.

### Context Updates: Process Handlers as Single Source of Truth

**CRITICAL PRINCIPLE:** Process handlers are the **single source of truth** for all context changes.

**All context updates MUST:**
- ✅ Flow through process handlers
- ✅ Use `ctx` action (never mutate directly)
- ✅ Be triggered by events from inbox (never directly)

**The ONLY exception:**
- ✅ Universal `read()` API automatically updates reactive query objects (infrastructure)
- ✅ Query objects use `read()` internally - returns ReactiveStore that auto-updates

**Correct Pattern:**
```json
{
  "UPDATE_INPUT": [
    {
      "ctx": { "newTodoText": "$$value" }
    }
  ]
}
```

**Anti-Patterns:**
- ❌ Direct mutation: `actor.context.field = value`
- ❌ Updating from views
- ❌ Updating from tools (unless invoked by process handler)
- ❌ Setting error context directly in tools

### Event Flow: Inbox as Single Source of Truth

**CRITICAL PRINCIPLE:** Actor inbox is the **single source of truth** for ALL events.

**All events MUST flow through inbox:**
- ✅ View events → inbox → process handlers
- ✅ External messages → inbox → process handlers
- ✅ op SUCCESS/ERROR → delivered to source via tell or ProcessEngine
- ✅ ProcessEngine.send() only called from processMessages()

**Event Flow Pattern:**
```
View Event → deliverEvent() → inbox → processMessages() → ProcessEngine.send()
op success → tell(SUCCESS) to $$source
op failure → ProcessEngine delivers ERROR to $$source
```

**Why this matters:**
- **Unified Event Log:** All events appear in inbox for traceability
- **Per-Message Processed Flags:** Each message has a `processed` boolean flag (distributed CRDT-native deduplication)
- **Consistent Handling:** All events follow same path
- **Better Debugging:** Can inspect inbox to see complete event history

**Event Scoping Guarantee:**
- ✅ Events are **always scoped** to the actor that rendered the element
- ✅ The `actorId` parameter comes from the closure when the event handler was attached
- ✅ This ensures events are always routed to the correct actor's inbox

**Anti-Patterns:**
- ❌ Calling ProcessEngine.send() directly (bypasses inbox)
- ❌ Bypassing inbox for any events

### Separation of Concerns: Views, Process Handlers, and Message Passing

**CRITICAL ARCHITECTURE:** MaiaOS enforces strict separation of concerns between views, process handlers, and message passing to enable clean distributed systems.

#### Views: "Dumb" Templates (Zero Logic)

**Views are pure presentation layers** - they contain **zero conditional logic** and **zero state changes**.

**What Views CAN Do:**
- ✅ Resolve simple context references: `$key`, `$$key`
- ✅ Extract DOM values: `@inputValue`, `@dataColumn`
- ✅ Send events with resolved payloads
- ✅ Reference pre-computed context values (boolean flags, lookup objects)

**What Views CANNOT Do:**
- ❌ Conditional logic: `$if`, `$eq`, `$ne`, `$and`, `$or`, ternary operators (`? :`)
- ❌ State changes: Views never update context directly
- ❌ Complex expressions: Only simple data resolution allowed
- ❌ DSL operations: No `$if`, `$eq`, etc. in view definitions

**Pattern: Process Handler → Context → View → CSS**

1. **Process Handler** computes boolean flags and lookup objects:
```json
{
  "SELECT_ITEM": [
    {
      "ctx": {
        "isSelected": {"$eq": ["$$id", "$selectedId"]},
        "selectedItems": {"$$id": true}  // Lookup object
      }
    }
  ]
}
```

2. **View** references resolved context values:
```json
{
  "tag": "div",
  "attrs": {
    "data-selected": "$isSelected",  // Simple reference, resolved to true/false
    "data-selected-item": "$selectedItems.$$id"  // Lookup object reference
  }
}
```

3. **CSS** handles conditional styling via data-attributes:
```json
{
  "div": {
    "data-selected": {
      "true": { "background": "blue" }
    }
  }
}
```

#### Process Handlers: All Logic & Computation

**Process handlers are the single source of truth** for all logic, computation, and messaging.

**Process Handlers Handle:**
- ✅ All conditional logic (`$if`, `$eq`, `$and`, `$or`)
- ✅ All value computation
- ✅ All expressions that determine what values to set
- ✅ Complex nested logic
- ✅ Computing boolean flags for views
- ✅ Computing lookup objects for views
- ✅ Data operations via `op`
- ✅ Inter-actor messaging via `tell`

**Process Handlers Update Context:**
- Process handlers compute values and store them in context via `ctx`
- Views reference these pre-computed values (zero logic)
- No conditional logic in views — all conditionals in process handlers
- All context updates persist to CoValue — no in-memory hacks

#### Message Passing: Only Resolved Values

**CRITICAL:** In distributed/decentralized systems, **expressions cannot be passed around**.

**Why:**
- Expressions require evaluation context (context, item, result) that may not exist on remote actors
- CoJSON persistence stores messages that sync across devices - expressions can't be evaluated remotely
- Only resolved clean JS objects/JSON can be persisted and synced

**How It Works:**
1. **ViewEngine resolves ALL expressions** before sending to inbox
2. **Only resolved values** (clean JS objects/JSON) persist to CoJSON
3. **Process handlers receive pre-resolved payloads** (no re-evaluation needed for message payloads)
4. **Action configs still support expressions** (e.g., `ctx: { title: "$context.title" }` — evaluated in process handler context)

**Event Flow:**
```
View Event → resolveExpressions() (FULLY resolve) → deliverEvent() → inbox (CoJSON - only clean JSON) → processMessages() → ProcessEngine.send() (payload already resolved)
```

**Validation:**
- ViewEngine validates payloads are fully resolved before sending to inbox
- ActorEngine validates payloads are resolved before persisting to CoJSON
- Errors thrown if unresolved expressions found (fail fast)

**Example:**
```json
// ✅ Good - View resolves expressions before sending
{
  "$on": {
    "click": {
      "send": "CREATE_TODO",
      "payload": {
        "text": "@inputValue",  // DOM extraction, resolved to string
        "userId": "$userId"      // Context reference, resolved to value
      }
    }
  }
}

// ❌ Bad - Expression in payload (will be rejected)
{
  "$on": {
    "click": {
      "send": "CREATE_TODO",
      "payload": {
        "text": {"$if": {"condition": {"$eq": ["$mode", "urgent"]}, "then": "URGENT: ", "else": ""}}  // Conditional logic - NOT ALLOWED
      }
    }
  }
}

// ✅ Correct - Process handler computes value
// Process handler:
{
  "SET_MODE": [
    {
      "ctx": {
        "todoPrefix": {"$if": {"condition": {"$eq": ["$mode", "urgent"]}, "then": "URGENT: ", "else": ""}}
      }
    }
  ]
}

// View:
{
  "$on": {
    "click": {
      "send": "CREATE_TODO",
      "payload": {
        "text": "$todoPrefix"  // Reference to pre-computed value
      }
    }
  }
}
```

### Three-Layer Architecture

#### Layer 1: Agent Service Actor (Business Logic)

**Best Practice:** Always create the vibe root service actor first. This is your app's orchestrator.

**Lifecycle:** Service actors **persist** throughout the vibe lifecycle - created once, destroyed only on vibe unload.

**Manages:**
- ✅ Business logic and data orchestration
- ✅ Data query configurations
- ✅ Mutation state (creating, toggling, deleting)
- ✅ Coordination between UI actors

**Does NOT manage:**
- ❌ UI state (view mode, button states)
- ❌ Form state (input values)
- ❌ Component-specific UI state

**Example Context:**
```json
{
  "$factory": "@factory/context",
  "$id": "@context/vibe",
  "composite": "@actor/composite"
  // Only business logic references - no UI state
}
```

#### Layer 2: Composite Actor (UI Orchestration)

**Manages:**
- ✅ UI orchestration (view mode, current view)
- ✅ Button states (listButtonActive, kanbanButtonActive)
- ✅ Form state (newTodoText) - co-located with form
- ✅ UI presentation (title, placeholders, labels)

**Does NOT manage:**
- ❌ Business logic
- ❌ Data mutations
- ❌ Query configurations

**Example Context:**
```json
{
  "$factory": "@factory/context",
  "$id": "@context/composite",
  "title": "Todo List",                    // UI presentation
  "inputPlaceholder": "Add a new todo...", // UI presentation
  "addButtonText": "Add",                  // UI presentation
  "viewMode": "list",                      // UI orchestration
  "currentView": "@actor/list",            // UI orchestration
  "listButtonActive": true,                // UI orchestration
  "kanbanButtonActive": false,             // UI orchestration
  "newTodoText": ""                        // Form state (co-located)
}
```

#### Layer 3: UI Actors (Component-Specific)

**Manages:**
- ✅ Component-specific UI state (drag-drop, hover, etc.)
- ✅ Filtered/derived data for rendering (query results)

**Does NOT manage:**
- ❌ Business logic
- ❌ App-level UI orchestration
- ❌ Form state (unless component-specific)

**Example Contexts:**

**Kanban Actor:**
```json
{
  "$factory": "@factory/context",
  "$id": "@context/kanban",
  "todosTodo": [],        // Filtered data (query result)
  "todosDone": [],       // Filtered data (query result)
  "draggedItemId": null, // Component-specific UI state
  "dragOverColumn": null // Component-specific UI state
}
```

**List Actor:**
```json
{
  "$factory": "@factory/context",
  "$id": "@context/list",
  "todos": []  // Filtered data (query result)
}
```

---

## 2. Service vs UI Actor Responsibilities

### Service Actors

**Responsibilities:**
- Orchestrate data queries (send `SUBSCRIBE_TO_TODOS` to UI actors)
- Execute mutations (`CREATE_BUTTON`, `TOGGLE_BUTTON`, `DELETE_BUTTON`)
- Publish data events (`TODO_CREATED`, `TODO_COMPLETED`, `TODO_DELETED`)
- Coordinate between UI actors via messages

**State Management:**
- Business logic state only
- No UI state
- No form state

### UI Actors

**Responsibilities:**
- Render component UI
- Execute queries based on configurations from service actor
- Manage component-specific UI interactions (drag-drop, hover, etc.)
- Send generic UI events to service actor (`TOGGLE_BUTTON`, `DELETE_BUTTON`)

**State Management:**
- Component-specific UI state
- Filtered data for rendering
- No business logic

### Composite Actors

**Responsibilities:**
- Render shared UI (header, form, view switcher)
- Manage view switching logic
- Manage form input state
- Forward UI events to service actor
- Slot child UI actors based on view mode

**State Management:**
- UI orchestration state
- Form state (co-located with form)
- UI presentation state

---

