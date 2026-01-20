# cojson Migrations System Explained

**Understanding migrations in cojson and how to build your own**

Last updated: 2026-01-20

---

## Overview

In cojson, there are **TWO COMPLETELY DIFFERENT** types of migrations:

1. **Storage Migrations** - SQL database schema changes (like adding tables)
2. **Account Migrations** - Setting up new user data when accounts are created

They're totally different things that happen to share the word "migration"! Let's understand each one.

---

## Part 1: Storage Migrations (The Database Kind)

### What Are They?

Storage migrations are like **remodeling your house's storage rooms**. When cojson needs to change how it stores data in SQLite, it runs SQL commands to add new tables or columns.

**File:** `libs/maia-db/node_modules/cojson/src/storage/sqlite/sqliteMigrations.ts`

### Example

```typescript
export const migrations: Record<number, string[]> = {
  1: [
    `CREATE TABLE IF NOT EXISTS transactions (...)`,
    `CREATE TABLE IF NOT EXISTS sessions (...)`,
    `CREATE TABLE IF NOT EXISTS coValues (...)`
  ],
  3: [
    `CREATE TABLE IF NOT EXISTS signatureAfter (...)`,
    `ALTER TABLE sessions ADD COLUMN bytesSinceLastSignature INTEGER;`
  ],
  4: [
    `CREATE TABLE IF NOT EXISTS unsynced_covalues (...)`
  ]
};
```

### How It Works

1. **Check version**: "What's the current database version?" (e.g., version 1)
2. **Find needed migrations**: "What migrations haven't run yet?" (e.g., 3, 4)
3. **Run SQL commands**: Execute each migration's SQL statements in order
4. **Update version**: "Now we're at version 4!"

### Key Points

- **Only runs once** - Each migration runs exactly once per database
- **You don't touch these** - These are cojson's internal database structure
- **Automatic** - Happens when you call `initSyncedDatabase()` or similar
- **Not about your data** - Just about how cojson stores transactions internally

---

## Part 2: Account Migrations (The Setup Kind)

### What Are They?

Account migrations are like **setting up a new user's starter kit**. When someone creates a new account, you run code to create their initial profile, folders, settings, etc.

**Think of it like:** When you get a new phone, it creates your first photo album, contacts folder, and settings - that's an "account migration"!

### The Function Type

```typescript
export type RawAccountMigration<Meta extends AccountMeta = AccountMeta> = (
  account: RawAccount<Meta>,
  node: LocalNode,
  creationProps?: unknown,
) => Promise<void>;
```

### When Does It Run?

```typescript
// Creating a NEW account - migration runs ONCE
LocalNode.withNewlyCreatedAccount({
  creationProps: { name: "Alice" },
  migration: async (account, node, creationProps) => {
    // Your custom setup code here!
    // This runs ONCE when account is created
  }
});

// Loading EXISTING account - migration runs EVERY TIME
LocalNode.withLoadedAccount({
  accountID: "co_z...",
  migration: async (account, node) => {
    // This runs EVERY time the account loads
    // Used for fixing/updating existing accounts
  }
});
```

### MaiaOS Example

**File:** `libs/maia-db/src/migrations/schema.migration.js`

