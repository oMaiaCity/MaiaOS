# Reactive Data System - How Data Magically Updates Your UI

## What Problem Does This Solve?

Imagine you're building a todo app. When you add a new todo, you want it to automatically appear in the list without refreshing the page. When you mark a todo as done, you want it to instantly move from the "Todo" column to the "Done" column. 

**The problem:** How do you make your UI automatically update when your data changes?

**The old way:** You'd have to manually write code to update the UI every time data changes. It's like having to manually redraw a picture every time someone adds a new element.

**The MaiaOS way:** Just declare what data you need in your `context`, and MaiaOS automatically watches for changes and updates your UI. It's like magic! ✨

## Quick Example - See It in Action

**Step 1: Declare what data you need (in your context)**

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

**Step 2: Use it in your view**

```json
{
  "$each": {
    "items": "$todos",
    "template": {
      "tag": "li",
      "text": "$$item.text"
    }
  }
}
```

**Step 3: There is no step 3!** When you create a new todo using the `@db` tool, your view automatically updates. No extra code needed.

## How It Works (The Simple Version)

Think of MaiaOS like a helpful assistant watching your data:

1. **You declare your needs**: "I need all todos" (in context)
2. **MaiaOS subscribes for you**: A special engine called SubscriptionEngine notices your declaration and starts watching the database
3. **Data changes**: Someone creates a new todo
4. **MaiaOS notifies you**: SubscriptionEngine says "Hey! Your todos changed!"
5. **UI updates automatically**: Your view re-renders with the new data

**It's like subscribing to a newsletter** - you tell the system what you want to know about, and it automatically sends you updates when things change.

## The Three Magic Ingredients

### 1. Context = "What I Need" (Declarative)

Your actor's `context` tells MaiaOS what data you need. Use **query objects** to declare reactive data subscriptions:

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

**What this means:** "I need all items from the 'todos' collection, and keep me updated when they change."

**Think of it like:** Ordering a newspaper subscription - you tell them what you want, and they deliver it to you every day.

### 2. SubscriptionEngine = "The Watcher" (Automatic)

SubscriptionEngine is a behind-the-scenes helper that:
- Scans your context for query objects
- Automatically subscribes to the database
- Listens for changes
- Updates your context when data changes
- Triggers UI re-renders

**You never interact with SubscriptionEngine directly** - it just works! Like electricity in your house - you don't think about it, you just flip the switch and the lights turn on.

### 3. MaiaDB = "The Data Store" (Reactive)

MaiaDB is the database that stores your data. It's special because:
- It knows when data changes
- It can notify subscribers (like SubscriptionEngine)
- It's reactive by default (no manual "watch" setup)

**Think of it like:** A smart filing cabinet that automatically tells you when someone adds or removes a file.

## Context-Driven Reactivity - Your Data Blueprint

The key concept: **Your context IS your data subscription blueprint.**

### Simple Example - All Todos

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

**What happens:**
1. SubscriptionEngine sees `"todos"` has a `schema` field starting with `@`
2. It automatically creates a subscription to `@schema/todos`
3. It initializes `context.todos = []`
4. When data comes in, it sets `context.todos = [actual data]`
5. Your view re-renders with the new data

**In your view, you just use it:**

```json
{
  "$each": {
    "items": "$todos",
    "template": {
      "tag": "li",
      "text": "$$item.text"
    }
  }
}
```

### Filtered Example - Only Incomplete Todos

```json
{
  "context": {
    "todosTodo": {
      "schema": "@schema/todos",
      "filter": { "done": false }
    },
    "todosDone": {
      "schema": "@schema/todos",
      "filter": { "done": true }
    }
  }
}
```

**What happens:**
1. SubscriptionEngine creates TWO subscriptions (one for each context key)
2. `todosTodo` gets all todos where `done === false`
3. `todosDone` gets all todos where `done === true`
4. Both update independently when data changes

