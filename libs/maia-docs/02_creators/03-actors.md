# Actors (Building Blocks)

Think of actors like **LEGO pieces**. Each piece is complete by itself:
- It knows what it looks like (view)
- It knows how to behave (state machine)
- It remembers things (context)
- It can talk to other pieces (messages)

You snap actors together to build your app!

## What's an Actor?

An actor is just a small file (`.actor.maia`) that says:
- "My brain is in `todo.state.maia`" (state machine)
- "My face is in `todo.view.maia`" (UI)
- "My style is in `brand.style.maia`" (colors and fonts)
- "My memory is in `todo.context.maia`" (data I remember)

**That's it!** The actor file just points to other files. The engines do the actual work.

## Why This Is Cool

**Simple:** Each file does one thing. Easy to understand!

**Reusable:** Want 3 todo lists? Create the actor 3 times. They all work independently!

**Composable:** Mix and match. Use the same view with a different state machine. Use the same state machine with a different view.

**AI-Friendly:** Because it's just configuration files, AI agents can easily read and modify them!

## Actor Definition

Create a file named `{name}.actor.maia`:

```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/todo",
  "role": "todo-list",
  "context": "@context/todo",
  "state": "@state/todo",
  "view": "@view/todo",
  "interface": "@interface/todo",
  "brand": "@style/brand",
  "style": "@style/todo",
  "subscriptions": "@subscriptions/todo",
  "inbox": "@inbox/todo",
  "inboxWatermark": 0
}
```

**Note:** All references (`context`, `view`, `state`, `interface`, `brand`, `style`, `subscriptions`, `inbox`) use schema/instance references (like `@context/todo`) that are transformed to co-ids (`co_z...`) during seeding. The `$schema` and `$id` properties also use schema references.

### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `$schema` | string | Yes | Schema reference (`@schema/actor`) - transformed to co-id during seeding |
| `$id` | string | Yes | Unique actor identifier (`@actor/todo`) - transformed to co-id during seeding |
| `role` | string | No | Actor role (e.g., `"agent"`, `"composite"`, `"todo-list"`) |
| `context` | string | No | Co-id reference to context (`@context/todo`) - transformed during seeding |
| `state` | string | Yes | Co-id reference to state machine (`@state/todo`) - transformed during seeding |
| `view` | string | No | Co-id reference to view (`@view/todo`) - optional for service actors |
| `interface` | string | No | Co-id reference to interface (`@interface/todo`) - message contract |
| `brand` | string | Yes | Co-id reference to brand style (`@style/brand`) - shared design system |
| `style` | string | No | Co-id reference to local style (`@style/todo`) - actor-specific overrides |
| `children` | object | No | Map of slot names to child actor references (`{"composite": "@actor/composite"}`) |
| `subscriptions` | string | No | Co-id reference to subscriptions colist (`@subscriptions/todo`) |
| `inbox` | string | No | Co-id reference to inbox costream (`@inbox/todo`) |
| `inboxWatermark` | number | No | Last processed message timestamp (default: 0) |

**Style Properties:**
- `brand` is **required** - shared design system (tokens, components) used by all actors
- `style` is **optional** - actor-specific style overrides that merge with brand
- StyleEngine merges brand + style at runtime (brand first, then style overrides)

## Best Practice: Agent-First Development

**Always create the agent service actor first when building a vibe.**

**Why?**
- **Clear Architecture** - Agent defines the app's structure
- **Data First** - Agent handles all data operations
- **UI Second** - UI actors receive data from agent
- **Consistent Pattern** - Every vibe follows the same structure
- **AI-Friendly** - LLMs understand this pattern

**Development Order:**
1. ✅ **Create agent service actor** (`agent/agent.actor.maia`) - ALWAYS FIRST
2. ✅ Create vibe manifest (`manifest.vibe.maia`) - References `@actor/agent`
3. ✅ Create composite actor (`composite/composite.actor.maia`) - First UI actor
4. ✅ Create UI actors (`list/list.actor.maia`, etc.) - Leaf components

## Actor Types

MaiaOS distinguishes between two fundamental actor types based on their responsibilities and whether they render UI:

### Service Actors

**Service actors** are orchestrating actors responsible for business logic, data management, and coordination. They typically have **no view** (or a minimal view that only renders child actors).

