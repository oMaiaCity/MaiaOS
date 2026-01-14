# Views (UI Representation)

**Views** define the UI representation of an actor. They are declarative JSON structures that the ViewEngine renders to Shadow DOM.

## Philosophy

> Views are the EYES of an actor. They visualize context and capture user events.

- **Views** define WHAT to render (declarative)
- **ViewEngine** handles HOW to render (imperative)
- **Context** provides the DATA to display
- **Events** trigger state machine transitions

## View Definition

Create a file named `{name}.view.maia`:

```json
{
  "$type": "view",
  "$id": "view_todo_001",
  
  "root": {
    "tag": "div",
    "attrs": {
      "class": "todo-app"
    },
    "children": [
      {
        "tag": "h1",
        "text": "My Todos"
      },
      {
        "tag": "input",
        "attrs": {
          "type": "text",
          "value": "$newTodoText",
          "placeholder": "What needs to be done?"
        },
        "on": {
          "input": {
            "send": "UPDATE_INPUT",
            "payload": {"newTodoText": "@inputValue"}
          },
          "keydown": {
            "send": "CREATE_TODO",
            "key": "Enter"
          }
        }
      }
    ]
  }
}
```

## Element Structure

```json
{
  "tag": "div",                    // HTML tag name
  "attrs": {...},                  // HTML attributes
  "text": "Static text",           // Text content
  "children": [...],               // Child elements
  "on": {...},                     // Event handlers
  "if": "$condition",              // Conditional rendering
  "for": "$items",                 // List rendering
  "forItem": "item"                // Iterator variable name
}
```

## HTML Tags

All standard HTML tags are supported:

```json
{"tag": "div"}
{"tag": "span"}
{"tag": "button"}
{"tag": "input"}
{"tag": "textarea"}
{"tag": "select"}
{"tag": "ul"}
{"tag": "li"}
{"tag": "h1"}
{"tag": "p"}
{"tag": "a"}
{"tag": "img"}
```

## Attributes

### Static Attributes
```json
{
  "attrs": {
    "class": "btn btn-primary",
    "id": "submit-button",
    "type": "submit",
    "disabled": true
  }
}
```

### Dynamic Attributes (Context)
```json
{
  "attrs": {
    "value": "$newTodoText",           // From context
    "class": "$viewMode",               // From context
    "data-id": "$selectedId"            // From context
  }
}
```

### Special Attributes
```json
{
  "attrs": {
    "draggable": true,
    "contenteditable": true,
    "data-*": "custom data",
    "aria-label": "Accessibility label"
  }
}
```

## Text Content

### Static Text
```json
{
  "tag": "h1",
  "text": "Welcome to MaiaOS"
}
```

### Dynamic Text (Context)
```json
{
  "tag": "span",
  "text": "$userName"                  // From context.userName
}
```

### Interpolated Text
```json
{
  "tag": "p",
  "text": "You have $todosCount tasks"  // Evaluates context.todosCount
}
```

## Event Handlers

### Simple Event
```json
{
  "on": {
    "click": {
      "send": "DELETE_TODO",
      "payload": {"id": "$$id"}
    }
  }
}
```

### Event with Key Filter
```json
{
  "on": {
    "keydown": {
      "send": "CREATE_TODO",
      "key": "Enter"
    }
  }
}
```

### Multiple Events
```json
{
  "on": {
    "click": {"send": "SELECT_ITEM", "payload": {"id": "$$id"}},
    "dblclick": {"send": "EDIT_ITEM", "payload": {"id": "$$id"}},
    "mouseover": {"send": "HOVER_ITEM", "payload": {"id": "$$id"}}
  }
}
```

### Input Events
```json
{
  "on": {
    "input": {
      "send": "UPDATE_INPUT",
      "payload": {"newTodoText": "@inputValue"}
    }
  }
}
```

**Special payload values:**
- `@inputValue` - Input element value
- `@checked` - Checkbox/radio checked state
- `@selectedValue` - Select element value

## Conditional Rendering

### Simple Condition
```json
{
  "tag": "div",
  "if": "$isModalOpen",
  "children": [...]
}
```

### Comparison Condition
```json
{
  "tag": "div",
  "if": {"$eq": ["$viewMode", "kanban"]},
  "children": [...]
}
```

### Multiple Conditions
```json
{
  "tag": "div",
  "if": {
    "$and": [
      {"$ne": ["$selectedId", null]},
      {"$eq": ["$editMode", true]}
    ]
  },
  "children": [...]
}
```

## List Rendering

### Basic List
```json
{
  "tag": "ul",
  "for": "$todos",
  "forItem": "todo",
  "children": [
    {
      "tag": "li",
      "text": "$$text",
      "attrs": {"data-id": "$$id"}
    }
  ]
}
```

**Note:** Inside `for` loops:
- `$$fieldName` accesses item properties
- `$fieldName` accesses actor context

### List with Events
```json
{
  "tag": "div",
  "for": "$todos",
  "forItem": "todo",
  "children": [
    {
      "tag": "button",
      "text": "$$text",
      "on": {
        "click": {
          "send": "DELETE_TODO",
          "payload": {"id": "$$id"}
        }
      }
    }
  ]
}
```

### Nested Lists
```json
{
  "tag": "div",
  "for": "$categories",
  "forItem": "category",
  "children": [
    {
      "tag": "h2",
      "text": "$$name"
    },
    {
      "tag": "ul",
      "for": "$$items",
      "forItem": "item",
      "children": [
        {
          "tag": "li",
          "text": "$$title"
        }
      ]
    }
  ]
}
```

