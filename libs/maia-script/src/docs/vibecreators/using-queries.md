# Using Reactive Queries

## Introduction

Reactive queries automatically update your actor's data when changes happen. No manual refresh needed!

Think of it like a spreadsheet: when you change a cell, all formulas that depend on it update automatically. Similarly, when you create, update, or delete data, all actors subscribed to that data update automatically.

## Quick Start

### Step 1: Subscribe to Data

In your actor's state machine, add a `loading` state that subscribes to your data:

```json
{
  "initial": "loading",
  "states": {
    "loading": {
      "entry": {
        "tool": "@query/subscribe",
        "payload": {
          "schema": "todos",
          "target": "todos"
        }
      },
      "on": {
        "SUCCESS": "idle"
      }
    },
    "idle": {
      ...
    }
  }
}
```

**What happens:**
1. Actor starts in `loading` state
2. `@query/subscribe` tool runs
3. Data loads into `context.todos`
4. State machine transitions to `idle`
5. View renders with data
6. **Data automatically updates when it changes!**

### Step 2: Display Data in Your View

Use `$each` to loop through your data:

```json
{
  "$each": "$todos",
  "tag": "div",
  "class": "todo-item",
  "children": [
    {
      "tag": "span",
      "text": "$$text"
    }
  ]
}
```

**Syntax:**
- `$todos`: References `context.todos`
- `$$text`: References `item.text` inside the loop

### Step 3: Modify Data

Use mutation tools in your state machine:

```json
{
  "tool": "@mutation/create",
  "payload": {
    "schema": "todos",
    "data": {
      "text": "$newTodoText",
      "done": false
    }
  }
}
```

**Result:** All actors subscribed to `todos` automatically update! ✨

## Core Concepts

### Collections (Schemas)

Collections are groups of related data items. Think of them like database tables:

- `todos`: All todo items
- `notes`: All notes
- `contacts`: All contacts

### Reactive Subscriptions

When you subscribe to a collection, your actor automatically receives updates:

```json
{
  "tool": "@query/subscribe",
  "payload": {
    "schema": "todos",
    "target": "todos"
  }
}
```

**This means:**
- Subscribe to the `todos` collection
- Store results in `context.todos`
- Auto-update when `todos` changes
- Auto-re-render the actor

### Filters

Filter data to show only what you need:

```json
{
  "tool": "@query/subscribe",
  "payload": {
    "schema": "todos",
    "filter": {
      "field": "done",
      "op": "eq",
      "value": false
    },
    "target": "incompleteTodos"
  }
}
```

**Result:** Only incomplete todos (`done: false`) appear in `context.incompleteTodos`.

## Available Tools

### @query/subscribe (Reactive)

**Use for:** Data that changes frequently

```json
{
  "tool": "@query/subscribe",
  "payload": {
    "schema": "todos",
    "target": "todos"
  }
}
```

**Features:**
- ✅ Automatic updates
- ✅ Re-renders actor
- ✅ Supports filters
- ❌ Can't unsubscribe manually (auto-cleanup on actor destroy)

### @query/get (One-time)

**Use for:** Static data that doesn't change

```json
{
  "tool": "@query/get",
  "payload": {
    "schema": "settings",
    "target": "settings"
  }
}
```

**Features:**
- ✅ Fast (no subscription overhead)
- ✅ Good for read-only data
- ❌ No automatic updates
- ❌ Must re-run manually to refresh

### @query/filter (One-time + Filter)

**Use for:** One-time filtered queries

```json
{
  "tool": "@query/filter",
  "payload": {
    "schema": "todos",
    "filter": {
      "field": "priority",
      "op": "gt",
      "value": 5
    },
    "target": "highPriorityTodos"
  }
}
```

**Features:**
- ✅ Filtered results
- ✅ Fast (no subscription)
- ❌ No automatic updates

## Filter Operations

### Equality

```json
{ "field": "done", "op": "eq", "value": false }  // done === false
{ "field": "done", "op": "ne", "value": false }  // done !== false
```

