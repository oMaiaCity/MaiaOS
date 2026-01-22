# Best Practices: Actor Architecture

**Comprehensive guide to building scalable, maintainable MaiaOS applications**

## Agent-First Development

**Always create the agent service actor first when building a vibe.**

**Why?**
- **Clear Architecture** - Agent defines the app's structure and data flow
- **Data First** - Agent handles all data operations before UI concerns
- **UI Second** - UI actors receive data from agent, keeping them simple
- **Consistent Pattern** - Every vibe follows the same structure
- **AI-Friendly** - LLMs understand this pattern and can generate vibes correctly

**Development Order:**
1. ✅ **Create agent service actor** (`agent/agent.actor.maia`) - ALWAYS FIRST
2. ✅ Create vibe manifest (`manifest.vibe.maia`) - References `@actor/agent`
3. ✅ Create composite actor (`composite/composite.actor.maia`) - First UI actor
4. ✅ Create UI actors (`list/list.actor.maia`, etc.) - Leaf components

## Table of Contents

1. [State Separation Pattern](#1-state-separation-pattern)
2. [Service vs UI Actor Responsibilities](#2-service-vs-ui-actor-responsibilities)
3. [Composite/Leaf Pattern](#3-compositeleaf-pattern)
4. [Message Flow Patterns](#4-message-flow-patterns)
5. [Scalability Strategies](#5-scalability-strategies)
6. [Performance Optimization](#6-performance-optimization)
7. [Domain Separation](#7-domain-separation)
8. [Feature Modules](#8-feature-modules)
9. [Anti-Patterns to Avoid](#9-anti-patterns-to-avoid)
10. [Real-World Examples](#10-real-world-examples)

---

## 1. State Separation Pattern

### Principle: Co-location & Single Responsibility

**Rule of thumb:** State should be co-located with the component that renders it and uses it.

### Three-Layer Architecture

#### Layer 1: Agent Service Actor (Business Logic)

**Best Practice:** Always create the agent service actor first. This is your app's orchestrator.

**Manages:**
- ✅ Business logic and data orchestration
- ✅ Data query configurations
- ✅ Mutation state (creating, toggling, deleting)
- ✅ Coordination between UI actors

**Does NOT manage:**
- ❌ UI state (view mode, button states)
- ❌ Form state (input values)
- ❌ Component-specific UI state

**Example Context:**
```json
{
  "$schema": "@schema/context",
  "$id": "@context/agent",
  "composite": "@actor/composite"
  // Only business logic references - no UI state
}
```

#### Layer 2: Composite Actor (UI Orchestration)

**Manages:**
- ✅ UI orchestration (view mode, current view)
- ✅ Button states (listButtonActive, kanbanButtonActive)
- ✅ Form state (newTodoText) - co-located with form
- ✅ UI presentation (title, placeholders, labels)

**Does NOT manage:**
- ❌ Business logic
- ❌ Data mutations
- ❌ Query configurations

**Example Context:**
```json
{
  "$schema": "@schema/context",
  "$id": "@context/composite",
  "title": "Todo List",                    // UI presentation
  "inputPlaceholder": "Add a new todo...", // UI presentation
  "addButtonText": "Add",                  // UI presentation
  "viewMode": "list",                      // UI orchestration
  "currentView": "@actor/list",            // UI orchestration
  "listButtonActive": true,                // UI orchestration
  "kanbanButtonActive": false,             // UI orchestration
  "newTodoText": ""                        // Form state (co-located)
}
```

#### Layer 3: UI Actors (Component-Specific)

**Manages:**
- ✅ Component-specific UI state (drag-drop, hover, etc.)
- ✅ Filtered/derived data for rendering (query results)

**Does NOT manage:**
- ❌ Business logic
- ❌ App-level UI orchestration
- ❌ Form state (unless component-specific)

**Example Contexts:**

**Kanban Actor:**
```json
{
  "$schema": "@schema/context",
  "$id": "@context/kanban",
  "todosTodo": [],        // Filtered data (query result)
  "todosDone": [],       // Filtered data (query result)
  "draggedItemId": null, // Component-specific UI state
  "dragOverColumn": null // Component-specific UI state
}
```

**List Actor:**
```json
{
  "$schema": "@schema/context",
  "$id": "@context/list",
  "todos": []  // Filtered data (query result)
}
```

---

## 2. Service vs UI Actor Responsibilities

### Service Actors

**Responsibilities:**
- Orchestrate data queries (send `SUBSCRIBE_TO_TODOS` to UI actors)
- Execute mutations (`CREATE_BUTTON`, `TOGGLE_BUTTON`, `DELETE_BUTTON`)
- Publish data events (`TODO_CREATED`, `TODO_COMPLETED`, `TODO_DELETED`)
- Coordinate between UI actors via messages

**State Management:**
- Business logic state only
- No UI state
- No form state

### UI Actors

**Responsibilities:**
- Render component UI
- Execute queries based on configurations from service actor
- Manage component-specific UI interactions (drag-drop, hover, etc.)
- Send generic UI events to service actor (`TOGGLE_BUTTON`, `DELETE_BUTTON`)

**State Management:**
- Component-specific UI state
- Filtered data for rendering
- No business logic

### Composite Actors

**Responsibilities:**
- Render shared UI (header, form, view switcher)
- Manage view switching logic
- Manage form input state
- Forward UI events to service actor
- Slot child UI actors based on view mode

**State Management:**
- UI orchestration state
- Form state (co-located with form)
- UI presentation state

---

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

### Pattern: One Service Actor Per Domain

**Each domain gets its own service actor:**
```
App Service Actor
  ├── Todos Domain Service Actor
  ├── Notes Domain Service Actor
  ├── Calendar Domain Service Actor
  └── Users Domain Service Actor
```

**Benefits:**
- ✅ Clear boundaries
- ✅ Independent scaling
- ✅ Team ownership
- ✅ Isolated testing

### Domain Service Responsibilities

**Domain Service Actor:**
- Manages domain-specific business logic
- Orchestrates domain queries
- Executes domain mutations
- Publishes domain events

**Example:**
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/agent",
  "role": "agent",
  "context": "@context/agent",
  "state": "@state/agent",
  "view": "@view/agent",
  "interface": "@interface/agent",
  "brand": "@style/brand",
  "subscriptions": "@subscriptions/agent",
  "inbox": "@inbox/agent",
  "inboxWatermark": 0
}
```

**Note:** Always create the agent service actor first. This is your app's orchestrator.

---

## 8. Feature Modules

### Pattern: One Composite Per Feature

**Each feature gets its own composite:**
```
App Composite Actor
  ├── Todos Feature Composite Actor
  ├── Notes Feature Composite Actor
  ├── Calendar Feature Composite Actor
  └── Settings Feature Composite Actor
```

**Benefits:**
- ✅ Feature isolation
- ✅ Independent development
- ✅ Lazy loading ready
- ✅ Code splitting ready

### Feature Composite Responsibilities

**Feature Composite Actor:**
- Manages feature-specific UI orchestration
- Coordinates feature UI actors
- Handles feature-specific form state
- Forwards feature events to domain service

**Example:**
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/composite",
  "role": "composite",
  "context": "@context/composite",
  "view": "@view/composite",
  "state": "@state/composite",
  "interface": "@interface/composite",
  "brand": "@style/brand",
  "children": {
    "list": "@actor/list",
    "kanban": "@actor/kanban"
  },
  "subscriptions": "@subscriptions/composite",
  "inbox": "@inbox/composite",
  "inboxWatermark": 0
}
```

---

## 9. Anti-Patterns to Avoid

### ❌ Don't: Put UI State in Service Actor

**Bad:**
```json
{
  "$schema": "@schema/context",
  "$id": "@context/agent",
  "viewMode": "list",        // ❌ UI state in service
  "listButtonActive": true,  // ❌ UI state in service
  "newTodoText": ""          // ❌ Form state in service
}
```

**Good:**
```json
{
  "$schema": "@schema/context",
  "$id": "@context/agent",
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
// Service Actor
{ "composite": "@composite" }  // ✅ No UI state

// Composite Actor
{ "viewMode": "list" }  // ✅ Single source of truth
```

### ❌ Don't: Create Monolithic Service Actors

**Bad:**
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/agent",
  "role": "agent",
  "state": "@state/monolithic-service"  // ❌ Everything in one service
}
```

**Good:**
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/agent",
  "role": "agent",
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

## 10. Real-World Examples

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
