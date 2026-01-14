# MaiaScript v0.2 - State Machines + AI Agent Foundation

**Transform actors into AI agent primitives with state machines, message passing, and AI-compatible tool definitions.**

## 🎯 What's New in v0.2

### Architecture Evolution

v0.2 introduces **foundational patterns for AI agent coordination**:

1. **State Machines** - Predictable, observable state transitions
2. **Message Passing** - Actor-to-actor communication via inbox/subscriptions
3. **AI-Compatible Tools** - `.tool.maia` definitions map to LLM tool schemas
4. **Simplified DSL** - `$key` (context) and `$$key` (item) syntax

### Why State Machines?

State machines provide **clean interfaces for AI agents**:
- **Predictability**: Agents understand possible states and transitions
- **Observability**: Current state is always clear
- **Coordination**: Multiple agents can coordinate through state observation
- **Error Handling**: Explicit error states and recovery paths

## 📁 Project Structure

```
maia-script/src/
├── o/                         # Operating System (kernel + core)
│   ├── kernel.js             # Single entry point (NEW)
│   ├── engines/              # Core rendering engines
│   │   ├── ActorEngine.js   # Actor lifecycle + message passing
│   │   ├── StateEngine.js   # State machine interpreter
│   │   ├── ToolEngine.js    # AI-compatible tool execution
│   │   ├── ViewEngine.js    # View rendering + send() events
│   │   ├── StyleEngine.js   # Style compilation
│   │   └── MaiaScriptEvaluator.js # DSL evaluator
│   └── tools/                # System tool registry
│       ├── createTodo.tool.maia
│       ├── createTodo.tool.js
│       └── ... (12 tools total)
└── examples/
    └── todos/                # Todo app example
        ├── index.html        # Imports kernel.js only
        └── maia/
            ├── todo.actor.maia
            ├── todo.state.maia
            ├── todo.view.maia
            ├── brand.style.maia
            └── todo.style.maia
```

## 🚀 Quick Start

### Running the Example

```bash
# From maia-script package root
cd libs/maia-script
bun serve

# Or manually from src directory
cd src
python3 -m http.server 4200

# Open http://localhost:4200/examples/todos
```

### Try the Features

1. **Add Todos** - Input field with Enter key support
2. **Toggle Done** - Click checkmark to toggle state
3. **Delete Todos** - Click X to delete
4. **Drag & Drop** - Kanban view with drag-and-drop
5. **View Switcher** - Toggle between List and Kanban
6. **Modal** - Click "Open Modal" button

**All actions now flow through the state machine!**

## 🔧 Core Concepts

### 1. State Machines (`.state.maia`)

Define states, transitions, and tool invocations:

```json
{
  "$type": "state",
  "$id": "state_todo_001",
  "initial": "idle",
  "states": {
    "idle": {
      "on": {
        "CREATE_TODO": {
          "target": "creating",
          "guard": { "$ne": ["$newTodoText", ""] }
        }
      }
    },
    "creating": {
      "entry": {
        "tool": "@core/createTodo",
        "payload": { "text": "$newTodoText" }
      },
      "on": {
        "SUCCESS": "idle",
        "ERROR": "error"
      }
    }
  }
}
```

**Key Features:**
- **Guards**: Conditional transitions (`$ne`, `$eq`, etc.)
- **Entry/Exit Actions**: Run tools on state enter/exit
- **Implicit Tool Invocation**: Declare tool name, engine executes
- **Error Handling**: SUCCESS/ERROR events for tool results

### 2. AI-Compatible Tools (`.tool.maia` + `.tool.js`)

**Definition (`.tool.maia`)**:
```json
{
  "$type": "tool",
  "$id": "tool_createTodo_001",
  "name": "@core/createTodo",
  "description": "Creates a new todo item",
  "parameters": {
    "type": "object",
    "properties": {
      "text": {
        "type": "string",
        "description": "The todo text"
      }
    },
    "required": ["text"]
  }
}
```

**Function (`.tool.js`)**:
```javascript
export default {
  async execute(actor, payload) {
    const newTodo = {
      id: Date.now().toString(),
      text: payload.text,
      done: false
    };
    actor.context.todos.push(newTodo);
    actor.context.newTodoText = '';
  }
};
```

**Benefits for AI:**
- JSON Schema for LLM tool schemas
- Colocated definition + implementation
- Automatic payload validation
- Self-documenting interfaces

