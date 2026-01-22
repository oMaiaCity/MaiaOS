# Validation Engine & Roundtrips Analysis

Complete analysis of when schemas and entities get validated during seeding, creating, and loading operations, including how `$co` links work.

## Overview

MaiaOS uses **JSON Schema validation** with AJV for all data validation. The validation engine supports:
- **Schemas**: Validated against meta-schema during seeding
- **Configs/Instances**: Validated when loaded from IndexedDB
- **Application Data**: Validated during create/update operations
- **$co Links**: Custom keyword for CoValue references (validated via AJV plugin)

## Validation Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        SEEDING PHASE                             │
└─────────────────────────────────────────────────────────────────┘

1. SCHEMA VALIDATION (Before Seeding)
   ┌─────────────────────────────────────────────────────────────┐
   │ kernel.js:boot() → ValidationEngine.validateSchemaAgainstMeta() │
   │                                                               │
   │ • All schemas validated against meta-schema                   │
   │ • Meta-schema: @schema/meta (CoJSON) or draft-2020-12        │
   │ • Location: libs/maia-script/src/o/kernel.js:103-112          │
   │ • Throws error if schema invalid                              │
   └─────────────────────────────────────────────────────────────┘
                              ↓
2. SCHEMA TRANSFORMATION (During Seeding)
   ┌─────────────────────────────────────────────────────────────┐
   │ IndexedDBBackend.seed() → transformSchemaForSeeding()        │
   │                                                               │
   │ • Human-readable IDs (@schema/actor) → co-ids (co_z...)     │
   │ • $schema references transformed                              │
   │ • $id references transformed                                  │
   │ • $co keyword values transformed                              │
   │ • $ref references transformed                                │
   │ • Location: libs/maia-schemata/src/schema-transformer.js:14  │
   └─────────────────────────────────────────────────────────────┘
                              ↓
2.5. SCHEMA VALIDATION (After Transformation)
   ┌─────────────────────────────────────────────────────────────┐
   │ IndexedDBBackend.seed() → ValidationEngine.validateSchemaAgainstMeta() │
   │                                                               │
   │ • Transformed schemas validated against their $schema meta-schema │
   │ • Meta-schema loaded from in-memory map or DB                │
   │ • Ensures transformation didn't introduce errors             │
   │ • Location: libs/maia-script/src/o/engines/db-engine/        │
   │   backend/indexeddb.js:146-175                                │
   │ • Throws error if validation fails                           │
   └─────────────────────────────────────────────────────────────┘
                              ↓
3. SCHEMA STORAGE (Validated)
   ┌─────────────────────────────────────────────────────────────┐
   │ IndexedDBBackend._seedSchemas()                              │
   │                                                               │
   │ • Schemas stored with co-ids as keys                         │
   │ • Already validated in steps 1 and 2.5                       │
   │ • Location: libs/maia-script/src/o/engines/db-engine/        │
   │   backend/indexeddb.js:671                                   │
   └─────────────────────────────────────────────────────────────┘
                              ↓
4. INSTANCE TRANSFORMATION (During Seeding)
   ┌─────────────────────────────────────────────────────────────┐
   │ IndexedDBBackend.seed() → transformInstanceForSeeding()      │
   │                                                               │
   │ • Human-readable references → co-ids                        │
   │ • $schema references transformed                             │
   │ • $id set to co-id                                           │
   │ • Reference properties (actor, context, view) transformed   │
   │ • Query objects transformed                                  │
   │ • Location: libs/maia-schemata/src/schema-transformer.js:145 │
   └─────────────────────────────────────────────────────────────┘
                              ↓
4.5. INSTANCE VALIDATION (After Transformation)
   ┌─────────────────────────────────────────────────────────────┐
   │ IndexedDBBackend.seed() → validateAgainstSchemaOrThrow()     │
   │                                                               │
   │ • Transformed instances validated against their $schema schema │
   │ • Schema loaded from DB (seeded in Phase 3)                  │
   │ • Ensures transformation didn't introduce errors             │
   │ • Location: libs/maia-script/src/o/engines/db-engine/        │
   │   backend/indexeddb.js:378-420                                │
   │ • Throws error if validation fails                           │
   └─────────────────────────────────────────────────────────────┘
                              ↓
