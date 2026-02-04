# MaiaOS Documentation for maia-schemata

**Auto-generated:** 2026-02-04T21:03:09.987Z
**Purpose:** Complete context for LLM agents working with MaiaOS

---

# CO ID GENERATION

*Source: developers/co-id-generation.md*

# Co-ID Generation

## Overview

Co-IDs are unique identifiers used throughout MaiaOS to reference schemas, instances, and data entities. Think of them like social security numbers - each one is unique and can be used to identify something specific.

**What they are:**
- Format: `co_z[A-Za-z0-9]{43}` (e.g., `co_z9h5nwiNynbxnC3nTwPMPkrVaMQ`)
- Currently: Randomly generated (for seeding)
- Future: Content-addressable (hash of content → co-id)

**Why they matter:**
- Enable reference resolution without human-readable mappings
- Support distributed systems (co-ids are globally unique)
- Prepare for CoJSON backend migration

---

## The Simple Version

Imagine you're organizing a library. You could label books with names like "The Great Gatsby" (human-readable), but that's long and can have duplicates. Instead, you give each book a unique ID like "BK-12345" (co-id).

**In MaiaOS:**
- **Human-readable:** `@schema/actor` (easy to read, but not unique globally)
- **Co-id:** `co_z9h5nwiNynbxnC3nTwPMPkrVaMQ` (unique globally, but harder to read)

**During seeding:**
- Generate co-ids for all schemas/instances
- Replace human-readable IDs with co-ids
- Store mappings in CoIdRegistry (for lookup)

---

## Co-ID Format

### Structure

```
co_z + base64-like string (43 characters)
```

**Example:**
```
co_z9h5nwiNynbxnC3nTwPMPkrVaMQ
```

**Breakdown:**
- `co_z`: Prefix (identifies as co-id)
- `9h5nwiNynbxnC3nTwPMPkrVaMQ`: Base64-like string (43 chars)

### Generation

**Current implementation:**
```javascript
const randomBytes = new Uint8Array(32);
crypto.getRandomValues(randomBytes);
const base64 = btoa(String.fromCharCode(...randomBytes))
  .replace(/\+/g, '')
  .replace(/\//g, '')
  .replace(/=/g, '')
  .substring(0, 43);
return `co_z${base64}`;
```

**Future implementation (content-addressable):**
```javascript
// Hash content to generate deterministic co-id
const hash = await crypto.subtle.digest('SHA-256', JSON.stringify(content));
const base64 = btoa(String.fromCharCode(...hash))
  .replace(/\+/g, '')
  .replace(/\//g, '')
  .replace(/=/g, '')
  .substring(0, 43);
return `co_z${base64}`;
```

---

## Co-ID Registry

### Purpose

The `CoIdRegistry` tracks mappings between human-readable IDs and co-ids during seeding.

**Think of it like:** A phone book that maps names to phone numbers.

**Example:**
```
Human-readable ID → Co-ID
@schema/actor     → co_z123...
@schema/context   → co_z456...
@actor/vibe       → co_z789...
```

### Usage

```javascript
import { CoIdRegistry, generateCoId } from '@MaiaOS/schemata/co-id-generator';

const registry = new CoIdRegistry();

// Register mappings
const schemaCoId = generateCoId(schema);
registry.register('@schema/actor', schemaCoId);

const instanceCoId = generateCoId(instance);
registry.register('@actor/vibe', instanceCoId);

// Later, retrieve co-ids
const coId = registry.get('@schema/actor');  // Returns 'co_z123...'
const humanId = registry.getHumanId('co_z123...');  // Returns '@schema/actor'
```

### Methods

**`register(humanId, coId)`**
- Registers a mapping
- Prevents duplicate registrations (throws if different co-id for same human ID)
- Allows one co-id to map to multiple human IDs (aliases)

**`get(humanId)`**
- Returns co-id for human-readable ID
- Returns `null` if not found

**`getHumanId(coId)`**
- Returns human-readable ID for co-id
- Returns first registered human ID (if multiple aliases)
- Returns `null` if not found

