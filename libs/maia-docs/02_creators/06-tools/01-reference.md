# Tools and Messaging Reference

## `op` Action (Data Operations)

Process handlers use `op` for create, update, delete. See [Process Handlers](./05-state/) for full structure.

**Create:**
```json
{
  "op": {
    "create": {
      "factory": "°Maia/factory/data/todos",
      "data": { "text": "$$value", "done": false }
    }
  }
}
```

**Update:**
```json
{
  "op": {
    "update": {
      "id": "$$id",
      "data": { "done": { "$not": "$$done" } }
    }
  }
}
```

**Delete:**
```json
{
  "op": {
    "delete": {
      "id": "$$id"
    }
  }
}
```

## `tell` Action (Inter-Actor Messaging)

```json
{
  "tell": {
    "target": "$$source",
    "type": "SUCCESS",
    "payload": {}
  }
}
```

**Target** can be:
- `$$source` — Actor that sent the event (for SUCCESS/ERROR replies)
- Co-id — `co_zActor123...`
- Human-readable path — `°Maia/actor/services/todos`

## Spark Operations (via `@maia/actor/os/db`)

**Create Spark:**
```json
{
  "tell": {
    "target": "°Maia/actor/os/db",
    "type": "SPARK_OP",
    "payload": {
      "op": "createSpark",
      "name": "My Project"
    }
  }
}
```

**Read Spark:**
```json
{
  "tell": {
    "target": "°Maia/actor/os/db",
    "type": "SPARK_OP",
    "payload": {
      "op": "readSpark"
    }
  }
}
```

**Update Spark:**
```json
{
  "tell": {
    "target": "°Maia/actor/os/db",
    "type": "SPARK_OP",
    "payload": {
      "op": "updateSpark",
      "id": "co_z...",
      "data": { "name": "Updated Name" }
    }
  }
}
```

**Delete Spark:**
```json
{
  "tell": {
    "target": "°Maia/actor/os/db",
    "type": "SPARK_OP",
    "payload": {
      "op": "deleteSpark",
      "id": "co_z..."
    }
  }
}
```

The db service actor's function executes `maia.do(payload)` and delivers SUCCESS/ERROR to the caller.

## `@core/preventDefault`

Prevents default browser behavior (e.g. form submit, link navigation). Use in view event handlers when the event is handled by the process.

## `ctx` Action (Context Updates)

```json
{
  "ctx": {
    "newTodoText": "",
    "error": null,
    "viewMode": "$$viewMode"
  }
}
```

All `ctx` updates in a handler run are batched and written to the context CoValue once at the end.

## Best Practices

**✅ DO:**
- Use `op` for create/update/delete in process handlers
- Use `tell` for inter-actor messaging
- Use `tell` with `target: "$$source"` and `type: "SUCCESS"` after successful `op`
- Handle ERROR in your process (e.g. `ctx: { error: "$$errors.0.message" }`)

**❌ DON'T:**
- Don't use `tool: "@db"` — use `op` instead
- Don't use `@core/publishMessage` — use `tell` instead
- Don't mutate context directly — use `ctx` action