5. INSTANCE STORAGE (Validated)
   ┌─────────────────────────────────────────────────────────────┐
   │ IndexedDBBackend._seedConfigs()                              │
   │                                                               │
   │ • Configs stored with co-ids as keys                         │
   │ • Already validated in Phase 4.5                             │
   │ • Also validated on load (runtime check)                     │
   │ • Location: libs/maia-script/src/o/engines/db-engine/        │
   │   backend/indexeddb.js:541                                    │
   └─────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                        LOADING PHASE                             │
└─────────────────────────────────────────────────────────────────┘

6. CONFIG/INSTANCE VALIDATION (On Load)
   ┌─────────────────────────────────────────────────────────────┐
   │ ActorEngine.loadActor() → validateAgainstSchemaOrThrow()     │
   │ StateEngine.loadStateDef() → validateOrThrow()                │
   │ ViewEngine.loadView() → validateOrThrow()                    │
   │                                                               │
   │ • Schema loaded from IndexedDB via loadSchemaFromDB()        │
   │ • Instance validated against schema                         │
   │ • Throws error if validation fails                           │
   │ • Location:                                                  │
   │   - libs/maia-script/src/o/engines/actor-engine/            │
   │     actor.engine.js:73-110                                   │
   │   - libs/maia-script/src/o/engines/state-engine/            │
   │     state.engine.js:34-61                                    │
   └─────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                      CREATING PHASE                              │
└─────────────────────────────────────────────────────────────────┘

7. APPLICATION DATA VALIDATION (On Create/Update)
   ┌─────────────────────────────────────────────────────────────┐
   │ CreateOperation.execute() → validateAgainstSchemaOrThrow()    │
   │ UpdateOperation.execute() → validateAgainstSchemaOrThrow()   │
   │                                                               │
   │ • Schema loaded from IndexedDB via loadSchemaFromDB()        │
   │ • Data validated against schema before storage               │
   │ • Throws error if validation fails                           │
   │ • Location:                                                  │
   │   - libs/maia-script/src/o/engines/db-engine/               │
   │     operations/create.js:36-42                               │
   │   - libs/maia-script/src/o/engines/db-engine/               │
   │     operations/update.js:41-47                               │
   └─────────────────────────────────────────────────────────────┘
```

## Detailed Validation Points

### 1. Schema Validation During Seeding

**When:** Before schemas are stored in IndexedDB  
**Where:** `libs/maia-script/src/o/kernel.js:97-113`  
**What:** All schemas validated against meta-schema

```javascript
// kernel.js:boot()
const validationEngine = new ValidationEngine();
await validationEngine.initialize();

console.log('🔍 Validating schemas against meta schema...');
for (const [name, schema] of Object.entries(schemas)) {
  const result = await validationEngine.validateSchemaAgainstMeta(schema);
  if (!result.valid) {
    const errorDetails = result.errors
      .map(err => `  - ${err.instancePath}: ${err.message}`)
      .join('\n');
    console.error(`❌ Schema '${name}' failed meta schema validation:\n${errorDetails}`);
    throw new Error(`Schema '${name}' is not valid JSON Schema`);
  }
}
```

**Meta-Schema Types:**
- `@schema/meta` - CoJSON custom meta-schema (requires `cotype` at root)
- `https://json-schema.org/draft/2020-12/schema` - Standard JSON Schema meta-schema

**What Gets Validated:**
- Schema structure (properties, type, etc.)
- Required fields (`$schema`, `$id`)
- `cotype` keyword (must be `comap`, `colist`, or `costream` at root)
- `$co` keyword syntax (human-readable ID or co-id)
- `$ref` references (validated during schema compilation)

### 2. Schema Transformation During Seeding

**When:** After initial schema validation, before Phase 2.5 validation  
**Where:** `libs/maia-schemata/src/schema-transformer.js:14-79`  
**What:** Human-readable IDs → co-ids

**Transformation Targets:**
- `$schema` field: `@schema/meta` → `co_z...`
- `$id` field: `@schema/actor` → `co_z...`
- `$co` keyword values: `@schema/actor` → `co_z...`
- `$ref` references: `@schema/actor` → `co_z...`
- Nested schemas in `properties`, `$defs`, `items`, `allOf`, `anyOf`, `oneOf`

