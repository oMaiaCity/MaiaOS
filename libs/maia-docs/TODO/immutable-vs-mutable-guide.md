# Immutable vs Mutable in cojson

**Understanding what you can and can't change**

Last updated: 2026-01-20

---

## The Core Principle

```
┌──────────────────────────────────────────────────────┐
│ CoValue = IMMUTABLE HEADER + MUTABLE DATA            │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ IMMUTABLE HEADER (Set at creation, never changes)    │
├──────────────────────────────────────────────────────┤
│ • type: "comap" | "colist" | "costream" | ...        │
│ • ruleset: { type: "group" | "ownedByGroup", ... }   │
│ • headerMeta: { $factory: "...", version: 1, ... }    │
│ • createdAt: timestamp                               │
│ • uniqueness: string | null                          │
│                                                      │
│ ❌ You CANNOT change these after creation!           │
└──────────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────────┐
│ MUTABLE DATA (Can change anytime via CRDT ops)       │
├──────────────────────────────────────────────────────┤
│ • CoMap: set(key, value), delete(key)                │
│ • CoList: insert(index, value), delete(index)        │
│ • CoStream: push(value)                              │
│ • CoPlainText: append(text), insert(index, text)     │
│                                                      │
│ ✅ You CAN change these anytime!                     │
└──────────────────────────────────────────────────────┘
```

---

## Why This Matters for Migrations

### The Problem

```javascript
// Create CoValue with version 1
const profile = group.createMap(
  { name: "Alice" },
  { $factory: "ProfileFactory", version: 1 }  // ← Immutable!
);

// Later: Schema updates to version 2
// You want to mark the CoValue as "migrated to v2"

// ❌ CANNOT DO THIS:
profile.headerMeta.version = 2;  // Read-only property!

// ❌ CANNOT DO THIS:
profile.core.verified.header.meta.version = 2;  // Still read-only!
```

### The Solution

```javascript
// ✅ YOU CAN DO THIS:
// Just modify the data to match v2 schema!

// Before migration (v1 schema):
profile.toJSON();  // { name: "Alice" }
profile.headerMeta;  // { $factory: "ProfileFactory", version: 1 }

// Apply migration (modify DATA, not header):
profile.set("age", null);  // Add new field required by v2

// After migration:
profile.toJSON();  // { name: "Alice", age: null }
profile.headerMeta;  // { $factory: "ProfileFactory", version: 1 }
//                      ↑ Still says v1! (immutable)
//                      But data is now v2-compatible! ✅
```

---

## Visual Breakdown

```
┌─────────────────────────────────────────────────────────────┐
│ CoValue Structure                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────────────────────────────────────┐            │
│  │ CoValue Header (IMMUTABLE) 🔒              │            │
│  ├────────────────────────────────────────────┤            │
│  │ type: "comap"                              │            │
│  │ ruleset: { type: "ownedByGroup", ... }     │            │
│  │ headerMeta: {                              │ ← Your     │
│  │   $factory: "ProfileFactory",  🔒            │   metadata │
│  │   version: 1,  🔒                          │   (frozen) │
│  │   created: "2026-01-20"  🔒                │            │
│  │ }                                          │            │
│  │ createdAt: 1234567890  🔒                  │            │
│  └────────────────────────────────────────────┘            │
│                      ↓                                      │
│  ┌────────────────────────────────────────────┐            │
│  │ CoValue Content (MUTABLE) 🔓               │            │
│  ├────────────────────────────────────────────┤            │
│  │ CRDT State:                                │            │
│  │   ops: [                                   │            │
│  │     { op: "set", key: "name", ... },       │            │
│  │     { op: "set", key: "age", ... }  ✅     │            │
│  │   ]                                        │            │
│  │                                            │            │
│  │ Current Data:                              │            │
│  │   {                                        │            │
│  │     name: "Alice",  ✅ Can change          │            │
│  │     age: 30  ✅ Can add/change/delete      │            │
│  │   }                                        │            │
│  └────────────────────────────────────────────┘            │
│                                                             │
└─────────────────────────────────────────────────────────────┘

KEY:
🔒 = Immutable (set at creation, frozen forever)
🔓 = Mutable (can change anytime via CRDT operations)
✅ = You can do this
❌ = You cannot do this
```

