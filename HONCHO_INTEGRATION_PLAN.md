---
name: Honcho Memory Integration for Maia Agent
overview: Integrate Honcho as a memory tool for Maia Agent to learn alongside coding sessions
todos:
  - id: milestone-0
    content: Capture Current State & System Audit
    status: completed
  - id: milestone-1
    content: Create Honcho Memory Module & Tool Infrastructure
    status: pending
  - id: milestone-2
    content: Integrate RedPill LLM with OpenAI-compatible API
    status: pending
  - id: milestone-3
    content: Build Maia Agent with Memory Integration
    status: pending
  - id: milestone-4
    content: Create Honcho Self-Hosted Service Setup (fly.io)
    status: pending
  - id: milestone-5
    content: Documentation & Final Review
    status: pending
---

# Honcho Memory Integration for Maia Agent

## Problem Statement

**Goal**: Build Maia Agent - a CTO-level AI assistant that understands the entire MaiaOS codebase, architecture, and all packages. Maia should learn alongside coding sessions, tracking code changes, migrations, optimizations, and architectural decisions over time.

**Current State**: 
- MaiaOS has basic agent infrastructure (actors, state machines, tools)
- No persistent memory system for agents
- No LLM integration for conversational agents
- Tools exist but no memory/learning capabilities

**Problem**: We need a memory system that:
- Persists agent knowledge across sessions
- Learns from code changes and conversations
- Provides context-aware responses based on accumulated knowledge
- Integrates seamlessly with MaiaOS architecture

## Success Criteria

- **Desirable**: Maia Agent can remember past conversations, code changes, and architectural decisions
- **Feasible**: Honcho self-hosted on fly.io, RedPill LLM integration, memory tool in MaiaOS
- **Viable**: Maintainable, scalable, follows MaiaOS patterns (state machines, tools, modules)

## Solution Approach

**Architecture**:
1. **Honcho as Memory Backend**: Self-hosted Honcho service on fly.io for persistent memory
2. **Memory Tool**: Create `@memory/*` tool in MaiaOS to interact with Honcho
3. **RedPill LLM**: Use RedPill's OpenAI-compatible API for LLM calls
4. **Maia Agent**: Single master agent/peer "Maia" that learns alongside Samuel (user)

**Key Design Decisions**:
- Honcho as a tool (not replacement for CoValues) - CoValues handle app state, Honcho handles agent memory
- Self-hosted Honcho for privacy/control
- RedPill LLM via OpenAI-compatible API (simple integration)
- One peer "Maia" + one peer "Samuel" in Honcho workspace
- Sessions represent coding sessions/conversations

# Honcho Memory Integration for Maia Agent

## Problem Statement

**Goal**: Build Maia Agent - a CTO-level AI assistant that understands the entire MaiaOS codebase, architecture, and all packages. Maia should learn alongside coding sessions, tracking code changes, migrations, optimizations, and architectural decisions over time.

**Current State**: 
- MaiaOS has basic agent infrastructure (actors, state machines, tools)
- No persistent memory system for agents
- No LLM integration for conversational agents
- Tools exist but no memory/learning capabilities

**Problem**: We need a memory system that:
- Persists agent knowledge across sessions
- Learns from code changes and conversations
- Provides context-aware responses based on accumulated knowledge
- Integrates seamlessly with MaiaOS architecture

## Success Criteria

- **Desirable**: Maia Agent can remember past conversations, code changes, and architectural decisions
- **Feasible**: Honcho self-hosted on fly.io, RedPill LLM integration, memory tool in MaiaOS
- **Viable**: Maintainable, scalable, follows MaiaOS patterns (state machines, tools, modules)

## Solution Approach

**Architecture**:
1. **Honcho as Memory Backend**: Self-hosted Honcho service on fly.io for persistent memory
2. **Memory Tool**: Create `@memory/*` tool in MaiaOS to interact with Honcho
3. **RedPill LLM**: Use RedPill's OpenAI-compatible API for LLM calls
4. **Maia Agent**: Single master agent/peer "Maia" that learns alongside Samuel (user)