```javascript
export async function schemaMigration(account, node, creationProps) {
  const { name } = creationProps;
  
  // 1. Create a Group (like a folder)
  const profileGroup = node.createGroup();
  
  // 2. Create Profile with schema metadata
  const profileMeta = { $schema: "ProfileSchema" };
  const profile = profileGroup.createMap(
    { name },
    profileMeta  // ← Your schema goes here!
  );
  
  // 3. Create other CoValues (lists, streams, text, etc.)
  const activityStream = profileGroup.createStream({ $schema: "ActivityStreamSchema" });
  const bioText = profileGroup.createPlainText(`Hi, I'm ${name}!`, { $schema: "BioTextSchema" });
  
  // 4. Link profile to account (REQUIRED!)
  account.set("profile", profile.id, "trusting");
  
  console.log("🎉 Account setup complete!");
}
```

### Key Points

- **Custom code** - You write whatever setup logic you want
- **Runs when account is created** - Only once for `withNewlyCreatedAccount`
- **Can run on load** - Use `withLoadedAccount` migration to fix existing accounts
- **Must set account.profile** - cojson requires this!

---

## Part 3: Understanding headerMeta (Your Schema System)

### What Is headerMeta?

Every CoValue has a `headerMeta` property - it's **metadata stored in the CoValue's header** that never changes after creation.

```typescript
interface RawCoValue {
  id: CoID<this>;
  type: "comap" | "colist" | "costream" | "coplaintext";
  headerMeta: JsonObject | null;  // ← YOUR DATA HERE!
  group: RawGroup;
  // ...
}
```

### The Beautiful Truth

```
┌─────────────────────────────────────────────────────┐
│  CoValue = CRDT Primitive + headerMeta              │
│                                                     │
│  ┌──────────────────────────────────────────┐      │
│  │ CoValue Header (immutable)               │      │
│  │  • type: "comap"                         │      │
│  │  • ruleset: { type: "group", ... }       │      │
│  │  • headerMeta: { $schema: "MySchema" }   │ ← YOU│
│  │  • createdAt: 1234567890                 │      │
│  └──────────────────────────────────────────┘      │
│           ↓                                         │
│  ┌──────────────────────────────────────────┐      │
│  │ CoValue Content (mutable CRDT)           │      │
│  │  • ops: [...]                            │      │
│  │  • latest: {...}                         │      │
│  │  • transactions: [...]                   │      │
│  └──────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────┘
```

### You Can Store ANYTHING in headerMeta!

```javascript
// Example 1: Schema reference
const meta1 = { $schema: "ProfileSchema" };

// Example 2: Schema + config
const meta2 = { 
  $schema: "ProfileSchema",
  version: 1,
  encrypted: true,
  migrations: [
    { from: 0, to: 1, script: "upgrade-v1.js" }
  ]
};

// Example 3: Pure JSON Schema
const meta3 = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    name: { type: "string" }
  }
};
```

### Critical Insights

1. **headerMeta is immutable** - Set at creation time, never changes
2. **It's just JSON** - Store whatever you want (max ~10KB recommended)
3. **cojson doesn't care** - It just stores it, doesn't interpret it
4. **You can read it anytime** - `coValue.headerMeta` or `coValue.core.verified.header.meta`

---

## Part 4: Can You Build Your Own Migration System?

### Short Answer: YES! 100%!

cojson **doesn't have a data migration system** - it only has:
- Storage migrations (internal database changes)
- Account migrations (one-time setup when account is created)

**There's NO system for migrating existing CoValue data!**

### What "Your Own Migration System" Means

You want to **upgrade existing CoValues** when schemas change. For example:

```javascript
// Version 1 schema
{ name: "Alice" }

// Version 2 schema (added age field)
{ name: "Alice", age: null, version: 2 }

// You need a system to upgrade v1 → v2!
```

### The Beautiful Part: You're Already Free!

Under the hood:
- **CoValues are just CRDTs** - They don't know or care about schemas
- **Schemas live in headerMeta** - Immutable metadata you control
- **Data is just JSON** - No type enforcement at CRDT level

This means:

```javascript
// CoValue at CRDT level (what cojson sees):
{
  id: "co_z...",
  type: "comap",  // Just a map!
  headerMeta: { $schema: "ProfileSchema", version: 1 },  // Your stuff
  ops: [
    { op: "set", key: "name", value: "Alice" },
    { op: "set", key: "age", value: 30 }
  ]
}

// cojson doesn't care if you:
// - Add new keys
// - Remove keys  
// - Change value types
// - Update headerMeta reference

// It's just a CRDT map doing map things! 🎉
```

---

## Part 5: Building Your Custom Migration System

### Strategy 1: Store Migrations in headerMeta

```javascript
// At creation time
const meta = {
  $schema: "ProfileSchema",
  version: 2,
  migrations: {
    "1→2": {
      script: "add-age-field",
      date: "2026-01-20"
    }
  }
};

