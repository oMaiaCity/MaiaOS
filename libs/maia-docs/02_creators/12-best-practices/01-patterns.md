## 3. Composite/Leaf Pattern

### Pattern Structure

```
Vibe Service Actor (business logic)
  └── Composite Actor (UI orchestration)
        ├── UI Actor (component)
        └── UI Actor (component)
```

### Unlimited Nesting

**Composites can contain composites infinitely:**

```
Composite Level 1 (App Layout)
  └── Composite Level 2 (Feature)
        └── Composite Level 3 (Component Group)
              └── Composite Level 4 (Sub-component)
                    └── UI Actor (Leaf)
```

**Service actors can delegate to other service actors:**

```
Vibe Service Actor
  └── Domain Service Actor
        └── Feature Service Actor
              └── Query Service Actor
```

### Scalability Levels

#### Level 1: Simple App (2-5 Actors)
```
Vibe Service Actor
  └── Composite Actor
        ├── List UI Actor
        └── Kanban UI Actor
```

**Use case:** Todo app, simple dashboard  
**Complexity:** Low

#### Level 2: Medium App (10-20 Actors)
```
Vibe Service Actor
  └── App Composite Actor
        ├── Header Composite Actor
        │     ├── Logo UI Actor
        │     ├── Navigation UI Actor
        │     └── User Menu UI Actor
        ├── Main Composite Actor
        │     ├── Content Composite Actor
        │     │     ├── Todos Composite Actor
        │     │     └── Notes Composite Actor
        │     └── Details Panel UI Actor
        └── Footer UI Actor
```

**Use case:** Multi-feature app, dashboard with modules  
**Complexity:** Medium  
**Pattern:** Nested composites

#### Level 3: Large App (20-50 Actors)
```
Vibe Service Actor
  ├── Todos Service Actor (domain logic)
  ├── Notes Service Actor (domain logic)
  └── App Composite Actor
        ├── Todos Feature Composite Actor
        └── Notes Feature Composite Actor
```

**Use case:** Multi-domain app, SaaS application  
**Complexity:** High  
**Pattern:** Domain service actors

#### Level 4: Enterprise App (50-200+ Actors)
```
Vibe Service Actor
  ├── Auth Service Actor
  ├── Data Service Actor
  ├── Todos Domain Service Actor
  │     ├── Todos Query Service Actor
  │     └── Todos Mutation Service Actor
  └── App Composite Actor
        ├── Header Composite Actor
        ├── Main Composite Actor
        │     ├── Todos Feature Composite Actor
        │     │     ├── Todos Header Composite Actor
        │     │     ├── Todos Views Composite Actor
        │     │     └── Todos Details UI Actor
        │     └── Notes Feature Composite Actor
        └── Footer Composite Actor
```

**Use case:** Enterprise SaaS, complex business applications  
**Complexity:** Very High  
**Pattern:** Hierarchical services + deep nesting

---

## 4. Message Flow Patterns

### Pattern: UI Event → Service Actor → Data Mutation → UI Update

```
User clicks button in Composite
  ↓
Composite: SWITCH_VIEW { viewMode: "kanban" }
  ├─ Updates local state (viewMode, button states, currentView)
  └─ Forwards to Vibe: SWITCH_VIEW { viewMode: "kanban" }
      ↓
Vibe: Receives SWITCH_VIEW (no-op, just acknowledges)
  ↓
User types in Composite form
  ↓
Composite: UPDATE_INPUT { newTodoText: "Buy milk" }
  ├─ Updates local state (newTodoText)
  └─ Forwards to Vibe: UPDATE_INPUT { newTodoText: "Buy milk" }
      ↓
Vibe: Receives UPDATE_INPUT (no-op, just acknowledges)
  ↓
User clicks "Add" button in Composite
  ↓
Composite: CREATE_BUTTON { text: "Buy milk" }
  └─ Forwards to Vibe: CREATE_BUTTON { text: "Buy milk" }
      ↓
Vibe: Executes @db tool (op: "create")
  ├─ Publishes: TODO_CREATED { id: "123", text: "Buy milk" }
  └─ Publishes: INPUT_CLEARED → Composite
      ↓
Composite: Receives INPUT_CLEARED
  └─ Updates local state (newTodoText: "")
```

### Message Routing

**Messages flow through hierarchy:**
- **Up:** UI events → Feature → Domain → App
- **Down:** Data updates → App → Domain → Feature → UI
- **Across:** Feature-to-feature communication via app service

**Each layer can:**
- Handle locally (if it owns the state)
- Forward up (if parent should handle)
- Forward down (if child should handle)
- Broadcast (if multiple actors need it)

---

## 5. Scalability Strategies

### Strategy 1: Horizontal Scaling (Add Features)

**Add new feature modules:**
```
App Composite Actor
  ├── Existing Feature Composite Actor
  ├── Existing Feature Composite Actor
  └── NEW Feature Composite Actor  ← Add here
```

**Impact:** Minimal - no changes to existing actors

### Strategy 2: Vertical Scaling (Add Depth)

**Add nested composites:**
```
Existing Composite Actor
  └── NEW Composite Actor  ← Add nesting level
        └── UI Actor
```

**Impact:** Minimal - maintains clear boundaries

### Strategy 3: Domain Scaling (Add Domains)

**Add domain service:**
```
App Service Actor
  ├── Existing Domain Service Actor
  ├── Existing Domain Service Actor
  └── NEW Domain Service Actor  ← Add here
```

**Impact:** Minimal - clear domain boundaries

---

## 6. Performance Optimization

### Lazy Loading

**Load actors on-demand:**
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/composite",
  "children": {
    "todos": "@actor/todos",
    "notes": "@actor/notes"
  },
  "lazy": ["notes"]  // Load notes only when accessed
}
```

**Benefits:**
- Reduce initial load time
- Improve performance
- Code splitting ready

### Targeted Messaging

**Send to specific actors instead of broadcasting:**
```json
{
  "tool": "@core/publishMessage",
  "payload": {
    "type": "VIEW_MODE_UPDATED",
    "payload": {...},
    "target": "actor_composite_001"  // ← Targeted
  }
}
```

**Benefits:**
- Reduce message overhead
- Improve performance
- Avoid validation errors

### Message Batching

**Batch multiple updates:**
```json
{
  "tool": "@core/publishMessage",
  "payload": {
    "type": "BATCH_UPDATE",
    "payload": {
      "messages": [
        { "type": "TODO_CREATED", "payload": {...} },
        { "type": "NOTE_CREATED", "payload": {...} }
      ]
    }
  }
}
```

**Benefits:**
- Reduce message overhead
- Improve performance
- Atomic updates

### Actor Lifecycle Management

**Destroy unused actors:**
- Destroy actors when not visible
- Recreate on demand
- Cache actor definitions, not instances

**Benefits:**
- Optimize memory usage
- Improve performance
- Better resource management

---

## 7. Domain Separation

