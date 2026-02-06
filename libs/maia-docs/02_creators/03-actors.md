# Actors (Building Blocks)

Think of actors like **LEGO pieces**. Each piece is complete by itself:
- It knows what it looks like (view)
- It knows how to behave (state machine)
- It remembers things (context)
- It can talk to other pieces (messages)

You snap actors together to build your app!

## What's an Actor?

An actor is just a small file (`.actor.maia`) that says:
- "My brain is in `todo.state.maia`" (state machine)
- "My face is in `todo.view.maia`" (UI)
- "My style is in `brand.style.maia`" (colors and fonts)
- "My memory is in `todo.context.maia`" (data I remember)

**That's it!** The actor file just points to other files. The engines do the actual work.

## Architectural Roles: Single Source of Truth

**CRITICAL:** MaiaOS follows a strict single source of truth architecture. Everything is persisted to CoValues under the hood, accessed reactively via the universal `read()` API.

### Clear Separation of Responsibilities

**State Machine** → Defines ALL state transitions
- ✅ **Single source of truth** for behavior
- ✅ Defines when and how state changes
- ✅ All transitions flow through state machine
- ✅ Never bypassed - all changes go through state machine

**Context** → Contains ALL data and current state
- ✅ **Single source of truth** for data
- ✅ Stores runtime data (todos, form values, UI state)
- ✅ Always persisted to CoValue under the hood
- ✅ Accessed reactively via ReactiveStore (universal `read()` API)
- ✅ Never mutated directly - always through state machine

**View** → Renders from context variables
- ✅ **Read-only** - only reads from context
- ✅ Sends events to state machine (never updates context directly)
- ✅ Automatically re-renders when context changes
- ✅ Pure presentation - no business logic

### Single Source of Truth: CoValue Under the Hood

**CRITICAL PRINCIPLE:** Everything is persisted to CoValues under the hood. No in-memory mutation hacks!

**How it works:**
```
State Machine Action
  ↓
updateContextCoValue() → Persists to Context CoValue (CRDT)
  ↓
Context ReactiveStore automatically updates
  ↓
View subscribes to ReactiveStore → Re-renders
```

**Key Points:**
- ✅ **Context is a CoValue** - Always persisted, never in-memory only
- ✅ **Accessed via ReactiveStore** - Universal `read()` API pattern
- ✅ **No mutation hacks** - Everything goes through persisted CoValues
- ✅ **Automatic reactivity** - ReactiveStore notifies subscribers when CoValue changes
- ✅ **Single source of truth** - CoValue is the authoritative data store