**In your view (Kanban board example):**

```json
{
  "container": {
    "tag": "div",
    "class": "kanban",
    "children": [
      {
        "tag": "div",
        "class": "column",
        "children": [
          { "tag": "h2", "text": "Todo" },
          {
            "$each": {
              "items": "$todosTodo",
              "template": { "tag": "div", "text": "$$item.text" }
            }
          }
        ]
      },
      {
        "tag": "div",
        "class": "column",
        "children": [
          { "tag": "h2", "text": "Done" },
          {
            "$each": {
              "items": "$todosDone",
              "template": { "tag": "div", "text": "$$item.text" }
            }
          }
        ]
      }
    ]
  }
}
```

## Query Objects - The Subscription Format

A **query object** is how you declare "I want this data, reactively":

```json
{
  "schema": "@schema/todos",
  "filter": { "done": false }
}
```

**Properties:**

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `schema` | Yes | string | Database collection ID (must start with `@`) |
| `filter` | No | object or null | Filter criteria (null = get all) |

**Filter examples:**

```json
// All items
{ "schema": "@schema/todos", "filter": null }

// Incomplete todos
{ "schema": "@schema/todos", "filter": { "done": false } }

// Completed todos
{ "schema": "@schema/todos", "filter": { "done": true } }

// Specific user's todos
{ "schema": "@schema/todos", "filter": { "userId": "123" } }
```

## The @ Reference System - Future-Proof IDs

You might notice all schema references start with `@` (like `@schema/todos`, `@list`, `@brand`).

**Why the @ symbol?**

Think of `@` references as **symbolic names** that point to something. Like how `@username` on social media points to a user profile.

**Right now:** `@schema/todos` is a string ID that MaiaDB uses to look up data.

**In the future:** When MaiaOS migrates to CoJSON (our CRDT-based sync system), these `@` references will become **CoValue IDs** - unique identifiers for collaborative data objects that can sync across devices.

**What this means for you:**
- Keep using `@` prefixes for schemas, actors, views, styles, etc.
- Your code will automatically work when we migrate to CoJSON
- No breaking changes needed!

**Examples:**
```json
{
  "todos": { "schema": "@schema/todos", "filter": null },  // ← Data reference
  "currentView": "@list",                                   // ← View reference (future: reactive)
  "styleRef": "@brand"                                      // ← Style reference (future: reactive)
}
```

## Context Types - Different Kinds of Data

Your context can hold different types of data:

### 1. Reactive Data (Query Objects)

```json
{
  "todos": { "schema": "@schema/todos", "filter": null }
}
```

**Auto-subscribes** - Changes in database automatically update context.

### 2. @ References (Future Reactive)

```json
{
  "currentView": "@list",
  "currentStyle": "@brand"
}
```

**Right now:** Static references to actors, views, styles.
**Future:** Will be reactive (hot-reload when definitions change).

### 3. Scalar Values (Non-Reactive)

```json
{
  "newTodoText": "",
  "viewMode": "list",
  "isModalOpen": false
}
```

**Updated by tools** - Only change when you explicitly update them via tools (like `@context/update`).

## Creating, Updating, Deleting Data - The @db Tool

To modify data, use the **`@db` tool**. It's a unified database operation tool that handles all CRUD operations.

### Creating New Data

**In your state machine:**

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
        "SUCCESS": "idle"
      }
    }
  }
}
```

**What happens:**
1. State machine sends event `CREATE_TODO`
2. Transition to `creating` state
3. Execute `@db` tool with `op: "create"`
4. Database creates new todo
5. **SubscriptionEngine automatically notifies subscribers**
6. Your `context.todos` updates
7. View re-renders with new todo
8. Transition to `idle` state

**You never manually update context** - the SubscriptionEngine does it for you!

### Updating Data

```json
{
  "tool": "@db",
  "payload": {
    "op": "update",
    "schema": "@schema/todos",
    "id": "$editingId",
    "data": {
      "text": "$newTodoText"
    }
  }
}
```

### Toggling Boolean Fields

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

**Special operation** - Flips a boolean field from `true` to `false` or vice versa. Perfect for todo completion!

### Deleting Data

```json
{
  "tool": "@db",
  "payload": {
    "op": "delete",
    "schema": "@schema/todos",
    "id": "$$id"
  }
}
```

## Data Flow - From Click to Update

Let's trace what happens when you click "Add Todo":

```
1. User types "Buy milk" in input
   ↓
