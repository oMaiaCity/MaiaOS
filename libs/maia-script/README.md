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

```typescript
import { safeEvaluate, isMaiaScriptExpression } from '@maia/script'
import type { MaiaScriptExpression } from '@maia/script'

const expr: MaiaScriptExpression = {
  "$if": {
    "test": { "$eq": [{ "$": "item.status" }, "done"] },
    "then": "bg-green-100",
    "else": "bg-gray-100"
  }
}

const result = safeEvaluate(expr, {
  item: { status: "done" }
})
// result: "bg-green-100"
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
├── evaluator.ts      # MaiaScriptEngine (expression evaluator)
├── validator.ts      # Security validator
├── helpers.ts        # Utility functions
├── types.ts          # TypeScript definitions
├── index.ts          # Public API
└── modules/          # Pluggable modules (Phase 4+)
    ├── registry.ts   # Module registry
    ├── types.ts      # Module types
    ├── builtin.module.ts     # Core operations
    ├── dragdrop.module.ts    # Drag-drop capabilities
    └── security.module.ts    # Security validation
```

## API Reference

See `/services/docs/vibes/TERMINOLOGY.md` for complete documentation.

## License

MIT
