
**Config Reactivity:**
When config CRDTs change (view, style, state, etc.), SubscriptionEngine automatically:
- Updates caches
- Updates actor properties (`actor.viewDef`, `actor.machine`, etc.)
- Triggers re-renders
- Reloads stylesheets (for style changes)
- Recreates state machines (for state changes)

**Source:** `libs/maia-engines/src/engines/subscription-engine/subscription.engine.js`

**See also:** [subscriptions.md](./subscriptions.md) - Detailed subscription architecture documentation

---

## ModuleRegistry

**Purpose:** Central plugin system for MaiaScript extensions.

**What it does:**
- Registers modules dynamically
- Provides module discovery
- Stores module configuration
- Manages module lifecycle

**Key Methods:**
- `registerModule(name, module, config)` - Register a module
- `getModule(name)` - Get module by name
- `loadModule(name)` - Dynamically load a module
- `listModules()` - List all registered modules

**Example:**
```javascript
import { ModuleRegistry } from '@MaiaOS/script';

const registry = new ModuleRegistry();

// Register a module
registry.registerModule('myModule', MyModuleClass, {
  version: '1.0.0',
  description: 'My custom module'
});

// Load a module dynamically
await registry.loadModule('db');
```

**Source:** `libs/maia-engines/src/engines/ModuleRegistry.js`

---

## MessageQueue

**Purpose:** Resilient message queue with persistence and retry.

**What it does:**
- Queues messages for actors
- Persists messages to localStorage (survives page refresh)
- Retries failed messages with exponential backoff
- Maintains dead letter queue for failed messages
- Guarantees message ordering

**Key Methods:**
- `enqueue(message)` - Add message to queue
- `getStats()` - Get queue statistics
- `clear()` - Clear queue (testing/cleanup)

**Features:**
- Persistent storage (localStorage)
- Retry mechanism (max 5 retries)
- Dead letter queue
- At-least-once delivery semantics

**Source:** `libs/maia-engines/src/engines/message-queue/message.queue.js`

---

---

## Separation of Concerns

**CRITICAL ARCHITECTURAL PRINCIPLE:** Each engine has a single, well-defined responsibility. Engines should NOT cross boundaries into other engines' responsibilities.

### Event Flow

```
User Action (DOM Event)
  ↓
ViewEngine.handleEvent() - Extracts DOM values, resolves expressions
  ↓
ActorEngine.sendInternalEvent() - Routes to actor's inbox
  ↓
ActorEngine.processMessages() - Processes inbox sequentially
  ↓
StateEngine.send() - Triggers state machine transition
  ↓
StateEngine._executeTransition() - Executes actions
  ↓
StateEngine._executeActions() - Updates context via updateContextCoValue()
  ↓
Context CoValue updated (CRDT)
  ↓
ReactiveStore subscription triggers
  ↓
ViewEngine.render() - Re-renders view reactively
```

### Engine Responsibilities

**StateEngine:**
- ✅ Updates state transitions
- ✅ Updates context (single source of truth)
- ✅ Executes guards and actions
- ❌ Should NOT manipulate views directly
- ❌ Should NOT call view manipulation tools

**ViewEngine:**
- ✅ Renders DOM from context reactively
- ✅ Sends events (never updates context directly)
- ✅ Handles DOM manipulation reactively
- ✅ Resolves ALL expressions before sending to inbox (only resolved values)
- ❌ Should NOT update context directly
- ❌ Should NOT trigger state transitions directly
- ❌ Should NOT contain conditional logic (`$if`, `$eq`, ternary operators)
- ❌ Should NOT contain DSL operations (views are dumb templates)

**ActorEngine:**
- ✅ Orchestrates actors and engines
- ✅ Routes messages (inbox → state machine)
- ✅ Schedules rerenders
- ❌ Should NOT update state transitions directly
- ❌ Should NOT manipulate views directly

**Context:**
- ✅ Holds current state (ReactiveStore)
- ✅ Updated ONLY by state machines via `updateContext` actions
- ✅ Read reactively by views
- ❌ Should NOT be mutated directly outside state machines

### Common Violations to Avoid

**❌ State Machine Manipulating View:**
```json
// BAD - State machine should not manipulate views directly
{
  "actions": [
    { "tool": "@some/viewManipulationTool", "payload": {} }
  ]
}
```

**✅ Correct Pattern - Views Handle UI Reactively:**
```json
// GOOD - Views react to context changes, no direct manipulation needed
// State machine computes boolean flags, view references them
{
  "tag": "input",
  "value": "$inputValue",
  "attrs": {
    "data": {
      "hasError": "$hasError"  // State machine computed this flag, view just references it
    }
  }
}
// CSS handles styling: input[data-has-error="true"] { border-color: red; }
```

**❌ View Updating Context Directly:**
```json
// BAD - View updating context
{
  "$on": {
    "click": { "updateContext": { "isOpen": true } }
  }
}
```

**✅ Correct Pattern - View Sends Event:**
```json
// GOOD - View sends event, state machine updates context
{
  "$on": {
    "click": { "send": "OPEN_MODAL" }
  }
}
```

---

## Related Documentation

- [Main README](./README.md) - Package overview
- [modules.md](./modules.md) - Module system details
- [expressions.md](./expressions.md) - MaiaScript expressions
- [api-reference.md](./api-reference.md) - Complete API reference