**Example Flow:**
```json
// State machine defines transition
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

**What happens:**
1. View sends `UPDATE_INPUT` event → inbox → state machine
2. State machine executes `updateContext` action
3. `updateContextCoValue()` persists to Context CoValue (CRDT)
4. Context ReactiveStore automatically updates (read-only derived data)
5. View subscribes to ReactiveStore → sees update → re-renders

**No shortcuts, no hacks:**
- ❌ Never mutate context directly: `actor.context.field = value`
- ❌ Never bypass CoValue persistence
- ❌ Never use in-memory only data structures
- ✅ Always go through persisted CoValues
- ✅ Always access via ReactiveStore (universal `read()` API)

**Visual Flow:**
```
┌─────────────────────────────────────────────────────────┐
│                    USER INTERACTION                      │
│              (clicks button, types text)                │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                      VIEW (Read-Only)                    │
│  • Reads from context ReactiveStore                      │
│  • Sends events to state machine                         │
│  • Never mutates context directly                        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼ (sends event)
┌─────────────────────────────────────────────────────────┐
│                  INBOX COSTREAM                         │
│  • Single source of truth for ALL events                │
│  • Routes events to state machine                        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼ (processes event)
┌─────────────────────────────────────────────────────────┐
│                 STATE MACHINE                            │
│  • Defines ALL state transitions                         │
│  • Executes updateContext action                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼ (persists to CoValue)
┌─────────────────────────────────────────────────────────┐
│              CONTEXT COVALUE (CRDT)                      │
│  ← SINGLE SOURCE OF TRUTH                               │
│  • Always persisted                                      │
│  • Never in-memory only                                  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼ (accessed via ReactiveStore)
┌─────────────────────────────────────────────────────────┐
│            CONTEXT REACTIVESTORE                        │
│  • Reactive access layer                                │
│  • Notifies subscribers when CoValue changes             │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼ (subscribes)
┌─────────────────────────────────────────────────────────┐
│                      VIEW                                │
│  • Re-renders automatically                              │
└─────────────────────────────────────────────────────────┘
```

## Why This Is Cool

**Simple:** Each file does one thing. Easy to understand!

**Reusable:** Want 3 todo lists? Create the actor 3 times. They all work independently!

**Composable:** Mix and match. Use the same view with a different state machine. Use the same state machine with a different view.

**AI-Friendly:** Because it's just configuration files, AI agents can easily read and modify them!

## Actor Definition

Create a file named `{name}.actor.maia`:

```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/todo",
  "role": "todo-list",
  "context": "@context/todo",
  "state": "@state/todo",
  "view": "@view/todo",
  "brand": "@style/brand",
  "style": "@style/todo",
  "inbox": "@inbox/todo"
}
```

**Note:** All references (`context`, `view`, `state`, `brand`, `style`, `inbox`) use schema/instance references (like `@context/todo`) that are transformed to co-ids (`co_z...`) during seeding. The `$schema` and `$id` properties also use schema references.

### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `$schema` | string | Yes | Schema reference (`@schema/actor`) - transformed to co-id during seeding |
| `$id` | string | Yes | Unique actor identifier (`@actor/todo`) - transformed to co-id during seeding |
| `role` | string | No | Actor role (e.g., `"agent"`, `"composite"`, `"todo-list"`) |
| `context` | string | No | Co-id reference to context (`@context/todo`) - transformed during seeding |
| `state` | string | Yes | Co-id reference to state machine (`@state/todo`) - transformed during seeding |
| `view` | string | No | Co-id reference to view (`@view/todo`) - optional for service actors |
| `brand` | string | Yes | Co-id reference to brand style (`@style/brand`) - shared design system |
| `style` | string | No | Co-id reference to local style (`@style/todo`) - actor-specific overrides |
| `inbox` | string | No | Co-id reference to inbox costream (`@inbox/todo`) - message inbox for events |

**Note:** Children are defined in context files via the `@actors` system property, not in the actor schema. See [Children Architecture](#system-properties-in-context) below.

**Style Properties:**
- `brand` is **required** - shared design system (tokens, components) used by all actors
- `style` is **optional** - actor-specific style overrides that merge with brand
- StyleEngine merges brand + style at runtime (brand first, then style overrides)

## Best Practice: Agent-First Development

**Always create the agent service actor first when building a vibe.**

**Why?**
- **Clear Architecture** - Agent defines the app's structure
- **Data First** - Agent handles all data operations
- **UI Second** - UI actors receive data from agent
- **Consistent Pattern** - Every vibe follows the same structure
- **AI-Friendly** - LLMs understand this pattern

**Development Order:**
1. ✅ **Create agent service actor** (`agent/agent.actor.maia`) - ALWAYS FIRST
2. ✅ Create vibe manifest (`manifest.vibe.maia`) - References `@actor/agent`
3. ✅ Create composite actor (`composite/composite.actor.maia`) - First UI actor
4. ✅ Create UI actors (`list/list.actor.maia`, etc.) - Leaf components

## Actor Types

MaiaOS distinguishes between two fundamental actor types based on their responsibilities and whether they render UI:

### Service Actors

**Service actors** are orchestrating actors responsible for business logic, data management, and coordination. They typically have **no view** (or a minimal view that only renders child actors).

**Characteristics:**
- ✅ Orchestrate data queries and mutations
- ✅ Manage application-level state
- ✅ Coordinate between UI actors
- ✅ Handle message routing and business logic
- ❌ No direct UI rendering (or minimal container view)

**Example: Agent Service Actor (Default Entry Point - ALWAYS CREATE FIRST)**
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/agent",
  "role": "agent",
  "context": "@context/agent",
  "view": "@view/agent",        // ← Minimal view (only renders child)
  "state": "@state/agent",
  "brand": "@style/brand",
  "inbox": "@inbox/agent"
}
```

