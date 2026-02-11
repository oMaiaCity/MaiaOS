# Default Vibe Pattern: Service → Composite → UI

**The standard pattern for building vibes:**

```
Vibe Entry Point
  └── Service Actor (orchestrating, minimal view)
        └── Composite Actor (first UI actor, shared structure)
              └── UI Actors (leaf components)
```

## Step 1: Vibe Loads Agent Service Actor

Every vibe's entry point is an **vibes service actor**:

**`manifest.vibe.maia`:**
```json
{
  "$schema": "@schema/vibe",
  "$id": "@vibe/todos",
  "name": "Todo List",
  "actor": "@actor/vibe"
}
```

### Context Updates: State Machine as Single Source of Truth

**CRITICAL:** All context updates must flow through state machines.

**Pattern:**
1. View sends event to state machine (via inbox)
2. State machine uses `updateContext` action
3. `updateContextCoValue()` persists to context CoValue (CRDT)
4. Context ReactiveStore automatically updates
5. View re-renders with new context

**Never:** Mutate context directly, update from views, use removed `@context/update` tool.

**Always:** Update via state machine actions, use `updateContext`, handle errors via ERROR events.

## Step 2: Vibe Root Service Actor Loads Composite

**`vibe.context.maia`:**
```json
{
  "currentView": "@composite",
  "@actors": {
    "composite": "@actor/composite"
  }
}
```

**Agent Responsibilities:**
- Orchestrate data queries (universal `read()` API)
- Handle mutations (CREATE_BUTTON, TOGGLE_BUTTON, etc.)
- Coordinate between UI actors via messages

## Step 3: Composite Actor Composes UI Actors

**Composite** provides shared UI (header, form, view switcher) and slots child actors.

## Step 4: UI Actors Render Components

Leaf UI actors (list, kanban, form) render specific components. Send generic events to service actor.

### Message Flow Pattern

```
User clicks → UI Actor sends TOGGLE_BUTTON → Service Actor receives → @db tool → SUCCESS → UI re-renders
```

### Scaling Through Composition

**Simple:** Service → Composite → UI Actor

**Complex:** Service → Composite → Header, Form, List, Footer (each can have sub-actors)

---

## Context (Runtime State)

The `context` holds all runtime data. Defined in separate `.context.maia` file.

### System Properties in Context

**`@actors`** - Child Actor Definitions (system property):
- Defines which child actors exist
- Format: `"@actors": { "namekey": "@actor/instance", ... }`

```json
{
  "currentView": "@composite",
  "@actors": {
    "composite": "@actor/composite"
  }
}
```

**Key Points:**
- `@actors` = system property, defines children
- `currentView` = context property (CRDT), references active child
- Slot resolution: `"$slot": "$currentView"` → namekey → `actor.children[namekey]`

**Example Context:**
```json
{
  "todos": [],
  "newTodoText": "",
  "viewMode": "list",
  "isModalOpen": false
}
```

**Note:** Context is always persisted to CoValue. Accessed reactively via ReactiveStore.

### Context Best Practices

✅ **DO:** Keep flat, clear names, initialize all fields, update via state machines, use `updateContext`, go through CoValue persistence.

❌ **DON'T:** Store DOM references, put logic in context, mutate directly, update from views, bypass CoValue persistence.

---

**Next:** [02-lifecycle-messaging.md](./02-lifecycle-messaging.md) - Actor lifecycle and message passing
