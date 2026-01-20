# cojson Schema Type Hierarchy

**Understanding where and how types/schemas exist at each level**

Last updated: 2026-01-20

---

## The Big Picture

```
┌─────────────────────────────────────────────────────────────┐
│ LAYER 8: YOUR APPLICATION (Schemas & Migrations)           │
├─────────────────────────────────────────────────────────────┤
│ • JSON Schema definitions (stored as CoMaps)                │
│ • Schema registry (CoMap of schema CoMaps)                  │
│ • Migration scripts (stored as CoMaps)                      │
│ • Runtime validation & migration engine                     │
│ • Type: Pure JavaScript/JSON - NOT part of cojson           │
└─────────────────────────────────────────────────────────────┘
                         ↓ uses
┌─────────────────────────────────────────────────────────────┐
│ LAYER 7: SPECIALIZED CoMaps (RawGroup, RawAccount)         │
├─────────────────────────────────────────────────────────────┤
│ • Type: Subclass discrimination via headerMeta              │
│ • RawGroup: headerMeta = null (cojson limitation)           │
│ • RawAccount: headerMeta = { type: "account" } (built-in)   │
│ • Your CoMaps: headerMeta = { $schema: "YourSchema" } (YOU!)│
└─────────────────────────────────────────────────────────────┘
                         ↓ extends
┌─────────────────────────────────────────────────────────────┐
│ LAYER 6: BASE CRDT TYPES (CoMap, CoList, etc.)             │
├─────────────────────────────────────────────────────────────┤
│ • Type: Hard-coded string literal                           │
│   - "comap", "colist", "costream", "coplaintext"            │
│ • Purpose: Determines which CRDT class to instantiate       │
│ • Location: CoValueHeader.type                              │
│ • Examples:                                                 │
│   - RawCoMap: type = "comap"                                │
│   - RawCoList: type = "colist"                              │
│   - RawCoStream: type = "costream"                          │
│   - RawCoPlainText: type = "coplaintext"                    │
└─────────────────────────────────────────────────────────────┘
                         ↓ implements
┌─────────────────────────────────────────────────────────────┐
│ LAYER 5: RawCoValue Interface                              │
├─────────────────────────────────────────────────────────────┤
│ • Type: TypeScript interface (compile-time only)            │
│ • Properties:                                               │
│   - id: CoID<T>                                             │
│   - type: string                                            │
│   - headerMeta: JsonObject | null  ← YOUR SCHEMAS HERE!     │
│   - group: RawGroup                                         │
│   - core: CoValueCore                                       │
└─────────────────────────────────────────────────────────────┘
                         ↓ uses
┌─────────────────────────────────────────────────────────────┐
│ LAYER 4: CoValueCore (CRDT Engine)                         │
├─────────────────────────────────────────────────────────────┤
│ • Type: Runtime CRDT state machine                          │
│ • No awareness of schemas or types                          │
│ • Just processes transactions and resolves conflicts        │
│ • Contains: VerifiedState (header + transactions)           │
└─────────────────────────────────────────────────────────────┘
                         ↓ uses
┌─────────────────────────────────────────────────────────────┐
│ LAYER 3: CoValueHeader & VerifiedState                     │
├─────────────────────────────────────────────────────────────┤
│ • Type: TypeScript type (runtime data structure)            │
│ • CoValueHeader fields:                                     │
│   - type: "comap" | "colist" | "costream" | "coplaintext"   │
│   - ruleset: { type: "ownedByGroup" | "group", ... }        │
│   - meta: JsonObject | null  ← headerMeta lives here!       │
│   - createdAt: number | null                                │
│   - uniqueness: string | null                               │
└─────────────────────────────────────────────────────────────┘
                         ↓ contains
┌─────────────────────────────────────────────────────────────┐
│ LAYER 2: Transactions & Operations                         │
├─────────────────────────────────────────────────────────────┤
│ • Type: JSON arrays (no schemas!)                           │
│ • Transaction.changes: JsonValue[]                          │
│   - For CoMap: [{ op: "set", key: "name", value: "Alice" }]│
│   - For CoList: [{ op: "insert", index: 0, value: {...} }] │
│   - For CoStream: [{ item: {...} }]                         │
│ • No type checking - just JSON values!                      │
└─────────────────────────────────────────────────────────────┘
                         ↓ synced via
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: IDs & Crypto                                      │
├─────────────────────────────────────────────────────────────┤
│ • Type: String IDs with prefixes                            │
│ • RawCoID: "co_z..." (content-addressed)                    │
│ • SessionID: "co_z..._session_z..."                         │
│ • AgentID: "signer_z..." | "sealer_z..."                    │
│ • No types - just cryptographic identifiers                 │
└─────────────────────────────────────────────────────────────┘
                         ↓ uses
┌─────────────────────────────────────────────────────────────┐
│ LAYER 0: Crypto Primitives                                 │
├─────────────────────────────────────────────────────────────┤
│ • Hash (Blake3)                                             │
│ • Signature (Ed25519)                                       │
│ • Encryption (XSalsa20)                                     │
│ • No types - just bytes and algorithms                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Type Discrimination Flow

### How cojson Determines Which Class to Instantiate

**File:** `libs/maia-db/node_modules/cojson/src/coreToCoValue.ts`

```typescript
// Step 1: Read the CoValue header
const header = core.verified.header;
const type = header.type;        // "comap" | "colist" | "costream" | "coplaintext"
const ruleset = header.ruleset;   // { type: "ownedByGroup" | "group", ... }
const meta = header.meta;         // JsonObject | null (YOUR headerMeta!)