**Note:** Children are defined in the context file via `@actors` system property, not in the actor definition. See [Children Architecture](#system-properties-in-context) below.

**Best Practice:** Always define the agent service actor first when creating a vibe. This is your app's orchestrator.

**Agent View (Minimal):**
```json
{
  "$schema": "@schema/view",
  "$id": "@view/agent",
  "root": {
    "tag": "div",
    "attrs": { "class": "agent-container" },
    "$slot": "$currentView"  // ← Only renders child actor
  }
}
```

**Agent Context:**
```json
{
  "$schema": "@schema/context",
  "$id": "@context/agent",
  "currentView": "@composite",  // ← Context property (CRDT CoValue) - references active child
  "@actors": {
    "composite": "@actor/composite"  // ← System property (like $schema/$id) - defines children
  }
}
```

**Use cases:**
- **Vibe entry points** (default pattern - every vibe loads an agent service actor)
- Data synchronization services
- Background workers
- API coordinators
- Business logic orchestration

**Why "agent"?**
- Clear naming: the agent orchestrates everything
- Consistent pattern: every vibe has `@actor/agent`
- Best practice: define agent first, then UI actors

### UI Actors

**UI actors** are presentation actors responsible for rendering user interfaces. They receive data/configurations from service actors and handle user interactions.

**Characteristics:**
- ✅ Render UI components
- ✅ Handle user interactions
- ✅ Receive query configurations from service actors
- ✅ Send generic UI events (e.g., `TOGGLE_BUTTON`, `DELETE_BUTTON`) to service actors
- ❌ No direct data mutations (delegate to service actors)

**Example: List UI Actor**
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/list",
  "role": "todo-list",
  "context": "@context/list",
  "view": "@view/list",        // ← Full UI view
  "state": "@state/list",
  "brand": "@style/brand",
  "inbox": "@inbox/list"
}
```

**Use cases:**
- Todo lists
- Note editors
- Calendar widgets
- Chat interfaces
- Form components
- Navigation components

### Composite Actors

**Composite actors** are a special type of UI actor that compose other UI actors. They provide shared UI structure (e.g., header, form, view switcher) and slot child actors.

**Example: Composite Actor**
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/composite",
  "role": "composite",
  "context": "@context/composite",
  "view": "@view/composite",
  "state": "@state/composite",
  "brand": "@style/brand",
  "inbox": "@inbox/composite"
}
```

**Note:** Children are defined in the context file via `@actors` system property. See the context example below.

**Composite View:**
```json
{
  "$schema": "@schema/view",
  "$id": "@view/composite",
  "content": {
    "tag": "div",
    "children": [
      {
        "tag": "header",
        "children": [
          {"tag": "h1", "text": "Todo List"},
          {"tag": "button", "$on": {"click": {"send": "SWITCH_VIEW"}}}
        ]
      },
      {
        "tag": "main",
        "$slot": "$currentView"  // ← Slots child UI actors
      }
    ]
  }
}
```

**Composite Context:**
```json
{
  "$schema": "@schema/context",
  "$id": "@context/composite",
  "currentView": "@list",  // ← Context property (CRDT CoValue) - references active child
  "@actors": {
    "list": "@actor/list",      // ← System property (like $schema/$id) - defines children
    "kanban": "@actor/kanban"
  }
}
```

## Default Vibe Pattern: Service → Composite → UI

**The standard pattern for building vibes:**

```
Vibe Entry Point
  └── Service Actor (orchestrating, minimal view)
        └── Composite Actor (first UI actor, shared structure)
              └── UI Actors (leaf components)
```

### Step 1: Vibe Loads Agent Service Actor

Every vibe's entry point is an **agent service actor** that orchestrates the application:

**`manifest.vibe.maia`:**
```json
{
  "$schema": "@schema/vibe",
  "$id": "@vibe/todos",
  "name": "Todo List",
  "description": "A todo list application",
  "actor": "@actor/agent"  // ← Agent service actor (ALWAYS CREATE FIRST)
}
```

**Best Practice:** Always define the agent service actor first. This is your app's orchestrator.

### Context Updates: State Machine as Single Source of Truth

**CRITICAL:** All context updates must flow through state machines.

**Pattern:**
1. View sends event to state machine (via inbox)
2. State machine uses `updateContext` action (infrastructure, not a tool)
3. `updateContextCoValue()` persists to context CoValue (CRDT)
4. Context ReactiveStore automatically updates (read-only derived data)
5. View re-renders with new context

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

**Never:**
- ❌ Mutate context directly: `actor.context.field = value`
- ❌ Update context from views
- ❌ Use `@context/update` tool (removed - use `updateContext` infrastructure action)

**Always:**
- ✅ Update context via state machine actions
- ✅ Use `updateContext` infrastructure action for context updates
- ✅ Handle errors via state machine ERROR events

### Step 2: Agent Service Actor Loads Composite

The agent loads a **composite actor** as its first child:

