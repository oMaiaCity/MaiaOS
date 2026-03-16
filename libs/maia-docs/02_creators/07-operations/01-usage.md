# Operations Usage

## Spark Operations (continued)

### `createSpark` - Returns

**Returns:**
- Created spark object with:
  - `id` - Spark CoMap co-id
  - `name` - Spark name
  - `guardian` - Guardian group co-id (resolved via `spark.os.groups.guardian`)

**What happens:**
1. Creates a new guardian group (child of °Maia spark's guardian)
2. Creates full scaffold: groups, os, vibes, spark with `{name, os, vibes}` (no `group`; guardian is in `os.groups.guardian`)
3. Registers spark in `account.sparks` CoMap
4. Automatically indexes spark in `account.os.{sparkSchemaCoId}` colist

### `readSpark` - Read Spark(s)

Read a single spark or all sparks. Returns a reactive store that automatically updates when sparks change.

```javascript
// Read all sparks
const sparksStore = await maia.do({
  op: "readSpark"
});

// Store has current value immediately
console.log('My sparks:', sparksStore.value);

// Subscribe to updates
const unsubscribe = sparksStore.subscribe((sparks) => {
  console.log('Sparks updated:', sparks);
});

// Read single spark
const sparkStore = await maia.do({
  op: "readSpark",
  id: "co_zSpark123"
});
```

**Parameters:**
- `id` (optional) - Specific spark co-id for single spark read
- `schema` (optional) - Schema co-id (defaults to spark schema)

**Returns:**
- `ReactiveStore` - Reactive store with spark(s) data
  - Single spark: `{id, name, group}`
  - Collection: Array of spark objects

**Note:** Reads from indexed colist (`account.os.{sparkSchemaCoId}`) for efficient querying.

### `updateSpark` - Update Spark

Update a spark's name or group reference.

```javascript
const updated = await maia.do({
  op: "updateSpark",
  id: "co_zSpark123",
  data: {
    name: "Updated Project Name"
  }
});
```

**Parameters:**
- `id` (required) - Spark co-id
- `data` (required) - Update data (name, group)

**Returns:**
- Updated spark object

### `deleteSpark` - Delete Spark

Delete a spark and remove it from `account.sparks` registry.

```javascript
const deleted = await maia.do({
  op: "deleteSpark",
  id: "co_zSpark123"
});

console.log("Deleted:", deleted.success); // true
```

**Parameters:**
- `id` (required) - Spark co-id

**Returns:**
- `{success: true, id}` - Deletion result

**What happens:**
1. Deletes Spark CoMap
2. Removes spark from `account.sparks` CoMap
3. Automatically removes spark from indexed colist

## Operation Invocation Pattern

**CRITICAL:** Data operations are invoked BY process handlers via the `op` action, never directly from views.

**Pattern:**
1. View sends event to actor inbox
2. Process handler runs `op` action (create, update, delete)
3. DataEngine executes operation
4. On success: handler runs `tell` SUCCESS to `$$source`
5. On failure: ProcessEngine delivers ERROR to `$$source`
6. Handler can update context via `ctx` action

**Why this matters:**
- **Single source of truth:** All operations flow through process handlers
- **Predictable:** Easy to trace where operations come from
- **Error handling:** ProcessEngine delivers ERROR automatically on op failure
- **Context updates:** Process handlers update context via `ctx` action

**Never:**
- ❌ Invoke maia.do() directly from views
- ❌ Update context directly from views

**Always:**
- ✅ Use `op` in process handlers for create/update/delete
- ✅ Use `tell` to send SUCCESS/ERROR to `$$source`
- ✅ Use `ctx` for context updates in process handlers

## Usage in Process Handlers

Use the `op` action in your process handler definitions:

```json
{
  "handlers": {
    "CREATE_TODO": [
      {
        "op": {
          "create": {
            "factory": "°Maia/factory/data/todos",
            "data": {
              "text": "$newTodoText",
              "done": false
            }
          }
        }
      },
      {
        "ctx": { "newTodoText": "" }
      },
      {
        "tell": {
          "target": "$$source",
          "type": "SUCCESS",
          "payload": {}
        }
      }
    ],
    "TOGGLE_TODO": [
      {
        "op": {
          "update": {
            "id": "$$id",
            "data": {
              "done": { "$not": "$$done" }
            }
          }
        }
      },
      {
        "tell": {
          "target": "$$source",
          "type": "SUCCESS",
          "payload": {}
        }
      }
    ]
  }
}
```

**Accessing Op Results:**
- Op results are stored in `process.lastToolResult` for subsequent actions in the same handler
- Pass to `tell` payload via `$$result` (e.g. `"id": "$$result.id"`)

## Architecture

```
op action (in process handler)
  ↓
ProcessEngine._executeOp()
  ↓
DataEngine.execute()
  ↓
Operation Handler (read/create/update/delete/...)
  ↓
MaiaDB / CoJSON
  ↓
Storage
```

**Key Components:**

1. **DataEngine** (`libs/maia-engines/src/engines/data.engine.js`)
   - Routes operations to handlers
   - Supports swappable backends

2. **Operation Handlers** (`libs/maia-engines/src/engines/data.engine.js`)
   - `read.js` - Read operation handler (always returns reactive store)
   - `create.js` - Create operation handler
   - `update.js` - Update operation handler (supports MaiaScript expressions)
   - `delete.js` - Delete operation handler
   - `seed.js` - Seed operation handler
   - `schema.js` - Schema loading operation handler
   - `resolve.js` - Co-id resolution operation handler
   - `append.js` - CoList/CoStream append operation handler
   - `process-inbox.js` - Inbox processing operation handler

3. **Storage** – MaiaDB (`libs/maia-db/`) uses MaiaPeer for CoJSON
   - `indexeddb/` - IndexedDB backend (current)
   - Future: CoJSON CRDT backend

## Best Practices

### 1. Use op in Process Handlers

**✅ DO:** Use `op` in process handlers for create/update/delete

```json
{
  "CREATE_TODO": [
    {
      "op": {
        "create": {
          "factory": "°Maia/factory/data/todos",
          "data": {...}
        }
      }
    },
    {
      "tell": {
        "target": "$$source",
        "type": "SUCCESS",
        "payload": {}
      }
    }
  ]
}
```

**❌ DON'T:** Invoke maia.do() directly from views

### 2. Define Query Objects in Context (Not Process Handlers)

**✅ DO:** Define query objects directly in your context file (`.context.maia`)

```json
{
  "$factory": "@factory/context",
  "$id": "@context/todo",
  "todos": {
    "factory": "@factory/todos",
    "filter": null
  },
  "todosTodo": {
    "factory": "@factory/todos",
    "filter": { "done": false }
  }
}
```

**❌ DON'T:** Call read operations in process handlers — use query objects in context instead

**Why:** Query objects in context automatically create reactive query stores. Process handlers should only handle mutations (create, update, delete), not queries.

**See [Context](./04-context/) for complete documentation on query objects.**

### 3. Always Use op for Mutations

**✅ DO:** Use `op` for all data changes in process handlers

