# MaiaOS Architecture

**Deep dive into system design and data flow.**

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         MaiaOS Kernel                        │
│                    (Single Entry Point)                      │
│                      o/kernel.js                             │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Module    │      │   Engine    │      │    Actor    │
│  Registry   │◄─────│  Layer      │◄─────│   Layer     │
└─────────────┘      └─────────────┘      └─────────────┘
        │                     │                     │
        │              ┌──────┴──────┐             │
        │              │             │             │
        ▼              ▼             ▼             ▼
┌─────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│   Modules   │  │  State   │  │   View   │  │   Tool   │
│ (db, core,  │  │  Engine  │  │  Engine  │  │  Engine  │
│  dragdrop,  │  └──────────┘  └──────────┘  └──────────┘
│  interface)  │
└─────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Additional Engines                        │
│  DBEngine | SubscriptionEngine | MessageQueue              │
│  ActorEngine | StyleEngine | MaiaScriptEvaluator            │
└─────────────────────────────────────────────────────────────┘
```

## Three Layers

### 1. Definition Layer (Declarative)

**Pure JSON definitions - zero logic:**

**Actors** - Component configuration:
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/todo",
  "role": "todo-list",
  "context": "@context/todo",
  "state": "@state/todo",
  "view": "@view/todo",
  "interface": "@interface/todo",
  "brand": "@style/brand",        // ← Shared design system (required)
  "style": "@style/todo",         // ← Actor-specific overrides (optional)
  "subscriptions": "@subscriptions/todo",
  "inbox": "@inbox/todo",
  "inboxWatermark": 0
}
```

**Note:** 
- `brand` is **required** - shared design system (tokens, components) used by all actors
- `style` is **optional** - actor-specific style overrides that merge with brand
- StyleEngine merges brand + style at runtime (brand first, then style overrides)
- All references (`context`, `view`, `state`, `interface`, `brand`, `style`, `subscriptions`, `inbox`) use co-id references (like `@context/todo`) that are transformed to actual co-ids (`co_z...`) during seeding
- The `$schema` and `$id` properties also use schema/instance references that get transformed

**Context** - Runtime data:
```json
{
  "$schema": "@schema/context",
  "$id": "@context/todo",
  "todos": [],
  "newTodoText": "",
  "viewMode": "list"
}
```

**Note:** Context files use `$schema` and `$id` with schema/instance references that get transformed to co-ids during seeding.

**State** - Behavior flow:
```json
{
  "$schema": "@schema/state",
  "$id": "@state/todo",
  "initial": "idle",
  "states": {
    "idle": {
      "on": {
        "CREATE_TODO": "creating"
      }
    }
  }
}
```

**Note:** State machine files use `$schema` and `$id` with schema/instance references. Tool payloads in state machines reference co-ids (transformed during seeding).

**View** - UI structure:
```json
{
  "$schema": "@schema/view",
  "$id": "@view/todo",
  "root": {
    "tag": "div",
    "text": "$title"
  }
}
```

**Note:** View files use `$schema` and `$id` with schema/instance references.

**Style** - Appearance (Brand or Local):
```json
{
  "$schema": "@schema/style",
  "$id": "@style/brand",
  "tokens": {
    "colors": {
      "primary": "#3b82f6"
    }
  },
  "components": {
    "button": {
      "padding": "0.5rem 1rem",
      "background": "{colors.primary}"
    }
  }
}
```

**Note:** 
- **Brand styles** (`@style/brand`) - Shared design system with tokens and components, referenced via `brand` property
- **Local styles** (`@style/todo`) - Actor-specific overrides, referenced via `style` property (optional)
- StyleEngine merges brand + local styles at runtime (brand first, local overrides)
- Style files use `$schema` and `$id` with schema/instance references

**Interface** - Message contract (replaces skill):
```json
{
  "$schema": "@schema/interface",
  "$id": "@interface/todo",
  "messages": {
    "CREATE_TODO": {
      "description": "Creates a new todo item",
      "payload": {
        "text": { "type": "string", "required": true }
      }
    }
  }
}
```

**Note:** Interface files define message contracts between actors. They use `$schema` and `$id` with schema/instance references. Skills (AI agent interface) are planned for v0.5.

### 2. Execution Layer (Imperative)

**Engines** - JavaScript execution machinery:

- **ActorEngine** - Orchestrates actors, manages lifecycle
- **StateEngine** - Interprets state machines, executes transitions
- **ViewEngine** - Renders views to Shadow DOM
- **ToolEngine** - Executes tool actions
- **StyleEngine** - Compiles styles to CSS
- **DBEngine** - Unified database operation engine (query, create, update, delete, toggle, seed)
- **SubscriptionEngine** - Context-driven reactive subscriptions
- **MessageQueue** - Actor-to-actor message passing
- **ModuleRegistry** - Manages dynamic module loading
- **MaiaScriptEvaluator** - Evaluates DSL expressions

**Tools** - Executable functions:

