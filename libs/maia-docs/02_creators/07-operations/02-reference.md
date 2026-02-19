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

**Context (`todo.context.maia`):**
```json
{
  "$schema": "@schema/context",
  "$id": "@context/todo",
  "todos": {
    "schema": "@schema/todos",
    "filter": null
  },
  "newTodoText": ""
}
```

**State Machine (`todo.state.maia`):**
```json
{
  "$schema": "@schema/state",
  "$id": "@state/todo",
  "initial": "idle",
  "states": {
    "idle": {
      "on": {
        "CREATE_TODO": {
          "target": "creating"
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
    "enum": ["read", "create", "update", "delete", "seed", "schema", "resolve", "append", "push", "processInbox", "createSpark", "readSpark", "updateSpark", "deleteSpark"]
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

- **DataEngine:** `libs/maia-engines/src/engines/data.engine.js`
- **Operation Handlers:** `libs/maia-operations/src/operations/`
- **Storage:** MaiaDB (`libs/maia-db/`) – CoJSON CRDT
- **Tool Definition:** `libs/maia-tools/src/db/db.tool.js`
- **Example Vibe:** `libs/maia-vibes/src/todos/`

## Future Enhancements

Potential future operations:
- `batch` - Execute multiple operations atomically
- `transaction` - Multi-operation transactions
- `migrate` - Schema migration operations
- `export` - Export data to JSON
- `import` - Import JSON into database
