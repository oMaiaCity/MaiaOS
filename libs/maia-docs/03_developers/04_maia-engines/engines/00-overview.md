# Engines

The `@MaiaOS/engines` package provides the core engines that execute MaiaScript and manage actor lifecycles. Five engines work together: ActorEngine, ViewEngine, ProcessEngine, StyleEngine, DataEngine. Plus the MaiaScriptEvaluator and Runtime.

---

## Evaluator (MaiaScriptEvaluator)

**Purpose:** Evaluates MaiaScript expressions safely.

**What it does:**
- Evaluates JSON-based expressions (`$if`, `$eq`, `$ne`, `$context`, `$$item`, etc.)
- Resolves data paths (`$context.title`, `$$item.id`)
- Validates expressions against schema before evaluation
- Enforces depth limits to prevent DoS attacks
- Supports shortcut syntax: `$key` (context) and `$$key` (item)
- Ternary shortcut: `$condition ? $then : $else` (string syntax)
- `$join` - Join array elements with separator

**Key Methods:** `evaluate(expression, data, depth)`, `evaluateShortcut(expression, data)`, `isDSLOperation(value)`

**Source:** `libs/maia-engines/src/utils/evaluator.js`

---

## ActorEngine

**Purpose:** Orchestrates actor lifecycle and coordinates all engines.

**What it does:**
- Creates and manages actors (`createActor`, `spawnActor`, `destroyActor`)
- Handles message delivery and inbox logic (validates messages, resolves inboxes, delivers to CoStreams)
- Processes inbox messages sequentially (`processEvents`)
- Coordinates ViewEngine, StyleEngine, ProcessEngine
- Batches rerenders (Svelte-style microtask queue)
- Manages child actors (`_createChildActorByCoId`)

**Key Methods:**
- `createActor(actorConfig, containerElement, vibeKey)` - Create view-attached actor
- `spawnActor(actorConfig, options)` - Spawn headless actor
- `destroyActor(actorId)` - Destroy single actor
- `deliverEvent(senderId, targetId, type, payload)` - Deliver event to actor inbox
- `processEvents(actorId)` - Process pending inbox messages
- `rerender(actorId)` - Trigger rerender (batched)

**Dependencies:** StyleEngine, ViewEngine, ProcessEngine, ModuleRegistry

**Source:** `libs/maia-engines/src/engines/actor.engine.js`

---

## ViewEngine

**Purpose:** Renders `.maia` view definitions to Shadow DOM.

**What it does:**
- Converts view definitions to DOM elements
- Handles `$each` loops, `$slot` for actor composition, `$on` event handlers
- Uses Shadow DOM for style isolation
- Sanitizes HTML to prevent XSS
- **Reactive rendering** - Re-renders when context changes
- **Resolves ALL expressions before sending to inbox** - Only resolved values persist to CoJSON

**Key Methods:** `attachViewToActor()`, `render()`, `renderNode()`, `renderEach()`, `_handleEvent()`

**Source:** `libs/maia-engines/src/engines/view.engine.js`

---

## ProcessEngine

**Purpose:** State machine and event handler execution. Routes events to handlers.

**What it does:**
- Creates process instances (`createProcess`)
- Routes events to handlers keyed by message type: `handlers[event]` → array of actions
- Executes actions: `ctx` (context updates), `op` (DB operations), `tell`/`ask` (messaging), `function` (executable)
- Persists `_currentState` to actor context on transitions

**Flow:** `inbox → processEvents() → ProcessEngine.send(processId, event, payload) → handlers[event] → _executeActions()`

**Key Methods:**
- `createProcess(processDef, actor)` - Create process instance
- `send(processId, event, payload)` - Send event to process (routes to handlers)

**Source:** `libs/maia-engines/src/engines/process.engine.js`

---

## StyleEngine

**Purpose:** Compiles `.maia` style definitions to CSS.

**What it does:**
- Compiles style definitions to Constructable Stylesheets
- Merges brand styles with actor overrides (deep merge)
- Interpolates token references (`{token.color}`)
- Caches compiled stylesheets
- Blocks CSS injection (url(), expression(), etc.)

**Key Methods:** `getStyleSheets(actorConfig, actorId)` - Get compiled CSSStyleSheet array

**Source:** `libs/maia-engines/src/engines/style.engine.js`

---

## DataEngine

**Purpose:** Public data API – **maia.do({ op, factory, key, filter, ... })**

**What it does:**
- Single API for all data operations
- Self-wires built-in operations at construction

**Operations:** read, create, update, delete, readFactory, factory, resolve, append, push, processInbox, seed, createSpark, readSpark, updateSpark, deleteSpark, addSparkMember, removeSparkMember, addSparkParentGroup, removeSparkParentGroup, getSparkMembers, updateSparkMemberRole, colistSet, colistPush, colistUnshift, colistPop, colistShift, colistSplice, colistRemove, colistRetain, colistApplyDiff, uploadBinary, loadBinaryAsBlob, uploadToCoBinary

**Key Method:** `execute({ op, ...params })` - Execute any operation

**Source:** `libs/maia-engines/src/engines/data.engine.js`

---

## Runtime

**Purpose:** Browser runtime for actor lifecycle and inbox watching.

**What it does:**
- Creates view-attached actors (`createActorForView`)
- Destroys actors (`destroyActor`, `destroyActorsForAgent`, `destroyActorsForContainer`)
- Loads actor config from DB (`getActorConfig`)
- Watches inboxes for unprocessed messages (`watchInbox`, `start`)
- Ensures headless actors spawn when messages arrive (`ensureActorSpawned`)

**Key Methods:** `createActorForView()`, `destroyActor()`, `getActorConfig()`, `start()`, `watchInbox()`

**Source:** `libs/maia-engines/src/runtimes/browser.js`

---

## Related Documentation

- [01-detail.md](./01-detail.md) - Architecture, DataEngine operations, patterns
- [02-reference.md](./02-reference.md) - Method signatures
- [../../api-reference.md](../api-reference.md) - Complete API reference
