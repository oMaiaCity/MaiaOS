---
name: ""
overview: ""
todos: []
isProject: false
---

# Agent Collab + Curl Todo + Profile Name (Simplified)

## Simplified Flow: Manual Direct Notification

**No webhooks.** Human adds agent via Sparks UI, then manually notifies the agent:

```bash
# 1. Human adds agent account co-id as writer in Sparks UI (existing flow)

# 2. Human copies their @maia spark co-id (from UI or devtools)

# 3. Manual direct notification - curl to agent
curl -X POST http://localhost:4204/on-added \
  -H "Content-Type: application/json" \
  -d '{"sparkId":"co_zYourMaiaSparkId"}'
```

Agent receives, adds `account.sparks["@Maia"] = sparkId`. Done.

**Skipped:**

- Webhook URL input in Sparks UI
- @agentNotify tool
- Automatic callback from maia-city
- Any cross-service HTTP from UI to agent

---

## Implementation Milestones (Simplified)

### Milestone 1: Profile Name Fix

- [libs/maia-db/src/migrations/schema.migration.js](libs/maia-db/src/migrations/schema.migration.js): Use `creationProps?.name ?? 'Maia'`
- [libs/maia-agent/src/index.js](libs/maia-agent/src/index.js): Pass `name: process.env.AGENT_MAIA_PROFILE_NAME || 'Maia Agent ' + randomId()` to createAgentAccount
- [libs/maia-self/scripts/generate-credentials.js](libs/maia-self/scripts/generate-credentials.js): Add AGENT_MAIA_PROFILE_NAME to .env output

### Milestone 2: Operations Spark Param

- [libs/maia-db/src/cojson/crud/create.js](libs/maia-db/src/cojson/crud/create.js): Add spark param, default '@maia'
- [libs/maia-db](libs/maia-db) backend create: Accept spark
- [libs/maia-operations](libs/maia-operations) createOperation: Pass spark

### Milestone 3: Agent /on-added + /trigger

- **POST /on-added**: Body `{ sparkId }` → mutate `account.sparks` CoMap, set('@Maia', sparkId)
- **POST /trigger**: Body `{ text?, spark? }` → create todo via dbEngine, default spark @Maia or @maia
- Agent: Add CoJSONBackend + DBEngine from node/account for DB ops

---

## Curl Examples

```bash
# Manual: After adding agent in Sparks UI, notify agent of your spark
curl -X POST http://localhost:4204/on-added \
  -H "Content-Type: application/json" \
  -d '{"sparkId":"co_zHumanMaiaSparkId"}'

# Push todo (uses @Maia if set, else @maia)
curl -X POST http://localhost:4204/trigger \
  -H "Content-Type: application/json" \
  -d '{"text":"Buy milk from agent","spark":"@Maia"}'
```