```javascript
// create.tool.js
export default {
  async execute(actor, payload) {
    const { schema, data } = payload;
    const entity = { id: Date.now().toString(), ...data };
    actor.context[schema].push(entity);
  }
};
```

**Modules** - Tool collections:

**Built-in Modules:**
- **db** - Database operations (replaces mutation module)
- **core** - UI utilities (modals, focus, preventDefault)
- **dragdrop** - Drag-and-drop handlers
- **interface** - Interface validation

```javascript
// db.module.js
export class DBModule {
  static async register(registry, toolEngine) {
    await toolEngine.registerTool('db', '@db');
  }
}
```

### 3. Intelligence Layer (AI Orchestration)

**Skills** - AI-readable interface specifications:

```json
{
  "stateEvents": {
    "CREATE_TODO": {
      "description": "Creates a new todo item",
      "payload": {
        "text": { "type": "string", "required": true }
      },
      "when": ["User says: 'add todo'", "User says: 'create task'"]
    }
  },
  "queryableContext": {
    "todos": {
      "type": "array",
      "description": "All todo items"
    }
  }
}
```

## Seeding & Reference Transformation

During vibe loading, all human-readable references are transformed to co-ids:

**Before Seeding (Human-Readable):**
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/todo",
  "context": "@context/todo",
  "view": "@view/todo",
  "state": "@state/todo"
}
```

**After Seeding (Co-IDs):**
```json
{
  "$schema": "co_z9h5nwiNynbxnC3nTwPMPkrVaMQ",
  "$id": "co_z8k4m2pLqRsTvWxYzAbCdEfGhIjKl",
  "context": "co_z7j3l1nKoQtPuVwXyZaBcDeFgHiJk",
  "view": "co_z6i2k0mJnPsOuTwVxYaBcDeFgHiJk",
  "state": "co_z5h1j9lIoNrQsTuVwXyZaBcDeFgHiJk"
}
```

**Transformation Process:**
1. Schema transformer maps `@schema/*` → co-ids
2. Instance transformer maps `@actor/*`, `@context/*`, `@view/*`, etc. → co-ids
3. All references in actors, state machines, and tool payloads are transformed
4. Co-ids are stored in database, human-readable refs remain in source `.maia` files

**Why This Matters:**
- Source files remain human-readable (`@actor/todo` is clearer than `co_z8k4m2pLqRsTvWxYzAbCdEfGhIjKl`)
- Runtime uses co-ids for efficient lookups and CoJSON integration
- Transformation happens automatically during seeding

## Data Flow

### User Interaction Flow

```
User Input (click, type, etc.)
  ↓
ViewEngine captures event
  ↓
ViewEngine evaluates payload ($ and $$)
  ↓
StateEngine.send(EVENT_NAME, payload)
  ↓
StateEngine finds current state
  ↓
StateEngine checks event handlers
  ↓
StateEngine evaluates guard (if present)
  ↓
Guard passes → Continue | Guard fails → Ignore
  ↓
StateEngine executes exit actions
  ↓
StateEngine transitions to target state
  ↓
StateEngine executes entry actions
  ↓
ToolEngine.execute(toolName, actor, payload)
  ↓
Tool mutates actor.context
  ↓
Tool succeeds → SUCCESS event | Tool fails → ERROR event
  ↓
StateEngine handles SUCCESS/ERROR
  ↓
ActorEngine.rerender(actor)
  ↓
ViewEngine re-renders Shadow DOM
  ↓
User sees updated UI
```

### AI Agent Interaction Flow

```
LLM Agent receives user intent
  ↓
Agent queries SkillEngine for available actors
  ↓
Agent reads skill definitions
  ↓
Agent matches user intent to capabilities
  ↓
Agent generates appropriate event + payload
  ↓
Agent sends event to actor via StateEngine
  ↓
[Same as User Interaction from StateEngine onward]
```

## File Organization

```
libs/maia-script/src/
├── o/                          # Operating System Layer
│   ├── kernel.js               # Single entry point
│   ├── engines/                # Execution engines
│   │   ├── actor-engine/
│   │   │   └── actor.engine.js
│   │   ├── state-engine/
│   │   │   └── state.engine.js
│   │   ├── view-engine/
│   │   │   └── view.engine.js
│   │   ├── style-engine/
│   │   │   └── style.engine.js
│   │   ├── tool-engine/
│   │   │   └── tool.engine.js
│   │   ├── db-engine/         # Database operation engine
│   │   │   ├── db.engine.js
│   │   │   ├── backend/
│   │   │   │   └── indexeddb.js
│   │   │   └── operations/
│   │   │       ├── query.js
│   │   │       ├── create.js
│   │   │       ├── update.js
│   │   │       ├── delete.js
│   │   │       ├── toggle.js
│   │   │       └── seed.js
│   │   ├── subscription-engine/
│   │   │   └── subscription.engine.js
│   │   ├── message-queue/
│   │   │   └── message.queue.js
│   │   ├── ModuleRegistry.js
│   │   └── MaiaScriptEvaluator.js
│   ├── modules/                # Tool modules
│   │   ├── db.module.js        # Database operations
│   │   ├── core.module.js      # UI utilities
│   │   ├── dragdrop.module.js  # Drag-and-drop
│   │   └── interface.module.js # Interface validation
│   └── tools/                  # Tool implementations
│       ├── db/                 # Database tool (@db)
│       ├── core/               # UI utilities
│       ├── dragdrop/           # Drag-and-drop handlers
│       ├── context/            # Context manipulation
│       └── interface/          # Interface validation
│
├── index.html                  # App marketplace entry point
├── index.js                    # Main export file
│
└── libs/maia-vibes/src/        # Example applications
    └── todos/
        ├── index.html
        ├── manifest.vibe.maia
        └── [actor files...]
```

**Monorepo Structure:**
```
MaiaOS/
├── libs/
│   ├── maia-script/            # Core OS (kernel, engines, tools)
│   ├── maia-db/                # CoJSON layer (CRDT operations)
│   ├── maia-schemata/          # Schema validation
│   ├── maia-vibes/             # Example vibes/apps
│   ├── maia-ssi/               # Self-sovereign identity
│   ├── maia-voice/             # Voice integration
│   └── maia-brand/             # Branding/assets
└── services/                   # Application services
    ├── app/                    # Main application
    ├── website/                # Landing page
    └── wallet/                 # Auth service
```

## Key Architectural Patterns

### Service Actor / UI Actor Separation

MaiaOS follows a clear separation between **service actors** (orchestration) and **UI actors** (presentation):

**Service Actors:**
- Orchestrate data queries and mutations
- Manage application-level state
- Coordinate between UI actors via messages
- Typically have minimal or no view (only render child actors)

**UI Actors:**
- Render user interfaces
- Handle user interactions
- Receive query configurations from service actors
- Send generic UI events to service actors

**Default Vibe Pattern:**
```
Vibe Entry Point
  └── Service Actor (orchestrating, minimal view)
        └── Composite Actor (first UI actor, shared structure)
              └── UI Actors (leaf components)
```

This pattern ensures:
- ✅ Clear separation of concerns
- ✅ Scalable through composition
- ✅ Message-based communication
- ✅ Consistent architecture across vibes

See [Actors Documentation](../vibecreators/02-actors.md#default-vibe-pattern-service--composite--ui) for details.

### Schema-Agnostic Design

Database operations work with any schema via co-ids:

```javascript
@db { op: "create", schema: "co_z...", data: {...} }
@db { op: "update", schema: "co_z...", id: "co_z...", data: {...} }
@db { op: "delete", schema: "co_z...", id: "co_z..." }
@db { op: "toggle", schema: "co_z...", id: "co_z...", field: "done" }
```

Same tool, different schema. Zero hardcoded domain knowledge. All schemas are co-ids (CoJSON IDs) - no human-readable fallbacks.

### Modular Everything

- **Tools** grouped into modules (`@db`, `@core/*`, `@dragdrop/*`, `@interface/*`)
- **Modules** loaded dynamically at boot (db, core, dragdrop, interface)
- **Engines** pluggable (ActorEngine, ViewEngine, StateEngine, DBEngine, etc.)
- **Database** unified operation engine with swappable backends (IndexedDB, CoJSON CRDT)
- **Skills** describe capabilities without implementation

### Shadow DOM Isolation

Each actor renders into its own shadow root:

```html
<div id="actor-todo">
  #shadow-root (open)
    <style>/* Actor styles */</style>
    <div>/* Actor UI */</div>