### Comparison

```json
{ "field": "priority", "op": "gt", "value": 5 }   // priority > 5
{ "field": "priority", "op": "lt", "value": 10 }  // priority < 10
{ "field": "priority", "op": "gte", "value": 5 }  // priority >= 5
{ "field": "priority", "op": "lte", "value": 10 } // priority <= 10
```

### Array / String

```json
{ "field": "status", "op": "in", "value": ["active", "pending"] }  // status in array
{ "field": "text", "op": "contains", "value": "urgent" }            // text contains "urgent"
```

## Mutation Tools

### Create

```json
{
  "tool": "@mutation/create",
  "payload": {
    "schema": "todos",
    "data": {
      "text": "Buy groceries",
      "done": false,
      "priority": 5
    }
  }
}
```

**Result:** Creates new todo with auto-generated ID. All subscribed actors update automatically.

### Update

```json
{
  "tool": "@mutation/update",
  "payload": {
    "schema": "todos",
    "id": "1234",
    "data": {
      "text": "Buy groceries and cook dinner"
    }
  }
}
```

**Result:** Updates existing todo. All subscribed actors update automatically.

### Delete

```json
{
  "tool": "@mutation/delete",
  "payload": {
    "schema": "todos",
    "id": "1234"
  }
}
```

**Result:** Deletes todo. All subscribed actors update automatically.

### Toggle

```json
{
  "tool": "@mutation/toggle",
  "payload": {
    "schema": "todos",
    "id": "1234",
    "field": "done"
  }
}
```

**Result:** Toggles `done` from `true` to `false` (or vice versa). All subscribed actors update automatically.

## Common Patterns

### Pattern 1: Simple List

**State Machine:**

```json
{
  "initial": "loading",
  "states": {
    "loading": {
      "entry": {
        "tool": "@query/subscribe",
        "payload": {
          "schema": "todos",
          "target": "todos"
        }
      },
      "on": { "SUCCESS": "idle" }
    },
    "idle": {}
  }
}
```

**View:**

```json
{
  "$each": "$todos",
  "tag": "div",
  "text": "$$text"
}
```

### Pattern 2: Filtered Lists (Kanban Board)

**State Machine:**

```json
{
  "initial": "loading",
  "states": {
    "loading": {
      "entry": [
        {
          "tool": "@query/subscribe",
          "payload": {
            "schema": "todos",
            "filter": { "field": "done", "op": "eq", "value": false },
            "target": "todosTodo"
          }
        },
        {
          "tool": "@query/subscribe",
          "payload": {
            "schema": "todos",
            "filter": { "field": "done", "op": "eq", "value": true },
            "target": "todosDone"
          }
        }
      ],
      "on": { "SUCCESS": "idle" }
    },
    "idle": {}
  }
}
```

**View:**

```json
{
  "class": "kanban-board",
  "children": [
    {
      "class": "column",
      "children": [
        { "tag": "h3", "text": "To Do" },
        {
          "$each": "$todosTodo",
          "tag": "div",
          "text": "$$text"
        }
      ]
    },
    {
      "class": "column",
      "children": [
        { "tag": "h3", "text": "Done" },
        {
          "$each": "$todosDone",
          "tag": "div",
          "text": "$$text"
        }
      ]
    }
  ]
}
```

### Pattern 3: Create with Input

**Context:**

```json
{
  "newTodoText": "",
  "todos": []
}
```

**State Machine:**

```json
{
  "initial": "loading",
  "states": {
    "loading": {
      "entry": {
        "tool": "@query/subscribe",
        "payload": {
          "schema": "todos",
          "target": "todos"
        }
      },
      "on": { "SUCCESS": "idle" }
    },
    "idle": {
      "on": {
        "UPDATE_INPUT": {
          "target": "idle",
          "actions": {
            "tool": "@context/update",
            "payload": { "newTodoText": "$$value" }
          }
        },
        "CREATE_TODO": {
          "target": "creating"
        }
      }
    },
    "creating": {
      "entry": [
        {
          "tool": "@mutation/create",
          "payload": {
            "schema": "todos",
            "data": {
              "text": "$newTodoText",
              "done": false
            }
          }
        },
        {
          "tool": "@context/update",
          "payload": { "newTodoText": "" }
        }
      ],
      "on": { "SUCCESS": "idle" }
    }
  }
}
```

