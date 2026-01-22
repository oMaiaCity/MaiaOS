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