### 3. Actor Message Passing

**Actor Definition:**
```json
{
  "$type": "actor",
  "$id": "actor_todo_001",
  "role": "todo-manager",
  "stateRef": "state_todo_001",
  "context": { ... },
  "inbox": [],
  "subscriptions": [],
  "inboxWatermark": 0
}
```

**Message Flow:**
```
Actor A                    Actor B
   |                          |
   |--- Publish Message ----->| (inbox)
   |                          |
   |                          |--- Process Message
   |                          |--- Update State
   |                          |--- Send Event to State Machine
```

**API:**
```javascript
// Send message to actor
actorEngine.sendMessage('actor_b_id', {
  type: 'TODO_CREATED',
  payload: { todoId: '123' },
  from: 'actor_a_id',
  timestamp: Date.now()
});

// Subscribe actor B to actor A's messages
actorEngine.subscribe('actor_b_id', 'actor_a_id');

// Publish to all subscriptions
actorEngine.publishToSubscriptions('actor_a_id', {
  type: 'TODO_CREATED',
  payload: { todoId: '123' }
});
```

### 4. DSL Syntax (v0.2)

**Simplified Syntax:**
- `$key` → `context.key` (implicit context - most common)
- `$$key` → `item.key` (explicit item with double-dollar)

**Examples:**
```json
{
  "text": "$title",              // context.title
  "value": "$newTodoText",       // context.newTodoText
  "text": "$$text",             // item.text (in foreach)
  "id": "$$id",                 // item.id (in foreach)
  "guard": { "$ne": ["$newTodoText", ""] }
}
```

**Benefits:**
- Shorter and cleaner than `{ "$context": "key" }`
- `$$` visually signals "iteration item"
- Consistent across all DSL contexts

### 5. View Event System

**Old (v0.1):**
```json
{
  "tag": "button",
  "$on": {
    "click": {
      "action": "@core/createTodo",
      "payload": { "text": "$newTodoText" }
    }
  }
}
```

**New (v0.2):**
```json
{
  "tag": "button",
  "$on": {
    "click": {
      "send": "CREATE_TODO",
      "payload": { "text": "$newTodoText" }
    }
  }
}
```

**Flow:**
```
View Event → send("CREATE_TODO") → State Machine → Tool Invocation → SUCCESS/ERROR
```

## 🏗️ Architecture Diagrams

### State Machine Flow

```
┌─────────────┐
│    View     │
│  (UI Event) │
└──────┬──────┘
       │ send("CREATE_TODO")
       ▼
┌─────────────────┐
│ State Machine   │
│  current: idle  │
└──────┬──────────┘
       │ transition to "creating"
       ▼
┌─────────────────┐
│ Entry Action    │
│ invoke tool     │
└──────┬──────────┘
       │ @core/createTodo
       ▼
┌─────────────────┐
│  Tool Engine    │
│  execute()      │
└──────┬──────────┘
       │ SUCCESS/ERROR
       ▼
┌─────────────────┐
│ State Machine   │
│ current: idle   │
└─────────────────┘
```

### Actor Communication

```
┌─────────────┐         ┌─────────────┐
│  Actor A    │         │  Actor B    │
│  (Publisher)│         │ (Subscriber)│
└──────┬──────┘         └──────┬──────┘
       │                       │
       │ publishToSubscriptions│
       │───────────────────────>│ inbox.push(message)
       │                       │
       │                       │ processMessages()
       │                       │
       │                       │ stateEngine.send()
       │                       │
       │                       │ ToolEngine.execute()
       │                       │
       │                       ▼
       │                  ┌─────────┐
       │                  │ Updated │
       │                  │  State  │
       │                  └─────────┘
```

## 🤖 AI Agent Patterns

### Pattern 1: Service Layer Actor

```json
{
  "$type": "actor",
  "role": "sync-service",
  "stateRef": "state_sync",
  "context": {
    "status": "idle",
    "lastSync": null
  },
  "inbox": [],
  "subscriptions": ["actor_data_manager"]
}
```

**State Machine:**
```json
{
  "states": {
    "idle": {
      "on": {
        "START_SYNC": "syncing"
      }
    },
    "syncing": {
      "entry": {
        "tool": "@sync/fetchData"
      },
      "on": {
        "SUCCESS": "idle",
        "ERROR": "error"
      }
    }
  }
}
```

### Pattern 2: Coordinated Multi-Actor

