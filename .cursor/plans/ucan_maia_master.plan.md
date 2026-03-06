---
name: UCAN MaiaOS Master Plan
overview: Single superseding plan integrating all UCAN/capability architecture decisions, agent/intentActor pattern, °Maia/actor/services/moai (no /api), inter-agent messaging via agent.actor, and incremental human-testable milestones.
todos:
  - id: m0
    content: M0 — System Audit (BLOCKING)
    status: completed
  - id: m1
    content: M1 — Schemas + Moai Agent (manifest + intent + service)
    status: completed
  - id: m2
    content: M2 — syncRegistry (peerAgentId, moaiIntentActorCoId)
    status: completed
  - id: m3
    content: M3 — ensureAccountCapabilities migration
    status: completed
  - id: m4
    content: M4 — handleRegister (Capability + inbox writer)
    status: completed
  - id: m5
    content: M5 — ServerRuntime + Moai agent executor
    status: completed
  - id: m6
    content: M6 — Moai executableFunction (verify + RedPill)
    status: completed
  - id: m7
    content: M7 — Client deliverEvent via agent.actor
    status: completed
  - id: m8
    content: M8 — Remove HTTP LLM + Documentation
    status: completed
isProject: true
---

# UCAN MaiaOS — Master Plan

Single superseding plan: all architecture decisions, agent pattern, UCAN alignment, and human-testable milestones.

---

## Part 1: Architecture Decisions

### 1.1 Problem Statement & Success Criteria

**Problem:** LLM endpoint is unauthenticated. Need capability-based auth with invoker binding; cojson-native.

**Success criteria:** Desirable (registered humans only), Feasible (cojson-native), Viable (extensible).

**Root cause:** HTTP + co-id cannot prove invoker. Inbox + writer membership + creator provenance can.

---

### 1.2 UCAN Architecture Decisions (Fixed)


| Decision               | Choice                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| **Transport**          | moai inbox — centralized, no HTTP for API                                                   |
| **Invoker binding**    | Provenance via creator session→account; only writers push                                   |
| **Capabilities**       | account.capabilities CoStream; moai pushes on register                                      |
| **Moai inbox writers** | Moai + each registered human (added on register)                                            |
| **UCAN alignment**     | Semantics: sub=accountId, cmd, exp; executor validation                                     |
| **Principal**          | Account co-id (cojson-native). Subject, invoker, capability accountId — all account co-ids. |
| **Multi-use**          | Yes, until exp                                                                              |
| **Nonce/Replay**       | CoValue co-id + CoStream tx = implicit nonce                                                |
| **Revocation**         | Remove human from moai inbox writers; capabilities expire by exp                            |


---

### 1.3 Actor Path: °Maia/actor/services/moai (No /api)

Use `°Maia/actor/services/moai` directly — no `/api` suffix. Same pattern as `°Maia/actor/services/spark`, `°Maia/actor/services/todos`.


| Component | Path / ID                           |
| --------- | ----------------------------------- |
| Actor     | °Maia/actor/services/moai           |
| Inbox     | °Maia/actor/services/moai/inbox     |
| Process   | °Maia/actor/services/moai/process   |
| Interface | °Maia/actor/services/moai/interface |


---

### 1.4 Agent Pattern & Inter-Agent Messaging

**Agent-level access control:** Access is managed at the agent level. All dependent actors inherit the agent's rights.

**Inter-agent messaging via agent.actor:** When Agent A wants to message Agent B, A sends to B's `agent.actor` (the intent actor). The intent actor is the agent's entry point and owns agent-level access.

**Moai is a full agent with its own intent actor** — same pattern as todos, chat, sparks. Not an exception.


| Agent type          | agent.actor                    | Role                                             |
| ------------------- | ------------------------------ | ------------------------------------------------ |
| todos, chat, sparks | °Maia/todos/actor/intent, etc. | UI intent actor (has view)                       |
| moai                | °Maia/moai/actor/intent        | Headless intent actor; forwards to service actor |


**Flow:** Chat agent needs LLM → delivers to moai agent's actor (`°Maia/moai/actor/intent`) → intent actor forwards to `°Maia/actor/services/moai` → service actor does capability verify + RedPill, delivers SUCCESS/ERROR to replyTo.

**Client resolution:** syncRegistry returns `moaiIntentActorCoId` (= resolve °Maia/agent/moai → agent.actor = °Maia/moai/actor/intent). Client uses agent.actor as target for deliverEvent.

---

### 1.5 Agent/Account → Actor/Inbox Mappings