const profile = group.createMap({ name: "Alice" }, meta);
```

**Pros:**
- Migration history is embedded in each CoValue
- Immutable record of what migrations happened

**Cons:**
- headerMeta is immutable (can't add new migrations later)
- Can't update migration scripts after creation

### Strategy 2: Store Migrations as Separate CoValues

```javascript
// Create a migrations registry (CoMap)
const migrationRegistry = group.createMap({}, { $schema: "MigrationRegistrySchema" });

// Store each migration as a CoMap
const migration_v1_to_v2 = group.createMap({
  fromVersion: 1,
  toVersion: 2,
  targetSchema: "ProfileSchema",
  script: {
    addFields: ["age"],
    defaultValues: { age: null }
  }
}, { $schema: "MigrationScriptSchema" });

migrationRegistry.set("ProfileSchema_1_to_2", migration_v1_to_v2.id);
```

**Pros:**
- Migrations are CoValues themselves (synced, collaborative)
- Can update migration scripts (they're mutable CoMaps)
- Can add new migrations anytime
- Migrations can reference other CoValues

**Cons:**
- More complex to set up
- Need to load migration registry before checking schemas

### Strategy 3: Hybrid Approach (RECOMMENDED)

```javascript
// Store version in headerMeta (immutable)
const meta = {
  $schema: "ProfileSchema",
  version: 1  // ← Version is in headerMeta
};

// Store migrations in a separate system (mutable)
// This is stored in account.os.migrations (a CoMap)
const migrations = account.get("os")?.migrations;

// Migration script stored as JSON in a CoMap
migrations.set("ProfileSchema_1_to_2", {
  fromVersion: 1,
  toVersion: 2,
  script: {
    addFields: ["age"],
    removeFields: [],
    transformFields: {}
  }
});

// When loading a CoValue:
async function loadWithMigration(coValueId) {
  const coValue = node.getCoValue(coValueId).getCurrentContent();
  const { $schema, version } = coValue.headerMeta;
  
  // Get current schema version
  const currentVersion = schemaRegistry.get($schema).version;
  
  if (version < currentVersion) {
    // Run migrations!
    await runMigrations(coValue, version, currentVersion);
  }
  
  return coValue;
}
```

**Pros:**
- Version is immutable (in headerMeta) - tells you what version data was created with
- Migration scripts are mutable (in CoMaps) - can update/fix bugs
- Clean separation of concerns
- Can add new migrations without recreating CoValues

---

## Part 6: Runtime Migration System Architecture

### Core Concepts

```
┌─────────────────────────────────────────────────────────────┐
│ YOUR MIGRATION SYSTEM (Runtime, JSON-based)                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Schema Registry (CoMap)                                 │
│     • Stores all schema definitions as JSON                 │
│     • Each schema has a current version                     │
│     • Stored in account.os.schemata                         │
│                                                             │
│  2. Migration Registry (CoMap)                              │
│     • Stores migration scripts as JSON                      │
│     • Key: "SchemaName_v1_to_v2"                            │
│     • Value: { addFields, removeFields, transform }         │
│     • Stored in account.os.migrations                       │
│                                                             │
│  3. Migration Engine (Runtime JavaScript)                   │
│     • Detects version mismatches                            │
│     • Loads migration chain                                 │
│     • Applies transformations                               │
│     • Updates CoValue data (adds/removes/transforms fields) │
│                                                             │
│  4. CoValue Wrapper (Auto-migration)                        │
│     • Intercepts CoValue loads                              │
│     • Checks headerMeta.version vs schema.version           │
│     • Runs migrations if needed                             │
│     • Returns migrated data                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
            ↓ uses ↓
┌─────────────────────────────────────────────────────────────┐
│ COJSON (Unchanged)                                          │
├─────────────────────────────────────────────────────────────┤
│  • CoValues are just CRDTs (don't care about schemas)       │
│  • headerMeta stores your version metadata                  │
│  • Transactions sync normally                               │
│  • No awareness of your migration system                    │
└─────────────────────────────────────────────────────────────┘
```

### Example Implementation

```javascript
// 1. Schema stored as CoMap
const schemaCoMap = group.createMap({
  name: "ProfileSchema",
  version: 2,
  schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" }  // Added in v2
    }
  }
}, { $schema: "MetaSchema" });