</div>
```

**Benefits:**
- ✅ Style isolation (no CSS leakage)
- ✅ DOM encapsulation
- ✅ Multiple instances without conflicts

### Message Passing

Actors communicate asynchronously:

```javascript
// Send message
os.sendMessage('actor_todo_001', {
  type: 'notification',
  data: {text: 'Task completed!'}
});

// Subscribe to messages
actor.subscriptions = ['actor_calendar_001'];

// Process messages
actor.inbox = [...]; // Watermark pattern
```

## Design Principles

1. **Declarative Over Imperative** - Define what, not how
2. **Separation of Concerns** - Actors, engines, and skills are independent
3. **Schema Agnostic** - Tools work with any data model
4. **AI Composable** - Skills enable LLM orchestration
5. **Module Everything** - No hardcoded dependencies
6. **Single Entry Point** - kernel.js loads everything
7. **Shadow DOM Isolation** - Each actor is self-contained
8. **Message Passing** - Actors communicate via inboxes

## Version History

- **v0.1** - Basic actor/view/style system
- **v0.2** - Added state machines and tool system
- **v0.3** - Added message passing and AI tool definitions
- **v0.4** - **Current** - Unified database engine (DBEngine), subscription engine, modular architecture
- **v0.5** - **Planned** - Skills as AI agent interface, CoJSON integration

## Next Steps

- [Installation](./04_install.md) - Get started building
- [Vibecreators Docs](../vibecreators/) - Build applications
- [Developers Docs](../developers/) - Extend MaiaOS
