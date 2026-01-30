# MaiaOS Schemata System

The MaiaOS schemata system provides a JSON Schema-based type system for CoJSON types (comap, colist, costream) with co-id-based references, seeding, and runtime validation.

## Core Principles

### 1. Every Schema Must Have a Co-Type

**CRITICAL RULE**: Every schema or instance **must** be one of three CoJSON types:

- **`cotype: "comap"`** - CRDT map (key-value pairs with properties)
- **`cotype: "colist"`** - CRDT list (ordered array with items)
- **`cotype: "costream"`** - CRDT stream (append-only list with items)

**Example:**
```json
{
  "$schema": "@schema/meta",
  "$id": "@schema/actor",
  "title": "Actor Definition",
  "cotype": "comap",  // ← REQUIRED: Must be comap, colist, or costream
  "properties": {
    // ...
  }
}
```

### 2. Use `$co` for CoValue References, `$ref` Only for Internal Definitions

**CRITICAL RULE**: 
- **Use `$co`** to reference **separate CoValue entities** (other schemas, actors, views, etc.)
- **Use `$ref`** **ONLY** for internal schema definitions (within `$defs`)

**Why?**
- `$co` indicates a property value is a **co-id reference** to another CoValue
- `$ref` is for JSON Schema internal references (like `#/$defs/viewNode`)
- Never use `$ref` to reference external schemas - always use `$co`

**✅ CORRECT:**
```json
{
  "properties": {
    "context": {
      "$co": "@schema/context",  // ← References separate CoValue
      "description": "Co-id reference to context definition"
    },
    "children": {
      "type": "array",
      "items": {
        "$co": "@schema/actor"  // ← Each item is a co-id reference
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
            "$ref": "#/$defs/viewNode"  // ← OK: Internal reference
          }
        }
      }
    }
  }
}
```

**❌ WRONG:**
```json
{
  "properties": {
    "context": {
      "$ref": "@schema/context"  // ← WRONG: Use $co for CoValue references
    }
  }
}
```

## Schema Structure

### Required Fields

Every schema must have:

1. **`$schema`** - Reference to meta-schema (usually `"@schema/meta"`)
2. **`$id`** - Unique schema identifier (human-readable like `"@schema/actor"` or co-id like `"co_z..."`)
3. **`title`** - Human-readable schema title
4. **`cotype`** - CoJSON type: `"comap"`, `"colist"`, or `"costream"`

### Schema Examples