---

## What You CAN Do

### ✅ Modify Data (CRDT Content)

```javascript
// CoMap operations
coMap.set("newField", "value");      // ✅ Add new field
coMap.set("existingField", "new");   // ✅ Update field
coMap.delete("oldField");            // ✅ Remove field

// CoList operations
coList.insert(0, "item");            // ✅ Add item
coList.delete(0);                    // ✅ Remove item
coList.move(0, 5);                   // ✅ Reorder items

// CoStream operations
coStream.push({ data: "..." });      // ✅ Append data

// CoPlainText operations
coPlainText.append("more text");     // ✅ Add text
```

### ✅ Store Version Info in Data

```javascript
// Option: Store version in data itself (mutable!)
coMap.set("_schemaVersion", 2);      // ✅ Mutable version tracking

// Access both versions:
const createdWithVersion = coMap.headerMeta.version;  // 1 (immutable)
const currentDataVersion = coMap.get("_schemaVersion");  // 2 (mutable)
```

### ✅ Add Metadata Fields

```javascript
// Track migration history in data:
coMap.set("_migrations", [
  { from: 1, to: 2, date: "2026-01-20" }
]);  // ✅ Works!

// Track last validated version:
coMap.set("_lastValidatedAgainst", 2);  // ✅ Works!
```

---

## What You CANNOT Do

### ❌ Modify headerMeta

```javascript
// These all fail (read-only):
coValue.headerMeta.version = 2;               // ❌ TypeError
coValue.headerMeta.$schema = "NewSchema";     // ❌ TypeError
coValue.headerMeta.newField = "value";        // ❌ TypeError

// Even this doesn't work:
Object.assign(coValue.headerMeta, { version: 2 });  // ❌ No effect
```

### ❌ Modify Header Properties

```javascript
// These all fail (read-only):
coValue.type = "colist";                      // ❌ Cannot change type
coValue.core.verified.header.type = "colist"; // ❌ Still immutable
coValue.core.verified.header.meta.version = 2;// ❌ Still immutable
```

### ❌ Change CoValue ID

```javascript
// ID is content-addressed (based on header hash)
coValue.id = "co_znewid";                     // ❌ Read-only
```

---

## Migration Strategies

### Strategy 1: Ignore headerMeta.version

```javascript
// Use headerMeta.version only as "created with version X"
// Don't try to update it!

async function migrate(coValue) {
  const createdWithVersion = coValue.headerMeta.version;  // 1
  const currentSchemaVersion = schema.version;             // 2
  
  if (createdWithVersion < currentSchemaVersion) {
    // Apply migrations (modify DATA only)
    for (let v = createdWithVersion; v < currentSchemaVersion; v++) {
      await applyMigration(coValue, v, v + 1);
    }
    
    // ✅ Data is now v2-compatible
    // ✅ headerMeta still says v1 (that's OK!)
  }
}
```

### Strategy 2: Track Version in Data

```javascript
// Store mutable version in data
async function migrate(coValue) {
  const createdWithVersion = coValue.headerMeta.version;  // 1 (immutable)
  const currentDataVersion = coValue.get("_version") || createdWithVersion;  // 1
  const targetVersion = schema.version;  // 2
  
  if (currentDataVersion < targetVersion) {
    // Apply migrations
    for (let v = currentDataVersion; v < targetVersion; v++) {
      await applyMigration(coValue, v, v + 1);
    }
    
    // Update mutable version tracker
    coValue.set("_version", targetVersion);  // ✅ Now says v2!
  }
}

// Now you have TWO version numbers:
coValue.headerMeta.version  // 1 (immutable) - "created with v1"
coValue.get("_version")     // 2 (mutable) - "data is now v2"
```

