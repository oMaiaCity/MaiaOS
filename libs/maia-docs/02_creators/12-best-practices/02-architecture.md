### Pattern: One Service Actor Per Domain

**Each domain gets its own service actor:**
```
App Service Actor
  ├── Todos Domain Service Actor
  ├── Notes Domain Service Actor
  ├── Calendar Domain Service Actor
  └── Users Domain Service Actor
```

**Benefits:**
- ✅ Clear boundaries
- ✅ Independent scaling
- ✅ Team ownership
- ✅ Isolated testing

### Domain Service Responsibilities

**Domain Service Actor:**
- Manages domain-specific business logic
- Orchestrates domain queries
- Executes domain mutations
- Publishes domain events

**Example:**
```json
{
  "$factory": "@factory/actor",
  "$id": "@actor/vibe",
  "@label": "agent",
  "context": "@context/vibe",
  "state": "@state/vibe",
  "view": "@view/vibe",
  "brand": "@style/brand",
  "inbox": "@inbox/vibe"
}
```

**Note:** Always create the vibe root service actor first. This is your app's orchestrator.

---

## 8. Feature Modules

### Pattern: One Composite Per Feature

**Each feature gets its own composite:**
```
App Composite Actor
  ├── Todos Feature Composite Actor
  ├── Notes Feature Composite Actor
  ├── Calendar Feature Composite Actor
  └── Settings Feature Composite Actor
```

**Benefits:**
- ✅ Feature isolation
- ✅ Independent development
- ✅ Lazy loading ready
- ✅ Code splitting ready

### Feature Composite Responsibilities

**Feature Composite Actor:**
- Manages feature-specific UI orchestration
- Coordinates feature UI actors
- Handles feature-specific form state
- Forwards feature events to domain service

**Example:**
```json
{
  "$factory": "@factory/actor",
  "$id": "@actor/composite",
  "@label": "composite",
  "context": "@context/composite",
  "view": "@view/composite",
  "state": "@state/composite",
  "brand": "@style/brand",
  "inbox": "@inbox/composite"
}
```

**Note:** Children are defined in `composite.context.maia` via `@actors` system property. See [Actors](../03-actors/01-vibe-pattern.md#system-properties-in-context) for details.


---

## 9. Schema Definitions

### Core Principles

#### Every Schema Must Have a Co-Type

**CRITICAL RULE**: Every schema or instance **must** be one of three CoJSON types:

- **`cotype: "comap"`** - CRDT map (key-value pairs with properties)
- **`cotype: "colist"`** - CRDT list (ordered array with items)
- **`cotype: "costream"`** - CRDT stream (append-only list with items)

**Example:**
```json
{
  "$factory": "@factory/meta",
  "$id": "@factory/actor",
  "title": "Actor Definition",
  "cotype": "comap",  // ← REQUIRED: Must be comap, colist, or costream
  "properties": {
    // ...
  }
}
```

#### Use `$co` for CoValue References, `$ref` Only for Internal Definitions

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
      "$co": "@factory/context",  // ← References separate CoValue
      "description": "Co-id reference to context definition"
    },
    "children": {
      "type": "array",
      "items": {
        "$co": "@factory/actor"  // ← Each item is a co-id reference
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
      "$ref": "@factory/context"  // ← WRONG: Use $co for CoValue references
    }
  }
}
```

### Required Schema Fields

Every schema must have:

1. **`$factory`** - Reference to meta-factory (usually `"@factory/meta"`)
2. **`$id`** - Unique schema identifier (human-readable like `"@factory/actor"` or co-id like `"co_z..."`)
3. **`title`** - Human-readable schema title
4. **`cotype`** - CoJSON type: `"comap"`, `"colist"`, or `"costream"`

### Common Schema Patterns

#### Pattern 1: Referencing Other Schemas

**Always use `$co` for schema references:**
```json
{
  "properties": {
    "view": {
      "$co": "@factory/view"  // ← Always use $co for schema references
    }
  }
}
```

#### Pattern 2: Arrays of CoValue References

**Each array item is a co-id reference:**
```json
{
  "properties": {
    "children": {
      "type": "array",
      "items": {
        "$co": "@factory/actor"  // ← Each item is a co-id reference
      }
    }
  }
}
```

#### Pattern 3: Recursive Internal Definitions

**Use `$ref` for recursive internal structures:**
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

#### Pattern 4: Expression References

**Reference expression schemas with `$co`:**
```json
{
  "properties": {
    "text": {
      "$co": "@factory/maia-script-expression"  // ← Expression schema reference
    },
    "value": {
      "$co": "@factory/maia-script-expression"  // ← Expression schema reference
    }
  }
}
```

#### Pattern 5: Schema Composition with `allOf`

**Use `$co` in `allOf` to extend schemas:**
```json
{
  "$factory": "@factory/meta",
  "$id": "@factory/guard",
  "title": "Guard",
  "cotype": "comap",
