---
name: Actor MVC Separation
overview: Refactor maia-actors and maia-agents for cleaner separation of concerns—Intent (orchestration) in agents; Service (logic) and View (UI) actors in maia-actors with MVC-like patterns, DRY, and single responsibility.
todos:
  - id: milestone-0
    content: Capture Current State & System Audit
    status: completed
  - id: milestone-1
    content: Rename library → services, create views/, migrate comingSoon to views
    status: pending
  - id: milestone-2
    content: Split and migrate chat/messages into service + view actors
    status: pending
  - id: milestone-3
    content: Split and migrate chat/paper into service + view actors
    status: pending
  - id: milestone-4
    content: Split and migrate creator/logs into service + view actors
    status: pending
  - id: milestone-5
    content: Split and migrate todos/list into service + view actors
    status: pending
  - id: milestone-6
    content: Split and migrate sparks/detail into service + view actors
    status: pending
  - id: milestone-7
    content: Refactor intent actors to pure orchestration, update all references
    status: pending
  - id: milestone-8
    content: Documentation & final review
    status: pending
isProject: false
---

# Actor MVC Separation — Architecture Refactor

## Problem Statement

We need a **cleaner separation of concerns** between actors for:

- **Reusability** — View components as design system primitives; services as shared logic
- **MVC-like patterns** — View (UI) vs Service (logic/data) vs Intent (orchestration)
- **Single responsibility & DRY** — No merged actors that mix UI and business logic
- **Distinct packages** — maia-actors holds reusable actors; maia-agents holds only orchestration (intent)

## Success Criteria

- **Desirable**: Developers can compose agents from reusable view + service actors; clear mental model
- **Feasible**: Compatible with current CoJSON, process engine, slot system, and seeding
- **Viable**: Maintainable; new agents = intent + composition of existing actors

## Current State Audit (Stage 0)

### maia-actors Structure (BEFORE)

```
libs/maia-actors/src/
├── os/                    # Tool actors (no view): ai, db, names, paper, spark
│   ├── ai/               # CHAT interface, process, function, tool
│   ├── db/                # DB_OP
│   ├── names/             # COMPUTE_NAMES
│   ├── paper/             # UPDATE_PAPER
│   └── spark/             # SPARK_OP
├── library/               # UI actor (HAS view)
│   └── comingSoon/        # Placeholder "Coming soon" — view + context + process (empty)
├── shared/
│   └── api-helpers.js
├── index.js
└── seed-config.js
```

### maia-agents Structure (BEFORE)


| Agent   | Intent Actor | Domain Actors   | Domain Actor Type                                              |
| ------- | ------------ | --------------- | -------------------------------------------------------------- |
| chat    | intent       | messages, paper | Both: view + process (messages: heavy logic; paper: view-only) |
| todos   | intent       | list            | Both: view + process (TOGGLE, DELETE, error handling)          |
| creator | intent       | logs            | Both: view + process (ERROR, RETRY, DISMISS)                   |
| sparks  | intent       | detail          | Both: view + process (LOAD_ACTOR, ADD_AGENT, REMOVE_MEMBER)    |
| humans  | intent       | (none)          | Intent only                                                    |


### Actor Classification (Current)


| Actor                          | Has View | Has Process                                | Classification                      |
| ------------------------------ | -------- | ------------------------------------------ | ----------------------------------- |
| os/ai, db, names, paper, spark | No       | Yes (+ tool)                               | **Service** (tool)                  |
| library/comingSoon             | Yes      | Yes (empty)                                | **View** (UI placeholder)           |
| chat/messages                  | Yes      | Yes (SEND_MESSAGE, ask AI, SUCCESS, ERROR) | **Mixed**                           |
| chat/paper                     | Yes      | Yes (empty)                                | **View** (mostly)                   |
| creator/logs                   | Yes      | Yes (ERROR, RETRY, DISMISS)                | **Mixed**                           |
| todos/list                     | Yes      | Yes (TOGGLE, DELETE, error)                | **Mixed**                           |
| sparks/detail                  | Yes      | Yes (LOAD_ACTOR, ADD_AGENT, REMOVE)        | **Mixed**                           |
| *intent* (all agents)          | Yes      | Yes (SWITCH_VIEW, SEND_MESSAGE, etc.)      | **Orchestration** (stays in agents) |


## Target Architecture

### maia-actors Structure (AFTER)

```
libs/maia-actors/src/
├── services/              # RENAMED from library; ALL non-UI actors
│   ├── os/                # Tool actors (unchanged location, same as now)
│   │   ├── ai/
│   │   ├── db/
│   │   ├── names/
│   │   ├── paper/
│   │   └── spark/
│   └── comingSoon/        # MOVED to views (it has UI)
├── views/                 # NEW: Design system UI components
│   ├── comingSoon/        # Moved from library (placeholder)
│   ├── messageList/       # Extracted from chat/messages (displays conversation)
│   ├── paper/             # Extracted from chat/paper (displays notes)
│   ├── logViewer/         # Extracted from creator/logs (displays log entries)
│   ├── todoList/          # Extracted from todos/list (displays todo items)
│   └── sparkDetail/       # Extracted from sparks/detail (displays spark + members)
├── shared/
├── index.js
└── seed-config.js
```