**`agent/agent.actor.maia` (Agent Service Actor):**
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/agent",
  "role": "agent",
  "context": "@context/agent",
  "view": "@view/agent",        // ← Minimal view
  "state": "@state/agent",      // ← Orchestrates queries/mutations
  "brand": "@style/brand",
  "inbox": "@inbox/agent"
}
```

**Note:** Children are defined in `agent.context.maia` via `@actors` system property. See [Children Architecture](#system-properties-in-context) below.

**Agent Service Actor Responsibilities:**
- Orchestrate data queries using universal `read()` API
- Handle mutations (`CREATE_BUTTON`, `TOGGLE_BUTTON`, `DELETE_BUTTON`)
- Manage application-level state
- Coordinate between UI actors via messages (inbox costream)
- Load composite actor as first child (defined in context)

**Why Start with Agent?**
1. **Clear Architecture** - Agent defines the app's structure
2. **Data First** - Agent handles all data operations
3. **UI Second** - UI actors receive data from agent
4. **Best Practice** - Always define orchestrator before components

### Step 3: Composite Actor Composes UI Actors

The composite actor provides shared UI structure and slots child UI actors:

**`composite/composite.actor.maia`:**
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/composite",
  "role": "composite",
  "context": "@context/composite",
  "view": "@view/composite",
  "state": "@state/composite",
  "brand": "@style/brand",
  "inbox": "@inbox/composite"
}
```

**Note:** Children are defined in `composite.context.maia` via `@actors` system property. See the context example below.

**Composite Actor Responsibilities:**
- Render shared UI (header, form, view switcher)
- Slot child UI actors based on context
- Forward UI events to service actor
- Receive state updates from service actor

### Step 4: UI Actors Render Components

Leaf UI actors render specific components:

**`list/list.actor.maia`:**
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/list",
  "role": "todo-list",
  "context": "@context/list",
  "view": "@view/list",
  "state": "@state/list",
  "brand": "@style/brand",
  "inbox": "@inbox/list"
}
```

**UI Actor Responsibilities:**
- Execute queries based on configurations from service actor
- Render UI components
- Send generic UI events to service actor
- Receive data updates via messages

### Message Flow Pattern

```
User clicks button in UI Actor
  ↓
UI Actor sends: TOGGLE_BUTTON { id: "123" }
  ↓
Service Actor receives message
  ↓
Service Actor executes: @db tool with op: "toggle"
  ↓
Service Actor publishes: TODO_COMPLETED { id: "123" }
  ↓
UI Actors receive update and re-render
```

### Why This Pattern?

✅ **Clear Separation of Concerns**
- Service actors = Business logic
- UI actors = Presentation

✅ **Scalable Through Composition**
- Start simple (service → composite → UI)
- Add more UI actors as needed
- Service actor orchestrates everything

✅ **Message-Based Communication**
- Loose coupling between actors
- Easy to test and modify
- AI agents can understand message contracts

✅ **Default Pattern for Vibes**
- Every vibe follows this structure
- Consistent architecture
- Easy to understand and extend

### Scaling Through Composition

**Simple Vibe:**
```
Service Actor → Composite Actor → UI Actor
```

**Complex Vibe:**
```
Service Actor
  └── Composite Actor
        ├── Header UI Actor
        ├── Form UI Actor
        ├── List UI Actor
        │     └── List Item UI Actor (repeated)
        └── Footer UI Actor
```

The service actor orchestrates all of them via messages, maintaining clean separation of concerns.

## Context (Runtime State)

The `context` holds all runtime data for the actor. It can be defined inline in the actor file or in a separate `.context.maia` file:

### System Properties in Context

Context files can contain **system properties** (like `$schema` and `$id`) that are used by the actor engine:

**`@actors` - Child Actor Definitions:**
- **System property** (like `$schema`, `$id`) - clearly indicates it's not user-defined context data
- Defines which child actors exist (used by actor engine to create children)
- Contains external references (`@actor/composite`, `@actor/list`, etc.)
- Format: `"@actors": { "namekey": "@actor/instance", ... }`

**Example:**
```json
{
  "$schema": "@schema/context",
  "$id": "@context/agent",
  "currentView": "@composite",  // ← Context property (CRDT CoValue) - references active child
  "@actors": {
    "composite": "@actor/composite"  // ← System property - defines children
  }
}
```

**Key Points:**
- `context["@actors"]` is a **system property** - defines which children exist
- `context.currentView` is a **context property** (CRDT CoValue) - references the active child actor
- Slot resolution: `"$slot": "$currentView"` → looks up `context.currentView` → extracts namekey → finds `actor.children[namekey]`
- **Unified pattern**: All actors use `currentView` for slot resolution (even if they only have one child)

**Separate Context File (Recommended):**

**`todo.context.maia`:**
```json
{
  "$schema": "@schema/context",
  "$id": "@context/todo",
  "todos": [],
  "newTodoText": "",
  "viewMode": "list"
}
```

Referenced in actor:
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/todo",
  "context": "@context/todo",  // ← Co-id reference (transformed during seeding)
  "state": "@state/todo"
}
```

**Note:** Context is always in a separate file. The `context` property references it via co-id (`@context/todo`), which gets transformed to an actual co-id (`co_z...`) during seeding. **Context is always persisted to a CoValue under the hood - accessed reactively via ReactiveStore. No in-memory mutation hacks!**