**Example:**
```javascript
// Before transformation
{
  "$schema": "@schema/meta",
  "$id": "@schema/actor",
  "cotype": "comap",
  "properties": {
    "view": {
      "$co": "@schema/view"  // Human-readable reference
    }
  }
}

// After transformation
{
  "$schema": "co_z123...",  // Meta-schema co-id
  "$id": "co_z456...",      // Actor schema co-id
  "cotype": "comap",
  "properties": {
    "view": {
      "$co": "co_z789..."   // View schema co-id
    }
  }
}
```

### 2.5. Schema Validation After Transformation

**When:** After schema transformation, before storage  
**Where:** `libs/maia-script/src/o/engines/db-engine/backend/indexeddb.js:146-175`  
**What:** Transformed schemas validated against their `$schema` meta-schema

```javascript
// Phase 2.5: Validate transformed schemas against their $schema meta-schema
const { ValidationEngine } = await import('@MaiaOS/schemata/validation.engine.js');
const validationEngine = new ValidationEngine();

// Set up schema resolver for loading meta-schemas
validationEngine.setSchemaResolver(async (schemaKey) => {
  // First check if it's in the transformed schemas map (being seeded)
  if (schemaKey.startsWith('co_z')) {
    for (const schema of Object.values(transformedSchemas)) {
      if (schema.$id === schemaKey) {
        return schema;
      }
    }
  }
  // Fallback: try to load from DB (if already stored)
  return await this.getSchema(schemaKey);
});

await validationEngine.initialize();

// Validate each transformed schema
for (const [name, schema] of Object.entries(transformedSchemas)) {
  const result = await validationEngine.validateSchemaAgainstMeta(schema);
  if (!result.valid) {
    const errorDetails = result.errors
      .map(err => `  - ${err.instancePath}: ${err.message}`)
      .join('\n');
    throw new Error(`Transformed schema '${name}' failed validation:\n${errorDetails}`);
  }
}
```

**What Gets Validated:**
- Transformed schema structure is still valid
- `$schema` co-id reference is valid (meta-schema exists)
- Transformation didn't introduce errors
- All `$co` references resolve correctly

**Why This Matters:**
- Catches transformation errors before storage
- Ensures data integrity from the start
- Prevents invalid schemas from being stored

### 3. Instance Transformation During Seeding

**When:** After schema transformation, before instance storage  
**Where:** `libs/maia-schemata/src/schema-transformer.js:145-302`  
**What:** Human-readable references → co-ids

**Transformation Targets:**
- `$schema` field: `@schema/actor` → `co_z...`
- `$id` field: `@actor/vibe` → `co_z...` (set to co-id)
- Reference properties: `actor`, `context`, `view`, `state`, `interface`, `brand`, `style`
- `children` object: `@actor/child` → `co_z...`
- `items` arrays (subscriptions, inbox): `@actor/vibe` → `co_z...`
- Query objects: `{schema: "@schema/todos"}` → `{schema: "co_z..."}`
- Tool payloads: `{target: "@actor/vibe"}` → `{target: "co_z..."}`

**Example:**
```javascript
// Before transformation
{
  "$schema": "@schema/actor",
  "$id": "@actor/vibe",
  "view": "@view/list",
  "children": {
    "item": "@actor/list-item"
  }
}

// After transformation
{
  "$schema": "co_z456...",  // Actor schema co-id
  "$id": "co_z789...",      // Vibe actor co-id
  "view": "co_z101...",     // List view co-id
  "children": {
    "item": "co_z202..."    // List-item actor co-id
  }
}
```

### 4.5. Instance Validation After Transformation

**When:** After instance transformation, before storage  
**Where:** `libs/maia-script/src/o/engines/db-engine/backend/indexeddb.js:378-420`  
**What:** Transformed instances validated against their `$schema` schema