```
account.registries → sparks.°Maia → agents.{key} = agent co-id
agent.dependencies = [actorRef1, actorRef2, ...]  (actor refs to watch)
agent.actor = intent actor (entry point for inter-agent messages)
°Maia/moai/actor/intent.inbox = receives inter-agent messages (human writers added at register)
°Maia/actor/services/moai.inbox = receives from intent via tell (moai-internal)
```

**Moai agent manifest:**

```json
{
  "$id": "°Maia/agent/moai",
  "name": "Moai API",
  "actor": "°Maia/moai/actor/intent",
  "dependencies": [
    "°Maia/moai/actor/intent",
    "°Maia/actor/services/moai"
  ]
}
```

**Moai intent actor:** °Maia/moai/actor/intent — headless entry point. Process: LLM_CHAT → tell °Maia/actor/services/moai (forwards payload including replyTo). No view.

---

### 1.6 ServerRuntime = Moai Agent Executor

Same pattern as browser: `account → registries → sparks → agents` → load agent → get dependencies → watch inboxes.

**Difference:** Runtime type filter. `getRuntimeConfig('server')` = `['moai']`; `getRuntimeConfig('browser')` = `['todos','chat','sparks','logs','humans']`.

ServerRuntime: `_getAgentsAndDependenciesFromDb` filtered by `getRuntimeConfig('server')`; same watchInbox, ensureActorSpawned, getActorConfig.

---

### 1.7 Data Model


| CoValue              | Created by        | Permissions                            |
| -------------------- | ----------------- | -------------------------------------- |
| account.capabilities | Human (migration) | Human admin; moai writer               |
| Capability CoMap     | Moai              | Moai creates; human reader             |
| moai inbox           | Moai (seed)       | Moai admin; each human writer          |
| API message          | Human             | Created in moai inbox by human session |


**Schemas:**

- °Maia/schema/capability: { cmd, exp, accountId }
- °Maia/schema/account/capabilities-stream: CoStream of Capability refs

---

### 1.8 Executor Validation (UCAN)

Moai must validate:

1. **Capability validity** — Signed, not expired, cmd matches, accountId in registry
2. **Invoker binding** — Message creator session→account; only writers can push

---

## Part 2: Component Inventory

### 2.1 New Components


| Component                                | Location              | Role                           |
| ---------------------------------------- | --------------------- | ------------------------------ |
| °Maia/schema/capability                  | maia-schemata         | Capability CoMap schema        |
| °Maia/schema/account/capabilities-stream | maia-schemata         | Capabilities CoStream schema   |
| °Maia/agent/moai                         | maia-agents           | Moai agent manifest            |
| °Maia/moai/actor/intent                  | maia-agents           | Moai intent actor (headless)   |
| MoaiAgentRegistry                        | maia-agents           | Registers moai agent           |
| °Maia/actor/services/moai                | maia-actors           | Service actor — verify+RedPill |
| ServerRuntime                            | maia-engines/runtimes | Moai agent executor            |
| ensureAccountCapabilities                | maia-db migrations    | Creates capabilities stream    |


### 2.2 Modified Components


| File                                   | Change                                            |
| -------------------------------------- | ------------------------------------------------- |
| services/moai/src/index.js             | handleSyncRegistry, handleRegister, ServerRuntime |
| libs/maia-actors/src/os/ai/function.js | deliverEvent instead of fetch                     |
| libs/maia-agents/src/seeding.js        | RUNTIME_CONFIGS.server, MoaiAgentRegistry         |


---

## Part 3: Human-Testable Milestones

Each milestone ends with **Human checkpoint**.

---

### M0: System Audit (BLOCKING)

**Goal:** Document current state. No code changes.

**Tasks:**

- Map files: moai index, handleLLMChat, handleRegister, syncRegistry; maia-actors os/ai; maia-db process-inbox; maia-loader boot
- **Creator→account:** Does cojson expose session→account? YES/NO + how
- **Moai account shape:** agentWorker.account structure; registries, sparks, agents?
- **Inbox/group:** Seed inbox creation; addMember at runtime?
- **Migration context:** Where migrations run; can they fetch syncRegistry?

**Deliverable:** Audit report (markdown).

**Human checkpoint:** Read audit; agree before M1.

---

### M1: Schemas + Moai Agent (Manifest + Intent + Service)

**Goal:** Add schemas, moai agent with manifest and intent actor, moai service actor to seed.

**Tasks:**

