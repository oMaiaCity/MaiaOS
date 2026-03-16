# Tools and Messaging

MaiaOS uses two mechanisms for "doing work":

1. **`op` action** — Direct DataEngine calls from process handlers (create, update, delete, read)
2. **`tell` action** — Fire-and-forget messages between actors
3. **Service actors** — Actors with `function: true` that execute custom logic (e.g. @db for Spark operations)

## Primary Pattern: `op` in Process Handlers

**Process handlers** invoke data operations directly via the `op` action. No tool indirection.

```json
{
  "CREATE_TODO": [
    {
      "op": {
        "create": {
          "factory": "°Maia/factory/data/todos",
          "data": { "text": "$$value", "done": false }
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

**Why `op` instead of tools?**
- Simpler — Direct DataEngine call, no tool registry lookup
- Faster — No indirection
- Same validation — DataEngine validates against factory schemas

## Inter-Actor Messaging: `tell`

**Send messages to other actors** with the `tell` action. No `@core/publishMessage` tool.

```json
{
  "tell": {
    "target": "°Maia/actor/services/todos",
    "type": "TOGGLE_TODO",
    "payload": {
      "id": "$$id",
      "done": "$$done"
    }
  }
}
```

**Common pattern:** UI actor receives click → `tell` to service actor → service actor runs `op` → `tell` SUCCESS back to `$$source`.

## Service Actors (Function Execution)

Some actors have **executable functions** (e.g. `@maia/actor/os/db`). When a process handler uses `{ "function": true }`, the actor's `execute(actor, payload)` runs.

**Example:** Spark operations target `°Maia/actor/os/db` with event type `SPARK_OP`. The db service actor's function handles the payload and calls `maia.do()`.

## Available Service Actors

### Database Service Actor (`@maia/actor/os/db`)

**Creator-facing alias:** `@db` (resolved by getActor fallback)

Used when you need the **service actor pattern** (e.g. Spark operations that require account/peer context). For most CRUD, use `op` directly in your process handlers.

**Spark operations** — Target the db service actor with type `SPARK_OP`:

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

The db service actor's function executes `maia.do(payload)` and delivers SUCCESS/ERROR to the caller.

### Core Module

- `@core/preventDefault` — Prevent default browser behavior on events (e.g. form submit, link click)

## Context Updates: `ctx` (Not a Tool)

**Context updates** use the `ctx` action in process handlers. Not a tool.

```json
{
  "ctx": {
    "newTodoText": "",
    "error": null
  }
}
```

## Flow Summary

```
Process handler receives event
  ↓
op action → DataEngine (create/update/delete)
  ↓
On success: tell(SUCCESS) to $$source
On failure: ProcessEngine delivers ERROR to $$source
  ↓
ctx action → Update context CoValue
  ↓
View re-renders (reactive subscriptions)
```

## When to Use What

| Need | Use |
|------|-----|
| Create/update/delete data | `op` in process handler |
| Send message to another actor | `tell` in process handler |
| Spark operations (createSpark, etc.) | `tell` to °Maia/actor/os/db with SPARK_OP |
| Update context | `ctx` in process handler |
| Prevent default (e.g. form submit) | `@core/preventDefault` (tool) |
