5. Your view subscribes to context ReactiveStore and re-renders automatically

**Think of it like:** Subscribing to a newsletter - you tell them what you want, they send you updates automatically. The universal `read()` API is like the subscription service - every CoValue becomes a reactive store you can subscribe to.

**Behind the scenes:** Query objects are just a convenient way to declare queries. They use the universal `read()` API internally, which:
1. Reads from persisted CoValue (single source of truth)
2. Returns a ReactiveStore (reactive access layer)
3. Automatically keeps your context updated when CoValue changes
4. **No in-memory mutation hacks** - everything goes through persisted CoValues

**Examples:**

```json
{
  "context": {
    // All todos (no filter)
    "todos": {
      "schema": "@schema/todos",
      "filter": null
    },
    
    // Only incomplete todos
    "todosTodo": {
      "schema": "@schema/todos",
      "filter": { "done": false }
    },
    
    // Only completed todos
    "todosDone": {
      "schema": "@schema/todos",
      "filter": { "done": true }
    }
  }
}
```

**When to use:**
- ✅ When you need data from the database
- ✅ When you want automatic updates
- ✅ When data can change (todos, notes, messages, etc.)

**Best practices:**
- Use descriptive names (`todosTodo`, not `t1`)
- Use filters to get only what you need
- Don't manually update these arrays (MaiaOS does it automatically)
- Use generic reusable names that fit your view template slots (e.g., `list` for list views, `messages` for message logs)

See [Reactive Data System](../developers/06_reactive-queries.md) for detailed examples.

#### Map Transformations in Query Objects ⭐ PRIMARY PATTERN

**CRITICAL:** Map transformations are defined **directly in context query objects** using the `options.map` syntax. This is the **PRIMARY and RECOMMENDED** pattern for data transformations.

**Map transformations** let you reshape data when reading it. Think of it like a translator - you take data in one format and transform it into the format your views need.

**Format (in context file):**
```json
{
  "messages": {
    "schema": "@schema/message",
    "options": {
      "map": {
        "fromRole": "$$source.@label",
        "toRole": "$$target.@label",
        "fromId": "$$source.id",
        "toId": "$$target.id"
      }
    }
  }
}
```

**What this means:** "Give me all messages, but transform each item so that `source.@label` becomes `fromRole`, `target.@label` becomes `toRole`, etc."

**Key Rules:**
- ✅ **Strict `$$` syntax required** - All map expressions MUST use `$$` prefix (e.g., `$$source.@label`, not `source.@label`)
- ✅ **Generic placeholder names** - Use reusable names that fit your view template slots (e.g., `fromRole`, `toRole`, `fromId`, `toId` for log entries)
- ✅ **Works with any property path** - You can map nested properties like `$$nested.deep.property`

**Example: Log View with Generic Placeholders**

**Context:**
```json
{
  "messages": {
    "schema": "@schema/message",
    "options": {
      "map": {
        "fromRole": "$$source.@label",
        "toRole": "$$target.@label",
        "fromId": "$$source.id",
        "toId": "$$target.id"
      }
    }
  },
  "payloadLabel": "payload"
}
```

**View:**
```json
{
  "$each": {
    "items": "$messages",
    "template": {
      "tag": "div",
      "children": [
        {
          "tag": "span",
          "text": "$$fromRole"
        },
        {
          "tag": "span",
          "text": "$$toRole"
        },
        {
          "tag": "summary",
          "text": "$payloadLabel"
        }
      ]
    }
  }
}
```

**Why this pattern?**
- ✅ **Generic reusable names** - `fromRole`/`toRole` work for any log entry, not just messages
- ✅ **No hardcoded strings** - `payloadLabel` is extracted to context variable
- ✅ **Consistent template slots** - View template variables match context keys
- ✅ **Strict syntax** - `$$` prefix ensures consistency with MaiaScript expressions

**Common Patterns:**

**1. Flattening nested structures:**
```json
{
  "list": {
    "schema": "@schema/todos",
    "options": {
      "map": {
        "authorName": "$$author.name",
        "authorEmail": "$$author.email"
      }
    }
  }
}
```

**2. Renaming for generic template slots:**
```json
{
  "list": {
    "schema": "@schema/todos",
    "options": {
      "map": {
        "itemText": "$$text",
        "itemId": "$$id",
        "isComplete": "$$done"
      }
    }
  }
}
```

**3. Combining with filters:**
```json
{
  "messages": {
    "schema": "@schema/message",
    "options": {
      "filter": { "type": "notification" },
      "map": {
        "fromRole": "$$source.@label",
        "toRole": "$$target.@label"
      }
    }
  }
}
```

**Best Practices:**
- ✅ Use generic placeholder names (`fromRole`, `toRole`, `list`, `messages`) that fit your view template slots
- ✅ Extract hardcoded strings to context variables (`payloadLabel`, `toggleButtonText`, etc.)
- ✅ Always use strict `$$` syntax in map expressions
- ✅ Keep mapped property names consistent across your app
- ✅ Use descriptive names that indicate the perspective (e.g., `fromRole`/`toRole` for log entries)

### 2. Collections (Arrays)
Static array data (not reactive):

```json
{
  "colors": ["red", "green", "blue"],
  "options": ["option1", "option2"]
}
```

**When to use:**
- Static configuration data
- Hardcoded options (not from database)
- Local temporary collections

**Best practices:**
- Use query objects for database data (reactive)
- Use arrays for static/local data only
- Keep entities flat when possible

### 3. UI State
View-related state:

```json
{
  "viewMode": "list",           // "list" | "kanban" | "grid"
  "isModalOpen": false,
  "selectedId": null,
  "activeTab": "all"
}
```

### 4. Form State
Input field values:

```json
{
  "newTodoText": "",
  "searchQuery": "",
  "filterTerm": ""
}
```

### 5. Transient State
Temporary runtime data:

```json
{
  "draggedItemId": null,
  "hoveredItemId": null,
  "loadingState": "idle"
}
```

### 6. Computed Boolean Flags
State machine computes boolean flags for conditional styling (no `$if` in views!):

```json
{
  "listButtonActive": true,        // Computed: viewMode === "list"
  "kanbanButtonActive": false,     // Computed: viewMode === "kanban"
  "isModalOpen": false             // Computed: modalState === "open"
}
```

**Pattern:** State machine computes → Context stores → View references → CSS styles

### 7. Item Lookup Objects
For item-specific conditional styling in lists:

```json
{
  "draggedItemIds": {              // Object mapping item IDs to boolean states
    "item-123": true,              // This item is being dragged
    "item-456": false              // This item is not being dragged
  },
  "selectedItemIds": {             // Multiple selections
    "item-123": true,
    "item-789": true
  }
}
```

**Pattern:** State machine maintains lookup object → View uses `"$draggedItemIds.$$id"` → ViewEngine looks up value → CSS styles

## Accessing Context

### From State Machines
Use `$` prefix to reference context fields:

```json
{
  "payload": {
    "text": "$newTodoText",
    "mode": "$viewMode"
  }
}
```

**Note:** Guards are schema-based and validate against state/context conditions only. Payload validation happens in ActorEngine via message type schemas before messages reach the state machine.

### From Views
Use `$` prefix in expressions:

```json
{
  "tag": "input",
  "attrs": {
    "value": "$newTodoText",
    "placeholder": "What needs to be done?"
  }
}
```
