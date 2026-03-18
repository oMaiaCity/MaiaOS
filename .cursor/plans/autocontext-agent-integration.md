---
name: AutoContext Agent Integration
overview: Integrate autocontext's recursive self-improvement loop into MaiaOS so Cursor agents learn the codebase and improve with every task.
todos:
  - id: milestone-0
    content: "Capture Current State & System Audit"
    status: done
  - id: milestone-1
    content: "Context Layer — persistent playbooks, hints, progress snapshots"
    status: pending
  - id: milestone-2
    content: "Observation Loop — task extraction and outcome evaluation"
    status: pending
  - id: milestone-3
    content: "Learning Loop — pattern distillation and context evolution"
    status: pending
  - id: milestone-4
    content: "Agent Harness — harness-aware Cursor rules + MCP server"
    status: pending
  - id: milestone-final
    content: "Documentation & Review"
    status: pending
---

# AutoContext Agent Integration for MaiaOS

## How AutoContext Works (Explain Like I'm 12)

Imagine you hire a new helper every day, but every morning they forget everything they learned yesterday. That is what happens when you open a new Cursor chat — the AI starts from scratch.

**AutoContext fixes this.** It works like a notebook the helper keeps between shifts:

1. **Do the task.** The helper (AI agent) gets a task — fix a bug, add a feature.
2. **Write down what happened.** After finishing, a "coach" reviews what went well, what went badly, and what tricks worked.
3. **Update the notebook.** The best tricks get written into a **playbook** — a cheat-sheet of rules, patterns, and warnings specific to *this* codebase.
4. **Next shift, read the notebook first.** The new helper reads the playbook before starting, so they already know: "Don't touch file X without updating Y", "Always run `bun run check:ci` before committing", "The schema index goes in `account.os[schemaCoId]` FIRST".
5. **Repeat.** Every task makes the notebook better. Over time, the helpers act like seasoned engineers who know the project inside-out.

The technical name for this is a **closed-loop control plane**: execute → evaluate → learn → update → execute again, better.

AutoContext adds extra tricks:
- **Hints** — small nudges injected into prompts ("prefer CoMap over plain objects").
- **Progress snapshots** — save where a multi-step task left off so a new agent can resume.
- **Harness synthesis** — auto-generate the exact rules/constraints a model needs for a task type.
- **Staged validation** — check the agent's plan before it executes, catching mistakes early.
- **Frontier-to-local distillation** — once a pattern is validated by a big model (Claude, GPT-4), encode it so a smaller/cheaper model can replicate it.

---

## Problem Statement

**Fundamental problem:** Every Cursor Cloud Agent session starts with zero project-specific learned knowledge. Our `.cursor/rules` and `AGENTS.md` are static — hand-written once, manually maintained. They do not capture what agents *discover* while working: patterns that succeed, mistakes that recur, codebase-specific constraints, or the evolving architecture.

**How might we** build a self-improving agent context system so that each Cursor task makes the next one faster, more accurate, and more aligned with MaiaOS conventions?

## Success Criteria

- **Desirable**: Agents that produce fewer bugs, follow conventions without being told, and complete tasks faster over time — observable quality improvement over 10+ tasks.
- **Feasible**: Integrates with Cursor's existing rules/AGENTS.md/skills system. Uses the TypeScript `autoctx` package (Node-native, no Python dependency in prod). Can run as MCP server alongside our sync service.
- **Viable**: Self-contained in `libs/maia-autocontext`. No changes to core app/sync logic. Persistent state in local files (git-tracked playbooks + gitignored ephemeral state). Minimal operational overhead.

---

## Milestone 0: Capture Current State & System Audit ✅

### Current Agent Infrastructure

| Component | Location | Purpose |
|---|---|---|
| Cursor Rules (7) | `.cursor/rules/*.mdc` | Static project rules (always-apply + on-demand) |
| AGENTS.md | `/AGENTS.md` | Cloud agent bootstrap instructions |
| Skills (2) | `.cursor/skills/` | Image prompting, storytelling SOPs |
| Agent credentials | `libs/maia-self/` | `bun agent:generate` → `.env` |
| Agent API | `services/sync/` | `/register`, `/extend-capability`, `/api/v0/llm/chat` |
| LLM docs | `libs/maia-docs/04_agents/` | Auto-generated `LLM_*.md` |

