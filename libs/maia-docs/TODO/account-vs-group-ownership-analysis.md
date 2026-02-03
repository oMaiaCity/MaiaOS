# Account vs Group Ownership Analysis

## Analogy Overview

**Account (EOA - Externally Owned Account):**
- Identity/authentication primitive
- Like Ethereum EOA - just a keypair for signing
- Created first via `createAccountWithSecret()`
- Contains minimal structure: `account.profile` (identity info)

**Group (Smart Contract Account / Safe-like):**
- Data ownership primitive
- Like Safe multisig - controls and owns all user data
- Created during `schemaMigration()` as "universal group"
- Stored in `account.profile.group` (single source of truth)
- **ALL user data CoValues are owned by this group**

## Current Implementation Status

### ✅ **Seeded Data - CORRECT**

**Location:** `libs/maia-db/src/cojson/schema/seed.js`

**How it works:**
1. Universal group is resolved from `account.profile.group` (lines 468-555)
2. **ALL** CoValues are created using `universalGroup.createMap()`, `universalGroup.createList()`, etc.
3. Comment confirms: "All CoValues are created with universal group as owner/admin (auto-assigned)" (line 21)

**Examples:**
- Schemas: `universalGroup.createMap(cleanedProperties, meta)` (line 706)
- Configs: `universalGroup.createMap({}, meta)` (line 1470)
- Data: `universalGroup.createMap(itemWithoutId, itemMeta)` (line 1604)

**✅ VERIFIED:** All seeded data correctly uses universal group as owner.

---

### ✅ **Dynamically Created Data - CORRECT**

**Location:** `libs/maia-db/src/cojson/crud/create.js`

**How it works:**
1. `create()` function calls `backend.getDefaultGroup()` (line 75)
2. `getDefaultGroup()` resolves universal group from `account.profile.group` (via `groups.getDefaultGroup()`)
3. CoValues are created using `group.createMap()`, `group.createList()`, etc. (lines 85, 93, 97)

**✅ VERIFIED:** All dynamically created data correctly uses universal group as owner.

---

### ✅ **CoValue Creation Helpers - CORRECT**

**Locations:**
- `libs/maia-db/src/cojson/cotypes/coMap.js`
- `libs/maia-db/src/cojson/cotypes/coList.js`
- `libs/maia-db/src/cojson/cotypes/coStream.js`

**How it works:**
1. Each helper checks if `accountOrGroup` is already a group (has `createMap` method)
2. If it's an account, resolves universal group from `account.profile.group`
3. Creates CoValue using `group.createMap()`, `group.createList()`, etc.

**✅ VERIFIED:** All CoValue creation helpers correctly resolve and use universal group.

---

### ✅ **Profile Creation - INTENTIONAL**

**Location:** `libs/maia-db/src/migrations/schema.migration.js:77`

**Implementation:**
```javascript
profile = account.createMap({
  name: accountName,
  group: universalGroup.id
}, {$schema: "ProfileSchema"});
```

**Analysis:**
- Profile is created using `account.createMap()` (owned by account, not group)
- **This is INTENTIONAL and CORRECT:**
  - Profile is part of account's **identity structure** (who you are)
  - Account owns its own identity (like EOA owns its own keypair)
  - Group owns **user data** (what you create)
- **Consistent with analogy:** 
  - Account (EOA) = Identity/authentication → owns profile
  - Group (Smart Contract) = Data ownership → owns all user data

**✅ VERIFIED:** Profile ownership by account is correct. All user data is owned by group.

---

## Verification Checklist

### ✅ Seeded Data
- [x] Schemas created with `universalGroup.createMap()`
- [x] Configs created with `universalGroup.createMap()`
- [x] Data entities created with `universalGroup.createMap()`
- [x] All seed operations use universal group from `account.profile.group`

### ✅ Dynamically Created Data
- [x] CRUD `create()` uses `backend.getDefaultGroup()`
- [x] `getDefaultGroup()` resolves from `account.profile.group`
- [x] All create operations use group, not account

### ✅ CoValue Creation Helpers
- [x] `createCoMap()` resolves universal group from account
- [x] `createCoList()` resolves universal group from account
- [x] `createCoStream()` resolves universal group from account

### ✅ Edge Cases
- [x] Profile creation uses `account.createMap()` (intentional - profile is identity structure, not user data)

---

## Summary

**✅ CORRECT:** All seeded and dynamically created **user data** correctly uses the universal group as owner.

**✅ CORRECT:** The analogy is properly implemented:
1. User creates account first (EOA)
2. Account creates universal group (Smart Contract Account)
3. Group owns and controls all user data

**✅ VERIFIED:** `account.profile` is correctly owned by account (identity structure). All user data is correctly owned by group.

---

## Final Verdict

**✅ ALL CORRECT:** The implementation correctly follows the account/group analogy:

1. **Account (EOA)** owns its identity structure (`account.profile`)
2. **Group (Smart Contract)** owns all user data (schemas, configs, data entities)
3. **All seeded data** uses universal group as owner ✅
4. **All dynamically created data** uses universal group as owner ✅
5. **All CoValue creation helpers** resolve and use universal group ✅

**No changes needed** - the implementation is correct!
