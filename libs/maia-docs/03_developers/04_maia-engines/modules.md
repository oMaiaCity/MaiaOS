# Module System

Modules are plugins that extend MaiaOS functionality. They register tools and provide configuration. Built-in modules are defined in `libs/maia-engines/src/modules/registry.js`.

---

## What Are Modules?

Modules are plugins that extend MaiaOS functionality. They register tools and provide configuration.

**Module Structure (in registry.js):**
```javascript
const BUILTIN_MODULES = {
  db: createModule('db', {
    version: '1.0.0',
    description: 'Unified database operation API',
    namespace: '@maia/actor/os',
    tools: ['@maia/actor/os/db'],
  }, (q) => (q === 'tools' ? ['@maia/actor/os/db'] : null)),
  core: createModule('core', {
    version: '1.0.0',
    description: 'Core UI tools',
    namespace: '@core',
    tools: ['preventDefault'],
  }),
  ai: createModule('ai', {
    version: '1.0.0',
    description: 'Unified AI tool for OpenAI-compatible API',
    namespace: '@maia/actor/os',
    tools: ['@maia/actor/os/ai'],
  }, (q) => (q === 'tools' ? ['@maia/actor/os/ai'] : null)),
};
```

---

## Available Modules

### db

**Purpose:** Database operations module. DataEngine executes all `maia.do` operations.

**Operations:** read, create, update, delete, readFactory, factory, colist ops, binary upload, spark ops, etc.

**Tools:**
- `@maia/actor/os/db` - Unified database operations

**Usage:**
```javascript
const store = await maia.do({ op: 'read', factory: '°Maia/factory/todos' });
const created = await maia.do({ op: 'create', factory: '°Maia/factory/todos', data: { text: 'New' } });
```

---

### core

**Purpose:** Core UI tools module.

**Tools:**
- `@core/preventDefault` - Prevent default events

---

### ai

**Purpose:** AI tools module for OpenAI-compatible API (RedPill).

**Tools:**
- `@maia/actor/os/ai` - Unified AI chat

---

## Module Registration

Modules use `registry.registerModule(name, module, config)` via `registerBuiltinModules(registry, moduleNames)`:

- **name** - Module identifier (e.g., 'db', 'core', 'ai')
- **module** - Object with `config` and `query(q)` function
- **config** - Metadata: version, description, namespace, tools

Tools are executed via ProcessEngine `op` actions. Actor definitions and functions live in `@MaiaOS/actors`.

---

## Loading Modules

Load modules during boot:

```javascript
const os = await MaiaOS.boot({
  node,
  account,
  modules: ['db', 'core', 'ai']
});
```

---

## Related Documentation

- [Main README](./README.md) - Package overview
- [engines/](./engines/) - Engine details
- [api-reference.md](./api-reference.md) - API reference
- [patterns.md](./patterns.md) - Common patterns