```javascript
// Phase 4.5: Validate transformed instances against their $schema schemas
const { validateAgainstSchemaOrThrow } = await import('@MaiaOS/schemata/validation.helper.js');
const { setSchemaResolver } = await import('@MaiaOS/schemata/validation.helper.js');

// Set up schema resolver for loading schemas from DB (schemas were just seeded in Phase 3)
setSchemaResolver(async (schemaKey) => {
  return await this.getSchema(schemaKey);
});

// Validate each transformed instance
for (const [configType, configValue] of Object.entries(transformedConfigs)) {
  if (Array.isArray(configValue)) {
    for (const [index, instance] of configValue.entries()) {
      if (instance && instance.$schema) {
        const schema = await this.getSchema(instance.$schema);
        if (schema) {
          await validateAgainstSchemaOrThrow(
            schema,
            instance,
            `${configType}[${index}] (${instance.$id || 'no-id'})`
          );
        }
      }
    }
  } else if (configValue && typeof configValue === 'object' && configValue.$schema) {
    const schema = await this.getSchema(configValue.$schema);
    if (schema) {
      await validateAgainstSchemaOrThrow(
        schema,
        configValue,
        `${configType} (${configValue.$id || 'no-id'})`
      );
    }
  } else if (configValue && typeof configValue === 'object') {
    // Nested objects (e.g., actors: { 'vibe/vibe': {...} })
    for (const [instanceKey, instance] of Object.entries(configValue)) {
      if (instance && instance.$schema) {
        const schema = await this.getSchema(instance.$schema);
        if (schema) {
          await validateAgainstSchemaOrThrow(
            schema,
            instance,
            `${configType}.${instanceKey} (${instance.$id || 'no-id'})`
          );
        }
      }
    }
  }
}
```

**What Gets Validated:**
- Required fields (`$schema`, `$id`)
- Field types and formats
- Reference properties (must be valid co-ids)
- Nested object structures
- Enum values
- Transformation didn't introduce errors

**Why This Matters:**
- Catches transformation errors before storage
- Ensures data integrity from the start
- Prevents invalid instances from being stored
- Errors caught during seeding, not at runtime

### 4. Config/Instance Validation On Load

**When:** When configs/instances are loaded from IndexedDB  
**Where:** Engine load methods (ActorEngine, StateEngine, ViewEngine)  
**What:** Instance validated against its schema

**ActorEngine.loadActor():**
```javascript
// libs/maia-script/src/o/engines/actor-engine/actor.engine.js:73-110
async loadActor(coIdOrConfig) {
  // If pre-loaded config object, validate it
  if (typeof coIdOrConfig === 'object' && coIdOrConfig !== null) {
    const schema = await loadSchemaFromDB(this.dbEngine, 'actor');
    if (schema) {
      await validateAgainstSchemaOrThrow(schema, coIdOrConfig, 'actor');
    }
    return coIdOrConfig;
  }
  
  // Load from IndexedDB
  const actor = await this.dbEngine.execute({
    op: 'query',
    schema: '@schema/actor',
    key: coIdOrConfig
  });
  
  // Validate loaded actor
  const schema = await loadSchemaFromDB(this.dbEngine, 'actor');
  if (schema) {
    await validateAgainstSchemaOrThrow(schema, actor, 'actor');
  }
  
  return actor;
}
```

**StateEngine.loadStateDef():**
```javascript
// libs/maia-script/src/o/engines/state-engine/state.engine.js:34-61
async loadStateDef(stateRef) {
  const stateDef = await this.dbEngine.execute({
    op: 'query',
    schema: '@schema/state',
    key: stateRef
  });
  
  await validateOrThrow('state', stateDef, `maia.db:${stateRef}`);
  this.stateCache.set(stateRef, stateDef);
  return stateDef;
}
```

**What Gets Validated:**
- Required fields (`$schema`, `$id`)
- Field types and formats
- Reference properties (must be valid co-ids)
- Nested object structures
- Enum values

### 5. Application Data Validation On Create/Update

**When:** Before data is stored in IndexedDB  
**Where:** CreateOperation.execute(), UpdateOperation.execute()  
**What:** Data validated against collection schema

**CreateOperation.execute():**
```javascript
// libs/maia-script/src/o/engines/db-engine/operations/create.js:25-47
async execute(params) {
  const { schema, data } = params;
  
  // Validate data against schema before creating
  if (this.dbEngine) {
    const schemaDef = await loadSchemaFromDB(this.dbEngine, schema);
    if (schemaDef) {
      await validateAgainstSchemaOrThrow(schemaDef, data, `create operation for schema ${schema}`);
    }
  }
  
  return await this.backend.create(schema, data);
}
```

