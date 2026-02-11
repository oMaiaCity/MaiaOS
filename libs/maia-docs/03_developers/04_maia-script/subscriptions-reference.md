# Subscription Reference

Detailed reference for config subscriptions, data subscriptions, patterns, and troubleshooting.

---

## Config Subscriptions

### Config Types

SubscriptionEngine subscribes to: `view`, `style`, `brand`, `state`, `interface`, `context`.

### Engine vs Direct Subscriptions

**View/Style/State:** Go through engines (caching, batch subscriptions).

```javascript
await viewEngine.loadView(config.view, (updatedView) => {
  handleViewUpdate(actorId, updatedView);
});
```

**Interface/Context:** Use read() API directly.

```javascript
const store = await dbEngine.execute({
  op: 'read',
  schema: interfaceSchemaCoId,
  key: config.interface
});
store.subscribe((updatedInterface) => handleInterfaceUpdate(actorId, updatedInterface));
```

### Update Handlers

| Config | Handler | Result |
|--------|---------|--------|
| View | `_handleViewUpdate` | Invalidate cache, update viewDef, re-render |
| Style | `_handleStyleUpdate` | Reload stylesheets, update shadowRoot, re-render |
| State | `_handleStateUpdate` | Destroy old machine, create new, re-render |
| Interface | `_handleInterfaceUpdate` | Update interface, re-validate (no re-render) |
| Context | `_handleContextUpdate` | Merge context, re-subscribe queries, re-render |

### Cache Invalidation

View/state updates invalidate caches before applying changes. Caches repopulate on next load.

---

## Data Subscriptions

### Query Objects

Objects in context with `schema` (co-id) and optional `filter`. SubscriptionEngine scans context, subscribes automatically.

```javascript
actor.context = {
  todos: { schema: "co_zTodos123", filter: { completed: false } }
}
```

### Reactive Stores

`read()` always returns ReactiveStore. Properties: `store.value`, `store.subscribe(callback)`.

### CoList Loading

Collection queries auto-load CoLists from IndexedDB before querying. Ensures data available after re-login.

### Deduplication

SubscriptionEngine checks `isSameData()` before updating context to avoid redundant re-renders.

---

## Batching System

Svelte-style microtask batching prevents excessive re-renders. Multiple subscriptions in same tick → one rerender per actor.

**Flow:** `_scheduleRerender(actorId)` → add to `pendingRerenders` Set → queueMicrotask → flush all in batch.

**Usage:** All engines call `_scheduleRerender()` instead of `rerender()` directly.

---

## Runtime Requirements

**Co-IDs only:** Runtime MUST use `co_z...`, never `@schema/...`. ReadOperation validates.

**Unified read():** All data access via `read()` → returns ReactiveStore. Single pattern, always reactive.

---

## CRDT-Safe Watermark Pattern

Distributed inboxes (CoStreams) across browsers require watermark to prevent duplicate processing.

**Rule:** Read watermark from persisted config before processing. Update with max(current, new) logic. Prevents duplicate actions when two browsers process same message.

**Implementation:** `ActorEngine.processMessages()` reads persisted watermark. `_persistWatermark()` uses max() logic.

---

## Actor Lifecycle and Cleanup

**Container tracking:** Actors registered with container. `destroyActorsForContainer()` bulk cleanup on vibe unload.

**Automatic cleanup:** `destroyActor()` → `SubscriptionEngine.cleanup()` → unsubscribe all → ReactiveStore auto-cleans backend when last subscriber leaves.

**Flow:** destroyActor → cleanup → unsubscribe → last subscriber leaves → store._unsubscribe() → backend cleanup.

---

## Troubleshooting

### Config Not Updating

Check: `_configSubscriptions` has unsubscribe, co-id valid, handler called, cache invalidated. Fix: Verify initialize(), setEngines(), check console.

### Duplicate Subscriptions

Check: loadView() called multiple times, cleanup on destroy. Fix: initialize() once, cleanup() on destroy.

### Data Not Updating

Check: schema is co-id, `_subscriptions` has unsubscribe, store works. Fix: Verify seeding transforms to co-id, initialize() called, read() succeeds.

### Performance Issues

Check: batching (pendingRerenders), deduplication, cache hit rate. Fix: Verify batching, reduce subscriptions, optimize handlers.

---

## Future: Backend Swap

**Current:** IndexedDB backend with reactive stores.

**Future:** Real CoJSON with `oSubscriptionCache` for deduplication. Multiple actors → one backend subscription. Auto-cleanup after 5s inactivity.

**Migration:** API unchanged. Backend implementation swaps. No actor-level changes.

---

## References

- Config: `libs/maia-script/src/engines/subscription-engine/config-subscriptions.js`
- Data: `libs/maia-script/src/engines/subscription-engine/data-subscriptions.js`
- Handlers: `libs/maia-script/src/engines/subscription-engine/update-handlers.js`
- DB: `libs/maia-script/src/engines/db-engine/operations/read.js`
- Store: `libs/maia-script/src/utils/reactive-store.js`
