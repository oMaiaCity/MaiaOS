# maia-operations: Merged into maia-engines

The `@MaiaOS/operations` package **no longer exists**. The operations layer has been merged into `@MaiaOS/runtime`.

## Current Architecture

- **DataEngine** (`libs/maia-runtime/src/engines/data.engine.js`) – Executes **maia.do({ op, factory, key, filter, ... })**
- **Operations** – read, create, update, delete, spark operations, colist operations, binary upload, etc.
- **MaiaDB** (`libs/maia-db/`) – Storage layer; DataEngine calls MaiaDB

## Key Changes from Old maia-operations

| Old | New |
|-----|-----|
| DBAdapter + CoJSONBackend | MaiaDB (single class) |
| DBEngine | DataEngine |
| maia.db() | **maia.do()** |
| @MaiaOS/operations | Merged into @MaiaOS/runtime |

## See Also

- [maia-engines](../04_maia-engines/README.md) – DataEngine, engines, operations
- [maia-engines API Reference](../04_maia-engines/api-reference.md) – DataEngine operations
- [maia-db](../05_maia-db/README.md) – MaiaDB storage layer
