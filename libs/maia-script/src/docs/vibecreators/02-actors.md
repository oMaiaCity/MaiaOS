# Actors

**Actors** are the fundamental building blocks of MaiaOS applications. They are **autonomous, self-contained components** with their own state, behavior, UI, and messaging capabilities.

## Philosophy

> Actors are **pure declarative specifications** - they contain zero embedded logic, only configuration and references.

An actor is a **lightweight definition file** (`.actor.maia`) that:
- References a state machine (behavior)
- References a view (UI)
- References styles (appearance)
- Holds runtime context (data)
- Receives messages via inbox
- Subscribes to other actors

**Think of actors as composable building blocks:** They define *what* should happen (via references) without implementing *how* it happens (that's the engines' job). This separation makes actors:
- **Simple** - Easy to understand and modify
- **Composable** - Mix and match state, views, and styles
- **Reusable** - Same definition creates multiple instances
- **AI-friendly** - LLM agents can read and generate them easily

## Actor Definition

Create a file named `{name}.actor.maia`:

```json
{
  "$type": "actor",
  "$id": "actor_todo_001",
  "id": "actor_todo_001",
  
  "contextRef": "todo",
  "stateRef": "todo",
  "viewRef": "todo",
  "styleRef": "brand",
  
  "inbox": [],
  "subscriptions": [],
  "inboxWatermark": 0
}
```

**Note:** Context can be defined inline (see below) or in a separate `.context.maia` file using `contextRef` for cleaner organization.

### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `$type` | string | Yes | Always `"actor"` |
| `$id` | string | Yes | Unique identifier for this definition |
| `id` | string | Yes | Runtime instance ID |
| `contextRef` | string | No | References `{name}.context.maia` file (alternative to inline context) |
| `context` | object | No | Inline initial runtime data (alternative to contextRef) |
| `stateRef` | string | Yes | References `{name}.state.maia` file |
| `viewRef` | string | No | References `{name}.view.maia` file (optional for service actors) |
| `styleRef` | string | No | References `{name}.style.maia` file |
| `children` | object | No | Map of slot names to child actor IDs (for composite actors) |
| `interfaceRef` | string | No | References `{name}.interface.maia` file (message contract) |
| `inbox` | array | No | Message queue (managed at runtime) |
| `subscriptions` | array | No | Actors to receive messages from |
| `inboxWatermark` | number | No | Last processed message index |

**Context Options:**
- Use `contextRef` to load context from a separate file (recommended for large contexts)
- Use inline `context` for small, simple actors
- If both are present, `contextRef` takes precedence

## Actor Types

### UI Actors
Actors with a view component that renders to the DOM:

```json
{
  "$type": "actor",
  "id": "actor_todo_001",
  "stateRef": "todo",
  "viewRef": "todo",      // ← Has UI
  "styleRef": "brand",
  "context": {...}
}
```

**Use cases:**
- Todo lists
- Note editors
- Calendar widgets
- Chat interfaces

### Service Actors
Actors without UI that provide background functionality:

```json
{
  "$type": "actor",
  "id": "actor_sync_service",
  "stateRef": "sync",
  "context": {
    "lastSyncTime": null,
    "syncStatus": "idle"
  }
}
```

**Use cases:**
- Data synchronization
- Background workers
- Notification services
- API coordinators

## Context (Runtime State)

The `context` holds all runtime data for the actor. It can be defined inline in the actor file or in a separate `.context.maia` file:

**Option 1: Inline Context**
```json
{
  "$type": "actor",
  "id": "actor_todo_001",
  "stateRef": "todo",
  "context": {
    "todos": [],
    "newTodoText": "",
    "viewMode": "list"
  }
}
```

**Option 2: Separate Context File (`todo.context.maia`)**
```json
{
  "$type": "context",
  "$id": "context_todo_001",
  "todos": [],
  "newTodoText": "",
  "viewMode": "list"
}
```

Referenced in actor:
```json
{
  "$type": "actor",
  "id": "actor_todo_001",
  "contextRef": "todo",
  "stateRef": "todo"
}
```

