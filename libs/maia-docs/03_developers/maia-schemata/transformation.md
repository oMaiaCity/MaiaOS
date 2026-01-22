# Schema Transformation

## Overview

The schema transformation system converts human-readable references to co-ids during the seeding process. Think of it like translating a document from one language to another - the meaning stays the same, but the words change.

**What it does:**
- Transforms `@schema/actor` → `co_z123...`
- Handles nested structures (query objects, tool payloads)
- Preserves all data structure (only changes reference strings)
- Works recursively through nested objects and arrays

---

## The Simple Version

Imagine you have a recipe written in English, but you need to give it to someone who only speaks French. You translate the words, but keep the structure the same - "eggs" becomes "œufs", but you still need 2 of them.

In MaiaOS:
- **Before:** `{schema: "@schema/todos"}` (human-readable)
- **After:** `{schema: "co_z123..."}` (co-id)
- **Structure:** Same! Only the reference string changed.

---

## Transformation Flow

### During Seeding

```
1. Load Schemas
   └─> Read schema files
   └─> Generate co-ids for each schema
   └─> Build co-id map (@schema/actor → co_z123...)

2. Transform Schemas
   └─> Replace $schema references
   └─> Replace $id references
   └─> Replace $co references in properties
   └─> Replace $ref references in $defs

3. Transform Instances
   └─> Transform query objects ({schema: "@schema/todos"})
   └─> Transform tool payloads
   └─> Transform action targets (@actor/vibe)
   └─> Transform array items

4. Store in IndexedDB
   └─> All references are now co-ids
   └─> Can be resolved without human-readable mappings
```

---

## Key Functions

### `transformSchemaForSeeding(schema, coIdMap)`

Transforms a schema object, replacing all human-readable references with co-ids.

**What it transforms:**
- `$schema`: `"@schema/meta"` → `"co_z123..."`
- `$id`: `"@schema/actor"` → `"co_z123..."`
- `$co` in properties: `{ "$co": "@schema/view" }` → `{ "$co": "co_z456..." }`
- `$ref` in `$defs`: `{ "$ref": "#/$defs/..." }` → (unchanged, internal reference)

**Example:**
```javascript
const schema = {
  $schema: '@schema/meta',
  $id: '@schema/actor',
  properties: {
    viewRef: { $co: '@schema/view' }
  }
};

const coIdMap = new Map([
  ['@schema/meta', 'co_z111...'],
  ['@schema/actor', 'co_z222...'],
  ['@schema/view', 'co_z333...']
]);

const transformed = transformSchemaForSeeding(schema, coIdMap);
// {
//   $schema: 'co_z111...',
//   $id: 'co_z222...',
//   properties: {
//     viewRef: { $co: 'co_z333...' }
//   }
// }
```

### `transformInstanceForSeeding(instance, coIdMap)`

Transforms an instance (actor, context, etc.), replacing all human-readable references with co-ids.

**What it transforms:**
- Top-level `schema` field: `"@schema/todos"` → `"co_z123..."`
- Query objects: `{schema: "@schema/todos", filter: {...}}` → `{schema: "co_z123...", filter: {...}}`
- Tool payloads: `{tool: "@db", payload: {schema: "@schema/todos"}}` → `{tool: "@db", payload: {schema: "co_z123..."}}`
- Action targets: `{tool: "@core/publishMessage", payload: {target: "@actor/vibe"}}` → `{tool: "@core/publishMessage", payload: {target: "co_z456..."}}`
- Array items: `["@actor/vibe"]` → `["co_z456..."]`

**Example:**
```javascript
const instance = {
  schema: '@schema/todos',
  todos: {
    schema: '@schema/todos',
    filter: { done: false }
  }
};

const coIdMap = new Map([
  ['@schema/todos', 'co_z123...']
]);

const transformed = transformInstanceForSeeding(instance, coIdMap);
// {
//   schema: 'co_z123...',
//   todos: {
//     schema: 'co_z123...',
//     filter: { done: false }
//   }
// }
```

### `transformQueryObjects(obj, coIdMap)`

Recursively transforms query objects in nested structures.

**What it handles:**
- Query objects: `{schema: "@schema/todos", filter: {...}}`
- Tool payloads: `{tool: "@db", payload: {...}}`
- Action payloads: `{tool: "@core/publishMessage", payload: {target: "@actor/vibe"}}`
- Nested objects and arrays

**Example:**
```javascript
const obj = {
  context: {
    todos: {
      schema: '@schema/todos',
      filter: { done: false }
    }
  },
  actions: [
    {
      tool: '@core/publishMessage',
      payload: {
        target: '@actor/vibe'
      }
    }
  ]
};

transformQueryObjects(obj, coIdMap);
// All @schema/... and @actor/... references are now co-ids
```

---

## Query Object Pattern

### What Are Query Objects?

Query objects are a special pattern used in context schemas to reference data collections:

```json
{
  "todos": {
    "schema": "@schema/todos",
    "filter": { "done": false }
  }
}
```

**Structure:**
- `schema`: Reference to data collection schema
- `filter`: Optional filter criteria

**Transformation:**
- `schema` field is transformed to co-id
- `filter` is preserved as-is

### Runtime Transformation

At runtime, query objects are transformed to arrays:

```javascript
// Before (schema definition):
{
  "todos": {
    "schema": "@schema/todos",
    "filter": { "done": false }
  }
}

// After (runtime data):
{
  "todos": [
    { "id": "1", "text": "Buy milk", "done": false },
    { "id": "2", "text": "Walk dog", "done": false }
  ]
}
```