### What's Missing (autocontext fills these gaps)

| Gap | autocontext concept | What it gives us |
|---|---|---|
| No learning between sessions | **Playbooks** | Persistent, evolving rule-sets that grow with each task |
| No outcome tracking | **Observer / Reports** | Structured task records: success/fail/pending with reasons |
| No pattern extraction | **Learning loop** | Auto-distills recurring patterns from successful tasks |
| Static cursor rules | **Harness synthesis** | Auto-generates/updates `.cursor/rules` from learned patterns |
| No resumability | **Progress snapshots** | Multi-step tasks can be resumed by a new agent session |
| No validation pre-execution | **Staged validation** | Review agent plans before execution |
| Manual context management | **Hints** | Small, targeted prompt injections based on file/task type |

### Dependency Map

```
autocontext (new)
├── reads: .cursor/rules/, AGENTS.md, libs/maia-docs/
├── writes: .cursor/rules/ (harness synthesis), .cursor/skills/ (learned SOPs)
├── integrates: MCP server (cursor can call autoctx tools)
├── stores: libs/maia-autocontext/context/ (playbooks, hints, snapshots)
└── depends: autoctx (npm package), existing repo structure
```

---

## Milestone 1: Context Layer — Persistent Playbooks, Hints, Progress Snapshots

**Goal**: Establish the persistent storage layer that survives across agent sessions.

### File Structure

```
libs/maia-autocontext/
├── package.json                    # @MaiaOS/autocontext, depends on autoctx
├── src/
│   ├── index.js                    # Public API
│   ├── context-store.js            # Read/write playbooks, hints, snapshots
│   ├── playbook.js                 # Playbook schema + merge logic
│   ├── hint.js                     # Hint schema + injection logic
│   └── snapshot.js                 # Progress snapshot schema
├── context/                        # Persistent state (git-tracked)
│   ├── playbooks/
│   │   ├── codebase.md             # General codebase patterns
│   │   ├── frontend.md             # Frontend-specific patterns
│   │   ├── sync.md                 # Sync service patterns
│   │   ├── cojson.md               # CoJSON/data patterns
│   │   └── vibes.md                # Vibe development patterns
│   └── hints/
│       ├── schema-indexing.md      # "Always index in account.os[schemaCoId] FIRST"
│       ├── biome.md                # "Run bun run check:ci before committing"
│       └── migration.md            # "No backwards compat, 100% migration"
├── snapshots/                      # Ephemeral state (gitignored)
│   └── .gitkeep
└── reports/                        # Task outcome reports (git-tracked)
    └── .gitkeep
```

### Implementation

- [ ] Create `libs/maia-autocontext/package.json` with `autoctx` dependency
- [ ] Implement `context-store.js` — file-based read/write for playbooks (markdown), hints (markdown), snapshots (JSON)
- [ ] Implement `playbook.js` — merge new learnings into existing playbook sections without losing prior content (append-only with dedup)
- [ ] Implement `hint.js` — file-glob-matched hints that get injected when an agent touches matching files
- [ ] Implement `snapshot.js` — serialize/deserialize task progress for resumption
- [ ] Seed initial playbooks from existing `.cursor/rules` content (extract the implicit patterns already documented)
- [ ] Seed initial hints from `IMPORTANT.mdc` rules (no backwards compat, root cause, etc.)
- [ ] Add `@MaiaOS/autocontext` to root workspace list

**Cleanup:** No legacy to remove — greenfield.
**Checkpoint:** ✋ Verify context layer reads/writes correctly. Present playbook + hint format to human.

---

## Milestone 2: Observation Loop — Task Extraction and Outcome Evaluation

**Goal**: After each agent session, extract structured task records and evaluate outcomes.

### Architecture

