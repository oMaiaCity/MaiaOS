# API Reference

Complete API reference for `@MaiaOS/runtime` package.

---

## Re-exports (single-entry pattern)

Services (app, sync) import only from `@MaiaOS/runtime`. Loader re-exports everything needed:

| Export | Source | Use |
|--------|--------|-----|
| `getAllFactories` | `@MaiaOS/factories/factory-registry` | Seed/bootstrap (canonical schema definitions) |
| `getSeedConfig` | `@MaiaOS/actors` | Seed/bootstrap (actor definitions) |
| `getAllVibeRegistries` | `@MaiaOS/vibes` (async) | Seed/bootstrap (vibe registries) |
| `buildSeedConfig` | `@MaiaOS/vibes` (async) | Seed config from vibes |
| `filterVibesForSeeding` | `@MaiaOS/vibes` (async) | Filter vibes by config |
| `createWebSocketPeer` | `cojson-transport-ws` | WebSocket sync peers |

Vibes helpers use dynamic import internally to avoid loader↔vibes circular dependency—callers use `await`.

---

## `MaiaOS.boot(config)`

Boots the MaiaOS operating system. Authentication is integrated into boot—you must provide a peer or node+account, or use agent mode with env vars.

**Parameters:**
- `config.node` (required for human mode) - LocalNode instance from `signInWithPasskey`
- `config.account` (required for human mode) - RawAccount instance from `signInWithPasskey`
- `config.peer` (alternative) - Pre-initialized MaiaDB peer
- `config.agentSecret` (optional) - Agent secret for UCAN/capability tokens
- `config.modules` (optional, default: `['db', 'core']`) - Modules to load (db, core, ai)
- `config.syncDomain` (optional) - Sync server domain
- `config.getMoaiBaseUrl` (optional) - Base URL for the sync server
- `config.isDevelopment` (optional) - Development mode flag
- `config.runtimeType` (optional, default: `'browser'`) - Runtime type

**Agent mode:** When `config.mode === 'agent'` and no peer/node+account, boot uses `AVEN_MAIA_ACCOUNT` and `AVEN_MAIA_SECRET` env vars with `loadOrCreateAgentAccount`.

**Returns:** `Promise<MaiaOS>` - Booted OS instance

**Example:**
```javascript
import { MaiaOS, signInWithPasskey } from '@MaiaOS/runtime';

// Human mode: authenticate first
const { accountID, agentSecret, loadingPromise } = await signInWithPasskey({ salt: "maia.city" });
const { node, account } = await loadingPromise;

const os = await MaiaOS.boot({
  node,
  account,
  modules: ['db', 'core', 'ai']
});
```

---

## `os.createActor(actorPath, container)`

Creates an actor from a `.maia` file.

**Parameters:**
- `actorPath` (string) - Path to actor file or co-id
- `container` (HTMLElement) - DOM container for actor

**Returns:** `Promise<Object>` - Created actor instance

**Example:**
```javascript
const actor = await os.createActor(
  './actors/todo.actor.maia',
  document.getElementById('todo-container')
);
```

---

## `os.loadVibe(vibeKeyOrCoId, container, spark?)`

Loads a vibe from account or spark vibes, or by co-id. Delegates to `loadVibeFromAccount`.

**Parameters:**
- `vibeKeyOrCoId` (string) - Vibe key (e.g., `'todos'`) from account.vibes, or co-id (`co_z...`)
- `container` (HTMLElement) - DOM container for root actor
- `spark` (optional, default: `'°Maia'`) - Spark for vibe lookup

**Returns:** `Promise<{vibe: Object, actor: Object}>` - Vibe metadata and actor

**Example:**
```javascript
const { vibe, actor } = await os.loadVibe(
  'todos',
  document.getElementById('app-container')
);
```

---

## `os.loadVibeFromAccount(vibeKeyOrCoId, container, spark?)`

Loads a vibe from account.vibes or by co-id. If vibe key, resolves from account; if co-id, loads from database.

**Parameters:**
- `vibeKeyOrCoId` (string) - Vibe key (e.g., `'todos'`) or co-id (`co_z...`)
- `container` (HTMLElement) - DOM container for root actor
- `spark` (optional, default: `'°Maia'`) - Spark for vibe lookup

**Returns:** `Promise<{vibe: Object, actor: Object}>` - Vibe metadata and actor

---

## `os.loadVibeFromDatabase(vibeId, container, vibeKey?)`

Loads a vibe from the database by co-id.

**Parameters:**
- `vibeId` (string) - Vibe co-id (`co_z...`); human-readable IDs like `@vibe/todos` are not supported
- `container` (HTMLElement) - DOM container for root actor
- `vibeKey` (optional) - Vibe key for actor reuse tracking (e.g., `'todos'`)

**Returns:** `Promise<{vibe: Object, actor: Object}>` - Vibe metadata and actor

**Example:**
```javascript
const { vibe, actor } = await os.loadVibeFromDatabase(
  'co_zVibe123...',
  document.getElementById('app-container'),
  'todos'
);
```

---

## `os.getActor(actorId)`

Gets an actor by ID.

**Parameters:**
- `actorId` (string) - Actor ID

**Returns:** `Object|null` - Actor instance or null

---

## `os.deliverEvent(senderId, targetId, type, payload)`

Delivers an event to a target actor (inbox-only, persisted via CoJSON).

**Parameters:**
- `senderId` (string) - Sender actor co-id
- `targetId` (string) - Target actor co-id (co-id only; config-derived refs must be transformed at seed)
- `type` (string) - Message type
- `payload` (Object) - Resolved payload (no expressions)

**Returns:** `Promise<void>`

**Example:**
```javascript
await os.deliverEvent('co_z...', 'actor-123', 'click', {
  target: 'button-1'
});
```

---

## `os.do(payload)`

Executes a database operation (internal use + `@db` tool). Delegates to DataEngine.

**Parameters:**
- `payload` (Object) - Operation payload:
  - `op` (string) - Operation type: `'read'`, `'create'`, `'update'`, `'delete'`, `'readFactory'`, `'factory'`, colist ops, etc.
  - `factory` (string) - Factory co-id or registry key (e.g., `°Maia/factory/todos`)
  - Other fields depend on operation type

**Returns:** `Promise<any>` - Operation result (for `read`, returns ReactiveStore)

**Example:**
```javascript
// Read (returns reactive store)
const store = await os.do({
  op: 'read',
  factory: '°Maia/factory/todos',
  filter: { completed: false }
});

// Store has current value immediately
console.log('Current todos:', store.value);

// Subscribe to updates
const unsubscribe = store.subscribe((todos) => {
  console.log('Todos updated:', todos);
});

// Create
const newTodo = await os.do({
  op: 'create',
  factory: '°Maia/factory/todos',
  data: { text: 'Buy milk', completed: false }
});
```

---

## `os.getEngines()`

Gets all engines for debugging.

**Returns:** `Object` - Engine instances:
- `actorEngine` - ActorEngine
- `viewEngine` - ViewEngine
- `styleEngine` - StyleEngine
- `processEngine` - ProcessEngine (state machines)
- `dataEngine` - DataEngine (data operations)
- `evaluator` - MaiaScriptEvaluator
- `moduleRegistry` - ModuleRegistry

---

## Related Documentation

- [Main README](./README.md) - Package overview
- [auth-layer.md](./auth-layer.md) - Identity & Authentication layer
- [boot-process.md](./boot-process.md) - Boot process details
- [patterns.md](./patterns.md) - Common patterns
