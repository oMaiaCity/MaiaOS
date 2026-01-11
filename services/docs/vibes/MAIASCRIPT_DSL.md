# MaiaScript DSL

**Secure JSON-Based Expression Language for MaiaOS**

---

## 🎯 Overview

**MaiaScript** is MaiaOS's secure expression language for runtime logic and data manipulation. It's a JSON-based DSL (Domain Specific Language) that replaces unsafe `eval()` and `new Function()` with a whitelist-based, sandboxed evaluation system.

### Key Characteristics

- **Pure JSON**: All expressions are JSON objects
- **No Code Execution**: No `eval()`, no `new Function()`, no script injection
- **Whitelist-Based**: Only registered operations allowed
- **Security-First**: Prototype pollution prevention, safe property access
- **Module-Based**: Extensible via pluggable modules
- **Engine-Integrated**: Used by ToolEngine, ViewEngine, factoryEngine

---

## 🔧 Where MaiaScript is Used

| Component | Usage | Example |
|-----------|-------|---------|
| **ToolEngine** | Payload evaluation | `{ name: 'context.newTodoText' }` → actual value |
| **ViewEngine** | Data bindings | `{ text: { $: 'item.name' } }` → rendered text |
| **factoryEngine** | Conditional templates | `{ $if: {...} }` → resolved structure |
| **queryEngine** | Query operations | `{ "$filter": {...} }` → filtered entities |
| **Actor configs** | Dynamic values | `{ endDate: { $toISOString: [...] } }` |

---

## 📐 Expression Syntax

### 1. Data Path Access

**String Paths** (shorthand):
```typescript
// In payloads or bindings
'context.newTodoText'      // → actor.context.newTodoText
'item.name'                // → item.name
'dependencies.content.context.viewMode'  // → nested access
```

**Explicit DSL Syntax**:
```json
{ "$": "context.newTodoText" }
{ "$": "item.status" }
{ "$": "dependencies.content.context.viewMode" }
```

**Allowed Roots**:
- `context.*` - Actor context properties
- `item.*` - Current foreach item
- `dependencies.*` - Actor dependencies

**Blocked Access** (security):
- `__proto__`
- `constructor`
- `prototype`
- Any property starting with `_` (internal)

### 2. Operations

MaiaScript operations are JSON objects with keys starting with `$`:

```json
{
  "$operationName": [arg1, arg2, ...]
}
```

---

## 🎨 Built-in Operations

### Data Access

#### `$` - Get Property
```json
{ "$": "item.name" }
{ "$": "context.newTodoText" }
```

#### `$get` - Get Property (explicit)
```json
{ "$get": "context.count" }
```

### Comparison

#### `$eq` - Equals
```json
{ "$eq": [{ "$": "item.status" }, "done"] }
{ "$eq": ["{{variant}}", "primary"] }
```

#### `$ne` - Not Equals
```json
{ "$ne": [{ "$": "item.status" }, "todo"] }
```

#### `$gt`, `$gte`, `$lt`, `$lte` - Numeric Comparison
```json
{ "$gt": [{ "$": "item.count" }, 5] }
{ "$lte": [{ "$": "item.priority" }, 3] }
```

### Logic

#### `$and` - Logical AND
```json
{
  "$and": [
    { "$eq": [{ "$": "item.status" }, "done"] },
    { "$gt": [{ "$": "item.priority" }, 5] }
  ]
}
```

#### `$or` - Logical OR
```json
{
  "$or": [
    { "$eq": [{ "$": "item.status" }, "done"] },
    { "$eq": [{ "$": "item.status" }, "archived"] }
  ]
}
```

#### `$not` - Logical NOT
```json
{ "$not": { "$": "context.isVisible" } }
```

### Control Flow

#### `$if` - Conditional
```json
{
  "$if": {
    "test": { "$eq": [{ "$": "item.status" }, "done"] },
    "then": "bg-green-100 text-green-700",
    "else": "bg-gray-100 text-gray-700"
  }
}
```

#### `$switch` - Multi-way Branch
```json
{
  "$switch": {
    "on": { "$": "item.status" },
    "cases": {
      "todo": "bg-slate-100",
      "in-progress": "bg-blue-100",
      "done": "bg-green-100"
    },
    "default": "bg-gray-100"
  }
}
```

### String Operations