#### Example 1: Actor Schema (comap)
```json
{
  "$schema": "@schema/meta",
  "$id": "@schema/actor",
  "title": "@schema/actor",
  "description": "Pure declarative actor specification",
  "cotype": "comap",
  "indexing": true,
  "properties": {
    "role": {
      "type": "string",
      "description": "Actor role (e.g., 'kanban-view', 'vibe', 'composite', 'leaf')"
    },
    "context": {
      "$co": "@schema/context",  // ← CoValue reference
      "description": "Co-id reference to context definition"
    },
    "view": {
      "$co": "@schema/view",  // ← CoValue reference
      "description": "Co-id reference to view definition"
    },
    "state": {
      "$co": "@schema/state",  // ← CoValue reference
      "description": "Co-id reference to state machine definition"
    },
    "brand": {
      "$co": "@schema/style",  // ← CoValue reference
      "description": "Co-id reference to brand style definition"
    },
    "style": {
      "$co": "@schema/style",  // ← CoValue reference
      "description": "Co-id reference to local style definition"
    },
    "inbox": {
      "$co": "@schema/inbox",  // ← CoValue reference
      "description": "Co-id reference to message inbox costream"
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

#### Example 3: Guard Schema (comap - accepts any MaiaScript expression)
```json
{
  "$schema": "@schema/meta",
  "$id": "@schema/guard",
  "title": "@schema/guard",
  "description": "Guard condition for state machine transitions",
  "cotype": "comap",
  "indexing": true,
  "properties": {},
  "additionalProperties": true  // ← Accepts any MaiaScript expression properties
}
```

**Note**: The `guard` schema accepts any properties (via `additionalProperties: true`), allowing any MaiaScript expression to be used as a guard condition. Guards are validated against the MaiaScript expression schema at runtime.

#### Example 4: View Schema (comap with internal $defs)
```json
{
  "$schema": "@schema/meta",
  "$id": "@schema/view",
  "title": "@schema/view",
  "description": "UI structure definition with DOM tree, expressions, loops, and event handlers",
  "cotype": "comap",
  "indexing": true,
  "properties": {
    "content": {
      "type": "object",
      "description": "View content structure (recursive viewNode)",
      "$ref": "#/$defs/viewNode"  // ← OK: Internal reference to $defs
    }
  },
  "$defs": {
    "viewNode": {
      "type": "object",
      "description": "Recursive DOM node structure",
      "properties": {
        "tag": { "type": "string" },
        "class": { "type": "string" },
        "text": {
          "anyOf": [
            { "type": "string", "pattern": "^\\$\\$" },
            { "type": "string", "pattern": "^@" },
            { "type": "string", "pattern": "^\\$[^$]" },
            { "type": "string" },
            { "type": "number" },
            { "type": "boolean" },
            { "type": "null" }
          ]
        },
        "children": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/viewNode"  // ← OK: Recursive internal reference
          }
        },
        "$on": {
          "type": "object",
          "additionalProperties": {
            "type": "object",
            "properties": {
              "send": { "type": "string" },
              "payload": { "type": "object", "additionalProperties": true },
              "key": { "type": "string" }
            },
            "required": ["send"]
          }
        },
        "$each": {
          "type": "object",
          "properties": {
            "items": { "anyOf": [/* expression patterns */] },
            "template": { "$ref": "#/$defs/viewNode" }
          },
          "required": ["items", "template"]
        },
        "$slot": {
          "anyOf": [/* expression patterns */]
        }
      },
      "additionalProperties": false
    }
  },
  "additionalProperties": false
}
```

#### Example 5: MaiaScript Expression Schema (comap with recursive $ref)
```json
{
  "$schema": "@schema/meta",
  "$id": "@schema/maia-script-expression",
  "title": "MaiaScript Expression",
  "cotype": "comap",
  "anyOf": [
    { "type": ["number", "boolean", "null"] },
    { "type": "string" },
    { "$ref": "#/$defs/expressionObject" }  // ← OK: Internal reference
  ],
  "$defs": {
    "expressionObject": {
      "type": "object",
      "oneOf": [
        {
          "properties": {
            "$eq": {
              "type": "array",
              "items": {
                "$ref": "#"  // ← OK: Self-reference (recursive)
              }
            }
          }
        }
      ]
    }
  }
}
```

## Seeding Process

The seeding process transforms human-readable schema IDs (like `"@schema/actor"`) into co-ids (like `"co_zABC123..."`) and stores everything in IndexedDB.

### Phase 1: Co-ID Generation

1. **Generate co-ids for all schemas**
   - Each unique schema `$id` gets a deterministic co-id
   - Co-ids are stored in a registry: `Map<human-readable-id, co-id>`

```javascript
// Example: Schema "@schema/actor" → co-id "co_zABC123..."
const schemaCoIdMap = new Map();
for (const schema of schemas) {
  const coId = generateCoIdForSchema(schema);
  schemaCoIdMap.set(schema.$id, coId);
}
```

### Phase 2: Schema Transformation

2. **Transform all schemas** (replace human-readable refs with co-ids)
   - `$schema: "@schema/meta"` → `$schema: "co_zMeta123..."`
   - `$id: "@schema/actor"` → `$id: "co_zABC123..."`
   - `$co: "@schema/context"` → `$co: "co_zContext456..."`
   - `$ref` values are **NOT** transformed (only for internal definitions)

```javascript
// Transform schema
const transformed = transformSchemaForSeeding(schema, schemaCoIdMap);
// Result: All $co references now use co-ids
```

### Phase 2.5: Schema Validation After Transformation

2.5. **Validate transformed schemas** (ensure transformation didn't introduce errors)
   - Each transformed schema validated against its `$schema` meta-schema
   - Meta-schema loaded from in-memory map or database
   - Ensures data integrity before storage
   - Throws error if validation fails

```javascript
// Validate transformed schema
const result = await validationEngine.validateSchemaAgainstMeta(transformedSchema);
if (!result.valid) {
  throw new Error(`Schema validation failed: ${result.errors}`);
}
```

### Phase 3: Schema Storage

3. **Store validated schemas in IndexedDB**
   - Schemas stored with co-id as key
   - Already validated in Phases 1 and 2.5

### Phase 4: Instance Transformation

4. **Transform all instances** (actors, views, contexts, etc.)
   - `$schema: "@schema/actor"` → `$schema: "co_zABC123..."`
   - `$id: "actor/001"` → `$id: "co_zInstance789..."`
   - Property values with `$co` references are transformed
   - Query objects (`{schema: "@schema/todos", filter: {...}}`) are transformed

```javascript
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
