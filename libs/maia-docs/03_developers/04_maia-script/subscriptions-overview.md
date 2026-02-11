# Subscription Architecture

## Overview

MaiaOS uses a **decentralized, per-actor subscription system** for end-to-end reactivity. Every actor automatically subscribes to:
1. **Data dependencies** (query objects in context)
2. **Config CRDTs** (view, style, state, interface, context, brand)
3. **Message channels** (subscriptions colist, inbox costream)

When any dependency changes, actors automatically update and re-render.

---

## The Simple Version

Think of subscriptions like automatic notifications. When you tell an actor "watch this data," it automatically gets notified whenever that data changes—like getting a text when someone updates a shared document.

**Data example:**
```javascript
actor.context = {
  todos: { schema: "co_zTodos123", filter: { completed: false } }
}
// SubscriptionEngine subscribes automatically, updates context, triggers re-render
```

**Config example:**
```javascript
actor.config = { view: "co_zView123", style: "co_zStyle456" }
// When view/style CRDTs change → actor updates → re-renders
```

---

## Architecture

### Decentralized Per-Actor Tracking

Each actor tracks its own subscriptions:
- `actor._subscriptions` - Data subscriptions
- `actor._configSubscriptions` - Config subscriptions

**Benefits:** Simple cleanup (actor destruction → unsubscribe all), no centralized registry.

### Unified `read()` API

All data access uses `read()`, which always returns a reactive store:

```javascript
const store = await dbEngine.execute({
  op: 'read',
  schema: "co_zTodos123",
  filter: { completed: false }
});
// store.value - current data
// store.subscribe(callback) - get updates
```

### Co-IDs Only

Runtime code MUST use co-ids (`co_z...`), never human-readable IDs. `ReadOperation` validates this. Human-readable IDs transform to co-ids during seeding.

---

## Lifecycle

**Initialization:** Actor created → SubscriptionEngine.initialize(actor) → subscribes to data + configs.

**Updates:** Store subscription fires → context/config updated → batched re-render scheduled.

**Cleanup:** Actor destroyed → SubscriptionEngine.cleanup(actor) → unsubscribes all.

---

## Related Documentation

- [subscriptions-reference.md](./subscriptions-reference.md) - Config/data details, patterns, troubleshooting
- [engines/](./engines/) - Engine overview
- [api-reference.md](./api-reference.md) - Complete API reference

---

## References

- Source: `libs/maia-script/src/engines/subscription-engine/`
- DB Engine: `libs/maia-script/src/engines/db-engine/`
- Reactive Store: `libs/maia-script/src/utils/reactive-store.js`
