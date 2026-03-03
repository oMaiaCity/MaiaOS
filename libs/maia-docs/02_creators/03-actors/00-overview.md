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
  "@label": "todo-list",
  "context": "@context/todo",
  "view": "@view/todo",
  "brand": "@style/brand",
  "style": "@style/todo",

}
```

**Note:** All references use schema/instance references (like `@context/todo`) that are transformed to co-ids during seeding.

### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `$schema` | string | Yes | Schema reference (`@schema/actor`) |
| `$id` | string | Yes | Unique actor identifier (`@actor/todo`) |
| `@label` | string | No | Actor label (e.g., `"agent"`, `"composite"`, `"todo-list"`) |
| `context` | string | No | Co-id reference to context |
| `state` | string | Yes | Co-id reference to state machine |
| `view` | string | No | Co-id reference to view (optional for service actors) |
| `brand` | string | Yes | Co-id reference to brand style (required) |
| `style` | string | No | Co-id reference to local style (optional) |
| `inbox` | string | No | **Derived by convention** from actor `$id`; do not define in config. Each actor has an inbox costream at a derived namekey; the engine and seed set this automatically. |
| `messageTypes` | array | No | Array of message types this actor accepts |

**Note:** Children are defined in context files via the `@actors` system property. See [01-vibe-pattern.md](./01-vibe-pattern.md#system-properties-in-context).

### Message Contracts

Actors should declare `messageTypes` to create an explicit API contract:

```json
{
  "messageTypes": [
    "CREATE_BUTTON",
    "TOGGLE_BUTTON",
    "DELETE_BUTTON",
    "UPDATE_INPUT",
    "SWITCH_VIEW",
    "SUCCESS",
    "ERROR"
  ]
}
```

**Style Properties:** `brand` is required. `style` is optional. StyleEngine merges brand + style at runtime.

## Best Practice: Agent-First Development

**Always create the agent service actor first when building a vibe.**

**Development Order:**
1. ✅ Create agent service actor - ALWAYS FIRST
2. ✅ Create vibe manifest - References `@actor/vibe`
3. ✅ Create composite actor - First UI actor
4. ✅ Create UI actors - Leaf components

## Actor Types

### Service Actors

Orchestrating actors: business logic, data management. Typically minimal or no view.

**Example: Agent Service Actor**
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/vibe",
  "@label": "agent",
  "context": "@context/agent",
  "view": "@view/agent",
  "state": "@state/agent",
  "brand": "@style/brand",
  "inbox": "@inbox/agent"
}
```

### UI Actors

Presentation actors: render UI, handle interactions. Receive data from service actors.

### Composite Actors

Special UI actors that compose other actors. Shared structure (header, form), slot child actors.

---

**Next:** [01-vibe-pattern.md](./01-vibe-pattern.md) - Default vibe pattern and context
