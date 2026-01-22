# @MaiaOS/script

MaiaScript provides reusable execution components (engines, modules, utils) for MaiaOS.

**Note:** The MaiaOS kernel (`MaiaOS.boot()`) is now exported from `@MaiaOS/kernel`. This package exports engines, modules, and utilities for reuse.

## Features

- ✅ Pure JSON syntax (no code execution)
- ✅ Sandboxed evaluation (secure from untrusted input)
- ✅ Whitelisted operations only
- ✅ Pluggable module system
- ✅ Reusable engines (ActorEngine, ViewEngine, StyleEngine, StateEngine, ToolEngine, etc.)

## Installation

```bash
# In workspace package
"dependencies": {
  "@MaiaOS/script": "workspace:*",
  "@MaiaOS/kernel": "workspace:*"  # For MaiaOS.boot()
}
```

## Usage

### Using the Kernel

```javascript
import { MaiaOS } from '@MaiaOS/kernel'

// Boot MaiaOS
const os = await MaiaOS.boot({
  registry: {
    // Your configs here
  }
})
```

### Using Engines Directly

```javascript
import { ActorEngine, ViewEngine, StateEngine } from '@MaiaOS/script'

// Use engines independently for advanced use cases
const actorEngine = new ActorEngine(...)
```

### MaiaScript Expressions

MaiaScript expressions are evaluated automatically by engines:
// Example expression in JSON config:
const expr = {
  "$if": {
    "condition": { "$eq": ["$item.status", "done"] },
    "then": "bg-green-100",
    "else": "bg-gray-100"
  }
}
```

## Core Operations

### Data Access
- `$` - Resolve data path

### Comparison
- `$eq`, `$neq`, `$gt`, `$gte`, `$lt`, `$lte`

### Logical
- `$and`, `$or`, `$not`

### Control Flow
- `$if`, `$switch`

### String
- `$concat`, `$trim`, `$toLowerCase`, `$toUpperCase`

### Date
- `$formatDate`

### Array
- `$length`, `$includes`, `$map`, `$filter`

### Math
- `$add`, `$subtract`, `$multiply`, `$divide`

## Architecture

```
src/
├── engines/
│   ├── MaiaScriptEvaluator.js  # Expression evaluator
│   ├── actor-engine/          # Actor orchestration
│   ├── view-engine/           # UI rendering
│   ├── state-engine/          # State machine interpreter
│   ├── tool-engine/           # Tool execution
│   ├── db-engine/             # Database operations
│   └── subscription-engine/   # Reactive subscriptions
├── modules/                   # Module definitions (db, core, dragdrop, interface)
├── utils/                     # Shared utilities (module-registration, etc.)
└── index.js                   # Public API exports (engines only)
```

**Notes:**
- Kernel (`MaiaOS.boot()`) has been moved to `@MaiaOS/kernel`
- Tools have been extracted to `@MaiaOS/tools` package
- Engines, modules, and utils remain here for reuse

## API Reference

See `/services/docs/vibes/TERMINOLOGY.md` for complete documentation.

## License

MIT
