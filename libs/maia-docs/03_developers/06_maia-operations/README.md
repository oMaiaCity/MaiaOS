# maia-operations (merged into maia-engines)

The operations layer has been **merged into maia-engines**. There is no separate `@MaiaOS/operations` package.

## Current Architecture

- **DataEngine** (`libs/maia-engines/src/engines/data.engine.js`) – Executes **maia.do({ op, schema, key, filter, ... })**
- **Operations** (`libs/maia-engines/src/operations/`) – read, create, update, delete, spark operations, etc.
- **MaiaDB** (`libs/maia-db/`) – Storage layer; DataEngine calls MaiaDB

## Key Changes

| Old | New |
|-----|-----|
| DBAdapter + CoJSONBackend | MaiaDB (single class) |
| DBEngine | DataEngine |
| maia.db() | **maia.do()** |
| @MaiaOS/operations | Merged into @MaiaOS/engines |

## See Also

- [maia-engines](../04_maia-engines/README.md) – DataEngine, engines, operations
- [maia-db](../05_maia-db/README.md) – MaiaDB storage layer
