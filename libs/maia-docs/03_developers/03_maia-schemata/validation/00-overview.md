# Validation Engine

## Overview

The `ValidationEngine` is the heart of MaiaOS's schema validation system. Think of it as a smart quality inspector that checks if your data matches the blueprint (schema) you defined.

**What it does:**
- Loads and compiles JSON schemas using AJV
- Validates data against schemas with detailed error messages
- Resolves schema dependencies ($schema, $co references)
- Supports both human-readable IDs and co-ids
- Handles CoJSON types via custom plugin

---

## The Simple Version

Imagine you're building a LEGO set. The instruction manual (schema) says "use 4 red blocks here." The ValidationEngine is like a friend checking your work - it looks at what you built and says "✅ You used 4 red blocks, perfect!" or "❌ You used 3 red blocks and 1 blue block, that's wrong!"

**Example:**
```javascript
// Schema says: "actor must have a 'name' field that's a string"
const schema = {
  type: 'object',
  properties: {
    name: { type: 'string' }
  },
  required: ['name']
};

// You provide this data:
const data = { name: 'my-actor' };

// ValidationEngine checks:
const result = await engine.validate('actor', data);
// ✅ result.valid = true
```

---

## Architecture

### Core Components

```
ValidationEngine
├── AJV Instance (compiles schemas)
├── Schema Cache (Map<type, validator>)
├── Schema Resolver (resolves co-id references)
└── Meta-Schema Registry (validates schemas themselves)
```

### Initialization Flow

```
1. Create ValidationEngine
   └─> Sets up empty cache and resolver

2. Initialize AJV
   └─> Loads AJV library (local import or CDN fallback)
   └─> Configures AJV options (allErrors, verbose, etc.)
   └─> Registers base meta-schema (JSON Schema Draft 2020-12)
   └─> Registers CoJSON meta-schema (@schema/meta)
   └─> Registers CoJSON plugin (cotype, $co keywords)

3. Load Schemas
   └─> Get schema from registry
   └─> Resolve dependencies ($schema, $co references)
   └─> Compile with AJV
   └─> Cache compiled validator
```

---

## Key Methods

### `initialize()`

Sets up the AJV instance and registers meta-schemas.

**What happens:**
1. Loads AJV library (tries local import, falls back to CDN)
2. Creates AJV instance with validation options
3. Registers base meta-schema (JSON Schema Draft 2020-12)
4. Registers CoJSON meta-schema (@schema/meta)
5. Registers CoJSON plugin (adds `cotype` and `$co` keywords)

**Example:**
```javascript
const engine = new ValidationEngine();
await engine.initialize();
// Now ready to validate!
```

### `loadSchema(type, schema)`

Loads and compiles a schema for a given type.

**What happens:**
1. Checks if schema already loaded (returns cached validator)
2. Resolves all dependencies ($schema, $co references)
3. Registers dependencies in AJV
4. Compiles schema with AJV
5. Caches compiled validator

**Example:**
```javascript
const actorSchema = getSchema('actor');
await engine.loadSchema('actor', actorSchema);
// Schema is now compiled and cached
```

### `validate(type, data)`

Validates data against a loaded schema.

**What happens:**
1. Gets compiled validator from cache
2. Runs data through validator
3. Formats errors (if any)
4. Returns validation result

**Example:**
```javascript
const result = await engine.validate('actor', actorData);
if (!result.valid) {
  console.error('Errors:', result.errors);
  // [
  //   {
  //     instancePath: '/name',
  //     message: 'must be string',
  //     ...
  //   }
  // ]
}
```

### `validateSchemaAgainstMeta(schema)`

Validates a schema itself against its meta-schema.

**What happens:**
1. Determines which meta-schema to use (from `$schema` field)
2. Resolves meta-schema if it's a co-id reference
3. Gets or registers meta-schema validator
4. Validates schema against meta-schema
5. Returns validation result

**Example:**
```javascript
const schema = {
  $schema: '@schema/meta',
  cotype: 'comap',
  properties: { ... }
};

const result = await engine.validateSchemaAgainstMeta(schema);
// Checks if schema follows CoJSON meta-schema rules
```

---

## Dependency Resolution

### How It Works

When loading a schema, the engine must resolve all its dependencies first:

```
Schema A references Schema B via $co
  └─> Load Schema B
      └─> Schema B references Schema C via $co
          └─> Load Schema C
              └─> (no more dependencies)
          └─> Register Schema C in AJV
      └─> Register Schema B in AJV
  └─> Register Schema A in AJV
  └─> Compile Schema A (now all references resolve)
```

### Resolving $schema References

**Human-readable:**
```json
{
  "$schema": "@schema/meta"
}
```
→ Uses `@schema/meta` validator directly

**Co-id reference:**
```json
{
  "$schema": "co_z123..."
}
```
→ Resolves co-id to get meta-schema
→ Determines type (CoJSON vs standard)
→ Uses appropriate validator

### Resolving $co References

**Human-readable:**
```json
{
  "properties": {
    "actorRef": { "$co": "@schema/actor" }
  }
}
```
→ Resolves `@schema/actor` to get schema
→ Registers schema in AJV
→ Compiles property validator

**Co-id reference:**
```json
{
  "properties": {
    "actorRef": { "$co": "co_z123..." }
  }
}
```
→ Resolves co-id to get schema
→ Registers schema in AJV
→ Compiles property validator

---

## Schema Resolver

The schema resolver is a function that loads schemas from the database. MaiaOS uses a **universal schema resolver** (single source of truth) that consolidates all schema resolution logic.

**Purpose:**
- Resolves co-id references to actual schema objects
- Handles reference objects (from IndexedDB mapping)
- Supports both human-readable IDs (`@schema/...`) and co-ids (`co_z...`)
- Extracts schema co-id from CoValue headerMeta (`fromCoValue` pattern)

**Universal Schema Resolver:**

The universal schema resolver is located in `libs/maia-db/src/cojson/schema/schema-resolver.js` and provides:

- `resolveSchema(backend, identifier)` - Resolves schema definition by co-id, registry string, or fromCoValue
- `getSchemaCoId(backend, identifier)` - Gets schema co-id only (doesn't load definition)
- `loadSchemaDefinition(backend, coId)` - Loads schema definition by co-id

**Example:**
```javascript
// Using operations API (recommended - uses universal resolver internally)
const resolver = async (id) => {
  // id could be '@schema/actor' or 'co_z123...'
  // Operations API uses universal resolver internally
  const schemaStore = await dbEngine.execute({ op: 'schema', coId: id });
  return schemaStore.value;
};

engine.setSchemaResolver(resolver, dbEngine); // Pass dbEngine for automatic universal resolver setup
```

**Or use backend's universal resolver directly:**
```javascript
// Direct backend access (if you have backend instance)
const schema = await backend.resolveSchema('@schema/actor');
// or
const schema = await backend.resolveSchema('co_z123...');
// or
const schema = await backend.resolveSchema({ fromCoValue: 'co_z456...' });
```

**How it's used:**
1. During `loadSchema()`, if schema has `$schema: "co_z123..."`, resolver loads the meta-schema
2. During dependency resolution, if schema has `$co: "co_z123..."`, resolver loads the referenced schema
3. All schema resolution goes through the universal resolver (single source of truth)
3. Resolver handles both human-readable IDs and co-ids automatically

---

## Error Formatting

Validation errors are formatted for readability:
