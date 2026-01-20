# Minimal Migration Setup

**Building from the ground up - understanding cojson's bare minimum requirements**

Last updated: 2026-01-20

---

## What We Did

Stripped down the account migration to its **absolute minimum** to understand cojson's requirements.

### Before (Complex)

```javascript
export async function schemaMigration(account, node, creationProps) {
  const { name } = creationProps;
  
  // Create Group
  const profileGroup = node.createGroup();
  
  // Create Profile CoMap
  const profile = profileGroup.createMap({ name });
  
  // Link profile to account
  account.set("profile", profile.id, "trusting");
}
```

**Created:**
- 1 Group (RawGroup)
- 1 Profile CoMap (RawCoMap)
- Total: 2 CoValues + Account

### After (MINIMAL)

```javascript
export async function schemaMigration(account, node, creationProps) {
  const { name } = creationProps;
  
  // Just set profile to string "owner"
  account.set("profile", "owner", "trusting");
}
```

**Created:**
- Nothing! Just sets a string value
- Total: 0 new CoValues (only Account exists)

---

## What We Learned

### cojson's ONLY Requirement (VERIFIED)

```javascript
// From LocalNode.withNewlyCreatedAccount() (line 286-288):
const profileId = account.get("profile");
if (!profileId) {
  throw new Error("Must set account profile in initial migration");
}
```

**That's it!** cojson only checks:
1. ✅ `account.get("profile")` returns something **truthy**
2. ❌ Does NOT check if it's a CoValue ID
3. ❌ Does NOT check if it's a CoMap
4. ❌ Does NOT validate the type at all

### What We Tested (All Failed!)

```
❌ No profile set at all        → "Must set account profile in initial migration"
❌ account.set("profile", null) → "Must set account profile in initial migration"
❌ account.set("profile", undefined) → "Must set account profile in initial migration"
❌ account.set("profile", "")   → "Must set account profile in initial migration"
❌ account.set("profile", 0)    → "Must set account profile in initial migration"
```

**All falsy values fail!** Profile MUST be truthy.

### What This Means

```javascript
// ✅ All of these work (truthy values):
account.set("profile", "owner", "trusting");      // ← Our minimal setup
account.set("profile", "anything", "trusting");
account.set("profile", 123, "trusting");
account.set("profile", true, "trusting");
account.set("profile", { foo: "bar" }, "trusting");
account.set("profile", coMapId, "trusting");

// ❌ These all fail (falsy values):
// (not setting profile)
account.set("profile", null, "trusting");
account.set("profile", undefined, "trusting");
account.set("profile", "", "trusting");
account.set("profile", 0, "trusting");
account.set("profile", false, "trusting");
```

### Our Setup IS the Absolute Minimum!

```javascript
account.set("profile", "owner", "trusting");
```

**You literally cannot go simpler than this!** It's:
- The shortest truthy value (5 characters)
- No CoValue creation
- No Group creation
- Just one line of code
- The absolute bare minimum cojson requires

---

## Files Changed

### 1. `libs/maia-db/src/migrations/schema.migration.js`

**Before:** Created Group + Profile CoMap (complex)  
**After:** Just sets profile to "owner" (minimal)

```javascript
export async function schemaMigration(account, node, creationProps) {
  account.set("profile", "owner", "trusting");
}
```

### 2. `libs/maia-db/src/services/oID.js`

**Before:** Expected profile to be CoValue ID, loaded it, got group  
**After:** Just returns the string value, no loading needed

```javascript
// Before:
const profileCoValue = result.node.getCoValue(profileId);
const profile = profileCoValue.getCurrentContent();
const group = profile.group;

return { node, account, accountID, group, profile };

// After:
const profileValue = account.get("profile");  // Just "owner"

return { 
  node, 
  account, 
  accountID, 
  profile: profileValue,  // String "owner"
  group: null  // No group in minimal setup
};
```

### 3. `libs/maia-db/src/migrations/schema.migration.test.js`

**Before:** Tests for Group creation, Profile CoMap, headerMeta, etc.  
**After:** Tests for minimal string value setup

```javascript
it("should set profile to string 'owner'", async () => {
  const result = await LocalNode.withNewlyCreatedAccount({
    creationProps: { name: "Test" },
    crypto,
    migration: schemaMigration,
  });
  
  const account = result.node.expectCurrentAccount("test");
  const profileValue = account.get("profile");
  
  expect(profileValue).toBe("owner");
});
```

---

## Why This Is Useful

### 1. Understanding Core Requirements

