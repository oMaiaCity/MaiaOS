# MaiaOS Architecture

**Deep dive into system design and data flow.**

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         MaiaOS Kernel                        │
│                    (Single Entry Point)                      │
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
│ (core,      │  │  Engine  │  │  Engine  │  │  Engine  │
│  mutation,  │  └──────────┘  └──────────┘  └──────────┘
│  dragdrop)  │
└─────────────┘
```

## Three Layers

### 1. Definition Layer (Declarative)

**Pure JSON definitions - zero logic:**

**Actors** - Component configuration:
```json
{
  "$type": "actor",
  "id": "actor_todo_001",
  "contextRef": "todo",
  "stateRef": "todo",
  "viewRef": "todo"
}
```

**Context** - Runtime data:
```json
{
  "$type": "context",
  "todos": [],
  "newTodoText": "",
  "viewMode": "list"
}
```

**State** - Behavior flow:
```json
{
  "$type": "state",
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

**View** - UI structure:
```json
{
  "$type": "view",
  "root": {
    "tag": "div",
    "text": "$title"
  }
}
```

**Style** - Appearance:
```json
{
  "$type": "style",
  "tokens": {
    "colors": {
      "primary": "#3b82f6"
    }
  }
}
```

**Skill** - AI interface:
```json
{
  "$type": "skill",
  "actorType": "todo",
  "capabilities": {
    "taskManagement": "Create, complete, delete todos"
  }
}
```

### 2. Execution Layer (Imperative)

**Engines** - JavaScript execution machinery:

- **ActorEngine** - Orchestrates actors, manages lifecycle
- **StateEngine** - Interprets state machines, executes transitions
- **ViewEngine** - Renders views to Shadow DOM
- **ToolEngine** - Executes tool actions
- **StyleEngine** - Compiles styles to CSS
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

```javascript
// mutation.module.js
export class MutationModule {
  static async register(registry, toolEngine) {
    const tools = ['create', 'update', 'delete', 'toggle'];
    for (const tool of tools) {
      await toolEngine.registerTool(`mutation/${tool}`, `@mutation/${tool}`);
    }
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
│   │   ├── ActorEngine.js
│   │   ├── StateEngine.js
│   │   ├── ViewEngine.js
│   │   ├── ToolEngine.js
│   │   └── ModuleRegistry.js
│   ├── modules/                # Tool modules
│   │   ├── core.module.js
│   │   ├── mutation.module.js
│   │   └── dragdrop.module.js
│   └── tools/                  # Tool implementations
│       ├── core/
│       ├── mutation/
│       ├── dragdrop/
│       └── context/
│
├── examples/                   # Example applications
│   └── todos/
│       ├── index.html
│       ├── todo.actor.maia
│       ├── todo.context.maia
│       ├── todo.state.maia
│       ├── todo.view.maia
│       └── brand.style.maia
│
└── docs/                       # Documentation
    ├── getting-started/
    ├── vibecreators/
    ├── developers/
    └── agents/
```

## Key Architectural Patterns

### Schema-Agnostic Design

Tools don't know about specific data types:

```javascript
@mutation/create { schema: "todos", data: {...} }
@mutation/create { schema: "notes", data: {...} }
@mutation/create { schema: "users", data: {...} }
```

Same tool, different schema. Zero hardcoded domain knowledge.

### Modular Everything

- **Tools** grouped into modules (`@core/*`, `@mutation/*`)
- **Modules** loaded dynamically at boot
- **Engines** pluggable (future: add ThreeJS renderer)
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
- **v0.4** - **Current** - Modular architecture with generic CRUD
- **v0.5** - **Planned** - Skills as AI agent interface

## Next Steps

- [Installation](./04_install.md) - Get started building
- [Vibecreators Docs](../vibecreators/) - Build applications
- [Developers Docs](../developers/) - Extend MaiaOS