```
Agent completes task
        │
        ▼
┌─────────────────┐
│  Observer        │  Extracts: task description, files touched,
│  (post-task)     │  commands run, errors encountered, final state
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Evaluator       │  Judges: success/partial/fail, quality signals,
│  (autoctx judge) │  convention adherence, patterns used
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Report Writer   │  Produces: structured report → context/reports/
└─────────────────┘
```

### Implementation

- [ ] Implement `observer.js` — parse git diff + commit messages + terminal output to extract task records
- [ ] Implement `evaluator.js` — use `autoctx` judge functionality to score task outcomes against success criteria
- [ ] Implement `report.js` — write structured reports (task, outcome, patterns observed, recommendations)
- [ ] Create cursor rule `autocontext-post-task.mdc` — instructs agents to call the observer after completing work (apply intelligently)
- [ ] Report format: markdown with frontmatter (date, task-id, outcome, files-touched, patterns-used)

**Checkpoint:** ✋ Run observer on last 5 commits, generate sample reports. Review accuracy with human.

---

## Milestone 3: Learning Loop — Pattern Distillation and Context Evolution

**Goal**: Extract recurring patterns from reports and evolve playbooks/hints automatically.

### Architecture

```
context/reports/*.md (accumulated)
        │
        ▼
┌─────────────────┐
│  Pattern Miner   │  Groups similar tasks, identifies recurring
│                  │  success/failure patterns, extracts rules
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Context Evolver │  Merges new patterns into playbooks,
│  (ACE approach)  │  creates new hints, prunes stale ones
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Rule Synthesizer│  Optionally updates .cursor/rules
│  (harness synth) │  with learned, validated patterns
└─────────────────┘
```

### Key Design: ACE (Agentic Context Engineering) Process

Following the research paper, we use three roles:

1. **Generator** — produces candidate rules/patterns from report data
2. **Reflector** — evaluates candidates against existing playbooks (prevents contradiction, duplication, context collapse)
3. **Curator** — merges validated patterns into playbooks, archives stale ones

This prevents the two failure modes:
- **Brevity bias** — compressing playbooks into useless generalities
- **Context collapse** — iterative rewriting eroding specific details

### Implementation

- [ ] Implement `pattern-miner.js` — semantic grouping of reports, frequency analysis, success-correlation
- [ ] Implement `context-evolver.js` — ACE three-step: generate candidates → reflect → curate into playbooks
- [ ] Implement `rule-synthesizer.js` — convert high-confidence playbook patterns into `.cursor/rules/*.mdc` files
- [ ] Add `bun run autocontext:learn` script — triggers the learning loop manually or via post-task hook
- [ ] Implement staleness detection — patterns not referenced in N tasks get archived, not deleted

**Checkpoint:** ✋ Run learning loop on accumulated reports. Review evolved playbooks. Verify no context collapse.

---

## Milestone 4: Agent Harness — Harness-Aware Cursor Rules + MCP Server

**Goal**: Make the autocontext system accessible to Cursor agents during their sessions.

### MCP Server

Expose autocontext tools via MCP so Cursor agents can query playbooks, record observations, and get hints mid-task.

```
libs/maia-autocontext/src/
├── mcp-server.js          # MCP server entry point
├── tools/
│   ├── get-playbook.js    # Retrieve relevant playbook sections
│   ├── get-hints.js       # Get hints for current files/task
│   ├── record-outcome.js  # Record task outcome observation
│   ├── get-snapshot.js    # Resume from progress snapshot
│   └── save-snapshot.js   # Save progress snapshot
```

### Cursor Rules Integration

```
.cursor/rules/
├── autocontext-harness.mdc     # Always-apply: injects playbook summary
├── autocontext-post-task.mdc   # Apply intelligently: observation recording
└── autocontext-hints.mdc       # Apply to files: file-specific hints
```

### AGENTS.md Update

Add autocontext section to AGENTS.md:
- How to query playbooks via MCP
- How to record observations after task completion
- How to resume from snapshots

### Implementation