### Strategy 3: Check Data Shape Instead

```javascript
// Don't track version at all - just check if data matches schema!
async function migrate(coValue) {
  const schema = await getSchema(coValue.headerMeta.$schema);
  const data = coValue.toJSON();
  const validation = validate(schema, data);
  
  if (!validation.valid) {
    // Data doesn't match schema - apply migrations
    const neededMigrations = findRequiredMigrations(
      data,
      schema,
      coValue.headerMeta.version
    );
    
    for (const migration of neededMigrations) {
      await applyMigration(coValue, migration);
    }
  }
  
  // ✅ Data now matches schema (regardless of version numbers)
}
```

---

## Recommended Pattern

### Use headerMeta.version as "Created With"

```javascript
// Think of headerMeta.version as "birth certificate"
// It tells you what version the CoValue was BORN with
// It NEVER changes (birth certificates don't change!)

const profile = group.createMap(
  { name: "Alice" },
  { $schema: "ProfileFactory", version: 1 }  // ← Birth certificate
);

// 10 years later...
profile.headerMeta.version;  // Still 1 (birth year never changes!)
```

### Track Current State in Data or Runtime

```javascript
// Option A: Store current version in data (synced across devices)
coValue.set("_currentVersion", 2);

// Option B: Detect at runtime (no extra data)
function getCurrentVersion(coValue) {
  // Check which fields exist
  if (coValue.get("age")) return 2;  // v2 added age field
  return 1;  // Must be v1
}

// Option C: Validate against schema (no version tracking needed!)
function needsMigration(coValue) {
  const schema = getSchema(coValue.headerMeta.$schema);
  const data = coValue.toJSON();
  return !validate(schema, data);
}
```

---

## Real-World Example

### Scenario: Upgrading User Profiles

```javascript
// ─────────────────────────────────────────────────────────────
// 2026-01-01: Create initial schema
// ─────────────────────────────────────────────────────────────
const schemaV1 = {
  name: "ProfileFactory",
  version: 1,
  schema: {
    type: "object",
    properties: {
      name: { type: "string" }
    }
  }
};

// Create user profile
const alice = group.createMap(
  { name: "Alice" },
  { $schema: "ProfileFactory", version: 1 }
);

// Alice's CoValue:
// headerMeta: { $factory: "ProfileFactory", version: 1 } 🔒
// data: { name: "Alice" } 🔓

// ─────────────────────────────────────────────────────────────
// 2026-06-01: Schema evolves - add age field
// ─────────────────────────────────────────────────────────────
const schemaV2 = {
  name: "ProfileFactory",
  version: 2,
  schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" }  // ← New!
    }
  }
};

// Create migration
const migration_v1_to_v2 = {
  fromVersion: 1,
  toVersion: 2,
  script: {
    addFields: { age: null }
  }
};

// Alice loads her profile
const alice = loadProfile("co_z...");

// Migration engine runs:
if (alice.headerMeta.version < schemaV2.version) {
  // Apply migration (modify DATA)
  alice.set("age", null);  // ✅ Add new field
}

// Alice's CoValue after migration:
// headerMeta: { $factory: "ProfileFactory", version: 1 } 🔒 (UNCHANGED!)
// data: { name: "Alice", age: null } 🔓 (CHANGED!)

// ─────────────────────────────────────────────────────────────
// Alice updates her age
// ─────────────────────────────────────────────────────────────
alice.set("age", 30);  // ✅ Works!

// Alice's CoValue now:
// headerMeta: { $factory: "ProfileFactory", version: 1 } 🔒 (Still v1!)
// data: { name: "Alice", age: 30 } 🔓 (Now v2-compatible!)

// ─────────────────────────────────────────────────────────────
// 2027-01-01: Create new user (Bob)
// ─────────────────────────────────────────────────────────────
const bob = group.createMap(
  { name: "Bob", age: 25 },
  { $factory: "ProfileFactory", version: 2 }  // ← Created with v2!
);

// Bob's CoValue:
// headerMeta: { $factory: "ProfileFactory", version: 2 } 🔒 (v2!)
// data: { name: "Bob", age: 25 } 🔓 (v2 from birth!)

// ─────────────────────────────────────────────────────────────
// Compare Alice and Bob
// ─────────────────────────────────────────────────────────────

// Alice (migrated from v1):
alice.headerMeta.version;  // 1 (created with v1)
alice.toJSON();            // { name: "Alice", age: 30 } (v2 data!)

// Bob (created with v2):
bob.headerMeta.version;    // 2 (created with v2)
bob.toJSON();              // { name: "Bob", age: 25 } (v2 data!)

// Both have v2-compatible data, but different headerMeta.version!
// This is FINE - headerMeta.version just tells you when it was created.
```