**`has(humanId)`**
- Checks if human-readable ID is registered
- Returns `boolean`

**`getAll()`**
- Returns all mappings as `Map`
- Useful for building `coIdMap` for transformation

**`clear()`**
- Clears all registrations
- Useful for testing or reset

---

## Generation Functions

### `generateCoId(content)`

Generates a co-id for any content (schema, instance, data entity, etc.).

**Current behavior:**
- Generates random co-id (ignores `content` parameter)
- Same content → different co-id each time

**Future behavior:**
- Generates deterministic co-id from content hash
- Same content → same co-id (content-addressable)

**Example:**
```javascript
const schemaCoId = generateCoId(schema);
const instanceCoId = generateCoId(instance);
const dataCoId = generateCoId(dataEntity);
```

**Note:** All three functions (`generateCoIdForSchema`, `generateCoIdForInstance`, `generateCoIdForDataEntity`) have been consolidated into a single `generateCoId()` function.

---

## Seeding Process

### Phase 1: Generate Co-IDs for Schemas

```javascript
const schemaCoIdMap = new Map();
const coIdRegistry = new CoIdRegistry();

for (const [name, schema] of Object.entries(schemas)) {
  const coId = generateCoId(schema);
  const schemaKey = `@schema/${name}`;
  
  schemaCoIdMap.set(schemaKey, coId);
  coIdRegistry.register(schemaKey, coId);
}
```

### Phase 2: Generate Co-IDs for Instances

```javascript
const instanceCoIdMap = new Map();

for (const [id, instance] of instances) {
  const coId = generateCoId(instance);
  instanceCoIdMap.set(id, coId);
  coIdRegistry.register(id, coId);
}
```

### Phase 3: Generate Co-IDs for Data Entities

```javascript
for (const item of dataItems) {
  if (!item.$id) {
    item.$id = generateCoId(item);
  }
  // Store with co-id as primary key
}
```

---

## Common Patterns

### Building Co-ID Map for Transformation

```javascript
const coIdMap = new Map();

// Add schema co-ids
for (const [humanId, coId] of coIdRegistry.getAll()) {
  if (humanId.startsWith('@schema/')) {
    coIdMap.set(humanId, coId);
  }
}

// Add instance co-ids
for (const [humanId, coId] of coIdRegistry.getAll()) {
  if (humanId.startsWith('@actor/') || humanId.startsWith('@context/')) {
    coIdMap.set(humanId, coId);
  }
}
```

### Checking if Co-ID Exists

```javascript
const coId = generateCoId(content);

// Check if this co-id is already registered
const existingHumanId = coIdRegistry.getHumanId(coId);
if (existingHumanId) {
  console.log(`Co-id ${coId} already exists for ${existingHumanId}`);
  // Reuse existing co-id or generate new one?
}
```

### Handling Duplicate Registrations

```javascript
try {
  registry.register('@schema/actor', coId1);
  registry.register('@schema/actor', coId2);  // Throws error!
} catch (error) {
  // Error: Co-id already registered for @schema/actor: co_z123... (trying to register co_z456...)
}
```

---

## Future: Content-Addressable Co-IDs

### Why Content-Addressable?

**Current (random):**
- Same content → different co-id each time
- Can't detect duplicates
- Requires registry for lookup

**Future (content-addressable):**
- Same content → same co-id
- Can detect duplicates automatically
- Can verify content integrity
- No registry needed (co-id = content hash)

### Implementation Plan

```javascript
async function generateCoId(content) {
  // Hash content
  const contentString = JSON.stringify(content, Object.keys(content).sort());
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(contentString));
  
  // Convert to base64
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const base64 = btoa(String.fromCharCode(...hashArray))
    .replace(/\+/g, '')
    .replace(/\//g, '')
    .replace(/=/g, '')
    .substring(0, 43);
  
  return `co_z${base64}`;
}
```

