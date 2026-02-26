## 10. Anti-Patterns to Avoid

### ❌ Don't: Put UI State in Service Actor

**Bad:**
```json
{
  "$schema": "@schema/context",
  "$id": "@context/vibe",
  "viewMode": "list",        // ❌ UI state in service
  "listButtonActive": true,  // ❌ UI state in service
  "newTodoText": ""          // ❌ Form state in service
}
```

**Good:**
```json
{
  "$schema": "@schema/context",
  "$id": "@context/vibe",
  "composite": "@actor/composite"  // ✅ Only business logic references
}
```

### ❌ Don't: Put Business Logic in UI Actors

**Bad:**
```json
{
  "states": {
    "creating": {
      "entry": {
        "tool": "@db",  // ❌ Business logic in UI actor
        "payload": { "op": "create", ... }
      }
    }
  }
}
```

**Good:**
```json
{
  "states": {
    "idle": {
      "on": {
        "CREATE_BUTTON": {
          "actions": [
            {
              "tool": "@core/publishMessage",  // ✅ Forward to service
              "payload": {
                "type": "CREATE_BUTTON",
                "target": "actor_service_001"
              }
            }
          ]
        }
      }
    }
  }
}
```

### ❌ Don't: Duplicate State Across Actors

**Bad:**
```json
// Service Actor
{ "viewMode": "list" }

// Composite Actor
{ "viewMode": "list" }  // ❌ Duplicated
```

**Good:**
```json
// Service Actor Context
{
  "currentView": "@composite",  // ✅ Context property (CRDT CoValue) - references active child
  "@actors": {
    "composite": "@actor/composite"  // ✅ System property (like $schema/$id) - defines children
  }
}

// Composite Actor Context
{
  "viewMode": "list",  // ✅ Single source of truth
  "currentView": "@list",  // ✅ Context property - references active child
  "@actors": {
    "list": "@actor/list",
    "kanban": "@actor/kanban"
  }
}
```

### ❌ Don't: Create Monolithic Service Actors

**Bad:**
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/vibe",
  "@label": "agent",
  "state": "@state/monolithic-service"  // ❌ Everything in one service
}
```

**Good:**
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/vibe",
  "@label": "agent",
  "children": {
    "todos": "@actor/todos-service",    // ✅ Domain separation
    "notes": "@actor/notes-service",   // ✅ Domain separation
    "calendar": "@actor/calendar-service"  // ✅ Domain separation
  }
}
```

### ❌ Don't: Nest Unnecessarily

**Bad:**
```
Composite Actor
  └── Composite Actor
        └── Composite Actor
              └── Composite Actor
                    └── UI Actor  // ❌ Unnecessary nesting
```

**Good:**
```
Composite Actor
  ├── UI Actor  // ✅ Flat when possible
  └── UI Actor
```

### ❌ Don't: Broadcast Everything

**Bad:**
```json
{
  "tool": "@core/publishMessage",
  "payload": {
    "type": "UPDATE_INPUT",
    // ❌ No target - broadcasts to all subscribers
  }
}
```

**Good:**
```json
{
  "tool": "@core/publishMessage",
  "payload": {
    "type": "UPDATE_INPUT",
    "target": "actor_composite_001"  // ✅ Targeted messaging
  }
}
```

---

## 11. Real-World Examples

### Example 1: E-Commerce App (30-50 Actors)

```
App Service Actor
  ├── Products Service Actor
  ├── Cart Service Actor
  ├── Orders Service Actor
  └── App Composite Actor
        ├── Header Composite Actor
        ├── Main Composite Actor
        │     ├── Products Feature Composite Actor
        │     ├── Cart Feature Composite Actor
        │     └── Orders Feature Composite Actor
        └── Footer Composite Actor
```

**Pattern:** Domain services + feature composites  
**Complexity:** Medium-High

### Example 2: Project Management App (40-60 Actors)

