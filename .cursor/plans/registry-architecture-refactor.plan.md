---
name: Registry Architecture Refactor
overview: Refactor registries from account.sparks[@maia].registries to account.registries; consolidate /register; auto-register humans on sign-in; many-to-1 with auto-naming.
todos:
  - id: milestone-1
    content: Seed data (adjectives.json, animals.json) and generateRegistryName()
    status: completed
  - id: milestone-2
    content: Bootstrap account.registries in seed (replace registries under spark)
    status: completed
  - id: milestone-3
    content: Consolidated POST /register endpoint
    status: completed
  - id: milestone-4
    content: GET /syncRegistry returns registries co-id for all modes
    status: completed
  - id: milestone-5
    content: Auto-register human on sign-in and sign-up
    status: completed
  - id: milestone-6
    content: Migration and call-site updates
    status: completed
  - id: milestone-7
    content: Documentation and final review
    status: completed
isProject: false
---

# Registry Architecture Refactor Plan

## Overview

Refactor the MaiaOS registry system from `account.sparks[@maia].registries` to a top-level `account.registries` structure. The seeded Maia registry becomes the master reference. Consolidate registration endpoints, enable syncRegistry for normal agent mode, implement many-to-1 (username → co-id) mapping with auto-generated default names, and auto-register humans during sign-in/sign-up.

---

## Problem Statement

- Registries are buried under `account.sparks[@maia].registries` — tightly coupled to the @maia spark scaffold.
- Multiple endpoints (`/syncRegistry`, `/register-human`) with inconsistent semantics.
- syncRegistry only works when account has full scaffold (sync agent); normal agent and human both need it.
- Human registration is not wired from client; no auto-registration on auth.
- No many-to-1 support (one identity, many usernames).
- No default auto-naming for new humans/sparks.

---

## Success Criteria

- **Desirable**: Humans get a human-readable identity by default; registry is discoverable for all account types.
- **Feasible**: Single `account.registries` (Maia guardian, public read); unified `/register`; auto-register on sign-in.
- **Viable**: Seed data (adjectives, animals) in JSON; uniqueness enforced; 100% migration, no backward compat.

---

## Solution Approach

### 1. New Account Structure

**Before:** `account.sparks` → sparks CoMap → `@maia` → spark → `spark.registries.{sparks,humans}`

**After:** `account.registries` → registries CoMap (Maia guardian, publicReaders=reader) → `{ sparks, humans }`

- `account.registries` is a CoMap co-id (not nested under sparks).
- Maia (sync agent) is guardian owner; everyone has public read.
- Path: `account.registries.sparks` (CoMap: username → spark co-id), `account.registries.humans` (CoMap: username → account co-id).
- **Default first spark:** `account.registries.sparks["@maia"]` = maia spark co-id. This is the canonical first entry, seeded only by sync agent.

### 1b. Who Seeds vs Who Links

- **Sync agent only** seeds the full registries structure (genesis seed): `account.registries`, `registries.sparks`, `registries.humans`, and `registries.sparks["@maia"]` = maia spark co-id.
- **Human and normal agent** never seed registries. They only link: set `account.registries = registriesCoId` (the co-id returned by GET /syncRegistry), which points to the sync server's registries CoMap.

### 2. Many-to-1 Logic

- Multiple usernames can map to the same co-id (human or spark).
- Registry: `username → co-id`. Same co-id can appear under many keys (inverse index if needed: `co-id → [usernames]` stored elsewhere, or scan humans/sparks map for co-id).
- **Uniqueness**: username must be unique across the registry. Reject duplicate username → different co-id. Allow same co-id under multiple usernames.

### 3. Auto-Naming

- **Format:** `human:{adjective}-{animal}-{8digits}` or `spark:{adjective}-{animal}-{8digits}`
- **Example:** `human:sparkling-elephant-52341938`, `spark:brave-dolphin-71234567`
- **Source:** `libs/maia-seed/` or `libs/maia-db/` JSON: `adjectives.json` (100 items), `animals.json` (100 items).
- **Generation:** `adjective = adjectives[index % 100]`, `animal = animals[index % 100]`, `digits = random 8-digit string`. Retry if collision.
- **Uniqueness:** Before write, check registry; if username exists and points to different co-id → 409. If same co-id → idempotent success.