## Drag and Drop

### Draggable Element
```json
{
  "tag": "div",
  "attrs": {
    "draggable": true,
    "data-id": "$$id"
  },
  "on": {
    "dragstart": {
      "send": "DRAG_START",
      "payload": {"schema": "todos", "id": "$$id"}
    },
    "dragend": {
      "send": "DRAG_END",
      "payload": {}
    }
  }
}
```

### Drop Zone
```json
{
  "tag": "div",
  "attrs": {
    "class": "dropzone"
  },
  "on": {
    "dragover": {
      "send": "DRAG_OVER",
      "payload": {}
    },
    "drop": {
      "send": "DROP",
      "payload": {"schema": "todos", "field": "done", "value": true}
    },
    "dragenter": {
      "send": "DRAG_ENTER",
      "payload": {}
    },
    "dragleave": {
      "send": "DRAG_LEAVE",
      "payload": {}
    }
  }
}
```

## Complete Example: Todo View

```json
{
  "$type": "view",
  "$id": "view_todo_001",
  
  "root": {
    "tag": "div",
    "attrs": {"class": "todo-app"},
    "children": [
      {
        "tag": "div",
        "attrs": {"class": "header"},
        "children": [
          {
            "tag": "h1",
            "text": "My Todos"
          },
          {
            "tag": "div",
            "attrs": {"class": "input-row"},
            "children": [
              {
                "tag": "input",
                "attrs": {
                  "type": "text",
                  "value": "$newTodoText",
                  "placeholder": "What needs to be done?"
                },
                "on": {
                  "input": {
                    "send": "UPDATE_INPUT",
                    "payload": {"newTodoText": "@inputValue"}
                  },
                  "keydown": {
                    "send": "CREATE_TODO",
                    "key": "Enter"
                  }
                }
              },
              {
                "tag": "button",
                "text": "Add",
                "on": {
                  "click": {
                    "send": "CREATE_TODO",
                    "payload": {}
                  }
                }
              }
            ]
          }
        ]
      },
      {
        "tag": "div",
        "attrs": {"class": "todos-list"},
        "for": "$todosTodo",
        "forItem": "todo",
        "children": [
          {
            "tag": "div",
            "attrs": {
              "class": "todo-item",
              "data-id": "$$id"
            },
            "children": [
              {
                "tag": "input",
                "attrs": {
                  "type": "checkbox",
                  "checked": "$$done"
                },
                "on": {
                  "change": {
                    "send": "TOGGLE_TODO",
                    "payload": {"id": "$$id"}
                  }
                }
              },
              {
                "tag": "span",
                "text": "$$text"
              },
              {
                "tag": "button",
                "text": "×",
                "attrs": {"class": "delete-btn"},
                "on": {
                  "click": {
                    "send": "DELETE_TODO",
                    "payload": {"id": "$$id"}
                  }
                }
              }
            ]
          }
        ]
      }
    ]
  }
}
```

## View Best Practices

### ✅ DO:

- **Keep views declarative** - No logic, only structure
- **Use semantic HTML** - `<button>` not `<div onclick>`
- **Structure hierarchically** - Logical parent-child relationships
- **Use clear event names** - `CREATE_TODO` not `submit` or `click`
- **Leverage conditional rendering** - Show/hide based on context
- **Use list rendering** - Don't manually duplicate structures

### ❌ DON'T:

- **Don't put logic in views** - Use state machines
- **Don't hardcode data** - Use context references
- **Don't duplicate structures** - Use `for` loops
- **Don't create deep nesting** - Extract to sub-views (future feature)
- **Don't mix concerns** - Separate layout from data

## Shadow DOM Isolation

Each actor renders into its own Shadow DOM:

```html
<div id="actor-todo">
  #shadow-root (open)
    <style>/* Actor styles */</style>
    <div class="todo-app">
      <!-- View rendered here -->
    </div>
</div>
```

**Benefits:**
- ✅ Style isolation (no CSS leakage)
- ✅ DOM encapsulation (clean inspector)
- ✅ Multiple instances (no ID conflicts)

## Accessing DOM Elements

Views are rendered to Shadow DOM, accessible via:

```javascript
// Get shadow root
const shadowRoot = actor.container.shadowRoot;

// Query elements
const input = shadowRoot.querySelector('input');
const buttons = shadowRoot.querySelectorAll('button');

// Inspect in DevTools
// Click actor container → Expand #shadow-root
```

## View Debugging

```javascript
// Expose actor globally
window.actor = actor;

// Inspect view definition
console.log(actor.viewDef);

// Trigger manual re-render
actor.actorEngine.rerender(actor);

// Log events
const originalSend = actor.actorEngine.stateEngine.send;
actor.actorEngine.stateEngine.send = function(machineId, event, payload) {
  console.log('Event sent:', event, payload);
  return originalSend.call(this, machineId, event, payload);
};
```

## Expression Syntax

### Context References (`$`)
```json
{"value": "$newTodoText"}        // context.newTodoText
{"class": "$viewMode"}            // context.viewMode
```

### Item References (`$$`) (in `for` loops)
```json
{"text": "$$text"}                // item.text
{"data-id": "$$id"}               // item.id
```

### Special Event Values (`@`)
```json
{"payload": {"text": "@inputValue"}}     // input.value
{"payload": {"checked": "@checked"}}      // input.checked
```

## Next Steps

- Learn about [State Machines](./05-state.md) - How views trigger events
- Explore [Context](./04-context.md) - What views display
- Understand [Brand](./08-brand.md) - Design system for views
- Read [Style](./09-style.md) - Additional styling