**UpdateOperation.execute():**
```javascript
// libs/maia-script/src/o/engines/db-engine/operations/update.js:26-52
async execute(params) {
  const { schema, id, data } = params;
  
  // Validate data against schema before updating
  if (this.dbEngine) {
    const schemaDef = await loadSchemaFromDB(this.dbEngine, schema);
    if (schemaDef) {
      await validateAgainstSchemaOrThrow(schemaDef, data, `update operation for schema ${schema}`);
    }
  }
  
  return await this.backend.update(schema, id, data);
}
```

**What Gets Validated:**
- Required fields
- Field types (string, number, boolean, object, array)
- String constraints (minLength, maxLength, pattern)
- Number constraints (minimum, maximum)
- Enum values
- Nested object structures
- `$co` references (must be valid co-ids matching referenced schema)

## How $co Links Work

### Overview

The `$co` keyword is a **custom AJV keyword** that validates CoValue references. It's a macro that expands to string validation with a co-id pattern.

### AJV Plugin Implementation

**Location:** `libs/maia-schemata/src/ajv-co-types-plugin.js:16-39`

```javascript
ajv.addKeyword({
  keyword: "$co",
  macro: (schemaCoId) => ({
    type: "string",
    pattern: "^co_z[a-zA-Z0-9]+$",
    _schemaRef: schemaCoId  // Store schema co-id for metadata
  }),
  metaSchema: {
    type: "string",
    anyOf: [
      {
        pattern: "^co_z[a-zA-Z0-9]+$",
        description: "Co-id reference (after transformation)"
      },
      {
        pattern: "^@schema/",
        description: "Human-readable schema ID (before transformation)"
      }
    ],
    description: "Reference to schema that this property value must conform to"
  }
})
```

### How $co Works

1. **Schema Definition:**
   ```json
   {
     "properties": {
       "view": {
         "$co": "@schema/view"  // Human-readable (before transformation)
       }
     }
   }
   ```

2. **Schema Transformation:**
   During seeding, `transformSchemaForSeeding()` replaces `@schema/view` with the actual co-id:
   ```json
   {
     "properties": {
       "view": {
         "$co": "co_z789..."  // Co-id (after transformation)
       }
     }
   }
   ```

3. **Validation:**
   When validating an instance, AJV:
   - Expands `$co` macro to: `{type: "string", pattern: "^co_z[a-zA-Z0-9]+$"}`
   - Validates that the property value is a valid co-id string
   - Stores the referenced schema co-id in `_schemaRef` (for future use)

4. **Schema Resolution:**
   The ValidationEngine's `_resolveAndRegisterSchemaDependencies()` method:
   - Finds all `$co` references in schemas
   - Resolves them via `schemaResolver` (loads from IndexedDB)
   - Registers referenced schemas in AJV registry
   - Enables `$ref` resolution during schema compilation

**Location:** `libs/maia-schemata/src/validation.engine.js:596-703`

### $co vs $ref

| Feature | `$co` | `$ref` |
|---------|-------|--------|
| **Purpose** | CoValue reference (runtime entity) | Schema reference (compile-time) |
| **Value Type** | Co-id string (`co_z...`) | Schema co-id or URI |
| **Validation** | Validates co-id pattern | Validates against referenced schema |
| **Usage** | Properties referencing other CoValues | Schemas referencing other schemas |
| **Example** | `"view": {"$co": "co_z789..."}` | `"$ref": "co_z456..."` |

### $co Resolution Flow

```
Schema Definition (with $co)
  ↓
transformSchemaForSeeding() → Replace @schema/name with co-id
  ↓
Store in IndexedDB (with co-id in $co)
  ↓
Load Schema from IndexedDB
  ↓
_resolveAndRegisterSchemaDependencies() → Find $co references
  ↓
schemaResolver($co value) → Load referenced schema from IndexedDB
  ↓
Register referenced schema in AJV registry
  ↓
Compile schema (AJV can resolve $ref to referenced schema)
  ↓
Validate instance (AJV validates $co as co-id string pattern)
```

## Schema Resolution & Dependency Loading

### Schema Resolver

**Location:** `libs/maia-script/src/o/kernel.js:125-133`

