# Engines

The `@MaiaOS/script` package provides 10 core engines that work together to execute MaiaScript and manage actor lifecycles.

---

## MaiaScriptEvaluator

**Purpose:** Evaluates MaiaScript expressions safely.

**What it does:**
- Evaluates JSON-based expressions (`$if`, `$eq`, `$context`, etc.)
- Resolves data paths (`$context.title`, `$item.id`)
- Validates expressions against schema
- Enforces depth limits to prevent DoS attacks

**Key Methods:**
- `evaluate(expression, data, depth)` - Evaluate an expression
- `evaluateShortcut(expression, data)` - Handle `$key` shortcuts

**Example:**
```javascript
import { MaiaScriptEvaluator } from '@MaiaOS/script';

const evaluator = new MaiaScriptEvaluator();

// Evaluate a simple expression
const result = await evaluator.evaluate(
  { $if: { condition: { $eq: ['$context.status', 'active'] }, then: 'green', else: 'gray' } },
  { context: { status: 'active' } }
);
// Returns: 'green'
```

**Security:**
- Validates expressions before evaluation
- Enforces maximum recursion depth (default: 50)
- Sandboxed - only whitelisted operations allowed

**Source:** `libs/maia-script/src/engines/MaiaScriptEvaluator.js`

---

## ActorEngine

**Purpose:** Orchestrates actor lifecycle and coordinates all engines.

**What it does:**
- Creates and manages actors
- Handles message passing (inbox/subscriptions)
- Coordinates ViewEngine, StyleEngine, StateEngine
- Manages actor context and state
- Processes messages and triggers state transitions

**Key Methods:**
- `createActor(actorConfig, container)` - Create an actor
- `loadActor(actorId)` - Load actor config from database
- `sendMessage(actorId, message)` - Send message to actor
- `processMessages(actorId)` - Process pending messages
- `getActor(actorId)` - Get actor by ID
- `rerenderActor(actorId)` - Re-render actor view

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

**Source:** `libs/maia-script/src/engines/actor-engine/actor.engine.js`

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

**Key Methods:**
- `loadView(coId)` - Load view definition from database
- `render(viewDef, context, shadowRoot, styleSheets, actorId)` - Render view
- `renderNode(nodeDef, data, actorId)` - Render a single node

**Dependencies:**
- `MaiaScriptEvaluator` - For expression evaluation
- `ActorEngine` - For action handling
- `ModuleRegistry` - For module access

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

**Source:** `libs/maia-script/src/engines/view-engine/view.engine.js`

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
- `DBEngine` - For loading style definitions

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

**Source:** `libs/maia-script/src/engines/style-engine/style.engine.js`

---

## StateEngine

**Purpose:** Interprets state machine definitions (XState-like).

**What it does:**
- Loads state machine definitions from `.state.maia` files
- Creates state machine instances
- Handles state transitions with guards
- Executes entry/exit actions
- Processes events (`send('EVENT_NAME')`)
- Supports side effects (invoke, after delays)

**Key Methods:**
- `loadStateDef(stateRef)` - Load state definition
- `createMachine(stateDef, actor)` - Create state machine instance
- `sendEvent(actorId, event)` - Send event to state machine

**Dependencies:**
- `ToolEngine` - For executing actions
- `MaiaScriptEvaluator` - For evaluating guards
- `ActorEngine` - For unified event flow

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

**Source:** `libs/maia-script/src/engines/state-engine/state.engine.js`

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

**Source:** `libs/maia-script/src/engines/tool-engine/tool.engine.js`

---

## DBEngine

**Purpose:** Unified database operation router.

**What it does:**
- Routes operations to modular handlers
- Supports operations: `query`, `create`, `update`, `updateConfig`, `delete`, `toggle`, `seed`
- Works with swappable backends (IndexedDB, CoJSON CRDT)
- Validates operations against schemas

**Key Methods:**
- `execute(payload)` - Execute a database operation

**Operations:**
- `query` - Load configs/schemas/data (reactive if callback provided)
- `create` - Create new records
- `update` - Update existing records (data collections)
- `updateConfig` - Update actor configs (system properties)
- `delete` - Delete records
- `toggle` - Toggle boolean field
- `seed` - Flush + seed database (dev only)

**Example:**
```javascript
import { DBEngine, IndexedDBBackend } from '@MaiaOS/script';

const backend = new IndexedDBBackend();
await backend.init();
const dbEngine = new DBEngine(backend);

// Query
const todos = await dbEngine.execute({
  op: 'query',
  schema: '@schema/todos',
  filter: { completed: false }
});

// Create
const newTodo = await dbEngine.execute({
  op: 'create',
  schema: '@schema/todos',
  data: { text: 'Buy milk', completed: false }
});
```

**Source:** `libs/maia-script/src/engines/db-engine/db.engine.js`

---

## SubscriptionEngine

**Purpose:** Context-driven reactive subscription manager.

**What it does:**
- Watches actor context for query objects
- Auto-subscribes to reactive data
- Auto-resolves `@` references
- Batches re-renders for performance
- Updates actor context automatically (infrastructure exception)

**Key Methods:**
- `initialize(actor)` - Initialize subscriptions for an actor
- `updateSubscriptions(actor)` - Update subscriptions when context changes
- `cleanup(actor)` - Clean up subscriptions when actor is destroyed

**Dependencies:**
- `DBEngine` - For query operations
- `ActorEngine` - For triggering re-renders

**Important:** This engine directly updates actor context for reactive query objects. This is the ONLY exception to the rule that state machines are the single source of truth for context changes.

**Source:** `libs/maia-script/src/engines/subscription-engine/subscription.engine.js`

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

**Source:** `libs/maia-script/src/engines/ModuleRegistry.js`

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

**Source:** `libs/maia-script/src/engines/message-queue/message.queue.js`

---

## Related Documentation

- [Main README](./README.md) - Package overview
- [modules.md](./modules.md) - Module system details
- [expressions.md](./expressions.md) - MaiaScript expressions
- [api-reference.md](./api-reference.md) - Complete API reference
