---
name: Humans Vibe Runtime Access Control
overview: Implement the Humans vibe as a server-only vibe with runtime filtering (account/group co-ids), migrate agent service from direct HTTP to inbox-driven processing, and establish the foundation for inbox-as-gatekeeper architecture.
todos:
  - id: milestone-0
    content: Capture Current State & System Audit
    status: pending
  - id: milestone-1
    content: Add runtimes schema (spark.os.runtimes) and load filter
    status: pending
  - id: milestone-2
    content: Create Humans vibe (manifest, actor, inbox, state, context)
    status: pending
  - id: milestone-3
    content: Agent service as vibe runner (load runtime vibes, process inbox)
    status: pending
  - id: milestone-4
    content: Documentation & Final Review
    status: pending
isProject: false
---

# Humans Vibe: Runtime Filtering & Inbox-Driven Agent

## Problem Statement

**Current state:**

- Agent, API, and sync services have no auth gateway ("open doors")
- Agent service bypasses inbox: `handleRegisterHuman` does direct `dbEngine.execute` on HTTP POST
- No way to designate which accounts run which vibes
- Human registry lives in `spark.registries.humans`; agent writes directly

**Desired state:**

- CoJSON inbox is the gatekeeper for agent operations
- Spark guardians route each vibe to a runtime (browser vs agent) when registering it in the spark
- Agent processes Humans vibe inbox instead of HTTP handlers
- Guardian stays recovery owner (can bypass agent, edit registry directly)

## Success Criteria

- **Desirable:** Human registration flows through inbox; agent applies validation; guardian can still override
- **Feasible:** Runtime assignment at spark level; agent loads vibes routed to it; client loads vibes routed to browser
- **Viable:** Extensible pattern; guardians control where vibes run (no vibe self-authority)

## Solution Approach

1. **Runtime is defined by the host (spark guardians), not the vibe.**
2. **New schema: `runtimes**` — CoMap at `spark.os.runtimes`. Key = **vibe co-id** (not human-readable key). Value = array of runtime assignments.
3. **Runtime types (for now):** `browser` | `server`
4. **Structure:** Key = vibe co-id. Value = array of `{ browser: accountCoId }` or `{ server: accountCoId }`. A vibe can run in browser AND server, and on multiple servers (multiple agents).
5. **Load filter:** "Is my current account in any entry for this vibe?" — browser checks `browser` entries; agent checks `server` entries where account matches.

## Implementation Milestones

### First Setup Layer: How the Agent Connects to the Spark

**Yes—still manual.** Two steps:

1. **Add agent to spark guardian** — Human (guardian) uses Sparks vibe → spark detail → "Add agent", enters agent account ID. This calls `addSparkMember` and adds the agent account to the spark's guardian. The agent gains CoJSON read/write access to the spark's data.
2. **Register the spark with the agent** — Human (or script) calls `POST /on-added` with `{ sparkId: "co_z..." }`. The agent sets `account.sparks["@Maia"] = sparkId`. The agent can then resolve paths like `sparks → @Maia → registries → humans`.

Both steps are manual. No automatic discovery. The agent needs (a) membership in the guardian, and (b) the spark co-id so it can register and traverse.

---

### Milestone 0: Capture Current State & System Audit

**CRITICAL: This MUST be completed before all other milestones**

**System Audit:**

- Identify vibe manifest schema, loader, seeding flow (maia-vibes, maia-city, maia-db)
- Map agent service: handleRegisterHuman, getSparksId, getCoIdByPath, loadCoMap
- Map processInbox, createAndPushMessage, ActorEngine.processMessages
- Document spark.registries.humans creation (schema.migration, seed.js)
- List all call sites for vibe loading (maia-city, boot flow)
- Document current agent HTTP endpoints and their DB operations

**Output:** Complete baseline understanding before making changes

**Human Checkpoint:** Present audit findings before proceeding to implementation

---

### Milestone 1: Add `runtimes` schema and implement load filter

**Implementation (Root-Cause Architectural Solution):**

- **New schema:** `@maia/schema/os/runtimes` — CoMap. Key = vibe key (string) or vibe co-id. Value = CoList of CoMaps: `[{ browser: accountCoId }, { server: agentAccountId }, ...]`. Each item has exactly one of `browser` or `server` (account co-id).
- **Location:** `spark.os.runtimes` — CoMap keyed by **vibe co-id** (not human-readable key). Values: array of `{ browser: coId }` or `{ server: coId }`. Multiple entries = vibe runs in multiple runtimes / multiple agents.
- **Runtime types:** `browser`, `server` (for now)
- **Example:** `spark.os.runtimes["co_zHumansVibe..."] = [{ server: "co_zAgentAccount..." }]` — only agent runs it. Key is vibe co-id.
- Implement load filter: read `spark.os.runtimes[vibeCoId]`. Only load if explicit entry exists and matches. No entry = don't load. No fallbacks.
- **Seeding:** Ensure `spark.os.runtimes` exists; seed Humans with `runtimes[humansVibeCoId] = [{ server: agentAccountId }]` (key = vibe co-id)

**Cleanup & Migration (100%—no fallbacks):**

- Migrate all existing vibes (todos, db, sparks, chat, creator): add explicit `spark.os.runtimes[vibeCoId] = [{ browser: guardianCoId }]` for each. No vibe loads without explicit runtimes entry.

