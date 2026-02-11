      "attrs": {"data-id": "$$id"}
    }
  }
}
```

**Note:** Inside `$each` templates:
- `$$fieldName` accesses item properties (e.g., `$$id`, `$$text`, `$$fromRole`, `$$toRole`)
- `$fieldName` accesses actor context (e.g., `$viewMode`, `$draggedItemId`, `$toggleButtonText`)

**Generic Template Variables:**
When using map transformations in query objects, use generic placeholder names that fit your view template slots:
- `$$fromRole`, `$$toRole` - For log entries (generic "from/to" perspective)
- `$$fromId`, `$$toId` - For log entry IDs
- `$$itemText`, `$$itemId` - For list items (generic item properties)

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
  
  "content": {
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