**Example Context Structure:**
```json
{
  // Collections
  "todos": [
    {"id": "1", "text": "Buy milk", "done": false}
  ],
  
  // Derived/filtered data
  "todosTodo": [],  // Computed by tools
  "todosDone": [],
  
  // UI state
  "viewMode": "list",
  "isModalOpen": false,
  
  // Form state
  "newTodoText": "",
  
  // Drag-drop state (managed by tools)
  "draggedItemId": null,
  "draggedItemIds": {}
}
```

### Context Best Practices

✅ **DO:**
- Keep context flat when possible
- Use clear, descriptive names
- Initialize all fields (avoid `undefined`)
- Store only serializable data (no functions)
- **Update context via state machines** - State machines are the single source of truth
- **Use `updateContext` infrastructure action** - Always update context through state machine actions
- **Always go through CoValue persistence** - Everything must be persisted, no in-memory hacks
- **Access via ReactiveStore** - Context is a ReactiveStore backed by persisted CoValue

❌ **DON'T:**
- Store UI elements or DOM references
- Put logic in context (use tools instead)
- Mix concerns (separate data from UI state)
- **Don't mutate context directly** - Always use state machines and tools
- **Don't update context from views** - Views send events, state machines update context
- **Don't bypass CoValue persistence** - Never mutate `actor.context.value` directly
- **Don't use in-memory mutation hacks** - Everything must go through persisted CoValues

## Actor Lifecycle

### Service Actors vs UI Actors

MaiaOS differentiates between **service actors** and **UI actors** for lifecycle management:

**Service Actors:**
- **Persist** throughout the vibe lifecycle
- Created once when vibe loads
- Destroyed only when vibe is unloaded
- Examples: Agent orchestrators, data services

**UI Actors:**
- **Created on-demand** when their view is active (referenced by `context.currentView`)
- **Destroyed** when switching to a different view
- Examples: List views, kanban views, form components

### Lifecycle Flow

**Service Actor Lifecycle:**
```
┌─────────────┐
│   Created   │  ← createActor() called (once per vibe)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Booting    │  ← State machine initialized
└──────┬──────┘      View rendered (minimal, only slots)
       │            Styles applied
       ▼
┌─────────────┐
│   Active    │  ← Processes events (persists)
└──────┬──────┘      Processes messages
       │            Re-renders on state changes
       │            (Lifecycle continues until vibe unloads)
       ▼
┌─────────────┐
│  Destroyed  │  ← destroyActor() called (only on vibe unload)
└─────────────┘
```

**UI Actor Lifecycle:**
```
┌─────────────┐
│   Created   │  ← createActor() called lazily (when referenced by context.currentView)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Booting    │  ← State machine initialized
└──────┬──────┘      View rendered (full UI)
       │            Styles applied
       ▼
┌─────────────┐
│   Active    │  ← Processes events
└──────┬──────┘      Processes messages
       │            Re-renders on state changes
       │            (Active while context.currentView references this actor)
       ▼
┌─────────────┐
│  Destroyed  │  ← destroyActor() called (when switching to different view)
└─────────────┘
```

### Lazy Child Actor Creation

Child actors are **created lazily** - only when they're referenced by `context.currentView`:

- **Before**: All child actors were created immediately (wasteful)
- **After**: Only the active child actor is created (efficient)

When switching views:
1. Previously active UI child actor is destroyed
2. New child actor is created lazily (if not already exists)
3. Service child actors persist (not destroyed)

### Creating Actors

```javascript
// Single actor
const actor = await os.createActor(
  './maia/todo.actor.maia',
  document.getElementById('container')
);

// Multiple actors
const actors = await Promise.all([
  os.createActor('./maia/todo.actor.maia', document.getElementById('col-1')),
  os.createActor('./maia/notes.actor.maia', document.getElementById('col-2'))
]);
```

### Accessing Actors

```javascript
// Get actor by ID
const actor = os.getActor('actor_todo_001');

// Access context
console.log(actor.context.todos);

// Access state
console.log(actor.machine.currentState); // 'idle', 'creating', etc.
```

## Message Passing & Event Flow

**CRITICAL:** Actor inbox is the **single source of truth** for ALL events (internal, external, SUCCESS, ERROR).

**Unified Event Flow:**
- ✅ View events → inbox → state machine
- ✅ External messages → inbox → state machine  
- ✅ Tool SUCCESS/ERROR → inbox → state machine
- ✅ All events appear in inbox log for traceability

