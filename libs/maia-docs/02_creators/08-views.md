# Views (UI Representation)

**Views** define the UI representation of an actor. They are declarative JSON structures that the ViewEngine renders to Shadow DOM.

## Philosophy

> Views are the EYES of an actor. They visualize context and capture user events.

- **Views** define WHAT to render (declarative, zero logic)
- **ViewEngine** handles HOW to render (imperative)
- **Context** provides the DATA to display
- **State Machine** computes all conditional values (no `$if` in views!)
- **CSS** handles conditional styling via data-attributes
- **Events** trigger state machine transitions

## View Definition

Create a file named `{name}.view.maia`:

```json
{
  "$schema": "@schema/view",
  "$id": "@view/todo",
  
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
        "$on": {
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

**Note:** `$schema` and `$id` use schema references (`@schema/view`, `@view/todo`) that are transformed to co-ids (`co_z...`) during seeding.

## Element Structure

```json
{
  "tag": "div",                    // HTML tag name
  "class": "my-class",             // CSS class (static or "$contextKey")
  "attrs": {...},                  // HTML attributes
  "text": "Static text",           // Text content
  "children": [...],               // Child elements
  "$on": {...},                    // Event handlers (use $on, not on)
  "$each": {...},                  // List rendering
  "$slot": "$contextKey"           // Actor composition (use $slot, not slot)
}
```

**Important:** Views contain **zero conditional logic**. All conditionals are handled by:
- **State Machine** → computes boolean flags → stores in context
- **View** → references context values → maps to data-attributes
- **CSS** → matches data-attributes → applies conditional styles

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
    "data-id": "$selectedId",           // From context
    "data": "$dragOverColumn"           // Maps to data-drag-over-column attribute
  }
}
```

### Data-Attribute Mapping

Data-attributes are the primary mechanism for conditional styling. The state machine computes values, and views map them to data-attributes:

**String Shorthand:**
```json
{
  "attrs": {
    "data": "$dragOverColumn"  // Maps to data-drag-over-column="todo"
  }
}
```

**Object Syntax (Multiple Attributes):**
```json
{
  "attrs": {
    "data": {
      "dragOver": "$dragOverColumn",
      "itemId": "$draggedItemId"
    }
  }
}
```

**Item Lookup Syntax (for `$each` loops):**
```json
{
  "$each": {
    "items": "$todos",
    "template": {
      "attrs": {
        "data": {
          "isDragged": "$draggedItemIds.$$id"  // Looks up draggedItemIds[item.id]
        }
      }
    }
  }
}
```

**How it works:**
1. State machine computes `draggedItemIds: { "item-123": true }` in context
2. View references `"$draggedItemIds.$$id"` for each item
3. ViewEngine looks up `draggedItemIds[item.id]` → sets `data-is-dragged="true"`
4. CSS matches `[data-is-dragged="true"]` → applies styles

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

## Event Handlers (`$on`)

**Note:** Always use `$on` (not `on`) for consistency with other DSL operations.

### Simple Event
```json
{
  "$on": {
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
  "$on": {
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
  "$on": {
    "click": {"send": "SELECT_ITEM", "payload": {"id": "$$id"}},
    "dblclick": {"send": "EDIT_ITEM", "payload": {"id": "$$id"}},
    "mouseover": {"send": "HOVER_ITEM", "payload": {"id": "$$id"}}
  }
}
```