// 2. Migration stored as CoMap
const migrationCoMap = group.createMap({
  fromVersion: 1,
  toVersion: 2,
  targetSchema: "ProfileSchema",
  date: "2026-01-20",
  script: {
    addFields: {
      age: null  // Default value
    },
    removeFields: [],
    transformFields: {}
  }
}, { $schema: "MigrationScriptSchema" });

// 3. Runtime migration engine
class MigrationEngine {
  async migrateCoValue(coValue) {
    const { $schema, version } = coValue.headerMeta;
    const currentSchema = await this.schemaRegistry.get($schema);
    
    if (version >= currentSchema.version) {
      return coValue; // Already up to date!
    }
    
    // Load migration chain
    const migrations = await this.getMigrationChain($schema, version, currentSchema.version);
    
    // Apply each migration
    for (const migration of migrations) {
      await this.applyMigration(coValue, migration);
    }
    
    return coValue;
  }
  
  async applyMigration(coValue, migration) {
    const { addFields, removeFields, transformFields } = migration.script;
    
    // Add new fields
    for (const [key, defaultValue] of Object.entries(addFields)) {
      if (!coValue.get(key)) {
        coValue.set(key, defaultValue);
      }
    }
    
    // Remove old fields
    for (const key of removeFields) {
      coValue.delete(key);
    }
    
    // Transform fields
    for (const [key, transform] of Object.entries(transformFields)) {
      const oldValue = coValue.get(key);
      const newValue = this.runTransform(transform, oldValue);
      coValue.set(key, newValue);
    }
    
    console.log(`✅ Migrated ${coValue.id} from v${migration.fromVersion} to v${migration.toVersion}`);
  }
}
```

---

## Part 7: Are You Bound to cojson's System?

### NO! You're completely free!

**What cojson provides:**
- ✅ Storage migrations (database schema changes) - automatic
- ✅ Account migrations (initial account setup) - one hook
- ❌ Data migrations (upgrading existing CoValues) - **NOTHING!**

**What you control:**
- ✅ headerMeta contents (any JSON you want)
- ✅ Schema definitions (stored however you like)
- ✅ Migration scripts (stored however you like)
- ✅ Migration execution (run whenever you want)
- ✅ Data transformations (do whatever you want)

### Why This is Amazing

```
cojson's Job:
  "I sync CRDTs. I don't care what they mean."
  
Your Job:
  "I define what CRDTs mean (schemas) and how to upgrade them (migrations)."
```

This separation is **PERFECT** because:

1. **cojson stays simple** - Just CRDT sync, no schema complexity
2. **You stay flexible** - Build migrations however you want
3. **No conflicts** - cojson never interferes with your system
4. **Future-proof** - Can completely change your approach without touching cojson

---

## Part 8: Recommended Architecture

### For MaiaOS

```javascript
// In account.os (created during schemaMigration)
account.os = {
  data: CoMap,      // User's actual data
  groups: CoMap,    // User's groups/folders
  schemata: CoMap,  // Schema definitions (CoMaps with JSON Schema)
  migrations: CoMap // Migration scripts (CoMaps with transformation logic)
};

// Each schema is a CoMap
account.os.schemata.ProfileSchema = {
  id: "co_z...",  // ProfileSchema CoMap ID
  name: "ProfileSchema",
  version: 2,
  schema: { /* JSON Schema */ }
};

// Each migration is a CoMap
account.os.migrations["ProfileSchema_1_to_2"] = {
  id: "co_z...",  // Migration CoMap ID
  fromVersion: 1,
  toVersion: 2,
  targetSchema: "ProfileSchema",
  script: { /* transformation logic */ }
};
```

### Migration Flow

```javascript
// 1. User loads their account
const node = await LocalNode.withLoadedAccount({
  accountID: "co_z...",
  accountSecret: secret,
  migration: async (account, node) => {
    // Optional: Run migrations on load if needed
    await autoMigrateAccount(account, node);
  }
});