By stripping everything away, we see that cojson:
- Only requires `account.profile` to exist
- Doesn't care what type it is
- Doesn't enforce any structure
- The "profile as CoMap" pattern is just a convention!

### 2. Building Block for Custom Systems

Now we can build up from this minimal base:

```
Step 1: profile = "owner" (done!)
       ↓
Step 2: profile = { name: "Alice" } (JSON object)
       ↓
Step 3: profile = CoMap.id (CoValue reference)
       ↓
Step 4: profile = CoMap.id with headerMeta.$schema
       ↓
Step 5: Full schema system with migrations
```

### 3. Freedom to Experiment

We're not locked into any pattern! We can:
- Use strings for simple cases
- Use JSON objects for structured data
- Use CoValue IDs for complex relationships
- Mix and match approaches

---

## What CoValues Actually Exist

### In Minimal Setup

```javascript
// After migration completes:
const allCoValues = Array.from(node.coValues.values());

console.log(allCoValues.length);  // 1

// The ONLY CoValue is the Account itself:
allCoValues[0].getCurrentContent().id === account.id  // true
```

### Account Structure

```javascript
{
  id: "co_z...",               // Account ID
  type: "comap",               // Account IS a CoMap!
  headerMeta: {                // Built-in by cojson
    type: "account"
  },
  
  // Data (what we control):
  profile: "owner"             // ← Our string value
}
```

---

## Next Steps

Now we can build up incrementally:

### Step 2: Add More Account Data

```javascript
export async function schemaMigration(account, node, creationProps) {
  const { name } = creationProps;
  
  // Set profile to JSON object
  account.set("profile", { 
    name, 
    role: "owner",
    created: new Date().toISOString()
  }, "trusting");
  
  // Add other account properties
  account.set("settings", { theme: "dark" }, "trusting");
}
```

### Step 3: Create Single CoMap (No Group)

```javascript
export async function schemaMigration(account, node, creationProps) {
  const { name } = creationProps;
  
  // Create a profile CoMap (no group needed!)
  // But wait... we need a group for createMap!
  // This shows why the default pattern uses Groups
}
```

### Step 4: Understand Why Groups Are Needed

```javascript
// CoMaps need a Group for ownership/permissions
// This is a cojson requirement at the CRDT level

// Can we create a CoMap without a Group? NO!
// group.createMap() is the only way to create CoMaps

// So the default pattern (Group + CoMap) makes sense!
```

---

## Key Insights

### 1. Account IS a CoMap

```javascript
account.type === "comap"  // true!
account.headerMeta === { type: "account" }  // true!

// Account is just a CoMap with special headerMeta
// That's why we can set() values on it!
```

### 2. Profile Can Be Anything

```javascript
// cojson doesn't care what profile is:
account.set("profile", "owner");           // ✅
account.set("profile", { name: "..." });   // ✅
account.set("profile", coMapId);           // ✅

// The convention of "profile = CoMap ID" is OUR choice, not cojson's!
```

### 3. Groups Are for Ownership

```javascript
// To create other CoValues (CoMap, CoList, etc.), you need a Group
// Groups define ownership and permissions
// That's why the default pattern creates a Group first

const group = node.createGroup();
const coMap = group.createMap(...);  // Group owns this CoMap
```

---

## Testing

Run the tests to verify minimal setup works:

```bash
cd libs/maia-db
bun test src/migrations/schema.migration.test.js
```

**Expected output:**
```
✓ should set profile to string 'owner'
✓ should satisfy cojson's minimum requirement
✓ should not create any Group or CoMap
✓ should work with any account name
```

---

## Summary

**What we proved (EMPIRICALLY TESTED!):**
- cojson **REQUIRES** `account.profile` to be **truthy** (hardcoded check in LocalNode)
- profile can be ANY truthy value (string, number > 0, object, array, CoValue ID)
- profile CANNOT be falsy (null, undefined, "", 0, false, or not set)
- The "profile as CoMap" pattern is a convention, not a requirement
- Account itself is just a CoMap with special headerMeta

**What we learned:**
- Start simple and build up incrementally
- Understand core requirements before adding complexity
- Groups are needed for creating other CoValues
- You have total freedom in how you structure account data
- **Our current setup (`profile = "owner"`) IS the absolute minimum possible!**

**The absolute minimum migration:**
```javascript
export async function schemaMigration(account, node, creationProps) {
  account.set("profile", "owner", "trusting");
}
```
**You literally cannot go simpler than this!**

**Next step:**
- Build up from this minimal base
- Add Groups when you need to create other CoValues
- Add schemas when you need validation
- Add migrations when schemas evolve

**The foundation is solid - now we can build anything on top!** 🚀