**Event Flow Pattern:**
```
View Event → sendInternalEvent() → inbox → processMessages() → StateEngine.send()
External Message → inbox → processMessages() → StateEngine.send()
Tool SUCCESS → sendInternalEvent() → inbox → processMessages() → StateEngine.send()
Tool ERROR → sendInternalEvent() → inbox → processMessages() → StateEngine.send()
```

**Why inbox for all events:**
- **Unified Event Log:** Complete traceability of all events
- **Per-Message Processed Flags:** Each message has a `processed` boolean flag (distributed CRDT-native deduplication)
- **Consistent Handling:** All events follow same path
- **Better Debugging:** Can inspect inbox to see all events

### Sending Messages

**External messages** (actor-to-actor):

```javascript
// Send to specific actor
os.sendMessage('actor_todo_001', {
  type: 'notification',
  from: 'actor_calendar_001',
  data: {text: 'Reminder: Meeting at 3pm'}
});

// Actors can send to each other
actor.actorEngine.sendMessage(targetActorId, message);
```

**Internal events** (from views) automatically route through inbox via `sendInternalEvent()`.

### Receiving Messages

Messages are sent to actors via their inbox costream. Actors automatically process messages from their inbox and route them to their state machine. No explicit subscription configuration is needed - messages are sent directly to the target actor's inbox.

### Processing Messages

Messages are processed via the actor's state machine. The inbox is automatically processed, and events are routed to state machines:

```json
{
  "idle": {
    "on": {
      "MESSAGE_RECEIVED": {
        "target": "processingMessage"
      },
      "SUCCESS": {
        "target": "idle"
      },
      "ERROR": {
        "target": "error"
      }
    }
  }
}
```

**Note:** All events (including SUCCESS/ERROR from tools) flow through inbox and are processed by `processMessages()`, which routes them to the state machine.

## Shadow DOM Isolation

Each actor with a view renders into its own **Shadow DOM**, providing:

✅ **Style isolation** - Actor styles don't leak  
✅ **Encapsulation** - Internal DOM is private  
✅ **Reusability** - Multiple instances don't conflict  
✅ **Automatic container queries** - `:host` automatically has `container-type: inline-size` enabled

```html
<div id="actor-todo">
  #shadow-root
    <style>
      :host {
        container-type: inline-size;
        container-name: actor-todo;
        /* ... other styles ... */
      }
    </style>
    <div>/* Actor UI */</div>
</div>
```

**Container Queries:** Every actor's `:host` element automatically becomes a container, enabling responsive components that adapt to their container size (not just viewport size). Use `@container` queries in your style files with breakpoint tokens like `{containers.xs}`, `{containers.sm}`, etc. See [Style Guide](./10-style.md#container-queries-responsive-design) for details.

## Multiple Actor Instances

You can create multiple instances of the same actor type:

```javascript
const todo1 = await os.createActor('./maia/todo.actor.maia', container1);
const todo2 = await os.createActor('./maia/todo.actor.maia', container2);

// Each has independent context
todo1.context.todos // []
todo2.context.todos // []
```

## File Naming Convention

```
maia/
├── todo.actor.maia    # Actor definition (references only)
├── todo.context.maia  # Runtime data (referenced by contextRef)
├── todo.state.maia    # State machine (referenced by stateRef)
├── todo.view.maia     # View definition (referenced by viewRef)
├── todo.style.maia    # Actor-specific styles (referenced by styleRef)
└── brand.style.maia   # Shared design system
```

**Convention:** `{name}.{type}.maia`

## Example: Complete Todo Actor

**`todo.actor.maia`:**
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/todo",
  "role": "todo-list",
  "context": "@context/todo",
  "state": "@state/todo",
  "view": "@view/todo",
  "brand": "@style/brand",
  "style": "@style/todo",
  "inbox": "@inbox/todo"
}
```

**`todo.context.maia`:**
```json
{
  "$schema": "@schema/context",
  "$id": "@context/todo",
  "todos": [
    {"id": "1", "text": "Learn MaiaOS", "done": true},
    {"id": "2", "text": "Build an app", "done": false}
  ],
  "todosTodo": [],
  "todosDone": [],
  "newTodoText": "",
  "viewMode": "list",
  "isModalOpen": false
}
```

## Composing Actors

**Composition** is combining smaller actors into larger, more complex actors. Think of it like building with LEGO blocks - you combine simple pieces to create complex structures.

### Two Types of Actors

#### Leaf Actors

**Leaf actors** are terminal components - they don't contain other actors. They render UI directly.

**Example: `todo_input.actor.maia`**
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/todo-input",
  "role": "todo-input",
  "context": "@context/todo-input",
  "view": "@view/todo-input",
  "state": "@state/todo-input",
  "brand": "@style/brand",
  "inbox": "@inbox/todo-input"
}
```