### 4. Consolidated Endpoint

`**POST /register**`

```json
{
  "type": "human" | "spark",
  "username": "xyz",           // optional; if omitted, auto-generate
  "accountId": "co_z...",      // required for type=human
  "sparkCoId": "co_z..."       // required for type=spark
}
```

- Writes to `account.registries.humans` or `account.registries.sparks`.
- Sync agent (moai) executes the write.
- **Duplicate handling:** If username exists and maps to different co-id → 409. If same co-id → 200 (idempotent).

### 5. syncRegistry for Human and Agent (Link Only)

**GET /syncRegistry**

- Returns `{ registries: "co_z..." }` — the sync server's `account.registries` co-id (the master/canonical registries CoMap).
- **What it does for human and agent:** Nothing more than provide the co-id. The client then sets `account.registries = registriesCoId` **once** on their account. That's it — they store a reference to the sync server's registries.
- Human: `linkAccountToRegistries` fetches GET /syncRegistry, then `account.set('registries', registriesCoId)`.
- Agent: Same — fetch, then set `account.registries = registriesCoId` once.
- No seeding, no creation. Just a one-time write of the reference.

### 6. Auto-Register Human on Sign-In / Sign-Up (Automatic)

- **Trigger:** During sign-in and sign-up, automatically and immediately after `MaiaOS.boot` and `linkAccountToRegistries`.
- **Action:** Call `POST /register` with `{ type: "human", accountId: account.id }` and optionally `username` (profile.name or firstName).
- **Flow:**
  1. Sign-in or sign-up completes → maia boots → linkAccountToRegistries runs.
  2. **Automatically** call `POST ${moaiBaseUrl}/register` with `{ type: "human", accountId: maia.id.maiaId.id, username?: ... }`.
  3. Use profile name from `account.profile` when available; on sign-up use firstName from input. If none, omit for server auto-generation.
  4. Non-blocking: fire-and-forget (`.catch(() => {})`). Never block UI.
- **Idempotency:** Server returns 200 if human already registered under same accountId (or adds new username for many-to-1). Duplicate username → different accountId → 409.

---

## File Structure

```
libs/maia-db/
  src/seed/
    adjectives.json      # 100 positive adjectives
    animals.json         # 100 animals
  src/cojson/schema/seed.js   # bootstrap account.registries, seed registries.sparks/humans
  src/migrations/        # migration: account.sparks.@maia.registries → account.registries

libs/maia-schemata/
  src/os/registries.schema.json   # update: stored in account.registries
  src/os/humans-registry.schema.json
  src/os/sparks-registry.schema.json

services/moai/
  src/index.js           # POST /register, GET /syncRegistry (returns registries co-id)
```

---

## Implementation Milestones

### Milestone 1: Seed Data and Name Generator

- Create `libs/maia-db/src/seed/adjectives.json` (100 positive adjectives).
- Create `libs/maia-db/src/seed/animals.json` (100 animals).
- Implement `generateRegistryName(type: 'human'|'spark'): string` using `(index % 100)` for adjective/animal, random 8 digits.
- Add collision check: query registry before returning; retry with new random if collision (max retries).
- **Uniqueness:** Enforce in `/register` handler: reject if username exists and maps to different co-id.

### Milestone 2: Bootstrap account.registries in Seed (Sync Agent Only)

- **Only runs during genesis seed** (PEER_MODE=sync, PEER_FRESH_SEED=true). Human and agent never run this.
- Create `account.registries` CoMap: Maia guardian owner, publicReaders reader.
- Create `registries.sparks`, `registries.humans` nested CoMaps.
- **Default first spark entry:** Seed `registries.sparks["@maia"] = maiaSparkCoId` — the maia spark stays as the canonical first spark.
- Remove registries creation from `seedMaiaSparkRegistriesSparksMapping`; move to bootstrap.
- Human/agent: `simpleAccountSeed` unchanged (empty account); they link via syncRegistry, not seed.