- [ ] Implement MCP server using `autoctx` MCP capabilities or custom MCP server
- [ ] Create `autocontext-harness.mdc` — always-apply rule that injects top playbook insights
- [ ] Create `autocontext-post-task.mdc` — instructs agents to call observation tools after task
- [ ] Create `autocontext-hints.mdc` — file-glob hints for common patterns
- [ ] Update `AGENTS.md` with autocontext integration instructions
- [ ] Add `bun run autocontext:serve` script for MCP server
- [ ] Add MCP server config to `.cursor/mcp.json` (or equivalent)
- [ ] Wire into `bun dev` — autocontext MCP server starts alongside app + sync

**Checkpoint:** ✋ Start MCP server, verify Cursor can call tools. Test playbook retrieval mid-task.

---

## Milestone Final: Documentation & Review

- [ ] Update `libs/maia-docs/03_developers/` with autocontext architecture doc
- [ ] Update `libs/maia-docs/02_creators/` with "how agents learn" guide
- [ ] Verify `bun run check:ci` passes
- [ ] Run learning loop on 5+ real task reports to validate the full cycle
- [ ] ✋ Final human approval

---

## Solution Approach — Why This Architecture

### Why Not Just Better Static Rules?

Static rules hit a ceiling. They capture what we *already know*, not what agents *discover*. A team of 2 developers cannot anticipate every pattern a codebase needs. Autocontext turns every agent task into a learning opportunity — the rules write themselves.

### Why TypeScript (not Python)?

MaiaOS is a Bun/Node monorepo. The `autoctx` npm package gives us the judge/improvement-loop primitives without introducing Python into the stack. The MCP server runs as a Bun process alongside our existing services.

### Why File-Based Storage (not a database)?

- Playbooks and hints are **markdown** — human-readable, reviewable in PRs, diffable in git
- Git-tracked playbooks = version history of what the agent learned
- Snapshots are ephemeral (gitignored) — no permanent state pollution
- Reports accumulate and can be pruned periodically
- No new infrastructure (no Redis, no Postgres for this)

### Why MCP (not direct file reads)?

Cursor's MCP integration lets agents call tools *during* their session. An agent can ask "what does the playbook say about CoJSON migrations?" and get a focused answer, rather than reading the entire playbook file and burning context window.

### Distillation Path (Future)

Once we accumulate enough validated playbooks, we can:
1. Export as fine-tuning data (`autoctx export-training-data`)
2. Distill into a smaller model specialized for MaiaOS tasks
3. Route simple tasks to the distilled model, complex tasks to frontier

This is autocontext's "frontier-to-local distillation" — but it's a future milestone, not part of the initial integration.

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Playbooks grow too large for context window | Agent can't read full playbook | MCP tool returns only relevant sections (semantic search) |
| Context collapse over many learning iterations | Playbooks lose specific details | ACE approach with Reflector prevents erosion; git history as backup |
| Stale patterns persist | Agent follows outdated rules | Staleness detection archives unused patterns after N tasks |
| MCP server adds startup complexity | `bun dev` becomes fragile | Graceful degradation — agents work without MCP, just without learned context |
| Learning loop produces incorrect patterns | Bad patterns propagate | Human review of playbook changes in PRs; confidence thresholds for auto-application |
| autoctx npm package is alpha (v0.1.2) | Breaking changes possible | Pin version, wrap in our own abstraction layer in `@MaiaOS/autocontext` |

---

## Manual Testing Strategy

1. **Context layer**: Write a playbook, read it back, verify merge logic
2. **Observer**: Make a real code change, run observer, verify extracted task record accuracy
3. **Learning loop**: Feed 5+ reports, run learning loop, verify playbook evolution is sensible
4. **MCP server**: Start server, call tools from Cursor, verify responses
5. **End-to-end**: Complete a real task with autocontext active, verify the playbook updated with relevant learnings

---

## Documentation Updates

- [ ] `libs/maia-docs/03_developers/autocontext.md` — Architecture, how the learning loop works
- [ ] `libs/maia-docs/02_creators/agent-learning.md` — How agents improve over time (user-facing)
- [ ] Skip `libs/maia-docs/04_agents/LLM_*.md` — auto-generated, will pick up new docs