#### `$concat` - Concatenate Strings
```json
{ "$concat": ["Hello ", { "$": "item.name" }, "!"] }
```

#### `$trim` - Trim Whitespace
```json
{ "$trim": { "$": "context.newTodoText" } }
```

### Date & Time

#### `$now` - Current Timestamp
```json
{ "$now": [] }
```

#### `$toISOString` - Format Date
```json
{
  "$toISOString": [
    { "$add": [{ "$now": [] }, 86400000] }  // Tomorrow
  ]
}
```

### Math

#### `$add` - Addition
```json
{ "$add": [{ "$": "item.count" }, 1] }
{ "$add": [{ "$now": [] }, { "$multiply": [7, 86400000] }] }  // +7 days
```

#### `$multiply` - Multiplication
```json
{ "$multiply": [7, 86400000] }  // 7 days in milliseconds
```

---

## 🔐 Security Model

### 1. Whitelist-Based Property Traversal

Only properties from allowed roots can be accessed:

```typescript
// ✅ ALLOWED
{ "$": "context.newTodoText" }
{ "$": "item.name" }
{ "$": "dependencies.content.context.viewMode" }

// ❌ BLOCKED (throws SecurityError)
{ "$": "__proto__.constructor" }
{ "$": "constructor.prototype" }
{ "$": "_internal.secretKey" }
```

### 2. Operation Whitelisting

Only registered operations can be used:

```typescript
// ✅ ALLOWED (registered in builtin module)
{ "$eq": [...] }
{ "$if": {...} }
{ "$toISOString": [...] }

// ❌ BLOCKED (not registered)
{ "$eval": "malicious code" }
{ "$require": "./secretFile" }
```

### 3. No Code Execution

MaiaScript expressions are **pure data**:

```typescript
// ✅ SAFE - Pure JSON expression
{
  "$if": {
    "test": { "$eq": [{ "$": "item.status" }, "done"] },
    "then": "✓",
    "else": ""
  }
}

// ❌ UNSAFE - Would be eval'd (NOT POSSIBLE in MaiaScript)
"new Function('return this.globalVar')"
"eval('alert(document.cookie)')"
```

### 4. Prototype Pollution Prevention

Built-in checks prevent prototype pollution attacks:

```typescript
// ❌ BLOCKED (security check)
{ "$": "context.__proto__.isAdmin" }
{ "$": "item.constructor.prototype" }

// ✅ ALLOWED (normal access)
{ "$": "context.user.isAdmin" }
```

---

## 🔌 Module System

MaiaScript operations are organized into modules:

### Module Structure

```typescript
interface MaiaScriptModule {
  name: string                // Module name (e.g., 'builtin')
  version: string             // Version (e.g., '1.0.0')
  operations: Record<string, MaiaScriptOperation>  // Operation registry
}

interface MaiaScriptOperation {
  name: string
  evaluate: (args: any[], ctx: EvaluationContext) => unknown
  validate?: (args: any[]) => ValidationResult
}
```

### Built-in Module

**Location**: `libs/maia-script/src/modules/builtin.module.ts`

Contains core operations:
- Data access: `$`, `$get`
- Comparison: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`
- Logic: `$and`, `$or`, `$not`
- Control flow: `$if`, `$switch`
- String: `$concat`, `$trim`
- Date: `$now`, `$toISOString`
- Math: `$add`, `$multiply`

### Query Module

**Location**: `libs/maia-script/src/modules/query.module.ts`

Contains query operations for filtering, sorting, and paginating entities:
- `$filter` - Filter entities by MaiaScript condition
- `$sort` - Sort entities by field (asc/desc)
- `$paginate` - Limit and offset entities
- `$pipe` - Chain query operations together

**Example**:
```json
{
  "operations": {
    "$pipe": [
      { "$filter": { "field": "status", "condition": { "$eq": [{ "$": "item.status" }, "todo"] } } },
      { "$sort": { "field": "createdAt", "order": "desc" } },
      { "$paginate": { "limit": 10 } }
    ]
  }
}
```

See [queryEngine Integration](#-queryengine-integration) section for detailed examples.

### Custom Modules

Create your own module:

```typescript
// myapp.maiascript.module.ts
import type { MaiaScriptModule } from '@maia/script'

