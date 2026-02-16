---
title: "Access Control: Sparks, Capabilities, and Per-CoValue Ownership"
date: "2026-02-10"
authors: ["Agent Maia", "Samuel Andert"]
tags: ["architecture", "access-control", "sparks", "capabilities", "groups"]
---

# Access Control: Sparks, Capabilities, and Per-CoValue Ownership

When building collaborative applications, one of the most fundamental questions is: **who can access what?** Every piece of data needs clear ownership and access rules. If you're new to MaiaOS, you might not yet know what CoValues are, what an account looks like, or why we use paths like `spark.os.capabilities.guardian`. This article builds up from the ground floor—no prior knowledge assumed. By the end, you'll understand how access control works in MaiaOS and why we structure things the way we do.

Let's start at the beginning.

## The Big Picture: Every Piece of Data Has an Owner

In any collaborative system, every piece of data needs to answer: *who can read this? who can write this? who can manage who has access?* MaiaOS is built on **CoJSON**, a CRDT-based data layer that syncs across devices via our distributed sync service. Access control, however, isn't enforced by that sync infrastructure—we can't rely on a central server or database to decide who can read or write. Instead, **every piece of data (every CoValue) is owned by a group**, and that group defines who has access.

So before we talk about sparks or capabilities, we need to understand CoValues and groups.

## CoValues: The Building Blocks of Data

In MaiaOS, data lives in **CoValues**. A CoValue is a syncable data structure—it could be a map (CoMap), a list (CoList), or a stream (CoStream). Think of it like a document or a table that automatically syncs across devices. When you create a todo, you're creating a CoMap. When you create an inbox, you're creating a CoStream.

**Key point**: Every CoValue must have an **owner**. The owner is a **group**. The group says who can read, write, and manage that CoValue. No group = no data. So groups are the foundation of access control.

## Groups: Who Controls Access

A **group** is a collaborative space that owns CoValues and has **members** with **roles**. When you add someone to a group with the "writer" role, they can edit the CoValues that group owns. When you add them as "admin," they can also add or remove other members.

Groups can also have **parent groups**. If group A "extends" group B with the "reader" role, then everyone in group B gets reader access to everything group A owns. That's how we build hierarchies—e.g. "the whole team" extends to "this project," so all team members automatically get access to the project.

So far: **CoValues are owned by groups. Groups have members and roles. Groups can extend other groups.** That's the low-level model.

## Accounts: Your Identity in the System

You (the user) have an **account**. Your account is a special CoValue that represents your identity. It has:

- **profile** – Your profile CoMap (name, avatar, etc.)
- **sparks** – A registry (a CoMap) of your collaborative spaces

When you first create an account, the system sets up a default spark called **°Maia**. That's your personal spark—everything you create by default lives under °Maia. The `account.sparks` CoMap maps names to spark CoValues: e.g. `account.registries.sparks["°Maia"]` → the °Maia spark's co-id, and `account.sparks["My Project"]` → your "My Project" spark's co-id.

So: **account.sparks** is your list of collaborative spaces. Each entry points to a **spark** CoValue.

## Sparks: Named Collaborative Spaces

A **spark** is a CoMap with a name (e.g. "°Maia" or "My Project"). It's the user-facing way to organize collaborative spaces. But here's the question: **where does the group live that controls who has access to this spark?**

We could put a `group` property directly on the spark: `spark.group = "co_zSomeGroupId"`. But a spark needs more than just "who has access." It also needs:

- **Schematas** – What schemas exist in this spark (for validation)
- **Indexes** – How to query data in this spark
- **Vibes** – What vibes (apps/UI) are available
- **Capabilities** – The actual access primitives (who is admin, who can read publicly, etc.)

Putting all of that on the spark would make it messy. So we introduced the **OS** (operating system) metaphor.

## The Spark's OS: Where Everything Lives

Each spark has an **OS CoMap** (`spark.os`). Think of it as the spark's "control panel"—everything the spark needs to operate lives there:

- `os.schematas` – Schema registry for this spark
- `os.indexes` – Index registry for querying
- `os.capabilities` – Access control primitives

The **capabilities** CoMap (`os.capabilities`) is where we store *who has access*. It holds:

- **guardian** – The group that is the admin for this spark. Add someone to the guardian = they get admin access to everything in the spark.
- **publicReaders** – (Optional) A group that gives "everyone" read access, for publicly readable data like schema registries.

So the path to find "who controls this spark?" is:

```
spark → spark.os → os.capabilities → capabilities.guardian
```

That's the **canonical path**. Any code that needs the spark's admin group follows this path. No duplicate `group` property on the spark—one source of truth, one path.

## Why This Structure?

A few benefits:

