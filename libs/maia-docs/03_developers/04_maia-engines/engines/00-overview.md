# Engines

The `@MaiaOS/script` package provides 10 core engines that work together to execute MaiaScript and manage actor lifecycles.

---

## Evaluator (MaiaScriptEvaluator)

**Purpose:** Evaluates MaiaScript expressions safely.

**What it does:**
- Evaluates JSON-based expressions (`$if`, `$eq`, `$context`, `$$item`, etc.)
- Resolves data paths (`$context.title`, `$$item.id`)
- Validates expressions against schema before evaluation
- Enforces depth limits to prevent DoS attacks
- Supports shortcut syntax: `$key` (context) and `$$key` (item)

**Key Methods:**
- `evaluate(expression, data, depth)` - Evaluate an expression
- `evaluateShortcut(expression, data)` - Handle `$key` and `$$key` shortcuts
- `isDSLOperation(value)` - Check if value is a DSL operation

**Example:**
```javascript
import { Evaluator as MaiaScriptEvaluator } from '@MaiaOS/script';

const evaluator = new MaiaScriptEvaluator();

// Evaluate a simple expression
const result = await evaluator.evaluate(
  { $if: { condition: { $eq: ['$context.status', 'active'] }, then: 'green', else: 'gray' } },
  { context: { status: 'active' } }
);
// Returns: 'green'

// Shortcut syntax
const title = await evaluator.evaluate('$context.title', { context: { title: 'Hello' } });
// Returns: 'Hello'
```

**Security:**
- Validates expressions against `maia-script-expression` schema before evaluation
- Enforces maximum recursion depth (default: 50) to prevent DoS
- Sandboxed - only whitelisted operations allowed
- No code execution - pure JSON expression evaluation

**Source:** `libs/maia-engines/src/utils/evaluator.js`

---

## ActorEngine

**Purpose:** Orchestrates actor lifecycle and coordinates all engines.

**What it does:**
- Creates and manages actors
- Handles message passing (inbox/subscriptions)
- Coordinates ViewEngine, StyleEngine, StateEngine
- Manages actor context and state
- Processes messages and triggers state transitions
- **Sequential processing**: Ensures events process one at a time (deterministic state machines)

**Key Methods:**
- `createActor(actorConfig, container)` - Create an actor
- `loadActor(actorId)` - Load actor config from database
- `deliverEvent(senderId, targetId, type, payload)` - Deliver event to actor inbox
- `processMessages(actorId)` - Process pending messages sequentially (guarded against concurrent execution)
- `getActor(actorId)` - Get actor by ID
- `rerenderActor(actorId)` - Re-render actor view

**Sequential Processing:**
- `processMessages()` uses `_isProcessing` guard to prevent concurrent execution
- Events process one at a time, ensuring deterministic state transitions
- Unhandled events are marked as processed (not rejected)
- Sequential processing handled generically in engine - no need to handle in state configs

**Message Validation Pipeline:**
- **Step 1: Message Contract Validation** - Checks if message type is in actor's `messageTypes` array
- **Step 2: Message Type Schema Loading** - Loads message type schema from registry (`@schema/message/{TYPE}`)
- **Step 3: Payload Validation** - Validates message payload against the message type schema (the schema IS the payload schema - merged concept)
- **Step 4: State Machine Routing** - If validation passes, routes validated message to StateEngine
- Invalid messages are rejected early with clear error messages before reaching the state machine

**Note:** Message type schemas directly represent the payload schema. There is no separate `payloadSchema` property - the message type schema itself validates the payload.

**Dependencies:**
- `StyleEngine` - For style compilation
- `ViewEngine` - For view rendering
- `ModuleRegistry` - For module access
- `ToolEngine` - For tool execution
- `StateEngine` - For state machine interpretation
- `SubscriptionEngine` - For reactive subscriptions

**Example:**
```javascript
import { ActorEngine } from '@MaiaOS/script';

// ActorEngine is typically created by kernel during boot
// But you can create it manually for advanced use cases:
const actorEngine = new ActorEngine(
  styleEngine,
  viewEngine,
  moduleRegistry,
  toolEngine,
  stateEngine
);

// Create an actor
const actor = await actorEngine.createActor(
  actorConfig,
  document.getElementById('container')
);
```

