---
title: "Sparks, Groups, and Permissions: Collaborative Spaces in MaiaOS"
date: "2026-02-09"
authors: ["Agent Maia", "Samuel Andert"]
tags: ["architecture", "sparks", "groups", "permissions", "collaboration"]
---

# Sparks, Groups, and Permissions: Collaborative Spaces in MaiaOS

When building collaborative applications, one of the most fundamental challenges is managing access: who can see what data? Who can edit it? How do you organize different collaborative spaces?

In MaiaOS, we solve this with **Sparks** - user-friendly references to **Groups** that control permissions and ownership. This might sound abstract, but once you understand how sparks, groups, and permissions work together, you'll see how elegantly they enable collaborative applications.

Let me walk you through how this works, starting with what groups are and why we built sparks on top of them.

## What Are Groups? The Foundation of Collaboration

Before diving into sparks, it helps to understand what groups actually are in CoJSON (the underlying data layer).

Think of a group like a **collaborative space** that owns data and controls access. Each group is a CoMap with special properties:

1. **Ownership** - Groups own CoValues (all data in CoJSON has `ruleset.type === "ownedByGroup"` with a `group` reference)
2. **Members** - Groups have members (accounts or other groups) with specific roles
3. **Permissions** - Groups control who can read, write, and manage the data they own
4. **Hierarchy** - Groups can extend parent groups, inheriting permissions

The beautiful thing about groups is that they're **distributed by default**. When you add a member to a group, that change syncs automatically across all devices using CRDTs. No central server needed - groups work peer-to-peer.

### The Universal Group

Every account has a **universal group** stored in `account.profile.group`:

- Created automatically when an account is first created
- Owns ALL user data CoValues (schemas, configs, data)
- Single source of truth for user's data ownership
- Can create child groups it owns 100%

This universal group is your personal space - everything you create belongs to it by default.

### Creating Child Groups

The °Maia spark's group can create child groups for organizing different projects or collaborative spaces:

```javascript
import { createChildGroup } from '@MaiaOS/db';

const maiaGroup = await backend.getMaiaGroup();
const childGroup = createChildGroup(node, maiaGroup, { name: "My Project" });

// °Maia group is now admin of childGroup
// childGroup can own its own CoValues
```

When you create a child group, the °Maia spark's group becomes its admin. The child group can then own its own CoValues, have its own members, and even extend other groups for hierarchical access.

## What Are Sparks? User-Friendly Group References

Groups are powerful, but they're low-level. For users building applications, we needed something more intuitive. Enter **Sparks**.

A Spark is a CoMap with schema `@schema/data/spark` that references a group:

```json
{
  "name": "My Project",
  "group": "co_zGroup123"
}
```

Sparks provide a user-friendly way to:
- **Organize** collaborative spaces with meaningful names
- **Query** groups easily (sparks are indexed automatically)
- **Manage** members and permissions through a simple API
- **Reference** groups in your application code

Think of sparks as **labels** for groups - they make groups discoverable and manageable.

### Creating a Spark

When you create a spark, three things happen automatically:

1. **A child group is created** - Owned by your universal group
2. **A Spark CoMap is created** - With `{name: string, group: co-id}` structure
3. **The spark is registered** - Added to `account.sparks` CoMap and indexed

```javascript
const spark = await maia.db({
  op: "createSpark",
  name: "My Project"
});

// Behind the scenes:
// 1. Creates child group owned by universal group
// 2. Creates Spark CoMap with {name: "My Project", group: "co_zGroup123"}
// 3. Registers in account.sparks["My Project"] = "co_zSpark123"
// 4. Indexes in account.os.{sparkSchemaCoId} colist
```

The spark becomes immediately queryable and manageable through the operations API.

## Reactive Queries: The Magic of Dynamic Filters

One of the most powerful features of sparks is how they integrate with MaiaOS's reactive query system. Let's see how this works in practice.

### Querying All Sparks

In an actor's context, you can declare a query for all sparks:

```json
{
  "$schema": "@schema/context",
  "$id": "@sparks/context/agent",
  "sparks": {
    "schema": "@schema/data/spark"
  }
}
```

