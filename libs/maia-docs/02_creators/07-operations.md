# Database Operations API

MaiaOS uses a **flexible, composable database operations API** through a single unified entry point: `maia.db({op: ...})`.

## Core Concept

All database operations flow through one simple API:

```javascript
await maia.db({ op: "operationName", ...params })
```

Where:
- `maia` = MaiaOS instance (from `MaiaOS.boot()`)
- `db()` = Unified database operation router
- `{ op, ...params }` = Operation configuration (pure JSON)

**Why this design?**
- ✅ **Simple** - One API for everything
- ✅ **Composable** - Easy to extend with new operations
- ✅ **JSON-native** - Perfect for declarative configs
- ✅ **Type-safe** - Runtime validation against schemas
- ✅ **Flexible** - Swappable backends (IndexedDB, CoJSON, etc.)

## Available Operations

### `read` - Load Data (Always Reactive)

Load data, configs, or schemas from the database. **Always returns a reactive store** that you can subscribe to.

**Load a specific config:**
```javascript
const store = await maia.db({
  op: "read",
  schema: "co_zActor123",  // Schema co-id (co_z...)
  key: "co_zAgent456"      // Config co-id (co_z...)
});

// Store has current value immediately
console.log('Current config:', store.value);

// Subscribe to updates
const unsubscribe = store.subscribe((data) => {
  console.log('Config updated:', data);
});
```

**Read a collection:**
```javascript
const store = await maia.db({
  op: "read",
  schema: "co_zTodos123"  // Schema co-id (co_z...)
});

// Store has current value immediately
console.log('Current todos:', store.value);

// Subscribe to updates
const unsubscribe = store.subscribe((todos) => {
  console.log('Todos updated:', todos);
});
```

**Read with filter:**
```javascript
const store = await maia.db({
  op: "read",
  schema: "co_zTodos123",  // Schema co-id (co_z...)
  filter: { done: false }
});

// Store has filtered results immediately
console.log('Incomplete todos:', store.value);

// Subscribe to updates (filter is automatically applied)
const unsubscribe = store.subscribe((todos) => {
  console.log('Incomplete todos updated:', todos);
});
```

**Important Notes:** 
- **All schemas must be co-ids** (`co_z...`) at runtime - human-readable IDs (`@schema/...`) are transformed to co-ids during seeding
- **Always returns a reactive store** - use `store.value` for current value and `store.subscribe()` for updates
- **No callbacks** - the store pattern replaces callback-based subscriptions

**Parameters:**
- `schema` (required) - Schema co-id (`co_z...`) - MUST be a co-id, not `@schema/...`
- `key` (optional) - Specific key (co-id) for single item lookups
- `filter` (optional) - Filter criteria object (e.g., `{done: false}`)

**Returns:**
- `ReactiveStore` - Always returns a reactive store with:
  - `store.value` - Current data value (available immediately)
  - `store.subscribe(callback)` - Subscribe to updates, returns unsubscribe function

### `create` - Create New Records

Create a new record with schema validation.

```javascript
const newTodo = await maia.db({
  op: "create",
  schema: "co_z...",  // Co-id (transformed from @schema/todos during seeding)
  data: {
    text: "Buy groceries",
    done: false
  }
});

console.log("Created:", newTodo.id); // Auto-generated ID (co-id)
```

**Parameters:**
- `schema` (required) - Co-id (`co_z...`) for data collections. Schema references (`@schema/todos`) are transformed to co-ids during seeding
- `data` (required) - Data object to create

**Returns:**
- Created record with auto-generated `id` and all fields

**Validation:**
- Automatically validates against the schema definition
- Throws error if validation fails

### `update` - Update Existing Records

Update an existing record with partial validation. Supports MaiaScript expressions in data.

```javascript
const updated = await maia.db({
  op: "update",
  id: "co_z...",  // Co-id of record to update
  data: {
    text: "Buy groceries and cook dinner",
    done: { "$not": "$existing.done" }  // Toggle using expression
  }
});
```

**Parameters:**
- `id` (required) - Co-id of record to update
- `data` (required) - Partial data object (only fields to update)
- `schema` (optional) - **Not required** - Schema is extracted from CoValue headerMeta automatically

**Returns:**
- Updated record

**Validation:**
- Validates only the fields you're updating (partial validation)
- Doesn't require all schema fields
- Supports MaiaScript expressions (e.g., `{"$not": "$existing.done"}` for toggling)
- Throws error if validation fails

**Toggle Example:**
Toggle is not a separate operation. Use `update` with an expression:

```javascript
const updated = await maia.db({
  op: "update",
  id: "co_z...",
  data: {
    done: { "$not": "$existing.done" }  // Toggles boolean field
  }
});
```

### `delete` - Delete Records

Delete a record from the database.

```javascript
const deleted = await maia.db({
  op: "delete",
  id: "co_z..."  // Co-id of record to delete
});

console.log("Deleted:", deleted); // true
```