2. User clicks "Add" button
   ↓
3. View sends event: { "send": "CREATE_TODO" }
   ↓
4. State machine transitions: "idle" → "creating"
   ↓
5. State machine entry action executes @db tool:
   { "op": "create", "schema": "@schema/todos", "data": {...} }
   ↓
6. MaiaDB creates new todo in IndexedDB:
   { "id": "123", "text": "Buy milk", "done": false }
   ↓
7. MaiaDB notifies observers: "Hey! @schema/todos changed!"
   ↓
8. SubscriptionEngine receives notification
   ↓
9. SubscriptionEngine updates context:
   actor.context.todos = [new data from database]
   ↓
10. SubscriptionEngine schedules re-render (batched in microtask)
   ↓
11. ActorEngine.rerender(actor) is called
   ↓
12. ViewEngine re-renders with new context.todos
   ↓
13. User sees "Buy milk" appear in the list! ✨
   ↓
14. State machine transitions: "creating" → "idle"
```

**Key insight:** You never manually update `context.todos`. The SubscriptionEngine does it automatically when the database changes.

## SubscriptionEngine - The Magic Behind the Scenes

You don't directly interact with SubscriptionEngine, but it's helpful to understand what it does for you:

### What It Does

1. **Scans your context** - Looks for query objects (objects with `schema` field)
2. **Auto-subscribes** - Creates database subscriptions for each query object
3. **Watches for changes** - Listens to database notifications
4. **Updates context** - Sets `context[key]` when data changes
5. **Batches re-renders** - Collects multiple updates and re-renders once
6. **Deduplicates** - Skips re-renders if data hasn't actually changed
7. **Cleans up** - Unsubscribes when actor is destroyed (prevents memory leaks)

### Lifecycle

```
Actor Created
  ↓
SubscriptionEngine.initialize(actor)
  ↓
Scan context for query objects
  ↓
For each query object:
  - Subscribe to MaiaDB
  - Store unsubscribe function in actor._subscriptions
  ↓
Actor is now reactive!
  ↓
Data changes → Callback fired → Context updated → Re-render scheduled
  ↓
(Repeat until actor is destroyed)
  ↓
Actor Destroyed
  ↓
SubscriptionEngine.cleanup(actor)
  ↓
All subscriptions unsubscribed
```

### Optimization - Batching and Deduplication

**Batching** - If multiple updates happen at once (e.g., you create 5 todos in a loop), SubscriptionEngine batches them:

```
Update 1 → Schedule re-render (in microtask)
Update 2 → Already scheduled, skip
Update 3 → Already scheduled, skip
Update 4 → Already scheduled, skip
Update 5 → Already scheduled, skip
  ↓
