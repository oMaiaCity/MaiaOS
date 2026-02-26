# Actor Lifecycle and Message Passing

## Actor Lifecycle

### Service Actors vs UI Actors

**Service Actors:** Persist throughout vibe lifecycle. Created once, destroyed only on vibe unload.

**UI Actors:** Created on-demand when view is active (`context.currentView`). Destroyed when switching views.

### Lifecycle Flow

**Service Actor:** Created → Booting (state machine, view, styles) → Active (processes events) → Destroyed (vibe unload)

**UI Actor:** Created (lazily when referenced) → Booting → Active → Destroyed (when switching view)

### Lazy Child Actor Creation

Child actors created only when referenced by `context.currentView`. Service children persist; UI children destroyed when switching views.

---

## Message Passing & Event Flow

**CRITICAL:** Actor inbox is the **single source of truth** for ALL events.

**Flow:** View/External/Tool SUCCESS-ERROR → inbox → processMessages() → StateEngine.send()

**Expression Resolution:**
- Views resolve ALL expressions before sending to inbox (clean JSON only)
- State machines receive resolved payloads
- Action configs still support expressions (evaluated in state machine)

### Sending Messages

**External (actor-to-actor):**
```javascript
os.deliverEvent(senderId, 'actor_todo_001', 'notification', {
  text: 'Reminder'  // Resolved value, not expressions
});
```

**Internal (from views):** Automatically route through inbox. Views resolve expressions before sending.

### Receiving Messages

Messages sent to inbox costream. Actors automatically process and route to state machine. No explicit subscription needed.

---

## Shadow DOM Isolation

Each actor with a view renders into its own Shadow DOM:

✅ Style isolation  
✅ DOM encapsulation  
✅ Multiple instances without conflicts  
✅ Automatic container queries (`:host` has `container-type: inline-size`)

See [10-style.md](../10-style.md) for `@container` queries.

## Multiple Actor Instances

```javascript
const todo1 = await os.createActor('./maia/todo.actor.maia', container1);
const todo2 = await os.createActor('./maia/todo.actor.maia', container2);
// Each has independent context
```

## File Naming Convention

```
maia/
├── todo.actor.maia    # Actor definition
├── todo.context.maia  # Runtime data
├── todo.state.maia    # State machine
├── todo.view.maia     # View definition
├── todo.style.maia    # Actor-specific styles
```

---

**Next:** [03-composition.md](./03-composition.md) - Composing actors and examples
