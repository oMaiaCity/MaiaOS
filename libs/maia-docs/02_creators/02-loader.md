# Loader (Getting Started)

The **Loader** is the single entry point for MaiaOS. It boots the operating system, loads modules, and creates actors.

## Boot Requirements

**CRITICAL:** `MaiaOS.boot()` requires either:
- `{ node, account }` — From auth (signInWithPasskey, loadOrCreateAgentAccount)
- `{ peer }` — Pre-configured MaiaDB peer

Boot **cannot** run with only `modules`. You must authenticate first to get `node` and `account`.

## Quick Start

### 1. Auth + Boot + Load Vibe

```html
<!DOCTYPE html>
<html>
<head>
  <title>My First MaiaOS App</title>
</head>
<body>
  <div id="app"></div>

  <script type="module">
    import { MaiaOS, signInWithPasskey } from '@MaiaOS/runtime';
    import { TodosVibeRegistry } from '@MaiaOS/vibes';

    async function boot() {
      // 1. Authenticate (required for node + account)
      const { node, account } = await signInWithPasskey({ salt: 'maia.city' });

      // 2. Boot MaiaOS with node, account, and vibe registry
      const maia = await MaiaOS.boot({
        node,
        account,
        modules: ['db', 'core', 'ai'],
        registry: TodosVibeRegistry,
      });

      // 3. Load vibe from account (by key, not file path)
      const { vibe, actor } = await maia.loadVibeFromAccount(
        'todos',
        document.getElementById('app'),
        '°Maia'
      );

      console.log('✅ App booted!', vibe.name, actor);
    }

    boot();
  </script>
</body>
</html>
```

### 2. Boot Configuration

```javascript
const maia = await MaiaOS.boot({
  // Required: either peer OR (node + account)
  node,           // From signInWithPasskey or loadOrCreateAgentAccount
  account,        // From signInWithPasskey or loadOrCreateAgentAccount
  // OR: peer,   // Pre-configured MaiaDB

  // Optional
  modules: ['db', 'core', 'ai'],  // Default: ['db', 'core']
  registry: TodosVibeRegistry,    // Vibe registry for seeding/loading
  getMoaiBaseUrl: () => 'https://sync.example.com',  // For createSpark POST
});
```

## What Happens During Boot?

1. **Initialize DataEngine** — Requires `peer` (MaiaDB) or creates one from `node` + `account`
2. **Initialize Module Registry** — Prepares dynamic module loading
3. **Initialize Engines** — Boots all execution engines:
   - `ActorEngine` — Manages actor lifecycle
   - `ProcessEngine` — Interprets process handlers (event → actions)
   - `ViewEngine` — Renders views
   - `StyleEngine` — Compiles styles
   - `MaiaScriptEvaluator` — Evaluates DSL expressions
   - `DataEngine` — Unified data operations via **maia.do({ op, factory, key, filter, ... })**
4. **Load Modules** — Dynamically loads specified modules (default: `['db', 'core']`)
5. **Register Tools** — Each module registers its tools (e.g. @maia/actor/os/db)

## Available Modules

### Database Module (`db`)
Registers the database service actor:
- `@maia/actor/os/db` — Unified database operations (creator-facing alias: `@db`)
- Used by process handlers via `op` action (direct DataEngine), or by service actors via `function: true`
- See [Operations](./07-operations/) for maia.do() API

### Core Module (`core`)
UI utilities:
- `@core/preventDefault` — Prevent default browser behavior on events

### AI Module (`ai`)
AI/LLM integration (when included in modules).

## Creating Actors

### Direct Actor Creation

```javascript
// Create actor by co-id, path (human-readable key), or config object
const actor = await maia.createActor(
  'co_zActor123...',           // Co-id
  document.getElementById('app')
);

// Or by human-readable path (resolved at runtime)
const actor = await maia.createActor(
  '°Maia/actor/views/list',
  document.getElementById('app')
);
```

### Loading Vibes (Recommended)

**Vibes** are loaded by **key** from `account.registries.sparks[spark].os.vibes`. The registry is passed at boot.

```javascript
// Load vibe by key (e.g. 'todos', 'chat')
const { vibe, actor } = await maia.loadVibeFromAccount(
  'todos',                        // Vibe key in spark.os.vibes
  document.getElementById('app'),
  '°Maia'                         // Spark (default: '°Maia')
);

// loadVibe is an alias that delegates to loadVibeFromAccount
const { vibe, actor } = await maia.loadVibe('todos', container);
```

**What's the difference?**
- `createActor()` — Direct actor creation (low-level)
- `loadVibeFromAccount()` — Load app via vibe key from account (recommended)
  - Requires registry at boot for seeding
  - Loads vibe manifest from account, then creates root actor

**Learn more:** See [Vibes](./01-vibes/) for complete documentation.

## Accessing the OS

The booted MaiaOS instance provides:

```javascript
// Get an actor by ID
const actor = maia.getActor('co_zActor123...');

// Deliver an event to an actor
maia.deliverEvent(senderId, targetActorId, 'EVENT_TYPE', { payload });

// Execute data operations
const store = await maia.do({ op: 'read', factory: 'co_z...', filter: {} });

// Access engines for debugging
const engines = maia.getEngines();
// Returns: actorEngine, viewEngine, styleEngine, processEngine, dataEngine, evaluator, moduleRegistry

// Expose globally for debugging (optional)
window.maia = maia;
window.engines = maia.getEngines();
```

## File Structure

Your project should be organized like this:

```
my-app/
├── index.html              # Your app entry point
└── maia/                   # Actor definitions (or in vibe package)
    ├── todo.actor.maia     # Actor config
    ├── todo.process.maia   # Process handlers
    ├── todo.context.maia  # Context definition
    ├── todo.view.maia     # UI definition
    ├── todo.style.maia    # Styling (optional)
    └── brand.style.maia   # Design system (optional)
```

## Development Server

For development with hot reload:

```bash
bun dev
```

Then navigate to `http://localhost:4200/` (or your app route).

## Troubleshooting

### Boot fails: "requires either a peer or node+account"
**Solution:** You must authenticate first. Use `signInWithPasskey()` or `loadOrCreateAgentAccount()` to get `{ node, account }`, then pass them to `MaiaOS.boot()`.

### Vibe not found when loading
**Solution:** Ensure the vibe registry is passed at boot (`registry: TodosVibeRegistry`) and the vibe has been seeded to `account.registries.sparks[°Maia].os.vibes`.

### Actor fails to load
**Solution:** Check that the actor path resolves (human-readable key like `°Maia/actor/...` or co-id). Paths are resolved via `maia.do({ op: 'resolve', humanReadableKey, ... })`.

## Next Steps

- [Actors](./03-actors/) – Building blocks
- [Process Handlers](./05-state/) – Actor behavior
- [Tools](./06-tools/) – Service actors and messaging
- [Views](./08-views/) – UI representation
- [Creator Overview](./00-overview.md) – Full creator docs path
