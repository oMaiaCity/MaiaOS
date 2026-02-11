// Transform instance
const transformed = transformInstanceForSeeding(instance, coIdMap);
// Result: All references now use co-ids
```

### Phase 4.5: Instance Validation After Transformation

4.5. **Validate transformed instances** (ensure transformation didn't introduce errors)
   - Each transformed instance validated against its `$schema` schema
   - Schema loaded from database (seeded in Phase 3)
   - Ensures data integrity before storage
   - Throws error if validation fails

```javascript
// Validate transformed instance
const schema = await dbEngine.getSchema(instance.$schema);
await validateAgainstSchemaOrThrow(schema, instance, context);
```

### Phase 5: Instance Storage

5. **Store validated instances in IndexedDB**
   - Instances stored with co-id as key
   - Already validated in Phase 4.5
   - Also validated on load (runtime check)

## Code Generation

Currently, schemas are **not** compiled to TypeScript or other code. They remain as JSON Schema definitions that are:

1. **Validated** against the meta-schema during seeding (before and after transformation)
2. **Transformed** from human-readable IDs to co-ids
3. **Validated again** after transformation to ensure integrity
3. **Stored** in IndexedDB for runtime resolution
4. **Used** for runtime validation via AJV

Future code generation could:
- Generate TypeScript types from schemas
- Generate runtime validators
- Generate serialization/deserialization code

## Runtime Resolution and Validation

### Schema Resolution

At runtime, schemas are resolved from IndexedDB using co-ids:

```javascript
// Resolve schema by co-id
const schema = await schemaResolver("co_zABC123...");
// Returns full schema definition
```

### Validation Process

1. **Load schema** from IndexedDB using co-id
2. **Resolve dependencies**:
   - `$schema` references (meta-schema)
   - `$co` references (other schemas)
   - `$ref` references (internal definitions)
3. **Register schemas** in AJV registry
4. **Validate instance** against schema

```javascript
const validationEngine = new ValidationEngine();
await validationEngine.initialize();

// Validate instance against schema
const result = await validationEngine.validate(
  instance,
  schemaCoId
);
```

### $co Reference Resolution

When validating, `$co` references are resolved:

1. **Extract `$co` value** (co-id or human-readable ID)
2. **Resolve schema** from IndexedDB
3. **Register schema** in AJV for validation
4. **Validate** that the referenced value conforms to the schema

```javascript
// Property definition
{
  "context": {
    "$co": "co_zContext456..."  // ← Resolved to context schema
  }
}

