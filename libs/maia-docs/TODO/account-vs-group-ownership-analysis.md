# Account vs Group Ownership Analysis

> **Note:** This document describes the OLD architecture (universal group via `account.profile.group`).
> As of the Registry Scopes and Spark Bootstrapping refactor, the architecture uses:
> - **@maia spark** at `account.sparks["@maia"]` with `{ name, group, os, vibes }`
> - Group resolved via `backend.getMaiaGroup()` → `getSparkGroup(backend, '@maia')`
> - Profile: `{ name }` only (no group)
> - Schematas at `account.sparks["@maia"].os.schematas`, vibes at `account.sparks["@maia"].vibes`

## Analogy Overview

**Account (EOA - Externally Owned Account):**
- Identity/authentication primitive
- Like Ethereum EOA - just a keypair for signing
- Created first via `createAccountWithSecret()`
- Contains minimal structure: `account.profile` (identity info)

**Group (Smart Contract Account / Safe-like):**
- Data ownership primitive
- Like Safe multisig - controls and owns all user data
- Created during `schemaMigration()` as @maia spark's group
- Stored in `account.sparks["@maia"].group`
- **ALL user data CoValues are owned by this group**

---

*The remainder of this document (verification checklists, CRUD flow details) described the old `getDefaultGroup`/`profile.group` flow. All references have been migrated to `getMaiaGroup()` and spark-scoped paths.*