**Characteristics:**
- ✅ Orchestrate data queries and mutations
- ✅ Manage application-level state
- ✅ Coordinate between UI actors
- ✅ Handle message routing and business logic
- ❌ No direct UI rendering (or minimal container view)

**Example: Agent Service Actor (Default Entry Point - ALWAYS CREATE FIRST)**
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/agent",
  "role": "agent",
  "context": "@context/agent",
  "view": "@view/agent",        // ← Minimal view (only renders child)
  "state": "@state/agent",
  "interface": "@interface/agent",
  "brand": "@style/brand",
  "children": {
    "composite": "@actor/composite"  // ← Loads first UI actor
  },
  "subscriptions": "@subscriptions/agent",
  "inbox": "@inbox/agent",
  "inboxWatermark": 0
}
```

**Best Practice:** Always define the agent service actor first when creating a vibe. This is your app's orchestrator.

**Agent View (Minimal):**
```json
{
  "$schema": "@schema/view",
  "$id": "@view/agent",
  "root": {
    "tag": "div",
    "attrs": { "class": "agent-container" },
    "$slot": "$composite"  // ← Only renders child actor
  }
}
```

**Use cases:**
- **Vibe entry points** (default pattern - every vibe loads an agent service actor)
- Data synchronization services
- Background workers
- API coordinators
- Business logic orchestration

**Why "agent"?**
- Clear naming: the agent orchestrates everything
- Consistent pattern: every vibe has `@actor/agent`
- Best practice: define agent first, then UI actors

### UI Actors

**UI actors** are presentation actors responsible for rendering user interfaces. They receive data/configurations from service actors and handle user interactions.

**Characteristics:**
- ✅ Render UI components
- ✅ Handle user interactions
- ✅ Receive query configurations from service actors
- ✅ Send generic UI events (e.g., `TOGGLE_BUTTON`, `DELETE_BUTTON`) to service actors
- ❌ No direct data mutations (delegate to service actors)

**Example: List UI Actor**
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/list",
  "role": "todo-list",
  "context": "@context/list",
  "view": "@view/list",        // ← Full UI view
  "state": "@state/list",
  "interface": "@interface/list",
  "brand": "@style/brand",
  "subscriptions": "@subscriptions/list",  // ← Subscribes to agent
  "inbox": "@inbox/list",
  "inboxWatermark": 0
}
```

**Use cases:**
- Todo lists
- Note editors
- Calendar widgets
- Chat interfaces
- Form components
- Navigation components

### Composite Actors

**Composite actors** are a special type of UI actor that compose other UI actors. They provide shared UI structure (e.g., header, form, view switcher) and slot child actors.

**Example: Composite Actor**
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
    "list": "@actor/list",        // ← Child UI actors
    "kanban": "@actor/kanban"
  },
  "subscriptions": "@subscriptions/composite",  // ← Subscribes to agent
  "inbox": "@inbox/composite",
  "inboxWatermark": 0
}
```

**Composite View:**
```json
{
  "$type": "view",
  "container": {
    "tag": "div",
    "children": [
      {
        "tag": "header",
        "children": [
          {"tag": "h1", "text": "Todo List"},
          {"tag": "button", "$on": {"click": {"send": "SWITCH_VIEW"}}}
        ]
      },
      {
        "tag": "main",
        "$slot": "$currentView"  // ← Slots child UI actors
      }
    ]
  }
}
```

## Default Vibe Pattern: Service → Composite → UI

**The standard pattern for building vibes:**

```
Vibe Entry Point
  └── Service Actor (orchestrating, minimal view)
        └── Composite Actor (first UI actor, shared structure)
              └── UI Actors (leaf components)
```

### Step 1: Vibe Loads Agent Service Actor

Every vibe's entry point is an **agent service actor** that orchestrates the application:

**`manifest.vibe.maia`:**
```json
{
  "$schema": "@schema/vibe",
  "$id": "@vibe/todos",
  "name": "Todo List",
  "description": "A todo list application",
  "actor": "@actor/agent"  // ← Agent service actor (ALWAYS CREATE FIRST)
}
```

**Best Practice:** Always define the agent service actor first. This is your app's orchestrator.

### Step 2: Agent Service Actor Loads Composite

The agent loads a **composite actor** as its first child:

**`agent/agent.actor.maia` (Agent Service Actor):**
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/agent",
  "role": "agent",
  "context": "@context/agent",
  "view": "@view/agent",        // ← Minimal view
  "state": "@state/agent",      // ← Orchestrates queries/mutations
  "interface": "@interface/agent",
  "brand": "@style/brand",
  "children": {
    "composite": "@actor/composite"  // ← First UI actor
  },
  "subscriptions": "@subscriptions/agent",
  "inbox": "@inbox/agent",
  "inboxWatermark": 0
}
```