- Add °Maia/schema/capability, °Maia/schema/account/capabilities-stream
- Add °Maia/agent/moai manifest: actor=°Maia/moai/actor/intent, dependencies=[°Maia/moai/actor/intent, °Maia/actor/services/moai]
- Add °Maia/moai/actor/intent (actor, process, interface, inbox) — headless intent; process forwards LLM_CHAT to service
- Add MoaiAgentRegistry (like TodosAgentRegistry); RUNTIME_CONFIGS.server = ['moai']
- Add °Maia/actor/services/moai (actor, process, interface, inbox) to seed
- Add moai agent + intent to seed

**Human checkpoint:** `PEER_FRESH_SEED=true`, boot maia. DB has schemas, moai agent, moai intent actor, moai service actor, inboxes. No errors.

---

### M2: syncRegistry — peerAgentId, moaiIntentActorCoId

**Goal:** syncRegistry returns fields clients need.

**Tasks:**

- handleSyncRegistry: add peerAgentId (= worker.account.id)
- handleSyncRegistry: add moaiIntentActorCoId (= resolve °Maia/agent/moai → agent.actor = °Maia/moai/actor/intent)

**Human checkpoint:** `GET /syncRegistry` returns peerAgentId, moaiIntentActorCoId.

---

### M3: ensureAccountCapabilities Migration

**Goal:** Human accounts get capabilities stream.

**Tasks:**

- Migration: if account.registries and !account.capabilities → create stream, addMember(peerAgentId,'writer'), account.set('capabilities', streamId)
- Boot order: linkAccountToRegistries → ensureAccountCapabilities → autoRegisterHuman

**Human checkpoint:** Sign in; account.capabilities exists.

---

### M4: handleRegister — Capability + Inbox Writer

**Goal:** Register grants capability and inbox write.

**Tasks:**

- Load account.capabilities; create Capability CoMap; append to stream
- Add human account as writer to °Maia/moai/actor/intent inbox group (entry point for inter-agent messages)

**Human checkpoint:** Register human; capability in stream; human is writer on moai intent inbox.

---

### M5: ServerRuntime + Moai Agent Executor

**Goal:** Moai runs moai agent via ServerRuntime.

**Tasks:**

- Create ServerRuntime in maia-engines/src/runtimes/server.js
- Implement: getActorConfig, watchInbox, ensureActorSpawned, notifyInboxPush, _getAgentsAndDependenciesFromDb (filter by getRuntimeConfig('server'))
- Wire moai: ActorEngine, ProcessEngine, InboxEngine, ServerRuntime; runtime.start() after agentWorker
- Ensure moai account has registries→sparks→agents with moai

**Human checkpoint:** Moai starts; push LLM_CHAT to moai intent; moai logs processEvents (intent → service). (RedPill can be stubbed.)

---

### M6: Moai executableFunction — Verify + RedPill

**Goal:** Moai actor verifies capability, proxies to RedPill.

**Tasks:**

- executableFunction: creator→account, load account.capabilities, verify /llm/chat, RedPill proxy, deliverEvent(replyTo, SUCCESS|ERROR)
- Register in getActor (maia-actors)

**Human checkpoint:** deliverEvent(moaiIntentActorCoId, 'LLM_CHAT', { messages, replyTo }). SUCCESS in replyTo. Unregistered → ERROR.

---

### M7: Client — deliverEvent via agent.actor

**Goal:** @ai/chat uses inbox, not HTTP.

**Tasks:**

- executableFunction: deliverEvent(moaiIntentActorCoId, 'LLM_CHAT', { messages, model, replyTo: actor.id })
- Process waits for SUCCESS/ERROR (ask protocol)
- moaiIntentActorCoId from syncRegistry (at boot) — agent.actor for °Maia/agent/moai

**Human checkpoint:** Chat works. Network: no fetch to /api/v0/llm/chat.

---

### M8: Remove HTTP LLM + Documentation

**Goal:** Clean removal, docs updated.

**Tasks:**

- Remove POST /api/v0/llm/chat, handleLLMChat
- Update developer docs (capability flow, moai agent, inter-agent messaging, UCAN)
- UCAN alignment checklist

**Human checkpoint:** Full manual pass. Docs accurate.

---

## Part 4: File Structure

```
libs/maia-schemata/src/              # °Maia/schema/capability, capabilities-stream
libs/maia-agents/src/moai/           # MoaiAgentRegistry, manifest.agent.maia, intent/ (actor, process, interface)
libs/maia-agents/src/seeding.js      # RUNTIME_CONFIGS.server, MoaiAgentRegistry
libs/maia-actors/src/services/moai/  # °Maia/actor/services/moai (actor, process, interface, function.js)
libs/maia-actors/src/seed-config.js  # Add moai agent + intent + service actor to getSeedConfig
libs/maia-engines/src/runtimes/      # server.js (ServerRuntime)
libs/maia-db/src/migrations/        # ensureAccountCapabilities
services/moai/src/index.js           # handleSyncRegistry, handleRegister, ServerRuntime
libs/maia-actors/src/os/ai/          # deliverEvent instead of fetch
libs/maia-docs/developers/           # Capability auth, moai agent, UCAN
```

