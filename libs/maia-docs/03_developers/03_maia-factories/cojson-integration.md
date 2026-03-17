# CoJSON Integration

## Overview

The `maia-factories` package extends JSON Schema with support for CoJSON types (CoMap, CoList, CoStream) via a custom AJV plugin. Think of it as adding new words to a language - JSON Schema understands standard types (string, number, object), and we're teaching it to understand CoJSON types too.

**What it adds:**
- `cotype` keyword: Validates CoJSON CRDT types at schema root
- `$co` keyword: Macro for co-id references in properties/items
- Support for both direct arrays and wrapped objects (colist/costream)

---

## The Simple Version

Imagine JSON Schema is a language that only knows about regular objects and arrays. CoJSON types are like special containers - they look similar, but they work differently (they're collaborative and conflict-free).

**The problem:** JSON Schema doesn't know about CoJSON types.

**The solution:** We teach JSON Schema about CoJSON types using custom keywords:
- `cotype`: "This is a CoMap/CoList/CoStream"
- `$co`: "This property references another CoJSON schema"

**Example:**
```json
{
  "$factory": "°Maia/factory/meta",
  "cotype": "comap",
  "properties": {
    "viewRef": { "$co": "°Maia/factory/view" }
  }
}
```

This says: "This is a CoMap schema, and the `viewRef` property references the `°Maia/factory/view` schema." Factory references use `°Maia/factory/` (spark-scoped) or `@domain/factory/` patterns.

---

## Custom Keywords

### `cotype` Keyword

**Purpose:** Validates that data is a CoJSON CRDT type.

**Values:**
- `"comap"`: Collaborative map (object-like)
- `"colist"`: Collaborative list (array-like)
- `"costream"`: Collaborative stream (array-like, append-only)
- `"cobinary"`: Collaborative binary (CoBinary)

**Where it's used:** At the schema root only (not in properties).

**Example:**
```json
{
  "$factory": "@factory/meta",
  "title": "Todos Schema",
  "cotype": "comap",
  "properties": {
    "text": { "type": "string" },
    "done": { "type": "boolean" }
  }
}
```

**Validation:**
- `comap`: Validates that data is an object (not array, not null)
- `colist`/`costream`: Validates that data is either:
  - A direct array: `[{...}, {...}]`
  - An object with `items` array: `{$factory: "...", $id: "...", items: [{...}]}`

### `$co` Keyword

**Purpose:** Macro that expands to co-id string validation with schema reference metadata.

**What it expands to:**
```json
{
  "$co": "°Maia/factory/view"
}
```
Patterns: `°Maia/factory/` (spark-scoped), `@domain/factory/` (domain-scoped).

Expands to:
```json
{
  "type": "string",
  "pattern": "^co_z[a-zA-Z0-9]+$",
  "_factoryRef": "@factory/view"
}
```

**Where it's used:** In properties and items (not at schema root).

**Example:**
```json
{
  "properties": {
    "viewRef": { "$co": "@factory/view" },
    "contextRef": { "$co": "@factory/context" }
  }
}
```

**Transformation:**
- Before seeding: `{ "$co": "@factory/view" }` (human-readable)
- After seeding: `{ "$co": "co_z123..." }` (co-id)
- Pattern validation ensures it's a valid co-id format

---

## AJV Plugin

### How It Works

The plugin registers two custom keywords with AJV:

```javascript
ajvCoTypesPlugin(ajv);

// Now AJV understands:
// - cotype keyword (validates CRDT types)
// - $co keyword (macro for co-id references)
```

### Plugin Registration

**When:** During `ValidationEngine.initialize()`

**Where:** After meta-schemas are registered

**Code:**
```javascript
// In validation.engine.js
ajvCoTypesPlugin(this.ajv);
```

### Keyword Implementation

**`cotype` keyword:**
```javascript
ajv.addKeyword({
  keyword: 'cotype',
  validate: (schema, data) => {
    if (schema === 'comap') {
      return typeof data === 'object' && !Array.isArray(data) && data !== null;
    }
    if (schema === 'colist' || schema === 'costream') {
      // Direct array OR object with items array
      return Array.isArray(data) || 
             (typeof data === 'object' && data !== null && Array.isArray(data.items));
    }
    return false;
  }
});
```

**`$co` keyword:**
```javascript
ajv.addKeyword({
  keyword: '$co',
  macro: (factoryCoId) => ({
    type: 'string',
    pattern: '^co_z[a-zA-Z0-9]+$',
    _factoryRef: factoryCoId  // Metadata for transformation
  })
});
```

---

## CoJSON Meta-Schema

### Structure

The CoJSON meta-schema (`os/meta.factory.json`) extends the base JSON Schema meta-schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "@factory/meta",
  "$vocabulary": {
    "https://json-schema.org/draft/2020-12/vocab/core": true,
    "https://maiaos.dev/vocab/cojson": true  // ← CoJSON vocabulary
  },
  "properties": {
    "cotype": {
      "enum": ["comap", "colist", "costream"]
    },
    "$co": {
      "type": "string",
      "anyOf": [
        { "pattern": "^co_z[a-zA-Z0-9]+$" },
        { "pattern": "^@factory/" }
      ]
    }
  }
}
```

### Vocabulary

**CoJSON Vocabulary:** `https://maiaos.dev/vocab/cojson`