**Wait** — The user said "library should be renamed to services, they are all non UI actors." But comingSoon IS a UI actor. So:

- **Option A**: library → services, and comingSoon moves to views/ (it's the only UI actor in library)
- **Option B**: Keep comingSoon in services if we consider it a "service" that renders a simple message (semantic stretch)

**Recommendation**: Option A. `library/` → `services/`, and `comingSoon` → `views/comingSoon` because it's a pure UI placeholder (design system component).

### maia-agents Structure (AFTER)

```
libs/maia-agents/src/
├── chat/
│   ├── intent/            # Orchestration only; composes messages-service + messages-view, paper-view
│   └── manifest.agent.maia
├── todos/
│   ├── intent/            # Orchestration only; composes list-service + list-view, comingSoon
│   └── manifest.agent.maia
├── creator/
│   ├── intent/            # Orchestration only; composes logs-service + logViewer, comingSoon
│   └── manifest.agent.maia
├── sparks/
│   ├── intent/            # Orchestration only; composes detail-service + sparkDetail
│   └── manifest.agent.maia
├── humans/
│   └── intent/
├── shared/
│   └── brand.style.maia
└── seeding.js
```

### Actor Roles (AFTER)


| Role        | Location             | Has View | Has Process     | Responsibility                                            |
| ----------- | -------------------- | -------- | --------------- | --------------------------------------------------------- |
| **Intent**  | maia-agents          | Yes      | Yes             | Orchestration: route events, compose slots, tell services |
| **Service** | maia-actors/services | No       | Yes             | Logic: data ops, ask tools, business rules                |
| **View**    | maia-actors/views    | Yes      | No (or minimal) | Presentation: display data from context queries           |


### Data Flow Pattern

- **Intent** holds `@actors: { serviceRef, viewRef }` in context.
- Intent view uses `$slot $currentView` (or similar) to render the **view actor**.
- Intent process `tell`s the **service actor** for mutations.
- **View actor** context has queries (e.g. `conversations`, `notes`) — reads from CoJSON.
- **Service actor** process performs `op: create/update/delete` and `ask` — writes to CoJSON / calls tools.

## Solution Approach

1. **Rename** `maia-actors/src/library` → `maia-actors/src/services` (and move `os/` under services for consistency, or keep `os/` at top level with services/—see file structure below).
  **Clarification**: The user said "library should be renamed to services." Currently:
  - `os/` = tool actors (ai, db, names, paper, spark)
  - `library/` = comingSoon only
   If we rename library → services, we'd have:
  - `services/comingSoon` (but comingSoon has a view, so it doesn't fit "non-UI")
  - Better: `library` → `services` as the folder for "non-UI library actors", and we MOVE comingSoon to `views/`. So `services/` ends up empty until we add other non-UI actors. Or we keep `os/` as the main "services" and have `services/` be an alias. Simpler: just rename `library/` → `services/` and move comingSoon to `views/`. Then `services/` is empty for now (or we put future non-UI actors there). The `os/` actors are already "services" (no view).
2. **Create** `maia-actors/src/views/` and migrate `comingSoon` there.
3. **Split** each mixed actor (messages, paper, logs, list, detail) into:
  - **Service actor**: process + context (queries), no view
  - **View actor**: view + context (same queries for read-only display), no/minimal process
4. **Update** intent actors to reference `°Maia/actor/services/...` and `°Maia/actor/views/...` (or keep existing $ids for backward compatibility during migration).
5. **Update** seed-config, registries, manifests, and all `tell`/`ask`/`$slot` references.

## Implementation Milestones

### Milestone 0: Capture Current State ✅

- Audit maia-actors and maia-agents structure
- Map actor types and dependencies
- Document current patterns

### Milestone 1: Rename library → services, Create views/, Migrate comingSoon

**Tasks:**

- Rename `libs/maia-actors/src/library` → `libs/maia-actors/src/services`
- Create `libs/maia-actors/src/views/`
- Move `services/comingSoon` → `views/comingSoon`
- Update seed-config.js imports and ROLE_TO_FOLDER
- Update all references to `°Maia/actor/coming-soon` (path may stay same; $id can remain)
- Update maia-actors index.js, getActor, resolveServiceActorCoId if needed
- Run check:ci, verify seeding

**Human Checkpoint:** ✋ Verify comingSoon still works in todos and creator

### Milestone 2: Split chat/messages into service + view

**Current**: messages has process (SEND_MESSAGE, ask AI, SUCCESS, ERROR) + view (conversation list).

**Split:**

- **messages-service** (`maia-actors/services/chat/messages` or `maia-actors/services/messages`):
  - context: conversations query, phase, isLoading, hasError, error
  - process: SEND_MESSAGE, SUCCESS, ERROR, RETRY, DISMISS
  - inbox, no view
- **messages-view** (`maia-actors/views/messageList`):
  - context: conversations query (read-only)
  - view: displays conversation list
  - no process (or minimal)

**Intent** composes: slots messageList view, tells messages-service on SEND_MESSAGE. Intent view holds input + thinking; slots messageList for the conversation area.

**Tasks:**

- Create messages-service actor
- Create messageList view actor
- Update chat intent to reference both
- Migrate chat registry
- Update manifests and dependencies

**Human Checkpoint:** ✋ Verify chat flow works (send, thinking, response)

### Milestone 3: Split chat/paper

**Current**: paper has view + empty process. Context: notes query.

**Split:**

- **paper-service**: Minimal (notes query for writes if ever needed; currently paper is display-only)
- **paper-view**: View + notes query. Primary component.

**Tasks:**

- Create paper-view (or keep paper as view-only in views/)
- Paper may not need a separate service if it's read-only
- Update chat intent to slot paper-view

**Human Checkpoint:** ✋ Verify paper displays notes

### Milestone 4: Split creator/logs

**Current**: logs has view (log entries) + process (ERROR, RETRY, DISMISS).

**Split:**

- **logs-service**: process (ERROR, RETRY, DISMISS) + context (messages query for any logic)
- **logViewer-view**: view + context (messages query for display)

**Tasks:**

- Create logs-service
- Create logViewer view
- Update creator intent

**Human Checkpoint:** ✋ Verify logs display and error handling

### Milestone 5: Split todos/list

**Current**: list has view (todo items) + process (TOGGLE, DELETE, ERROR, RETRY, DISMISS).

**Split:**

- **list-service**: process (TOGGLE, DELETE, error handlers)
- **todoList-view**: view + context (todos query)

**Tasks:**

- Create list-service
- Create todoList view
- Update todos intent

**Human Checkpoint:** ✋ Verify todo CRUD and display

### Milestone 6: Split sparks/detail

**Current**: detail has view + process (LOAD_ACTOR, ADD_AGENT, REMOVE_MEMBER, etc.).

**Split:**

- **detail-service**: process (LOAD_ACTOR, ADD_AGENT, REMOVE_MEMBER, SUCCESS, ERROR)
- **sparkDetail-view**: view + context (sparkId, members, etc.)

**Tasks:**

- Create detail-service
- Create sparkDetail view
- Update sparks intent

**Human Checkpoint:** ✋ Verify spark detail, add/remove agent

### Milestone 7: Refactor Intent Actors to Pure Orchestration

**Tasks:**

- Ensure intent actors only: route events, compose slots, tell/ask services
- Remove any business logic from intents (move to services)
- Update all registries to only register intent + references to maia-actors
- Consolidate shared context/process patterns (DRY)

**Human Checkpoint:** ✋ Full regression: all agents work

### Milestone 8: Documentation & Final Review

- Update libs/maia-actors/README.md
- Update libs/maia-docs for new structure
- Run check:ci, build, manual testing

## File Structure (Target)

```
libs/maia-actors/src/
├── services/                 # Non-UI actors
│   ├── os/                   # Tool actors (ai, db, names, paper, spark)
│   ├── chat/
│   │   └── messages/         # messages-service
│   ├── creator/
│   │   └── logs/             # logs-service
│   ├── todos/
│   │   └── list/             # list-service
│   └── sparks/
│       └── detail/           # detail-service
├── views/                    # UI design system components
│   ├── comingSoon/
│   ├── messageList/
│   ├── paper/
│   ├── logViewer/
│   ├── todoList/
│   └── sparkDetail/
├── shared/
├── index.js
└── seed-config.js
```

## Risks & Mitigation


| Risk                                  | Mitigation                                                              |
| ------------------------------------- | ----------------------------------------------------------------------- |
| Large refactor breaks many references | Incremental milestones; each milestone is testable                      |
| Schema $id changes break CoJSON/sync  | Keep $ids stable where possible; migration script if needed             |
| Slot composition becomes complex      | Document slot patterns; intent clearly owns composition                 |
| View actors need shared queries       | Both view and service can declare same query; CoJSON is source of truth |


## Open Questions

1. **$id stability**: Should we keep `°Maia/chat/actor/messages` or switch to `°Maia/actor/services/messages`? Changing $ids may require DB migration.
2. **os/ location**: Keep `os/` at `maia-actors/src/os/` or move under `services/os/`?
3. **Context duplication**: View and service both need conversations query—share one context file or duplicate? (Recommendation: shared context module if same schema.)

---

**Next Step**: Human review of this plan. Confirm approach and $id strategy before starting Milestone 1.