**View:**

```json
{
  "children": [
    {
      "tag": "input",
      "value": "$newTodoText",
      "$on": {
        "input": {
          "send": "UPDATE_INPUT",
          "payload": { "value": "@inputValue" }
        },
        "keydown": {
          "send": "CREATE_TODO",
          "key": "Enter"
        }
      }
    },
    {
      "$each": "$todos",
      "tag": "div",
      "text": "$$text"
    }
  ]
}
```

## Troubleshooting

### Data Not Appearing

**Check:**
1. Is your actor in the `loading` state?
2. Is the `@query/subscribe` tool running?
3. Is the `target` field correct? (e.g., `"target": "todos"`)
4. Is there data in localStorage? (Open DevTools → Application → Local Storage)

**Debug:**
- Open browser console
- Look for `[query/subscribe]` logs
- Check `Updated actor_xxx.context.todos with N items`

### Data Not Updating

**Check:**
1. Are you using `@query/subscribe` (not `@query/get`)?
2. Are you using mutation tools (`@mutation/*`) to modify data?
3. Is the schema name correct in both subscribe and mutation?

**Debug:**
- Open browser console
- Look for `[mutation/create]` or `[mutation/update]` logs
- Check `ReactiveStore.setCollection()` is being called

### Multiple Actors Not Syncing

**Verify:**
1. All actors subscribe to the same schema name
2. All actors use mutation tools (not direct context modification)
3. Actors are properly initialized (check console logs)

**Test:**
- Create data in one actor
- Check if other actors update
- Refresh page and verify data persists

### Empty Lists

**Common Causes:**
1. No data in localStorage yet (create some items!)
2. Filter too restrictive (check filter conditions)
3. Target field mismatch (check `$todos` vs context key)

**Fix:**
- Create initial data via `@mutation/create`
- Simplify or remove filters
- Match context keys exactly

## Best Practices

### DO

✅ Always subscribe in the `loading` state
✅ Use meaningful target names (`incompleteTodos`, not `data1`)
✅ Filter data at subscription time (not in view)
✅ Use mutation tools for all data changes
✅ Test with empty data (handle empty arrays gracefully)
✅ Document which actors subscribe to which data

### DON'T

❌ Modify `actor.context[schema]` directly
❌ Create data without using `@mutation/create`
❌ Forget to add `on: { SUCCESS: "idle" }` after loading
❌ Mix reactive (`@query/subscribe`) and non-reactive (`@query/get`) for same data
❌ Subscribe to entire collections when you only need filtered data
❌ Use filters in views (use filtered subscriptions instead)

## Performance Tips

1. **Filter early:** Subscribe to filtered data, not entire collections
2. **Minimize subscriptions:** Only subscribe to data you actually display
3. **Use @query/get for static data:** Avoid unnecessary subscriptions
4. **Batch mutations:** Group multiple creates/updates when possible
5. **Keep collections small:** Break large datasets into multiple collections

## Next Steps

- Learn about [State Machines](./05-state-machines.md)
- Explore [Mutation Tools](./06-mutations.md)
- Build a [Kanban Board](../examples/kanban-board.md)
- Understand [Actor Composition](./composing-actors.md)

## Summary

Reactive queries make data management automatic:

- **Subscribe once:** `@query/subscribe` in loading state
- **Display data:** `$each` in your view
- **Modify data:** Use `@mutation/*` tools
- **Automatic updates:** Everything syncs automatically! ✨

No manual refresh, no prop drilling, just reactive magic! 🎉