**Parameters:**
- `id` (required) - Co-id of record to delete
- `schema` (optional) - **Not required** - Schema is extracted from CoValue headerMeta automatically

**Returns:**
- `true` if deleted successfully

### `seed` - Seed Database (Dev Only)

Reseed the database with initial data. **Idempotent** - can be called multiple times safely.

**Behavior:**
- **First seed**: Creates all schemata, configs, and data from scratch
- **Reseed**: Preserves schemata (updates if definitions changed), deletes and recreates all configs and data
- **Idempotent**: Safe to call multiple times - schemata co-ids remain stable across reseeds

```javascript
await maia.db({
  op: "seed",
  configs: {
    "vibe/vibe": { /* vibe config */ },
    "vibe/vibe.actor": { /* actor config */ }
  },
  schemas: {
    "@schema/todos": { /* schema definition */ }
  },
  data: {
    "@schema/todos": [
      { text: "First todo", done: false },
      { text: "Second todo", done: true }
    ]
  }
});
```

**Parameters:**
- `configs` (optional) - Config objects keyed by path
- `schemas` (optional) - Schema definitions keyed by schema ID
- `data` (optional) - Data arrays keyed by schema ID

**Returns:**
- `true` when seeding completes

**Idempotent Seeding:**
- **Schemata**: Checked against `account.os.schematas` registry - if exists, updated in-place (preserves co-id); if not, created new
- **Configs & Data**: Always deleted and recreated (ensures clean state)
- **Schema Index Colists**: Automatically managed - deleted co-values are removed from indexes, new co-values are added to indexes

**Note:** Use only in development! Reseeding preserves schemata but recreates all configs and data.

### `schema` - Load Schema Definitions

Load schema definitions by co-id, schema name, or from CoValue headerMeta.

```javascript
const schemaStore = await maia.db({
  op: "schema",
  coId: "co_zActor123"  // Co-id of schema or CoValue
});

// Or resolve from human-readable ID (during seeding only)
const schemaStore = await maia.db({
  op: "schema",
  humanReadableKey: "@schema/actor"
});
```

**Parameters:**
- `coId` (optional) - Co-id of schema or CoValue
- `humanReadableKey` (optional) - Human-readable schema ID (only during seeding)

**Returns:**
- `ReactiveStore` containing schema definition

### `resolve` - Resolve Human-Readable Keys to Co-IDs

Resolve human-readable keys (like `@schema/todos`) to co-ids. **Only for use during seeding.**

```javascript
const coId = await maia.db({
  op: "resolve",
  humanReadableKey: "@schema/todos"
});

console.log("Resolved:", coId); // "co_zTodos123..."
```

**Parameters:**
- `humanReadableKey` (required) - Human-readable key to resolve

**Returns:**
- Co-id string (`co_z...`)

**Note:** At runtime, all IDs should already be co-ids. This operation is primarily for seeding/transformation.

### `append` - Append to CoList

Append items to a CoList (ordered array).

```javascript
const result = await maia.db({
  op: "append",
  id: "co_zList123",  // Co-id of CoList
  items: ["item1", "item2"]
});
```

**Parameters:**
- `id` (required) - Co-id of CoList
- `items` (required) - Array of items to append

**Returns:**
- Updated CoList

### `push` - Append to CoStream

Append items to a CoStream (append-only stream). This is an alias for `append` with `cotype: "costream"`.

```javascript
const result = await maia.db({
  op: "push",
  id: "co_zStream123",  // Co-id of CoStream
  items: ["message1", "message2"]
});
```

**Parameters:**
- `id` (required) - Co-id of CoStream
- `items` (required) - Array of items to append

**Returns:**
- Updated CoStream

### `processInbox` - Process Actor Inbox

Process messages in an actor's inbox with session-based watermarks.

```javascript
const processed = await maia.db({
  op: "processInbox",
  actorId: "co_zActor123",
  sessionId: "session-abc"
});
```

**Parameters:**
- `actorId` (required) - Co-id of actor
- `sessionId` (required) - Session identifier for watermark tracking

**Returns:**
- Number of messages processed

**Note:** This is typically handled automatically by ActorEngine. Manual use is rare.

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

### 2. Use mapData Action for Reactive Queries

**✅ DO:** Use `mapData` action in state machines to create reactive query stores

```json
{
  "idle": {
    "entry": {
      "mapData": {
        "todos": {
          "op": "read",
          "schema": "co_zTodos123",
          "filter": null
        },
        "todosTodo": {
          "op": "read",
          "schema": "co_zTodos123",
          "filter": { "done": false }
        }
      }
    }
  }
}
```

**❌ DON'T:** Manually call read operations in tools

```json
{
  "entry": {
    "tool": "@db",
    "payload": {
      "op": "read",
      "schema": "co_zTodos123"
      // Don't do this - use mapData action instead!
    }
  }
}
```

**Why:** `mapData` creates reactive query stores that are automatically subscribed to by ViewEngine. Tools should be used for mutations, not queries.

