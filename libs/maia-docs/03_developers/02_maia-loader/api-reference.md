# API Reference

Complete API reference for `@MaiaOS/loader` package.

---

## Re-exports (single-entry pattern)

Services (maia, moai) import only from `@MaiaOS/loader`. Loader re-exports everything needed:

| Export | Source | Use |
|--------|--------|-----|
| `getAllSchemas` | `@MaiaOS/schemata` | Seed/bootstrap (canonical schema definitions) |
| `getAllToolDefinitions` | `@MaiaOS/tools` | Seed/bootstrap (tool definitions) |
| `getAllVibeRegistries` | `@MaiaOS/vibes` (async) | Seed/bootstrap (vibe registries) |
| `buildSeedConfig` | `@MaiaOS/vibes` (async) | Seed config from vibes |
| `filterVibesForSeeding` | `@MaiaOS/vibes` (async) | Filter vibes by config |
| `createWebSocketPeer` | `cojson-transport-ws` | WebSocket sync peers |

Vibes helpers use dynamic import internally to avoid loader↔vibes circular dependency—callers use `await`.

---

## `createMaiaOS(options)`

Creates an authenticated MaiaOS instance (identity layer).

**Parameters:**
- `options.node` (required) - LocalNode instance from `signInWithPasskey`
- `options.account` (required) - RawAccount instance from `signInWithPasskey`
- `options.accountID` (optional) - Account ID string
- `options.name` (optional) - Display name

**Returns:** `Promise<Object>` - MaiaOS instance with:
- `id` - Identity object (`{ maiaId, node }`)
- `auth` - Authentication API
- `db` - Database API (future)
- `script` - DSL API (future)
- `inspector()` - Dev tool to inspect account
- `getAllCoValues()` - List all CoValues
- `getCoValueDetail(coId)` - Get CoValue details

**Throws:** If `node` or `account` not provided

**Example:**
```javascript
const { node, account } = await signInWithPasskey({ salt: "maia.city" });
const o = await createMaiaOS({ node, account });

// Inspect your account
const accountData = o.inspector();
console.log("Account data:", accountData);

// List all CoValues
const coValues = o.getAllCoValues();
console.log("CoValues:", coValues);
```

---

## `MaiaOS.boot(config)`

Boots the MaiaOS operating system (execution layer).

**Parameters:**
- `config.modules` (optional, default: `['db', 'core', 'dragdrop']`) - Modules to load
- `config.isDevelopment` (optional) - Development mode flag

**Returns:** `Promise<MaiaOS>` - Booted OS instance

**Example:**
```javascript
const os = await MaiaOS.boot({
  modules: ['db', 'core', 'dragdrop']
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

## `os.loadVibe(vibePath, container)`

Loads a vibe (app manifest) from a file.

**Parameters:**
- `vibePath` (string) - Path to `.vibe.maia` file
- `container` (HTMLElement) - DOM container for root actor

**Returns:** `Promise<{vibe: Object, actor: Object}>` - Vibe metadata and actor

**Example:**
```javascript
const { vibe, actor } = await os.loadVibe(
  './vibes/todos/manifest.vibe.maia',
  document.getElementById('app-container')
);
```

---

## `os.loadVibeFromDatabase(vibeId, container)`

Loads a vibe from the database.

**Parameters:**
- `vibeId` (string) - Vibe ID (e.g., `"@vibe/todos"`)
- `container` (HTMLElement) - DOM container for root actor

**Returns:** `Promise<{vibe: Object, actor: Object}>` - Vibe metadata and actor

**Example:**
```javascript
const { vibe, actor } = await os.loadVibeFromDatabase(
  '@vibe/todos',
  document.getElementById('app-container')
);
```

---

## `os.getActor(actorId)`

Gets an actor by ID.

**Parameters:**
- `actorId` (string) - Actor ID

**Returns:** `Object|null` - Actor instance or null

---

## `os.sendMessage(actorId, message)`

Sends a message to an actor.

**Parameters:**
- `actorId` (string) - Target actor ID
- `message` (Object) - Message object

**Example:**
```javascript
os.sendMessage('actor-123', {
  type: 'click',
  target: 'button-1'
});
```

---

## `os.db(payload)`

Executes a database operation (internal use + `@db` tool).

**Parameters:**
- `payload` (Object) - Operation payload:
  - `op` (string) - Operation type: `'read'`, `'create'`, `'update'`, `'delete'`, `'seed'`
  - Other fields depend on operation type

**Returns:** `Promise<any>` - Operation result (for `read`, returns ReactiveStore)

**Example:**
```javascript
// Read (always returns reactive store)
const store = await os.db({
  op: 'read',
  schema: 'co_zTodos123',  // Schema co-id (co_z...)
  filter: { completed: false }
});

// Store has current value immediately
console.log('Current todos:', store.value);

// Subscribe to updates
const unsubscribe = store.subscribe((todos) => {
  console.log('Todos updated:', todos);
});

// Create
const newTodo = await os.db({
  op: 'create',
  schema: '@schema/todos',
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
- `stateEngine` - StateEngine
- `toolEngine` - ToolEngine
- `dbEngine` - DBEngine
- `evaluator` - MaiaScriptEvaluator
- `moduleRegistry` - ModuleRegistry

---

## Related Documentation

- [Main README](./README.md) - Package overview
- [auth-layer.md](./auth-layer.md) - Identity & Authentication layer
- [boot-process.md](./boot-process.md) - Boot process details
- [patterns.md](./patterns.md) - Common patterns