**Key Design Decisions**:
- Honcho as a tool (not replacement for CoValues) - CoValues handle app state, Honcho handles agent memory
- Self-hosted Honcho for privacy/control
- RedPill LLM via OpenAI-compatible API (simple integration)
- One peer "Maia" + one peer "Samuel" in Honcho workspace
- Sessions represent coding sessions/conversations

## Implementation Milestones

### Milestone 0: Capture Current State & System Audit ✅

**Completed Audit Findings:**

**Current Architecture:**
- **Tools System**: Tools registered via modules (`core.module.js`, `db.module.js`)
- **Tool Structure**: Each tool has `.tool.maia` (definition) + `.tool.js` (implementation)
- **Module System**: Modules loaded at boot via `MaiaOS.boot({ modules: [...] })`
- **State Machines**: All tool calls flow through state machines
- **Tool Execution**: `ToolEngine.execute()` → tool function → returns result → state machine updates context

**Relevant Files:**
- `libs/maia-tools/` - Tool definitions and implementations
- `libs/maia-script/src/modules/` - Module registration system
- `libs/maia-script/src/engines/tool.engine.js` - Tool execution engine
- `libs/maia-vibes/src/todos/agent/` - Current agent implementation (basic todo example)

**Dependencies:**
- Internal: `@MaiaOS/tools`, `@MaiaOS/schemata`, `@MaiaOS/kernel`
- External: None for memory/LLM yet

**Integration Points:**
- Module registration: `libs/maia-script/src/modules/registry.js`
- Tool execution: `libs/maia-script/src/engines/tool.engine.js`
- Boot process: `libs/maia-kernel/src/kernel.js`

**Current Patterns:**
- Tools return results, don't mutate context directly
- State machines handle context updates via `updateContext` action
- Modules register tools with namespace (e.g., `@core/noop`, `@db`)
- Tools accessed via `tool:` action in state machine entry/exit

**Baseline Understanding**: ✅ Complete

---

### Milestone 1: Create Honcho Memory Module & Tool Infrastructure

**Goal**: Create the memory module and tools to interact with Honcho API

**Implementation:**
- [ ] Create `libs/maia-tools/src/memory/memory.tool.maia` - Tool definition
- [ ] Create `libs/maia-tools/src/memory/memory.tool.js` - Tool implementation
- [ ] Create `libs/maia-script/src/modules/memory.module.js` - Module registration
- [ ] Update `libs/maia-tools/src/index.js` to export memory tools
- [ ] Update `libs/maia-tools/package.json` exports for memory tools
- [ ] Install Honcho SDK or implement REST API client
- [ ] Create Honcho client wrapper for Bun/Node.js environment
- [ ] Implement workspace, peer, session, message operations

**Tool Functions Needed:**
- `@memory/createSession` - Create new Honcho session
- `@memory/addMessage` - Add message to session (user or agent)
- `@memory/getContext` - Get context/insights from Honcho
- `@memory/chat` - Chat with Honcho about peer (get insights)

**Default Behaviors** (if CoJSON backend write operations):
- N/A - Honcho handles its own persistence

**Cleanup & Migration:**
- N/A - New feature, no legacy code

**Manual Browser Debugging**:
- N/A - Backend tool, no UI yet

**Human Checkpoint:** ✋ Pause for manual testing of memory tool

---

### Milestone 2: Integrate RedPill LLM with OpenAI-compatible API

**Goal**: Create LLM integration tool using RedPill's OpenAI-compatible API

**Implementation:**
- [ ] Create `libs/maia-tools/src/llm/llm.tool.maia` - Tool definition
- [ ] Create `libs/maia-tools/src/llm/llm.tool.js` - Tool implementation
- [ ] Create `libs/maia-script/src/modules/llm.module.js` - Module registration
- [ ] Update `libs/maia-tools/src/index.js` to export LLM tools
- [ ] Implement RedPill API client using `RED_PILL_API_KEY` from `.env`
- [ ] Implement OpenAI-compatible fetch calls
- [ ] Support chat completions endpoint (`/v1/chat/completions`)
- [ ] Use model: `moonshotai/kimi-k2.5`
- [ ] Handle errors and retries