### Milestone 3: Consolidated POST /register Endpoint

- Replace `POST /register-human` with `POST /register`.
- Body: `{ type, username?, accountId?, sparkCoId? }`.
- Resolve `account.registries.humans` or `account.registries.sparks`.
- If `username` omitted: call `generateRegistryName(type)`.
- Check uniqueness: if username exists and value !== co-id → 409.
- Write `{ [username]: coId }` via dbEngine update.
- Remove `handleRegisterHuman`; add `handleRegister`.

### Milestone 4: GET /syncRegistry Returns Registries (Link Behavior)

- Change `handleSyncRegistry` to return `{ registries: account.registries }` (co-id of sync server's registries CoMap).
- **Human and agent:** Fetch GET /syncRegistry, then set `account.registries = registriesCoId` **once** on their account. No seeding, no creation — just store the reference.
- Update maia frontend `linkAccountToSyncRegistry` → `linkAccountToRegistries`: `account.set('registries', registriesCoId)`.
- Works for human (has storage) and normal agent (has storage when PEER_MODE=agent + PEER_MOAI). Both link by writing the co-id to `account.registries`.

### Milestone 5: Auto-Register Human on Sign-In and Sign-Up

- After `linkAccountToRegistries(maia)` in both `signIn` and `register` flows, call:
`fetch(\`${baseUrl}/register, { method: 'POST', body: JSON.stringify({ type: 'human', accountId: maia.id.maiaId.id, username: profileName ?? undefined }) })`
- Use profile name from `account.profile` when available; on sign-up use `firstName` from input.
- If no username, omit — server auto-generates.
- Fire-and-forget: `.catch(() => {})` to avoid blocking.
- Ensure `getMoaiBaseUrl()` is available and correct for the environment.

### Milestone 6: Migration and Call-Site Updates

- Migration: For existing accounts with `account.sparks[@maia].registries`, copy to `account.registries` or add `account.registries` pointing to same structure. Prefer 100% migration: create new `account.registries`, migrate data, deprecate old path.
- Update all reads of `account.sparks` for registry purposes to `account.registries`.
- Update resolver, groups, cojson-backend to use `account.registries`.
- Delete legacy registry code under spark.

### Milestone 7: Documentation and Final Review

- Update `libs/maia-docs/03_developers/state-and-persistence.md`.
- Document `/register` and `/syncRegistry` contracts.
- Document auto-register behavior.
- Manual testing: sign-up, sign-in, verify human in registry; verify syncRegistry for agent.

---

## Manual Testing Strategy

- **Sign-up:** Create new account → verify POST /register called with accountId → verify human appears in registry (auto or custom name).
- **Sign-in:** Existing account → verify POST /register called (idempotent) → verify registry unchanged or updated.
- **syncRegistry:** Human and agent modes → GET /syncRegistry → verify registries co-id returned.
- **Normal agent:** PEER_MODE=agent, fetch /syncRegistry, set account.registries.
- **Uniqueness:** Register same username for different accountId → expect 409.

---

## Risks and Mitigation


| Risk                             | Mitigation                                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Breaking vibes/sparks resolution | Keep `account.sparks` for @maia spark if needed for vibes; registry reads go through `account.registries`. Clarify split. |
| Migration complexity             | Start fresh for new deploys; migration only for existing DBs with data.                                                   |
| Auto-name collision              | Retry with new random; max 10 retries; fallback to `human:u-{timestamp}-{random}`.                                        |
| Race on sign-in register         | Idempotent server; duplicate requests OK.                                                                                 |


---

## Resolved

- **Default first spark:** `account.registries.sparks["@maia"]` = maia spark co-id. Seeded only in sync agent.
- **Seeding:** Only sync agent seeds the full registries structure. Human and agent never seed.
- **syncRegistry for human/agent:** Endpoint returns registries co-id; client sets `account.registries = registriesCoId` once. That's it — just linking to the canonical registries.