**Agent Service Actor Responsibilities:**
- Orchestrate data queries (send `SUBSCRIBE_TO_TODOS` messages to UI actors)
- Handle mutations (`CREATE_BUTTON`, `TOGGLE_BUTTON`, `DELETE_BUTTON`)
- Manage application-level state
- Coordinate between UI actors via messages
- Load composite actor as first child
- Define message contracts via interface

**Why Start with Agent?**
1. **Clear Architecture** - Agent defines the app's structure
2. **Data First** - Agent handles all data operations
3. **UI Second** - UI actors receive data from agent
4. **Best Practice** - Always define orchestrator before components

### Step 3: Composite Actor Composes UI Actors

The composite actor provides shared UI structure and slots child UI actors:

**`composite/composite.actor.maia`:**
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
    "list": "@actor/list",        // ← UI actors
    "kanban": "@actor/kanban"
  },
  "subscriptions": "@subscriptions/composite",
  "inbox": "@inbox/composite",
  "inboxWatermark": 0
}
```

**Composite Actor Responsibilities:**
- Render shared UI (header, form, view switcher)
- Slot child UI actors based on context
- Forward UI events to service actor
- Receive state updates from service actor

### Step 4: UI Actors Render Components

Leaf UI actors render specific components:

**`list/list.actor.maia`:**
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/list",
  "role": "todo-list",
  "context": "@context/list",
  "view": "@view/list",
  "state": "@state/list",
  "interface": "@interface/list",
  "brand": "@style/brand",
  "subscriptions": "@subscriptions/list",
  "inbox": "@inbox/list",
  "inboxWatermark": 0
}
```

**UI Actor Responsibilities:**
- Execute queries based on configurations from service actor
- Render UI components
- Send generic UI events to service actor
- Receive data updates via messages

### Message Flow Pattern

```
User clicks button in UI Actor
  ↓
UI Actor sends: TOGGLE_BUTTON { id: "123" }
  ↓
Service Actor receives message
  ↓
Service Actor executes: @db tool with op: "toggle"
  ↓
Service Actor publishes: TODO_COMPLETED { id: "123" }
  ↓
UI Actors receive update and re-render
```

### Why This Pattern?

✅ **Clear Separation of Concerns**
- Service actors = Business logic
- UI actors = Presentation

✅ **Scalable Through Composition**
- Start simple (service → composite → UI)
- Add more UI actors as needed
- Service actor orchestrates everything

✅ **Message-Based Communication**
- Loose coupling between actors
- Easy to test and modify
- AI agents can understand message contracts

✅ **Default Pattern for Vibes**
- Every vibe follows this structure
- Consistent architecture
- Easy to understand and extend

### Scaling Through Composition

**Simple Vibe:**
```
Service Actor → Composite Actor → UI Actor
```

**Complex Vibe:**
```
Service Actor
  └── Composite Actor
        ├── Header UI Actor
        ├── Form UI Actor
        ├── List UI Actor
        │     └── List Item UI Actor (repeated)
        └── Footer UI Actor
```

The service actor orchestrates all of them via messages, maintaining clean separation of concerns.

## Context (Runtime State)

The `context` holds all runtime data for the actor. It can be defined inline in the actor file or in a separate `.context.maia` file:

**Separate Context File (Recommended):**

**`todo.context.maia`:**
```json
{
  "$schema": "@schema/context",
  "$id": "@context/todo",
  "todos": [],
  "newTodoText": "",
  "viewMode": "list"
}
```

Referenced in actor:
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/todo",
  "context": "@context/todo",  // ← Co-id reference (transformed during seeding)
  "state": "@state/todo"
}
```

**Note:** Context is always in a separate file. The `context` property references it via co-id (`@context/todo`), which gets transformed to an actual co-id (`co_z...`) during seeding.

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
  "$schema": "@schema/actor",
  "$id": "@actor/todo",
  "role": "todo-list",
  "context": "@context/todo",
  "state": "@state/todo",
  "view": "@view/todo",
  "interface": "@interface/todo",
  "brand": "@style/brand",
  "style": "@style/todo",
  "subscriptions": "@subscriptions/todo",
  "inbox": "@inbox/todo",
  "inboxWatermark": 0
}
```