**Leaf View: `todo_input.view.maia`**
```json
{
  "$schema": "@schema/view",
  "$id": "@view/todo-input",
  "root": {
    "tag": "div",
    "children": [
      {
        "tag": "input",
        "attrs": {
          "value": "$newTodoText"
        }
      },
      {
        "tag": "button",
        "text": "Add",
        "$on": {
          "click": {
            "send": "CREATE_TODO"
          }
        }
      }
    ]
  }
}
```

#### Composite Actors

**Composite actors** are containers that hold other actors in slots.

**Example: `agent.actor.maia`**
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/agent",
  "role": "agent",
  "context": "@context/agent",
  "view": "@view/agent",
  "state": "@state/agent",
  "brand": "@style/brand",
  "inbox": "@inbox/agent"
}
```

**Note:** Children are defined in the context file, not in the actor definition. See the context example below.

**Composite View: `app.view.maia`**
```json
{
  "$schema": "@schema/view",
  "$id": "@view/app",
  "root": {
    "tag": "div",
    "attrs": {
      "class": "app-layout"
    },
    "children": [
      {
        "tag": "header",
        "$slot": "$header"  // Renders child actor from @actors.header
      },
      {
        "tag": "main",
        "$slot": "$input"   // Renders child actor from @actors.input
      },
      {
        "tag": "section",
        "$slot": "$currentView"    // Renders active child actor
      }
    ]
  }
}
```

### How Slots Work

**Slots** are placeholders where child actors get rendered.

**Syntax:**
- Use `$slot` with a context value (e.g., `"$slot": "$currentView"`)
- Context property contains `@namekey` reference (e.g., `currentView: "@list"`)
- ViewEngine extracts `namekey` from `@namekey` → finds child actor in `actor.children[namekey]`
- Attaches child actor's container to the slot element

**Unified Pattern:**
All slot resolution works the same way - no differentiation between "static" and "dynamic" slots. Everything is a CRDT CoValue.

**Example Context:**
```json
{
  "$schema": "@schema/context",
  "$id": "@context/composite",
  "currentView": "@list",  // ← Context property (CRDT CoValue) - references active child
  "@actors": {
    "list": "@actor/list",      // ← System property (like $schema/$id) - defines children
    "kanban": "@actor/kanban"
  }
}
```

**View with slots:**
```json
{
  "$schema": "@schema/view",
  "$id": "@view/composite",
  "content": {
    "tag": "div",
    "children": [
      {
        "tag": "main",
        "$slot": "$currentView"  // ← Resolves: context.currentView = "@list" → namekey "list" → actor.children["list"]
      }
    ]
  }
}
```

**State machine sets context:**
```json
{
  "states": {
    "idle": {
      "on": {
        "SWITCH_VIEW": {
          "target": "idle",
          "actions": [
            {
              "updateContext": {
                "currentView": "@list"  // ← Updates context property (CRDT CoValue)
              }
            }
          ]
        }
      }
    }
  }
}
```

**Key Points:**
- `context["@actors"]` is a **system property** (like `$schema`, `$id`) that defines which children exist
- `context.currentView` is a **context property** (CRDT CoValue) that references the active child actor
- Slot resolution is **unified** - same logic for all slots, whether they reference one child or switch between multiple

### Building a Composable App

#### Step 1: Identify Components

Break your UI into logical pieces:
- Header with navigation
- Input form
- List of items
- Footer

#### Step 2: Create Leaf Actors

Create one actor for each piece:

**`header.actor.maia`** - Navigation bar
**`input.actor.maia`** - Form input
**`list.actor.maia`** - Item list
**`footer.actor.maia`** - Footer

#### Step 3: Create Composite Root

Create a root actor that composes all pieces:

**`app.actor.maia`**
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/app",
  "role": "composite",
  "context": "@context/app",
  "view": "@view/app",
  "state": "@state/app",
  "brand": "@style/brand",
  "inbox": "@inbox/app"
}
```

**`app.context.maia`** (defines children):
```json
{
  "$schema": "@schema/context",
  "$id": "@context/app",
  "@actors": {
    "header": "@actor/header",
    "input": "@actor/input",
    "list": "@actor/list",
    "footer": "@actor/footer"
  },
  "currentView": "@list"
}
```

**`app.view.maia`**
```json
{
  "$schema": "@schema/view",
  "$id": "@view/app",
  "root": {
    "tag": "div",
    "attrs": {
      "class": "app"
    },
    "children": [
      {
        "tag": "header",
        "$slot": "$header"
      },
      {
        "tag": "main",
        "$slot": "$input"
      },
      {
        "tag": "section",
        "$slot": "$currentView"
      },
      {
        "tag": "footer",
        "$slot": "$footer"
      }
    ]
  }
}
```

