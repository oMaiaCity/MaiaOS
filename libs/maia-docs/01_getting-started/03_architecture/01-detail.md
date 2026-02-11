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
│   │   └── dragdrop.module.js  # Drag-and-drop
│   └── tools/                  # Tool implementations
│       ├── db/                 # Database tool (@db)
│       ├── core/               # UI utilities
│       ├── dragdrop/           # Drag-and-drop handlers
│       └── context/            # Context manipulation
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
│   ├── maia-self/              # Self-sovereign identity
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

- **Tools** grouped into modules (`@db`, `@core/*`, `@dragdrop/*`)
- **Modules** loaded dynamically at boot (db, core, dragdrop)
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

- [Installation](../04_install.md) - Get started building
- [Creators Docs](../02_creators/) - Build applications
- [Developers Docs](../03_developers/) - Extend MaiaOS
