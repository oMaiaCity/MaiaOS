# maia-engines: Execution Engines and Modules

## Overview

The `@MaiaOS/engines` package provides the execution components that power MaiaOS. Merged from maia-script + maia-operations. Think of it as the factory floor where all the work happens - engines process your definitions, modules provide tools, and **DataEngine** executes **maia.do({ op, schema, key, ... })**.

**What it is:**
- ✅ **DataEngine** – Public data API: **maia.do({ op, schema, key, filter, ... })**
- ✅ **Execution engines** – ActorEngine, ViewEngine, StateEngine, StyleEngine, ToolEngine
- ✅ **Module system** – Plugin architecture for extending functionality
- ✅ **MaiaScript evaluator** – Evaluates JSON-based expressions safely

**What it isn't:**
- ❌ **Not the loader** – Boot process is in `@MaiaOS/loader`
- ❌ **Not tool definitions** – Tools are in `@MaiaOS/tools`
- ❌ **Not schemas** – Schema validation is in `@MaiaOS/schemata`

---

## The Simple Version

Think of `maia-engines` like a factory with specialized workers:

- **DataEngine** = The librarian – **maia.do()** executes all data operations (read, create, update, delete, etc.)
- **ActorEngine** = The manager (orchestrates everything)
- **ViewEngine** = The painter (renders UI)
- **StyleEngine** = The stylist (compiles CSS)
- **StateEngine** = The conductor (runs state machines)
- **ToolEngine** = The executor (runs tools)
- **SubscriptionEngine** = The watcher (keeps data in sync)

**All engines use maia.do for data** – no direct MaiaDB access.

---

## Architecture

### Package Structure

```
libs/maia-engines/src/
├── engines/                  # Core execution engines
│   ├── data.engine.js        # DataEngine – maia.do({ op, schema, key, ... })
│   ├── actor.engine.js
│   ├── state.engine.js
│   ├── view.engine.js
│   ├── style.engine.js
│   ├── tool.engine.js
│   └── ...
├── operations/               # Operation implementations (read, create, update, etc.)
├── modules/                 # db, core, ai, sparks
└── utils/                   # Evaluator, config-loader
```

### API Hierarchy

```
service → maia-loader → maia.os → maia.do → maia.db (MaiaDB) → maia.peer
```

- **maia.do** = DataEngine – public data API
- **maia.db** = MaiaDB (internal, used by DataEngine)

---

## Documentation Structure

- **[engines/](./engines/)** - Detailed descriptions of all engines
- **[modules.md](./modules.md)** - Module system and creating custom modules
- **[expressions.md](./expressions.md)** - MaiaScript expression language reference
- **[api-reference.md](./api-reference.md)** - Complete API reference
- **[subscriptions-overview.md](./subscriptions-overview.md)** - Subscription architecture
- **[subscriptions-reference.md](./subscriptions-reference.md)** - Config/data details
- **[patterns.md](./patterns.md)** - Common patterns and troubleshooting

---

## Quick Start

```javascript
// Data operations via maia.do (from MaiaOS.boot())
const store = await maia.do({ op: 'read', schema: 'co_z...', filter: { done: false } });
const created = await maia.do({ op: 'create', schema: 'co_z...', data: { text: 'New item' } });
```

For full system usage, see the [maia-loader Package](../02_maia-loader/README.md).

---

## Related Documentation

- [maia-loader Package](../02_maia-loader/README.md) - Boot process and orchestration
- [maia-db Package](../05_maia-db/README.md) - MaiaDB (storage layer)
- [maia-schemata Package](../03_maia-schemata/README.md) - Schema validation
- [maia-tools Package](../08_maia-tools/README.md) - Tool definitions

---

## Source Files

**Package:** `libs/maia-engines/`

**Key Files:**
- `src/engines/data.engine.js` - DataEngine (maia.do)
- `src/engines/` - All engine implementations
- `src/operations/` - Operation handlers
- `src/modules/` - Module definitions

**Dependencies:**
- `@MaiaOS/db` - MaiaDB (storage)
- `@MaiaOS/tools` - Tool definitions
- `@MaiaOS/schemata` - Schema validation
