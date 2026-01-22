# @maia/script

MaiaScript is MaiaOS's secure JSON-based expression language for runtime logic.

## Features

- ✅ Pure JSON syntax (no code execution)
- ✅ Sandboxed evaluation (secure from untrusted input)
- ✅ Whitelisted operations only
- ✅ Pluggable module system

## Installation

```bash
# In workspace package
"dependencies": {
  "@maia/script": "workspace:*"
}
```

## Usage

```javascript
import { MaiaOS } from '@MaiaOS/script'

// Boot MaiaOS
const os = await MaiaOS.boot({
  registry: {
    // Your configs here
  }
})

// MaiaScript expressions are evaluated automatically by engines
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
├── o/
│   ├── kernel.js              # MaiaOS kernel (main entry point)
│   ├── engines/
│   │   ├── MaiaScriptEvaluator.js  # Expression evaluator
│   │   ├── actor-engine/      # Actor orchestration
│   │   ├── view-engine/       # UI rendering
│   │   ├── state-engine/      # State machine interpreter
│   │   ├── tool-engine/       # Tool execution
│   │   └── db-engine/         # Database operations
│   └── tools/                 # Built-in tools
└── index.js                    # Public API exports
```

## API Reference

See `/services/docs/vibes/TERMINOLOGY.md` for complete documentation.

## License

MIT