1. **Single path** – No confusion about "do I use spark.group or spark.os.capabilities.guardian?" Always the latter.
2. **Room to grow** – Capabilities can hold more than guardian (e.g. publicReaders, future writeDelegates) without cluttering the spark.
3. **Consistent resolution** – The same path works for °Maia and every user-created spark. Same structure everywhere.

## Per-CoValue Ownership: Each Piece of Data Has Its Own Group

Here's another key design choice: **every CoValue has its own group**. We don't have one big "spark group" that owns all todos, all configs, and all schemas. Instead:

- Each todo has its own group
- Each actor config has its own group
- Each schema has its own group

Each of those groups **extends the spark's guardian** as admin. So the guardian doesn't own the data directly—the guardian is the *parent* of the group that owns the data. Anyone with admin access to the guardian (i.e. spark members you've added) can manage all CoValues in that spark.

### The Creator-Leaves Pattern

When you create a todo (or any CoValue) for a spark, we use a 3-step flow:

1. **Create a new group** – CoJSON temporarily makes your account the admin.
2. **Add the guardian as admin** – The spark's guardian extends this new group.
3. **Your account leaves** – We remove you from the group. The guardian remains as the only admin.

Result: the CoValue is owned by a group with **no direct members**—only the guardian as parent. You don't stay as direct admin; you control things through the spark's guardian (because you're in the guardian). This keeps the model consistent: access always flows through the guardian, not through "creator" as a special case.

## Capabilities in Detail

### Guardian

The **guardian** is the spark's admin group. For °Maia, it's created during bootstrap and has your account as direct admin. For user-created sparks (e.g. "My Project"), it's a child group of °Maia's guardian—so you (as °Maia admin) are automatically admin of "My Project" too.

When you add a member to a spark, you're adding them to the guardian. When you create a CoValue for a spark, that CoValue's group extends the guardian. All access flows through this one group.

### PublicReaders

Sometimes you want data to be **publicly readable**—e.g. schema definitions, vibe manifests. For that we use **publicReaders**:

1. Create a group with `everyone` as `reader`
2. Create a "registry group" that extends the guardian (for write) and the public group (for read)
3. Store that registry group's co-id in `capabilities.publicReaders`

CoValues owned by a group that extends publicReaders are readable by anyone. Write access still goes through the guardian.

## Creating a New Spark: The Full Scaffold

When you create a spark (e.g. "My Project"), we don't just create a spark CoMap with a name. We create the **full scaffold** so every spark has the same structure:

1. **Guardian** – A new child group of °Maia's guardian. This is *your* spark's admin group.
2. **Capabilities CoMap** – With `guardian: childGroup.id`
3. **OS CoMap** – With `capabilities: capabilities.id`
4. **Vibes CoMap** – Empty registry for this spark's vibes
5. **Spark CoMap** – With `{ name, os, vibes }`—no top-level `group` property

So the path `spark.os.capabilities.guardian` always works. Same for °Maia (created at bootstrap) and every user spark.

## Resolving Members in the UI

The Sparks vibe shows spark details, including members. The detail view queries the spark and uses a `map` to follow the path and extract members:

```
spark → os → capabilities → guardian → accountMembers
```

The query config looks like:

```json
{
  "map": {
    "members": "$$os.capabilities.guardian.accountMembers",
    "groupId": "$$os.capabilities.guardian.id"
  }
}
```

The `$$` syntax means "follow this path on the loaded spark." The engine deep-resolves `os`, then `capabilities`, then `guardian`, and for groups it auto-injects `accountMembers`. So you get the member list without any manual fetching. One path, one query.

## Summary: The Mental Model

- **CoValues** – Syncable data (maps, lists, streams). Every CoValue is owned by a group.
- **Groups** – Own CoValues, have members with roles, can extend parent groups.
- **Accounts** – Your identity. Has `profile` and `sparks` (a registry of your collaborative spaces).
- **Sparks** – Named entries in `account.sparks`. Each has `name`, `os`, `vibes`.
- **spark.os** – The spark's "control panel": schematas, indexes, capabilities.
- **spark.os.capabilities** – Access primitives: `guardian` (admin group), `publicReaders` (optional).
- **Canonical path** – `spark.os.capabilities.guardian` is the single source of truth for who controls a spark.
- **Per-CoValue ownership** – Each CoValue has its own group that extends the guardian. Creator leaves; access flows through the guardian.
- **Public read** – Use `publicReaders` (a group with `everyone` as reader) for publicly readable data.

Once you have this model, the code paths make sense: we always resolve the guardian via `spark.os.capabilities.guardian`, and we always create CoValues with their own group that extends that guardian.

---

**Want to learn more?** Check out [Sparks, Groups, and Permissions](./260209_sparks_groups_permissions.md) for reactive queries and member management, or the [groups documentation](../../libs/maia-docs/03_developers/05_maia-db/groups.md).
