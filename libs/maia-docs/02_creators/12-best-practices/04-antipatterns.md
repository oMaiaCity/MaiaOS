## 10. Anti-Patterns to Avoid

### ❌ Don't: Put UI State in Service Actor

**Bad:**
```json
{
  "$factory": "@factory/context",
  "$id": "@context/vibe",
  "viewMode": "list",        // ❌ UI state in service
  "listButtonActive": true,  // ❌ UI state in service
  "newTodoText": ""          // ❌ Form state in service
}
```

**Good:**
```json
{
  "$factory": "@factory/context",
  "$id": "@context/vibe",
  "composite": "@actor/composite"  // ✅ Only business logic references
}
```

### ❌ Don't: Put Business Logic in UI Actors

**Bad:**
```json
{
  "handlers": {
    "CREATE_BUTTON": [
      {
        "op": { "create": {...} }  // ❌ Business logic in UI actor
      }
    ]
  }
}
```

**Good:**
```json
{
  "handlers": {
    "CREATE_BUTTON": [
      {
        "tell": {  // ✅ Forward to service
          "target": "°Maia/actor/services/todos",
          "type": "CREATE_BUTTON",
          "payload": { "text": "$$value" }
        }
      }
    ]
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
    "composite": "@actor/composite"  // ✅ System property (like $factory/$id) - defines children
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
  "$factory": "@factory/actor",
  "$id": "@actor/vibe",
  "@label": "agent",
  "process": "@process/monolithic-service"  // ❌ Everything in one service
}
```

**Good:**
```json
{
  "$factory": "@factory/actor",
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
  "tell": {
    "type": "UPDATE_INPUT"
    // ❌ No target - tell requires target
  }
}
```

**Good:**
```json
{
  "tell": {
    "target": "°Maia/actor/views/composite",  // ✅ Targeted messaging
    "type": "UPDATE_INPUT",
    "payload": { "value": "$$value" }
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
- [ ] **Process handlers are single source of truth** - All context updates flow through process handlers
- [ ] **Use `ctx` action** - Always update context via process handler actions
- [ ] **Handle errors in process handlers** - Use ERROR handler to update error context

### ✅ Architecture

- [ ] Use domain service actors for large apps
- [ ] Use feature composites for feature isolation
- [ ] Nest composites logically (not unnecessarily)
- [ ] Maintain clear separation of concerns
- [ ] Follow single responsibility principle

### ✅ Messaging

- [ ] Use targeted messaging with `tell` (specify target)
- [ ] Forward UI events to service actors via `tell`
- [ ] Service actors use `tell` to send SUCCESS/ERROR to `$$source`
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
- [ ] Include required fields: `$factory`, `$id`, `title`, `cotype`
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