**Tool Functions Needed:**
- `@llm/chat` - Send messages to RedPill LLM, get responses
- `@llm/stream` - Stream responses (optional, for future)

**Environment Variables:**
- `RED_PILL_API_KEY` - Already in `.env`

**Default Behaviors** (if CoJSON backend write operations):
- N/A - LLM is stateless API calls

**Cleanup & Migration:**
- N/A - New feature

**Manual Browser Debugging:**
- N/A - Backend tool

**Human Checkpoint:** ✋ Test LLM integration with simple chat

---

### Milestone 3: Build Maia Agent with Memory Integration

**Goal**: Create Maia Agent that uses memory and LLM tools for conversations

**Implementation:**
- [ ] Create `libs/maia-vibes/src/maia-agent/maia.actor.maia` - Agent definition
- [ ] Create `libs/maia-vibes/src/maia-agent/maia.context.maia` - Agent context
- [ ] Create `libs/maia-vibes/src/maia-agent/maia.state.maia` - State machine
- [ ] Create `libs/maia-vibes/src/maia-agent/maia.view.maia` - Chat UI
- [ ] Create `libs/maia-vibes/src/maia-agent/manifest.vibe.maia` - Vibe manifest
- [ ] Implement state machine logic for conversation flow
- [ ] Handle user message events
- [ ] Call `@memory/getContext` to get relevant context from Honcho
- [ ] Call `@llm/chat` with context + user message
- [ ] Call `@memory/addMessage` to store user and agent messages
- [ ] Update context with conversation history
- [ ] Implement Honcho initialization (workspace, peers, sessions)
- [ ] Create chat UI with input field
- [ ] Display conversation history
- [ ] Show loading states during LLM calls
- [ ] Display Maia's responses

**State Machine Flow:**
```
idle → user sends message → loading
  ↓
getContext (from Honcho) → SUCCESS
  ↓
llm/chat (with context) → SUCCESS
  ↓
addMessage (store in Honcho) → SUCCESS
  ↓
updateContext (update UI) → idle
```

**Honcho Setup:**
- Workspace: "maiaos-dev" (or from env var)
- Peers: "maia" (agent), "samuel" (user)
- Session: Create per conversation thread (or reuse single session)

**Default Behaviors** (if CoJSON backend write operations):
- N/A - Agent uses memory tool, not direct CoValue writes

**Cleanup & Migration:**
- N/A - New feature

**Manual Browser Debugging** (if frontend feature):
- [ ] Open app in Cursor browser
- [ ] Check console for errors and verify real data
- [ ] Check network tab for failed requests
- [ ] Verify basic chat functionality works
- [ ] Test memory persistence (close/reopen, verify context)
- [ ] Verify Honcho API calls succeed
- [ ] Verify RedPill LLM calls succeed

**Human Checkpoint:** ✋ Test Maia Agent conversation flow

---

### Milestone 4: Create Honcho Self-Hosted Service Setup (fly.io)

**Goal**: Deploy Honcho server on fly.io for self-hosted memory

**Implementation:**
- [ ] Create `services/honcho/` directory
- [ ] Create `services/honcho/package.json` with Honcho dependencies
- [ ] Create `services/honcho/Dockerfile` for Honcho deployment
- [ ] Create `services/honcho/fly.toml` for Fly.io configuration
- [ ] Create `services/honcho/README.md` with deployment instructions
- [ ] Follow Honcho's self-hosting guide
- [ ] Configure PostgreSQL database (Fly.io Postgres)
- [ ] Set up environment variables in Fly.io secrets
- [ ] Configure LLM provider (RedPill via OpenAI-compatible API)
- [ ] Create fly.io app: `fly apps create maiaos-honcho`
- [ ] Deploy Honcho service: `fly deploy`
- [ ] Configure DNS/domain (optional)
- [ ] Set up secrets: `HONCHO_API_KEY`, `RED_PILL_API_KEY`, DB credentials
- [ ] Update memory tool to use `HONCHO_API_URL` environment variable
- [ ] Add `HONCHO_API_URL` to root `.env` file
- [ ] Add `HONCHO_API_KEY` to root `.env` file

