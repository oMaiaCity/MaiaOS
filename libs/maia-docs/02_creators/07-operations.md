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

Update an existing record with partial validation.

```javascript
const updated = await maia.db({
  op: "update",
  schema: "@schema/todos",
  id: "123",
  data: {
    text: "Buy groceries and cook dinner"
  }
});
```

**Parameters:**
- `schema` (required) - Schema reference
- `id` (required) - Record ID to update
- `data` (required) - Partial data object (only fields to update)

**Returns:**
- Updated record

**Validation:**
- Validates only the fields you're updating (partial validation)
- Doesn't require all schema fields
- Throws error if validation fails

### `delete` - Delete Records

Delete a record from the database.

```javascript
const deleted = await maia.db({
  op: "delete",
  schema: "@schema/todos",
  id: "123"
});

console.log("Deleted:", deleted); // true
```

**Parameters:**
- `schema` (required) - Schema reference
- `id` (required) - Record ID to delete

**Returns:**
- `true` if deleted successfully

### `toggle` - Toggle Boolean Field

Toggle a boolean field (convenience operation).

```javascript
const updated = await maia.db({
  op: "toggle",
  schema: "@schema/todos",
  id: "123",
  field: "done"
});

// If done was false, now it's true (and vice versa)
```

**Parameters:**
- `schema` (required) - Schema reference
- `id` (required) - Record ID
- `field` (required) - Boolean field name to toggle

**Returns:**
- Updated record with toggled field

**Validation:**
- Validates that the field exists in schema
- Validates that the field is a boolean type
- Throws error if field doesn't exist or isn't boolean

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
          "op": "toggle",
          "schema": "@schema/todos",
          "id": "$$id",
          "field": "done"
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

2. **Operation Handlers** (`libs/maia-script/src/engines/db-engine/operations/`)
   - `read.js` - Read operation handler (always returns reactive store)
   - `create.js` - Create operation handler
   - `update.js` - Update operation handler
   - `delete.js` - Delete operation handler
   - `toggle.js` - Toggle operation handler
   - `seed.js` - Seed operation handler

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

### 2. Use Reactive Queries in Context

**✅ DO:** Define query objects in context (automatic reactivity)

```json
{
  "context": {
    "todos": {
      "schema": "@schema/todos",
      "filter": null
    }
  }
}
```

**❌ DON'T:** Manually subscribe in state machines

```json
{
  "entry": {
    "tool": "@db",
    "payload": {
      "op": "read",
      "schema": "co_zTodos123"
      // Don't manually subscribe - use context query objects instead!
    }
  }
}
```

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

### 5. Use Toggle for Boolean Fields

**✅ DO:** Use `toggle` operation for boolean fields

```json
{
  "tool": "@db",
  "payload": {
    "op": "toggle",
    "schema": "@schema/todos",
    "id": "$$id",
    "field": "done"
  }
}
```

**❌ DON'T:** Manually read, flip, and update

```json
{
  "tool": "@db",
  "payload": {
    "op": "update",
    "schema": "@schema/todos",
    "id": "$$id",
    "data": {
      "done": {"$not": "$done"} // Don't do this - use toggle!
    }
  }
}
```

## Examples

### Complete Todo List Example

**Context:**
```json
{
  "todos": {
    "schema": "@schema/todos",
    "filter": null
  },
  "newTodoText": ""
}
```

**State Machine:**
```json
{
  "initial": "idle",
  "states": {
    "idle": {
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
          "op": "toggle",
          "schema": "@schema/todos",
          "id": "$$id",
          "field": "done"
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
    "enum": ["read", "create", "update", "delete", "toggle", "seed"]
  },
  "schema": {
    "type": "string",
    "description": "Schema reference (@schema/actor, @schema/todos, etc.)"
  },
  "key": {
    "type": "string",
    "description": "Optional: Specific key for config queries"
  },
  "filter": {
    "type": "object",
    "description": "Optional: Filter criteria for data queries"
  },
  "id": {
    "type": "string",
    "description": "Optional: Record ID for update/delete/toggle operations"
  },
  "field": {
    "type": "string",
    "description": "Optional: Field name for toggle operations"
  },
  "data": {
    "type": "object",
    "description": "Optional: Data for create/update operations"
  }
}
```

## References

- **DBEngine:** `libs/maia-script/src/engines/db-engine/db.engine.js`
- **Operation Handlers:** `libs/maia-script/src/engines/db-engine/operations/`
- **Backend:** `libs/maia-script/src/engines/db-engine/backend/indexeddb/`
- **Tool Definition:** `libs/maia-tools/src/db/db.tool.js`
- **Example Vibe:** `libs/maia-vibes/src/todos/`

## Future Enhancements

Potential future operations:
- `batch` - Execute multiple operations atomically
- `transaction` - Multi-operation transactions
- `migrate` - Schema migration operations
- `export` - Export data to JSON
- `import` - Import JSON into database