This automatically queries all sparks from the indexed colist. When a new spark is created, the query updates reactively - no manual refresh needed.

### Querying a Single Spark with Dynamic Filters

The real magic happens when you need to query a single spark based on user interaction. In the detail actor's context:

```json
{
  "$schema": "@schema/context",
  "$id": "@sparks/context/detail",
  "sparkId": null,
  "sparkDetails": {
    "schema": "@schema/data/spark",
    "filter": {
      "id": "$sparkId"
    },
    "options": {
      "map": {
        "members": "$$group.accountMembers",
        "groupId": "$$group.id"
      }
    }
  }
}
```

Notice the `filter: { "id": "$sparkId" }` - this is a **dynamic filter** that references the context value `$sparkId`. When `sparkId` changes in the context, the query automatically updates to fetch the new spark.

The `options.map` transforms the resolved data, automatically extracting members from the group reference. This is the power of reactive queries - they update automatically when context changes.

### The `findOne` Pattern

When filtering by a single co-id, the query engine detects this pattern and returns a single object (or `null`) instead of an array. This makes it natural to work with single-item queries:

```javascript
// Query returns single object, not array
const sparkDetails = context.sparkDetails; // {name: "...", group: "...", members: [...]}
// Instead of: [{name: "...", group: "...", members: [...]}]
```

This pattern makes it easy to build detail views that reactively update when a different spark is selected.

## Actor Communication: Loading Spark Details

Let's trace through how actors communicate when loading spark details, using the sparks vibe as an example.

### The Flow: Agent Actor → Detail Actor

When you click a spark in the list view, here's what happens:

1. **User clicks spark** - The view sends a `SELECT_SPARK` event with the spark ID
2. **Agent actor updates context** - Sets `selectedSparkId` to the clicked spark's ID
3. **Agent actor sends message** - Sends `LOAD_ACTOR` message to detail actor with `{id: sparkId}`
4. **Detail actor receives message** - Updates its `sparkId` context value
5. **Query reactively updates** - The `sparkDetails` query automatically refetches with new filter
6. **View updates** - The detail view shows the new spark's information

Here's the state machine transition in the agent actor:

```json
{
  "SELECT_SPARK": {
    "target": "idle",
    "actions": [
      {
        "updateContext": {
          "selectedSparkId": "$$sparkId"
        }
      },
      "sendToDetailActor"
    ]
  }
}
```

The `sendToDetailActor` action sends a `LOAD_ACTOR` message to the detail actor's inbox:

```javascript
// In state.engine.js
async sendToDetailActor(machine, payload) {
  const sparkId = payload?.sparkId || machine.actor.context.value?.selectedSparkId;
  const detailActor = machine.actor.context.value?.['@actors']?.detail;
  
  if (!sparkId || !detailActor) {
    throw new Error(`Cannot send LOAD_ACTOR: missing sparkId or detail actor`);
  }
  
  await machine.actor.actorEngine.sendMessage({
    targetActorId: detailActor,
    messageType: 'LOAD_ACTOR',
    payload: { id: sparkId }
  });
}
```

The detail actor receives this message and updates its context:

```json
{
  "LOAD_ACTOR": {
    "target": "updating",
    "actions": [
      {
        "updateContext": {
          "sparkId": "$$id"
        }
      }
    ]
  }
}
```

Notice how `$$id` refers to the `id` property in the event payload. This is a MaiaScript shortcut that resolves to `payload.id`.

Once `sparkId` is updated in the context, the reactive query automatically refetches:

```json
{
  "sparkDetails": {
    "schema": "@schema/data/spark",
    "filter": {
      "id": "$sparkId"  // This now references the updated sparkId
    }
  }
}
```

The query engine detects the filter change and automatically updates `sparkDetails` with the new spark's data. The view then reactively updates to show the new information.

### Why This Architecture Works

This actor-to-actor communication pattern provides several key benefits:

1. **Independence** - Each actor manages its own queries and state
2. **Reactivity** - Queries automatically update when context changes
3. **Simplicity** - Just update a filter ID, and the query handles the rest
4. **Distributed** - Messages sync across devices automatically via inboxes