export const myAppModule: MaiaScriptModule = {
  name: 'myapp',
  version: '1.0.0',
  operations: {
    '$uppercase': {
      name: '$uppercase',
      evaluate: (args, ctx) => {
        const [str] = evaluateArgs(args, ctx)
        return typeof str === 'string' ? str.toUpperCase() : ''
      }
    },
    '$formatCurrency': {
      name: '$formatCurrency',
      evaluate: (args, ctx) => {
        const [amount] = evaluateArgs(args, ctx)
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(amount)
      }
    }
  }
}

// Register module
import { maiaScriptModuleRegistry } from '@maia/script'
maiaScriptModuleRegistry.register(myAppModule)

// Use in expressions
{ "$uppercase": "hello" }  // → "HELLO"
{ "$formatCurrency": 1234.56 }  // → "$1,234.56"
```

---

## 🔧 ToolEngine Integration

ToolEngine evaluates MaiaScript expressions in payloads before executing tools.

### Evaluation Flow

```typescript
// 1. User defines payload with DSL
const payload = {
  schemaName: 'Todo',
  entityData: {
    name: 'context.newTodoText',  // ← String path
    status: 'todo',               // ← Static value
    endDate: {                    // ← MaiaScript expression
      "$toISOString": [
        { "$add": [{ "$now": [] }, { "$multiply": [7, 86400000] }] }
      ]
    }
  }
}

// 2. ToolEngine evaluates recursively
ToolEngine.execute('@core/createEntity', actor, payload, accountCoState)

// 3. Result passed to tool
{
  schemaName: 'Todo',
  entityData: {
    name: 'Buy milk',          // ← Resolved from context
    status: 'todo',
    endDate: '2026-01-18T...'  // ← Computed (7 days from now)
  }
}
```

### String Path Resolution

String paths are automatically converted to MaiaScript expressions:

```typescript
// Input
'context.newTodoText'

// Converted to
{ "$": "context.newTodoText" }

// Evaluated to
"Buy milk"  // (actual value from actor.context)
```

### Nested Object Evaluation

ToolEngine recursively evaluates nested structures:

```typescript
// Input
{
  user: {
    name: 'context.userName',
    email: 'context.userEmail',
    timestamp: { "$now": [] }
  },
  items: [
    { id: 'item.id', status: 'item.status' }
  ]
}

