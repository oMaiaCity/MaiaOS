# Module System

Modules are plugins that extend MaiaOS functionality. They register tools and provide configuration.

---

## What Are Modules?

Modules are plugins that extend MaiaOS functionality. They register tools and provide configuration.

**Module Structure:**
```javascript
export const config = {
  version: '1.0.0',
  description: 'My module description',
  namespace: '@mymodule',
  tools: ['@mymodule/tool1', '@mymodule/tool2'],
};

export async function register(registry) {
  registry.registerModule('mymodule', { config, query: (q) => (q === 'tools' ? config.tools : null) }, {
    version: config.version,
    description: config.description,
    namespace: config.namespace,
    tools: config.tools,
  });
}
```

---

## Available Modules

### db.module.js

**Purpose:** Database operations module. Owns all built-in `maia.do` operations.

**Operations:** DataEngine self-wires all built-in ops at construction. Built-in ops: read, create, update, delete, seed, schema, resolve, append, push, processInbox, createSpark, readSpark, updateSpark, deleteSpark, addSparkMember, removeSparkMember, addSparkParentGroup, removeSparkParentGroup, getSparkMembers, updateSparkMemberRole.

**Extending with custom operations:**
```javascript
// In your module's register():
const dataEngine = registry._dataEngine
if (dataEngine) {
  dataEngine.registerOperation('myOp', {
    execute: async (params) => { /* ... */ }
  })
}
```

**Tools:**
- `@db` - Unified database operations

**Usage:**
```javascript
// Tools are automatically available after module loads
// Use in process handlers via op action:
{ "op": { "read": { "schema": "co_zTodos123", "filter": { "completed": false } } } }

// maia.do (DataEngine) - always returns reactive store:
const store = await maia.do({ op: 'read', schema: 'co_zTodos123' });
console.log('Current todos:', store.value);
store.subscribe((todos) => {
  console.log('Todos updated:', todos);
});
```

---

### core.module.js

**Purpose:** Core UI tools module.

**Tools:**
- `@core/noop` - No-operation (for testing)
- `@core/preventDefault` - Prevent default events
- `@core/publishMessage` - Publish messages to subscribed actors

---

### dragdrop.module.js

**Purpose:** Drag-and-drop functionality module.

**Tools:**
- `@dragdrop/start` - Start drag operation
- `@dragdrop/end` - End drag operation
- `@dragdrop/drop` - Handle drop
- `@dragdrop/dragEnter` - Handle drag enter
- `@dragdrop/dragLeave` - Handle drag leave

**Configuration:**
```javascript
// Access module config
const config = registry.getModule('dragdrop').query('config');
```

---

## Creating Custom Modules

### Step 1: Create Module File

Create `libs/maia-engines/src/modules/mymodule.module.js`:

```javascript
import { getToolEngine, registerToolsFromRegistry, registerModuleConfig } from '../utils/module-registration.js';

export const config = {
  version: '1.0.0',
  description: 'My custom module',
  namespace: '@mymodule',
  tools: ['@mymodule/tool1', '@mymodule/tool2'],
};

export async function register(registry) {
  registry.registerModule('mymodule', { config, query: (q) => (q === 'tools' ? config.tools : null) }, {
    version: config.version,
    description: config.description,
    namespace: config.namespace,
    tools: config.tools,
  });
}
```

### Step 2: Create Tools

Create tools in `@MaiaOS/tools` package (see `@MaiaOS/tools` documentation).

### Step 3: Load Module

Load module during boot:

```javascript
const os = await MaiaOS.boot({
  modules: ['db', 'core', 'mymodule'] // Add your module
});
```

---

## Module Registration

Modules use `registry.registerModule(name, module, config)`:

- **name** - Module identifier (e.g., 'db', 'core', 'ai')
- **module** - Object with `config` and `query(q)` function
- **config** - Metadata: version, description, namespace, tools

Tools are executed via ProcessEngine `op` actions. DataEngine operations are registered via `dataEngine.registerOperation()`.

---

## Related Documentation

- [Main README](./README.md) - Package overview
- [engines/](./engines/) - Engine details
- [api-reference.md](./api-reference.md) - API reference
- [patterns.md](./patterns.md) - Common patterns