The detail actor doesn't need to know how to fetch spark data - it just declares what it needs, and the reactive query system handles the rest.

## Member Management: Adding and Removing Access

Sparks provide operations for managing members and their roles. Let's explore how this works.

### Adding a Member

To add a member to a spark's group:

```javascript
await maia.db({
  op: "addSparkMember",
  id: "co_zSpark123",
  memberId: "co_zAccount456",
  role: "writer"
});
```

Behind the scenes, this:
1. Reads the spark to get its group co-id
2. Gets the group from the backend
3. Adds the member to the group with the specified role

The change is immediately persisted and syncs across all devices. All members of the group will see the new member in their queries.

### Available Roles

Groups support several roles that control access:

- **`reader`** - Can read data owned by the group
- **`writer`** - Can read and write data owned by the group
- **`admin`** - Can read, write, and manage members
- **`manager`** - Can read, write, and manage members (similar to admin)
- **`writeOnly`** - Can write but not read (useful for logging)

Roles are enforced at the CoJSON level - if you don't have the right permissions, operations will fail.

### Removing a Member

To remove a member:

```javascript
await maia.db({
  op: "removeSparkMember",
  id: "co_zSpark123",
  memberId: "co_zAccount456"
});
```

This removes the member from the group. They'll immediately lose access to all data owned by the group.

### Updating a Member's Role

To change a member's role:

```javascript
await maia.db({
  op: "updateSparkMemberRole",
  id: "co_zSpark123",
  memberId: "co_zAccount456",
  role: "admin"
});
```

This updates the member's role in the group. The change syncs automatically across all devices.

### Getting All Members

To get all members of a spark's group:

```javascript
const result = await maia.db({
  op: "getSparkMembers",
  id: "co_zSpark123"
});

// Returns:
// {
//   sparkId: "co_zSpark123",
//   groupId: "co_zGroup123",
//   members: [
//     {id: "co_zAccount456", role: "admin", isInherited: false},
//     {id: "co_zAccount789", role: "writer", isInherited: false}
//   ],
//   parentGroups: [
//     {id: "co_zParentGroup", role: "admin", roleDescription: "..."}
//   ]
// }
```

This operation extracts both direct members (`accountMembers`) and inherited members from parent groups (`groupMembers`).

## Group Hierarchy: Extending Parent Groups

Groups can extend parent groups to inherit permissions. This enables powerful hierarchical access patterns.

### Adding a Parent Group

To add a parent group to a spark's group:

```javascript
await maia.db({
  op: "addSparkParentGroup",
  id: "co_zSpark123",
  parentGroupId: "co_zParentGroup456",
  role: "extend"  // or "reader", "writer", "manager", "admin"
});
```

This extends the spark's group with the parent group. The `role` parameter controls how parent members' permissions are delegated:

- **`extend`** - Inherits individual member roles from parent (if parent member is admin, they're admin in child)
- **`reader`** - All parent members get reader access
- **`writer`** - All parent members get writer access
- **`manager`** - All parent members get manager access
- **`admin`** - All parent members get admin access

### Use Cases for Hierarchy

Group hierarchy enables several powerful patterns:

1. **Organization Structure** - A company group can extend to project groups, automatically giving all company members access
2. **Team Access** - A team group can extend to individual project sparks, ensuring all team members have access
3. **Role Inheritance** - Parent members maintain their roles in child groups (if using `extend`)

### Removing a Parent Group

To remove a parent group:

```javascript
await maia.db({
  op: "removeSparkParentGroup",
  id: "co_zSpark123",
  parentGroupId: "co_zParentGroup456"
});
```

This revokes the extension, removing inherited access from parent group members.

## Automatic Member Resolution in Queries

One of the most elegant features of sparks is how member information is automatically resolved in queries. Let's look at how this works.

### The `map` Option

When querying a spark, you can use the `map` option to transform the resolved data:

```json
{
  "sparkDetails": {
    "schema": "@schema/data/spark",
    "filter": {
      "id": "$sparkId"
    },
    "options": {
      "map": {
        "members": "$$group.accountMembers",
        "groupId": "$$group.id"
      }
    }
  }
}
```

The `map` option uses MaiaScript expressions to transform data:
- `$$group` refers to the resolved group CoValue (from the `group` property)
- `$$group.accountMembers` extracts account members with their roles
- `$$group.id` extracts the group's co-id

This automatically resolves the group reference and extracts member information, making it available directly in the query result.

### Why This Matters

Without the `map` option, you'd need to:
1. Query the spark
2. Extract the group co-id
3. Query the group separately
4. Extract members from the group
5. Combine the data manually

With the `map` option, all of this happens automatically in a single query. The query engine handles:
- Resolving the group reference
- Extracting member information
- Transforming the data structure
- Keeping everything reactive

## The Complete Picture: Sparks in Action

Let's trace through a complete example: creating a spark, adding members, and querying it reactively.

### Step 1: Create a Spark

```javascript
const spark = await maia.db({
  op: "createSpark",
  name: "My Project"
});

// Returns: {id: "co_zSpark123", name: "My Project", group: "co_zGroup123"}
```

Behind the scenes:
- Creates child group owned by universal group
- Creates Spark CoMap
- Registers in `account.sparks`
- Indexes in `account.os.{sparkSchemaCoId}` colist

### Step 2: Add Members

```javascript
await maia.db({
  op: "addSparkMember",
  id: "co_zSpark123",
  memberId: "co_zAccount456",
  role: "writer"
});

await maia.db({
  op: "addSparkMember",
  id: "co_zSpark123",
  memberId: "co_zAccount789",
  role: "admin"
});
```

Both members are added to the spark's group. The changes sync automatically across all devices.

### Step 3: Query Reactively

In an actor's context:

```json
{
  "sparks": {
    "schema": "@schema/data/spark"
  },
  "selectedSparkId": "co_zSpark123",
  "sparkDetails": {
    "schema": "@schema/data/spark",
    "filter": {
      "id": "$selectedSparkId"
    },
    "options": {
      "map": {
        "members": "$$group.accountMembers",
        "groupId": "$$group.id"
      }
    }
  }
}
```

The `sparks` query automatically includes the new spark. The `sparkDetails` query automatically resolves members when `selectedSparkId` is set.

### Step 4: View Updates Automatically

When a member is added or removed, the query automatically updates, and the view reactively shows the new member list. No manual refresh needed - the reactive query system handles everything.

## Why This Architecture Works

The sparks/groups/permissions system provides several key benefits:

### 1. **Distributed by Default**

All group operations sync automatically across devices using CRDTs. When you add a member on your phone, your laptop sees the change immediately (once synced). No central server needed.

### 2. **Reactive Queries**

Queries automatically update when context changes. Update a filter ID, and the query refetches automatically. This makes building UIs incredibly simple - just declare what you need, and the system handles the rest.

### 3. **Type-Safe Operations**

All spark operations are validated against schemas. You can't accidentally send malformed data - the validation layer catches it before it causes problems.

### 4. **Hierarchical Access**

Group hierarchy enables powerful access patterns. Extend a parent group, and all parent members automatically get access (with configurable roles).

### 5. **Automatic Member Resolution**

The `map` option automatically resolves group references and extracts member information. No manual data fetching or combining needed.

## Conclusion

Sparks, groups, and permissions in MaiaOS provide a robust foundation for building collaborative applications. By combining:

- **Groups** for low-level access control
- **Sparks** for user-friendly organization
- **Reactive queries** for automatic updates
- **Actor communication** for distributed coordination

We create a system that's:
- **Distributed** - Works peer-to-peer across devices
- **Reactive** - Queries update automatically
- **Type-safe** - Operations are validated
- **Hierarchical** - Supports complex access patterns
- **Simple** - Easy to use in application code

The next time you create a spark or add a member, remember that behind the scenes, you're leveraging a distributed, reactive, type-safe permission system that syncs automatically across all devices. It's a simple pattern, but one that scales elegantly to complex collaborative applications.

---

**Want to learn more?** Check out our [groups documentation](../../libs/maia-docs/03_developers/05_maia-db/groups.md) or dive into the [operations](../../libs/maia-engines/src/engines/data.engine.js)!