---

## Key Insights

### 1. headerMeta is NOT a Version Tracker

```javascript
// ❌ WRONG mental model:
// "headerMeta.version tells me what version the data is"

// ✅ CORRECT mental model:
// "headerMeta.version tells me what version the CoValue was CREATED with"
```

### 2. Data Shape is What Matters

```javascript
// Two CoValues with same data but different headerMeta.version:

coValue1.headerMeta.version;  // 1 (created in 2026-01)
coValue1.toJSON();            // { name: "Alice", age: 30 }

coValue2.headerMeta.version;  // 2 (created in 2027-01)
coValue2.toJSON();            // { name: "Bob", age: 25 }

// Both have v2-compatible data! That's all that matters.
```

### 3. Migrations Don't Update headerMeta

```javascript
// Migrations transform DATA, not METADATA

async function migrate(coValue) {
  // ✅ DO THIS:
  coValue.set("newField", defaultValue);  // Modify data
  
  // ❌ DON'T TRY THIS:
  coValue.headerMeta.version = 2;  // Won't work anyway!
}
```

### 4. You Can Track Version in Data

```javascript
// If you NEED a mutable version tracker, store it in data:

coValue.set("_schemaVersion", 2);  // ✅ Mutable!
coValue.set("_lastMigrated", "2026-01-20");  // ✅ Mutable!
coValue.set("_migrations", [
  { from: 1, to: 2, date: "2026-01-20" }
]);  // ✅ Mutable!

// Now you have TWO version numbers:
const bornWithVersion = coValue.headerMeta.version;  // Immutable
const currentVersion = coValue.get("_schemaVersion");  // Mutable
```

---

## Summary Table

| Property | Immutable? | Set When? | Purpose |
|---|---|---|---|
| `headerMeta.version` | ✅ Yes | Creation time | "Born with version X" |
| `headerMeta.$schema` | ✅ Yes | Creation time | Schema reference |
| `headerMeta.*` | ✅ Yes | Creation time | Any metadata you want |
| `coValue.type` | ✅ Yes | Creation time | CRDT type |
| `coValue.id` | ✅ Yes | Creation time | Content-addressed ID |
| `coValue.data` | ❌ No | Anytime | CRDT content |
| `coValue.set(k,v)` | ❌ No | Anytime | Add/update field |
| `coValue.delete(k)` | ❌ No | Anytime | Remove field |

---

## Conclusion

**The Golden Rule:**

```
headerMeta = Immutable metadata (birth certificate)
           ↓
        You CANNOT change it
           ↓
        Just accept it and move on
           ↓
        Modify the DATA instead!
```

**For migrations:**

1. Use `headerMeta.version` as "created with version X"
2. Don't try to update it (it's frozen)
3. Modify DATA to match new schema
4. Optionally track current version in data (`_schemaVersion`)
5. Focus on data shape, not version numbers

**Remember:**
- headerMeta is set at creation and never changes 🔒
- CoValue data can change anytime 🔓
- Migrations modify data, not metadata ✅
- You're free to build any migration system you want! 🚀