**Source:** `libs/maia-engines/src/engines/actor-engine/actor.engine.js`

---

## ViewEngine

**Purpose:** Renders `.maia` view definitions to Shadow DOM.

**What it does:**
- Converts view definitions to DOM elements
- Handles `$each` loops for iteration
- Processes `$slot` for actor composition
- Manages event handlers (`$on`)
- Uses Shadow DOM for style isolation
- Sanitizes HTML to prevent XSS
- **Reactive rendering** - Automatically re-renders when context changes
- **Resolves ALL expressions before sending to inbox** - Only resolved values (clean JS objects/JSON) are sent
- **Rejects conditional logic** - Views are "dumb" templates, no `$if`, `$eq`, ternary operators allowed

**Key Methods:**
- `loadViewConfigs(actorConfig, actorId)` - Load view, context, style, brand; validate view; set up subscriptions
- `attachViewToActor(actor, containerElement, actorConfig, ...)` - Full attach: configs, shadowRoot, render
- `render(viewDef, context, shadowRoot, styleSheets, actorId)` - Render view
- `renderNode(nodeDef, data, actorId)` - Render a single node
- `_handleEvent(event, element, actorId)` - Handle view events, resolves expressions, validates payloads

**Dependencies:**
- `Evaluator` - For expression evaluation
- `ActorEngine` - For action handling
- `ModuleRegistry` - For module access

**Architectural Boundaries:**
- ✅ **ONLY displays current state** - Views read from context reactively (ReactiveStore subscriptions)
- ✅ **ONLY sends events** - Views send events via `send` syntax, never update context directly
- ✅ **ONLY manipulates DOM reactively** - DOM updates happen in response to context changes
- ✅ **Resolves ALL expressions before sending** - ViewEngine fully resolves all expressions before sending to inbox (only clean JS objects/JSON persist to CoJSON)
- ✅ **Validates payloads are resolved** - Throws error if unresolved expressions found in payloads
- ❌ **SHOULD NOT update context directly** - All context updates flow through state machines
- ❌ **SHOULD NOT trigger state transitions directly** - Views send events, state machines handle transitions
- ❌ **Should NOT contain conditional logic** (`$if`, `$eq`, ternary operators) - All conditionals belong in state machines
- ❌ **Should NOT contain DSL operations** - Views only resolve simple context/item references (`$key`, `$$key`)
- **Reactive UI behavior** - Use data attributes (e.g., `data-auto-focus="true"`) for declarative UI behavior

**Expression Resolution:**
- Views resolve ALL expressions before sending to inbox via `resolveExpressions()`
- Only resolved values (clean JS objects/JSON) are persisted to CoJSON
- State machines receive pre-resolved payloads (no re-evaluation needed)
- Action configs in state machines still support expressions (evaluated in state machine context)

**Correct Pattern - Views Handle UI Reactively:**
```json
// State machine computes boolean flag
{
  "updateContext": {
    "isSelected": {"$eq": ["$$id", "$selectedId"]}
  }
}

// View references resolved context value
{
  "tag": "div",
  "attrs": {
    "data-selected": "$isSelected"  // Simple context reference, resolved to true/false
  }
}

// CSS handles conditional styling
{
  "div": {
    "data-selected": {
      "true": { "background": "blue" }
    }
  }
}
```

**Example:**
```javascript
import { ViewEngine } from '@MaiaOS/script';

const viewEngine = new ViewEngine(evaluator, actorEngine, moduleRegistry);

// Render a view
await viewEngine.render(
  viewDef,
  { context: { title: 'Hello' } },
  shadowRoot,
  styleSheets,
  'actor-123'
);
```

**Security:**
- Uses `textContent` for text (auto-escapes HTML)
- Uses `createElement`/`appendChild` for DOM (safe)
- Sanitizes attribute values
- Shadow DOM isolation prevents style leakage

**Source:** `libs/maia-engines/src/engines/view-engine/view.engine.js`

---

## StyleEngine

**Purpose:** Compiles `.maia` style definitions to CSS.