```
App Service Actor
  ├── Projects Service Actor
  ├── Tasks Service Actor
  ├── Teams Service Actor
  └── App Composite Actor
        ├── Header Composite Actor
        ├── Main Composite Actor
        │     ├── Projects Feature Composite Actor
        │     ├── Tasks Feature Composite Actor
        │     └── Teams Feature Composite Actor
        └── Footer Composite Actor
```

**Pattern:** Domain services + feature composites  
**Complexity:** High

### Example 3: Enterprise CRM (100-200+ Actors)

```
App Service Actor
  ├── Auth Service Actor
  ├── Data Service Actor
  ├── Customers Service Actor
  ├── Sales Service Actor
  ├── Support Service Actor
  └── App Composite Actor
        ├── Header Composite Actor
        ├── Main Composite Actor
        │     ├── Customers Feature Composite Actor
        │     ├── Sales Feature Composite Actor
        │     └── Support Feature Composite Actor
        └── Footer Composite Actor
```

**Pattern:** Hierarchical services + deep nesting  
**Complexity:** Very High

---

## Summary: Best Practices Checklist

### ✅ State Management

- [ ] Service actors manage business logic only
- [ ] Composite actors manage UI orchestration
- [ ] UI actors manage component-specific state
- [ ] State is co-located with components that use it
- [ ] No state duplication across actors
- [ ] **State machines are single source of truth** - All context updates flow through state machines
- [ ] **Use `updateContext` infrastructure action** - Always update context via state machine actions
- [ ] **Handle errors in state machines** - Use ERROR event handlers to update error context

### ✅ Architecture

- [ ] Use domain service actors for large apps
- [ ] Use feature composites for feature isolation
- [ ] Nest composites logically (not unnecessarily)
- [ ] Maintain clear separation of concerns
- [ ] Follow single responsibility principle

### ✅ Messaging

- [ ] Use targeted messaging (not broadcasting)
- [ ] Forward UI events to service actors
- [ ] Publish data events from service actors
- [ ] Handle state locally when possible
- [ ] Use message batching for performance

### ✅ Performance

- [ ] Lazy load features when possible
- [ ] Use code splitting for large apps
- [ ] Manage actor lifecycle (destroy unused)
- [ ] Cache actor definitions, not instances
- [ ] Optimize message routing

### ✅ Scalability

- [ ] Start simple, scale as needed
- [ ] Add domains independently
- [ ] Add features independently
- [ ] Maintain clear boundaries
- [ ] Document architecture decisions

### ✅ Schema Definitions

- [ ] Every schema has a `cotype` (comap, colist, or costream)
- [ ] Use `$co` for CoValue references (external schemas, actors, views)
- [ ] Use `$ref` only for internal definitions (within `$defs`)
- [ ] Include required fields: `$schema`, `$id`, `title`, `cotype`
- [ ] Validate co-id patterns: `^co_z[a-zA-Z0-9]+$`
- [ ] Keep schemas focused and single-purpose

---

## Quick Reference

| Concern | Service Actor | Composite Actor | UI Actor |
|---------|---------------|----------------|----------|
| **Business Logic** | ✅ Yes | ❌ No | ❌ No |
| **Data Mutations** | ✅ Yes | ❌ No | ❌ No |
| **Query Orchestration** | ✅ Yes | ❌ No | ❌ No |
| **UI Orchestration** | ❌ No | ✅ Yes | ❌ No |
| **View Switching** | ❌ No | ✅ Yes | ❌ No |
| **Form State** | ❌ No | ✅ Yes | ❌ No (unless component-specific) |
| **Component UI State** | ❌ No | ❌ No | ✅ Yes |
| **Filtered Data** | ❌ No | ❌ No | ✅ Yes |

---

**Remember:** The pattern scales from simple apps (2-5 actors) to enterprise applications (200+ actors) while maintaining clear separation of concerns and co-location of state.
