# MaiaScript Expressions

MaiaScript expressions are JSON-based and evaluated safely by `MaiaScriptEvaluator`.

---

## Expression Syntax

**Basic Syntax:**
```json
{
  "$operation": [arguments...]
}
```

---

## Supported Operations

### Data Access

- `$context` - Access context data: `{ "$context": "title" }`
- `$item` - Access item data (in loops): `{ "$item": "id" }`
- `$` - Shortcut: `"$title"` = `{ "$context": "title" }`
- `$$` - Shortcut: `"$$id"` = `{ "$item": "id" }` (inside `$map`/`$find`, refers to current array item)
- `$event.field` - Process engine: event payload injected as `context.event` when evaluating action expressions. Use `"$event.viewMode"` or `"$event.target.value"` to read event fields.

**`$$key` vs `$event.key`:**

| Shortcut | Resolves to | Use when |
|----------|-------------|----------|
| `$$key` | `item.key` | Inside `$map` or `$find`, refers to the current array item |
| `$event.key` | `context.event.key` | In process engine actions, refers to the event payload (e.g. `viewMode`, `target.value`) |

### Comparison

- `$eq` - Equal: `{ "$eq": ["$context.status", "active"] }`
- `$neq` - Not equal: `{ "$neq": ["$context.status", "inactive"] }`
- `$gt` - Greater than: `{ "$gt": ["$context.count", 10] }`
- `$gte` - Greater than or equal
- `$lt` - Less than
- `$lte` - Less than or equal

### Logical

- `$and` - Logical AND: `{ "$and": [{ "$eq": ["$context.status", "active"] }, { "$gt": ["$context.count", 0] }] }`
- `$or` - Logical OR
- `$not` - Logical NOT

### Control Flow

- `$if` - Conditional: `{ "$if": { "condition": { "$eq": ["$context.status", "active"] }, "then": "green", "else": "gray" } }`
- `$switch` - Switch statement

### String

- `$concat` - Concatenate strings
- `$trim` - Trim whitespace: `{ "$trim": "$$text" }` (removes leading/trailing whitespace from string)
- `$toLowerCase` - Convert to lowercase
- `$toUpperCase` - Convert to uppercase

### Date

- `$formatDate` - Format date

### Array

- `$length` - Get array length
- `$includes` - Check if array includes value
- `$map` - Map over array
- `$find` - Find first matching item in array (see below)
- `$filter` - Filter array

### Math

- `$add` - Add numbers
- `$subtract` - Subtract numbers
- `$multiply` - Multiply numbers
- `$divide` - Divide numbers

---

## Expression Validation

Expressions are validated against `maia-script-expression` schema before evaluation:

```javascript
// Validation happens automatically
const evaluator = new MaiaScriptEvaluator();
await evaluator.evaluate(expression, data);
// Throws if expression is invalid
```

---

## Security

- **Sandboxed** - Only whitelisted operations allowed
- **Depth limits** - Maximum recursion depth (default: 50) prevents DoS
- **Schema validation** - Expressions validated before evaluation
- **No code execution** - Pure JSON, no JavaScript execution

---

## Examples

### Basic Conditional

```json
{
  "$if": {
    "condition": { "$eq": ["$context.status", "active"] },
    "then": "green",
    "else": "gray"
  }
}
```

### Complex Logic

```json
{
  "$if": {
    "condition": {
      "$and": [
        { "$eq": ["$context.status", "active"] },
        { "$gt": ["$context.count", 0] }
      ]
    },
    "then": "visible",
    "else": "hidden"
  }
}
```

### Array Operations

**`$map`** - Transform each item:

```json
{
  "$map": {
    "array": "$context.items",
    "as": "item",
    "do": { "$item": "name" }
  }
}
```

`items` is an alias for `array`. The `as` property (default `"item"`) names the loop variable; use `$$itemKey.path` to reference it.

**`$find`** - Find first matching item, optionally return a property:

| Property | Required | Description |
|----------|----------|-------------|
| `array` or `items` | Yes | Expression evaluating to array to search |
| `where` | No | Condition expression (evaluated per item; first match wins) |
| `return` | No | Expression to return for the match (default: the matched item itself) |
| `as` | No | Variable name for each item (default: `"item"`); use `$$as.path` in `where`/`return` |

```json
{
  "$find": {
    "array": "$tabs",
    "where": { "$eq": ["$$id", "$event.viewMode"] },
    "return": "$$actor",
    "as": "item"
  }
}
```

---

## Related Documentation

- [Main README](./README.md) - Package overview
- [engines/](./engines/) - MaiaScriptEvaluator details
- [api-reference.md](./api-reference.md) - API reference
- [patterns.md](./patterns.md) - Common patterns