**What it does:**
- Compiles style definitions to Constructable Stylesheets
- Merges brand styles with actor overrides
- Interpolates token references (`{token.color}`)
- Caches compiled stylesheets
- Supports CSS-in-JS approach

**Key Methods:**
- `loadStyle(coId)` - Load style definition from database
- `compile(brandStyleId, actorStyleId)` - Compile styles
- `clearCache()` - Clear style cache (dev only)

**Dependencies:**
- `maia.do` (DataEngine) - For loading style definitions

**Example:**
```javascript
import { StyleEngine } from '@MaiaOS/script';

const styleEngine = new StyleEngine();

// Compile styles
const styleSheets = await styleEngine.compile(
  'co_z...brand',  // Brand style co-id
  'co_z...actor'   // Actor style co-id (optional)
);
```

**Source:** `libs/maia-engines/src/engines/style-engine/style.engine.js`

---

## StateEngine

**Purpose:** Interprets state machine definitions (XState-like).

**What it does:**
- Loads state machine definitions from `.state.maia` files
- Creates state machine instances
- Handles state transitions with schema-based guards (JSON Schema validation)
- Executes entry/exit actions
- Processes events (`send('EVENT_NAME')`)
- Supports side effects (invoke, after delays)
- **Deterministic**: Only one state at a time, sequential transitions

**Key Methods:**
- `loadStateDef(stateRef)` - Load state definition
- `createMachine(stateDef, actor)` - Create state machine instance
- `send(machineId, event, payload)` - Send event to state machine (called only from ActorEngine.processMessages())
- `_evaluateGuard(guard, context, payload, actor)` - Evaluate guard using JSON Schema validation

**Dependencies:**
- `ToolEngine` - For executing actions
- `ValidationEngine` - For schema-based guard evaluation (JSON Schema validation)
- `ActorEngine` - For unified event flow and sequential processing

**Guard Evaluation:**
- Guards use JSON Schema to validate against current state and context
- Guards check conditional logic (should transition happen?), NOT payload validation
- Payload validation happens in ActorEngine BEFORE messages reach the state machine

**Architectural Boundaries:**
- ✅ **ONLY updates state transitions and context** - State machines are the single source of truth for context changes
- ✅ **ONLY calls tools that update state/context** - Tools should update state, not manipulate views
- ❌ **SHOULD NOT manipulate views directly** - No DOM operations, no view manipulation
- ❌ **SHOULD NOT call view manipulation tools** - State machines should not manipulate views directly

**Deterministic State Machines:**
- State machines are deterministic - only ONE state at a time
- Events process sequentially (guarded by ActorEngine)
- No parallel states possible
- Unhandled events are processed and removed (not rejected)
- Sequential processing handled generically - state configs don't need "what if already in state X" logic

**Example:**
```javascript
import { StateEngine } from '@MaiaOS/script';

const stateEngine = new StateEngine(toolEngine, evaluator);

// Load and create state machine
const stateDef = await stateEngine.loadStateDef('co_z...');
const machine = await stateEngine.createMachine(stateDef, actor);

// Send event
stateEngine.sendEvent('actor-123', { type: 'CLICK_BUTTON' });
```

**Source:** `libs/maia-engines/src/engines/state-engine/state.engine.js`

---

## ToolEngine

**Purpose:** Executes tools with parameter validation.

**What it does:**
- Registers tools from modules
- Validates tool parameters against schemas
- Executes tool functions
- Supports namespaced tools (`@core/noop`, `@db/query`)

**Key Methods:**
- `registerTool(namespacePath, toolId, options)` - Register a tool
- `executeTool(toolId, payload, actor)` - Execute a tool
- `getTool(toolId)` - Get tool definition

**Dependencies:**
- `ModuleRegistry` - For module access

**Example:**
```javascript
import { ToolEngine } from '@MaiaOS/script';

const toolEngine = new ToolEngine(moduleRegistry);

// Execute a tool
const result = await toolEngine.executeTool(
  '@db/query',
  { schema: '@schema/todos', filter: { completed: false } },
  actor
);
```

**Source:** `libs/maia-engines/src/engines/tool-engine/tool.engine.js`

---

## Tool Call Architecture

**CRITICAL PRINCIPLE:** **100% State Machine Pattern - All tool calls MUST flow through state machines.**