### 3. Always Use Operations for Mutations

**✅ DO:** Use `@db` tool for all data changes (invoked by state machines)

```json
{
  "tool": "@db",
  "payload": {
    "op": "create",
    "schema": "@schema/todos",
    "data": {...}
  }
}
```

**❌ DON'T:** Modify reactive query data directly

```json
{
  "updateContext": {
    "todos": [...] // Don't mutate reactive data directly!
  }
```

### 4. Handle Errors in State Machines

**✅ DO:** Handle SUCCESS/ERROR events and update context via state machine

```json
{
  "creating": {
    "entry": {
      "tool": "@db",
      "payload": {...}
    },
    "on": {
      "SUCCESS": "idle",
      "ERROR": {
        "target": "error",
        "actions": [
          {
            "updateContext": { "error": "$$error" }
          }
        ]
      }
    }
  },
  "error": {
    "on": {
      "RETRY": "creating",
      "DISMISS": "idle"
    }
  }
}
```

**❌ DON'T:** Set error context directly in tools

```javascript
// ❌ Don't do this - errors should be handled by state machines
actor.context.error = error.message;
```

### 5. Toggle Boolean Fields with Update Expression

**✅ DO:** Use `update` operation with expression to toggle boolean fields

```json
{
  "tool": "@db",
  "payload": {
    "op": "update",
    "id": "$$id",
    "data": {
      "done": { "$not": "$existing.done" }
    }
  }
}
```

**❌ DON'T:** Use non-existent toggle operation

```json
{
  "tool": "@db",
  "payload": {
    "op": "toggle",  // ❌ Toggle is not a separate operation
    "id": "$$id",
    "field": "done"
  }
}
```

## Examples

### Complete Todo List Example

**Context:**
```json
{
  "newTodoText": ""
}
```

**State Machine:**
```json
{
  "initial": "idle",
  "states": {
    "idle": {
      "entry": {
        "mapData": {
          "todos": {
            "op": "read",
            "schema": "co_zTodos123",
            "filter": null
          }
        }
      },
      "on": {
        "CREATE_TODO": {
          "target": "creating",
          "guard": {"$ne": ["$newTodoText", ""]}
        },
        "TOGGLE_TODO": {
          "target": "toggling"
        },
        "DELETE_TODO": {
          "target": "deleting"
        }
      }
    },
    "creating": {
      "entry": [
        {
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
        {
          "updateContext": {"newTodoText": ""}
        }
      ],
      "on": {
        "SUCCESS": "idle",
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
        "SUCCESS": "idle",
        "ERROR": "error"
      }
    },
    "deleting": {
      "entry": {
        "tool": "@db",
        "payload": {
          "op": "delete",
          "schema": "@schema/todos",
          "id": "$$id"
        }
      },
      "on": {
        "SUCCESS": "idle",
        "ERROR": "error"
      }
    },
    "error": {
      "on": {
        "RETRY": "idle",
        "DISMISS": "idle"
      }
    }
  }
}
```

## Operation Schema

The `@db` tool validates operations against this schema:

```json
{
  "op": {
    "type": "string",
    "enum": ["read", "create", "update", "delete", "seed", "schema", "resolve", "append", "push", "processInbox"]
  },
  "schema": {
    "type": "string",
    "description": "Schema co-id (co_z...) - Required for create, optional for update/delete (extracted from CoValue)"
  },
  "key": {
    "type": "string",
    "description": "Optional: Specific key (co-id) for read queries"
  },
  "keys": {
    "type": "array",
    "description": "Optional: Array of co-ids for batch reads"
  },
  "filter": {
    "type": "object",
    "description": "Optional: Filter criteria for read queries"
  },
  "id": {
    "type": "string",
    "description": "Co-id for update/delete/append/push operations"
  },
  "data": {
    "type": "object",
    "description": "Data for create/update operations (supports MaiaScript expressions)"
  },
  "items": {
    "type": "array",
    "description": "Items to append/push to CoList/CoStream"
  },
  "coId": {
    "type": "string",
    "description": "Co-id for schema operation"
  },
  "humanReadableKey": {
    "type": "string",
    "description": "Human-readable key for resolve/schema operations (seeding only)"
  },
  "actorId": {
    "type": "string",
    "description": "Actor co-id for processInbox operation"
  },
  "sessionId": {
    "type": "string",
    "description": "Session ID for processInbox operation"
  }
}
```

## References

- **DBEngine:** `libs/maia-operations/src/engine.js`
- **Operation Handlers:** `libs/maia-operations/src/operations/`
- **Backend:** `libs/maia-script/src/backends/indexeddb/`
- **Tool Definition:** `libs/maia-tools/src/db/db.tool.js`
- **Example Vibe:** `libs/maia-vibes/src/todos/`

## Future Enhancements

Potential future operations:
- `batch` - Execute multiple operations atomically
- `transaction` - Multi-operation transactions
- `migrate` - Schema migration operations
- `export` - Export data to JSON
- `import` - Import JSON into database