**Human Checkpoint:** Runtimes CoMap works; only vibes with explicit runtimes load

---

### Milestone 2: Create Humans vibe (manifest, actor, inbox, state, context)

**Implementation (Root-Cause Architectural Solution):**

- Create `libs/maia-vibes/src/humans/` with manifest, loader, registry
- manifest.vibe.maia: **No runtime**—vibe never defines its own runtime. Guardian assigns at spark level when registering.
- vibe.actor.maia: role agent, messageTypes: ["REGISTER_HUMAN"]
- vibe.inbox.maia: CoStream
- vibe.state.maia: On REGISTER_HUMAN → invoke @db update on spark.registries.humans
- vibe.context.maia: minimal (spark reference)
- vibe.view.maia: minimal placeholder (server-only)
- brand.style.maia: minimal
- Add REGISTER_HUMAN message schema if needed
- Add HumansVibeRegistry to ALL_REGISTRIES in maia-vibes/src/index.js
- Add "humans" to vibe seeding config so it seeds into @Maia spark
- **Seeding:** When seeding Humans into @Maia, add `spark.os.runtimes[humansVibeCoId] = [{ server: agentAccountId }]` — key is the seeded Humans vibe co-id

**Default Behaviors:** N/A (read/update only; registries.humans already exists)

**Cleanup & Migration:**

- No legacy to remove

**Human Checkpoint:** Humans vibe seeds into @Maia with runtime assigned to agent (at spark level)

---

### Milestone 3: Agent service as vibe runner (load runtime vibes, process inbox)

**Implementation (Root-Cause Architectural Solution):**

- Agent service: After boot, load vibes from @Maia spark where `spark.os.runtimes[vibeCoId]` contains `{ server: agentAccountId }`
- Integrate maia-script (ActorEngine, StateEngine, tool registry) into agent—or lightweight inbox adapter
- For each loaded server vibe: resolve actor config, inbox co-id; poll processInbox
- On REGISTER_HUMAN message: state machine invokes @db update (or inline handler that calls dbEngine.execute)
- **Keep /register-human for curl testing** — but change implementation: receive `{ username, accountId }` → createAndPushMessage to Humans actor inbox with REGISTER_HUMAN → agent processes inbox. No direct DB; routes through inbox. Enables curl without bootstrapping another account.

**Cleanup & Migration:**

- Replace handleRegisterHuman implementation: HTTP → createAndPushMessage(to Humans inbox) → processInbox handles it. Same curl interface; inbox-driven under the hood.
- Update agent README

**Manual Browser Debugging:** N/A (backend-only). Manual curl/agent testing.

**Human Checkpoint:** Agent processes REGISTER_HUMAN from inbox; human registry updates; curl to /register-human works (inbox-driven)

---

### Milestone 4: Documentation & Final Review

- Manual testing: agent processes inbox; registry updates; guardian can still edit directly
- Verify: Root causes solved? (inbox as gatekeeper; runtime filtering)
- Update `libs/maia-docs/developers/` with spark runtime routing (guardians assign at spark level)
- Update `libs/maia-docs/creators/` with how guardians route vibes to agent
- Skip `libs/maia-docs/agents/LLM_*.md`
- Final human approval

---

## File Structure

```
libs/maia-schemata/
  os/runtimes.schema.json          # CoMap: vibeCoId -> array of { browser | server: accountCoId }

# spark.os.runtimes structure (key = vibe co-id):
#   "co_zHumansVibe..." -> [{ server: "co_zAgent..." }]
#   "co_zTodosVibe..."  -> [{ browser: "co_zGuardian..." }]

libs/maia-vibes/src/
  humans/
    manifest.vibe.maia              # No runtime—guardian assigns at spark
    loader.js
    registry.js
    vibe/
      vibe.actor.maia
      vibe.context.maia
      vibe.state.maia
      vibe.view.maia
      vibe.inbox.maia
      brand.style.maia
  index.js                          # Add HumansVibeRegistry

services/agent/
  src/index.js                      # Refactor: /register-human → createAndPushMessage → inbox
```

## Manual Testing Strategy

- **Runtime filter:** Sign in as human; Humans vibe should NOT appear/load (spark routes it to agent). Agent should load it.
- **Inbox flow (curl):** `curl -X POST .../register-human -d '{"username":"sam","accountId":"co_z..."}'` → agent createAndPushMessage to Humans inbox → agent processes → registry updates. No bootstrap of another account.
- **Guardian bypass:** Human edits spark.registries.humans directly via @db; changes persist.

## Risks & Mitigation

- **Runtime at seed time:** `spark.os.runtimes` seeded with env (AGENT_MAIA_AGENT_ACCOUNT_ID). Guardian can edit runtimes CoMap later.
- **Lightweight vs full ActorEngine:** Agent may need full maia-script. Alternative: lightweight adapter that maps REGISTER_HUMAN to existing handleRegisterHuman logic. Start lightweight; migrate to full if needed.

## Documentation Updates

- `libs/maia-docs/developers/spark-runtime-routing.md` (new)—guardians route vibes to runtimes
- `libs/maia-docs/creators/server-vibes.md` (new or add)—how to route vibes to agent
- Skip `libs/maia-docs/agents/LLM_*.md`