**Benefits:**
- Deterministic: Same content always generates same co-id
- Verifiable: Can verify content matches co-id
- Deduplication: Duplicate content automatically detected
- Distributed: Works across systems without coordination

---

## Troubleshooting

### Problem: "Co-id already registered for X"

**Solution:** Check if you're trying to register the same human ID with a different co-id:
```javascript
// If this fails, the human ID is already registered
try {
  registry.register('@schema/actor', newCoId);
} catch (error) {
  // Use existing co-id instead
  const existingCoId = registry.get('@schema/actor');
}
```

### Problem: Co-ID not found during transformation

**Solution:** Make sure co-ids are generated and registered before transformation:
```javascript
// 1. Generate co-ids
const coId = generateCoId(schema);
registry.register('@schema/actor', coId);

// 2. Build co-id map
const coIdMap = new Map(registry.getAll());

// 3. Transform (now co-ids are available)
transformSchemaForSeeding(schema, coIdMap);
```

---

## Source Files

- Co-ID generator: `libs/maia-schemata/src/co-id-generator.js`
- Usage in seeding: `libs/maia-script/src/o/engines/db-engine/backend/indexeddb.js`

---

# COJSON INTEGRATION

*Source: developers/cojson-integration.md*

# CoJSON Integration

## Overview

The `maia-schemata` package extends JSON Schema with support for CoJSON types (CoMap, CoList, CoStream) via a custom AJV plugin. Think of it as adding new words to a language - JSON Schema understands standard types (string, number, object), and we're teaching it to understand CoJSON types too.

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
  "$schema": "@schema/meta",
  "cotype": "comap",
  "properties": {
    "viewRef": { "$co": "@schema/view" }
  }
}
```

This says: "This is a CoMap schema, and the `viewRef` property references the `@schema/view` schema."

---

## Custom Keywords

### `cotype` Keyword

**Purpose:** Validates that data is a CoJSON CRDT type.

**Values:**
- `"comap"`: Collaborative map (object-like)
- `"colist"`: Collaborative list (array-like)
- `"costream"`: Collaborative stream (array-like, append-only)

**Where it's used:** At the schema root only (not in properties).

**Example:**
```json
{
  "$schema": "@schema/meta",
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
  - An object with `items` array: `{$schema: "...", $id: "...", items: [{...}]}`

### `$co` Keyword

**Purpose:** Macro that expands to co-id string validation with schema reference metadata.

**What it expands to:**
```json
{
  "$co": "@schema/view"
}
```

Expands to:
```json
{
  "type": "string",
  "pattern": "^co_z[a-zA-Z0-9]+$",
  "_schemaRef": "@schema/view"
}
```

**Where it's used:** In properties and items (not at schema root).

**Example:**
```json
{
  "properties": {
    "viewRef": { "$co": "@schema/view" },
    "contextRef": { "$co": "@schema/context" }
  }
}
```

**Transformation:**
- Before seeding: `{ "$co": "@schema/view" }` (human-readable)
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
  macro: (schemaCoId) => ({
    type: 'string',
    pattern: '^co_z[a-zA-Z0-9]+$',
    _schemaRef: schemaCoId  // Metadata for transformation
  })
});
```

---

## CoJSON Meta-Schema

### Structure

The CoJSON meta-schema (`os/meta.schema.json`) extends the base JSON Schema meta-schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "@schema/meta",
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
        { "pattern": "^@schema/" }
      ]
    }
  }
}
```

### Vocabulary

**CoJSON Vocabulary:** `https://maiaos.dev/vocab/cojson`

**Purpose:** Indicates that this schema uses CoJSON types.

