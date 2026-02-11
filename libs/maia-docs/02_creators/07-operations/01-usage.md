
**Returns:**
- Created spark object with:
  - `id` - Spark CoMap co-id
  - `name` - Spark name
  - `guardian` - Guardian group co-id (resolved via `spark.os.capabilities.guardian`)

**What happens:**
1. Creates a new guardian group (child of @maia spark's guardian)
2. Creates full scaffold: capabilities, os, vibes, spark with `{name, os, vibes}` (no `group`; guardian is in `os.capabilities.guardian`)
3. Registers spark in `account.sparks` CoMap
4. Automatically indexes spark in `account.os.{sparkSchemaCoId}` colist

### `readSpark` - Read Spark(s)

Read a single spark or all sparks. Returns a reactive store that automatically updates when sparks change.

```javascript
// Read all sparks
const sparksStore = await maia.db({
  op: "readSpark"
});

// Store has current value immediately
console.log('My sparks:', sparksStore.value);

// Subscribe to updates
const unsubscribe = sparksStore.subscribe((sparks) => {
  console.log('Sparks updated:', sparks);
});

// Read single spark
const sparkStore = await maia.db({
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
const updated = await maia.db({
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
const deleted = await maia.db({
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

## Tool Invocation Pattern

**CRITICAL:** Tools are invoked BY state machines, never directly from views or other engines.

**Pattern:**
1. View sends event to state machine
2. State machine invokes tool (in entry actions or transition actions)
3. Tool executes operation and returns result
4. State machine receives SUCCESS event with tool result in payload
5. State machine updates context via `updateContext` action using `$$result`

**Why this matters:**
- **Single source of truth:** All operations flow through state machines
- **Predictable:** Easy to trace where operations come from
- **Error handling:** State machines handle SUCCESS/ERROR events
- **Context updates:** State machines update context via `updateContext` infrastructure action
- **Tool results accessible:** Tool results available via `$$result` in SUCCESS handlers

**Never:**
- ❌ Invoke tools directly from views
- ❌ Invoke tools from other engines
- ❌ Update context directly in tools (tools should return results, not manipulate context)
- ❌ Tools calling `updateContextCoValue()` directly

**Always:**
- ✅ Invoke tools from state machine actions
- ✅ Handle SUCCESS/ERROR events in state machines
- ✅ Update context via state machine actions using `updateContext` infrastructure action
- ✅ Tools return results - state machines handle context updates

## Usage in State Machines

Use the `@db` tool in your state machine definitions:

```json
{
  "states": {
    "creating": {
      "entry": {
        "tool": "@db",
        "payload": {
          "op": "create",
          "schema": "@schema/todos",
          "data": {
            "text": "$newTodoText",
            "done": false
          }
        }
      },
      "on": {
        "SUCCESS": {
          "target": "idle",
          "actions": [
            {
              "tool": "@core/publishMessage",
              "payload": {
                "type": "TODO_CREATED",
                "payload": {
                  "id": "$$result.id",      // ← Access tool result
                  "text": "$$result.text"  // ← Tool result available in SUCCESS handler
                }
              }
            }
          ]
        },
        "ERROR": "error"
      }
    },
    "toggling": {
      "entry": {
        "tool": "@db",
        "payload": {
          "op": "update",
          "id": "$$id",
          "data": {
            "done": { "$not": "$existing.done" }
          }
        }
      },
      "on": {
        "SUCCESS": "idle"
      }
    }
  }
}
```

**Accessing Tool Results:**
- Tool results are included in SUCCESS event payload as `result`
- Access via `$$result.propertyName` in SUCCESS handlers
- Example: `$$result.id`, `$$result.text`, `$$result.draggedItemId`

## Architecture

```
@db tool (in state machine)
  ↓
maia.db({op: ...})
  ↓
DBEngine.execute()
  ↓
Operation Handler (query/create/update/delete/toggle/seed)
  ↓
Backend (IndexedDB, CoJSON, etc.)
  ↓
Database
```

**Key Components:**

1. **DBEngine** (`libs/maia-script/src/o/engines/maiadb/db.engine.js`)
   - Routes operations to handlers
   - Supports swappable backends

2. **Operation Handlers** (`libs/maia-operations/src/operations/`)
   - `read.js` - Read operation handler (always returns reactive store)
   - `create.js` - Create operation handler
   - `update.js` - Update operation handler (supports MaiaScript expressions)
   - `delete.js` - Delete operation handler
   - `seed.js` - Seed operation handler
   - `schema.js` - Schema loading operation handler
   - `resolve.js` - Co-id resolution operation handler
   - `append.js` - CoList/CoStream append operation handler
   - `process-inbox.js` - Inbox processing operation handler

3. **Backend** (`libs/maia-script/src/engines/db-engine/backend/`)
   - `indexeddb/` - IndexedDB backend (current)
   - Future: CoJSON CRDT backend

## Best Practices

### 1. Tools Are Invoked by State Machines

**✅ DO:** Invoke tools from state machine actions

```json
{
  "idle": {
    "on": {
      "CREATE_TODO": {
        "target": "creating",
        "actions": [
          {
            "tool": "@db",
            "payload": {
              "op": "create",
              "schema": "@schema/todos",
              "data": {...}
            }
          }
        ]
      }
    }
  }
}
```

**❌ DON'T:** Invoke tools directly from views or other engines

```javascript
// ❌ Don't do this - tools should be invoked by state machines
actor.actorEngine.toolEngine.execute('@db', actor, payload);
```

### 2. Define Query Objects in Context (Not State Machines)

**✅ DO:** Define query objects directly in your context file (`.context.maia`)

```json
{
  "$schema": "@schema/context",
  "$id": "@context/todo",
  "todos": {
    "schema": "@schema/todos",
    "filter": null
  },
  "todosTodo": {
    "schema": "@schema/todos",
    "filter": { "done": false }
  }
}
```

**❌ DON'T:** Define queries in state machines or call read operations in tools

```json
{
  "entry": {
    "tool": "@db",
    "payload": {
      "op": "read",
      "schema": "co_zTodos123"
      // Don't do this - define query objects in context instead!
    }
  }
}
```

**Why:** Query objects in context automatically create reactive query stores that are subscribed to by ViewEngine. State machines should only handle mutations (create, update, delete), not queries.

**See [Context - Reactive Data](./04-context.md#1-reactive-data-query-objects-) for complete documentation on query objects.**

### 3. Always Use Operations for Mutations

**✅ DO:** Use `@db` tool for all data changes (invoked by state machines)

