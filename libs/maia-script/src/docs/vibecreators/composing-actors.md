# Composing Actors

**Learn how to build composable UIs with MaiaOS actors.**

## What is Composition?

**Composition** is combining smaller actors into larger, more complex actors. Think of it like building with LEGO blocks - you combine simple pieces to create complex structures.

## Two Types of Actors

### Leaf Actors

**Leaf actors** are terminal components - they don't contain other actors. They render UI directly.

**Example: `todo_input.actor.maia`**
```json
{
  "$type": "actor",
  "$id": "actor_todo_input_001",
  "viewRef": "todo_input",
  "stateRef": "todo_input"
}
```

**Leaf View: `todo_input.view.maia`**
```json
{
  "$type": "view",
  "root": {
    "tag": "div",
    "children": [
      {
        "tag": "input",
        "value": "$newTodoText"
      },
      {
        "tag": "button",
        "text": "Add",
        "$on": {
          "click": {
            "send": "CREATE_TODO"
          }
        }
      }
    ]
  }
}
```

### Composite Actors

**Composite actors** are containers that hold other actors in slots.

**Example: `vibe_root.actor.maia`**
```json
{
  "$type": "actor",
  "$id": "actor_vibe_root_001",
  "viewRef": "vibe_root",
  "children": {
    "header": "actor_view_switcher_001",
    "input": "actor_todo_input_001",
    "list": "actor_todo_list_001"
  }
}
```

**Composite View: `vibe_root.view.maia`**
```json
{
  "$type": "view",
  "container": {
    "tag": "div",
    "class": "app-layout",
    "slots": {
      "header": "@header",
      "input": "@input",
      "list": "@list"
    }
  }
}
```

## How Slots Work

**Slots** are placeholders where child actors get rendered.

**Syntax:**
- Use `@slotName` to reference a child actor
- Slot name must match a key in `children` map

**Example:**
```json
{
  "children": {
    "header": "actor_header_001"    // ← Slot name: "header"
  },
  "container": {
    "slots": {
      "header": "@header"            // ← References slot "header"
    }
  }
}
```

## Building a Composable App

### Step 1: Identify Components

Break your UI into logical pieces:
- Header with navigation
- Input form
- List of items
- Footer

### Step 2: Create Leaf Actors

Create one actor for each piece:

**`header.actor.maia`** - Navigation bar
**`input.actor.maia`** - Form input
**`list.actor.maia`** - Item list
**`footer.actor.maia`** - Footer

### Step 3: Create Composite Root

Create a root actor that composes all pieces:

**`app.actor.maia`**
```json
{
  "$type": "actor",
  "$id": "actor_app_001",
  "viewRef": "app",
  "children": {
    "header": "actor_header_001",
    "input": "actor_input_001",
    "list": "actor_list_001",
    "footer": "actor_footer_001"
  }
}
```

**`app.view.maia`**
```json
{
  "$type": "view",
  "container": {
    "tag": "div",
    "class": "app",
    "slots": {
      "header": "@header",
      "input": "@input",
      "list": "@list",
      "footer": "@footer"
    }
  }
}
```

## Message Passing Between Actors

Actors communicate via **messages**, not props.

### Define Interfaces

Create `actor.interface.maia` for each actor:

**`todo_input.interface.maia`**
```json
{
  "$type": "actor.interface",
  "publishes": {
    "TODO_CREATED": {
      "payload": { "id": "string", "text": "string" }
    }
  },
  "subscriptions": ["actor_todo_list_001"]
}
```

**`todo_list.interface.maia`**
```json
{
  "$type": "actor.interface",
  "inbox": {
    "TODO_CREATED": {
      "payload": { "id": "string", "text": "string" }
    }
  }
}
```

### Publish Messages

When an event happens, publish a message:

**In state machine:**
```json
{
  "states": {
    "creating": {
      "entry": {
        "tool": "@mutation/create",
        "payload": { "schema": "todos", "data": {...} }
      },
      "on": {
        "SUCCESS": {
          "target": "idle",
          "actions": [
            {
              "tool": "@core/publishMessage",
              "payload": {
                "type": "TODO_CREATED",
                "payload": { "id": "$id", "text": "$text" }
              }
            }
          ]
        }
      }
    }
  }
}
```

### Subscribe to Messages

Parent actors auto-subscribe to children:

```json
{
  "$type": "actor",
  "children": {
    "input": "actor_todo_input_001"
  },
  "subscriptions": ["actor_todo_input_001"]  // ← Auto-added
}
```

## Real Example: Todo App

**Structure:**
```
vibe_root (composite)
├── @header (view_switcher - leaf)
├── @input (todo_input - leaf)
├── @list (todo_list - composite)
│   └── @item (todo_item - leaf, repeated)
└── @kanban (kanban_view - leaf)
```

**Message Flow:**
1. User types in `todo_input` → publishes `CREATE_TODO`
2. `todo_list` receives `CREATE_TODO` → creates item
3. `todo_item` instances render in list
4. User clicks complete → `todo_item` publishes `TODO_COMPLETED`
5. `todo_list` receives → updates state
6. `vibe_root` receives → orchestrates view

## Best Practices

**✅ DO:**
- Keep actors small and focused
- Use clear slot names (`@header`, not `@h`)
- Define interfaces for all actors
- Publish messages for important events
- Keep context internal (don't expose)

**❌ DON'T:**
- Don't create giant monolithic actors
- Don't use prop drilling
- Don't skip interface definitions
- Don't expose context directly
- Don't create circular dependencies

## Common Patterns

### Layout Container
```json
{
  "container": {
    "slots": {
      "header": "@header",
      "main": "@main",
      "footer": "@footer"
    }
  }
}
```

### List with Items
```json
{
  "container": {
    "$each": {
      "items": "$todos",
      "template": {
        "slot": "@item"
      }
    }
  }
}
```

### Conditional Rendering
```json
{
  "container": {
    "slots": {
      "content": "$viewMode === 'list' ? '@list' : '@kanban'"
    }
  }
}
```

## Next Steps

- Read [Actors Guide](./02-actors.md) - Actor basics
- Read [State Machines](./05-state.md) - Behavior flow
- Read [Views](./07-views.md) - UI structure
