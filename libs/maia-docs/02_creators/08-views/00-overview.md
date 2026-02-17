# Views (UI Representation)

**Views** define the UI representation of an actor. They are declarative JSON structures that the ViewEngine renders to Shadow DOM.

## Philosophy

> Views are the EYES of an actor. They visualize context and capture user events.

**CRITICAL ARCHITECTURE:**
- **Templates are "dumb"** - Pure declarative structure, zero logic, zero conditionals
- **State Machines define the state** - All logic, computation, and state transitions happen here
- **Context is the realtime reactive snapshot** - The current reflection of state, automatically updated when state changes
- **ViewEngine** handles HOW to render (imperative)
- **CSS** handles conditional styling via data-attributes (no `$if` in views!)
- **Events** trigger state machine transitions

**The Flow:**
```
State Machine (defines state) 
  ↓
Updates Context (realtime reactive snapshot)
  ↓
View Template (dumb, just renders context)
  ↓
CSS (handles conditional styling via data-attributes)
```

## View Definition

Create a file named `{name}.view.maia`:

```json
{
  "$schema": "@schema/view",
  "$id": "@view/todo",
  
  "content": {
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

**CRITICAL:** Views are **"dumb" templates** - they contain **zero conditional logic**. All conditionals are handled by:
- **State Machine** → defines state, computes boolean flags → stores in context
- **Context** → realtime reactive snapshot of current state reflection
- **View** → dumb template, just references context values → maps to data-attributes
- **CSS** → matches data-attributes → applies conditional styles

**Remember:** Templates don't think, they just render. State machines think. Context reflects.

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

### Universal Input+Submit Pattern

Use this canonical pattern for input fields with a submit button. Both Enter key and button click must use `@inputValue` (DOM at event time), not context (`$field`):

```json
{
  "tag": "input",
  "value": "$fieldName",
  "$on": {
    "input": { "send": "UPDATE_INPUT", "payload": { "value": "@inputValue" } },
    "keydown": { "send": "SUBMIT_EVENT", "payload": { "value": "@inputValue" }, "key": "Enter" }
  }
},
{
  "tag": "button",
  "attrs": { "type": "button" },
  "text": "Submit",
  "$on": { "click": { "send": "SUBMIT_EVENT", "payload": { "value": "@inputValue" } } }
}
```

- `SUBMIT_EVENT` = CREATE_BUTTON | SEND_MESSAGE | ADD_AGENT (vibe-specific)
- `value` = generic key; some schemas use `inputText` or `agentId`
- `type="button"` = prevents accidental form submit
- Always use `@inputValue` for the button payload; `$fieldName` can be stale when clicked

## Conditional Styling (No Conditional Logic in Views!)

**CRITICAL:** Views are **"dumb" templates** - they contain **zero conditional logic**. All conditionals are handled by the state machine and CSS:

**Architecture:**
- **State Machine** → Defines state, computes boolean flags and lookup objects
- **Context** → Realtime reactive snapshot of current state reflection  
- **View Template** → Dumb, just references context → maps to data-attributes
- **CSS** → Handles conditional styling via data-attributes

**What Views CAN Do:**
- ✅ Resolve simple context references: `$key`, `$$key`
- ✅ Extract DOM values: `@inputValue`, `@dataColumn`
- ✅ Send events with resolved payloads

**What Views CANNOT Do:**
- ❌ Conditional logic: `$if`, `$eq`, `$ne`, `$and`, `$or`, ternary operators (`? :`)
- ❌ State changes: Views never update context directly
- ❌ Complex expressions: Only simple data resolution allowed

### Pattern: State Machine → Context → Data-Attributes → CSS

**1. State Machine computes boolean flags:**
```json
{
  "updateContext": {
    "listButtonActive": {"$eq": ["$$viewMode", "list"]},
    "kanbanButtonActive": {"$eq": ["$$viewMode", "kanban"]}
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