// Step 2: Discriminate based on type + ruleset + meta
if (type === "comap") {
  if (ruleset.type === "group") {
    if (meta?.type === "account") {
      return new RawAccount(core);  // ← Account
    } else {
      return new RawGroup(core);    // ← Group
    }
  } else {
    return new RawCoMap(core);      // ← Generic CoMap
  }
}
else if (type === "colist") {
  return new RawCoList(core);       // ← CoList
}
else if (type === "costream") {
  if (meta?.type === "binary") {
    return new RawBinaryCoStream(core);  // ← Binary stream
  } else {
    return new RawCoStream(core);   // ← Generic stream
  }
}
else if (type === "coplaintext") {
  return new RawCoPlainText(core);  // ← Plain text
}
```

### Key Insight

**cojson uses 3 properties to determine the class:**

1. **header.type** - Determines base CRDT type ("comap", "colist", etc.)
2. **header.ruleset.type** - Distinguishes Group from regular CoMap
3. **header.meta** - Used for special cases (Account, BinaryCoStream)

**YOUR schemas (in header.meta.$schema) are completely ignored by cojson!**

---

## Where Types Live at Each Layer

### Layer 0-2: NO TYPES

```javascript
// Just bytes, hashes, JSON
Transaction = {
  madeAt: 1234567890,
  changes: [
    { op: "set", key: "name", value: "Alice" }  // Any JSON!
  ]
}
```

### Layer 3: Header Contains Type Info

```javascript
CoValueHeader = {
  type: "comap",                    // ← CRDT type (4 options)
  ruleset: { 
    type: "ownedByGroup",           // ← Ownership model
    group: "co_z..."                // ← Group ID
  },
  meta: {                           // ← YOUR DATA!
    $schema: "ProfileSchema",       // ← Your schema reference
    version: 1,                     // ← Your version
    encrypted: true,                // ← Your flags
    migrations: [...]               // ← Your migration config
  },
  createdAt: 1234567890,
  uniqueness: null
}
```

### Layer 4: NO TYPES (CRDT Engine)

```javascript
// CoValueCore just processes transactions
// It doesn't know or care about schemas
core.processTransaction(tx);  // Any transaction!
```

### Layer 5-6: TypeScript Types (Compile-Time)

```typescript
// These types only exist in TypeScript
interface RawCoValue {
  type: string;                     // Runtime string
  headerMeta: JsonObject | null;    // Your schemas!
}

class RawCoMap implements RawCoValue {
  type = "comap" as const;          // Literal type
}
```

### Layer 7: Subclass Discrimination (Runtime)

```typescript
// cojson creates instances based on header
const coValue = coreToCoValue(core);

// Result depends on header.type + header.meta:
coValue instanceof RawAccount      // If meta.type === "account"
coValue instanceof RawGroup        // If ruleset.type === "group"
coValue instanceof RawCoMap        // If regular comap
```

### Layer 8: YOUR SCHEMAS (Runtime + Compile-Time)

```javascript
// Runtime: Schemas stored as JSON in CoMaps
const schemaCoMap = {
  name: "ProfileSchema",
  version: 2,
  schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" }
    }
  }
};

// Compile-time: TypeScript types (optional)
interface ProfileV2 {
  name: string;
  age: number;
}
```

---

## The headerMeta Hierarchy

### What headerMeta Contains at Different Levels

```javascript
// LEVEL 1: No schema (cojson default)
headerMeta: null

