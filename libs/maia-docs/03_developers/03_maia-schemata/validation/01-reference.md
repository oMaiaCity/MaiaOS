
**AJV Error:**
```javascript
{
  instancePath: '/properties/name',
  schemaPath: '#/properties/name/type',
  keyword: 'type',
  message: 'must be string',
  params: { type: 'string' }
}
```

**Formatted Error:**
```javascript
{
  instancePath: '/properties/name',
  schemaPath: '#/properties/name/type',
  keyword: 'type',
  message: 'must be string',
  params: { type: 'string' }
}
// Same structure, but consistent formatting
```

**Error Helper:**
```javascript
import { formatValidationErrors } from './validation.helper.js';

const errors = validate.errors || [];
const formatted = formatValidationErrors(errors);
// All errors have consistent structure
```

---

## Meta-Schema Handling

### Base Meta-Schema

**Purpose:** Validates standard JSON Schema schemas

**ID:** `https://json-schema.org/draft/2020-12/schema`

**Location:** `os/base-meta-schema.json`

**Usage:**
- Validates schemas that don't use CoJSON types
- Used for validating the base meta-schema itself (self-validation)

### CoJSON Meta-Schema

**Purpose:** Validates MaiaOS schemas with CoJSON types

**ID:** `@schema/meta`

**Location:** `os/meta.schema.json`

**Features:**
- Extends base meta-schema
- Adds `cotype` keyword (comap, colist, costream)
- Adds `$co` keyword (co-id references)
- Requires `title` field for all schemas

**Usage:**
```json
{
  "$schema": "@schema/meta",
  "title": "Actor Schema",
  "cotype": "comap",
  "properties": {
    "name": { "type": "string" },
    "viewRef": { "$co": "@schema/view" }
  }
}
```

---

## Self-Validation

Meta-schemas can validate themselves, but this creates a circular dependency:

```
Meta-schema validates schemas
  └─> Meta-schema is itself a schema
      └─> Meta-schema validates itself
          └─> (circular!)
```

**Solution:** Temporarily disable schema validation during meta-schema registration:

```javascript
withSchemaValidationDisabled(ajv, () => {
  ajv.addMetaSchema(metaSchema, metaSchema.$id);
});
```

This allows meta-schemas to be registered without validating themselves.

---

## Performance Considerations

### Caching

**Schema Compilation:**
- Schemas are compiled once and cached
- Subsequent validations use cached validators
- Cache key: schema type (e.g., 'actor', 'context')

**Dependency Resolution:**
- Dependencies are resolved once per schema load
- Resolved schemas are registered in AJV (AJV caches internally)
- No redundant resolution

### Lazy Loading

**Schemas:**
- Schemas are loaded on-demand (when `loadSchema()` is called)
- Not all schemas are loaded at startup
- Reduces initial load time

**Meta-Schemas:**
- Base meta-schema loaded during `initialize()`
- CoJSON meta-schema loaded during `initialize()`
- Other meta-schemas loaded on-demand

---

## Common Patterns

### Validating a Single File

```javascript
import { ValidationEngine, getSchema } from '@MaiaOS/schemata';

const engine = new ValidationEngine();
await engine.initialize();

const schema = getSchema('actor');
await engine.loadSchema('actor', schema);

const result = await engine.validate('actor', actorData);
if (!result.valid) {
  throw new Error(`Validation failed: ${result.errors[0].message}`);
}
```

### Validating Multiple Files

```javascript
const types = ['actor', 'context', 'state', 'view'];

// Load all schemas
for (const type of types) {
  const schema = getSchema(type);
  await engine.loadSchema(type, schema);
}

// Validate all files
for (const [type, data] of files) {
  const result = await engine.validate(type, data);
  if (!result.valid) {
    console.error(`${type} validation failed:`, result.errors);
  }
}
```

### Using Schema Resolver

```javascript
const engine = new ValidationEngine();
engine.setSchemaResolver(async (id) => {
  // Load from IndexedDB
  return await dbEngine.backend.getSchema(id);
});

await engine.initialize();

// Now schemas with co-id references will resolve automatically
const schema = {
  $schema: 'co_z123...',  // Will be resolved!
  properties: {
    ref: { $co: 'co_z456...' }  // Will be resolved!
  }
};

await engine.loadSchema('my-type', schema);
```

---

## Troubleshooting

### Problem: "Schema 'actor' not loaded"

**Solution:** Call `loadSchema()` before `validate()`:
```javascript
await engine.loadSchema('actor', actorSchema);
const result = await engine.validate('actor', data);
```

### Problem: "Unknown meta schema 'co_z123...'"

**Solution:** Set schema resolver to resolve co-id references:
```javascript
engine.setSchemaResolver(async (id) => {
  return await dbEngine.backend.getSchema(id);
});
```

### Problem: "Schema resolver returned null for $co reference"

**Solution:** Make sure referenced schema is registered before loading:
```javascript
// Register dependency first
await engine.loadSchema('view', viewSchema);

// Then load schema that references it
await engine.loadSchema('actor', actorSchema);
```

---

## Source Files

- Implementation: `libs/maia-schemata/src/validation.engine.js`
- Helper functions: `libs/maia-schemata/src/validation.helper.js`
- Error formatting: `libs/maia-schemata/src/validation.helper.js` (formatValidationErrors)
- Schema validation toggle: `libs/maia-schemata/src/validation.helper.js` (withSchemaValidationDisabled)