**Purpose:** Indicates that this schema uses CoJSON types.

**Usage:** Schemas with CoJSON types must use `$factory: "@factory/meta"` to enable `cotype` and `$co` keywords.

---

## Type Validation Details

### CoMap Validation

**Schema:**
```json
{
  "cotype": "comap",
  "properties": { ... }
}
```

**Valid data:**
```json
{
  "name": "my-map",
  "value": 42
}
```

**Invalid data:**
```json
[]  // ❌ Array, not object
null  // ❌ Null, not object
```

### CoList Validation

**Schema:**
```json
{
  "cotype": "colist",
  "items": { "type": "string" }
}
```

**Valid data (direct array):**
```json
["item1", "item2", "item3"]
```

**Valid data (wrapped object):**
```json
{
  "$schema": "co_z123...",
  "$id": "co_z456...",
  "items": ["item1", "item2", "item3"]
}
```

**Invalid data:**
```json
{}  // ❌ Object without items array
null  // ❌ Null
```

### CoStream Validation

**Schema:**
```json
{
  "cotype": "costream",
  "items": { "type": "object" }
}
```

**Valid data:** Same as CoList (direct array or wrapped object)

**Difference:** CoStream is append-only (enforced at runtime, not schema level)

---

## Common Patterns

### CoMap Schema

```json
{
  "$factory": "@factory/meta",
  "title": "Actor Schema",
  "cotype": "comap",
  "properties": {
    "name": { "type": "string" },
    "viewRef": { "$co": "@factory/view" },
    "contextRef": { "$co": "@factory/context" }
  },
  "required": ["name"]
}
```

### CoList Schema

```json
{
  "$factory": "@factory/meta",
  "title": "Todos List Schema",
  "cotype": "colist",
  "items": {
    "$co": "@factory/todo-item"
  }
}
```

### Nested References

```json
{
  "$factory": "@factory/meta",
  "title": "Context Schema",
  "cotype": "comap",
  "properties": {
    "todos": {
      "$co": "@factory/todos"  // References colist schema
    }
  }
}
```

---

## Transformation Flow

### Before Seeding

```json
{
  "$factory": "@factory/meta",
  "cotype": "comap",
  "properties": {
    "viewRef": { "$co": "@factory/view" }
  }
}
```

### After Seeding

```json
{
  "$schema": "co_z111...",
  "cotype": "comap",
  "properties": {
    "viewRef": { "$co": "co_z222..." }
  }
}
```

**What changed:**
- `$schema`: `@factory/meta` → `co_z111...`
- `$co`: `@factory/view` → `co_z222...`
- `cotype`: Unchanged (not a reference)

---

## Troubleshooting

### Problem: "must pass 'cotype' keyword validation"

**Solution:** Add `cotype` to schema root:
```json
{
  "$factory": "@factory/meta",
  "cotype": "comap",  // ← Add this!
  "properties": { ... }
}
```

### Problem: "Nested CoJSON types found"

**Solution:** Use `$co` instead of nesting `cotype`:
```json
// ❌ Wrong
{
  "properties": {
    "items": { "cotype": "colist" }
  }
}

// ✅ Correct
{
  "properties": {
    "items": { "$co": "@factory/items" }
  }
}
```

### Problem: "must be string" for `$co` property

**Solution:** Make sure `$co` value is transformed to co-id:
```javascript
// Before transformation: { "$co": "@factory/view" }  // ❌ Fails validation
// After transformation: { "$co": "co_z123..." }     // ✅ Passes validation
```

---

## Source Files

- Plugin implementation: `libs/maia-factories/src/ajv-co-types-plugin.js`
- Meta-schema: `libs/maia-factories/src/os/meta.factory.json`
- Base meta-schema: `libs/maia-factories/src/os/base-meta-schema.json`