**Example Context Structure:**
```json
{
  // Collections
  "todos": [
    {"id": "1", "text": "Buy milk", "done": false}
  ],
  
  // Derived/filtered data
  "todosTodo": [],  // Computed by tools
  "todosDone": [],
  
  // UI state
  "viewMode": "list",
  "isModalOpen": false,
  
  // Form state
  "newTodoText": "",
  
  // Drag-drop state (managed by tools)
  "draggedItemId": null,
  "draggedEntityType": null
}
```

### Context Best Practices

✅ **DO:**
- Keep context flat when possible
- Use clear, descriptive names
- Initialize all fields (avoid `undefined`)
- Store only serializable data (no functions)

❌ **DON'T:**
- Store UI elements or DOM references
- Put logic in context (use tools instead)
- Mix concerns (separate data from UI state)

## Actor Lifecycle

```
┌─────────────┐
│   Created   │  ← createActor() called
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Booting    │  ← State machine initialized
└──────┬──────┘      View rendered (if viewRef exists)
       │            Styles applied (if styleRef exists)
       ▼
┌─────────────┐
│   Active    │  ← Processes events
└──────┬──────┘      Processes messages
       │            Re-renders on state changes
       ▼
┌─────────────┐
│  Destroyed  │  ← destroyActor() called
└─────────────┘
```

### Creating Actors

```javascript
// Single actor
const actor = await os.createActor(
  './maia/todo.actor.maia',
  document.getElementById('container')
);

// Multiple actors
const actors = await Promise.all([
  os.createActor('./maia/todo.actor.maia', document.getElementById('col-1')),
  os.createActor('./maia/notes.actor.maia', document.getElementById('col-2'))
]);
```

### Accessing Actors

```javascript
// Get actor by ID
const actor = os.getActor('actor_todo_001');

// Access context
console.log(actor.context.todos);

// Access state
console.log(actor.machine.currentState); // 'idle', 'creating', etc.
```

## Message Passing

Actors communicate asynchronously via **inboxes and subscriptions**:

### Sending Messages

```javascript
// Send to specific actor
os.sendMessage('actor_todo_001', {
  type: 'notification',
  from: 'actor_calendar_001',
  data: {text: 'Reminder: Meeting at 3pm'}
});

// Actors can send to each other
actor.actorEngine.sendMessage(targetActorId, message);
```

### Subscribing to Messages

In the actor definition:

```json
{
  "id": "actor_todo_001",
  "subscriptions": ["actor_calendar_001", "actor_sync_service"]
}
```

Or at runtime:

```javascript
actor.actorEngine.subscribe('actor_todo_001', 'actor_calendar_001');
```

### Processing Messages

Messages are processed via the actor's state machine. Define message handlers:

```json
{
  "idle": {
    "on": {
      "MESSAGE_RECEIVED": {
        "target": "processingMessage",
        "guard": {"$ne": ["$inbox.length", 0]}
      }
    }
  }
}
```

## Shadow DOM Isolation

Each actor with a view renders into its own **Shadow DOM**, providing:

✅ **Style isolation** - Actor styles don't leak  
✅ **Encapsulation** - Internal DOM is private  
✅ **Reusability** - Multiple instances don't conflict

```html
<div id="actor-todo">
  #shadow-root
    <style>/* Actor-specific styles */</style>
    <div>/* Actor UI */</div>
</div>
```

## Multiple Actor Instances

You can create multiple instances of the same actor type:

```javascript
const todo1 = await os.createActor('./maia/todo.actor.maia', container1);
const todo2 = await os.createActor('./maia/todo.actor.maia', container2);

// Each has independent context
todo1.context.todos // []
todo2.context.todos // []
```

## File Naming Convention

```
maia/
├── todo.actor.maia    # Actor definition (references only)
├── todo.context.maia  # Runtime data (referenced by contextRef)
├── todo.state.maia    # State machine (referenced by stateRef)
├── todo.view.maia     # View definition (referenced by viewRef)
├── todo.style.maia    # Actor-specific styles (referenced by styleRef)
└── brand.style.maia   # Shared design system
```

**Convention:** `{name}.{type}.maia`

## Example: Complete Todo Actor

