# Kernel Loader (Getting Started)

The **Kernel** is the single entry point for MaiaOS. It boots the operating system, loads modules, and creates your first actor.

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

  <!-- Import MaiaOS Kernel -->
  <script type="module">
    import { MaiaOS } from '../../o/kernel.js';
    
    async function boot() {
      // Boot the operating system
      const os = await MaiaOS.boot({
        modules: ['core', 'mutation', 'dragdrop']
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
  // Modules to load (default: ['core', 'mutation', 'dragdrop'])
  modules: ['core', 'mutation', 'dragdrop'],
  
  // Tools path (default: '../../o/tools')
  toolsPath: '../../o/tools'
});
```

## What Happens During Boot?

1. **Initialize Module Registry** - Prepares dynamic module loading
2. **Initialize Engines** - Boots all execution engines:
   - `ActorEngine` - Manages actor lifecycle
   - `StateEngine` - Interprets state machines
   - `ViewEngine` - Renders views
   - `ToolEngine` - Executes tools
   - `StyleEngine` - Compiles styles
   - `MaiaScriptEvaluator` - Evaluates DSL expressions
3. **Load Modules** - Dynamically loads specified modules
4. **Register Tools** - Each module registers its tools

## Available Modules

### Core Module (`core`)
UI utilities and modal management:
- `@core/setViewMode` - Switch view modes
- `@core/openModal` - Open modal dialogs
- `@core/closeModal` - Close modals
- `@core/noop` - No-operation (for testing)
- `@core/preventDefault` - Prevent default events

### Mutation Module (`mutation`)
Generic CRUD operations for any schema:
- `@mutation/create` - Create entities
- `@mutation/update` - Update entities by ID
- `@mutation/delete` - Delete entities
- `@mutation/toggle` - Toggle boolean fields

### Drag-Drop Module (`dragdrop`)
Generic drag-and-drop for any schema/field:
- `@dragdrop/start` - Start drag operation
- `@dragdrop/end` - End drag operation
- `@dragdrop/drop` - Handle drop with field update
- `@dragdrop/dragEnter` - Visual feedback on enter
- `@dragdrop/dragLeave` - Visual feedback on leave
- `@context/update` - Update context fields (used by input bindings)

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

**Vibes** are app manifests that provide marketplace metadata and reference the root actor. This is the recommended way to load applications:

```javascript
// Load a vibe (app manifest)
const { vibe, actor } = await os.loadVibe(
  './vibes/todos/todos.vibe.maia',
  document.getElementById('app')
);

console.log('Loaded vibe:', vibe.name);        // "Todo List"
console.log('Description:', vibe.description); // App description
console.log('Actor:', actor);                  // Created actor instance
```

**What's the difference?**
- `createActor()` - Direct actor creation (low-level)
- `loadVibe()` - Load app via manifest (recommended, marketplace-ready)

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
cd libs/maia-script
bun dev
```

Then navigate to `http://localhost:4200/examples/todos/`

## Console Output

On successful boot, you'll see:

```
🚀 Booting MaiaOS v0.4...
📦 Kernel: Module-based architecture
🤖 State Machines: AI-compatible actor coordination
📨 Message Passing: Actor-to-actor communication
🔧 Tools: Dynamic modular loading
📦 Loading 3 modules...
[CoreModule] Registering 5 tools...
[MutationModule] Registering 4 tools...
[DragDropModule] Registering 6 tools...
✅ Loaded 3 modules
✅ Registered 15 tools
✅ MaiaOS booted successfully
```

## Next Steps

- Learn about [Actors](./02-actors.md) - The building blocks
- Understand [State Machines](./05-state.md) - Actor behavior
- Explore [Tools](./06-tools.md) - Executable actions
- Add [Views](./07-views.md) - UI representation

## Troubleshooting

### Module not loading
```
Error: Failed to load module "dragdrop"
```
**Solution:** Check that the module file exists at `o/modules/dragdrop.module.js`

### Tool not found
```
[ToolEngine] Tool not found: @mutation/create
```
**Solution:** Ensure the `mutation` module is loaded in boot config

### Actor fails to load
```
Failed to load actor: ./maia/todo.actor.maia
```
**Solution:** Check file path is relative to your `index.html` location