**Why:** The schema allows both object (query) and array (data) to accommodate this transformation.

---

## Tool Payload Transformation

### Database Tool Payloads

**Pattern:**
```json
{
  "tool": "@db",
  "payload": {
    "schema": "@schema/todos",
    "data": { "text": "Buy milk" }
  }
}
```

**Transformation:**
- `payload.schema` is transformed to co-id
- `payload.data` is preserved as-is

### Action Tool Payloads

**Pattern:**
```json
{
  "tool": "@core/publishMessage",
  "payload": {
    "target": "@actor/vibe",
    "message": { "type": "CREATE_TODO" }
  }
}
```

**Transformation:**
- `payload.target` is transformed to co-id
- `payload.message` is preserved as-is

---

## Helper Functions

### `transformSchemaReference(schemaRef, coIdMap, context)`

Transforms a single schema reference string.

**Example:**
```javascript
const coId = transformSchemaReference('@schema/todos', coIdMap, 'query object');
// Returns: 'co_z123...' or null if not found
```

### `transformTargetReference(targetRef, coIdMap, context)`

Transforms a single target/actor reference string.

**Example:**
```javascript
const coId = transformTargetReference('@actor/vibe', coIdMap, 'tool payload');
// Returns: 'co_z456...' or null if not found
```

### `transformQueryObjectSchema(queryObj, coIdMap)`

Transforms the `schema` field in a query object.

**Example:**
```javascript
const queryObj = { schema: '@schema/todos', filter: {} };
transformQueryObjectSchema(queryObj, coIdMap);
// queryObj.schema is now 'co_z123...'
```

### `transformToolPayload(payload, coIdMap, transformRecursive)`

Transforms tool payload, handling both schema and target references.

**Example:**
```javascript
const payload = {
  schema: '@schema/todos',
  target: '@actor/vibe'
};
transformToolPayload(payload, coIdMap, transformQueryObjects);
// Both schema and target are transformed
```

### `transformActionPayload(action, coIdMap, transformRecursive)`

Transforms action payload, handling target references.

**Example:**
```javascript
const action = {
  tool: '@core/publishMessage',
  payload: {
    target: '@actor/vibe'
  }
};
transformActionPayload(action, coIdMap, transformQueryObjects);
// payload.target is transformed
```

### `transformArrayItems(arr, coIdMap, transformRecursive)`

Transforms array items, handling both action payloads and direct actor references.

**Example:**
```javascript
const arr = [
  { tool: '@core/publishMessage', payload: { target: '@actor/vibe' } },
  '@actor/user'
];
transformArrayItems(arr, coIdMap, transformQueryObjects);
// Both items are transformed
```

---

## Validation During Transformation

### `validateNoNestedCoTypes(schema, path)`

Validates that schemas don't have nested CoJSON types (must use `$co` keyword instead).

**Why:** CoJSON types (comap, colist, costream) can only be at the schema root, not nested in properties.

**Example:**
```javascript
// ❌ Wrong - nested cotype
{
  properties: {
    items: {
      cotype: 'colist'  // Can't nest CoJSON types!
    }
  }
}

// ✅ Correct - use $co instead
{
  properties: {
    items: {
      $co: '@schema/items'  // Reference to colist schema
    }
  }
}
```

**Usage:**
```javascript
const errors = validateNoNestedCoTypes(schema);
if (errors.length > 0) {
  throw new Error(`Nested CoJSON types found: ${errors.join(', ')}`);
}
```

---

## Common Patterns

### Transforming Before Seeding

```javascript
import { transformSchemaForSeeding, transformInstanceForSeeding } from '@MaiaOS/schemata/schema-transformer';

// Build co-id map
const coIdMap = new Map();
for (const [name, schema] of Object.entries(schemas)) {
  const coId = generateCoId(schema);
  coIdMap.set(`@schema/${name}`, coId);
}

// Transform schemas
const transformedSchemas = {};
for (const [name, schema] of Object.entries(schemas)) {
  transformedSchemas[name] = transformSchemaForSeeding(schema, coIdMap);
}

// Transform instances
const transformedInstances = {};
for (const [name, instance] of Object.entries(instances)) {
  transformedInstances[name] = transformInstanceForSeeding(instance, coIdMap);
}
```

### Handling Missing References

```javascript
const coId = coIdMap.get('@schema/todos');
if (!coId) {
  console.warn('No co-id found for @schema/todos');
  // Option 1: Skip transformation (leave as-is)
  // Option 2: Generate co-id on-the-fly
  // Option 3: Throw error (fail fast)
}
```

---

## Troubleshooting

### Problem: "No co-id found for query object schema"

**Solution:** Register data collection schemas before transforming instances:
```javascript
// Phase 1: Register data collection schemas
coIdRegistry.register('@schema/todos', todosCoId);

// Phase 2: Transform instances (now todosCoId is available)
transformInstanceForSeeding(instance, coIdMap);
```

### Problem: Query object not transformed

**Solution:** Make sure you're calling `transformQueryObjects` recursively:
```javascript
// This only transforms top-level
transformQueryObjects(instance, coIdMap);

// For nested structures, transformation is recursive automatically
```

### Problem: "Nested CoJSON types found"

**Solution:** Use `$co` keyword instead of nesting `cotype`:
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
    "items": { "$co": "@schema/items" }
  }
}
```

---

## Source Files

- Main transformer: `libs/maia-schemata/src/schema-transformer.js`
- Helper functions: `libs/maia-schemata/src/schema-transformer.js` (transformSchemaReference, transformTargetReference, etc.)