**`todo.actor.maia`:**
```json
{
  "$type": "actor",
  "$id": "actor_todo_001",
  "id": "actor_todo_001",
  
  "contextRef": "todo",
  "stateRef": "todo",
  "viewRef": "todo",
  "styleRef": "brand",
  
  "inbox": [],
  "subscriptions": [],
  "inboxWatermark": 0
}
```

**`todo.context.maia`:**
```json
{
  "$type": "context",
  "$id": "context_todo_001",
  "todos": [
    {"id": "1", "text": "Learn MaiaOS", "done": true},
    {"id": "2", "text": "Build an app", "done": false}
  ],
  "todosTodo": [],
  "todosDone": [],
  "newTodoText": "",
  "viewMode": "list",
  "isModalOpen": false
}
```

## Composing Actors

Actors can be **composed** into larger structures using **composite views** and **slots**.

### Composite vs Leaf Actors

**Leaf Actors** - Terminal components that render UI directly:
```json
{
  "$type": "actor",
  "viewRef": "todo_input"  // ← Leaf view with root property
}
```

**Composite Actors** - Containers that hold child actors:
```json
{
  "$type": "actor",
  "viewRef": "vibe_root",  // ← Composite view with container property
  "children": {
    "header": "actor_header_001",
    "content": "actor_content_001"
  }
}
```

### Defining Children

Add a `children` map to your actor:

```json
{
  "$type": "actor",
  "$id": "actor_dashboard_001",
  "children": {
    "header": "actor_header_001",
    "sidebar": "actor_sidebar_001",
    "content": "actor_content_001"
  }
}
```

**Key Points:**
- `children` maps slot names to actor IDs
- Child actors are created automatically
- Parent auto-subscribes to all children

### Composite Views with Slots

Create a composite view with slots:

**`dashboard.view.maia`:**
```json
{
  "$type": "view",
  "container": {
    "tag": "div",
    "class": "dashboard-layout",
    "slots": {
      "header": "@header",
      "sidebar": "@sidebar",
      "content": "@content"
    }
  }
}
```

**Slot Syntax:**
- Use `@slotName` to reference a child actor
- Slot name must match a key in `children` map

### Actor Interfaces

Define message contracts with `actor.interface.maia`:

**`todo_input.interface.maia`:**
```json
{
  "$type": "actor.interface",
  "publishes": {
    "TODO_CREATED": {
      "payload": { "id": "string", "text": "string" }
    }
  },
  "subscriptions": ["actor_todo_list_001"]
}
```

**Interface Properties:**
- `inbox` - Messages this actor accepts
- `publishes` - Messages this actor emits
- `subscriptions` - Actor IDs to send messages to

### Message Passing Between Actors

**Parent → Child:**
- Parent publishes via `publishMessage()`
- Message validated against `interface.publishes`
- Sent to subscribed actors

**Child → Parent:**
- Child publishes message
- Parent receives in inbox (if subscribed)
- Parent's state machine processes

**Example Flow:**
1. User types in `todo_input` actor
2. `todo_input` publishes `TODO_CREATED` message
3. `todo_list` receives message (subscribed)
4. `todo_list` creates new item
5. `todo_item` actors render in list

### Best Practices

**✅ DO:**
- Keep actors small and focused
- Use clear slot names
- Define interfaces for all actors
- Use message passing (not prop drilling)

**❌ DON'T:**
- Don't create monolithic actors
- Don't expose context directly
- Don't skip interface definitions
- Don't create circular dependencies

**Learn More:** See [Composing Actors](./composing-actors.md) for detailed examples.

## Next Steps

- Learn about [Skills](./03-skills.md) - AI agent interface
- Understand [State Machines](./05-state.md) - Actor behavior
- Explore [Context](./04-context.md) - Runtime data management
- Create [Views](./07-views.md) - UI representation
- Compose actors: [Composing Actors](./composing-actors.md) - Building complex UIs

## Debugging Actors

```javascript
// Expose actor globally
window.actor = actor;

// Inspect in console
actor.context           // Runtime data
actor.machine          // State machine instance
actor.machine.currentState  // Current state
actor.inbox            // Message queue
actor.subscriptions    // Subscribed actors

// Inspect Shadow DOM
// In DevTools: click the actor container, expand #shadow-root
```
