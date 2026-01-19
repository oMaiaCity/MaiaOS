# Jazz Persistence & Loading System: A Simple Guide

**Last Updated**: 2026-01-19

This document explains how Jazz handles creating, persisting, and loading CoValues in a way anyone can understand.

---

## Table of Contents

1. [The Core Pattern](#the-core-pattern)
2. [Creating & Persisting CoValues](#creating--persisting-covalues)
3. [Loading CoValues](#loading-covalues)
4. [The Subscription System](#the-subscription-system)
5. [Account Migrations](#account-migrations)
6. [Why Our Seeding Wasn't Working](#why-our-seeding-wasnt-working)
7. [The Fix](#the-fix)

---

## The Core Pattern

### Analogy: A Library

Think of Jazz like a library:

- **IndexedDB** = The bookshelves (storage)
- **LocalNode** = The librarian (manages everything)
- **CoValues** = The books
- **Subscriptions** = Library cards (track who's reading what)
- **SubscriptionCache** = The catalog system (remembers where books are)

---

## Creating & Persisting CoValues

### Step 1: Creating a CoValue

```javascript
// Creating a CoMap (a book)
const myMap = createCoMap(group, { title: "Hello" });
```

When you create a CoValue:

1. **Immediate**: CoValue is created in memory
2. **Async**: CoValue is queued to be written to IndexedDB
3. **Background**: A microtask writes it to storage

### Step 2: The Write Queue

Jazz uses a `LocalTransactionsSyncQueue` that batches writes:

```javascript
// In cojson/src/queue/LocalTransactionsSyncQueue.ts
this.scheduleBatch = () => {
  queueMicrotask(() => {
    this.flushBatch(); // Writes to IndexedDB
  });
};
```

**Problem**: If you create CoValues and immediately destroy the node (e.g., sign out), the microtask never runs!

### Step 3: Waiting for Storage

**The Solution**: `waitForStorageSync()`

```javascript
// Create CoValue
const myMap = createCoMap(group, { title: "Hello" });

// ✅ CRITICAL: Wait for IndexedDB write!
await node.syncManager.waitForStorageSync(myMap.id);
// Now it's safely persisted!
```

**This is how `LocalNode.withNewlyCreatedAccount()` works:**

```typescript
// In cojson/src/localNode.ts:290-295
if (node.storage) {
  await Promise.all([
    node.syncManager.waitForStorageSync(account.id),
    node.syncManager.waitForStorageSync(profileId), // ← WAITS!
  ]);
}
```

This is why the account and profile **always persist**, but seeded CoValues didn't - they were created AFTER this await!

---

## Loading CoValues

### The Lazy-Loading Pattern

Jazz doesn't load ALL your CoValues on sign-in. It only loads:

1. The **account** (always)
2. CoValues that are **referenced by** the account
3. CoValues you **explicitly subscribe to**

### How References Work

```javascript
// Link examples to account
account.set("examples", examplesMap.id);
```

Now when you access `account.examples`, Jazz:

1. Sees the reference
2. Checks IndexedDB for `examplesMap.id`
3. Loads it into memory
4. Returns it to you

**But there's a catch!**

---

## The Subscription System

### Why Subscriptions Matter

Jazz uses a **subscription-based loading system**. CoValues are only loaded when someone is actively listening for them.

### The Three-Layer Architecture

```text
┌─────────────────────────────────────┐
│     SubscriptionCache              │  ← Manages all subscriptions
│  (Deduplicates & cleans up)        │     (One per app)
└──────────────┬──────────────────────┘
               │
               │ creates/reuses
               ↓
┌─────────────────────────────────────┐
│     SubscriptionScope              │  ← Manages one CoValue's state
│  (Loading state, child refs)       │     (One per CoValue being watched)
└──────────────┬──────────────────────┘
               │
               │ uses
               ↓
┌─────────────────────────────────────┐
│   CoValueCoreSubscription          │  ← Low-level cojson subscription
│  (Watches for updates from node)   │     (Triggers loadCoValueCore)
└─────────────────────────────────────┘
```

### How It Works

1. **You access a property**: `account.examples`
2. **SubscriptionScope is created** for `examplesMap.id`
3. **CoValueCoreSubscription** tells the node: "I need this CoValue!"
4. **LocalNode.loadCoValueCore()** checks IndexedDB
5. **If found**: Loads into memory, triggers subscription callback
6. **If not found**: CoValue stays in "LOADING" state forever

### Code Flow

```typescript
// In SubscriptionScope.ts (lines 102-141)
this.subscription = new CoValueCoreSubscription(
  node,
  id,
  (value) => {
    // Called when CoValue is available
    this.handleUpdate(value);
  },
  skipRetry,
  this.unstable_branch,
);
```

```typescript
// In CoValueCoreSubscription.ts (simplified)
class CoValueCoreSubscription {
  constructor(node, id, callback) {
    // Subscribe to the CoValue
    const coValueCore = node.getCoValue(id);
    
    if (!coValueCore || !coValueCore.isAvailable()) {
      // Trigger loading from IndexedDB
      node.loadCoValueCore(id).then(() => {
        const content = coValueCore.getCurrentContent();
        callback(content); // ← Trigger SubscriptionScope update
      });
    }
  }
}
```

### Auto-Loading Children

When you load a CoMap with references, Jazz automatically subscribes to children:

```typescript
// In SubscriptionScope.ts:707-760
private loadChildren() {
  if (coValueType === "CoMap") {
    const map = value as CoMap;
    for (const key of map.$jazz.raw.keys()) {
      const id = this.loadCoMapKey(map, key);
      if (id) {
        this.loadChildNode(id, depth, descriptor, key);
      }
    }
  }
}
```

This creates child SubscriptionScopes for each reference!

---

## Account Migrations

### What Are Migrations?

Migrations are functions that run **once** when an account is first created. They set up the account's initial structure.

### The Default Migration

```typescript
// Jazz's default migration (simplified)
async function defaultMigration(account, node) {
  // Create a group to own the profile
  const profileGroup = createGroup(account);
  
  // Create a profile
  const profile = createCoMap(profileGroup, { name: "User" });
  
  // Link profile to account
  account.set("profile", profile.id);
  
  // ✅ CRITICAL: Wait for persistence!
  await node.syncManager.waitForStorageSync(profile.id);
  await node.syncManager.waitForStorageSync(account.id);
}
```

### Our Custom Migration

```javascript
// In libs/maia-ssi/src/minimalMigration.js
export async function minimalMigration(account, node, creationProps) {
  const profileGroup = node.createGroup();
  
  const profile = createCoMap(
    profileGroup,
    { name: creationProps?.name || "Maia User" }
  );
  
  account.set("profile", profile.id);
  
  // Migration completes BEFORE withNewlyCreatedAccount() returns
  // The account and profile are persisted by withNewlyCreatedAccount()
}
```

### The Critical Timing

```text
┌──────────────────────────────────────┐
│  LocalNode.withNewlyCreatedAccount   │
├──────────────────────────────────────┤
│  1. Create account                   │
│  2. Run migration                    │  ← profileGroup, profile created
│  3. await waitForStorageSync()       │  ← Account & profile persisted ✅
│  4. Return account to app            │
└──────────────┬───────────────────────┘
               │
               │ AFTER return
               ↓
┌──────────────────────────────────────┐
│  seedExampleCoValues()               │
├──────────────────────────────────────┤
│  1. Create plainText                 │  ← Created
│  2. Create stream                    │  ← Created
│  3. Create notes                     │  ← Created
│  4. Create examplesMap               │  ← Created
│  5. account.set("examples", id)      │  ← Linked
│  6. Return ❌ NO WAIT!               │  ← PROBLEM!
└──────────────────────────────────────┘
```

---

## Why Our Seeding Wasn't Working

### The Problem

1. **During Migration** (Inside `withNewlyCreatedAccount`):
   - Profile created → `waitForStorageSync` called → **Persisted** ✅

2. **After Migration** (After `withNewlyCreatedAccount` returns):
   - ExamplesMap created → **No wait** → Queued for write
   - PlainText created → **No wait** → Queued for write
   - Stream created → **No wait** → Queued for write
   - Notes created → **No wait** → Queued for write
   - User signs out immediately → **Write queue destroyed** → ❌ **LOST!**

### The Evidence

**Registration logs** (from user):

```text
Account keys: ["profile", "examples"]  ← Link persisted!
Created: co_zCLcfebHfEv3aREgTKxH4zpAHSL (examplesMap)
```

**Sign-in logs** (from user):

```text
Account keys: ["profile", "examples"]  ← Link still there! ✅
CoValue co_zCLcfebHfEv3aREgTKxH4zpAHSL not yet loaded  ← CoValue gone! ❌
```

**What this proves**:

- ✅ `account.set("examples", examplesMap.id)` persisted (the reference)
- ❌ The `examplesMap` CoValue itself did NOT persist
- ❌ Same for plainText, stream, notes

The **reference** was saved, but the **CoValue** wasn't!

---

## The Fix

### Add `waitForStorageSync()` After Each CoValue

```javascript
// In libs/maia-db/src/services/oSeeding.js
export async function seedExampleCoValues(node, account) {
  // Get profile group
  const profileId = account.get("profile");
  const profile = node.getCoValue(profileId).getCurrentContent();
  const profileGroup = profile.group;
  
  // Create CoPlainText
  const plainText = createPlainText(profileGroup, "Hello!");
  
  // ✅ CRITICAL: Wait for IndexedDB write!
  if (node.storage) {
    await node.syncManager.waitForStorageSync(plainText.id);
    console.log("💾 CoPlainText persisted to IndexedDB");
  }
  
  // Create CoStream
  const stream = createCoStream(profileGroup, "ActivityStream");
  
  // ✅ CRITICAL: Wait for IndexedDB write!
  if (node.storage) {
    await node.syncManager.waitForStorageSync(stream.id);
    console.log("💾 CoStream persisted to IndexedDB");
  }
  
  // Create Notes
  const notes = createCoMap(profileGroup, { title: "Note" });
  
  // ✅ CRITICAL: Wait for IndexedDB write!
  if (node.storage) {
    await node.syncManager.waitForStorageSync(notes.id);
    console.log("💾 Notes persisted to IndexedDB");
  }
  
  // Create Examples CoMap
  const examplesMap = createCoMap(profileGroup, {
    plainText: plainText.id,
    stream: stream.id,
    notes: notes.id,
  });
  
  // ✅ CRITICAL: Wait for IndexedDB write!
  if (node.storage) {
    await node.syncManager.waitForStorageSync(examplesMap.id);
    console.log("💾 Examples CoMap persisted to IndexedDB");
  }
  
  // Link examples to account
  account.set("examples", examplesMap.id);
  
  // ✅ CRITICAL: Wait for account modification to persist!
  if (node.storage) {
    await node.syncManager.waitForStorageSync(account.id);
    console.log("💾 Account modifications persisted to IndexedDB");
  }
  
  return { plainText, stream, notes, examplesMap };
}
```

### Why This Works

1. **Pattern from Jazz**: This is exactly what `LocalNode.withNewlyCreatedAccount()` does
2. **Offline-First**: `waitForStorageSync()` waits for LOCAL IndexedDB write (no network!)
3. **Fast**: IndexedDB writes are quick (milliseconds)
4. **Guaranteed**: CoValues are persisted before function returns

### The Fixed Flow

```text
┌──────────────────────────────────────┐
│  seedExampleCoValues()               │
├──────────────────────────────────────┤
│  1. Create plainText                 │
│  2. await waitForStorageSync() ✅    │  ← Written to IndexedDB
│  3. Create stream                    │
│  4. await waitForStorageSync() ✅    │  ← Written to IndexedDB
│  5. Create notes                     │
│  6. await waitForStorageSync() ✅    │  ← Written to IndexedDB
│  7. Create examplesMap               │
│  8. await waitForStorageSync() ✅    │  ← Written to IndexedDB
│  9. account.set("examples", id)      │
│ 10. await waitForStorageSync() ✅    │  ← Account updated in IndexedDB
│ 11. Return                           │
└──────────────────────────────────────┘

User signs out → All data already in IndexedDB ✅
User signs in → All CoValues load from IndexedDB ✅
```

---

## Key Takeaways

1. **CoValues are written asynchronously** via microtasks
2. **Always await `waitForStorageSync()`** after creating CoValues
3. **Linking is not enough** - the CoValue itself must be persisted
4. **Subscriptions drive loading** - if nobody's watching, it won't load
5. **Jazz is offline-first** - `waitForStorageSync()` is for LOCAL storage, not remote sync
6. **The pattern comes from Jazz** - `LocalNode.withNewlyCreatedAccount()` does exactly this

---

## Testing Checklist

After implementing the fix:

1. Clear IndexedDB completely
2. Register new account (creates profile via migration)
3. **Immediately** sign out (within 100ms of "Seeding complete!")
4. Sign back in
5. Verify all CoValues load properly
6. Check browser DevTools → Application → IndexedDB to confirm all CoValues are present

You should see:

- ✅ Account (always persists)
- ✅ Profile (persisted by migration)
- ✅ PlainText (persisted by seeding)
- ✅ Stream (persisted by seeding)
- ✅ Notes (persisted by seeding)
- ✅ ExamplesMap (persisted by seeding)

**Total**: 6-7 CoValues in IndexedDB (depending on internal Jazz groups)

---

## Further Reading

- **SubscriptionCache**: `node_modules/jazz-tools/src/tools/subscribe/SubscriptionCache.ts`
- **SubscriptionScope**: `node_modules/jazz-tools/src/tools/subscribe/SubscriptionScope.ts`
- **LocalNode**: `node_modules/cojson/src/localNode.ts`
- **SyncManager**: `node_modules/cojson/src/sync.ts`
- **LocalTransactionsSyncQueue**: `node_modules/cojson/src/queue/LocalTransactionsSyncQueue.ts`
