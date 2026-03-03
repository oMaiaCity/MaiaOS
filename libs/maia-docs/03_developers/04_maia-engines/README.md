# maia-engines: Execution Engines and Modules

## Overview

The `@MaiaOS/engines` package provides the execution components that power MaiaOS. Merged from maia-script + maia-operations. Think of it as the factory floor where all the work happens - engines process your definitions, modules provide tools, and **DataEngine** executes **maia.do({ op, schema, key, ... })**.

**What it is:**
- ✅ **DataEngine** – Public data API: **maia.do({ op, schema, key, filter, ... })**
- ✅ **Execution engines** – ActorEngine, ViewEngine, ProcessEngine, StyleEngine, InboxEngine
- ✅ **Module system** – Plugin architecture (tools in core, ai, db modules; ProcessEngine executes them)
- ✅ **MaiaScript evaluator** – Evaluates JSON-based expressions safely
- ✅ **Runtime** – Browser runtime for actor lifecycle and inbox watching

**What it isn't:**
- ❌ **Not the loader** – Boot process is in `@MaiaOS/loader`
- ❌ **Not tool definitions** – Tools are in `@MaiaOS/tools`
- ❌ **Not schemas** – Schema validation is in `@MaiaOS/schemata`

---

## The Simple Version

Think of `maia-engines` like a factory with specialized workers:

- **DataEngine** = The librarian – **maia.do()** executes all data operations (read, create, update, delete, sparks, etc.)
- **ActorEngine** = The manager (orchestrates everything)
- **ViewEngine** = The painter (renders UI)
- **StyleEngine** = The stylist (compiles CSS)
- **ProcessEngine** = The switchboard operator (routes events to handlers; GenServer-style, no state machines)
- **InboxEngine** = The mailroom (validates messages, resolves inboxes, delivers to CoStreams)

**Subscriptions** – Backend $stores architecture (CoCache, unified store); no separate SubscriptionEngine.

**Tools** – Live in modules (core, ai, db); ProcessEngine executes them via `op` actions.

**All engines use maia.do for data** – no direct MaiaDB access.

---

## Architecture

### Package Structure

```
libs/maia-engines/src/
├── engines/                  # Core execution engines (flat structure)
│   ├── data.engine.js        # DataEngine – maia.do({ op, schema, key, ... }) self-wires ops
│   ├── actor.engine.js
│   ├── process.engine.js     # GenServer-style event handlers
│   ├── view.engine.js
│   ├── style.engine.js
│   └── inbox.engine.js
├── runtimes/
│   └── browser.js            # Runtime – actor lifecycle, inbox watching
├── modules/                  # db, core, ai
└── utils/                    # Evaluator, config-loader, store-reader
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
- [maia-actors Package](../08_maia-actors/README.md) - Actor definitions

---

## Source Files

**Package:** `libs/maia-engines/`

**Key Files:**
- `src/engines/data.engine.js` - DataEngine (maia.do) + built-in operations
- `src/engines/` - All engine implementations
- `src/runtimes/browser.js` - Runtime (actor lifecycle, inbox watchers)
- `src/modules/` - Module definitions

**Dependencies:**
- `@MaiaOS/db` - MaiaDB (storage)
- `@MaiaOS/tools` - Tool definitions
- `@MaiaOS/schemata` - Schema validation
