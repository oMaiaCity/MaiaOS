# Process Handlers (The Brain)

MaiaOS uses **GenServer-style event handlers**—flat, event-keyed actions. No states or transitions. When an event arrives, the matching handler runs its actions in order.

## A Simple Example: Creating a Todo

**What happens when you click "Add Todo":**

```
User clicks "Add Todo" button
  ↓
Event CREATE_TODO delivered to actor inbox
  ↓
ProcessEngine processes inbox
  ↓
Handler for CREATE_TODO runs:
  1. op.create → DataEngine creates todo in database
  2. tell → Sends SUCCESS to the actor that triggered the action
  ↓
Context updates (reactive queries refetch)
  ↓
View re-renders with new todo
```

**CRITICAL ARCHITECTURE:**
- **Process handlers define behavior** — All logic, data ops, and inter-actor messaging
- **Context is the realtime reactive snapshot** — Current reflection, automatically updated
- **Views are "dumb"** — Pure declarative structure, zero logic, just render context

## Process Handler Responsibility: Single Source of Truth

**Your process handlers are responsible for:**
- ✅ All context updates (via `ctx` action)
- ✅ All data mutations (via `op` action — create, update, delete)
- ✅ All inter-actor messaging (via `tell` action)
- ✅ All error handling (via ERROR event handlers)

**Process handlers update context by:**
1. Receiving events from inbox (unified event flow)
2. Using `ctx` action to update context CoValue
3. Using `tell` to send SUCCESS/ERROR to the actor that triggered the action

## Separation of Concerns: Context vs Process Handlers

**CRITICAL PRINCIPLE:** Clean separation between **data storage** (context) and **logic/computation** (process handlers).

### Context = Pure Data Storage

**Context files (`*.context.maia`) should contain:**
- ✅ Simple values (strings, numbers, booleans)
- ✅ Simple references (`@actor/list`, `@view/kanban`)
- ✅ Query objects (reactive data from database)
- ✅ Default/initial values
- ❌ **NO complex MaiaScript expressions** (`$if`, `$eq`, nested logic)
- ❌ **NO computation or conditional logic**

### Process Handlers = All Logic & Computation

**Process handlers (`*.process.maia`) handle:**
- ✅ All conditional logic (via `guard` action)
- ✅ All value computation in `ctx` updates
- ✅ All data operations via `op`
- ✅ All inter-actor communication via `tell`

## Inbox as Single Source of Truth for Events

**CRITICAL PRINCIPLE:** Actor inbox is the **single source of truth** for ALL events.

**Event Flow Pattern:**
```
User clicks button
  ↓
View sends event → deliverEvent()
  ↓
Event added to inbox
  ↓
processMessages() processes inbox
  ↓
ProcessEngine.send() receives event
  ↓
Handler runs actions (op, ctx, tell)
  ↓
On op failure → deliverEvent(ERROR) to source actor
  ↓
On op success → tell(SUCCESS) to source actor
```

**Why this matters:**
- **Unified Event Log:** All events appear in inbox for complete traceability
- **Consistent Pattern:** Single source of truth for all events
- **AI-Friendly:** LLMs can understand complete event flow

**Anti-Patterns:**
- ❌ Calling ProcessEngine.send() directly (bypasses inbox)
- ❌ Bypassing inbox for any events

## Deterministic Processing: Sequential

**CRITICAL PRINCIPLE:** Events are processed **one at a time** (sequential, not parallel).

**What this means:**
- ✅ Events queue in inbox and process sequentially
- ✅ One handler completes before the next event is processed
- ✅ Engines handle this generically—you don't need to manage it in your configs

**Unhandled Events:**
- Events with no matching handler are **processed and removed** (marked `processed: true`)
- They are **not rejected** — just removed from queue
