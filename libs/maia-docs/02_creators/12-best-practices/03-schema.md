# Schema Definitions (Continued)

*Part 2 - Schema patterns and examples. See [02-architecture.md](./02-architecture.md) for Domain Separation, Feature Modules, and Schema Principles.*

#### Pattern 5 (concluded): Schema Composition with `allOf`

```json
{
  "$schema": "@schema/meta",
  "$id": "@schema/guard",
  "title": "Guard",
  "cotype": "comap",
  "properties": {
    "$id": {
      "type": "string",
      "pattern": "^co_z[a-zA-Z0-9]+$"
    }
  },
  "allOf": [
    {
      "$co": "@schema/maia-script-expression"  // ← Uses $co for schema reference
    }
  ]
}
```

#### Pattern 6: Dynamic Properties with `additionalProperties`

**Use `$co` in `additionalProperties` for dynamic keys:**
```json
{
  "properties": {
    "payload": {
      "type": "object",
      "additionalProperties": {
        "$co": "@schema/maia-script-expression"  // ← Uses $co for schema reference
      }
    }
  }
}
```

### Schema Validation Rules

#### ✅ DO:

1. **Always specify `cotype`** - Every schema must be `comap`, `colist`, or `costream`
2. **Use `$co` for CoValue references** - References to other schemas, actors, views, etc.
3. **Use `$ref` for internal definitions** - Only within `$defs` or for self-references
4. **Include `$id` pattern validation** - Validate co-id format: `^co_z[a-zA-Z0-9]+$`
5. **Transform during seeding** - All human-readable IDs become co-ids

#### ❌ DON'T:

1. **Don't use `$ref` for external schemas** - Always use `$co` instead
2. **Don't nest co-types** - Properties cannot have `cotype`, use `$co` to reference separate CoValues
3. **Don't mix `$co` and `$ref`** - Use `$co` for CoValues, `$ref` only for internal definitions
4. **Don't skip `cotype`** - Every schema/instance must specify its CoJSON type
5. **Don't use human-readable IDs at runtime** - All IDs must be co-ids after seeding

### Schema Examples

#### Example 1: Actor Schema (comap)
```json
{
  "$schema": "@schema/meta",
  "$id": "@schema/actor",
  "title": "Actor Definition",
  "cotype": "comap",
  "properties": {
    "$id": {
      "type": "string",
      "pattern": "^co_z[a-zA-Z0-9]+$"
    },
    "context": {
      "$co": "@schema/context",  // ← CoValue reference
      "description": "Co-id reference to context definition"
    },
    "view": {
      "$co": "@schema/view",  // ← CoValue reference
      "description": "Co-id reference to view definition"
    },
    "children": {
      "type": "object",
      "additionalProperties": {
        "$co": "@schema/actor"  // ← Each child is a co-id reference
      }
    }
  }
}
```

#### Example 2: Inbox Schema (costream)
```json
{
  "$schema": "@schema/meta",
  "$id": "@schema/inbox",
  "title": "Inbox CoStream",
  "cotype": "costream",  // ← Append-only stream
  "properties": {
    "$id": {
      "type": "string",
      "pattern": "^co_z[a-zA-Z0-9]+$"
    },
    "items": {
      "type": "array",
      "description": "Array of message co-id references",
      "items": {
        "$co": "@schema/message",  // ← Each item is a co-id reference
        "description": "Each item is a co-id reference to a message"
      }
    }
  },
  "required": ["items"]
}
```

#### Example 3: View Schema (comap with internal $defs)
```json
{
  "$schema": "@schema/meta",
  "$id": "@schema/view",
  "title": "View Definition",
  "cotype": "comap",
  "properties": {
    "tag": { "type": "string" },
    "text": {
      "$co": "@schema/maia-script-expression"  // ← CoValue reference
    },
    "children": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/viewNode"  // ← OK: Internal reference to $defs
      }
    }
  },
  "$defs": {
    "viewNode": {
      "type": "object",
      "properties": {
        "children": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/viewNode"  // ← OK: Recursive internal reference
          }
        }
      }
    }
  }
}
```

### Reading Schema Definitions

When reading and understanding schema definitions:

1. **Identify the Co-Type** - Check `cotype` field first to understand the data structure
2. **Follow `$co` References** - These point to separate CoValue entities that need to be resolved
3. **Understand `$ref` Scope** - These are internal to the schema, defined in `$defs`
4. **Check Required Fields** - Look for `required` array to understand mandatory properties
5. **Validate Patterns** - Check `pattern` fields for string validation rules (especially co-id patterns)

**Best Practice:** When working with schemas, always:
- Start with the `cotype` to understand the structure
- Trace `$co` references to understand relationships
- Use `$defs` for reusable internal structures
- Keep schemas focused and single-purpose

---

