# Tools (The Hands)

Think of tools as your actor's **hands** - they do the actual work!

**Your state machine says:** "Now is the time to create a todo!"

**The tool responds:** "Got it! Let me add that to the database for you."

## What Tools Do

Tools are where the actual work happens:
- Create a todo? That's a tool! (`@db` with `op: "create"`)
- Delete an item? That's a tool! (`@db` with `op: "delete"`)
- Send a message? That's a tool! (`@core/publishMessage`)

Your actor can't do anything without tools - they're the only way to actually make things happen.

## How It Works Together

```
State Machine (The Brain)  →  "Create a todo!"
     ↓
Tool (The Hands)          →  Actually creates it in the database
     ↓
Context (The Memory)      →  Updates with the new todo
     ↓
View (The Face)           →  Shows the new todo to the user
```

## Tool Structure

Each tool consists of two files:

### 1. Tool Definition (`.tool.maia`)
AI-compatible metadata describing the tool:

```json
{
  "$type": "tool",
  "$id": "tool_db_001",
  "name": "@db",
  "description": "Unified database operation tool",
  "parameters": {
    "type": "object",
    "properties": {
      "schema": {
        "type": "string",
        "description": "Collection name (e.g., 'todos', 'notes')"
      },
      "data": {
        "type": "object",
        "description": "Entity data (without ID, auto-generated)"
      }
    },
    "required": ["schema", "data"]
  }
}
```

### 2. Tool Function (`.tool.js`)
Executable JavaScript function (must return OperationResult):

```javascript
import { createSuccessResult, createErrorResult, createErrorEntry } from '@MaiaOS/operations';

export default {
  async execute(actor, payload) {
    try {
      const result = await someOperation(payload);
      return createSuccessResult(result);
    } catch (err) {
      return createErrorResult(err.errors ?? [createErrorEntry('structural', err.message)]);
    }
  }
};
```

**CRITICAL:** Tools return OperationResult; they do not throw for domain errors. State machines handle context updates via `updateContext` actions in SUCCESS handlers.

## Tool Roundtrip Contract

All tools return **OperationResult** (never throw for domain errors). StateEngine routes to inbox events.

- **Success:** Return `createSuccessResult(data)`. StateEngine sends `SUCCESS` with `{ ...eventPayload, result: data }` (domain data only; envelope is consistent).
- **Error:** Return `createErrorResult(errors)`. StateEngine sends `ERROR` with `{ errors }`.

Tools that call external APIs use shared helpers (`getApiBaseUrl`, `toStructuredErrors`) from `core/api-helpers.js`. All ERROR inbox events use `{ errors: [{ type, message, path? }] }` (same as OperationResult).

**Example:**
```javascript
import { createSuccessResult, createErrorResult, createErrorEntry } from '@MaiaOS/operations';

if (!target) {
  return createErrorResult([createErrorEntry('structural', 'Target is required')]);
}
const data = await doWork();
return createSuccessResult(data);
```

## Available Tools

### Database Module (`@db`)

The `@db` tool is a unified database operation tool that handles all CRUD operations through an `op` parameter.

#### Create Operation
```json
{
  "tool": "@db",
  "payload": {
    "op": "create",
    "schema": "co_z...",
    "data": {"text": "Buy milk", "done": false}
  }
}
```

**Note:** The `schema` field must be a co-id (`co_z...`). Schema references (`@schema/todos`) are transformed to co-ids during seeding. In your source state machine files, you can use schema references, but they get transformed to co-ids before execution.

**Tool Results:**
The `@db` tool returns the created/updated/deleted record. Access the result in SUCCESS handlers via `$$result`:

```json
{
  "creating": {
    "entry": {
      "tool": "@db",
      "payload": { "op": "create", "schema": "@schema/todos", "data": {...} }
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
                "id": "$$result.id",      // ← Tool result available here
                "text": "$$result.text"
              }
            }
          }
        ]
      }
    }
  }
}
```

#### Update Operation
```json
{
  "tool": "@db",
  "payload": {
    "op": "update",
    "id": "co_z...",
    "data": {"text": "Buy milk and eggs"}
  }
}
```

