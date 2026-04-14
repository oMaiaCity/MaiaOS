# maia-operations Reference: See maia-engines

The operations layer has been **merged into maia-engines**. There is no separate `@MaiaOS/operations` package.

## DataEngine API

All database operations are executed via **maia.do()** (which delegates to DataEngine):

```javascript
// Read
const result = await os.do({ op: 'read', factory: '°Maia/factory/todos', filter: { completed: false } });

// Create
const created = await os.do({ op: 'create', factory: '°Maia/factory/todos', data: { text: 'Buy milk', completed: false } });

// Update
const updated = await os.do({ op: 'update', factory: '°Maia/factory/todos', key: 'co_zTodo456', data: { completed: true } });

// Delete
await os.do({ op: 'delete', factory: '°Maia/factory/todos', key: 'co_zTodo456' });
```

**Note:** Use `factory` (not `schema`) for the factory/schema co-id or registry key.

## Full API Reference

See the [maia-engines API Reference](../04_maia-engines/api-reference.md) for complete DataEngine operations including:

- read, create, update, delete
- readFactory, factory
- colistSet, colistPush, colistUnshift, colistPop, colistShift, colistSplice, colistRemove, colistRetain, colistApplyDiff
- uploadBinary, loadBinaryAsBlob, uploadToCoBinary
- Spark operations

## Source

- `libs/maia-runtime/src/engines/data.engine.js`
