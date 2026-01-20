# Migration System Quick Reference

**Direct answers to: "Can we build our own migration system?"**

Last updated: 2026-01-20

---

## TL;DR: Your Questions Answered

### Q1: Are we bound to cojson's native migration hooks?

**NO! Absolutely not!**

cojson has **ZERO migration system** for CoValue data. It only has:
- Storage migrations (internal database changes - you don't touch)
- Account migrations (one-time setup hook when creating accounts - you customize)

**You're completely free to build your own migration system!**

---

### Q2: Can we build our own migration system?

**YES! 100%! In fact, you HAVE to!**

cojson doesn't provide any system for migrating existing CoValues. If you want to upgrade schemas over time, you must build it yourself.

**Good news:** This is actually easier than it sounds because:
- CoValues are just CRDTs (they don't care about schemas)
- headerMeta is yours to use however you want
- You can store anything in CoMaps (including migration scripts)

---

### Q3: What does "building our own migration system" mean?

It means creating:

1. **Schema Registry** (CoMap storing schema definitions)
2. **Migration Registry** (CoMap storing migration scripts)
3. **Migration Engine** (JavaScript code that runs migrations)
4. **Version Tracking** (in headerMeta.version)

**All of this is just JavaScript code + CoMaps!**

---

## The Architecture (Super Simple Version)

```
┌─────────────────────────────────────────────────────┐
│ YOUR MIGRATION SYSTEM                               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. Store schemas as CoMaps                         │
│     account.os.schemata.ProfileSchema = CoMap       │
│                                                     │
│  2. Store migrations as CoMaps                      │
│     account.os.migrations["v1_to_v2"] = CoMap       │
│                                                     │
│  3. Write JavaScript migration engine               │
│     function migrate(coValue, from, to) {           │
│       // Load migration script                      │
│       // Apply transformations                      │
│       // Update data                                │
│     }                                               │
│                                                     │
│  4. Run migrations at query time                    │
│     When loading CoValue:                           │
│     - Check headerMeta.version                      │
│     - Compare to schema.version                     │
│     - Run migrations if needed                      │
│                                                     │
└─────────────────────────────────────────────────────┘
                    ↓ uses ↓
┌─────────────────────────────────────────────────────┐
│ COJSON (Unchanged)                                  │
├─────────────────────────────────────────────────────┤
│  • Syncs CoValues (doesn't care about schemas)      │
│  • Stores headerMeta.version (your data)            │
│  • Processes transactions (any JSON operations)     │
└─────────────────────────────────────────────────────┘
```

---

## How headerMeta Works (The Key Insight)

### headerMeta is Immutable JSON

```javascript
// When you create a CoValue:
const profile = group.createMap(
  { name: "Alice" },
  { $schema: "ProfileSchema", version: 1 }  // ← headerMeta
);

// headerMeta is stored in the CoValue header (immutable)
profile.headerMeta;  // { $schema: "ProfileSchema", version: 1 }

// You CANNOT change headerMeta after creation
profile.headerMeta.version = 2;  // ❌ Doesn't work (read-only)
```

### But CoValue Data is Mutable!

```javascript
// You CAN change the data:
profile.set("age", 30);        // ✅ Works!
profile.set("email", "...");   // ✅ Works!
profile.delete("oldField");    // ✅ Works!

// The CRDT doesn't care about schemas!
// It just processes set/delete operations on any key
```

### The Migration Pattern

```javascript
// 1. Load CoValue (created with v1 schema)
const profile = loadCoValue("co_z...");
profile.headerMeta;  // { $schema: "ProfileSchema", version: 1 }
profile.toJSON();    // { name: "Alice" }

// 2. Detect version mismatch
const currentSchema = schemaRegistry.get("ProfileSchema");
currentSchema.version;  // 2 (current version)

if (profile.headerMeta.version < currentSchema.version) {
  // 3. Load migration script
  const migration = migrationRegistry.get("ProfileSchema_1_to_2");
  
  // 4. Apply migration (MODIFY DATA, not headerMeta!)
  migration.addFields.forEach(([key, defaultValue]) => {
    if (!profile.get(key)) {
      profile.set(key, defaultValue);  // ✅ Add new field!
    }
  });
  
  // 5. Data is now v2 compatible
  profile.toJSON();  // { name: "Alice", age: null }
  
  // Note: headerMeta still says version: 1 (immutable!)
  // But data is now v2 compatible!
}
```

---

## Example: Complete Migration Flow

### Step 1: Define Schema v1

```javascript
// Stored in account.os.schemata.ProfileSchema (CoMap)
{
  name: "ProfileSchema",
  version: 1,
  schema: {
    type: "object",
    properties: {
      name: { type: "string" }
    },
    required: ["name"]
  }
}
```

### Step 2: Create CoValue with v1

```javascript
const meta = { $schema: "ProfileSchema", version: 1 };
const profile = group.createMap({ name: "Alice" }, meta);

// Result:
// profile.id = "co_z..."
// profile.headerMeta = { $schema: "ProfileSchema", version: 1 }
// profile.toJSON() = { name: "Alice" }
```

### Step 3: Update Schema to v2

```javascript
// Update schema in registry (CoMap is mutable!)
account.os.schemata.ProfileSchema.set("version", 2);
account.os.schemata.ProfileSchema.set("schema", {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "number" }  // ← New field!
  },
  required: ["name"]
});
```

### Step 4: Create Migration Script

```javascript
// Store in account.os.migrations (CoMap)
const migrationScript = {
  fromVersion: 1,
  toVersion: 2,
  targetSchema: "ProfileSchema",
  script: {
    addFields: {
      age: null  // Default value
    },
    removeFields: [],
    transformFields: {}
  }
};

account.os.migrations.set("ProfileSchema_1_to_2", migrationScript);
```

### Step 5: Load Old CoValue

```javascript
// Load profile created with v1
const profile = loadCoValue("co_z...");

// Detect version mismatch
const { $schema, version } = profile.headerMeta;  // version = 1
const currentSchema = account.os.schemata.get($schema);
const currentVersion = currentSchema.get("version");  // 2

if (version < currentVersion) {
  console.log("Migration needed! Running...");
  
  // Load and apply migration
  const migration = account.os.migrations.get(`${$schema}_${version}_to_${currentVersion}`);
  const { addFields } = migration.script;
  
  // Apply migration (modify data!)
  Object.entries(addFields).forEach(([key, defaultValue]) => {
    if (!profile.get(key)) {
      profile.set(key, defaultValue);
    }
  });
  
  console.log("Migration complete!");
}

// Now safe to use
profile.toJSON();  // { name: "Alice", age: null }
```

---

## Why This Works (The Magic)

### 1. CoValues Don't Care About Schemas

```javascript
// cojson at CRDT level:
CoMap = Map<string, JsonValue>

// It accepts ANY key and ANY value:
coMap.set("name", "Alice");        // ✅
coMap.set("age", 30);              // ✅
coMap.set("anything", {...});      // ✅

// No schema checking at CRDT level!
```

### 2. headerMeta is Just Metadata

```javascript
// headerMeta tells YOU what the data should look like
// But cojson ignores it (except for built-in types)

headerMeta: { $schema: "ProfileSchema", version: 1 }
// ↑ This is YOUR metadata for YOUR system
// cojson just stores it and gives it back to you
```

### 3. Migrations are Just Data Transformations

```javascript
// Migration = JavaScript function that modifies data
function migrate(coValue, migration) {
  // Add fields
  migration.addFields.forEach(([k, v]) => coValue.set(k, v));
  
  // Remove fields
  migration.removeFields.forEach(k => coValue.delete(k));
  
  // Transform fields
  migration.transformFields.forEach(([k, fn]) => {
    const oldValue = coValue.get(k);
    const newValue = fn(oldValue);
    coValue.set(k, newValue);
  });
}

// That's it! No magic, just data manipulation!
```

---

## What You Need to Build

### 1. Schema Registry (CoMap)

```javascript
// account.os.schemata = CoMap of schema CoMaps
const schemaCoMap = group.createMap({
  name: "ProfileSchema",
  version: 2,
  schema: { /* JSON Schema */ }
}, { $schema: "MetaSchema" });

account.os.schemata.set("ProfileSchema", schemaCoMap.id);
```

### 2. Migration Registry (CoMap)

```javascript
// account.os.migrations = CoMap of migration scripts
const migrationCoMap = group.createMap({
  fromVersion: 1,
  toVersion: 2,
  targetSchema: "ProfileSchema",
  script: {
    addFields: { age: null },
    removeFields: [],
    transformFields: {}
  }
}, { $schema: "MigrationScriptSchema" });

account.os.migrations.set("ProfileSchema_1_to_2", migrationCoMap.id);
```

### 3. Migration Engine (JavaScript)

```javascript
class MigrationEngine {
  constructor(schemaRegistry, migrationRegistry) {
    this.schemaRegistry = schemaRegistry;
    this.migrationRegistry = migrationRegistry;
  }
  
  async migrate(coValue) {
    const { $schema, version } = coValue.headerMeta;
    const currentSchema = this.schemaRegistry.get($schema);
    
    if (version >= currentSchema.version) {
      return; // Already up to date!
    }
    
    // Load migration chain
    const migrations = this.getMigrationChain($schema, version, currentSchema.version);
    
    // Apply each migration
    for (const migration of migrations) {
      this.applyMigration(coValue, migration);
    }
  }
  
  applyMigration(coValue, migration) {
    const { addFields, removeFields, transformFields } = migration.script;
    
    // Add fields
    Object.entries(addFields).forEach(([key, defaultValue]) => {
      if (!coValue.get(key)) {
        coValue.set(key, defaultValue);
      }
    });
    
    // Remove fields
    removeFields.forEach(key => coValue.delete(key));
    
    // Transform fields
    Object.entries(transformFields).forEach(([key, transform]) => {
      const oldValue = coValue.get(key);
      const newValue = this.runTransform(transform, oldValue);
      coValue.set(key, newValue);
    });
  }
}
```

### 4. Query Layer Integration

```javascript
async function queryCoValue(schemaName, query) {
  const coValues = findCoValues(schemaName, query);
  
  // Migrate each CoValue before returning
  for (const coValue of coValues) {
    await migrationEngine.migrate(coValue);
  }
  
  return coValues;
}
```

---

## Benefits of This Approach

### 1. Everything is Synced

```
Schemas are CoMaps     → Synced across devices ✅
Migrations are CoMaps  → Synced across devices ✅
Data is CoMaps         → Synced across devices ✅

Your entire migration system is automatically synced!
```

### 2. Migrations are Collaborative

```
User A creates schema v2          → Syncs to User B
User A creates migration script   → Syncs to User B
User B loads old CoValue          → Migration runs automatically!
User B's migrated data            → Syncs back to User A

Everyone stays in sync!
```

### 3. No Breaking Changes to cojson

```
cojson:
  "I sync CRDTs. I don't care what they are."
  
Your migration system:
  "I define what CRDTs mean and how to upgrade them."
  
Perfect separation of concerns!
```

### 4. Runtime-Only (No Build Step)

```javascript
// Schemas are JSON (loaded at runtime)
const schema = await loadSchema("ProfileSchema");

// Migrations are JSON (loaded at runtime)
const migration = await loadMigration("ProfileSchema_1_to_2");

// Validation is runtime (JavaScript)
const valid = validateData(schema, data);

// Migrations run at runtime (JavaScript)
await migrateCoValue(coValue, migration);

// No compilation, no code generation!
```

---

## Common Questions

### Q: Can I change headerMeta after creation?

**No!** headerMeta is immutable (stored in CoValue header). But you CAN change the data!

```javascript
profile.headerMeta.version = 2;  // ❌ Doesn't work (read-only)
profile.set("age", 30);          // ✅ Works!
```

### Q: How do I know which version the data is?

**Use headerMeta.version!** It tells you what version the CoValue was **created** with.

```javascript
const { version } = profile.headerMeta;  // Version at creation time
const currentVersion = schema.version;    // Current schema version

if (version < currentVersion) {
  // Migration needed!
}
```

### Q: Can migrations reference other CoValues?

**YES!** Migrations are just JavaScript functions. They can do anything!

```javascript
const migration = {
  transformFields: {
    authorId: async (oldValue) => {
      // Load author CoValue and extract name
      const author = await loadCoValue(oldValue);
      return author.get("name");
    }
  }
};
```

### Q: What if migration fails?

**Handle it in your engine!**

```javascript
async applyMigration(coValue, migration) {
  try {
    // Apply migration
    this.transformData(coValue, migration);
  } catch (error) {
    console.error("Migration failed:", error);
    // Log error, retry, or rollback
  }
}
```

### Q: Can I test migrations before applying?

**YES!** Use branching or create a test CoValue:

```javascript
// Create test copy
const testCoValue = group.createMap(coValue.toJSON(), coValue.headerMeta);

// Test migration
await migrationEngine.migrate(testCoValue);

// Check result
if (isValid(testCoValue)) {
  // Apply to real CoValue
  await migrationEngine.migrate(coValue);
}
```

---

## Next Steps

1. **Read full guides:**
   - `libs/maia-docs/architecture/cojson-migrations.md` - Complete migration system guide
   - `libs/maia-docs/architecture/cojson-schema-hierarchy.md` - Type system hierarchy

2. **Explore existing code:**
   - `libs/maia-db/src/schemas/` - Schema definitions
   - `libs/maia-db/src/services/schema-service.js` - Schema CoMap creation
   - `libs/maia-db/src/migrations/schema.migration.js` - Account setup migration

3. **Start building:**
   - Define your schema format (JSON Schema recommended)
   - Create schema registry (CoMap storing schema CoMaps)
   - Create migration registry (CoMap storing migration scripts)
   - Build migration engine (JavaScript functions)
   - Integrate with query layer (auto-migrate on load)

---

## Summary: The Freedom You Have

```
┌─────────────────────────────────────────────────────┐
│ WHAT COJSON CONTROLS                                │
├─────────────────────────────────────────────────────┤
│ • CRDT types (CoMap, CoList, CoStream, CoPlainText) │
│ • Sync protocol                                     │
│ • Storage format                                    │
│ • Transaction validation                            │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ WHAT YOU CONTROL (100% Freedom!)                    │
├─────────────────────────────────────────────────────┤
│ • headerMeta contents (any JSON you want)           │
│ • Schema definitions (stored however you like)      │
│ • Migration scripts (stored however you like)       │
│ • Migration execution (run whenever you want)       │
│ • Data transformations (do whatever you want)       │
│ • Validation rules (enforce whatever you want)      │
└─────────────────────────────────────────────────────┘
```

**The answer to "Can we build our own migration system?" is:**

# YES! And you SHOULD!

**cojson gives you the CRDT primitives. Everything else is yours to build!** 🚀
