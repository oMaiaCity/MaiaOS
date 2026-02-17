# Groups and Sparks

## Overview

Groups in CoJSON are collaborative spaces that own CoValues and control access permissions. Sparks are CoMaps that reference groups, providing a user-friendly way to organize and manage groups.

## Groups

### What are Groups?

Groups are CoMaps with special `ruleset.type === "group"` that:
- Own CoValues (all CoValues have `ruleset.type === "ownedByGroup"` with a `group` reference)
- Control access permissions (members, roles, parent groups)
- Enable collaborative editing (multiple members can edit simultaneously)

### °Maia Spark's Group

Every account has the **°Maia spark** with a group at `registries.sparks["°Maia"]`:
- Resolved via `account.registries.sparks`; created during bootstrap when account is first seeded
- Owns ALL user data CoValues (schemas, configs, data)
- Single source of truth for user's data ownership

### Creating Child Groups

The °Maia spark's group can create child groups it owns:

```javascript
import { createChildGroup } from '@MaiaOS/db';

const maiaGroup = await backend.getMaiaGroup();
const childGroup = createChildGroup(node, maiaGroup, { name: "My Project" });

// °Maia group is now admin of childGroup
// childGroup can own its own CoValues
```

**Implementation:** `libs/maia-db/src/cojson/groups/create.js`

## Sparks

### What are Sparks?

Sparks are CoMaps with schema `@schema/data/spark` that reference groups:
- Structure: `{name: string, group: co-id}`
- Registered in `account.registries.sparks` CoMap (sparkName -> sparkCoId)
- Automatically indexed in `account.os.{sparkSchemaCoId}` colist

### Spark Operations

Sparks have dedicated operations in the operations API:

**Create Spark:**
```javascript
const spark = await maia.do({
  op: "createSpark",
  name: "My Project"
});
// Creates child group + Spark CoMap + registers via POST /register
```

**Read Sparks:**
```javascript
// Read all sparks (from indexed colist)
const sparksStore = await maia.do({ op: "readSpark" });

// Read single spark
const sparkStore = await maia.do({ 
  op: "readSpark", 
  id: "co_zSpark123" 
});
```

**Update Spark:**
```javascript
await maia.do({
  op: "updateSpark",
  id: "co_zSpark123",
  data: { name: "Updated Name" }
});
```

**Delete Spark:**
```javascript
await maia.do({
  op: "deleteSpark",
  id: "co_zSpark123"
});
// Removes from indexed colist (registry via POST /register)
```

### account.registries.sparks Registry

Sparks are registered in `account.registries.sparks` CoMap:
- Created during bootstrap (seed.js); new sparks register via POST /register
- Structure: `registries.sparks.sparkName = sparkCoId`
- Cross-links to indexed colist `account.os.{sparkSchemaCoId}`

**Implementation:** `libs/maia-db/src/migrations/seeding/` (bootstrap); `libs/maia-engines/src/operations/spark-operations.js` (POST /register after createSpark)

### Spark Indexing

Sparks are automatically indexed via storage hooks:
- Created sparks are added to `account.os.{sparkSchemaCoId}` colist
- Deleted sparks are removed from indexed colist
- Query engine reads from indexed colist (reuses indexed data)

**Implementation:** `libs/maia-db/src/cojson/indexing/storage-hook-wrapper.js`

## Group Hierarchy

Groups can extend parent groups for role inheritance:

```javascript
// Child group extends parent group
childGroup.extend(parentGroup, "extend"); // Inherits roles from parent

// Or set specific role for all parent members
childGroup.extend(parentGroup, "reader"); // All parent members get reader access
```

**Delegation Roles:**
- `"extend"` - Inherits individual member roles from parent
- `"reader"` - All parent members get reader access
- `"writer"` - All parent members get writer access
- `"manager"` - All parent members get manager access
- `"admin"` - All parent members get admin access
- `"revoked"` - Delegation revoked

## Group Member Contract

MaiaOS standardizes on **account co-ids** (co_z...) for group member storage and display. Never use agent IDs (sealer_z.../signer_z...) at the API or display layers.

**Storage:**
- Groups store **account co-ids** as member keys when using `addGroupMember`.
- CoJSON supports both account co-ids and agent IDs; we standardize on account co-id for consistency and profile resolution.

**API and display:**
- Accept and expose **account co-id only**. Agent ID is internal (used for crypto/key revelation) and never accepted, returned, or logged at the API boundary.
- `resolveAccountCoIdsToProfileNames` expects account co-ids; agent IDs are never resolved (by design).
- For legacy data that may contain agent IDs, the frontend displays "Agent X" as a fallback instead of raw sealer_z/signer_z strings.

**Implementation:** `addGroupMember` passes an account-like object `{ id: accountCoId, currentAgentID: () => agentId }` to CoJSON, so the group stores `account.id` (co_z) as the member key while using agent ID only for cryptographic operations.

## Implementation Files

- **Group Creation:** `libs/maia-db/src/cojson/groups/create.js`
- **Group Operations:** `libs/maia-db/src/cojson/groups/groups.js`
- **Spark Operations:** `libs/maia-engines/src/operations/spark-operations.js`
- **Spark Backend:** `libs/maia-db/src/cojson/core/cojson-backend.js` (spark CRUD methods)
- **Schema Migration:** `libs/maia-db/src/migrations/schema.migration.js`
- **Spark Schema:** `libs/maia-schemata/src/os/spark.schema.json`

## Related Documentation

- [CoJSON Architecture](./cojson.md) - Complete CoJSON layer hierarchy
- [Operations API](../04_maia-engines/README.md) - maia.do data API
- [Sparks Vibe](../../02_creators/01-vibes.md) - Using Sparks in vibes
