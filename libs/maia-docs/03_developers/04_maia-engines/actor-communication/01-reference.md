                ]
              }
            ]
          },
          "then": true,
          "else": false
        }
      }
    }
  }
}
```

**What happens**:
1. Sets `spark: "$sparkDetails"` (single object from query)
2. Computes `showContent` (boolean flag for UI)
3. Computes `showEmptyMembers` (boolean flag for UI)

**Key Point**: UI flags are computed in process handlers, not views. Views only reference boolean flags from context.

---

### 9. View Re-rendering

**Location**: `libs/maia-vibes/src/sparks/detail/detail.view.maia`

The view subscribes to context changes:
```json
{
  "tag": "h2",
  "class": "detail-title",
  "text": "$spark.name"
}
```

**What happens**:
1. Context subscription fires when `spark` updates
2. View engine re-renders with new context value
3. View displays spark details and members

**Key Point**: Views are reactive - they automatically re-render when context changes.

---

## Key Architectural Patterns

### 1. Inbox-Based Communication

**Why**: 
- CRDT-native persistence and sync
- Complete event traceability
- Distributed system compatibility
- No direct actor references needed

**How**:
- Messages sent to actor inboxes (CoStreams)
- Inbox subscriptions process messages automatically
- Messages validated before routing to state machines

### 2. Independent Actors

**Why**:
- Each actor has its own context, state, view, inbox
- No parent-child dependencies
- Actors can be created/destroyed independently
- Enables lazy loading and reuse

**How**:
- Child actors created lazily via `_createChildActorIfNeeded()`
- Parent references child via `actor.children[namekey]`
- Communication via inboxes, not direct state access

### 3. Reactive Queries

**Why**:
- Automatic updates when filters change
- No manual refresh needed
- Declarative data needs
- Backend handles all query resolution

**How**:
- Query objects declared in context: `{schema: "...", filter: {...}}`
- Unified store detects queries, evaluates filters, executes queries
- Query results merged into context automatically
- Context subscriptions trigger view re-renders

### 4. Expression Resolution

**Why**:
- Only resolved values can be persisted to CRDTs
- Expressions require evaluation context that may not exist remotely
- Clean JSON is portable across devices

**How**:
- Views resolve ALL expressions before sending to inbox
- Messages contain only resolved values (no expressions)
- Process handlers receive resolved payloads
- Filters re-evaluated when context changes

---

## File Reference

### Core Engine Files

- **Actor Engine** (`libs/maia-engines/src/engines/actor.engine.js`):
  - `deliverEvent()` - Deliver event to actor inbox
  - `processEvents()` - Process messages from inbox
  - `_createChildActorIfNeeded()` - Create child actor lazily

- **Process Engine** (`libs/maia-engines/src/engines/process.engine.js`):
  - `send(processId, event, payload)` - Route event to handlers[event]
  - `_executeActions()` - Execute ctx, op, tell, ask, function actions

- **View Engine** (`libs/maia-engines/src/engines/view.engine.js`):
  - `_renderSlot()` - Render child actors in slots
  - `_handleEvent()` - Handle DOM events, resolve expressions, send to inbox

- **Unified Store** (`libs/maia-db/src/cojson/crud/read.js`):
  - `createUnifiedStore()` - Wrap context, detect queries, merge results
  - `resolveQueries()` - Evaluate filters, execute queries
  - `evaluateFilter()` - Resolve filter expressions dynamically

### Sparks Vibe Files

- **Agent Actor** (`libs/maia-vibes/src/sparks/agent/`):
  - `agent.view.maia` - Renders spark list, sends `SELECT_SPARK` event
  - Process definition - Handlers for `SELECT_SPARK`, `tell` to detail
  - `agent.context.maia` - Contains `sparks` query, `selectedSparkId`, `@actors`

- **Detail Actor** (`libs/maia-vibes/src/sparks/detail/`):
  - `detail.actor.maia` - Defines `interface: ["LOAD_ACTOR"]`
  - `detail.context.maia` - Contains `sparkDetails` query with dynamic filter
  - Process definition - Handlers for `LOAD_ACTOR`, computes UI flags
  - `detail.view.maia` - Renders spark details and members

---

## Common Patterns

### Pattern 1: Parent → Child Communication

**Use Case**: Parent actor needs to send data to child actor

**Steps**:
1. Parent process handler updates context via `ctx` action
2. Parent process handler runs `tell` action to child
3. `tell` evaluates payload from parent context
4. Message delivered to child inbox via `deliverEvent()`
5. Child processEvents → ProcessEngine.send → handlers update context
6. Child queries re-evaluate when filters change

**Example**: Agent actor → Detail actor (Sparks vibe)

### Pattern 2: Dynamic Query Filters

**Use Case**: Query should filter by value from context

**Steps**:
1. Define query in context with dynamic filter: `{id: "$sparkId"}`
2. Update context value that filter references: `sparkId: "co_z123..."`
3. Unified store detects filter change
4. Query re-executes with new filter
5. Query results update in context
6. Views re-render with new data

**Example**: `sparkDetails` query filters by `sparkId`

### Pattern 3: Child Actor Creation

**Use Case**: Render child actor in parent view

**Steps**:
1. Define child in parent context: `@actors: {detail: "@sparks/actor/detail"}`
2. Reference child in view: `currentDetail: "@detail"`
3. Use slot in view: `$slot: "$currentDetail"`
4. View engine extracts namekey from `currentDetail`
5. View engine calls `_createChildActorIfNeeded()`
6. Child actor created lazily, attached to slot element

**Example**: Agent view renders detail actor in slot

---

## Troubleshooting

### Issue: Detail view not updating when clicking spark

**Symptoms**: Clicking spark item doesn't update detail view

**Possible Causes**:
1. Expression validation error in process handler
2. Message not being sent to detail actor inbox
3. Detail actor not created yet
4. Query filter not re-evaluating

**Debug Steps**:
1. Check console for expression validation errors
2. Verify `tell` action sends to detail inbox
3. Verify message appears in detail actor inbox
4. Verify `sparkId` updates in detail context
5. Verify query filter re-evaluates

**Fix**: Use `$sparkDetails.members` instead of `$spark.members` in handler (see bug fix above)

### Issue: Messages not being processed

**Symptoms**: Messages sent but not reaching process handlers

**Possible Causes**:
1. Message type not in `interface` array
2. Message schema validation failing
3. Inbox subscription not set up
4. Actor not created yet

**Debug Steps**:
1. Verify message type in `interface` array
2. Check message schema exists and validates
3. Verify inbox subscription is active
4. Verify actor exists before sending message

---

## Related Documentation

- [Actor Engine API](../engines/00-overview.md#actorengine) - Actor lifecycle and messaging
- [Process Engine API](../engines/00-overview.md#processengine) - Event handler execution
- [View Engine API](../engines/00-overview.md#viewengine) - View rendering and events
- [Query Reactivity](../05_maia-db/README.md) - How queries work with dynamic filters
- [MaiaScript Expressions](../expressions.md) - Expression syntax and evaluation

---

## Summary

**Actor-to-actor communication in MaiaOS**:
1. ✅ **Inbox-based** - Messages sent to actor inboxes (CoStreams)
2. ✅ **Independent** - Each actor has its own context, process, view, inbox
3. ✅ **Reactive** - Queries re-execute when filters change
4. ✅ **Validated** - InboxEngine validates before routing to ProcessEngine
5. ✅ **CRDT-native** - All messages persist to CRDTs, sync across devices

**Key Files**:
- `libs/maia-engines/src/engines/actor.engine.js` - Message passing
- `libs/maia-engines/src/engines/process.engine.js` - Event handler execution
- `libs/maia-db/src/cojson/crud/read.js` - Query reactivity

**Example**: Sparks vibe agent → detail actor communication flow (documented above)