**Usage:** Schemas with CoJSON types must use `$schema: "@schema/meta"` to enable `cotype` and `$co` keywords.

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
  "$schema": "@schema/meta",
  "title": "Actor Schema",
  "cotype": "comap",
  "properties": {
    "name": { "type": "string" },
    "viewRef": { "$co": "@schema/view" },
    "contextRef": { "$co": "@schema/context" }
  },
  "required": ["name"]
}
```

### CoList Schema

```json
{
  "$schema": "@schema/meta",
  "title": "Todos List Schema",
  "cotype": "colist",
  "items": {
    "$co": "@schema/todo-item"
  }
}
```

### Nested References

```json
{
  "$schema": "@schema/meta",
  "title": "Context Schema",
  "cotype": "comap",
  "properties": {
    "todos": {
      "$co": "@schema/todos"  // References colist schema
    }
  }
}
```

---

## Transformation Flow

### Before Seeding

```json
{
  "$schema": "@schema/meta",
  "cotype": "comap",
  "properties": {
    "viewRef": { "$co": "@schema/view" }
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
- `$schema`: `@schema/meta` → `co_z111...`
- `$co`: `@schema/view` → `co_z222...`
- `cotype`: Unchanged (not a reference)

---

## Troubleshooting

### Problem: "must pass 'cotype' keyword validation"

**Solution:** Add `cotype` to schema root:
```json
{
  "$schema": "@schema/meta",
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
    "items": { "$co": "@schema/items" }
  }
}
```

### Problem: "must be string" for `$co` property

**Solution:** Make sure `$co` value is transformed to co-id:
```javascript
// Before transformation: { "$co": "@schema/view" }  // ❌ Fails validation
// After transformation: { "$co": "co_z123..." }     // ✅ Passes validation
```

---

## Source Files

- Plugin implementation: `libs/maia-schemata/src/ajv-co-types-plugin.js`
- Meta-schema: `libs/maia-schemata/src/os/meta.schema.json`
- Base meta-schema: `libs/maia-schemata/src/os/base-meta-schema.json`

---

# README

*Source: developers/README.md*

# maia-schemata: Schema Validation and Transformation

## Overview

The `maia-schemata` package is MaiaOS's centralized schema validation and transformation system. Think of it as the quality control inspector for your MaiaOS applications - it checks that everything is built correctly before it goes into production.

**What it does:**
- ✅ Validates all `.maia` files against JSON Schema definitions
- ✅ Transforms human-readable references to co-ids during seeding
- ✅ Provides runtime validation for application data
- ✅ Supports CoJSON types (CoMap, CoList, CoStream) via custom AJV plugin

**Why it matters:**
Without schema validation, a typo in a `.maia` file could cause your entire app to break in mysterious ways. The validation system catches these errors early with clear, helpful messages.

---

## The Simple Version

Think of schemas like blueprints for houses. When you're building a house, you need to follow the blueprint exactly - the door can't be where the window should be, and the foundation needs to be the right size.

In MaiaOS:
- **Schemas** = Blueprints (they define what's allowed)
- **Validation** = Quality inspector (checks if you followed the blueprint)
- **Transformation** = Converting your blueprint to the builder's language (human-readable IDs → co-ids)

**Example:**
```javascript
// You write this in your .maia file:
{
  "actor": {
    "name": "my-actor",
    "view": { "type": "div" }
  }
}

// The validation system checks:
// ✅ Does it have a "name"? Yes!
// ✅ Is "name" a string? Yes!
// ✅ Does it have a "view"? Yes!
// ✅ Is "view" a valid view object? Yes!
// Result: ✅ Valid!
```

---

## Package Structure

```
libs/maia-schemata/src/
├── index.js                    # Main exports (schemas, ValidationEngine)
├── validation.engine.js        # Core validation engine (AJV wrapper)
├── validation.helper.js        # Convenience functions (singleton, error formatting)
├── schema-transformer.js       # Transform schemas/instances for seeding
├── co-id-generator.js          # Generate co-ids for seeding
├── schema-loader.js            # Load schemas from IndexedDB
├── ajv-co-types-plugin.js     # AJV plugin for CoJSON types
├── os/                         # Operating system schemas
│   ├── actor.schema.json
│   ├── context.schema.json
│   ├── state.schema.json
│   ├── view.schema.json
│   ├── meta.schema.json        # CoJSON meta-schema
│   └── base-meta-schema.json   # JSON Schema Draft 2020-12 meta-schema
└── data/                       # Application data schemas
    └── todos.schema.json
```

---

## Key Components

### 1. ValidationEngine

The core validation system. Wraps AJV (Another JSON Schema Validator) and adds CoJSON support.

**What it does:**
- Loads and compiles JSON schemas
- Validates data against schemas
- Resolves schema dependencies ($schema, $co references)
- Handles co-id references from IndexedDB

**See:** [Validation Engine Details](./validation.md)

### 2. Schema Transformer

Converts human-readable references to co-ids during the seeding process.

**What it does:**
- Transforms `@schema/actor` → `co_z123...`
- Handles nested query objects (`{schema: "@schema/todos", filter: {...}}`)
- Transforms tool payloads and action targets

**See:** [Schema Transformation](./transformation.md)

### 3. Co-ID Generator

Generates deterministic co-ids for schemas, instances, and data entities.

**What it does:**
- Creates random co-ids in format `co_z[A-Za-z0-9]{43}`
- Tracks mappings via CoIdRegistry
- Currently generates random IDs (future: content-addressable hashing)

**See:** [Co-ID Generation](./co-id-generation.md)

### 4. AJV CoJSON Plugin

Custom AJV plugin that adds support for CoJSON types.

**What it does:**
- Adds `cotype` keyword (validates comap/colist/costream at schema root)
- Adds `$co` keyword (macro for co-id references in properties)
- Handles both direct arrays and wrapped objects for colist/costream

**See:** [CoJSON Integration](./cojson-integration.md)

---

## How It Works

### The Validation Flow

```
1. Load Schema
   └─> Get schema from registry (os/ or data/)
   └─> Compile with AJV
   └─> Cache compiled validator

2. Validate Data
   └─> Run data through compiled validator
   └─> Collect all errors (not just first)
   └─> Format errors for readability

3. Handle Errors
   └─> Show clear error messages
   └─> Point to exact field that failed
   └─> Suggest fixes
```

### The Seeding Flow

```
1. Load Schemas
   └─> Read all schema files from os/ and data/
   └─> Generate co-ids for each schema
   └─> Build dependency graph

2. Transform Schemas
   └─> Replace @schema/... references with co-ids
   └─> Transform $co references
   └─> Preserve structure

3. Transform Instances
   └─> Transform query objects ({schema: "@schema/todos"})
   └─> Transform tool payloads
   └─> Transform action targets

4. Seed to IndexedDB
   └─> Store schemas with co-ids as keys
   └─> Store instances with co-ids as keys
   └─> Register mappings in CoIdRegistry
```

---

## Common Patterns

### Validating a Schema File

```javascript
import { validateOrThrow } from '@MaiaOS/schemata/validation.helper';

try {
  await validateOrThrow('actor', actorData, 'path/to/actor.maia');
  console.log('✅ Valid!');
} catch (error) {
  console.error('❌ Validation failed:', error.message);
}
```

### Getting a Schema

```javascript
import { getSchema } from '@MaiaOS/schemata';

const actorSchema = getSchema('actor');
console.log(actorSchema); // Full JSON Schema object
```

### Transforming for Seeding

```javascript
import { transformSchemaForSeeding } from '@MaiaOS/schemata/schema-transformer';

const coIdMap = new Map([
  ['@schema/actor', 'co_z123...'],
  ['@schema/context', 'co_z456...']
]);

const transformedSchema = transformSchemaForSeeding(actorSchema, coIdMap);
// All @schema/... references are now co-ids
```

### Generating Co-IDs

```javascript
import { generateCoId, CoIdRegistry } from '@MaiaOS/schemata/co-id-generator';

const registry = new CoIdRegistry();
const schemaCoId = generateCoId(schema);
registry.register('@schema/actor', schemaCoId);

// Later, retrieve the co-id
const coId = registry.get('@schema/actor'); // Returns 'co_z123...'
```

---

## Integration Points

### With maia-script

The `maia-script` package uses `maia-schemata` for:
- Validating `.maia` files during parsing
- Transforming schemas/instances before seeding to IndexedDB
- Runtime validation of data operations

**See:** `libs/maia-script/src/o/engines/db-engine/backend/indexeddb.js`

### With maia-db

The `maia-db` package uses `maia-schemata` for:
- Loading schemas from IndexedDB for validation
- Resolving co-id references during validation
- Validating data before create/update operations

### With maia-operations

The `maia-operations` package uses `maia-schemata` for:
- Validating data against schemas in create/update operations
- Loading schemas from database for validation
- Schema validation is enforced by operations (100% migration - no fallbacks)

**See:** `libs/maia-operations/src/operations/create.js` and `libs/maia-operations/src/operations/update.js`

---

## Key Concepts

### Schema Types

**OS Schemas** (`os/`):
- Define MaiaOS system types (actor, context, state, view, etc.)
- Used for validating `.maia` file definitions
- Examples: `actor.schema.json`, `context.schema.json`

**Data Schemas** (`data/`):
- Define application data types (todos, notes, etc.)
- Used for runtime validation of user data
- Examples: `todos.schema.json`

### Meta-Schemas

**Base Meta-Schema** (`base-meta-schema.json`):
- JSON Schema Draft 2020-12 meta-schema
- Validates all standard JSON Schema schemas
- Extracted from hardcoded object to JSON file

**CoJSON Meta-Schema** (`meta.schema.json`):
- Extends base meta-schema with CoJSON vocabulary
- Adds `cotype` and `$co` keywords
- Validates MaiaOS-specific schemas

### Reference Types

**$schema**:
- Points to the meta-schema that validates this schema
- Can be human-readable (`@schema/meta`) or co-id (`co_z123...`)
- Resolved dynamically during validation

**$co**:
- References another schema (for properties/items)
- Can be human-readable (`@schema/actor`) or co-id (`co_z123...`)
- Transformed to co-id during seeding

**$ref**:
- Internal schema reference (within same schema)
- Uses JSON Schema `$ref` syntax (`#/$defs/...`)
- Not transformed (stays as-is)

---

## Troubleshooting

### Problem: "Schema missing required $schema field"

**Solution:** Every schema must declare which meta-schema validates it:
```json
{
  "$schema": "@schema/meta",
  "$id": "@schema/actor",
  ...
}
```

### Problem: "No co-id found for query object schema"

**Solution:** Make sure data collection schemas are registered before transforming instances:
```javascript
// Register data collection schema first
coIdRegistry.register('@schema/todos', todosCoId);

// Then transform instances that reference it
transformInstanceForSeeding(instance, coIdMap);
```

### Problem: "Validation failed: must pass 'cotype' keyword validation"

**Solution:** Add `cotype` to schema root for CoJSON types:
```json
{
  "$schema": "@schema/meta",
  "cotype": "comap",
  "properties": { ... }
}
```

---

## Related Documentation

- [maia-operations Package](../06_maia-operations/README.md) - Operations layer that uses schema validation
- [Schema Definitions](../03_schemas.md) - Schema structure and usage
- [Validation Engine Details](./validation.md) - How ValidationEngine works
- [Schema Transformation](./transformation.md) - How transformation works
- [CoJSON Integration](./cojson-integration.md) - CoJSON types support
- [CoJSON Architecture](../05_maia-db/cojson.md) - CoJSON system overview

---

## Source Files

- Main entry: `libs/maia-schemata/src/index.js`
- Validation engine: `libs/maia-schemata/src/validation.engine.js`
- Validation helper: `libs/maia-schemata/src/validation.helper.js`
- Schema transformer: `libs/maia-schemata/src/schema-transformer.js`
- Co-ID generator: `libs/maia-schemata/src/co-id-generator.js`
- AJV plugin: `libs/maia-schemata/src/ajv-co-types-plugin.js`

---

# TRANSFORMATION

*Source: developers/transformation.md*

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

---

# VALIDATION

*Source: developers/validation.md*

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

---