---

## Part 5b: UCAN Spec Alignment Audit

Cross-check against [UCAN Specification](https://ucan.xyz/specification/), [Delegation](https://ucan.xyz/delegation/), [Invocation](https://ucan.xyz/invocation/), [Revocation](https://ucan.xyz/revocation/), [Promise](https://ucan.xyz/promise/).

### Alignments (Solid)


| UCAN concept            | Our implementation                                   | Spec reference                                                                        |
| ----------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Executor validation** | Moai verifies capability + invoker at execution time | Spec: "Executor MUST verify ownership... Executor be the resource itself RECOMMENDED" |
| **Subject (sub)**       | accountId in Capability CoMap                        | Delegation: sub = principal                                                           |
| **Command (cmd)**       | cmd: "/llm/chat"                                     | Delegation/Invocation: cmd required                                                   |
| **Expiry (exp)**        | exp in Capability                                    | Delegation: exp required, time bounds                                                 |
| **Invoker binding**     | creator session→account; only writers push           | Invocation: iss = Invoker; we use provenance instead of signed token                  |
| **Revocation**          | Remove human from inbox writers; capabilities expire | Revocation: immutable; we revoke at "can invoke" level                                |
| **Principal**           | co-id (cojson-native)                                | Spec: "Principal identified by DID"; we adapt for cojson                              |
| **Capability model**    | subject × command × policy (policy minimal)          | Spec: capability = association of ability to subject                                  |
| **Replay prevention**   | CoValue co-id unique; processInbox marks processed   | Invocation: "Every UCAN token MUST hash to unique CID"; we use message co-id          |
| **Nonce**               | CoValue co-id + CoStream tx = uniqueness             | Delegation: nonce required; we use implicit via cojson                                |


### Intentional Adaptations (Cojson-Native)


| UCAN format                           | Our adaptation                                 | Rationale                                                    |
| ------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| DID principal                         | co-id                                          | Cojson uses co-ids; no DID resolution in stack               |
| UCAN Delegation token (iss, aud, prf) | Capability CoMap in account.capabilities       | Stored in CRDT; moai creates, human reads                    |
| UCAN Invocation token                 | Inbox message (type, payload, source, replyTo) | Inbox transport; proof = writer membership + creator         |
| Proof chain (prf)                     | Ambient: account.capabilities + registry       | Executor pulls validation; not invoker-push                  |
| Invocation exp                        | Not per-message                                | Capability exp covers scope; short-lived requests acceptable |


### Recommendations (Optional Hardening)



1. **Invocation idempotency (medium):** If duplicate messages possible, use message co-id as idempotency key (processInbox already tracks processed). Document in M6.
2. **Policy (pol) for future:** UCAN Delegation has pol. Our Capability has no pol. For /llm/chat, empty policy fine. Future: add `pol: []` or extend schema.

### Verdict

**Plan is solid.** Core UCAN semantics (delegation, invocation roles, executor validation, time bounds, revocation) are preserved. Adaptations are documented and cojson-native. No blocking changes required.

---

## Part 5: Risks & Mitigation


| Risk                           | Mitigation                                                   |
| ------------------------------ | ------------------------------------------------------------ |
| Creator→account not resolvable | Audit first; fallback: signed payload or per-account streams |
| Moai inbox subscription        | Audit cojson patterns; use subscription or poll              |
| Async UX (inbox vs fetch)      | ask protocol; ensure SUCCESS/ERROR flow smooth               |
| Capability revocation          | Remove from moai inbox writers; exp on capabilities          |


---

## Part 6: Spec Sources

- [UCAN Specification](https://ucan.xyz/specification/) — main concepts, roles, lifecycle
- [UCAN Delegation](https://ucan.xyz/delegation/) — capability format, sub, cmd, pol, nonce
- [UCAN Invocation](https://ucan.xyz/invocation/) — iss, sub, aud, proofs, replay
- [UCAN Revocation](https://ucan.xyz/revocation/) — immutable revocation
- [UCAN Promise](https://ucan.xyz/promise/) — async pipelining (not used yet)
- [Jazz Inbox API](https://jazz.tools/docs/react/server-side/communicating-with-workers/inbox)

