# Groups and Sparks

## Overview

Groups in CoJSON are collaborative spaces that own CoValues and control access permissions. Sparks are CoMaps that reference groups, providing a user-friendly way to organize and manage groups.

## Groups

### What are Groups?

Groups are CoMaps with special `ruleset.type === "group"` that:
- Own CoValues (all CoValues have `ruleset.type === "ownedByGroup"` with a `group` reference)
- Control access permissions (members, roles, parent groups)
- Enable collaborative editing (multiple members can edit simultaneously)

### @maia Spark's Group

Every account has the **@maia spark** with a group at `account.sparks["@maia"].group`:
- Created during `schemaMigration()` when account is first created
- Owns ALL user data CoValues (schemas, configs, data)
- Single source of truth for user's data ownership

### Creating Child Groups

The @maia spark's group can create child groups it owns:

```javascript
import { createChildGroup } from '@MaiaOS/db';

const maiaGroup = await backend.getMaiaGroup();
const childGroup = createChildGroup(node, maiaGroup, { name: "My Project" });

// @maia group is now admin of childGroup
// childGroup can own its own CoValues
```

**Implementation:** `libs/maia-db/src/cojson/groups/create.js`

## Sparks

### What are Sparks?

Sparks are CoMaps with schema `@schema/data/spark` that reference groups:
- Structure: `{name: string, group: co-id}`
- Registered in `account.sparks` CoMap (sparkName -> sparkCoId)
- Automatically indexed in `account.os.{sparkSchemaCoId}` colist

### Spark Operations

Sparks have dedicated operations in the operations API:

**Create Spark:**
```javascript
const spark = await maia.db({
  op: "createSpark",
  name: "My Project"
});
// Creates child group + Spark CoMap + registers in account.sparks
```

**Read Sparks:**
```javascript
// Read all sparks (from indexed colist)
const sparksStore = await maia.db({ op: "readSpark" });

// Read single spark
const sparkStore = await maia.db({ 
  op: "readSpark", 
  id: "co_zSpark123" 
});
```

**Update Spark:**
```javascript
await maia.db({
  op: "updateSpark",
  id: "co_zSpark123",
  data: { name: "Updated Name" }
});
```

**Delete Spark:**
```javascript
await maia.db({
  op: "deleteSpark",
  id: "co_zSpark123"
});
// Removes from account.sparks + indexed colist
```

### account.sparks Registry

Sparks are registered in `account.sparks` CoMap (similar to `account.vibes`):
- Created during `schemaMigration()` if it doesn't exist
- Structure: `account.sparks.sparkName = sparkCoId`
- Cross-links to indexed colist `account.os.{sparkSchemaCoId}`

**Implementation:** `libs/maia-db/src/migrations/schema.migration.js`

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

## Implementation Files

- **Group Creation:** `libs/maia-db/src/cojson/groups/create.js`
- **Group Operations:** `libs/maia-db/src/cojson/groups/groups.js`
- **Spark Operations:** `libs/maia-operations/src/operations/spark-operations.js`
- **Spark Backend:** `libs/maia-db/src/cojson/core/cojson-backend.js` (spark CRUD methods)
- **Schema Migration:** `libs/maia-db/src/migrations/schema.migration.js` (account.sparks creation)
- **Spark Schema:** `libs/maia-schemata/src/os/spark.schema.json`

## Related Documentation

- [CoJSON Architecture](./cojson.md) - Complete CoJSON layer hierarchy
- [Operations API](../06_maia-operations/README.md) - Database operations API
- [Sparks Vibe](../../02_creators/01-vibes.md) - Using Sparks in vibes
