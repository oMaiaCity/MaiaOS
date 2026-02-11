---
name: Agent Register Human
overview: Replace curl todo trigger with curl to register a human in spark.registries.humans(@username: accountId). Enables agent to maintain a humans registry in the @Maia spark.
todos:
  - id: schema
    content: Add humans-registry schema (username -> account co-id)
    status: pending
  - id: seed-humans
    content: Seed/ensure spark.registries.humans exists (like sparks)
    status: pending
  - id: endpoint
    content: Add POST /register-human endpoint (username, accountId)
    status: pending
  - id: remove-trigger
    content: Remove or deprecate /trigger todo endpoint (optional)
    status: pending
isProject: false
---

# Agent: Register Human in spark.registries.humans

## Problem

Currently the agent has `/trigger` which creates todos via curl. The user wants to instead write into `spark.maia.registries.humans(@username: coid)` — a registry mapping usernames to account IDs. This enables:

- Agent maintains a humans registry in the human's @Maia spark
- Unique usernames → account co-ids for lookup
- Foundation for friends, discovery, human-to-human connection

## Solution

**New endpoint: POST /register-human**

```bash
curl -X POST http://localhost:4204/register-human \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","accountId":"co_zAliceAccountId"}'
```

**Data path:** `account.sparks[@Maia]` → human's spark → `spark.registries.humans` → `humans[@username] = accountId`

## Current State (Audit)

- **spark.registries** — CoMap (schema: `@maia/schema/os/registries`). Contains registry name → CoMap co-id. Has `sparks` (spark name → spark co-id). Defined in seed via `seedMaiaSparkRegistriesSparksMapping`.
- **spark.registries.sparks** — CoMap (schema: `@maia/schema/os/sparks-registry`). Keys: spark names, values: spark co-ids.
- **humans registry** — Does not exist yet. Need to add:
  1. Schema: `@maia/schema/os/humans-registry` (like sparks-registry: key → co-id)
  2. Seed/bootstrap: ensure `spark.registries.humans` CoMap exists
  3. Agent endpoint: write to it

- **Agent** — Has `account.sparks[@Maia]` = human's spark ID. Uses `ensureSparksAndGetContent` for sparks. For registries we need: load human's spark → get `spark.registries` → get `registries.humans` → set(username, accountId).

## Implementation

### 1. Schema: humans-registry

**File:** `libs/maia-schemata/src/os/humans-registry.schema.json`

```json
{
  "$schema": "@maia/schema/meta",
  "$id": "@maia/schema/os/humans-registry",
  "title": "@maia/schema/os/humans-registry",
  "description": "Humans registry CoMap - username -> account co-id. Stored in spark.registries.humans",
  "cotype": "comap",
  "indexing": false,
  "additionalProperties": {
    "type": "string",
    "pattern": "^co_z[a-zA-Z0-9]+$",
    "description": "Username -> account co-id"
  }
}
```

Add to `libs/maia-schemata/src/index.js` SCHEMAS and export.

### 2. Registries schema: add humans

**File:** `libs/maia-schemata/src/os/registries.schema.json`

Add optional `humans` property (or rely on additionalProperties — it already allows any registry name).

### 3. Seed: ensure spark.registries.humans

**File:** `libs/maia-db/src/cojson/schema/seed.js`

In `seedMaiaSparkRegistriesSparksMapping` (or a parallel function), after creating `sparks` registry:
- Resolve `@maia/schema/os/humans-registry`
- If `registriesContent.get('humans')` is null, create humans CoMap (same pattern as sparks: own group, extend maiaGroup, extend publicReaders, createMap with humans-registry schema)
- `registriesContent.set('humans', humansCoMap.id)`

**Note:** Existing human accounts won't have this until they re-seed or we add migration. Agent could create-on-write: if humans registry missing, create it (requires agent to have createCoValueForSpark capability on human's spark — it already writes to account.sparks and creates todos, so it can create registries.humans CoMap under human's guardian).

### 4. Agent endpoint: POST /register-human

**File:** `services/agent/src/index.js`

```javascript
// POST /register-human
// Body: { username: string (unique), accountId: string (co_z...) }
// Writes to spark.registries.humans[username] = accountId
```

Flow:
1. Validate username (non-empty, unique format — no @ in key, or decide convention e.g. `alice` or `@alice`)
2. Validate accountId (co_z...)
3. Get human's spark: `account.sparks[@Maia]` → sparkCoId
4. Load spark → get `spark.registries`
5. Load registries → get `registries.humans` (create if missing — optional)
6. Load humans CoMap
7. `humansContent.set(username, accountId)`
8. Return `{ ok: true, username, accountId }`

**Uniqueness:** If username already exists, overwrite (or return 409 conflict — decide). Overwrite is simpler for idempotent re-registration.

### 5. Curl examples

```bash
# Register a human in the @Maia spark's humans registry
curl -X POST http://localhost:4204/register-human \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","accountId":"co_zAliceAccountId"}'

# Response
{"ok":true,"username":"alice","accountId":"co_zAliceAccountId"}
```

## Out of Scope (v1)

- Uniqueness enforcement (reject duplicate username from different accountId)
- GET /register-human or /humans to list
- Webhook/auto-register on signup
- Remove /trigger (keep for now or remove — user said "instead of", so we may deprecate)

## Dependencies

- Human must have called `/on-added` first (agent has account.sparks[@Maia])
- Human's spark must have spark.registries (full bootstrap). If not, we need create-on-write or migration.