**Environment Variables:**
- `HONCHO_API_URL` - Self-hosted Honcho URL (e.g., `https://maiaos-honcho.fly.dev`)
- `HONCHO_API_KEY` - API key for Honcho authentication
- `RED_PILL_API_KEY` - For Honcho's LLM provider config (already in `.env`)

**Default Behaviors** (if CoJSON backend write operations):
- N/A - Honcho handles its own persistence

**Cleanup & Migration:**
- N/A - New service

**Manual Browser Debugging:**
- N/A - Backend service (test via API calls)

**Human Checkpoint:** ✋ Verify Honcho service is accessible and working

---

### Milestone 5: Documentation & Final Review

**Goal**: Document the implementation and ensure everything works

**Implementation:**
- [ ] Manual browser debugging complete
- [ ] Open Maia Agent in browser
- [ ] Test conversation flow end-to-end
- [ ] Verify memory persistence (close/reopen, verify context retained)
- [ ] Check console for errors (0 errors expected)
- [ ] Verify network requests succeed (Honcho + RedPill)
- [ ] Test multiple conversation threads
- [ ] Verify context retrieval works correctly

**Documentation Updates:**
- [ ] Create `libs/maia-docs/developers/memory-tool.md` - Memory tool developer docs
- [ ] Create `libs/maia-docs/creators/maia-agent.md` - Maia Agent usage guide
- [ ] Update `services/honcho/README.md` - Honcho self-hosting guide
- [ ] Add examples and usage patterns
- [ ] Document environment variables
- [ ] Document tool parameters and usage

**Final Review:**
- [ ] Verify all tools work correctly (`@memory/*`, `@llm/*`)
- [ ] Verify memory persistence works (Honcho stores conversations)
- [ ] Verify LLM integration works (RedPill responds correctly)
- [ ] Verify Maia Agent can have conversations
- [ ] Verify context retrieval enhances responses
- [ ] No linter errors
- [ ] Code follows MaiaOS patterns
- [ ] Human approval ✋

**Skip these files:**
- ❌ `libs/maia-docs/agents/LLM_*.md` (auto-generated)

---

## File Structure

```
libs/
├── maia-tools/
│   └── src/
│       ├── memory/
│       │   ├── memory.tool.maia
│       │   └── memory.tool.js
│       ├── llm/
│       │   ├── llm.tool.maia
│       │   └── llm.tool.js
│       └── index.js (updated)
├── maia-script/
│   └── src/
│       └── modules/
│           ├── memory.module.js (new)
│           └── llm.module.js (new)
└── maia-vibes/
    └── src/
        └── maia-agent/ (new)
            ├── maia.actor.maia
            ├── maia.context.maia
            ├── maia.state.maia
            └── maia.view.maia

services/
└── honcho/ (new)
    ├── package.json
    ├── Dockerfile
    ├── fly.toml
    └── README.md
```

## Manual Testing Strategy

- **Manual Browser Debugging**: 
  - Test Maia Agent chat UI
  - Verify conversations persist
  - Check console for errors
  - Verify network requests to Honcho/RedPill succeed

- **Manual User Testing**: 
  - Have conversations with Maia
  - Test memory persistence (close/reopen)
  - Test context retrieval
  - Verify Maia remembers past conversations

## Risks & Mitigation

**Risk**: Honcho self-hosting complexity
- **Mitigation**: Start with managed service, migrate to self-hosted later if needed

**Risk**: RedPill API compatibility issues
- **Mitigation**: Test thoroughly, fallback to OpenAI if needed

**Risk**: Memory tool performance
- **Mitigation**: Use async operations, cache where appropriate

**Risk**: Integration complexity
- **Mitigation**: Follow existing MaiaOS patterns (tools, modules, state machines)

## Documentation Updates

- [ ] `libs/maia-docs/developers/memory-tool.md`
- [ ] `libs/maia-docs/creators/maia-agent.md`
- [ ] `services/honcho/README.md`
- [ ] ❌ Skip `libs/maia-docs/agents/LLM_*.md` (auto-generated)
