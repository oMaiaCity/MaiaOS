# maia-factories: Schema Validation and Transformation

## Overview

The `maia-factories` package is MaiaOS's centralized schema validation and transformation system. Think of it as the quality control inspector for your MaiaOS applications - it checks that everything is built correctly before it goes into production.

**What it does:**
- ✅ Validates all `.maia` files against JSON Schema definitions
- ✅ Transforms human-readable references to co-ids during seeding
- ✅ Provides runtime validation for application data
- ✅ Supports CoJSON types (CoMap, CoList, CoStream) via custom AJV plugin
- ✅ Resolves MaiaScript expressions in payloads (expression-resolver)
- ✅ Extracts DOM values and resolves MaiaScript expressions (payload-resolver)
- ✅ Validates message payloads against message type schemas

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
libs/maia-factories/src/
├── index.js                    # Main exports (schemas, ValidationEngine)
├── validation.engine.js        # Core validation engine (AJV wrapper)
├── validation.helper.js        # Convenience functions (singleton, error formatting)
├── schema-transformer.js       # Transform schemas/instances for seeding
├── co-id-generator.js          # Generate co-ids for seeding
├── expression-resolver.js      # Universal MaiaScript expression resolver
├── payload-resolver.js         # DOM value extraction + MaiaScript resolution
├── ajv-co-types-plugin.js     # AJV plugin for CoJSON types
├── os/                         # Operating system schemas
│   ├── actor.factory.json
│   ├── context.factory.json
│   ├── state.factory.json
│   ├── view.factory.json
│   ├── meta.factory.json        # CoJSON meta-schema
│   └── maia-script-expression.factory.json  # MaiaScript expression schema
├── data/                       # Application data schemas
│   ├── todos.factory.json
│   └── chat.factory.json
└── message/                    # Message type schemas
    ├── CREATE_BUTTON.factory.json
    ├── DELETE_BUTTON.factory.json
    ├── UPDATE_INPUT.factory.json
    ├── SEND_MESSAGE.factory.json
    └── ... (other message types)
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

**See:** [Validation Engine Details](./validation/)

### 2. Schema Transformer

Converts human-readable references to co-ids during the seeding process.

**What it does:**
- Transforms `@factory/actor` → `co_z123...`
- Handles nested query objects (`{factory: "@factory/todos", filter: {...}}`)
- Transforms tool payloads and action targets

**See:** [Schema Transformation](./transformation.md)

### 3. Co-ID Generator

Generates deterministic co-ids for schemas, instances, and data entities.

**What it does:**
- Creates random co-ids in format `co_z[A-Za-z0-9]{43}`
- Tracks mappings via CoIdRegistry
- Currently generates random IDs (future: content-addressable hashing)

**See:** [Co-ID Generation](./co-id-generation.md)

### 4. Expression Resolver

Universal resolver for MaiaScript expressions in payloads.

**What it does:**
- Resolves MaiaScript expressions (`$context`, `$$item`, `$if`, `$eq`, etc.)
- Handles recursive resolution in arrays and objects
- Used by ViewEngine, StateEngine, and Operations to eliminate duplication

**Key Functions:**
- `resolveExpressions(payload, evaluator, data)` - Resolve all expressions in payload
- `containsExpressions(payload)` - Check if payload contains unresolved expressions

**See:** `libs/maia-factories/src/expression-resolver.js`

### 5. Payload Resolver

Two-stage payload resolution: DOM markers → MaiaScript expressions.

**What it does:**
- Extracts DOM marker values (`@inputValue`, `@dataColumn`) - view layer only
- Resolves MaiaScript expressions (`$context`, `$$item`, `$$result`) - state machine layer
- Eliminates dual resolution - View extracts DOM, State resolves MaiaScript

**Key Functions:**
- `extractDOMValues(payload, element)` - Extract DOM markers only, preserve MaiaScript
- `resolveMaiaScript(payload, evaluator, context, item, result)` - Resolve MaiaScript expressions

**See:** `libs/maia-factories/src/payload-resolver.js`

### 6. Validation Plugin Registry (Pluggable Validation)

Validation is extensible via `ValidationPluginRegistry`. Plugins register keywords and formats with AJV.

**Built-in plugins:**
- **@factories/cojson** – `cotype`, `$co`, `indexing` keywords
- **@factories/cotext** – `grapheme` format, `cotext` keyword for plaintext colists

**Adding custom plugins:**
```javascript
import { ValidationEngine, ValidationPluginRegistry } from '@MaiaOS/factories'

const registry = new ValidationPluginRegistry()
registry.registerPlugin('my-plugin', {
  keywords: [{ keyword: 'myKeyword', validate: () => true, metaSchema: { type: 'boolean' } }],
  formats: [{ name: 'myFormat', definition: { type: 'string', validate: (s) => s.length > 0 } }]
})

const engine = new ValidationEngine({ validationPluginRegistry: registry })
```

**See:** [CoJSON Integration](./cojson-integration.md)

### 7. CoText Schema (Plaintext Colists)

CoText = `cotype: colist` with `items.format: grapheme`. Extends colist, no new root keywords.

**Schema:** `°Maia/factory/os/cotext`
```json
{ "cotype": "colist", "items": { "type": "string", "format": "grapheme" } }
```

**Valid data:** `['H','e','l','l','o']` – each item is one Unicode grapheme.

### 8. Message Type Schemas

Schemas for validating message payloads in actor communication.

**What it does:**
- Defines payload structure for each message type (CREATE_BUTTON, UPDATE_INPUT, etc.)
- Used by ActorEngine to validate messages before routing to state machines
- Message type schema IS the payload schema (merged concept)

