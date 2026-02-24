# Subscription Architecture

## Overview

MaiaOS uses a **backend $stores architecture** for end-to-end reactivity. There is no SubscriptionEngine—subscriptions are handled by the storage layer (CoCache, unified store in maia-db). Every actor automatically benefits from:
1. **Data dependencies** (query objects in context)
2. **Config CRDTs** (view, style, process, interface, context, brand)
3. **Message channels** (inbox costream)

When any dependency changes, actors automatically update and re-render.

---

## The Simple Version

Think of subscriptions like automatic notifications. When you put a query object in context, the backend unified store automatically resolves it and merges results. When data changes, the store updates and views re-render.

**Data example:**
```javascript
actor.context = {
  todos: { schema: "co_zTodos123", filter: { completed: false } }
}
// Backend unified store subscribes, merges query results into context, triggers re-render
```

**Config example:**
```javascript
actor.config = { view: "co_zView123", style: "co_zStyle456" }
// When view/style CRDTs change → backend updates actor → re-renders
```

---

## Architecture

### Backend $stores (No SubscriptionEngine)

Subscriptions are part of the **maia-db** layer:
- **CoCache** - Unified caching (subscriptions, stores, resolutions), 5s timeout
- **Unified store** - Merges context + query results, manages reactive resolution
- `context.value` is plain object (not ReactiveStore); backend handles subscriptions

**Benefits:** No separate engine; storage layer owns all reactive behavior.

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

**Initialization:** Actor created → backend sets up config subscriptions → data queries in context resolved by unified store.

**Updates:** Store subscription fires → context/config updated → batched re-render scheduled.

**Cleanup:** Actor destroyed → config subscriptions cleaned up → CoCache auto-cleanup (5s timeout).

---

## Related Documentation

- [subscriptions-reference.md](./subscriptions-reference.md) - Config/data details, patterns, troubleshooting
- [engines/](./engines/) - Engine overview
- [maia-db storage layer](../05_maia-db/README.md) - CoCache, unified store
- [api-reference.md](./api-reference.md) - Complete API reference

---

## References

- CoCache: `libs/maia-db/src/cojson/cache/coCache.js`
- Universal read: `libs/maia-db/src/cojson/crud/read.js`
- ReactiveStore: `libs/maia-db` (ReactiveStore exported from maia-db)
