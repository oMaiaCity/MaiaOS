# Loader (Getting Started)

The **Loader** is the single entry point for MaiaOS. It boots the operating system, loads modules, and creates your first actor.

## Quick Start

### 1. Basic HTML Setup

```html
<!DOCTYPE html>
<html>
<head>
  <title>My First MaiaOS App</title>
</head>
<body>
  <!-- Actor container -->
  <div id="actor-todo"></div>

  <!-- Import MaiaOS Loader -->
  <script type="module">
    import { MaiaOS } from '@MaiaOS/loader';
    
    async function boot() {
      // Boot the operating system
      const os = await MaiaOS.boot({
        modules: ['db', 'core']  // Default modules
      });
      
      // Create an actor
      const actor = await os.createActor(
        './maia/todo.actor.maia',
        document.getElementById('actor-todo')
      );
      
      console.log('✅ App booted!', actor);
    }
    
    boot();
  </script>
</body>
</html>
```

### 2. Boot Configuration

```javascript
const os = await MaiaOS.boot({
  // Modules to load (default: ['db', 'core'])
  modules: ['db', 'core']  // Add 'dragdrop' if needed
});
```

## What Happens During Boot?

1. **Initialize Database** - Sets up database backend (CoJSON or IndexedDB)
2. **Initialize Module Registry** - Prepares dynamic module loading
3. **Initialize Engines** - Boots all execution engines:
   - `ActorEngine` - Manages actor lifecycle
   - `StateEngine` - Interprets state machines
   - `ViewEngine` - Renders views
   - `ToolEngine` - Executes tools
   - `StyleEngine` - Compiles styles
   - `MaiaScriptEvaluator` - Evaluates DSL expressions
   - `DataEngine` - Unified data operations via **maia.do({ op, schema, key, ... })**
4. **Load Modules** - Dynamically loads specified modules (default: `['db', 'core']`)
5. **Register Tools** - Each module registers its tools

## Available Modules

### Database Module (`db`)
Unified database operations through a single `@db` tool:
- All operations use `op` parameter (`create`, `update`, `delete`, `toggle`, `read`, `seed`)
- **Universal `read()` API** - Every CoValue is accessible as a reactive store
- Example: `{ tool: "@db", payload: { op: "create", schema: "co_z...", data: {...} } }`
- **Note:** Schema must be a co-id (`co_z...`) - schema references (`@schema/todos`) are transformed to co-ids during seeding
- All `read()` operations return ReactiveStore with `.value` and `.subscribe()` methods
- See [Operations](./07-operations.md) for the universal read() API pattern

### Core Module (`core`)
UI utilities and message publishing:
- `@core/publishMessage` - Publish messages to subscribed actors
- `@core/noop` - No-operation (for testing)
- `@core/preventDefault` - Prevent default events

### Drag-Drop Module (`dragdrop`)
Generic drag-and-drop for any schema/field:
- `@dragdrop/start` - Start drag operation
- `@dragdrop/end` - End drag operation
- `@dragdrop/drop` - Handle drop with field update
- `@dragdrop/dragEnter` - Visual feedback on enter
- `@dragdrop/dragLeave` - Visual feedback on leave

## Creating Actors

### Direct Actor Creation

```javascript
// Create a single actor
const todoActor = await os.createActor(
  './maia/todo.actor.maia',      // Actor definition path
  document.getElementById('app')  // Container element
);

// Create multiple actors
const actors = await Promise.all([
  os.createActor('./maia/todo.actor.maia', document.getElementById('todos')),
  os.createActor('./maia/notes.actor.maia', document.getElementById('notes')),
  os.createActor('./maia/calendar.actor.maia', document.getElementById('cal'))
]);
```

### Loading Vibes (Recommended)

**Vibes** are app manifests that provide marketplace metadata and reference the agent service actor. This is the recommended way to load applications:

```javascript
// Load a vibe (app manifest)
const { vibe, actor } = await os.loadVibe(
  './vibes/todos/manifest.vibe.maia',
  document.getElementById('app')
);

console.log('Loaded vibe:', vibe.name);        // "Todo List"
console.log('Description:', vibe.description); // App description
console.log('Actor:', actor);                  // Created agent actor instance
```

**What's the difference?**
- `createActor()` - Direct actor creation (low-level)
- `loadVibe()` - Load app via manifest (recommended, marketplace-ready)
  - Always loads the vibe root service actor (`@actor/vibe`)
  - Agent orchestrates the entire application

**Best Practice:** Always create the agent service actor first, then reference it in the vibe manifest.

**Learn more:** See [Vibes](./00-vibes.md) for complete documentation on app manifests.

## Accessing the OS

The booted OS instance provides:

```javascript
// Get an actor by ID
const actor = os.getActor('actor_todo_001');

// Send a message to an actor
os.sendMessage('actor_todo_001', {
  type: 'notification',
  data: {text: 'Task completed!'}
});

// Access engines for debugging
const engines = os.getEngines();
console.log(engines.stateEngine, engines.toolEngine);

// Expose globally for debugging (optional)
window.os = os;
window.engines = engines;
```

## File Structure

Your project should be organized like this:

```
my-app/
├── index.html              # Your app entry point
└── maia/                   # Actor definitions
    ├── todo.actor.maia     # Actor config
    ├── todo.state.maia     # State machine
    ├── todo.view.maia      # UI definition
    ├── todo.style.maia     # Styling (optional)
    └── brand.style.maia    # Design system (optional)
```

## Development Server

For development with hot reload:

```bash
bun dev
```

Then navigate to `http://localhost:4200/examples/todos/`

## Console Output

On successful boot, you'll see:

```
🚀 Booting MaiaOS...
📦 Loader: Module-based architecture
🤖 State Machines: AI-compatible actor coordination
📨 Message Passing: Actor-to-actor communication
🔧 Tools: Dynamic modular loading
📦 Loading 4 modules...
[DBModule] Registering 1 tool (@db)...
[CoreModule] Registering 5 tools...
[DragDropModule] Registering 5 tools...
✅ Loaded 3 modules
✅ Registered 11 tools
✅ MaiaOS booted successfully
```

## Next Steps

- [Actors](./03-actors/) – Building blocks
- [State Machines](./05-state/) – Actor behavior
- [Tools](./06-tools/) – Executable actions
- [Views](./08-views/) – UI representation
- [Creator Overview](./00-overview.md) – Full creator docs path

## Troubleshooting

### Module not loading
```
Error: Failed to load module "dragdrop"
```
**Solution:** Check that the module file exists at `libs/maia-engines/src/modules/dragdrop.module.js`

### Tool not found
```
[ToolEngine] Tool not found: @db
```
**Solution:** Ensure the `db` module is loaded in boot config

### Actor fails to load
```
Failed to load actor: ./maia/todo.actor.maia
```
**Solution:** Check file path is relative to your `index.html` location