// Output (all values resolved)
{
  user: {
    name: "Alice",
    email: "alice@example.com",
    timestamp: 1704931200000
  },
  items: [
    { id: "co_z123...", status: "done" }
  ]
}
```

---

## 🎨 ViewEngine Integration

ViewEngine uses MaiaScript for data bindings and conditional rendering.

### Binding Examples

#### Text Binding
```json
{
  "tag": "span",
  "bindings": {
    "text": { "$": "item.name" }
  }
}
```

#### Conditional Classes
```json
{
  "tag": "div",
  "bindings": {
    "class": {
      "$if": {
        "test": { "$eq": [{ "$": "item.status" }, "done"] },
        "then": "bg-green-100 line-through",
        "else": "bg-gray-100"
      }
    }
  }
}
```

#### Visibility
```json
{
  "tag": "span",
  "bindings": {
    "visible": { "$eq": [{ "$": "item.status" }, "done"] }
  }
}
```

#### Disabled State
```json
{
  "tag": "button",
  "bindings": {
    "disabled": {
      "$or": [
        { "$not": { "$": "context.newTodoText" } },
        { "$eq": [{ "$trim": { "$": "context.newTodoText" } }, ""] }
      ]
    }
  }
}
```

---

## 🏭 factoryEngine Integration

factoryEngine uses MaiaScript for conditional templates.

### Conditional Factory Example

```json
{
  "$schema": "leaf-factory",
  "parameters": {
    "variant": { "type": "string", "default": "primary" },
    "text": { "type": "string", "required": true }
  },
  "factory": {
    "tag": "button",
    "classes": {
      "$switch": {
        "on": "{{variant}}",
        "cases": {
          "primary": "bg-blue-500 text-white",
          "secondary": "bg-gray-500 text-white",
          "danger": "bg-red-500 text-white"
        },
        "default": "bg-slate-500 text-white"
      }
    },
    "elements": ["{{text}}"]
  }
}
```

**Evaluation Timing**:
- factoryEngine conditionals are evaluated **at factory-load time** (template expansion)
- ViewEngine bindings are evaluated **at runtime** (reactive)

---

## 🔍 queryEngine Integration

queryEngine uses MaiaScript for query operations (filtering, sorting, paginating entities).

### Query Configuration

Queries are defined in `actor.context.queries` using `QueryConfig`:

```typescript
interface QueryConfig {
  schemaName: string  // Entity schema name (e.g., "Todo")
  operations?: MaiaScriptExpression  // Optional query operations
}
```

### Simple Query (No Operations)

```json
{
  "queries": {
    "todos": {
      "schemaName": "Todo"
    }
  }
}
```

Returns all entities of the specified schema.

### Query with Filter Operation

```json
{
  "queries": {
    "activeTodos": {
      "schemaName": "Todo",
      "operations": {
        "$filter": {
          "field": "status",
          "condition": { "$eq": [{ "$": "item.status" }, "todo"] }
        }
      }
    }
  }
}
```

Filters entities where `status === "todo"`.

### Query with Multiple Operations ($pipe)

```json
{
  "queries": {
    "recentTodos": {
      "schemaName": "Todo",
      "operations": {
        "$pipe": [
          {
            "$filter": {
              "field": "status",
              "condition": { "$eq": [{ "$": "item.status" }, "todo"] }
            }
          },
          {
            "$sort": {
              "field": "createdAt",
              "order": "desc"
            }
          },
          {
            "$paginate": {
              "limit": 10
            }
          }
        ]
      }
    }
  }
}
```

Chains filter → sort → paginate operations.

### Query Operations

#### `$filter` - Filter entities by condition

```json
{
  "$filter": {
    "field": "status",
    "condition": { "$eq": [{ "$": "item.status" }, "todo"] }
  }
}
```

The `condition` is a MaiaScript expression evaluated for each entity (with `item` set to the entity).

#### `$sort` - Sort entities by field

```json
{
  "$sort": {
    "field": "createdAt",
    "order": "desc"  // "asc" or "desc" (default: "asc")
  }
}
```

#### `$paginate` - Limit and offset

```json
{
  "$paginate": {
    "limit": 10,
    "offset": 0
  }
}
```

#### `$pipe` - Chain operations

```json
{
  "$pipe": [
    { "$filter": {...} },
    { "$sort": {...} },
    { "$paginate": {...} }
  ]
}
```

Executes operations in sequence, passing result of each to the next.

### Example: Kanban Board with Filtered Queries

```typescript
// Actor context with 3 filtered queries (one per column)
queries: {
  todos_todo: {
    schemaName: 'Todo',
    operations: {
      "$filter": {
        "field": "status",
        "condition": { "$eq": [{ "$": "item.status" }, "todo"] }
      }
    }
  },
  todos_in_progress: {
    schemaName: 'Todo',
    operations: {
      "$filter": {
        "field": "status",
        "condition": { "$eq": [{ "$": "item.status" }, "in-progress"] }
      }
    }
  },
  todos_done: {
    schemaName: 'Todo',
    operations: {
      "$filter": {
        "field": "status",
        "condition": { "$eq": [{ "$": "item.status" }, "done"] }
      }
    }
  }
}
```

Each column uses its own filtered query - no UI-level filtering needed!

### Extending Query Operations

Add new operations to `libs/maia-script/src/modules/query.module.ts`:

```typescript
'$group': {
  name: '$group',
  evaluate: (args: any[], ctx: EvaluationContext) => {
    const config = args[0] as { field: string }
    const entities = args[1] as Array<Record<string, unknown>>
    // Grouping logic here
    return groupedEntities
  }
}
```

All operations are secure (validated via MaiaScript DSL) and reactive (CoState subscriptions).

---

## 📊 Evaluation Context

MaiaScript expressions are evaluated within a context:

```typescript
interface EvaluationContext {
  context?: Record<string, unknown>     // Actor context
  item?: Record<string, unknown>        // Foreach item
  dependencies?: Record<string, unknown> // Actor dependencies
}
```

### Context Example

```typescript
// Actor context
{
  newTodoText: "Buy milk",
  error: null,
  queries: {
    todos: { items: [...] }
  }
}

// Foreach item
{
  id: "co_z123...",
  name: "Buy milk",
  status: "todo"
}

// Dependencies
{
  content: <ActorReference>
}

