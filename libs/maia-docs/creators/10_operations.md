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

### `query` - Load Data

Load data, configs, or schemas from the database.

**Load a specific config:**
```javascript
const vibeConfig = await maia.db({
  op: "query",
  schema: "@schema/actor",
  key: "vibe/vibe"
});
```

**Query a collection:**
```javascript
const todos = await maia.db({
  op: "query",
  schema: "@schema/todos"
});
```

**Query with filter:**
```javascript
const incompleteTodos = await maia.db({
  op: "query",
  schema: "@schema/todos",
  filter: { done: false }
});
```

**Reactive subscription (with callback):**
```javascript
const unsubscribe = await maia.db({
  op: "query",
  schema: "@schema/todos",
  callback: (data) => {
    console.log("Todos updated:", data);
    // Update your UI here
  }
});

// Later, unsubscribe
unsubscribe();
```

**Parameters:**
- `schema` (required) - Schema reference (`@schema/actor`, `@schema/todos`, etc.)
- `key` (optional) - Specific key for configs (e.g., `"vibe/vibe"`)
- `filter` (optional) - Filter criteria object (e.g., `{done: false}`)
- `callback` (optional) - Function for reactive subscriptions

**Returns:**
- Data (if one-time query)
- Unsubscribe function (if reactive with callback)

### `create` - Create New Records

Create a new record with schema validation.

```javascript
const newTodo = await maia.db({
  op: "create",
  schema: "@schema/todos",
  data: {
    text: "Buy groceries",
    done: false
  }
});

console.log("Created:", newTodo.id); // Auto-generated ID
```

**Parameters:**
- `schema` (required) - Schema reference (`@schema/todos`, etc.)
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

Flush and seed the database with initial data (development only).

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

**Note:** This operation clears existing data. Use only in development!

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
        "SUCCESS": "idle"
      }
    }
  }
}
```

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

2. **Operation Handlers** (`libs/maia-script/src/o/engines/maiadb/operations/`)
   - `query.js` - Query operation handler
   - `create.js` - Create operation handler
   - `update.js` - Update operation handler
   - `delete.js` - Delete operation handler
   - `toggle.js` - Toggle operation handler
   - `seed.js` - Seed operation handler

3. **Backend** (`libs/maia-script/src/o/engines/maiadb/backend/`)
   - `indexeddb.js` - IndexedDB backend (current)
   - Future: CoJSON CRDT backend

## Best Practices

### 1. Use Reactive Queries in Context

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
      "op": "query",
      "schema": "@schema/todos",
      "callback": "..." // Don't do this - use context query objects!
    }
  }
}
```

### 2. Always Use Operations for Mutations

**✅ DO:** Use `@db` tool for all data changes

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

**❌ DON'T:** Modify context directly

```json
{
  "tool": "@context/update",
  "payload": {
    "todos": [...] // Don't mutate reactive data directly!
  }
}
```

### 3. Handle Errors

**✅ DO:** Handle SUCCESS/ERROR events

```json
{
  "creating": {
    "entry": {
      "tool": "@db",
      "payload": {...}
    },
    "on": {
      "SUCCESS": "idle",
      "ERROR": "error"
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

### 4. Use Toggle for Boolean Fields

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
          "tool": "@context/update",
          "payload": {"newTodoText": ""}
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
    "enum": ["query", "create", "update", "delete", "toggle", "seed"]
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
  "callback": {
    "description": "Optional: Callback function for reactive subscriptions"
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

- **DBEngine:** `libs/maia-script/src/o/engines/maiadb/db.engine.js`
- **Operation Handlers:** `libs/maia-script/src/o/engines/maiadb/operations/`
- **Backend:** `libs/maia-script/src/o/engines/maiadb/backend/indexeddb.js`
- **Tool Definition:** `libs/maia-script/src/o/tools/db/db.tool.maia`
- **Example Vibe:** `libs/maia-vibes/src/todos/`

## Future Enhancements

Potential future operations:
- `batch` - Execute multiple operations atomically
- `transaction` - Multi-operation transactions
- `migrate` - Schema migration operations
- `export` - Export data to JSON
- `import` - Import JSON into database