**Available Message Types:**
- `CREATE_BUTTON`, `DELETE_BUTTON`, `TOGGLE_BUTTON`
- `UPDATE_INPUT`, `SWITCH_VIEW`
- `SEND_MESSAGE`, `SELECT_NAV`, `SELECT_ROW`
- `SUCCESS`, `ERROR`, `RETRY`, `DISMISS`

**See:** `libs/maia-factories/src/message/`

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
   └─> Replace @factory/... references with co-ids
   └─> Transform $co references
   └─> Preserve structure

3. Transform Instances
   └─> Transform query objects ({factory: "@factory/todos"})
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
import { validateAgainstFactoryOrThrow } from '@MaiaOS/factories/validation.helper';

try {
  await validateAgainstFactoryOrThrow(schema, actorData, { path: 'path/to/actor.maia' });
  console.log('✅ Valid!');
} catch (error) {
  console.error('❌ Validation failed:', error.message);
}
```

### Getting a Schema

```javascript
import { getFactory } from '@MaiaOS/factories';

const actorSchema = getFactory('actor');
console.log(actorSchema); // Full JSON Schema object
```

### Transforming for Seeding

```javascript
import { transformSchemaForSeeding } from '@MaiaOS/factories/factory-transformer';

const coIdMap = new Map([
  ['@factory/actor', 'co_z123...'],
  ['@factory/context', 'co_z456...']
]);

const transformedSchema = transformSchemaForSeeding(actorSchema, coIdMap);
// All @factory/... references are now co-ids
```

### Generating Co-IDs

```javascript
import { generateCoId, CoIdRegistry } from '@MaiaOS/factories/co-id-generator';

const registry = new CoIdRegistry();
const factoryCoId = generateCoId(schema);
registry.register('@factory/actor', factoryCoId);

// Later, retrieve the co-id
const coId = registry.get('@factory/actor'); // Returns 'co_z123...'
```

---

## Integration Points

### With maia-engines

The `maia-engines` package uses `maia-factories` for:
- Validating `.maia` files during parsing
- Transforming schemas/instances before seeding to IndexedDB
- Runtime validation of data operations

**See:** `libs/maia-engines/src/engines/data.engine.js`

### With maia-db

The `maia-db` package uses `maia-factories` for:
- Loading schemas from IndexedDB for validation
- Resolving co-id references during validation
- Validating data before create/update operations

### With maia-operations

The `maia-operations` package uses `maia-factories` for:
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
- Examples: `actor.factory.json`, `context.factory.json`

**Data Schemas** (`data/`):
- Define application data types (todos, notes, etc.)
- Used for runtime validation of user data
- Examples: `todos.factory.json`, `chat.factory.json`

**Message Type Schemas** (`message/`):
- Define payload structure for actor-to-actor messages
- Used by ActorEngine for message validation before state machine routing
- Examples: `CREATE_BUTTON.factory.json`, `UPDATE_INPUT.factory.json`

### Meta-Schemas

**Base Meta-Schema** (`base-meta-schema.json`):
- JSON Schema Draft 2020-12 meta-schema
- Validates all standard JSON Schema schemas
- Extracted from hardcoded object to JSON file

**CoJSON Meta-Schema** (`meta.factory.json`):
- Extends base meta-schema with CoJSON vocabulary
- Adds `cotype` and `$co` keywords
- Validates MaiaOS-specific schemas

### Reference Types

**$schema**:
- Points to the meta-schema that validates this schema
- Can be human-readable (`@factory/meta`) or co-id (`co_z123...`)
- Resolved dynamically during validation

**$co**:
- References another schema (for properties/items)
- Can be human-readable (`@factory/actor`) or co-id (`co_z123...`)
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
  "$factory": "@factory/meta",
  "$id": "@factory/actor",
  ...
}
```

### Problem: "No co-id found for query object schema"

**Solution:** Make sure data collection schemas are registered before transforming instances:
```javascript
// Register data collection schema first
coIdRegistry.register('@factory/todos', todosCoId);

// Then transform instances that reference it
transformInstanceForSeeding(instance, coIdMap);
```

### Problem: "Validation failed: must pass 'cotype' keyword validation"

**Solution:** Add `cotype` to schema root for CoJSON types:
```json
{
  "$factory": "@factory/meta",
  "cotype": "comap",
  "properties": { ... }
}
```

---

## Related Documentation

- [maia-operations Package](../06_maia-operations/README.md) - Operations layer that uses schema validation
- [Schema Definitions](../03_schemas.md) - Schema structure and usage
- [Validation Engine Details](./validation/) - How ValidationEngine works
- [Schema Transformation](./transformation.md) - How transformation works
- [CoJSON Integration](./cojson-integration.md) - CoJSON types support
- [CoJSON Architecture](../05_maia-db/cojson.md) - CoJSON system overview

---

## Source Files

- Main entry: `libs/maia-factories/src/index.js`
- Validation engine: `libs/maia-factories/src/validation.engine.js`
- Validation helper: `libs/maia-factories/src/validation.helper.js`
- Schema transformer: `libs/maia-factories/src/schema-transformer.js`
- Co-ID generator: `libs/maia-factories/src/co-id-generator.js`
- Expression resolver: `libs/maia-factories/src/expression-resolver.js`
- Payload resolver: `libs/maia-factories/src/payload-resolver.js`
- Validation plugins: `libs/maia-factories/src/plugins/` (cojson.plugin.js, cotext.plugin.js)
- AJV plugin: `libs/maia-factories/src/ajv-co-types-plugin.js`
- Message schemas: `libs/maia-factories/src/message/`