// MaiaScript can access all three
{ "$": "context.newTodoText" }    // → "Buy milk"
{ "$": "item.status" }             // → "todo"
{ "$": "dependencies.content.context.viewMode" }  // → "list"
```

---

## 🧪 Examples

### Example 1: Todo Creation with Date Calculation

```typescript
// Actor event payload
{
  event: '@core/createEntity',
  payload: {
    schemaName: 'Todo',
    entityData: {
      name: 'context.newTodoText',
      status: 'todo',
      endDate: {
        "$toISOString": [
          { "$add": [
            { "$now": [] },
            { "$multiply": [7, 86400000] }  // 7 days in ms
          ]}
        ]
      },
      duration: 60
    },
    clearFieldPath: 'newTodoText'
  }
}

// Evaluated by ToolEngine
{
  schemaName: 'Todo',
  entityData: {
    name: 'Buy milk',               // From context
    status: 'todo',
    endDate: '2026-01-18T10:30:00Z', // Computed
    duration: 60
  },
  clearFieldPath: 'newTodoText'
}
```

### Example 2: Conditional Status Badge

```json
{
  "tag": "span",
  "classes": "px-2 py-1 rounded",
  "bindings": {
    "class": {
      "$switch": {
        "on": { "$": "item.status" },
        "cases": {
          "todo": "bg-slate-100 text-slate-700",
          "in-progress": "bg-blue-100 text-blue-700",
          "done": "bg-green-100 text-green-700"
        },
        "default": "bg-gray-100"
      }
    },
    "text": { "$": "item.status" }
  }
}
```

### Example 3: Button Disabled State

```json
{
  "tag": "button",
  "bindings": {
    "disabled": {
      "$or": [
        { "$not": { "$": "context.newTodoText" } },
        { "$eq": [
          { "$trim": { "$": "context.newTodoText" } },
          ""
        ]}
      ]
    }
  },
  "elements": ["Add"]
}
```

---

## 🚀 Best Practices

### 1. Use String Paths for Simple Access

```typescript
// ✅ GOOD - Clean and readable
'context.newTodoText'
'item.name'

// ❌ UNNECESSARY - Too verbose for simple access
{ "$": "context.newTodoText" }
```

### 2. Use Explicit DSL for Operations

```typescript
// ✅ GOOD - Clear intent
{
  "$if": {
    "test": { "$eq": [{ "$": "item.status" }, "done"] },
    "then": "✓",
    "else": ""
  }
}

// ❌ BAD - Can't do this with string paths
"if item.status === 'done' then '✓' else ''"  // Invalid!
```

### 3. Validate Expressions

```typescript
import { safeEvaluate, validateExpression } from '@maia/script'

// Validate before evaluating
const result = validateExpression(expr)
if (!result.valid) {
  console.error('Invalid expression:', result.errors)
}

// Safe evaluation (throws SecurityError if invalid)
const value = safeEvaluate(expr, context)
```

### 4. Keep Expressions Simple

```typescript
// ✅ GOOD - Simple, readable
{ "$eq": [{ "$": "item.status" }, "done"] }

// ⚠️ OK - But getting complex
{
  "$and": [
    { "$eq": [{ "$": "item.status" }, "done"] },
    { "$gt": [{ "$": "item.priority" }, 5] }
  ]
}

// ❌ TOO COMPLEX - Consider moving to tool logic
{
  "$and": [
    { "$or": [...] },
    { "$not": { "$and": [...] } },
    { "$if": {...} }
  ]
}
```

---

## 📚 Related Documentation

- **[Engine Architecture](./ENGINE_ARCHITECTURE.md)** - How engines use MaiaScript
- **[ToolEngine](./ENGINE_ARCHITECTURE.md#2%EF%B8%8F⃣-toolengine)** - Tool execution with DSL
- **[ViewEngine](./ENGINE_ARCHITECTURE.md#3%EF%B8%8F⃣-viewengine)** - View bindings with DSL
- **[Factory System](./FACTORY_SYSTEM.md)** - Template conditionals with DSL

---

## ✅ Summary

MaiaScript provides:

- **Security**: Whitelist-based, no code execution, prototype pollution prevention
- **Expressiveness**: Rich operation set for common use cases
- **Integration**: Used by ToolEngine, ViewEngine, factoryEngine, queryEngine
- **Extensibility**: Module-based system for custom operations
- **Performance**: Pure JSON, no parsing, compiled evaluation

**Core Innovation**: Replace unsafe `eval()` with a secure, JSON-based expression language that's tightly integrated with the engine architecture.