**`todo.context.maia`:**
```json
{
  "$schema": "@schema/context",
  "$id": "@context/todo",
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

**Composition** is combining smaller actors into larger, more complex actors. Think of it like building with LEGO blocks - you combine simple pieces to create complex structures.

### Two Types of Actors

#### Leaf Actors

**Leaf actors** are terminal components - they don't contain other actors. They render UI directly.

**Example: `todo_input.actor.maia`**
```json
{
  "$type": "actor",
  "$id": "actor_todo_input_001",
  "viewRef": "todo_input",
  "stateRef": "todo_input"
}
```

**Leaf View: `todo_input.view.maia`**
```json
{
  "$type": "view",
  "root": {
    "tag": "div",
    "children": [
      {
        "tag": "input",
        "attrs": {
          "value": "$newTodoText"
        }
      },
      {
        "tag": "button",
        "text": "Add",
        "$on": {
          "click": {
            "send": "CREATE_TODO"
          }
        }
      }
    ]
  }
}
```

#### Composite Actors

**Composite actors** are containers that hold other actors in slots.

**Example: `vibe_root.actor.maia`**
```json
{
  "$type": "actor",
  "$id": "actor_vibe_root_001",
  "viewRef": "vibe_root",
  "children": {
    "header": "actor_view_switcher_001",
    "input": "actor_todo_input_001",
    "list": "actor_todo_list_001"
  }
}
```

**Composite View: `vibe_root.view.maia`**
```json
{
  "$type": "view",
  "container": {
    "tag": "div",
    "attrs": {
      "class": "app-layout"
    },
    "children": [
      {
        "tag": "header",
        "$slot": "$headerView"  // Renders child actor from context.headerView
      },
      {
        "tag": "main",
        "$slot": "$inputView"   // Renders child actor from context.inputView
      },
      {
        "tag": "section",
        "$slot": "$listView"    // Renders child actor from context.listView
      }
    ]
  }
}
```

### How Slots Work

**Slots** are placeholders where child actors get rendered.

**Syntax:**
- Use `$slot` with a context value (e.g., `"$slot": "$currentView"`)
- State machine sets context value to child actor name (e.g., `currentView: "@list"`)
- ViewEngine resolves `@list` → finds child actor with name `list` in `children` map
- Attaches child actor's container to the slot element

**Example:**
```json
{
  "$type": "actor",
  "children": {
    "header": "actor_header_001",    // ← Child actor ID
    "list": "actor_todo_list_001"     // ← Child actor ID
  }
}
```

**View with slots:**
```json
{
  "$type": "view",
  "container": {
    "tag": "div",
    "children": [
      {
        "tag": "header",
        "$slot": "$headerView"  // Context value set by state machine
      },
      {
        "tag": "main",
        "$slot": "$currentView" // Context value set by state machine
      }
    ]
  }
}
```

**State machine sets context:**
```json
{
  "states": {
    "idle": {
      "entry": {
        "tool": "@core/updateContext",
        "payload": {
          "headerView": "@header",
          "currentView": "@list"
        }
      }
    }
  }
}
```

### Building a Composable App

#### Step 1: Identify Components

Break your UI into logical pieces:
- Header with navigation
- Input form
- List of items
- Footer

#### Step 2: Create Leaf Actors

Create one actor for each piece:

**`header.actor.maia`** - Navigation bar
**`input.actor.maia`** - Form input
**`list.actor.maia`** - Item list
**`footer.actor.maia`** - Footer

#### Step 3: Create Composite Root

Create a root actor that composes all pieces:

**`app.actor.maia`**
```json
{
  "$type": "actor",
  "$id": "actor_app_001",
  "viewRef": "app",
  "stateRef": "app",
  "children": {
    "header": "actor_header_001",
    "input": "actor_input_001",
    "list": "actor_list_001",
    "footer": "actor_footer_001"
  }
}
```

**`app.view.maia`**
```json
{
  "$type": "view",
  "container": {
    "tag": "div",
    "attrs": {
      "class": "app"
    },
    "children": [
      {
        "tag": "header",
        "$slot": "$headerView"
      },
      {
        "tag": "main",
        "$slot": "$inputView"
      },
      {
        "tag": "section",
        "$slot": "$listView"
      },
      {
        "tag": "footer",
        "$slot": "$footerView"
      }
    ]
  }
}
```

**`app.state.maia`** - Sets context values for slots:
```json
{
  "$type": "state",
  "initial": "idle",
  "states": {
    "idle": {
      "entry": {
        "tool": "@core/updateContext",
        "payload": {
          "headerView": "@header",
          "inputView": "@input",
          "listView": "@list",
          "footerView": "@footer"
        }
      }
    }
  }
}
```

### Message Passing Between Actors

Actors communicate via **messages**, not props.

#### Define Interfaces

Create `actor.interface.maia` for each actor:

**`todo_input.interface.maia`**
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

**`todo_list.interface.maia`**
```json
{
  "$type": "actor.interface",
  "inbox": {
    "TODO_CREATED": {
      "payload": { "id": "string", "text": "string" }
    }
  }
}
```

#### Publish Messages

When an event happens, publish a message:

**In state machine:**
```json
{
  "states": {
    "creating": {
      "entry": {
        "tool": "@db",
        "payload": { "op": "create", "schema": "@schema/todos", "data": {...} }
      },
      "on": {
        "SUCCESS": {
          "target": "idle",
          "actions": [
            {
              "tool": "@core/publishMessage",
              "payload": {
                "type": "TODO_CREATED",
                "payload": { "id": "$id", "text": "$text" }
              }
            }
          ]
        }
      }
    }
  }
}
```

#### Subscribe to Messages

Parent actors auto-subscribe to children:

```json
{
  "$type": "actor",
  "children": {
    "input": "actor_todo_input_001"
  },
  "subscriptions": ["actor_todo_input_001"]  // ← Auto-added
}
```

### Real Example: Todo App

**Structure:**
```
vibe_root (composite)
├── @header (view_switcher - leaf)
├── @input (todo_input - leaf)
├── @list (todo_list - composite)
│   └── @item (todo_item - leaf, repeated)
└── @kanban (kanban_view - leaf)
```

**Message Flow:**
1. User types in `todo_input` → publishes `CREATE_TODO`
2. `todo_list` receives `CREATE_TODO` → creates item
3. `todo_item` instances render in list
4. User clicks complete → `todo_item` publishes `TODO_COMPLETED`
5. `todo_list` receives → updates state
6. `vibe_root` receives → orchestrates view

### Common Patterns

#### Layout Container
```json
{
  "$type": "view",
  "container": {
    "tag": "div",
    "children": [
      {
        "tag": "header",
        "$slot": "$headerView"
      },
      {
        "tag": "main",
        "$slot": "$mainView"
      },
      {
        "tag": "footer",
        "$slot": "$footerView"
      }
    ]
  }
}
```

#### List with Items
```json
{
  "$type": "view",
  "container": {
    "tag": "ul",
    "$each": {
      "items": "$todos",
      "template": {
        "tag": "li",
        "$slot": "@item"
      }
    }
  }
}
```

#### Conditional View Switching
```json
{
  "$type": "view",
  "container": {
    "tag": "div",
    "children": [
      {
        "tag": "section",
        "$slot": "$currentView"  // State machine sets to "@list" or "@kanban"
      }
    ]
  }
}
```

**State machine handles switching:**
```json
{
  "states": {
    "idle": {
      "on": {
        "SWITCH_VIEW": {
          "target": "idle",
          "actions": [
            {
              "tool": "@core/updateContext",
              "payload": {
                "currentView": "$viewMode === 'list' ? '@list' : '@kanban'"
              }
            }
          ]
        }
      }
    }
  }
}
```

### Best Practices

**✅ DO:**
- Keep actors small and focused
- Use clear slot names (`@header`, not `@h`)
- Define interfaces for all actors
- Publish messages for important events
- Keep context internal (don't expose)
- Use state machine to set slot context values

**❌ DON'T:**
- Don't create giant monolithic actors
- Don't use prop drilling
- Don't skip interface definitions
- Don't expose context directly
- Don't create circular dependencies
- Don't put conditional logic in views (use state machine instead)

## Next Steps

- Learn about [Skills](./03-skills.md) - AI agent interface
- Understand [State Machines](./05-state.md) - Actor behavior
- Explore [Context](./04-context.md) - Runtime data management
- Create [Views](./07-views.md) - UI representation
- Review [Best Practices](./10-best-practices.md) - Architecture patterns and scalability

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