Microtask runs → Re-render ONCE with all updates
```

**Result:** 5 updates = 1 re-render (instead of 5 re-renders)

**Deduplication** - If data hasn't actually changed, skip re-render:

```javascript
// Old data: [{ id: "1", text: "Buy milk", done: false }]
// New data: [{ id: "1", text: "Buy milk", done: false }]
// Result: Same data → Skip re-render
```

**Result:** No unnecessary re-renders!

### Debug Logs - See What's Happening

SubscriptionEngine logs everything in development mode:

```javascript
[SubscriptionEngine] Initialized
[SubscriptionEngine] Initializing actor_list_001
[SubscriptionEngine] ✅ actor_list_001 → @schema/todos → $todos
[SubscriptionEngine] actor_list_001 initialized with 1 subscription(s)
[SubscriptionEngine] 📥 actor_list_001.$todos initial data (3)
[SubscriptionEngine] 🔄 actor_list_001.$todos updated (4)
[SubscriptionEngine] 🎨 Batched re-render: 1 actor(s) [actor_list_001]
```

**Emojis explain what's happening:**
- ✅ Subscription created
- 📥 Initial data received
- 🔄 Data updated
- ⏭️ Skipping (no change)
- 🎨 Re-rendering
- 🧹 Cleaning up

**Open your browser console** and watch the magic happen!

## State Machine's Role - Pure Transition Rules

With the new architecture, **state machines are purely declarative**. They define:
- **What transitions happen** (A → B)
- **What tools to execute** (`@db`, `@context/update`, etc.)
- **What context updates to make** (via tools)

**State machines DO NOT:**
- ❌ Load data directly
- ❌ Subscribe to data
- ❌ Manage subscriptions
- ❌ Know about SubscriptionEngine

**Example:**

```json
{
  "$type": "state",
  "initial": "loading",
  "states": {
    "loading": {
      "entry": [],
      "on": {
        "SUCCESS": "idle"
      }
    },
    "idle": {
      "on": {
        "CREATE_TODO": {
          "target": "creating",
          "guard": { "$ne": ["$newTodoText", ""] }
        }
      }
    },
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
              "tool": "@context/update",
              "payload": {
                "newTodoText": ""
              }
            }
          ]
        }
      }
    }
  }
}
```

**What the state machine does:**
1. Defines transition rules (`idle` → `creating` when `CREATE_TODO` received)
2. Executes tools (`@db` to create todo)
3. Updates context (`newTodoText = ""` to clear input)

**What it doesn't do:**
- Subscribe to data (SubscriptionEngine does this)
- Load data (SubscriptionEngine does this)
- Know about reactivity (SubscriptionEngine handles it)

**It's purely business logic** - "When this happens, do that."

## View's Role - Pure Consumer of Context

Views are **purely presentation**. They read from context and render UI.

**Views DO:**
- ✅ Read from context (`$todos`, `$newTodoText`)
- ✅ Loop over arrays (`$each`)
- ✅ Send events (`{ "send": "CREATE_TODO" }`)
- ✅ Display data (`$$item.text`)

**Views DO NOT:**
- ❌ Subscribe to data
- ❌ Load data
- ❌ Know about reactivity
- ❌ Contain business logic

**Example:**

```json
{
  "$type": "view",
  "container": {
    "tag": "div",
    "children": [
      {
        "tag": "input",
        "attrs": {
          "value": "$newTodoText"
        }
      },
      {
        "tag": "button",
        "text": "Add",
        "$on": {
          "click": { "send": "CREATE_TODO" }
        }
      },
      {
        "tag": "ul",
        "$each": {
          "items": "$todos",
          "template": {
            "tag": "li",
            "children": [
              { "tag": "span", "text": "$$item.text" },
              {
                "tag": "button",
                "text": "✓",
                "$on": {
                  "click": {
                    "send": "TOGGLE_TODO",
                    "payload": { "id": "$$item.id" }
                  }
                }
              }
            ]
          }
        }
      }
    ]
  }
}
```

**That's it!** Views just read from context and send events. SubscriptionEngine keeps context up to date.

## Real Example - Todo App Architecture

Let's build a complete todo app to see how it all fits together:

### 1. Context - Declare Your Data Needs

**`list.context.maia`:**

```json
{
  "$type": "context",
  "$id": "context_list_001",
  
  "todos": {
    "schema": "@schema/todos",
    "filter": null
  },
  
  "newTodoText": ""
}
```

**What this does:**
- `todos`: Reactive data (auto-subscribes, auto-updates)
- `newTodoText`: Form state (updated via tools)

### 2. State Machine - Define Business Logic

**`list.state.maia`:**

```json
{
  "$type": "state",
  "$id": "state_list_001",
  "initial": "loading",
  "states": {
    "loading": {
      "entry": [],
      "on": {
        "SUCCESS": "idle"
      }
    },
    "idle": {
      "on": {
        "CREATE_TODO": {
          "target": "creating",
          "guard": { "$ne": ["$newTodoText", ""] }
        },
        "TOGGLE_TODO": "toggling",
        "DELETE_TODO": "deleting"
      }
    },
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
              "tool": "@context/update",
              "payload": {
                "newTodoText": ""
              }
            }
          ]
        }
      }
    },
    "toggling": {
      "entry": {
        "tool": "@db",
        "payload": {
          "op": "toggle",
          "schema": "@schema/todos",
          "id": "$$event.payload.id",
          "field": "done"
        }
      },
      "on": {
        "SUCCESS": "idle"
      }
    },
    "deleting": {
      "entry": {
        "tool": "@db",
        "payload": {
          "op": "delete",
          "schema": "@schema/todos",
          "id": "$$event.payload.id"
        }
      },
      "on": {
        "SUCCESS": "idle"
      }
    }
  }
}
```

**What this does:**
- Handles user events (`CREATE_TODO`, `TOGGLE_TODO`, `DELETE_TODO`)
- Executes database operations via `@db` tool
- Updates form state (clear input after create)

### 3. View - Display Data

**`list.view.maia`:**

```json
{
  "$type": "view",
  "$id": "view_list_001",
  "container": {
    "tag": "div",
    "class": "todo-list",
    "children": [
      {
        "tag": "div",
        "class": "input-form",
        "children": [
          {
            "tag": "input",
            "attrs": {
              "type": "text",
              "placeholder": "What needs to be done?",
              "value": "$newTodoText"
            },
            "$on": {
              "input": {
                "tool": "@context/update",
                "payload": {
                  "newTodoText": "$$event.target.value"
                }
              }
            }
          },
          {
            "tag": "button",
            "text": "Add",
            "$on": {
              "click": { "send": "CREATE_TODO" }
            }
          }
        ]
      },
      {
        "tag": "ul",
        "class": "todo-items",
        "$each": {
          "items": "$todos",
          "template": {
            "tag": "li",
            "class": "todo-item",
            "children": [
              {
                "tag": "span",
                "text": "$$item.text",
                "class": {
                  "done": "$$item.done"
                }
              },
              {
                "tag": "button",
                "text": "✓",
                "$on": {
                  "click": {
                    "send": "TOGGLE_TODO",
                    "payload": { "id": "$$item.id" }
                  }
                }
              },
              {
                "tag": "button",
                "text": "✕",
                "$on": {
                  "click": {
                    "send": "DELETE_TODO",
                    "payload": { "id": "$$item.id" }
                  }
                }
              }
            ]
          }
        }
      }
    ]
  }
}
```

**What this does:**
- Renders input form (reads `$newTodoText`, sends `CREATE_TODO`)
- Renders todo list (loops over `$todos`)
- Renders buttons (sends `TOGGLE_TODO`, `DELETE_TODO`)

### 4. Actor - Compose It All

**`list.actor.maia`:**

```json
{
  "$type": "actor",
  "$id": "actor_list_001",
  "id": "actor_list_001",
  
  "contextRef": "list",
  "stateRef": "list",
  "viewRef": "list"
}
```

**That's it!** SubscriptionEngine handles all the reactivity automatically.

## Common Patterns

### Pattern 1: Multiple Filtered Views (Kanban Board)

**Context:**

```json
{
  "todosTodo": {
    "schema": "@schema/todos",
    "filter": { "done": false }
  },
  "todosDone": {
    "schema": "@schema/todos",
    "filter": { "done": true }
  }
}
```

**View:**

```json
{
  "container": {
    "tag": "div",
    "class": "kanban",
    "children": [
      {
        "tag": "div",
        "class": "column",
        "children": [
          { "tag": "h2", "text": "Todo" },
          {
            "$each": {
              "items": "$todosTodo",
              "template": {
                "tag": "div",
                "class": "card",
                "text": "$$item.text"
              }
            }
          }
        ]
      },
      {
        "tag": "div",
        "class": "column",
        "children": [
          { "tag": "h2", "text": "Done" },
          {
            "$each": {
              "items": "$todosDone",
              "template": {
                "tag": "div",
                "class": "card",
                "text": "$$item.text"
              }
            }
          }
        ]
      }
    ]
  }
}
```

**Result:** When you toggle a todo, it automatically moves from "Todo" to "Done" column!

### Pattern 2: Loading States

**Context:**

```json
{
  "todos": {
    "schema": "@schema/todos",
    "filter": null
  },
  "isLoading": true
}
```

**State Machine:**

```json
{
  "states": {
    "loading": {
      "entry": {
        "tool": "@context/update",
        "payload": { "isLoading": true }
      },
      "on": {
        "SUCCESS": {
          "target": "idle",
          "actions": [
            {
              "tool": "@context/update",
              "payload": { "isLoading": false }
            }
          ]
        }
      }
    }
  }
}
```

**View:**

```json
{
  "container": {
    "tag": "div",
    "children": [
      {
        "tag": "div",
        "text": "Loading...",
        "$if": "$isLoading"
      },
      {
        "tag": "ul",
        "$if": { "$not": "$isLoading" },
        "$each": {
          "items": "$todos",
          "template": { "tag": "li", "text": "$$item.text" }
        }
      }
    ]
  }
}
```

**Result:** Shows "Loading..." until data arrives, then shows the list!

### Pattern 3: Search/Filter

**Context:**

```json
{
  "todos": {
    "schema": "@schema/todos",
    "filter": null
  },
  "searchQuery": ""
}
```

**View (with client-side filtering):**

```json
{
  "container": {
    "tag": "div",
    "children": [
      {
        "tag": "input",
        "attrs": {
          "type": "search",
          "placeholder": "Search todos...",
          "value": "$searchQuery"
        },
        "$on": {
          "input": {
            "tool": "@context/update",
            "payload": {
              "searchQuery": "$$event.target.value"
            }
          }
        }
      },
      {
        "tag": "ul",
        "$each": {
          "items": {
            "$filter": {
              "items": "$todos",
              "condition": {
                "$contains": ["$$item.text", "$searchQuery"]
              }
            }
          },
          "template": {
            "tag": "li",
            "text": "$$item.text"
          }
        }
      }
    ]
  }
}
```

**Result:** As you type, the list filters in real-time!

## Troubleshooting

### My data isn't showing up!

**Checklist:**
1. Is your context query object correct?
   ```json
   { "schema": "@schema/todos", "filter": null }
   ```
2. Does the schema name match your database?
3. Is there actually data in the database? (Check IndexedDB in DevTools)
4. Are there errors in the console?

**Debug:**
- Open DevTools → Console
- Look for `[SubscriptionEngine]` logs
- Look for `[IndexedDBBackend]` logs
- Check: `✅ actor_list_001 → @schema/todos → $todos`

### My UI isn't updating when I create data!

**Checklist:**
1. Are you using the `@db` tool to create data?
   ```json
   { "tool": "@db", "payload": { "op": "create", ... } }
   ```
2. Is the `schema` in your create operation the same as in your context?
3. Are you seeing `🔄 actor_list_001.$todos updated` in console?

**Debug:**
- Check console for `[DBEngine]` logs
- Check console for `[SubscriptionEngine]` logs
- Verify the state machine transition completes (SUCCESS event)

### I'm seeing duplicate UI elements!

**Cause:** ViewEngine was appending to the shadow DOM without clearing it first.

**Fixed in v0.4+** - ViewEngine now clears `shadowRoot.innerHTML = ''` on every render.

**If you see this:** Update to latest MaiaOS version.

### Memory leaks - Subscriptions not cleaning up!

**Cause:** Old code wasn't properly unsubscribing when actors were destroyed.

**Fixed in v0.4+** - SubscriptionEngine automatically cleans up all subscriptions when an actor is destroyed.

**How it works:**
- Every subscription stores an unsubscribe function in `actor._subscriptions`
- When `destroyActor()` is called, SubscriptionEngine calls all unsubscribe functions
- No memory leaks! ✨

## Migration Path to CoJSON (Future)

The current architecture is designed to be **100% compatible** with CoJSON (our CRDT-based collaborative sync system).

**What will change:**
- Database backend: IndexedDB → CoJSON sync layer
- Schema references: `@schema/todos` → CoValue IDs
- Reactivity: Still automatic (CRDTs are reactive by default)

**What WON'T change:**
- Query object syntax (same format)
- Context declarations (same structure)
- State machines (same business logic)
- Views (same presentation code)
- Your application code!

**Migration steps (when we're ready):**
1. Replace `IndexedDBBackend` with `CoJSONBackend`
2. Update schema IDs to CoValue IDs
3. Done! Everything else works automatically

**You don't need to worry about this now** - just keep using the current system, and migration will be seamless.

## Best Practices

### ✅ DO:

1. **Declare data needs in context**
   ```json
   { "todos": { "schema": "@schema/todos", "filter": null } }
   ```

2. **Use filtered subscriptions for views that need subsets**
   ```json
   { "todosTodo": { "schema": "@schema/todos", "filter": { "done": false } } }
   ```

3. **Let SubscriptionEngine handle reactivity** (never manually update arrays)

4. **Use @db tool for all CRUD operations**
   ```json
   { "tool": "@db", "payload": { "op": "create", ... } }
   ```

5. **Keep state machines pure** (only transition rules and tool calls)

6. **Keep views pure** (only presentation, no logic)

7. **Check console logs** (SubscriptionEngine shows everything)

### ❌ DON'T:

1. **Don't manually update query object arrays**
   ```javascript
   // ❌ WRONG
   actor.context.todos.push(newTodo);
   ```

2. **Don't create custom subscription code** (SubscriptionEngine does it)

3. **Don't mix reactive and non-reactive data** (use query objects for data arrays)

4. **Don't put business logic in views** (state machines handle logic)

5. **Don't create subscriptions in state machines** (context-driven only)

6. **Don't bypass the @db tool** (always use it for data operations)

## Summary

### The Big Picture

1. **Context = What I Need** (Declarative query objects)
2. **SubscriptionEngine = The Watcher** (Automatic subscriptions)
3. **MaiaDB = The Data Store** (Reactive database)
4. **State Machines = Business Logic** (Pure transition rules)
5. **Views = Presentation** (Pure UI rendering)

### Key Concepts

- **Context-driven reactivity**: Your context IS your subscription blueprint
- **Automatic subscriptions**: SubscriptionEngine handles everything
- **@ references**: Future-proof symbolic IDs (ready for CoJSON)
- **Pure separation**: State machines (logic), Views (presentation), SubscriptionEngine (reactivity)
- **Centralized**: All reactivity in one place (SubscriptionEngine), no scattered code

### Remember

You **never manually manage subscriptions**. Just declare what data you need in context, and MaiaOS does the rest! ✨

## Next Steps

- Learn about [Engines](./04_engines.md) - How the system executes your definitions
- Understand [Tools](./08_tools.md) - Creating custom tools (like @db)
- Explore [CoJSON Integration](./07_cojson.md) - Future collaborative sync
- Read [Best Practices](../creators/10-best-practices.md) - Patterns and anti-patterns