### Input Events
```json
{
  "$on": {
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

## Conditional Styling (No `$if` in Views!)

**Views contain zero conditional logic.** All conditionals are handled by the state machine and CSS:

### Pattern: State Machine → Context → Data-Attributes → CSS

**1. State Machine computes boolean flags:**
```json
{
  "tool": "@context/update",
  "payload": {
    "listButtonActive": {"$eq": ["$$viewMode", "list"]},
    "kanbanButtonActive": {"$eq": ["$$viewMode", "kanban"]}
  }
}
```

**2. View references context values:**
```json
{
  "tag": "button",
  "class": "button-view-switch",
  "attrs": {
    "data": "$listButtonActive"  // Simple context reference
  }
}
```

**3. CSS matches data-attributes:**
```json
{
  "buttonViewSwitch": {
    "data": {
      "listButtonActive": {
        "true": {
          "background": "{colors.primary}",
          "color": "white"
        }
      }
    }
  }
}
```

**Result:** Button automatically styles when `listButtonActive` is `true` - no template conditionals needed!

## List Rendering (`$each`)

### Basic List
```json
{
  "$each": {
    "items": "$todos",
    "template": {
      "tag": "li",
      "text": "$$text",
      "attrs": {"data-id": "$$id"}
    }
  }
}
```

**Note:** Inside `$each` templates:
- `$$fieldName` accesses item properties (e.g., `$$id`, `$$text`)
- `$fieldName` accesses actor context (e.g., `$viewMode`, `$draggedItemId`)

### List with Events
```json
{
  "$each": {
    "items": "$todos",
    "template": {
      "tag": "button",
      "text": "$$text",
      "$on": {
        "click": {
          "send": "DELETE_TODO",
          "payload": {"id": "$$id"}
        }
      }
    }
  }
}
```

### List with Item-Specific Data-Attributes

For item-specific conditional styling, use item lookup syntax:

```json
{
  "$each": {
    "items": "$todos",
    "template": {
      "tag": "div",
      "class": "card",
      "attrs": {
        "data-id": "$$id",
        "data": {
          "isDragged": "$draggedItemIds.$$id"  // Looks up draggedItemIds[item.id]
        }
      }
    }
  }
}
```

**How it works:**
1. State machine maintains `draggedItemIds: { "item-123": true }` in context
2. For each item, ViewEngine evaluates `draggedItemIds[item.id]`
3. If found, sets `data-is-dragged="true"` on that item's element
4. CSS matches `[data-is-dragged="true"]` → applies dragging styles

### Nested Lists
```json
{
  "$each": {
    "items": "$categories",
    "template": {
      "tag": "div",
      "children": [
        {
          "tag": "h2",
          "text": "$$name"
        },
        {
          "$each": {
            "items": "$$items",
            "template": {
              "tag": "li",
              "text": "$$title"
            }
          }
        }
      ]
    }
  }
}
```

## Actor Composition (`$slot`)

Use `$slot` to compose child actors into parent views. The state machine sets the context value, and the view renders the appropriate child actor.

**Note:** Always use `$slot` (not `slot`) for consistency with other DSL operations.

### Basic Slot
```json
{
  "tag": "main",
  "class": "content-area",
  "$slot": "$currentView"  // Renders child actor referenced by context.currentView
}
```

**How it works:**
1. State machine sets `currentView: "@list"` or `currentView: "@kanban"` in context
2. ViewEngine resolves `@list` → finds child actor with name `list`
3. Attaches child actor's container to the slot element

### Slot with Wrapper Styling
```json
{
  "tag": "main",
  "class": "content-area",
  "attrs": {
    "data-view": "$viewMode"
  },
  "$slot": "$currentView"
}
```

The wrapper element (with tag, class, attrs) wraps the child actor, allowing you to style the container.

## Drag and Drop

### Draggable Element with Data-Attributes
```json
{
  "$each": {
    "items": "$todos",
    "template": {
      "tag": "div",
      "class": "card",
      "attrs": {
        "draggable": true,
        "data-id": "$$id",
        "data": {
          "isDragged": "$draggedItemIds.$$id"  // Conditional styling via CSS
        }
      },
      "$on": {
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
  }
}
```

### Drop Zone with Data-Attributes
```json
{
  "tag": "div",
  "class": "kanban-column-content",
  "attrs": {
    "data-column": "todo",
    "data": "$dragOverColumn"  // Maps to data-drag-over-column for CSS styling
  },
  "$on": {
    "dragover": {
      "send": "DRAG_OVER",
      "payload": {}
    },
    "drop": {
      "send": "DROP",
      "payload": {"schema": "todos", "field": "done", "value": false}
    },
    "dragenter": {
      "send": "DRAG_ENTER",
      "payload": {"column": "@dataColumn"}
    },
    "dragleave": {
      "send": "DRAG_LEAVE",
      "payload": {"column": "@dataColumn"}
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
    "class": "todo-app",
    "children": [
      {
        "tag": "div",
        "class": "header",
        "children": [
          {
            "tag": "h1",
            "text": "My Todos"
          },
          {
            "tag": "div",
            "class": "input-row",
            "children": [
              {
                "tag": "input",
                "class": "input",
                "attrs": {
                  "type": "text",
                  "placeholder": "What needs to be done?"
                },
                "value": "$newTodoText",
                "$on": {
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
                "class": "button",
                "text": "Add",
                "$on": {
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
        "class": "todos-list",
        "$each": {
          "items": "$todosTodo",
          "template": {
            "tag": "div",
            "class": "card",
            "attrs": {
              "data-id": "$$id",
              "data-done": "$$done",
              "data": {
                "isDragged": "$draggedItemIds.$$id"
              }
            },
            "children": [
              {
                "tag": "span",
                "class": "body",
                "text": "$$text"
              },
              {
                "tag": "button",
                "class": "button-small",
                "text": "✓",
                "$on": {
                  "click": {
                    "send": "TOGGLE_TODO",
                    "payload": {"id": "$$id"}
                  }
                }
              },
              {
                "tag": "button",
                "class": "button-small button-danger",
                "text": "✕",
                "$on": {
                  "click": {
                    "send": "DELETE_TODO",
                    "payload": {"id": "$$id"}
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

**Key patterns:**
- ✅ Uses `$each` for list rendering
- ✅ Uses `$on` for event handlers
- ✅ Uses `data` attribute mapping for conditional styling
- ✅ Uses `$draggedItemIds.$$id` for item-specific lookups
- ✅ No `$if` conditionals - all handled by state machine + CSS

## View Best Practices

### ✅ DO:

- **Keep views declarative** - Zero logic, only structure
- **Use semantic HTML** - `<button>` not `<div onclick>`
- **Structure hierarchically** - Logical parent-child relationships
- **Use clear event names** - `CREATE_TODO` not `submit` or `click`
- **Use data-attributes for styling** - State machine computes, CSS styles
- **Use `$each` for lists** - Don't manually duplicate structures
- **Use `$on` for events** - Consistent with other DSL operations
- **Use `$slot` for composition** - Consistent with other DSL operations
- **Reference context values directly** - `"data": "$listButtonActive"`

### ❌ DON'T:

- **Don't use `$if` in views** - All conditionals handled by state machine + CSS
- **Don't put logic in views** - Use state machines to compute boolean flags
- **Don't hardcode data** - Use context references
- **Don't duplicate structures** - Use `$each` loops
- **Don't use `on` (use `$on`)** - Maintain DSL consistency
- **Don't use `slot` (use `$slot`)** - Maintain DSL consistency
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
{"data": "$listButtonActive"}     // Maps to data-list-button-active attribute
```

### Item References (`$$`) (in `$each` loops)
```json
{"text": "$$text"}                // item.text
{"data-id": "$$id"}               // item.id
```

### Item Lookup Syntax (`$contextObject.$$itemKey`)
```json
{"data": {"isDragged": "$draggedItemIds.$$id"}}  // Looks up draggedItemIds[item.id]
```

**How it works:**
- `$draggedItemIds` → context object `{ "item-123": true, "item-456": false }`
- `$$id` → current item's ID (e.g., `"item-123"`)
- ViewEngine evaluates `draggedItemIds["item-123"]` → `true`
- Sets `data-is-dragged="true"` on element

### Special Event Values (`@`)
```json
{"payload": {"text": "@inputValue"}}     // input.value
{"payload": {"checked": "@checked"}}      // input.checked
{"payload": {"column": "@dataColumn"}}   // element.getAttribute("data-column")
```

## Allowed Operations

Views support only these operations:

| Operation | Syntax | Purpose |
|-----------|--------|---------|
| `$each` | `{"$each": {"items": "$todos", "template": {...}}}` | List rendering |
| `$on` | `{"$on": {"click": {...}}}` | Event handlers |
| `$slot` | `{"$slot": "$currentView"}` | Actor composition |
| `$contextKey` | `"$viewMode"`, `"$$id"` | Variable references |

**Removed Operations:**
- ❌ `$if` - Use state machine + data-attributes + CSS instead
- ❌ `slot` - Migrated to `$slot` for consistency
- ❌ `on` - Migrated to `$on` for consistency

## Next Steps

- Learn about [State Machines](./05-state.md) - How views trigger events
- Explore [Context](./04-context.md) - What views display
- Understand [Brand](./08-brand.md) - Design system for views
- Read [Style](./09-style.md) - Additional styling