// 2. User queries for a CoValue
const profile = await queryCoValue("ProfileSchema", { name: "Alice" });

// 3. Migration engine intercepts (if needed)
async function queryCoValue(schemaName, query) {
  const coValues = findCoValues(schemaName, query);
  
  for (const coValue of coValues) {
    // Check if migration needed
    const { version } = coValue.headerMeta;
    const currentVersion = schemaRegistry.get(schemaName).version;
    
    if (version < currentVersion) {
      await migrationEngine.migrate(coValue, version, currentVersion);
    }
  }
  
  return coValues;
}
```

---

## Part 9: Practical Examples

### Example 1: Simple Field Addition

```javascript
// Version 1: Profile has only name
const profileV1 = { name: "Alice" };
// headerMeta: { $schema: "ProfileSchema", version: 1 }

// Version 2: Profile adds age
const migrationScript = {
  addFields: { age: null },
  removeFields: [],
  transformFields: {}
};

// After migration:
const profileV2 = { name: "Alice", age: null };
// headerMeta: { $schema: "ProfileSchema", version: 1 } (UNCHANGED!)
// But data is now v2 compatible
```

### Example 2: Field Rename

```javascript
// Version 1: fullName
const profileV1 = { fullName: "Alice Smith" };

// Version 2: Rename to name
const migrationScript = {
  addFields: {},
  removeFields: ["fullName"],
  transformFields: {
    name: {
      source: "fullName",
      transform: "copy"  // Just copy the value
    }
  }
};

// After migration:
const profileV2 = { name: "Alice Smith" };
```

### Example 3: Data Transformation

```javascript
// Version 1: Tags as comma-separated string
const articleV1 = { 
  title: "Hello",
  tags: "tech,tutorial,beginner" 
};

// Version 2: Tags as array
const migrationScript = {
  transformFields: {
    tags: {
      source: "tags",
      transform: (value) => value.split(",")
    }
  }
};

// After migration:
const articleV2 = {
  title: "Hello",
  tags: ["tech", "tutorial", "beginner"]
};
```

---

## Part 10: Key Takeaways

### Understanding cojson Migrations

1. **Storage migrations** = Internal database changes (you don't touch)
2. **Account migrations** = One-time setup when account is created (you customize)
3. **Data migrations** = Upgrading existing CoValues (you build entirely)

### Building Your Own System

1. **Store schemas as CoValues** (CoMaps with JSON Schema inside)
2. **Store migrations as CoValues** (CoMaps with transformation scripts)
3. **Build a runtime engine** that detects version mismatches and applies migrations
4. **Use headerMeta.version** to track what version data was created with

### The Freedom You Have

- ✅ headerMeta can contain ANYTHING (it's just JSON)
- ✅ CoValues don't care about schemas (they're just CRDTs)
- ✅ You can add/remove/transform fields freely
- ✅ Migrations can reference other CoValues (they're CoValues too!)
- ✅ cojson will never interfere with your system

### Why This Approach Rocks

```
Traditional databases:
  "Here's my migration system. Use it or suffer."
  
cojson:
  "Here's a CRDT sync engine. Do whatever you want with it."
  
Your response:
  "Sweet! I'll build a schema system that stores schemas as CoValues,
   migrations as CoValues, and runs migrations at runtime. Everything
   is collaborative, versioned, and synced automatically because it's
   all just CoValues!" 🎉
```

---

## Further Reading

- **cojson architecture**: `libs/maia-docs/architecture/cojson.md`
- **Schema system**: `libs/maia-db/src/schemas/`
- **Migration example**: `libs/maia-db/src/migrations/schema.migration.js`
- **CoValue creation**: `libs/maia-db/src/services/`

---

## Questions?

Remember:
- **CoValues are dumb** (just CRDTs, don't know schemas)
- **headerMeta is yours** (store whatever you want)
- **Migrations are external** (not part of cojson)
- **You're in control** (build it however you like)

Good luck building your migration system! 🚀
