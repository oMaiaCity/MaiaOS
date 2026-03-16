# Operations Reference

## Operation Parameters Reference

| Operation | Key Parameters |
|-----------|----------------|
| `read` | `factory`, `key`, `keys`, `filter` |
| `create` | `factory`, `data` |
| `update` | `id`, `data` |
| `delete` | `id` |
| `append` | `coId`, `items` (or `item`) |
| `push` | `coId`, `items` (or `item`) |
| `factory` | `coId` or `fromCoValue` |
| `resolve` | `humanReadableKey` or `fromCoValue` |
| `seed` | `configs`, `schemas`, `data` |

**Note:** For `append` and `push`, use `coId` (not `id`). For `factory`, use `coId` or `fromCoValue` (no `humanReadableKey`).

## References

- **DataEngine:** `libs/maia-engines/src/engines/data.engine.js`
- **Storage:** MaiaDB (`libs/maia-db/`) – CoJSON CRDT
- **Example Vibe:** `libs/maia-vibes/src/todos/`

## Future Enhancements

Potential future operations:
- `batch` - Execute multiple operations atomically
- `transaction` - Multi-operation transactions
- `migrate` - Schema migration operations
- `export` - Export data to JSON
- `import` - Import JSON into database
