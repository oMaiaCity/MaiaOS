# Plan: Move Schema Indexes to account.os.indexes

## Context

**Current State:**
- Schema indexes are stored directly in `account.os`, keyed by schema co-id
- Structure: `account.os[<schemaCoId>]` → colist of instance co-ids
- Internal keys: `account.os.schematas` (registry), `account.os.unknown` (unknown colist)

**Target State:**
- Schema indexes will be stored in `account.os.indexes`, keyed by schema co-id
- Structure: `account.os.indexes[<schemaCoId>]` → colist of instance co-ids
- Internal keys remain in `account.os`: `account.os.schematas`, `account.os.unknown`

**Clean Slate Approach:**
- ✅ **NO backward compatibility** - We're in sandbox/dev mode
- ✅ **NO migration logic** - Old accounts will be recreated fresh
- ✅ **Direct implementation** - Change all code to use `account.os.indexes` directly
- ✅ **No fallbacks** - Remove all old `account.os[<schemaCoId>]` lookups

## Milestones

### Milestone 1: Create account.os.indexes Infrastructure ✅
**Status:** `in_progress`

**Tasks:**
1. ✅ Add `ensureIndexesCoMap()` function in `schema-index-manager.js`
   - Creates `account.os.indexes` CoMap if it doesn't exist
   - Uses `GenesisSchema` (or proper schema if available)
   - Returns the indexes CoMap content

2. ✅ Update `ensureSchemaIndexColist()` to use `account.os.indexes`
   - Change from: `container.get(schemaCoId)` where `container = account.os`
   - Change to: `indexesContainer.get(schemaCoId)` where `indexesContainer = account.os.indexes`
   - Store new index colists in `account.os.indexes[<schemaCoId>]`

3. ✅ Update `getSchemaIndexColistForRemoval()` to read from `account.os.indexes`
   - Change lookup from `account.os` to `account.os.indexes`

4. ✅ Update `reconcileIndexes()` to iterate `account.os.indexes`
   - Change iteration from `account.os` keys to `account.os.indexes` keys
   - Skip `schematas` and `unknown` (they're in `account.os`, not `account.os.indexes`)

5. ✅ Update `isInternalCoValue()` to check `account.os.indexes`
   - Add check for `account.os.indexes` itself
   - Update logic to check if co-value is in `account.os.indexes` (not `account.os`)

6. ✅ Update file header comments
   - Update structure documentation to reflect `account.os.indexes` location

**Files:**
- `libs/maia-db/src/cojson/indexing/schema-index-manager.js`

---

### Milestone 2: Update Query Engine ✅
**Status:** `pending`

**Tasks:**
1. Update `getSchemaIndexColistId()` in `collection-helpers.js`
   - Change lookup from `account.os[<schemaCoId>]` to `account.os.indexes[<schemaCoId>]`
   - Load `account.os.indexes` CoMap instead of `account.os` for index lookups

**Files:**
- `libs/maia-db/src/cojson/crud/collection-helpers.js`

---

### Milestone 3: Update Storage Hook Wrapper ✅
**Status:** `pending`

**Tasks:**
1. Update `wrapStorageWithIndexingHooks()` in `storage-hook-wrapper.js`
   - Update check for schema index colists to look in `account.os.indexes` (not `account.os`)
   - Update comment to reflect new structure

**Files:**
- `libs/maia-db/src/cojson/indexing/storage-hook-wrapper.js`

---

### Milestone 4: Update Seeding Logic ✅
**Status:** `pending`

**Tasks:**
1. Update `ensureAccountOs()` in `seed.js`
   - After creating `account.os`, create `account.os.indexes` CoMap
   - Use `GenesisSchema` (or proper schema if available)
   - Store in `account.os.indexes`

**Files:**
- `libs/maia-db/src/cojson/schema/seed.js`

---

### Milestone 5: Plan Auto-Seeding on Account Signup ✅
**Status:** `pending`

**Design Decision:**
- **When:** During initial account signup (after `signUpWithPasskey` succeeds)
- **Where:** In the signup flow, after account creation but before user interaction
- **What:** Call `seedAccount()` automatically for new accounts
- **How:** Add auto-seeding hook in account creation flow

**Implementation Options:**

**Option A: Hook in Account Creation Flow**
- Add auto-seeding call in `signUpWithPasskey` or account initialization
- Pros: Simple, explicit
- Cons: Requires finding the right place in the codebase

**Option B: Storage Hook Detection**
- Detect new accounts in storage hook and auto-seed
- Pros: Automatic, no code changes needed
- Cons: More complex, might trigger multiple times

**Option C: Explicit API Call**
- Add `/api/v0/seed` endpoint that clients call after signup
- Pros: Explicit, controllable
- Cons: Requires client-side changes

**Recommendation:** **Option A** - Add explicit auto-seeding call in account creation flow, right after account is created and before returning to client.

**Files to Update:**
- Find account signup/creation code
- Add `seedAccount()` call after account creation
- Ensure it only runs once per account (idempotent)

---

### Milestone 6: Implement Auto-Seeding (After Design Approval) ✅
**Status:** `pending`

**Tasks:**
1. Find account signup/creation code
2. Add `seedAccount()` import
3. Call `seedAccount()` after account creation
4. Ensure idempotency (check if already seeded)
5. Test with fresh account signup

**Files:**
- TBD (need to find account signup code)

---

## Implementation Notes

### Key Changes Summary

1. **Schema Index Location:**
   - **Before:** `account.os[<schemaCoId>]` → colist
   - **After:** `account.os.indexes[<schemaCoId>]` → colist

2. **Internal Structure:**
   - `account.os.schematas` → registry (stays in `account.os`)
   - `account.os.unknown` → unknown colist (stays in `account.os`)
   - `account.os.indexes` → new CoMap for schema indexes

3. **Functions to Update:**
   - `ensureSchemaIndexColist()` - Create/store in `account.os.indexes`
   - `getSchemaIndexColistId()` - Read from `account.os.indexes`
   - `getSchemaIndexColistForRemoval()` - Read from `account.os.indexes`
   - `reconcileIndexes()` - Iterate `account.os.indexes`
   - `isInternalCoValue()` - Check `account.os.indexes`
   - `ensureAccountOs()` - Create `account.os.indexes` during seeding

### Testing Strategy

1. **Fresh Account Test:**
   - Create new account
   - Verify `account.os.indexes` is created
   - Verify schema indexes are stored in `account.os.indexes`
   - Verify queries work correctly

2. **Indexing Test:**
   - Create new co-value with schema
   - Verify it's indexed in `account.os.indexes[<schemaCoId>]`
   - Verify it's NOT in `account.os[<schemaCoId>]`

3. **Query Test:**
   - Query by schema
   - Verify results come from `account.os.indexes`

---

## Progress Tracking

- [x] Milestone 0: Capture Current State & System Audit
- [ ] Milestone 1: Create account.os.indexes Infrastructure
- [ ] Milestone 2: Update Query Engine
- [ ] Milestone 3: Update Storage Hook Wrapper
- [ ] Milestone 4: Update Seeding Logic
- [ ] Milestone 5: Plan Auto-Seeding on Account Signup
- [ ] Milestone 6: Implement Auto-Seeding (After Design Approval)

---

## Notes

- **No Migration Needed:** Since we're in sandbox/dev mode, old accounts can be recreated fresh
- **Clean Implementation:** All code will use `account.os.indexes` directly - no fallbacks or compatibility layers
- **Breaking Change:** This is a breaking change, but acceptable in dev mode
- **Testing:** Focus on fresh account creation and indexing flow