// LEVEL 2: cojson built-ins
headerMeta: { type: "account" }      // RawAccount
headerMeta: { type: "binary" }       // RawBinaryCoStream

// LEVEL 3: Your basic schema reference
headerMeta: { $schema: "ProfileSchema" }

// LEVEL 4: Schema + version
headerMeta: { 
  $schema: "ProfileSchema",
  version: 2 
}

// LEVEL 5: Schema + version + metadata
headerMeta: {
  $schema: "ProfileSchema",
  version: 2,
  encrypted: true,
  author: "co_z...",
  created: "2026-01-20"
}

// LEVEL 6: Full migration system
headerMeta: {
  $schema: "ProfileSchema",
  version: 2,
  migrations: {
    applied: ["v1_to_v2"],
    pending: [],
    history: [
      { from: 1, to: 2, date: "2026-01-20" }
    ]
  },
  validation: {
    strict: true,
    allowAdditionalProperties: false
  }
}

// LEVEL 7: Inline JSON Schema (self-describing)
headerMeta: {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "number" }
  },
  required: ["name"]
}
```

---

## Schema Storage Strategies

### Strategy 1: Reference External Schemas

```javascript
// CoValue headerMeta (small)
headerMeta: { $schema: "ProfileSchema", version: 2 }

// Schema stored separately (in account.os.schemata)
schemaRegistry.ProfileSchema = {
  name: "ProfileSchema",
  version: 2,
  schema: { /* JSON Schema */ }
};

// Pros: Small headerMeta, schemas can be updated
// Cons: Need to load schema registry
```

### Strategy 2: Inline JSON Schema

```javascript
// CoValue headerMeta (large, ~1-10KB)
headerMeta: {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "number" }
  }
}

// Pros: Self-describing, no external dependencies
// Cons: Larger headerMeta, can't update schema
```

### Strategy 3: Hybrid (RECOMMENDED)

```javascript
// CoValue headerMeta (reference + version)
headerMeta: { 
  $schema: "ProfileSchema",
  version: 2 
}

// Schema stored as CoMap (synced, mutable)
const schemaCoMap = group.createMap({
  name: "ProfileSchema",
  version: 2,
  schema: { /* JSON Schema */ },
  migrations: { /* ... */ }
}, { $schema: "MetaSchema" });

// Link in schema registry
account.os.schemata.set("ProfileSchema", schemaCoMap.id);

// Pros: Best of both worlds
// Cons: More complex setup
```

---

## Type Safety Layers

### Layer 1: CRDT Operations (No Type Safety)

```javascript
// CoMap accepts ANY key and ANY value
coMap.set("name", "Alice");           // ✅ Valid
coMap.set("age", 30);                 // ✅ Valid
coMap.set("invalid", { foo: "bar" }); // ✅ Valid (no checks!)
```

### Layer 2: headerMeta Reference (Soft Type Safety)

```javascript
// headerMeta says this is a "ProfileSchema"
coValue.headerMeta = { $schema: "ProfileSchema" };

// But cojson doesn't enforce it!
coValue.set("invalid", "data");  // ✅ Still works!
```

### Layer 3: Runtime Validation (Your Code)

```javascript
// You add validation before setting
function setProfileField(coMap, key, value) {
  const schema = schemaRegistry.get("ProfileSchema");
  const valid = validateField(schema, key, value);
  
  if (!valid) {
    throw new Error(`Invalid field: ${key}`);
  }
  
  coMap.set(key, value);  // ✅ Validated!
}
```

### Layer 4: TypeScript Types (Compile-Time)

```typescript
// TypeScript interface (compile-time only!)
interface Profile {
  name: string;
  age: number;
}

// Typed wrapper
class TypedProfile {
  constructor(private coMap: RawCoMap<Profile>) {}
  
  get name(): string {
    return this.coMap.get("name")!;
  }
  
  set name(value: string) {
    // Compile-time type checking ✅
    this.coMap.set("name", value);
  }
}
```

---

## Examples: Full Stack Type Flow

### Example 1: Creating a Profile

```javascript
// LAYER 8: Application code
const profileData = { name: "Alice", age: 30 };
const profileMeta = { $schema: "ProfileSchema", version: 2 };

// LAYER 7: Create via Group
const profile = group.createMap(profileData, profileMeta);

// LAYER 6: RawCoMap instance created
// - Inherits RawCoValue interface

// LAYER 5: CoValueCore creates header
// CoValueHeader = {
//   type: "comap",
//   ruleset: { type: "ownedByGroup", group: "co_z..." },
//   meta: { $schema: "ProfileSchema", version: 2 },
//   createdAt: 1234567890
// }