```
Todo Manager (Actor A)         Notification Service (Actor B)
      │                                    │
      │ CREATE_TODO                        │
      │─────────────────>                  │
      │                                    │
      │ Publish: TODO_CREATED              │
      │────────────────────────────────────>│
      │                                    │ Display notification
      │                                    │ (reads message.payload)
```

### Pattern 3: LLM Tool Invocation

**LLM generates:**
```json
{
  "tool": "@core/createTodo",
  "arguments": {
    "text": "Buy groceries"
  }
}
```

**Mapping:**
```javascript
// Tool definition provides schema for LLM
const toolSchema = toolEngine.getToolDefinition('@core/createTodo');
// → Returns .tool.maia definition (JSON Schema compatible)

// Execute tool
await toolEngine.execute('@core/createTodo', actor, { text: 'Buy groceries' });
```

## 📊 Migration from v0.1

### DSL Syntax Changes

| v0.1 | v0.2 |
|------|------|
| `$item.text` | `$$text` |
| `{ "$context": "title" }` | `$title` |
| `action: "@core/createTodo"` | `send: "CREATE_TODO"` |

### Architecture Changes

| Component | v0.1 | v0.2 |
|-----------|------|------|
| Event Handling | Direct tool calls | State machine events |
| Tools | Module registry | `.tool.maia` files |
| Actor Communication | None | Inbox/subscriptions |
| State Management | Manual | State machines |

## 🔍 Debugging

### Console Inspection

```javascript
// Access engines globally
window.MaiaOS.stateEngine
window.MaiaOS.toolEngine
window.MaiaOS.actorEngine

// Get actor state
const actor = window.MaiaOS.actorEngine.getActor('actor_todo_001');
console.log('Current state:', actor.machine.currentState);
console.log('Context:', actor.context);
console.log('Inbox:', actor.inbox);

// Send test event
window.MaiaOS.stateEngine.send(actor.machine.id, 'CREATE_TODO', { text: 'Test' });

// View registered tools
console.log(window.MaiaOS.toolEngine.getAllTools());
```

### State Machine History

```javascript
const machine = actor.machine;
console.log('Transition history:', machine.history);
// → [{ from: 'idle', to: 'creating', event: 'CREATE_TODO', timestamp: 1234567890 }]
```

## 🎓 Next Steps

1. **Add More Actors**: Create notification, sync, or analytics actors
2. **Inter-Actor Communication**: Use message passing for coordination
3. **LLM Integration**: Map tools to LLM schemas and let AI control actors
4. **Persistent Storage**: Replace in-memory state with Jazz CoMaps
5. **Advanced State Machines**: Add nested states, parallel states, history states

## 📚 File Reference

### Essential Files

- **kernel.js** (130 lines) - Single entry point (NEW)
- **StateEngine.js** (390 lines) - State machine interpreter
- **ToolEngine.js** (180 lines) - Tool execution system
- **ActorEngine.js** (270 lines) - Actor lifecycle + messaging
- **ViewEngine.js** (310 lines) - View rendering + events
- **MaiaScriptEvaluator.js** (140 lines) - DSL evaluator

### Example Files

- **todo.state.maia** - Complete state machine for todo operations
- **todo.actor.maia** - Actor with state machine and messaging
- **todo.view.maia** - View with send() events
- **../tools/*.tool.maia** - 12 tool definitions (AI-compatible, system layer)
- **../tools/*.tool.js** - 12 tool functions (generic registry)

## 🎯 Design Principles

1. **AI-First**: All interfaces designed for LLM consumption
2. **Declarative**: State machines and tools defined in JSON
3. **Observable**: State is always inspectable and predictable
4. **Composable**: Actors are self-contained, reusable units
5. **Type-Safe**: JSON Schema for validation and documentation

## 🚦 Performance

- **Smart Rerendering**: Input events don't trigger rerenders
- **Tool Caching**: Tool definitions cached after first load
- **State Machine**: O(1) state lookups and transitions
- **Message Processing**: Watermark pattern prevents replay (O(1))

## 🤝 Contributing

v0.2 is a prototype for architectural validation. Future improvements:
- Nested/parallel state machines
- State machine visualization
- Tool composition (tool → tool chains)
- Advanced guards (async guards, context guards)
- State persistence (Jazz integration)

---

**Built with ❤️ as foundational architecture for AI agent coordination in MaiaOS.**
