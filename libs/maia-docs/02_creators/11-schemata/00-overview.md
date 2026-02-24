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
    "@label": {
      "type": "string",
      "description": "Actor label (e.g., 'kanban-view', 'vibe', 'composite', 'leaf')"
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

#### Example 3: Guard Schema (comap - schema-based conditional logic)
```json
{
  "$schema": "@schema/meta",
  "$id": "@schema/guard",
  "title": "@schema/guard",
  "description": "JSON Schema guard for conditional logic - checks state/context conditions (NOT payload validation)",
  "cotype": "comap",
  "indexing": true,
  "required": ["schema"],
  "properties": {
    "schema": {
      "type": "object",
      "description": "JSON Schema to validate against current state/context (for conditional logic only, NOT payload validation)",
      "additionalProperties": true
    }
  },
  "additionalProperties": false
}
```

**Note**: Guards are **schema-based only** - they use JSON Schema to validate against the current state and context. Guards are for conditional logic (should this transition happen?), NOT payload validation. Payload validation happens in ActorEngine before messages reach the state machine.

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