// Runtime validation
// 1. Load context schema: co_zContext456...
// 2. Validate instance.context value against context schema
// 3. Ensure instance.context is a valid co-id string
```

### Validation Rules

- **Co-ID validation**: Properties with `$co` must contain valid co-id strings (`co_z...`)
- **Schema conformance**: Referenced CoValues must conform to their schema
- **Type checking**: All properties validated against their schema definitions
- **Required fields**: Required properties must be present

## Common Patterns

### Pattern 1: Referencing Other Schemas

```json
{
  "properties": {
    "view": {
      "$co": "@schema/view"  // ← Always use $co for schema references
    }
  }
}
```

### Pattern 2: Arrays of CoValue References

```json
{
  "properties": {
    "children": {
      "type": "array",
      "items": {
        "$co": "@schema/actor"  // ← Each item is a co-id reference
      }
    }
  }
}
```

### Pattern 3: Recursive Internal Definitions

```json
{
  "$defs": {
    "viewNode": {
      "type": "object",
      "properties": {
        "children": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/viewNode"  // ← OK: Internal recursive reference
          }
        }
      }
    }
  }
}
```

### Pattern 4: Expression References

```json
{
  "properties": {
    "text": {
      "$co": "@schema/maia-script-expression"  // ← Expression schema reference
    },
    "value": {
      "$co": "@schema/maia-script-expression"  // ← Expression schema reference
    }
  }
}
```

### Pattern 5: Nested Objects with $co

```json
{
  "properties": {
    "attrs": {
      "type": "object",
      "additionalProperties": {
        "anyOf": [
          {
            "$co": "@schema/maia-script-expression"  // ← Expression in attributes
          },
          {
            "type": "object",
            "additionalProperties": {
              "$co": "@schema/maia-script-expression"  // ← Nested expression
            }
          }
        ]
      }
    }
  }
}
```

## Validation Rules Summary

### ✅ DO:

1. **Always specify `cotype`** - Every schema must be `comap`, `colist`, or `costream`
2. **Use `$co` for CoValue references** - References to other schemas, actors, views, etc.
3. **Use `$ref` for internal definitions** - Only within `$defs` or for self-references
4. **Include `$id` pattern validation** - Validate co-id format: `^co_z[a-zA-Z0-9]+$`
5. **Transform during seeding** - All human-readable IDs become co-ids

### ❌ DON'T:

1. **Don't use `$ref` for external schemas** - Always use `$co` instead
2. **Don't nest co-types** - Properties cannot have `cotype`, use `$co` to reference separate CoValues
3. **Don't mix `$co` and `$ref`** - Use `$co` for CoValues, `$ref` only for internal definitions
4. **Don't skip `cotype`** - Every schema/instance must specify its CoJSON type
5. **Don't use human-readable IDs at runtime** - All IDs must be co-ids after seeding

### Special Contexts: `additionalProperties` and `oneOf`

**`additionalProperties` and Dynamic Keys:**
- `additionalProperties` defines the schema for dynamic object keys
- When referencing external schemas, **use `$co`** for CoValue references
- Example: `guard.schema.json` uses `additionalProperties: true` to accept any MaiaScript expression properties

**`oneOf` and Schema Alternatives:**
- `oneOf` allows a value to match one of several schema alternatives
- Used in `action.schema.json` to support tool invocations, context updates, or data mapping
- Each alternative can use `$co` for CoValue references

**Consistency**: All schemas in the codebase consistently use `$co` for external CoValue references. Use `$ref` only for internal schema definitions within `$defs`.

## Examples from Codebase

### Action Schema
```json
{
  "$schema": "@schema/meta",
  "$id": "@schema/action",
  "title": "Action",
  "cotype": "comap",
  "properties": {
    "$id": {
      "type": "string",
      "pattern": "^co_z[a-zA-Z0-9]+$"
    },
    "tool": { "type": "string" },
    "payload": {
      "type": "object",
      "additionalProperties": {
        "$co": "@schema/maia-script-expression"  // ← Uses $co for schema reference
      }
    }
  },
  "required": ["tool"]
}
```

**Note**: The `action` schema correctly uses `$co` in `additionalProperties` to reference the expression schema. This ensures dynamic payload properties are validated against the expression schema.

### Context Schema
```json
{
  "$schema": "@schema/meta",
  "$id": "@schema/context",
  "title": "Context Definition",
  "cotype": "comap",
  "properties": {
    "$id": {
      "type": "string",
      "pattern": "^co_z[a-zA-Z0-9]+$"
    },
    "todos": {
      "type": "object",
      "properties": {
        "schema": {
          "type": "string",
          "description": "Schema reference (e.g., '@schema/todos')"
        },
        "filter": {
          "oneOf": [
            {"type": "object"},
            {"type": "null"}
          ]
        }
      },
      "required": ["schema"]
    }
  },
  "additionalProperties": {
    "anyOf": [
      {
        "type": "object",
        "properties": {
          "schema": { "type": "string" },
          "filter": { "oneOf": [{"type": "object"}, {"type": "null"}] }
        },
        "required": ["schema"]
      },
      {
        "type": ["string", "number", "boolean", "null", "array", "object"]
      }
    ]
  }
}
```

### State Schema
```json
{
  "$schema": "@schema/meta",
  "$id": "@schema/state",
  "title": "State Machine Definition",
  "cotype": "comap",
  "properties": {
    "initial": { "type": "string" },
    "states": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "entry": {
            "oneOf": [
              { "type": "object" },
              { "type": "array" },
              { "$co": "@schema/action" },  // ← CoValue reference
              {
                "type": "array",
                "items": { "$co": "@schema/action" }  // ← Array of CoValue references
              }
            ]
          },
          "on": {
            "type": "object",
            "additionalProperties": {
              "oneOf": [
                { "type": "string" },
                {
                  "type": "object",
                  "properties": {
                    "target": { "type": "string" },
                    "guard": {
                      "$co": "@schema/maia-script-expression"  // ← Expression reference
                    },
                    "actions": {
                      "type": "array",
                      "items": {
                        "oneOf": [
                          { "type": "object" },
                          { "$co": "@schema/action" }  // ← CoValue reference
                        ]
                      }
                    }
                  }
                },
                { "$co": "@schema/transition" }  // ← CoValue reference
              ]
            }
          }
        }
      }
    }
  },
  "required": ["initial", "states"]
}
```

## Summary

The MaiaOS schemata system provides:

1. **Type safety** via JSON Schema validation
2. **CoJSON integration** via `cotype` specification
3. **CoValue references** via `$co` keyword
4. **Seeding** transforms human-readable IDs to co-ids
5. **Runtime validation** resolves and validates all references
6. **Strict rules**: `$co` for CoValues, `$ref` only for internal definitions, every schema must have `cotype`

This ensures type-safe, validated, and properly referenced CoJSON data structures throughout the MaiaOS runtime.