```javascript
setSchemaResolver(async (schemaKey) => {
  try {
    return await backend.getSchema(schemaKey);
  } catch (error) {
    console.warn(`[MaiaOS] Failed to resolve schema ${schemaKey}:`, error);
    return null;
  }
});
```

### Dependency Resolution

**Location:** `libs/maia-schemata/src/validation.engine.js:536-723`

The `_resolveAndRegisterSchemaDependencies()` method:
1. Recursively traverses schema object
2. Finds `$schema` references (co-ids)
3. Finds `$co` references (co-ids or human-readable IDs)
4. Resolves each reference via `schemaResolver`
5. Registers resolved schemas in AJV registry (by both co-id and reference)
6. Prevents circular dependencies (tracks `resolvingSchemas` set)

**Key Features:**
- Handles reference objects (`{ $coId: "co_z...", ... }`)
- Prevents infinite loops (tracks resolved schemas)
- Registers schemas with multiple keys (co-id and reference)
- Temporarily disables schema validation during registration (prevents circular dependency errors)

## Validation Engine Architecture

### Components

1. **ValidationEngine** (`libs/maia-schemata/src/validation.engine.js`)
   - Core AJV instance management
   - Schema compilation and caching
   - Meta-schema registration
   - Dependency resolution

2. **ValidationHelper** (`libs/maia-schemata/src/validation.helper.js`)
   - Singleton validation engine
   - Convenience functions (`validate`, `validateOrThrow`, `validateAgainstSchema`)
   - Schema resolver management

3. **AJV CoTypes Plugin** (`libs/maia-schemata/src/ajv-co-types-plugin.js`)
   - `$co` keyword macro
   - `cotype` keyword validator

4. **Schema Loader** (`libs/maia-schemata/src/schema-loader.js`)
   - Loads schemas from IndexedDB
   - Handles co-ids and human-readable keys
   - Resolves reference objects

### Validation Flow Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    VALIDATION ROUNDTRIPS                     │
└─────────────────────────────────────────────────────────────┘

SEEDING:
  1. Schemas validated against meta-schema ✅
  2. Schemas transformed (human-readable → co-ids) ✅
  2.5. Transformed schemas validated against their $schema meta-schema ✅
  3. Schemas stored (validated) ✅
  4. Instances transformed (human-readable → co-ids) ✅
  4.5. Transformed instances validated against their $schema schema ✅
  5. Instances stored (validated) ✅

LOADING:
  6. Configs/instances loaded from IndexedDB ✅
  7. Configs/instances validated against schema ✅

CREATING:
  8. Application data validated against schema ✅
  9. Data stored in IndexedDB ✅

UPDATING:
  10. Application data validated against schema ✅
  11. Data updated in IndexedDB ✅
```

## Key Takeaways

1. **Schemas are validated twice** during seeding:
   - Before transformation (against meta-schema)
   - After transformation (against their $schema meta-schema)
2. **Instances are validated twice**:
   - During seeding (after transformation, before storage)
   - On load (when loaded from IndexedDB)
3. **Application data is validated on create/update** (against collection schema)
4. **$co links** are transformed during seeding and validated as co-id strings
5. **Schema dependencies** are resolved and registered before compilation
6. **Validation happens before storage** - ensures invalid data never gets stored

## Files Reference

- **Validation Engine:** `libs/maia-schemata/src/validation.engine.js`
- **Validation Helper:** `libs/maia-schemata/src/validation.helper.js`
- **Schema Transformer:** `libs/maia-schemata/src/schema-transformer.js`
- **Schema Loader:** `libs/maia-schemata/src/schema-loader.js`
- **AJV Plugin:** `libs/maia-schemata/src/ajv-co-types-plugin.js`
- **Kernel Boot:** `libs/maia-script/src/o/kernel.js:55-134`
- **Backend Seed:** `libs/maia-script/src/o/engines/db-engine/backend/indexeddb.js:95-381`
- **Create Operation:** `libs/maia-script/src/o/engines/db-engine/operations/create.js`
- **Update Operation:** `libs/maia-script/src/o/engines/db-engine/operations/update.js`
- **Actor Engine Load:** `libs/maia-script/src/o/engines/actor-engine/actor.engine.js:73-110`
- **State Engine Load:** `libs/maia-script/src/o/engines/state-engine/state.engine.js:34-61`