**Note:** For `update` and `delete` operations, `schema` is not required. The schema is automatically extracted from the CoValue's headerMeta internally by the operation.

#### Delete Operation
```json
{
  "tool": "@db",
  "payload": {
    "op": "delete",
    "id": "co_z..."
  }
}
```

**Note:** For `update` and `delete` operations, `schema` is not required. The schema is automatically extracted from the CoValue's headerMeta internally by the operation.

#### Toggle (Using Update with Expression)

Toggle is not a separate operation. Use `update` with an expression:

```json
{
  "tool": "@db",
  "payload": {
    "op": "update",
    "id": "co_z...",
    "data": {
      "done": { "$not": "$existing.done" }
    }
  }
}
```

**Note:** For `update` and `delete` operations, `schema` is not required - it's extracted from the CoValue's headerMeta automatically.

#### Seed Operation
```json
{
  "tool": "@db",
  "payload": {
    "op": "seed",
    "schema": "@schema/todos",
    "data": [
      {"text": "First todo", "done": false},
      {"text": "Second todo", "done": true}
    ]
  }
}
```

### Sparks Module (`@sparks`)

The `@sparks` tool is a domain-specific tool for managing Sparks (collaborative spaces/groups). Sparks are CoMaps that reference groups, allowing users to organize their data into separate collaborative spaces.

**When to use `@sparks` vs `@db`:**
- Use `@sparks` for spark-specific operations (creating sparks, managing spark groups, future member/permission management)
- Use `@db` for generic CRUD operations on data collections (todos, notes, etc.)

#### Create Spark Operation
```json
{
  "tool": "@sparks",
  "payload": {
    "op": "createSpark",
    "name": "My Project"
  }
}
```

**What it does:**
- Creates a child group owned by your @maia spark's group
- Creates a Spark CoMap with the name and group reference
- Registers the spark in `account.sparks` CoMap
- Automatically indexes the spark in the database

**Tool Result:** Returns created spark object with `id`, `name`, and `group` properties.

#### Read Spark Operation
```json
{
  "tool": "@sparks",
  "payload": {
    "op": "readSpark"
  }
}
```

Read all sparks (returns reactive store):
```json
{
  "tool": "@sparks",
  "payload": {
    "op": "readSpark",
    "id": "co_z..."
  }
}
```

Read a specific spark by co-id.

**Tool Result:** Returns reactive store(s) with spark data. Access via `$$result` in SUCCESS handler.

#### Update Spark Operation
```json
{
  "tool": "@sparks",
  "payload": {
    "op": "updateSpark",
    "id": "co_z...",
    "data": {
      "name": "Updated Spark Name"
    }
  }
}
```

**Note:** The `data` object can contain `name` and/or `group` properties.

#### Delete Spark Operation
```json
{
  "tool": "@sparks",
  "payload": {
    "op": "deleteSpark",
    "id": "co_z..."
  }
}
```

**What it does:**
- Removes the spark from `account.sparks` registry
- Deletes the Spark CoMap
- Note: The associated group is not deleted (groups persist independently)

**Future Operations (to be added):**
- `addMember` - Add member to spark's group
- `removeMember` - Remove member from spark's group
- `updatePermissions` - Update member permissions/roles
- `getMembers` - List spark members

### Core Module (`@core/*`)

#### `@core/setViewMode`
```json
{
  "tool": "@core/setViewMode",
  "payload": {"viewMode": "kanban"}
}
```


### Drag-Drop Module (`@dragdrop/*`)

#### `@dragdrop/start`
```json
{
  "tool": "@dragdrop/start",
  "payload": {
    "id": "co_z..."
  }
}
```

**Note:** Schema is not required. The schema is automatically extracted from the CoValue's headerMeta internally by update/delete operations when needed.

**Tool Result:** Returns drag state object. Update context in SUCCESS handler:

```json
{
  "dragging": {
    "entry": {
      "tool": "@dragdrop/start",
      "payload": { "id": "$$id" }
    },
    "on": {
      "SUCCESS": {
        "target": "dragging",
        "actions": [
          {
            "updateContext": {
              "draggedItemId": "$$result.draggedItemId",
              "draggedItemIds": "$$result.draggedItemIds"
            }
          }
        ]
      }
    }
  }
}