// LAYER 4: CoValueCore processes set operations
// Transaction.changes = [
//   { op: "set", key: "name", value: "Alice" },
//   { op: "set", key: "age", value: 30 }
// ]

// LAYER 3: Header + Transactions stored

// LAYER 2: Transactions synced to peers

// LAYER 1: IDs generated (content-addressed)
// profile.id = "co_z..."

// LAYER 0: Crypto operations (signatures, hashes)
```

### Example 2: Loading a Profile

```javascript
// LAYER 1-3: Load from storage/network
const core = node.getCoValue("co_z...");

// LAYER 4: CoValueCore loaded with transactions

// LAYER 5-6: coreToCoValue() discriminates
const header = core.verified.header;
if (header.type === "comap") {
  const profile = new RawCoMap(core);  // ← RawCoMap instance
}

// LAYER 7: Check if specialized type
// (Not a group, not an account - just a regular CoMap)

// LAYER 8: Your application validates schema
const { $schema, version } = profile.headerMeta;
const schema = await schemaRegistry.get($schema);

if (version < schema.version) {
  await migrationEngine.migrate(profile, version, schema.version);
}

// Now safe to use!
```

---

## Key Insights

### 1. TypeScript Types ≠ Runtime Types

```typescript
// TypeScript type (compile-time only)
interface Profile {
  name: string;
  age: number;
}

// Runtime: CoMap doesn't know about this!
const profile: RawCoMap<Profile> = ...;  // ← Type annotation only

// This still works (no runtime check):
profile.set("invalid", "oops");  // ❌ Type error, but ✅ runs!
```

### 2. headerMeta is Yours

```javascript
// cojson only checks these fields:
headerMeta.type === "account"  // For RawAccount
headerMeta.type === "binary"   // For RawBinaryCoStream

// Everything else is ignored by cojson!
headerMeta.$schema        // ← Yours
headerMeta.version        // ← Yours
headerMeta.migrations     // ← Yours
headerMeta.anything       // ← Yours
```

### 3. CoValues are Type-Agnostic

```javascript
// Under the hood, ALL CoMaps are the same:
RawAccount  → type: "comap", ruleset: "group", meta.type: "account"
RawGroup    → type: "comap", ruleset: "group", meta: null
ProfileCoMap → type: "comap", ruleset: "ownedByGroup", meta: { $schema: "ProfileSchema" }

// They're all just CoMaps with different metadata!
```

### 4. Schemas are External to cojson

```
┌─────────────────────────────────────────┐
│ cojson (Type-Agnostic)                  │
│  • Syncs CRDTs                          │
│  • Doesn't care about schemas           │
│  • Just processes JSON operations       │
└─────────────────────────────────────────┘
           ↓ used by
┌─────────────────────────────────────────┐
│ Your Schema System (Type-Aware)         │
│  • Defines schemas (JSON Schema)        │
│  • Validates data                       │
│  • Runs migrations                      │
│  • Enforces types                       │
└─────────────────────────────────────────┘
```

---

## Summary

**Type information exists at different levels for different purposes:**

- **Layer 0-2**: No types (just bytes and JSON)
- **Layer 3**: `header.type` determines CRDT class ("comap", "colist", etc.)
- **Layer 4**: No types (CRDT engine is type-agnostic)
- **Layer 5-6**: TypeScript interfaces (compile-time only)
- **Layer 7**: `header.meta` adds subclass discrimination (Account, Group, Binary)
- **Layer 8**: YOUR schemas define semantic types (ProfileSchema, etc.)

**The beautiful truth:**
- cojson provides **4 CRDT primitives** (CoMap, CoList, CoStream, CoPlainText)
- Everything else is **just metadata** (headerMeta)
- Your schemas are **completely external** to cojson
- You have **total freedom** to build any schema system you want

**The recommendation:**
- Use `headerMeta` for **immutable type information** (schema name, version)
- Store **actual schemas** as CoMaps (synced, collaborative, mutable)
- Build a **runtime validation & migration engine** (pure JavaScript)
- Keep **TypeScript types** in sync (for development experience)

---

## Further Reading

- **Full migration guide**: `libs/maia-docs/architecture/cojson-migrations.md`
- **cojson architecture**: `libs/maia-docs/architecture/cojson.md`
- **Schema implementation**: `libs/maia-db/src/schemas/`
- **Type discrimination code**: `libs/maia-db/node_modules/cojson/src/coreToCoValue.ts`