**`app.state.maia`** - Sets context values for slots:
```json
{
  "$schema": "@schema/state",
  "$id": "@state/app",
  "initial": "idle",
  "states": {
    "idle": {
      "entry": {
        "updateContext": {
          "currentView": "@list"
        }
      }
    }
  }
}
```

**Note:** The `@actors` system property in context defines which children exist. The `currentView` context property references which child to display.

### Message Passing Between Actors

Actors communicate via **messages** sent to inbox costreams, not props.

#### Sending Messages

When an event happens, publish a message:

**In state machine:**
```json
{
  "states": {
    "creating": {
      "entry": {
        "tool": "@db",
        "payload": { "op": "create", "schema": "@schema/todos", "data": {...} }
      },
      "on": {
        "SUCCESS": {
          "target": "idle",
          "actions": [
            {
              "tool": "@core/publishMessage",
              "payload": {
                "type": "TODO_CREATED",
                "payload": { "id": "$id", "text": "$text" }
              }
            }
          ]
        }
      }
    }
  }
}
```

#### Receiving Messages

Messages are automatically processed from the actor's inbox costream and routed to the state machine. Actors handle messages by defining event handlers in their state machines.

### Real Example: Todo App

**Structure:**
```
vibe_root (composite)
├── @header (view_switcher - leaf)
├── @input (todo_input - leaf)
├── @list (todo_list - composite)
│   └── @item (todo_item - leaf, repeated)
└── @kanban (kanban_view - leaf)
```

**Message Flow:**
1. User types in `todo_input` → publishes `CREATE_TODO`
2. `todo_list` receives `CREATE_TODO` → creates item
3. `todo_item` instances render in list
4. User clicks complete → `todo_item` publishes `TODO_COMPLETED`
5. `todo_list` receives → updates state
6. `vibe_root` receives → orchestrates view

### Common Patterns

#### Layout Container
```json
{
  "$schema": "@schema/view",
  "$id": "@view/layout",
  "root": {
    "tag": "div",
    "children": [
      {
        "tag": "header",
        "$slot": "$header"
      },
      {
        "tag": "main",
        "$slot": "$currentView"
      },
      {
        "tag": "footer",
        "$slot": "$footer"
      }
    ]
  }
}
```

#### List with Items
```json
{
  "$schema": "@schema/view",
  "$id": "@view/list",
  "root": {
    "tag": "ul",
    "$each": {
      "items": "$todos",
      "template": {
        "tag": "li",
        "text": "$$item.text"
      }
    }
  }
}
```

#### Conditional View Switching
```json
{
  "$schema": "@schema/view",
  "$id": "@view/composite",
  "root": {
    "tag": "div",
    "children": [
      {
        "tag": "section",
        "$slot": "$currentView"  // State machine sets to "@list" or "@kanban"
      }
    ]
  }
}
```

**State machine handles switching:**
```json
{
  "$schema": "@schema/state",
  "$id": "@state/composite",
  "initial": "idle",
  "states": {
    "idle": {
      "on": {
        "SWITCH_VIEW": {
          "target": "idle",
          "actions": [
            {
              "updateContext": {
                "currentView": "$viewMode === 'list' ? '@list' : '@kanban'"  // ← Updates context property (CRDT CoValue)
              }
            }
          ]
        }
      }
    }
  }
}
```

### Best Practices

**✅ DO:**
- Keep actors small and focused
- Use clear slot names (`@header`, not `@h`)
- Send messages via inbox costreams for actor-to-actor communication
- Keep context internal (don't expose)
- Use state machine to set slot context values
- Define children in context files via `@actors` system property

**❌ DON'T:**
- Don't create giant monolithic actors
- Don't use prop drilling
- Don't expose context directly
- Don't create circular dependencies
- Don't put conditional logic in views (use state machine instead)
- Don't define children in actor schema (use context `@actors` instead)

## Next Steps

- Learn about [Skills](./03-skills.md) - AI agent interface
- Understand [State Machines](./05-state.md) - Actor behavior
- Explore [Context](./04-context.md) - Runtime data management
- Create [Views](./07-views.md) - UI representation
- Review [Best Practices](./10-best-practices.md) - Architecture patterns and scalability

## Debugging Actors

```javascript
// Expose actor globally
window.actor = actor;

// Inspect in console
actor.context           // Runtime data (ReactiveStore)
actor.context.value     // Current context value
actor.machine          // State machine instance
actor.machine.currentState  // Current state
actor.inbox            // Inbox costream (messages)

// Inspect Shadow DOM
// In DevTools: click the actor container, expand #shadow-root
```
