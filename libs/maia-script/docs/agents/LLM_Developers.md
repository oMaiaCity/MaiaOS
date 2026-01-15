# MaiaOS Documentation for Developers

**Auto-generated:** 2026-01-15T13:05:37.274Z
**Purpose:** Complete context for LLM agents working with MaiaOS

---

# CONCEPT

*Source: getting-started/01_concept.md*

# MaiaOS Concept

**Version:** 0.4  
**Last Updated:** January 2026

## What is MaiaOS?

MaiaOS is a **100% runtime-based, AI-LLM native platform** for building AI-composable applications. It's a declarative operating system where everything is defined in JSON, executed by engines, and orchestrated by AI agents.

## Core Philosophy

### Pure Declarative Runtime

**Everything is JSON:**
- No JavaScript in your app code
- No compiled bundles
- No build steps
- Pure `.maia` files loaded at runtime

**Example Actor:**
```json
{
  "$type": "actor",
  "id": "actor_todo_001",
  "contextRef": "todo",
  "stateRef": "todo",
  "viewRef": "todo"
}
```

That's it. No classes, no functions, no imports. Just references.

### AI-LLM Native

**Built for AI Orchestration:**
- LLMs can read and generate `.maia` files natively (they're just JSON)
- Skills provide AI-readable interface specifications
- State machines are AI-compatible event flows
- Tools are defined with JSON schemas (LLM-friendly)

**Why This Matters:**
- AI agents can build entire apps by generating `.maia` files
- No code generation → No syntax errors
- LLMs understand the structure perfectly
- Agents can modify apps at runtime

### 100% Runtime-Based

**No Build Process:**
```
Traditional:  Write Code → Compile → Bundle → Deploy → Run
MaiaOS:       Write .maia → Run
```

**Hot Runtime Reload Everything:**
- Change a view → Instant update
- Modify state machine → Instant update
- Update styles → Instant update
- No webpack, no vite, no build tools

**How It Works:**
1. Browser loads `kernel.js` (single entry point)
2. Kernel loads `.maia` files via `fetch()`
3. Engines interpret and execute
4. Shadow DOM renders isolated UI
5. Done!

## Three-Layer Architecture

### 1. Definition Layer (What to Do)

**Pure JSON definitions:**
- `actor.maia` - Component identity and references
- `context.maia` - Initial runtime data
- `state.maia` - Behavior flow (state machine)
- `view.maia` - UI structure
- `style.maia` - Appearance
- `skill.maia` - AI agent interface

**No logic, just configuration.**

### 2. Execution Layer (How to Do It)

**JavaScript engines interpret definitions:**
- `ActorEngine` - Orchestrates actors
- `StateEngine` - Executes state machines
- `ViewEngine` - Renders views
- `ToolEngine` - Executes actions
- `StyleEngine` - Compiles styles

**Logic lives here, not in your app.**

### 3. Intelligence Layer (Why & When to Do It)

**AI agents orchestrate via skills:**
- Skills describe actor capabilities
- LLMs read skills to understand what's possible
- Agents generate events based on user intent
- System executes via state machines

**AI decides, engines execute.**

## Why MaiaOS?

### For Vibecreators (App Builders)

✅ **No JavaScript Required** - Pure JSON definitions  
✅ **Instant Hot Reload** - No build process  
✅ **AI-Assisted Development** - LLMs understand `.maia` files  
✅ **Component Isolation** - Shadow DOM per actor  
✅ **Declarative Everything** - Views, state, styles  

### For AI Agents

✅ **Native JSON** - No code generation needed  
✅ **Schema-Defined** - Every tool has JSON schema  
✅ **Discoverable** - Skills describe capabilities  
✅ **Composable** - Mix and match actors  
✅ **Predictable** - State machines are explicit  

### For Developers (Core Contributors)

✅ **Modular Architecture** - Pluggable engines  
✅ **Schema-Agnostic Tools** - Generic CRUD  
✅ **Clean Separation** - Definition vs. execution  
✅ **Extensible** - Add engines, tools, modules  
✅ **Type-Safe** - JSON schemas validate everything  

## Real-World Example

**Traditional React Todo:**
```jsx
// TodoApp.jsx (100+ lines of JavaScript)
import React, { useState } from 'react';
import './TodoApp.css';

function TodoApp() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState('');
  
  const addTodo = () => {
    setTodos([...todos, { id: Date.now(), text: input, done: false }]);
    setInput('');
  };
  
  // ... more code ...
}
```

**MaiaOS Todo:**
```json
// todo.actor.maia (14 lines of JSON)
{
  "$type": "actor",
  "contextRef": "todo",
  "stateRef": "todo",
  "viewRef": "todo"
}
```

That's the entire actor. Context, state, and view are separate files. No JavaScript. No build. Just JSON.

## Service/UI Actor Architecture

MaiaOS uses a **service actor / UI actor** pattern for building applications:

**Service Actors** (orchestration):
- Entry point for every vibe
- Handle business logic and data management
- Coordinate between UI actors
- Minimal or no view (only render child actors)

**UI Actors** (presentation):
- Render user interfaces
- Handle user interactions
- Receive data/configurations from service actors
- Send generic events to service actors

**Default Pattern:**
```
Vibe → Service Actor → Composite Actor → UI Actors
```

This ensures clean separation of concerns and scalable architecture. See [Actors Documentation](../vibecreators/02-actors.md#default-vibe-pattern-service--composite--ui) for details.

## Key Differentiators

### vs. Traditional Frameworks (React, Vue, Svelte)

| Feature | Traditional | MaiaOS |
|---------|-------------|--------|
| Language | JavaScript/TypeScript | JSON |
| Build Process | Required | None |
| Hot Reload | Via bundler | Native |
| AI Generation | Code (error-prone) | JSON (perfect) |
| Component Isolation | CSS Modules | Shadow DOM |
| State Management | Library (Redux, etc.) | Built-in (State Machines) |

### vs. Low-Code Platforms (Bubble, Webflow)

| Feature | Low-Code | MaiaOS |
|---------|----------|--------|
| Editing | Visual GUI | Text (`.maia` files) |
| Version Control | Proprietary | Git |
| AI Integration | Limited | Native |
| Extensibility | Plugins | Engines + Tools |
| Lock-in | Platform | Open source |

### vs. Backend Frameworks (Rails, Django)

MaiaOS is **frontend-first** but with backend patterns:
- State machines (like backend workflows)
- Tools (like backend services)
- Actors (like backend models)
- But all in the browser, no server required

## The MaiaOS Promise

> **Build AI-native applications with zero JavaScript, zero build process, and 100% runtime flexibility.**

**What This Means:**
1. **Vibecreators** define apps in JSON
2. **Engines** execute definitions
3. **AI Agents** orchestrate via skills
4. **Users** get instant, reactive UIs

**No compilation. No bundling. No build tools. Just pure, declarative, AI-native applications.**

## Next Steps

- [Terminology](./02_terminology.md) - Understand the key concepts
- [Architecture](./03_architecture.md) - Deep dive into system design
- [Installation](./04_install.md) - Get started building

---

# TERMINOLOGY

*Source: getting-started/02_terminology.md*

# MaiaOS Terminology

**Quick reference glossary of all MaiaOS concepts.**

## Core Concepts

### MaiaOS
The operating system itself. A runtime-based, AI-native platform for building declarative applications. Think of it as "an OS for apps" that runs in the browser.

### Kernel
The single entry point (`o/kernel.js`). Boots the system, loads modules, initializes engines, and creates actors. One file to rule them all.

### MaiaScript
The JSON-based DSL (Domain Specific Language) for defining actors, views, states, styles, and tools. Pure declarative syntax with expressions like `$context`, `$$item`, `@inputValue`.

---

## Definition Layer (Declarative)

### Actor
A pure declarative specification (`.actor.maia`) that references other components. Contains zero logic - just IDs and references. Think: "component configuration file."

**Example:**
```json
{
  "$type": "actor",
  "contextRef": "todo",
  "stateRef": "todo",
  "viewRef": "todo"
}
```

### Context
Runtime data for an actor (`.context.maia`). All state lives here: collections, UI state, form values, etc. Can be inline or separate file.

**Example:**
```json
{
  "$type": "context",
  "todos": [],
  "newTodoText": "",
  "viewMode": "list"
}
```

### State Machine
Behavior flow definition (`.state.maia`). XState-like state machine with states, transitions, guards, and actions. Defines WHAT happens WHEN.

**Example:**
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

### View
UI structure definition (`.view.maia`). Declarative DOM tree with expressions, loops, conditionals, and event handlers. Renders to Shadow DOM.

**Example:**
```json
{
  "$type": "view",
  "root": {
    "tag": "div",
    "text": "$title",
    "children": [...]
  }
}
```

### Style
Appearance definition (`.style.maia`). Design tokens + component styles. Compiles to CSS and injects into Shadow DOM.

**Types:**
- **Brand** (`brand.style.maia`) - Shared design system
- **Local** (`actor.style.maia`) - Actor-specific overrides

### Skill
AI agent interface specification (`.skill.maia`). Describes actor capabilities, events, context schema, and usage patterns for LLM orchestration.

**Example:**
```json
{
  "$type": "skill",
  "actorType": "todo",
  "capabilities": {
    "taskManagement": "Create, complete, delete todos"
  },
  "stateEvents": {...}
}
```

---

## Execution Layer (Imperative)

### Engine
JavaScript execution machinery that interprets definitions. Engines contain all the logic - definitions contain none.

**Core Engines:**
- **ActorEngine** - Orchestrates actors, manages lifecycle
- **StateEngine** - Interprets state machines, executes transitions
- **ViewEngine** - Renders views to Shadow DOM
- **ToolEngine** - Executes tool actions
- **StyleEngine** - Compiles styles to CSS
- **MaiaScriptEvaluator** - Evaluates DSL expressions

### Tool
An executable function (`.tool.js` + `.tool.maia`). The ONLY place imperative code lives. Tools mutate actor context based on payloads.

**Structure:**
- `.tool.maia` - JSON schema (AI-compatible metadata)
- `.tool.js` - JavaScript function (execution logic)

**Example:**
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

### Module
A collection of related tools (`.module.js`). Modules register tools with the ToolEngine at boot time.

**Built-in Modules:**
- `@core/*` - UI utilities (modals, view modes)
- `@mutation/*` - Generic CRUD (create, update, delete, toggle)
- `@dragdrop/*` - Drag-and-drop handlers
- `@context/*` - Context manipulation

### Module Registry
Central plugin system for dynamic module loading. Manages module lifecycle and tool registration.

---

## Intelligence Layer (AI Orchestration)

### Vibecreator
A person who builds MaiaOS applications. Writes `.maia` files, composes actors, defines behaviors. No JavaScript required.

### Agent / LLM
AI assistant (ChatGPT, Claude, Cursor, etc.) that reads skills and generates events. Orchestrates actors based on user intent.

### Skill Engine
(v0.5) Engine that manages skill discovery and interpretation for AI agents. Enables LLM-driven app orchestration.

---

## Data Flow Concepts

### Event
A message sent to a state machine to trigger a transition. Events have a name and optional payload.

**Example:**
```json
{
  "send": "CREATE_TODO",
  "payload": { "text": "$newTodoText" }
}
```

### Payload
Data passed with an event. Can contain expressions that are evaluated at runtime.

**Expression Types:**
- `$field` - Context reference (`actor.context.field`)
- `$$field` - Item reference (in loops: `item.field`)
- `@inputValue` - DOM value reference (`input.value`)

### Guard
A condition that determines if a transition should occur. Evaluated before state change.

**Example:**
```json
{
  "guard": { "$ne": ["$newTodoText", ""] }
}
```

### Transition
Moving from one state to another in response to an event. Can have guards and actions.

### Action
A tool invocation or context update. Executed during state transitions (entry/exit/inline).

---

## UI Concepts

### Shadow DOM
Browser-native encapsulation. Each actor renders into its own shadow root with isolated styles and DOM.

**Benefits:**
- Style isolation (no CSS leakage)
- DOM encapsulation
- Multiple instances without conflicts

### Constructable Stylesheet
Modern CSS API for efficient style sharing. Brand styles compiled once, adopted by all actors.

### Component
In MaiaOS, "component" = "actor". Reusable, isolated, self-contained unit with state, view, and behavior.

---

## Architectural Patterns

### Schema-Agnostic
Tools don't know about specific data types. They work with generic `schema` and `data` parameters.

**Example:**
```javascript
@mutation/create { schema: "todos", data: {...} }
@mutation/create { schema: "notes", data: {...} }
```

Same tool, different schema. Zero hardcoded domain knowledge.

### Message Passing
Actors communicate asynchronously via inboxes and subscriptions. Watermark pattern for processing.

**Properties:**
- `inbox` - Message queue
- `subscriptions` - Actors to receive messages from
- `inboxWatermark` - Last processed message index

### Modular Architecture
Everything is a plugin. Engines are pluggable, tools are modular, modules are dynamic.

---

## File Conventions

### `.maia` Extension
All MaiaOS definition files use `.maia` extension. JSON format with `$type` discriminator.

**Types:**
- `actor.maia` - Actor definition
- `context.maia` - Runtime data
- `state.maia` - State machine
- `view.maia` - UI structure
- `style.maia` - Styling
- `skill.maia` - AI interface
- `tool.maia` - Tool metadata

### Naming Pattern
`{name}.{type}.maia`

**Examples:**
- `todo.actor.maia`
- `todo.context.maia`
- `todo.state.maia`
- `brand.style.maia`

### CoMap ID (Future)
Fake IDs used for Jazz integration. Currently maps to filenames, will map to Jazz CoMaps in v0.5.

**Example:**
```json
{
  "viewRef": "co_view_001"  // Maps to: todo.view.maia
}
```

---

## Development Concepts

### Hot Reload
Automatic browser refresh on file changes. No build process, instant updates.

### Watch Mode
Scripts that monitor file changes and regenerate outputs (e.g., LLM docs).

### Vibecreators Docs
User-facing documentation for app builders. Located in `docs/vibecreators/`.

### Developers Docs
Technical documentation for core contributors. Located in `docs/developers/`.

### LLM Docs
Auto-generated, context-optimized documentation for AI agents. Located in `docs/agents/`.

---

## Quick Reference

| Term | Type | Purpose |
|------|------|---------|
| **Actor** | Definition | Component configuration |
| **Context** | Definition | Runtime data |
| **State** | Definition | Behavior flow |
| **View** | Definition | UI structure |
| **Style** | Definition | Appearance |
| **Skill** | Definition | AI interface |
| **Engine** | Execution | Interprets definitions |
| **Tool** | Execution | Executes actions |
| **Module** | Execution | Groups tools |
| **Event** | Data Flow | Triggers transitions |
| **Payload** | Data Flow | Event data |
| **Guard** | Data Flow | Transition condition |

---

## Next Steps

- [Architecture](./03_architecture.md) - System design deep dive
- [Installation](./04_install.md) - Get started building

---

# ARCHITECTURE

*Source: getting-started/03_architecture.md*

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

---

# INSTALL

*Source: getting-started/04_install.md*

# Installation & Quick Start

**Get MaiaOS running in under 5 minutes.**

## Prerequisites

**Required:**
- Modern browser (Chrome, Firefox, Safari, Edge)
- Local web server (for ES modules)
- Bun (for development with hot reload)
- Git (for cloning the repository)

## Quick Start

###  Clone the Repository

```bash
# Clone
git clone https://github.com/oMaiaCity/MaiaOS.git
cd MaiaOS/libs/maia-script

# Install dependencies
bun install

# Start dev server with hot reload
bun dev

# Open browser
open http://localhost:4200/
```

## File Structure

Create your first actor:

```
my-app/
├── index.html              # Entry point (see above)
├── todo.actor.maia         # Actor definition
├── todo.context.maia       # Runtime data
├── todo.state.maia         # State machine
├── todo.view.maia          # UI structure
└── brand.style.maia        # Design system
```

### Minimal Actor

**`todo.actor.maia`:**
```json
{
  "$type": "actor",
  "$id": "actor_todo_001",
  "id": "actor_todo_001",
  "contextRef": "todo",
  "stateRef": "todo",
  "viewRef": "todo",
  "styleRef": "brand"
}
```

**`todo.context.maia`:**
```json
{
  "$type": "context",
  "$id": "context_todo_001",
  "todos": [],
  "newTodoText": ""
}
```

**`todo.state.maia`:**
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
        "tool": "@mutation/create",
        "payload": {
          "schema": "todos",
          "data": { "text": "$newTodoText", "done": false }
        }
      },
      "on": {
        "SUCCESS": "idle",
        "ERROR": "error"
      }
    },
    "error": {
      "on": {
        "RETRY": "idle"
      }
    }
  }
}
```

**`todo.view.maia`:**
```json
{
  "$type": "view",
  "$id": "view_todo_001",
  "root": {
    "tag": "div",
    "attrs": { "class": "todo-app" },
    "children": [
      {
        "tag": "h1",
        "text": "My Todos"
      },
      {
        "tag": "input",
        "attrs": {
          "type": "text",
          "placeholder": "What needs to be done?"
        },
        "value": "$newTodoText",
        "$on": {
          "input": {
            "send": "UPDATE_INPUT",
            "payload": { "newTodoText": "@inputValue" }
          },
          "keydown": {
            "send": "CREATE_TODO",
            "key": "Enter"
          }
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
      },
      {
        "tag": "ul",
        "$each": {
          "items": "$todos",
          "template": {
            "tag": "li",
            "text": "$$text"
          }
        }
      }
    ]
  }
}
```

**`brand.style.maia`:**
```json
{
  "$type": "brand.style",
  "$id": "brand_001",
  "tokens": {
    "colors": {
      "primary": "#3b82f6",
      "background": "#ffffff",
      "text": "#1f2937"
    },
    "spacing": {
      "sm": "0.5rem",
      "md": "1rem",
      "lg": "1.5rem"
    }
  },
  "components": {
    "todo-app": {
      "padding": "{spacing.lg}",
      "maxWidth": "600px",
      "margin": "0 auto"
    },
    "button": {
      "padding": "{spacing.sm} {spacing.md}",
      "background": "{colors.primary}",
      "color": "white",
      "border": "none",
      "borderRadius": "0.25rem",
      "cursor": "pointer"
    },
    "input": {
      "padding": "{spacing.sm}",
      "border": "1px solid #e5e7eb",
      "borderRadius": "0.25rem",
      "width": "100%"
    }
  }
}
```



## Next Steps

- [Vibecreators Docs](../vibecreators/) - Learn to build apps
- [Examples](../../examples/todos/) - See complete working app
- [Developers Docs](../developers/) - Extend MaiaOS core

## Resources

- **Examples:** `libs/maia-script/src/examples/todos/`
- **Kernel:** `libs/maia-script/src/o/kernel.js`
- **Tools:** `libs/maia-script/src/o/tools/`
- **Docs:** `libs/maia-script/src/docs/`

## Support

- GitHub Issues: [Report bugs](https://github.com/oMaiaCity/MaiaOS/issues)

---

# COMPOSITION

*Source: developers/composition.md*

# Actor Composition (Developer Guide)

**For developers** who want to understand how composite/leaf actor patterns work in MaiaOS.

## Overview

MaiaOS supports **composable actor architecture** where actors can be composed hierarchically:
- **Composite Actors**: Container actors with slots for child actors
- **Leaf Actors**: Terminal actors that render UI or perform tasks
- **Pure Message Passing**: All actor-to-actor communication via inbox/subscriptions

## Composite vs Leaf Views

### Leaf View

A **leaf view** has a `root` property and renders directly to DOM:

```json
{
  "$type": "view",
  "root": {
    "tag": "div",
    "text": "$title"
  }
}
```

**Characteristics:**
- Has `root` property (not `container`)
- Renders directly to Shadow DOM
- No slots or child actors
- Terminal in composition tree

### Composite View

A **composite view** has a `container` property with slots:

```json
{
  "$type": "view",
  "container": {
    "tag": "div",
    "class": "dashboard",
    "slots": {
      "header": "@header",
      "content": "@content",
      "sidebar": "@sidebar"
    }
  }
}
```

**Characteristics:**
- Has `container` property (not `root`)
- Defines slots using `@slotName` syntax
- Child actors fill slots
- Can nest composite → composite → leaf

## Slot Resolution

Slots use `@slotName` syntax to reference child actors:

```json
{
  "container": {
    "slots": {
      "header": "@header",      // Resolves to children.header actor ID
      "content": "@content"      // Resolves to children.content actor ID
    }
  }
}
```

**Resolution Process:**
1. ViewEngine detects `@slotName` reference
2. Looks up `actor.config.children[slotName]` to get child actor ID
3. Renders child actor's Shadow DOM root into slot position
4. Recursively renders nested composites

## Actor Children Map

Actors define children in their `.actor.maia` file:

```json
{
  "$type": "actor",
  "$id": "actor_dashboard_001",
  "children": {
    "header": "actor_header_001",
    "content": "actor_content_001"
  }
}
```

**Key Points:**
- `children` is a map: `slotName → actorId`
- Child actors are created recursively before parent renders
- Parent auto-subscribes to all children
- Children maintain their own Shadow DOM (isolated)

## ViewEngine Composite Rendering

**Flow:**
1. `ViewEngine.render()` detects composite vs leaf
2. Composite: calls `renderComposite()` with container definition
3. For each slot:
   - Resolves `@slotName` to child actor ID
   - Gets child actor instance
   - Clones child's Shadow DOM root into slot
4. Leaf: calls `renderNode()` normally

**Code Reference:**
- `ViewEngine._isCompositeView()` - Detects view type
- `ViewEngine._resolveSlot()` - Resolves `@slotName` to actor ID
- `ViewEngine.renderComposite()` - Renders container with slots

## ActorEngine Child Creation

**Flow:**
1. `ActorEngine.createActor()` checks for `config.children`
2. For each child:
   - Resolves actor ID to filename
   - Loads child actor config
   - Creates child container element
   - Recursively calls `createActor()` for child
   - Stores child reference in `actor.children[slotName]`
   - Auto-subscribes parent to child

**Code Reference:**
- `ActorEngine.resolveActorIdToFilename()` - Maps actor ID to file
- `ActorEngine.createActor()` - Recursive child creation

## Message Passing Between Actors

**Parent → Child:**
- Parent publishes message via `publishMessage()`
- Message validated against parent's `interface.publishes`
- Sent to all actors in parent's `subscriptions` list
- Child receives in inbox, validated against `interface.inbox`

**Child → Parent:**
- Child publishes message
- Parent receives in inbox (if subscribed)
- Parent's state machine processes message

**Example:**
```javascript
// Child actor publishes TODO_CREATED
actorEngine.publishMessage('actor_todo_input_001', 'TODO_CREATED', {
  id: 'todo_123',
  text: 'New todo'
});

// Parent receives in inbox
// Parent's state machine processes TODO_CREATED event
```

## Interface Validation

**Outgoing Messages (Publishes):**
- Validated against `interface.publishes` schema
- Rejected if message type not defined
- Rejected if payload structure doesn't match

**Incoming Messages (Inbox):**
- Validated against `interface.inbox` schema
- Rejected if message type not defined
- Rejected if payload structure doesn't match

**Validation Code:**
- `ActorEngine._validateMessage()` - Validates message against interface
- `ActorEngine.publishToSubscriptions()` - Validates before publishing
- `ActorEngine.sendMessage()` - Validates before adding to inbox

## Recursive Composition

Composite actors can contain other composite actors:

```
vibe_root (composite)
├── @header (view_switcher - leaf)
├── @list (todo_list - composite)
│   └── @item (todo_item - leaf, repeated)
└── @kanban (kanban_view - leaf)
```

**Rendering Order:**
1. Create `vibe_root` actor
2. Create `view_switcher` child → render leaf
3. Create `todo_list` child → render composite
4. Create `todo_item` children → render leaves (repeated)
5. Create `kanban_view` child → render leaf
6. Render `vibe_root` composite with all slots filled

## Best Practices

**✅ DO:**
- Use composite views for layout containers
- Use leaf views for terminal UI components
- Define clear interfaces for message contracts
- Keep children isolated (own Shadow DOM)
- Use descriptive slot names

**❌ DON'T:**
- Don't expose context directly (use message passing)
- Don't create circular child dependencies
- Don't skip interface definitions
- Don't use prop drilling (use messages)

## Future: Jazz CoMap Integration

When migrating to Jazz-native architecture:
- Each actor becomes a CoMap
- `children` map stored in CoMap
- `inbox` becomes CoFeed
- `subscriptions` becomes CoList
- Context dynamically queried (not stored)

**Migration Path:**
- Current: File-based actor definitions
- Future: CoMap-based actor definitions
- Interface validation remains the same
- Message passing becomes CoFeed operations

---

# DSL

*Source: developers/dsl.md*

# DSL Guide (Developer)

**For developers** who want to extend MaiaScript DSL with new definition types and expression syntax.

## What is MaiaScript DSL?

**MaiaScript** is a declarative JSON-based language for defining actors, state machines, views, styles, tools, and skills. It's designed to be:

- ✅ **Human-readable** - JSON with clear semantics
- ✅ **AI-compatible** - LLMs can read and generate it
- ✅ **Schema-validated** - Type-safe definitions validated against JSON Schema
- ✅ **Expression-rich** - Context references (`$`), item references (`$$`)

All MaiaScript files are automatically validated against JSON schemas when loaded. See [Schema System](./schemas.md) for details.

## DSL Types

### Core DSL Types

| Type | File Extension | Purpose | Engine |
|------|----------------|---------|--------|
| `actor` | `.actor.maia` | Actor definition | ActorEngine |
| `state` | `.state.maia` | State machine | StateEngine |
| `view` | `.view.maia` | UI structure | ViewEngine |
| `style` | `.style.maia` | Styling | StyleEngine |
| `tool` | `.tool.maia` | Tool metadata | ToolEngine |
| `skill` | `.skill.maia` | AI interface | SkillEngine (v0.5) |

## Expression Syntax

### Context References (`$`)

Access actor context fields:

```json
{
  "text": "$newTodoText",
  "mode": "$viewMode",
  "count": "$todos.length"
}
```

Evaluated by `MaiaScriptEvaluator`:

```javascript
evaluate(expression, data) {
  if (typeof expression === 'string' && expression.startsWith('$')) {
    const path = expression.slice(1);
    return this._resolvePath(data.context, path);
  }
  return expression;
}
```

### Item References (`$$`)

Access current item in `for` loops:

```json
{
  "for": "$todos",
  "forItem": "todo",
  "children": [
    {
      "text": "$$text",
      "data-id": "$$id"
    }
  ]
}
```

### Special Event References (`@`)

Access DOM event values:

```json
{
  "on": {
    "input": {
      "send": "UPDATE_INPUT",
      "payload": {
        "value": "@inputValue",     // input.value
        "checked": "@checked",       // input.checked
        "selectedValue": "@selectedValue"  // select.value
      }
    }
  }
}
```

## Creating a New DSL Type

### Example: Animation DSL

**Goal:** Define animations that can be applied to actors.

#### 1. Define DSL Schema

```json
{
  "$type": "animation",
  "$id": "anim_fade_in_001",
  "name": "fadeIn",
  
  "keyframes": {
    "0%": {
      "opacity": "0",
      "transform": "translateY(-10px)"
    },
    "100%": {
      "opacity": "1",
      "transform": "translateY(0)"
    }
  },
  
  "duration": "300ms",
  "easing": "ease-out",
  "fillMode": "forwards",
  
  "triggers": {
    "onEnter": true,
    "onStateChange": ["creating", "updating"]
  }
}
```

#### 2. Create Engine/Compiler

```javascript
// o/engines/AnimationEngine.js
export class AnimationEngine {
  constructor(evaluator) {
    this.evaluator = evaluator;
    this.animations = new Map();
    this.activeAnimations = new Map();
  }
  
  /**
   * Register animation definition
   */
  registerAnimation(animDef) {
    if (animDef.$type !== 'animation') {
      throw new Error('Invalid animation definition');
    }
    
    // Compile to CSS animation
    const css = this._compileToCSS(animDef);
    
    this.animations.set(animDef.$id, {
      definition: animDef,
      css,
      name: animDef.name
    });
    
    console.log(`✅ Registered animation: ${animDef.name}`);
  }
  
  /**
   * Apply animation to actor
   */
  applyAnimation(actor, animationId, target = 'root') {
    const animation = this.animations.get(animationId);
    if (!animation) {
      throw new Error(`Animation not found: ${animationId}`);
    }
    
    // Inject CSS into actor's Shadow DOM
    const shadowRoot = actor.container.shadowRoot;
    if (!shadowRoot) return;
    
    let styleElement = shadowRoot.querySelector('style[data-animations]');
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.setAttribute('data-animations', '');
      shadowRoot.appendChild(styleElement);
    }
    
    styleElement.textContent += animation.css;
    
    // Apply animation class to target element
    const targetElement = target === 'root'
      ? shadowRoot.querySelector(':host > *')
      : shadowRoot.querySelector(target);
    
    if (targetElement) {
      targetElement.style.animation = `${animation.name} ${animation.definition.duration} ${animation.definition.easing} ${animation.definition.fillMode}`;
      
      // Track active animation
      this.activeAnimations.set(`${actor.id}_${target}`, {
        actor,
        animation: animation.name,
        element: targetElement
      });
      
      // Remove after animation completes
      const duration = parseFloat(animation.definition.duration);
      setTimeout(() => {
        this.activeAnimations.delete(`${actor.id}_${target}`);
      }, duration);
    }
  }
  
  /**
   * Compile keyframes to CSS
   */
  _compileToCSS(animDef) {
    let css = `@keyframes ${animDef.name} {\n`;
    
    for (const [offset, props] of Object.entries(animDef.keyframes)) {
      css += `  ${offset} {\n`;
      for (const [prop, value] of Object.entries(props)) {
        const cssProperty = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        css += `    ${cssProperty}: ${value};\n`;
      }
      css += `  }\n`;
    }
    
    css += `}\n`;
    return css;
  }
  
  /**
   * Cleanup
   */
  destroyActorAnimations(actorId) {
    for (const [key, data] of this.activeAnimations) {
      if (key.startsWith(`${actorId}_`)) {
        data.element.style.animation = 'none';
        this.activeAnimations.delete(key);
      }
    }
  }
}
```

#### 3. Integrate with Kernel

```javascript
// o/kernel.js
import { AnimationEngine } from './engines/AnimationEngine.js';

export class MaiaOS {
  static async boot(config) {
    const os = {...};
    
    // Initialize animation engine
    os.animationEngine = new AnimationEngine(os.evaluator);
    
    return os;
  }
}
```

#### 4. Load Animations

```javascript
// o/engines/ActorEngine.js
async createActor(actorPath, container, os) {
  // ... load actor definition ...
  
  // Load animations if present
  if (actorDef.animationRefs) {
    for (const animRef of actorDef.animationRefs) {
      const animPath = `${basePath}/${animRef}.animation.maia`;
      const animDef = await this._loadJSON(animPath);
      os.animationEngine.registerAnimation(animDef);
      
      // Apply on enter if configured
      if (animDef.triggers?.onEnter) {
        os.animationEngine.applyAnimation(actor, animDef.$id);
      }
    }
  }
  
  // ... rest of actor creation ...
}
```

#### 5. Hook into State Changes

```javascript
// o/engines/StateEngine.js
async transition(machineId, event, payload) {
  // ... existing transition logic ...
  
  // Trigger animations on state change
  const machine = this.machines.get(machineId);
  const actor = this._getActorForMachine(machineId);
  
  if (actor && actor.animationRefs) {
    for (const animRef of actor.animationRefs) {
      const animDef = this.os.animationEngine.animations.get(animRef);
      if (animDef?.definition.triggers?.onStateChange?.includes(machine.currentState)) {
        this.os.animationEngine.applyAnimation(actor, animRef);
      }
    }
  }
}
```

#### 6. Usage

**`animations/fadeIn.animation.maia`:**
```json
{
  "$type": "animation",
  "$id": "anim_fade_in",
  "name": "fadeIn",
  "keyframes": {
    "0%": {"opacity": "0", "transform": "translateY(-10px)"},
    "100%": {"opacity": "1", "transform": "translateY(0)"}
  },
  "duration": "300ms",
  "easing": "ease-out",
  "fillMode": "forwards",
  "triggers": {
    "onEnter": true,
    "onStateChange": ["creating"]
  }
}
```

**`todo.actor.maia`:**
```json
{
  "$type": "actor",
  "id": "actor_todo_001",
  "stateRef": "todo",
  "viewRef": "todo",
  "animationRefs": ["fadeIn"],  // ← Load animation
  "context": {...}
}
```

## Extending Expression Syntax

### Adding Custom Operators

**Goal:** Add `#` prefix for computed properties.

#### 1. Update Evaluator

```javascript
// o/engines/MaiaScriptEvaluator.js
evaluate(expression, data = {}) {
  // Existing: $ for context
  if (typeof expression === 'string' && expression.startsWith('$')) {
    const path = expression.slice(1);
    return this._resolvePath(data.context || {}, path);
  }
  
  // Existing: $$ for item
  if (typeof expression === 'string' && expression.startsWith('$$')) {
    const path = expression.slice(2);
    return this._resolvePath(data.item || {}, path);
  }
  
  // NEW: # for computed properties
  if (typeof expression === 'string' && expression.startsWith('#')) {
    const computedName = expression.slice(1);
    return this._evaluateComputed(computedName, data.context);
  }
  
  // ... rest of evaluation ...
}

_evaluateComputed(name, context) {
  // Define computed properties
  const computed = {
    todosCount: () => context.todos?.length || 0,
    completedCount: () => context.todos?.filter(t => t.done).length || 0,
    progressPercent: () => {
      const total = context.todos?.length || 0;
      const completed = context.todos?.filter(t => t.done).length || 0;
      return total > 0 ? Math.round((completed / total) * 100) : 0;
    },
    now: () => Date.now(),
    today: () => new Date().toISOString().split('T')[0]
  };
  
  if (computed[name]) {
    return computed[name]();
  }
  
  throw new Error(`Unknown computed property: ${name}`);
}
```

#### 2. Usage

```json
{
  "tag": "p",
  "text": "You've completed #progressPercent% of your tasks"
}

{
  "tag": "span",
  "text": "#todosCount tasks remaining"
}

{
  "tag": "input",
  "attrs": {
    "value": "#today"
  }
}
```

### Adding Custom Guards

**Goal:** Add `$between` guard operator.

```javascript
// o/engines/StateEngine.js
_evaluateGuard(guard, context, eventPayload = {}) {
  // ... existing operators ...
  
  // NEW: $between operator
  if (guard.$between) {
    const [value, min, max] = guard.$between;
    const val = this.evaluator.evaluate(value, { context, item: eventPayload });
    const minVal = this.evaluator.evaluate(min, { context, item: eventPayload });
    const maxVal = this.evaluator.evaluate(max, { context, item: eventPayload });
    return val >= minVal && val <= maxVal;
  }
  
  // ... rest of guards ...
}
```

Usage:
```json
{
  "guard": {
    "$between": ["$age", 18, 65]
  }
}
```

## DSL Validation

### Schema Validation

```javascript
// o/validators/ActorValidator.js
export class ActorValidator {
  static validate(actorDef) {
    const errors = [];
    
    // Check required fields
    if (actorDef.$type !== 'actor') {
      errors.push('$type must be "actor"');
    }
    
    if (!actorDef.$id) {
      errors.push('$id is required');
    }
    
    if (!actorDef.id) {
      errors.push('id is required');
    }
    
    if (!actorDef.stateRef) {
      errors.push('stateRef is required');
    }
    
    if (!actorDef.context || typeof actorDef.context !== 'object') {
      errors.push('context must be an object');
    }
    
    // Check references
    if (actorDef.viewRef && typeof actorDef.viewRef !== 'string') {
      errors.push('viewRef must be a string');
    }
    
    if (actorDef.styleRef && typeof actorDef.styleRef !== 'string') {
      errors.push('styleRef must be a string');
    }
    
    if (errors.length > 0) {
      throw new Error(`Actor validation failed:\n${errors.join('\n')}`);
    }
    
    return true;
  }
}
```

### Runtime Validation

```javascript
// o/engines/ActorEngine.js
async createActor(actorPath, container, os) {
  const actorDef = await this._loadJSON(actorPath);
  
  // Validate before creating
  ActorValidator.validate(actorDef);
  
  // ... rest of actor creation ...
}
```

## DSL Best Practices

### ✅ DO:

- **Use JSON schemas** - Validate structure
- **Namespace types** - Use `$type` consistently
- **Document fields** - Add `description` properties
- **Version definitions** - Include version field
- **Keep declarative** - No functions or logic
- **Support expressions** - Use `$`, `$$`, `@` where appropriate

### ❌ DON'T:

- **Don't embed logic** - Keep definitions pure data
- **Don't use functions** - Not JSON-serializable
- **Don't create circular refs** - Will break serialization
- **Don't hardcode values** - Use context references
- **Don't skip validation** - Always validate inputs

## DSL Transformation

### Preprocessing DSL

```javascript
// o/transformers/DSLPreprocessor.js
export class DSLPreprocessor {
  /**
   * Transform shorthand syntax to full syntax
   */
  static transform(dsl) {
    if (dsl.$type === 'view') {
      return this._transformView(dsl);
    }
    if (dsl.$type === 'state') {
      return this._transformState(dsl);
    }
    return dsl;
  }
  
  static _transformView(viewDef) {
    // Transform shorthand: "text": "Hello" → "text": {"$eval": "Hello"}
    // (Example: add metadata for debugging)
    return this._transformElement(viewDef.root);
  }
  
  static _transformElement(element) {
    if (!element) return element;
    
    // Add source tracking
    element._source = {
      file: element.$source || 'unknown',
      line: element.$line || 0
    };
    
    // Transform children recursively
    if (element.children) {
      element.children = element.children.map(c => this._transformElement(c));
    }
    
    return element;
  }
}
```

### Compiling DSL to Another Format

```javascript
// o/compilers/ViewToReact.js
export class ViewToReact {
  /**
   * Compile MaiaScript view to React JSX
   */
  static compile(viewDef) {
    return this._compileElement(viewDef.root);
  }
  
  static _compileElement(element) {
    const { tag, attrs, text, children } = element;
    
    let jsx = `<${tag}`;
    
    // Add attributes
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        jsx += ` ${key}="${value}"`;
      }
    }
    
    jsx += '>';
    
    // Add text
    if (text) {
      jsx += text;
    }
    
    // Add children
    if (children) {
      jsx += children.map(c => this._compileElement(c)).join('\n');
    }
    
    jsx += `</${tag}>`;
    
    return jsx;
  }
}
```

## Next Steps

- Read [Engines Guide](./engines.md) - Creating custom engines
- Read [Tools Guide](./tools.md) - Creating tool modules
- Read [MaiaOS Guide](./maiaos.md) - Understanding the system
- Explore [VIBE Docs](../vibe/) - User-facing documentation

---

# ENGINES

*Source: developers/engines.md*

# Engines Guide (Developer)

**For developers** who want to create custom engines to extend MaiaOS capabilities.

## What Are Engines?

Engines are the **execution machinery** of MaiaOS. They interpret declarative definitions and execute imperative operations.

### Built-in Engines

| Engine | Purpose | Input | Output |
|--------|---------|-------|--------|
| `ActorEngine` | Actor lifecycle | Actor definitions | Running actors |
| `StateEngine` | State machines | State definitions + events | State transitions |
| `ViewEngine` | UI rendering | View definitions | Shadow DOM |
| `ToolEngine` | Action execution | Tool names + payloads | Side effects |
| `StyleEngine` | Style compilation | Style definitions | CSS |
| `ModuleRegistry` | Module loading | Module names | Registered modules |
| `MaiaScriptEvaluator` | Expression eval | DSL expressions | Evaluated values |

## Engine Architecture

### Core Responsibilities

1. **Interpret Definitions** - Parse and validate DSL using JSON schemas
2. **Execute Operations** - Perform imperative actions
3. **Manage State** - Track runtime state (not actor state!)
4. **Handle Errors** - Graceful failure and recovery
5. **Emit Events** - Notify other engines (if needed)

All engines automatically validate their input data against JSON schemas when loading definitions. See [Schema System](./schemas.md) for details.

### Engine Interface Pattern

```javascript
class CustomEngine {
  constructor(dependencies) {
    // Store dependencies (other engines, registries)
    this.evaluator = dependencies.evaluator;
    this.registry = new Map();  // Internal state
  }
  
  // Primary operations
  async initialize() {...}
  async execute(...args) {...}
  
  // State management
  register(id, definition) {...}
  get(id) {...}
  
  // Cleanup
  destroy(id) {...}
}
```

## Creating a Custom Engine

### Example: ThreeJS Rendering Engine

**Goal:** Render 3D scenes alongside 2D UI actors.

#### 1. Define DSL Schema

```json
{
  "$type": "scene",
  "$id": "scene_cube_001",
  
  "camera": {
    "type": "perspective",
    "fov": 75,
    "position": [0, 0, 5]
  },
  
  "objects": [
    {
      "type": "mesh",
      "geometry": "box",
      "material": {
        "color": "$primaryColor"
      },
      "position": [0, 0, 0],
      "rotation": [0, "$rotation", 0]
    }
  ],
  
  "lights": [
    {
      "type": "ambient",
      "color": 0xffffff,
      "intensity": 0.5
    }
  ]
}
```

#### 2. Implement Engine

```javascript
// o/engines/ThreeJSEngine.js
import * as THREE from 'three';

export class ThreeJSEngine {
  constructor(evaluator) {
    this.evaluator = evaluator;
    this.scenes = new Map();
    this.renderers = new Map();
    this.animationLoops = new Map();
  }
  
  /**
   * Create and register a 3D scene
   */
  async createScene(sceneId, sceneDef, container, actor) {
    // Validate definition
    if (sceneDef.$type !== 'scene') {
      throw new Error('Invalid scene definition');
    }
    
    // Initialize Three.js
    const scene = new THREE.Scene();
    const camera = this._createCamera(sceneDef.camera);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    
    // Create objects (evaluate context references)
    for (const objDef of sceneDef.objects) {
      const obj = await this._createObject(objDef, actor.context);
      scene.add(obj);
    }
    
    // Create lights
    for (const lightDef of sceneDef.lights) {
      const light = this._createLight(lightDef);
      scene.add(light);
    }
    
    // Store scene data
    this.scenes.set(sceneId, {
      scene,
      camera,
      renderer,
      definition: sceneDef,
      actor,
      container
    });
    
    this.renderers.set(sceneId, renderer);
    
    // Start render loop
    this._startRenderLoop(sceneId);
    
    console.log(`✅ Created 3D scene: ${sceneId}`);
    return sceneId;
  }
  
  /**
   * Update scene based on actor context changes
   */
  async updateScene(sceneId) {
    const sceneData = this.scenes.get(sceneId);
    if (!sceneData) return;
    
    const { scene, definition, actor } = sceneData;
    
    // Re-evaluate object properties with current context
    scene.children.forEach((child, index) => {
      if (index < definition.objects.length) {
        const objDef = definition.objects[index];
        
        // Update rotation (evaluate $rotation from context)
        if (objDef.rotation) {
          const rotation = objDef.rotation.map(
            r => typeof r === 'string' && r.startsWith('$')
              ? actor.context[r.slice(1)]
              : r
          );
          child.rotation.set(...rotation);
        }
        
        // Update material color (evaluate $primaryColor)
        if (objDef.material?.color && typeof objDef.material.color === 'string') {
          const color = this.evaluator.evaluate(
            objDef.material.color,
            { context: actor.context }
          );
          child.material.color.set(color);
        }
      }
    });
  }
  
  /**
   * Render loop
   */
  _startRenderLoop(sceneId) {
    const sceneData = this.scenes.get(sceneId);
    if (!sceneData) return;
    
    const { scene, camera, renderer } = sceneData;
    
    const animate = () => {
      const loopId = requestAnimationFrame(animate);
      this.animationLoops.set(sceneId, loopId);
      
      renderer.render(scene, camera);
    };
    
    animate();
  }
  
  /**
   * Cleanup
   */
  destroyScene(sceneId) {
    // Stop animation loop
    const loopId = this.animationLoops.get(sceneId);
    if (loopId) {
      cancelAnimationFrame(loopId);
      this.animationLoops.delete(sceneId);
    }
    
    // Dispose Three.js resources
    const sceneData = this.scenes.get(sceneId);
    if (sceneData) {
      sceneData.scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      sceneData.renderer.dispose();
      sceneData.container.removeChild(sceneData.renderer.domElement);
    }
    
    // Remove from registry
    this.scenes.delete(sceneId);
    this.renderers.delete(sceneId);
    
    console.log(`🗑️ Destroyed scene: ${sceneId}`);
  }
  
  // Helper methods
  _createCamera(cameraDef) {
    const { type, fov, position } = cameraDef;
    if (type === 'perspective') {
      const camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.set(...position);
      return camera;
    }
    throw new Error(`Unknown camera type: ${type}`);
  }
  
  async _createObject(objDef, context) {
    // Evaluate material color (may reference context)
    let color = objDef.material?.color;
    if (typeof color === 'string' && color.startsWith('$')) {
      color = context[color.slice(1)];
    }
    
    // Create geometry
    let geometry;
    if (objDef.geometry === 'box') {
      geometry = new THREE.BoxGeometry(1, 1, 1);
    } else if (objDef.geometry === 'sphere') {
      geometry = new THREE.SphereGeometry(1, 32, 32);
    }
    
    // Create material
    const material = new THREE.MeshStandardMaterial({ color });
    
    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...objDef.position);
    
    // Evaluate rotation (may reference context)
    const rotation = objDef.rotation.map(
      r => typeof r === 'string' && r.startsWith('$')
        ? context[r.slice(1)]
        : r
    );
    mesh.rotation.set(...rotation);
    
    return mesh;
  }
  
  _createLight(lightDef) {
    if (lightDef.type === 'ambient') {
      return new THREE.AmbientLight(lightDef.color, lightDef.intensity);
    }
    if (lightDef.type === 'directional') {
      const light = new THREE.DirectionalLight(lightDef.color, lightDef.intensity);
      if (lightDef.position) light.position.set(...lightDef.position);
      return light;
    }
    throw new Error(`Unknown light type: ${lightDef.type}`);
  }
}
```

#### 3. Integrate with Kernel

```javascript
// o/kernel.js
import { ThreeJSEngine } from './engines/ThreeJSEngine.js';

export class MaiaOS {
  static async boot(config) {
    const os = {...};
    
    // Initialize existing engines
    os.evaluator = new MaiaScriptEvaluator(os.moduleRegistry);
    // ... other engines ...
    
    // Initialize ThreeJS engine
    os.threeEngine = new ThreeJSEngine(os.evaluator);
    
    return os;
  }
}
```

#### 4. Update Actor Creation

```javascript
// o/engines/ActorEngine.js
async createActor(actorPath, container, os) {
  // ... load actor definition ...
  
  // Load scene if present
  if (actorDef.sceneRef) {
    const scenePath = `${basePath}/${actorDef.sceneRef}.scene.maia`;
    const sceneDef = await this._loadJSON(scenePath);
    actor.sceneDef = sceneDef;
    
    // Create 3D scene
    await os.threeEngine.createScene(
      sceneDef.$id,
      sceneDef,
      sceneContainer,
      actor
    );
  }
  
  // ... rest of actor creation ...
}
```

#### 5. Hook into Rerender

```javascript
// o/engines/ActorEngine.js
async rerender(actor) {
  // Re-render view (2D UI)
  if (actor.viewDef && actor.container.shadowRoot) {
    this.viewEngine.render(actor.container, actor.viewDef, actor, this);
  }
  
  // Update 3D scene
  if (actor.sceneDef && this.os.threeEngine) {
    await this.os.threeEngine.updateScene(actor.sceneDef.$id);
  }
  
  console.log(`✅ Re-render complete for: ${actor.id}`);
}
```

#### 6. Usage in Actor Definition

```json
{
  "$type": "actor",
  "$id": "actor_cube_001",
  "id": "actor_cube_001",
  
  "stateRef": "cube",
  "viewRef": "cubeUI",
  "sceneRef": "cube",    // ← References cube.scene.maia
  
  "context": {
    "rotation": 0,
    "primaryColor": "#3b82f6"
  }
}
```

## Engine Best Practices

### ✅ DO:

- **Accept dependencies via constructor** - Don't use globals
- **Validate inputs** - Check definition schemas
- **Handle errors gracefully** - Don't crash the system
- **Log operations** - Help debugging
- **Clean up resources** - Implement `destroy()` methods
- **Use evaluator for context refs** - Leverage `$` and `$$` syntax
- **Document public API** - Clear JSDoc comments

### ❌ DON'T:

- **Don't store actor state** - Use `actor.context`
- **Don't mutate definitions** - Treat as immutable
- **Don't create global state** - Instance-based only
- **Don't bypass other engines** - Use proper APIs
- **Don't block the main thread** - Use Web Workers if needed

## Testing Engines

```javascript
// test-three-engine.js
import { ThreeJSEngine } from './o/engines/ThreeJSEngine.js';
import { MaiaScriptEvaluator } from './o/engines/MaiaScriptEvaluator.js';

// Mock dependencies
const evaluator = new MaiaScriptEvaluator();

// Create engine
const threeEngine = new ThreeJSEngine(evaluator);

// Test scene creation
const sceneDef = {
  $type: 'scene',
  $id: 'test_scene',
  camera: { type: 'perspective', fov: 75, position: [0, 0, 5] },
  objects: [
    { type: 'mesh', geometry: 'box', material: { color: '#ff0000' }, position: [0, 0, 0] }
  ],
  lights: [{ type: 'ambient', color: 0xffffff, intensity: 0.5 }]
};

const mockActor = {
  context: { rotation: 0, primaryColor: '#ff0000' }
};

const container = document.createElement('div');
document.body.appendChild(container);

await threeEngine.createScene('test_scene', sceneDef, container, mockActor);

// Test update
mockActor.context.rotation = Math.PI / 4;
await threeEngine.updateScene('test_scene');

// Test cleanup
threeEngine.destroyScene('test_scene');
```

## Advanced Patterns

### Engine-to-Engine Communication

```javascript
class CustomEngine {
  constructor(stateEngine, viewEngine) {
    this.stateEngine = stateEngine;
    this.viewEngine = viewEngine;
  }
  
  async doSomething(actor) {
    // Trigger state machine event
    this.stateEngine.send(actor.machine.id, 'CUSTOM_EVENT', {
      data: 'from engine'
    });
    
    // Force UI re-render
    await this.viewEngine.render(actor.container, actor.viewDef, actor, actor.actorEngine);
  }
}
```

### Async Initialization

```javascript
class DatabaseEngine {
  constructor() {
    this.db = null;
    this.ready = false;
  }
  
  async initialize() {
    this.db = await openDatabase();
    this.ready = true;
    console.log('✅ Database engine ready');
  }
  
  async query(sql) {
    if (!this.ready) {
      throw new Error('DatabaseEngine not initialized');
    }
    return await this.db.execute(sql);
  }
}

// In kernel
os.dbEngine = new DatabaseEngine();
await os.dbEngine.initialize();
```

### Resource Management

```javascript
class AudioEngine {
  constructor() {
    this.audioContext = new AudioContext();
    this.buffers = new Map();
    this.sources = new Map();
  }
  
  async loadSound(id, url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    this.buffers.set(id, audioBuffer);
  }
  
  play(id) {
    const buffer = this.buffers.get(id);
    if (!buffer) return;
    
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    source.start(0);
    
    this.sources.set(id, source);
  }
  
  stop(id) {
    const source = this.sources.get(id);
    if (source) {
      source.stop();
      this.sources.delete(id);
    }
  }
  
  destroy() {
    // Stop all sources
    for (const [id, source] of this.sources) {
      source.stop();
    }
    this.sources.clear();
    
    // Close audio context
    this.audioContext.close();
  }
}
```

## Next Steps

- Read [Tools Guide](./tools.md) - Creating tool modules
- Read [DSL Guide](./dsl.md) - Defining new DSL types
- Read [MaiaOS Guide](./maiaos.md) - Understanding the system

---

# MAIAOS

*Source: developers/maiaos.md*

# MaiaOS (Developer Guide)

**For developers** who want to understand and extend the MaiaOS architecture.

## Architecture Overview

MaiaOS is a **declarative operating system** for building AI-composable applications. It separates concerns into three distinct layers:

### 1. Definition Layer (Declarative)
User-facing configuration files (`.maia`):
- **Actors** - Component identity and references
- **State Machines** - Behavior flow
- **Views** - UI structure
- **Styles** - Appearance
- **Skills** - AI agent interface

### 2. Execution Layer (Imperative)
JavaScript engines that interpret definitions:
- **ActorEngine** - Actor lifecycle management
- **StateEngine** - State machine interpreter
- **ViewEngine** - View-to-DOM renderer
- **ToolEngine** - Tool executor
- **StyleEngine** - Style compiler
- **ModuleRegistry** - Dynamic module loader

### 3. Intelligence Layer (Orchestration)
AI agent integration:
- **SkillEngine** - Skill discovery and interpretation (v0.5)
- **LLM Integration** - Event generation from natural language (v0.5)

## Core Philosophy

### Separation of Concerns

```
┌──────────────┐
│   Actors     │  ← Pure configuration (JSON)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Engines    │  ← Execution machinery (JavaScript)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    Tools     │  ← Imperative actions (JavaScript)
└──────────────┘
```

### Zero Logic in Definitions

Actors, views, and state machines are **pure data**:
- No JavaScript functions
- No embedded logic
- Only references and configuration

This enables:
- ✅ Easy serialization (JSON)
- ✅ AI generation/modification
- ✅ Hot reload without code changes
- ✅ Visual editing tools (future)

## System Initialization

### Boot Sequence

```javascript
// 1. Initialize kernel
const os = await MaiaOS.boot({
  modules: ['core', 'mutation', 'dragdrop']
});

// Behind the scenes:
// → ModuleRegistry initialized
// → Engines initialized (Actor, State, View, Tool, Style)
// → Modules loaded dynamically
// → Tools registered
```

### Kernel Structure

```javascript
class MaiaOS {
  static async boot(config) {
    const os = {
      // Core registries
      moduleRegistry: new ModuleRegistry(),
      actors: new Map(),
      
      // Engines
      actorEngine: null,
      stateEngine: null,
      viewEngine: null,
      toolEngine: null,
      styleEngine: null,
      evaluator: null,
      
      // Public API
      createActor: async (actorPath, container) => {...},
      loadVibe: async (vibePath, container) => {...},
      getActor: (actorId) => {...},
      sendMessage: (actorId, message) => {...},
      getEngines: () => {...}
    };
    
    // Initialize engines
    os.evaluator = new MaiaScriptEvaluator(os.moduleRegistry);
    os.toolEngine = new ToolEngine(os.moduleRegistry);
    os.stateEngine = new StateEngine(os.evaluator, os.toolEngine);
    os.viewEngine = new ViewEngine(os.evaluator, os.stateEngine);
    os.styleEngine = new StyleEngine(os.evaluator);
    os.actorEngine = new ActorEngine(
      os.stateEngine,
      os.viewEngine,
      os.styleEngine
    );
    
    // Load modules
    for (const moduleName of config.modules) {
      await os.moduleRegistry.loadModule(moduleName);
    }
    
    return os;
  }
}
```

## Vibes (App Manifests)

### What Are Vibes?

Vibes are marketplace-ready app manifests (`.vibe.maia`) that provide metadata and reference the root actor. They serve as the "app store listing" for MaiaOS applications.

**Structure:**
```json
{
  "$type": "vibe",
  "$id": "vibe_todos_001",
  "name": "Todo List",
  "description": "A complete todo list application...",
  "actor": "./todo.actor.maia"
}
```

### Loading Vibes

```javascript
// High-level API (recommended)
const { vibe, actor } = await os.loadVibe(
  './vibes/todos/todos.vibe.maia',
  document.getElementById('container')
);

// Equivalent to:
// 1. Fetch vibe manifest
// 2. Validate structure ($type, actor field)
// 3. Resolve actor path (relative to vibe)
// 4. Call os.createActor(resolvedPath, container)
// 5. Return {vibe, actor}
```

### Implementation

**kernel.js:**
```javascript
async loadVibe(vibePath, container) {
  // Fetch vibe manifest
  const response = await fetch(vibePath);
  const vibe = await response.json();
  
  // Validate
  if (vibe.$type !== 'vibe') {
    throw new Error('Invalid vibe manifest: $type must be "vibe"');
  }
  if (!vibe.actor) {
    throw new Error('Vibe manifest missing "actor" field');
  }
  
  // Resolve actor path relative to vibe location
  const vibeDir = vibePath.substring(0, vibePath.lastIndexOf('/'));
  const actorPath = `${vibeDir}/${vibe.actor}`;
  
  // Create actor
  const actor = await this.createActor(actorPath, container);
  
  return { vibe, actor };
}
```

### Design Rationale

**Why separate vibes from actors?**

1. **Marketplace Integration** - Vibes provide metadata for discovery, search, and installation
2. **Clean Separation** - Manifest (vibe) vs Implementation (actor)
3. **Extensibility** - Easy to add icon, screenshots, version, etc. without changing actors
4. **AI-Friendly** - LLMs can generate vibe manifests as app packaging

**Future Extensions:**
```json
{
  "$type": "vibe",
  "name": "...",
  "description": "...",
  "actor": "...",
  "icon": "./icon.svg",          // Marketplace icon
  "screenshots": ["..."],         // Preview images
  "tags": ["productivity"],       // Search tags
  "category": "productivity",     // Primary category
  "license": "MIT",               // License type
  "repository": "https://..."     // Source URL
}
```

## Actor Lifecycle

### 1. Creation

```javascript
const actor = await os.createActor(
  './maia/todo.actor.maia',
  document.getElementById('container')
);

// Behind the scenes:
// 1. Load actor.maia (JSON)
// 2. Load referenced state.maia
// 3. Load referenced view.maia (if present)
// 4. Load referenced style.maia (if present)
// 5. Initialize state machine
// 6. Render view to Shadow DOM
// 7. Apply styles
// 8. Return actor instance
```

### 2. Actor Instance Structure

```javascript
{
  id: 'actor_todo_001',
  context: {
    todos: [],
    newTodoText: '',
    // ... runtime state
  },
  machine: {
    id: 'state_todo_001',
    currentState: 'idle',
    definition: {...},
    // ... state machine instance
  },
  container: HTMLElement,        // DOM mount point
  viewDef: {...},                // View definition
  styleDef: {...},               // Style definition
  inbox: [],                     // Message queue
  subscriptions: [],             // Actor subscriptions
  inboxWatermark: 0,             // Last processed message
  actorEngine: ActorEngine,      // Reference to engine
}
```

### 3. Event Flow

```
User Interaction (click, input, etc.)
  ↓
ViewEngine captures event
  ↓
ViewEngine.evaluatePayload() (resolve $ and $$)
  ↓
StateEngine.send(machineId, eventName, payload)
  ↓
StateEngine finds current state
  ↓
StateEngine checks event handlers (on: {...})
  ↓
StateEngine evaluates guard (if present)
  ↓
Guard passes → Continue
Guard fails → Ignore event
  ↓
StateEngine executes exit actions (if leaving state)
  ↓
StateEngine transitions to target state
  ↓
StateEngine executes entry actions (tool invocations)
  ↓
ToolEngine.execute(toolName, actor, payload)
  ↓
Tool mutates actor.context
  ↓
Tool succeeds → StateEngine sends SUCCESS event
Tool fails → StateEngine sends ERROR event
  ↓
StateEngine handles SUCCESS/ERROR transition
  ↓
ActorEngine.rerender(actor)
  ↓
ViewEngine re-renders Shadow DOM
  ↓
User sees updated UI
```

## Engine Architecture

### ActorEngine

**Responsibilities:**
- Actor creation and registration
- Actor lifecycle management
- Re-rendering orchestration
- Message passing coordination

**Key Methods:**
```javascript
class ActorEngine {
  async createActor(actorPath, container, os)
  registerActor(actor)
  getActor(actorId)
  async rerender(actor)
  destroyActor(actorId)
  sendMessage(actorId, message)
  processMessages(actor)
}
```

### StateEngine

**Responsibilities:**
- State machine interpretation
- Event handling
- Guard evaluation
- Tool invocation
- Automatic SUCCESS/ERROR events

**Key Methods:**
```javascript
class StateEngine {
  registerMachine(machineId, definition, initialContext)
  send(machineId, event, payload)
  getCurrentState(machineId)
  async transition(machineId, event, payload)
  _evaluateGuard(guard, context, eventPayload)
  _evaluatePayload(payload, context, eventPayload)
  async _invokeTool(tool, actor)
}
```

### ViewEngine

**Responsibilities:**
- View definition to DOM rendering
- Event listener attachment
- Payload evaluation
- Shadow DOM management

**Key Methods:**
```javascript
class ViewEngine {
  render(container, viewDef, actor, actorEngine)
  _renderElement(elementDef, context, actorEngine, actor)
  _attachEventListeners(element, events, actor, actorEngine)
  _evaluatePayload(payload, context, item, element)
}
```

### ToolEngine

**Responsibilities:**
- Tool registration
- Tool execution
- Tool definition loading
- Error handling

**Key Methods:**
```javascript
class ToolEngine {
  async registerTool(toolPath, toolName)
  async execute(toolName, actor, payload)
  async loadToolDefinition(toolPath)
  async loadToolFunction(toolPath)
}
```

### StyleEngine

**Responsibilities:**
- Style compilation
- Token to CSS custom property conversion
- CSS injection into Shadow DOM

**Key Methods:**
```javascript
class StyleEngine {
  compile(styleDef)
  _compileTokens(tokens)
  _compileStyles(styles)
}
```

### ModuleRegistry

**Responsibilities:**
- Module registration
- Dynamic module loading
- Module metadata management

**Key Methods:**
```javascript
class ModuleRegistry {
  registerModule(name, moduleClass, metadata)
  async loadModule(moduleName, modulePath)
  getModule(name)
  hasModule(name)
  listModules()
  setToolEngine(toolEngine)
}
```

## Module System

### Module Structure

```javascript
// o/modules/custom.module.js
export class CustomModule {
  static async register(registry, toolEngine) {
    // Register tools
    await toolEngine.registerTool('custom/doSomething', '@custom/doSomething');
    await toolEngine.registerTool('custom/doOther', '@custom/doOther');
    
    // Register module metadata
    registry.registerModule('custom', CustomModule, {
      version: '1.0.0',
      description: 'Custom functionality module',
      namespace: '@custom',
      tools: ['@custom/doSomething', '@custom/doOther']
    });
  }
}

// Export register function (alternative pattern)
export async function register(registry) {
  const toolEngine = registry._toolEngine;
  await CustomModule.register(registry, toolEngine);
}
```

### Tool Structure

Two files per tool:

1. **Tool Definition** (`*.tool.maia`) - AI-compatible metadata:
```json
{
  "$type": "tool",
  "$id": "tool_custom_001",
  "name": "@custom/doSomething",
  "description": "Does something useful",
  "parameters": {
    "type": "object",
    "properties": {
      "param1": {"type": "string", "required": true}
    }
  }
}
```

2. **Tool Function** (`*.tool.js`) - Executable code:
```javascript
export default {
  async execute(actor, payload) {
    const { param1 } = payload;
    // Mutate actor.context
    actor.context.someField = param1;
    console.log('✅ Did something:', param1);
  }
};
```

## Extending MaiaOS

### Adding a New Engine

1. Create engine class:
```javascript
// o/engines/ThreeJSEngine.js
export class ThreeJSEngine {
  constructor(evaluator) {
    this.evaluator = evaluator;
    this.scenes = new Map();
  }
  
  createScene(actor, sceneDef) {
    // Initialize Three.js scene
  }
  
  render(sceneId) {
    // Render Three.js scene
  }
}
```

2. Register in kernel:
```javascript
os.threeEngine = new ThreeJSEngine(os.evaluator);
```

3. Update actor definition schema:
```json
{
  "$type": "actor",
  "sceneRef": "myScene",  // ← New reference type
  "viewRef": "myView"
}
```

### Adding a New DSL Type

1. Define DSL schema:
```json
{
  "$type": "animation",
  "$id": "anim_001",
  "keyframes": {
    "0%": {"opacity": 0},
    "100%": {"opacity": 1}
  },
  "duration": "300ms",
  "easing": "ease-out"
}
```

2. Create engine/compiler:
```javascript
class AnimationEngine {
  compile(animDef) {
    // Convert to CSS animations or Web Animations API
  }
}
```

3. Integrate with actors:
```json
{
  "$type": "actor",
  "animationRef": "fadeIn"
}
```

## Best Practices

### ✅ DO:

- **Keep engines stateless** - State lives in actors
- **Use dependency injection** - Pass engines/registries as params
- **Validate inputs** - Check payloads and definitions
- **Log operations** - Help debugging
- **Handle errors gracefully** - Don't crash the system
- **Document public APIs** - Clear JSDoc comments

### ❌ DON'T:

- **Don't store actor state in engines** - Use `actor.context`
- **Don't mutate definitions** - Treat as immutable
- **Don't hardcode paths** - Use relative imports
- **Don't bypass engines** - Use proper APIs
- **Don't create global singletons** - Pass instances

## Debugging

```javascript
// Expose OS globally
window.os = os;
window.engines = os.getEngines();

// Inspect actor
const actor = os.getActor('actor_todo_001');
console.log(actor.context);
console.log(actor.machine.currentState);

// Monitor events
const originalSend = os.stateEngine.send;
os.stateEngine.send = function(machineId, event, payload) {
  console.log('Event:', event, payload);
  return originalSend.call(this, machineId, event, payload);
};

// Monitor rerenders
const originalRerender = os.actorEngine.rerender;
os.actorEngine.rerender = function(actor) {
  console.log('Rerender:', actor.id);
  return originalRerender.call(this, actor);
};
```

## Next Steps

- Read [Engines Guide](./engines.md) - Creating custom engines
- Read [Tools Guide](./tools.md) - Creating tool modules
- Read [DSL Guide](./dsl.md) - Extending DSL types

---

# REACTIVE QUERIES

*Source: developers/reactive-queries.md*

# Reactive Queries - Technical Architecture

## Overview

The reactive query system provides observable data management through a localStorage-backed ReactiveStore with automatic context updates and actor re-rendering when data changes.

## Architecture Components

### 1. ReactiveStore

**Location:** `libs/maia-script/src/o/engines/ReactiveStore.js`

An observable wrapper around localStorage that implements the observer pattern:

```javascript
class ReactiveStore {
  constructor(storageKey = 'maiaos_data');
  
  // Core CRUD
  getCollection(schema): Array
  setCollection(schema, data): void  // Triggers observers
  
  // Reactive subscriptions
  subscribe(schema, filter, callback): unsubscribe function
  notify(schema): void
  
  // Query operations
  query(schema, filter): Array
}
```

**Key Features:**
- Observer pattern for reactive updates
- JSON-based filtering (eq, ne, gt, lt, gte, lte, in, contains)
- localStorage persistence
- Automatic notification of subscribers
- Memory leak prevention via unsubscribe functions

### 2. Query Tools

**Location:** `libs/maia-script/src/o/tools/query/`

Three tools for interacting with ReactiveStore:

#### @query/subscribe

Reactive subscription to a collection. Context auto-updates when data changes.

```javascript
{
  "tool": "@query/subscribe",
  "payload": {
    "schema": "todos",
    "filter": { "field": "done", "op": "eq", "value": false },
    "target": "todosTodo"
  }
}
```

**Behavior:**
- Immediately calls callback with current data
- Updates actor context when data changes
- Triggers actor re-render automatically
- Stores unsubscribe function in `actor._queryObservers` for cleanup

#### @query/get

One-time (non-reactive) query. Loads data into context once.

```javascript
{
  "tool": "@query/get",
  "payload": {
    "schema": "todos",
    "target": "todos"
  }
}
```

**Use Cases:**
- Initial data loading without reactivity
- Performance optimization (avoid unnecessary updates)
- Static data that doesn't change

#### @query/filter

One-time filtered query. Non-reactive.

```javascript
{
  "tool": "@query/filter",
  "payload": {
    "schema": "todos",
    "filter": { "field": "done", "op": "eq", "value": true },
    "target": "completedTodos"
  }
}
```

**Supported Operators:**
- `eq`: equals (===)
- `ne`: not equals (!==)
- `gt`: greater than (>)
- `lt`: less than (<)
- `gte`: greater than or equal (>=)
- `lte`: less than or equal (<=)
- `in`: value in array
- `contains`: string contains substring

### 3. Mutation Tools

**Location:** `libs/maia-script/src/o/tools/mutation/`

All mutation tools write to ReactiveStore and trigger observer notifications:

```javascript
// OLD (direct context manipulation)
actor.context[schema].push(entity);

// NEW (ReactiveStore with automatic notifications)
const store = actor.actorEngine.reactiveStore;
const collection = store.getCollection(schema);
collection.push(entity);
store.setCollection(schema, collection); // Triggers notify()
```

**Tools:**
- `@mutation/create`: Create new entity
- `@mutation/update`: Update existing entity
- `@mutation/delete`: Delete entity
- `@mutation/toggle`: Toggle boolean field

### 4. ActorEngine Integration

**Location:** `libs/maia-script/src/o/engines/actor-engine/actor.engine.js`

**Initialization:**

```javascript
constructor(styleEngine, viewEngine, moduleRegistry, toolEngine, stateEngine) {
  // ... existing initialization
  this.reactiveStore = new ReactiveStore('maiaos_data');
  console.log('[ActorEngine] ReactiveStore initialized');
}
```

**Actor Creation:**

```javascript
const actor = {
  id: actorId,
  config: actorConfig,
  shadowRoot,
  context,
  containerElement,
  actorEngine: this,
  inbox: actorConfig.inbox || [],
  subscriptions: actorConfig.subscriptions || [],
  inboxWatermark: actorConfig.inboxWatermark || 0,
  _queryObservers: []  // For cleanup
};
```

**Actor Destruction:**

```javascript
destroyActor(actorId) {
  const actor = this.actors.get(actorId);
  if (actor) {
    // Cleanup query observers
    if (actor._queryObservers && actor._queryObservers.length > 0) {
      actor._queryObservers.forEach(unsubscribe => unsubscribe());
      actor._queryObservers = [];
    }
    // ... rest of cleanup
  }
}
```

## Data Flow

### Reactive Subscription Flow

```
1. State Machine Entry Action
   └─> @query/subscribe tool
       └─> ReactiveStore.subscribe(schema, filter, callback)
           ├─> Store observer in observers Map
           ├─> Immediately call callback with current data
           │   └─> Update actor.context[target]
           │       └─> Trigger actor.rerender()
           └─> Return unsubscribe function
               └─> Store in actor._queryObservers

2. Data Mutation
   └─> @mutation/* tool
       └─> ReactiveStore.setCollection(schema, data)
           ├─> Save to localStorage
           └─> ReactiveStore.notify(schema)
               └─> Call all observer callbacks
                   └─> Update actor.context[target]
                       └─> Trigger actor.rerender()
```

### Example: Todo App

**Root Actor (vibe_root):**
- Creates todos via `@mutation/create`
- Publishes `TODO_CREATED` message to children

**Child Actor (todo_list):**
- Subscribes to entire `todos` collection
- Automatically updates when any todo changes

**Child Actor (kanban_view):**
- Subscribes to filtered `todos` (done: false)
- Subscribes to filtered `todos` (done: true)
- Each filter updates independently

```javascript
// State machine entry for kanban_view
"loading": {
  "entry": [
    {
      "tool": "@query/subscribe",
      "payload": {
        "schema": "todos",
        "filter": { "field": "done", "op": "eq", "value": false },
        "target": "todosTodo"
      }
    },
    {
      "tool": "@query/subscribe",
      "payload": {
        "schema": "todos",
        "filter": { "field": "done", "op": "eq", "value": true },
        "target": "todosDone"
      }
    }
  ],
  "on": {
    "SUCCESS": "idle"
  }
}
```

## Memory Management

### Observer Cleanup

Observers are automatically cleaned up when actors are destroyed:

```javascript
// Automatic cleanup in ActorEngine.destroyActor()
if (actor._queryObservers && actor._queryObservers.length > 0) {
  actor._queryObservers.forEach(unsubscribe => unsubscribe());
  actor._queryObservers = [];
}
```

### Preventing Memory Leaks

1. **Unsubscribe functions:** Every `subscribe()` call returns an unsubscribe function
2. **Tracked observers:** All observers are stored in `actor._queryObservers`
3. **Cascading cleanup:** When an actor is destroyed, all its query observers are unsubscribed
4. **Parent-child cleanup:** Destroying a parent actor automatically destroys child actors and their observers

## Performance Considerations

### Filtered Queries

Filtered queries only notify relevant subscribers:

```javascript
// Only actors subscribed to "done: false" will be notified
store.subscribe('todos', { field: 'done', op: 'eq', value: false }, callback);
```

### localStorage Limits

- **Size Limit:** ~5-10MB per domain
- **Performance:** Synchronous read/write (fast for small datasets)
- **Recommendation:** Use localStorage for prototyping, migrate to Jazz CRDTs for production

### Optimization Tips

1. **Use filtered subscriptions:** Only subscribe to the data you need
2. **Minimize re-renders:** Use `@query/get` for static data
3. **Batch mutations:** Group multiple mutations when possible
4. **Clear cache:** Use `ReactiveStore.clear()` for testing

## Testing

### Unit Tests

**Location:** `libs/maia-script/src/o/engines/ReactiveStore.test.js`

Tests cover:
- CRUD operations
- Observer subscriptions and notifications
- Filter operations (all operators)
- Memory cleanup
- Edge cases (corrupted data, empty collections, multiple filters)

### Running Tests

```bash
bun test libs/maia-script/src/o/engines/ReactiveStore.test.js
```

### Mock localStorage

For Bun tests, a localStorage mock is required:

```javascript
class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  clear() { this.store = {}; }
  getItem(key) { return this.store[key] || null; }
  setItem(key, value) { this.store[key] = String(value); }
  removeItem(key) { delete this.store[key]; }
}

global.localStorage = new LocalStorageMock();
```

## Migration Path to Jazz CRDTs

This reactive architecture is designed to be compatible with Jazz's reactive patterns:

### Similarities

- **Observable/reactive patterns:** Jazz CoMaps are reactive by default
- **Subscription-based updates:** Jazz auto-syncs between clients
- **JSON-based queries:** Jazz queries are also declarative
- **Collection-based organization:** Jazz uses CoLists and CoMaps

### Migration Steps

1. Replace `ReactiveStore` with Jazz `Group`
2. Replace `@query/subscribe` with Jazz `useCoState()` equivalent
3. Replace `@mutation/*` tools with Jazz CoMap mutations
4. localStorage becomes Jazz's CRDT sync layer (automatic)
5. No changes to tool interfaces required!

### Example Migration

```javascript
// BEFORE (ReactiveStore)
const store = actor.actorEngine.reactiveStore;
const todos = store.getCollection('todos');

// AFTER (Jazz)
const group = actor.actorEngine.jazzGroup;
const todos = group.todos; // Reactive CoList
```

## Debugging

### Enable Logging

ReactiveStore and query tools include console.log statements:

```javascript
console.log('[query/subscribe] Subscribing actor_001 to todos (filtered) → context.todosTodo');
console.log('[query/subscribe] Updated actor_001.context.todosTodo with 3 items');
```

### Inspect Observers

```javascript
const store = actorEngine.reactiveStore;
console.log(store.getObservers()); // Map of schema -> Set<observer>
```

### Check localStorage

```javascript
console.log(localStorage.getItem('maiaos_data'));
// {"todos":[{"id":"1","text":"Test","done":false}]}
```

### Verify Actor Observers

```javascript
const actor = actorEngine.actors.get('actor_todo_list_001');
console.log(actor._queryObservers.length); // Number of active subscriptions
```

## Best Practices

1. **Always subscribe in loading state:** Use state machine entry actions
2. **Clean filters:** Keep filter logic simple and predictable
3. **Use filtered subscriptions:** Avoid subscribing to entire collections when you only need a subset
4. **Test with empty data:** Ensure views handle empty arrays gracefully
5. **Document data flow:** Use comments to explain which actors subscribe to which data
6. **Avoid circular dependencies:** Don't create subscription loops
7. **Profile re-renders:** Monitor actor re-render frequency in production
8. **Prepare for Jazz:** Structure code to make Jazz migration straightforward

## API Reference

### ReactiveStore

```typescript
class ReactiveStore {
  constructor(storageKey: string = 'maiaos_data')
  
  getCollection(schema: string): Array
  setCollection(schema: string, data: Array): void
  subscribe(schema: string, filter: Object | null, callback: Function): Function
  notify(schema: string): void
  query(schema: string, filter: Object | null): Array
  clear(): void
  getObservers(): Map
}
```

### Query Tools

```typescript
// @query/subscribe
{
  schema: string,      // Required
  filter?: {           // Optional
    field: string,
    op: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains',
    value: any
  },
  target: string       // Required
}

// @query/get
{
  schema: string,      // Required
  target: string       // Required
}

// @query/filter
{
  schema: string,      // Required
  filter: {            // Required
    field: string,
    op: string,
    value: any
  },
  target: string       // Required
}
```

### Mutation Tools

```typescript
// @mutation/create
{
  schema: string,      // Required
  data: Object         // Required
}

// @mutation/update
{
  schema: string,      // Required
  id: string,          // Required
  data: Object         // Required
}

// @mutation/delete
{
  schema: string,      // Required
  id: string           // Required
}

// @mutation/toggle
{
  schema: string,      // Required
  id: string,          // Required
  field?: string       // Optional, defaults to 'done'
}
```

## Summary

The reactive query system provides:
- **Automatic context updates:** No manual refresh needed
- **Observable localStorage:** Single source of truth
- **JSON-configured queries:** Extensible filter syntax
- **Memory-safe:** Automatic observer cleanup
- **Jazz-ready:** Clean migration path to CRDTs

This foundation enables building reactive, data-driven applications while maintaining clean separation between data management and UI rendering.

---

# SCHEMAS

*Source: developers/schemas.md*

# JSON Schema System

MaiaOS uses a centralized JSON Schema validation system to ensure all `.maia` files conform to their expected structure. This provides:

- **Runtime validation** - Catch malformed data early
- **Clear error messages** - Know exactly what's wrong and where
- **Type safety** - Consistent data structures across the system
- **Documentation** - Schemas serve as authoritative documentation

## Overview

All schemas are located in `src/schemata/` and use JSON Schema Draft 2020-12. The validation engine uses AJV for fast, cached validation.

## Validation Engine

The `ValidationEngine` class provides a unified API for validating all MaiaOS data types:

```javascript
import { ValidationEngine, getSchema } from '../schemata/index.js';

const engine = new ValidationEngine();

// Load a schema
const actorSchema = getSchema('actor');
engine.loadSchema('actor', actorSchema);

// Validate data
const result = engine.validate('actor', actorData);
if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
```

## Using Validation Helper

For most use cases, use the validation helper which automatically loads all schemas:

```javascript
import { validateOrThrow } from '../schemata/validation.helper.js';

// Validate and throw on error
try {
  validateOrThrow('actor', actorData, 'path/to/actor.maia');
} catch (error) {
  console.error('Validation failed:', error.message);
}
```

## Schema Types

### Actor Schema

Validates actor definitions (`.actor.maia` files).

**Required fields:**
- `$type`: Must be `"actor"`
- `$id`: Unique identifier (pattern: `^actor_`)

**Optional fields:**
- `contextRef`, `stateRef`, `viewRef`, `interfaceRef`, `brandRef`, `styleRef`
- `children`: Object mapping child names to actor IDs
- `subscriptions`: Array of actor IDs to receive messages from
- `inbox`: Array of messages
- `inboxWatermark`: Number (default: 0)

**Example:**
```json
{
  "$type": "actor",
  "$id": "actor_todo_001",
  "contextRef": "todo",
  "viewRef": "todo",
  "stateRef": "todo"
}
```

### Context Schema

Validates context definitions (`.context.maia` files).

**Required fields:**
- `$type`: Must be `"context"`
- `$id`: Unique identifier (pattern: `^context_`)

**Additional properties:** Any additional fields are allowed (flexible structure).

**Example:**
```json
{
  "$type": "context",
  "$id": "context_todo_001",
  "todos": [],
  "newTodoText": ""
}
```

### State Schema

Validates state machine definitions (`.state.maia` files).

**Required fields:**
- `$type`: Must be `"state"`
- `$id`: Unique identifier (pattern: `^state_`)
- `initial`: Initial state name
- `states`: Object mapping state names to state definitions

**State definition properties:**
- `entry`: Action or array of actions to execute on entry
- `exit`: Action or array of actions to execute on exit
- `on`: Object mapping event names to transitions

**Example:**
```json
{
  "$type": "state",
  "$id": "state_todo_001",
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

### View Schema

Validates view definitions (`.view.maia` files).

**Required fields:**
- `$type`: Must be `"view"`
- `$id`: Unique identifier (pattern: `^co_view_`)

**Properties:**
- `root`: Root DOM node (for leaf views)
- `container`: Container node (for composite views)

**View node properties:**
- `tag`: HTML tag name
- `class`: CSS class name
- `text`: Text content (can be expression)
- `value`: Input value (can be expression)
- `attrs`: HTML attributes object
- `children`: Array of child nodes
- `$on`: Event handlers object
- `$each`: Loop definition
- `$slot`: Slot reference (expression)

**Example:**
```json
{
  "$type": "view",
  "$id": "co_view_todo_001",
  "root": {
    "tag": "div",
    "text": "$title",
    "children": []
  }
}
```

### Style Schema

Validates style definitions (`.style.maia` files).

**Required fields:**
- `$type`: Must be `"actor.style"`

**Properties:**
- `tokens`: Design tokens object
- `components`: Component-specific styles object

**Example:**
```json
{
  "$type": "actor.style",
  "tokens": {
    "colors": {
      "primary": "#8fa89b"
    }
  },
  "components": {
    "button": {
      "background": "{colors.primary}"
    }
  }
}
```

### Brand Style Schema

Validates brand style definitions (`brand.style.maia` files).

**Required fields:**
- `$type`: Must be `"brand.style"`
- `$id`: Unique identifier (pattern: `^co_brand_`)

**Properties:**
- `tokens`: Design tokens (colors, spacing, typography, radii, shadows)
- `components`: Component-specific styles
- `selectors`: CSS selector-based styles

**Example:**
```json
{
  "$type": "brand.style",
  "$id": "co_brand_001",
  "tokens": {
    "colors": {
      "primary": "#8fa89b"
    }
  },
  "components": {
    "button": {
      "background": "{colors.primary}"
    }
  }
}
```

### Interface Schema

Validates interface definitions (`.interface.maia` files).

**Required fields:**
- `$type`: Must be `"actor.interface"`

**Properties:**
- `inbox`: Object mapping message types to payload schemas
- `publishes`: Object mapping message types to payload schemas
- `subscriptions`: Array of actor IDs
- `watermark`: Number (default: 0)

**Example:**
```json
{
  "$type": "actor.interface",
  "inbox": {
    "CREATE_TODO": {
      "payload": {
        "text": "string"
      }
    }
  },
  "publishes": {
    "TODO_CREATED": {
      "payload": {
        "id": "string"
      }
    }
  }
}
```

### Tool Schema

Validates tool definitions (`.tool.maia` files).

**Required fields:**
- `$type`: Must be `"tool"`
- `$id`: Unique identifier (pattern: `^tool_`)
- `name`: Tool identifier (pattern: `^@`)
- `description`: Tool description
- `parameters`: JSON Schema for tool parameters

**Example:**
```json
{
  "$type": "tool",
  "$id": "tool_create_001",
  "name": "@mutation/create",
  "description": "Creates a new entity",
  "parameters": {
    "type": "object",
    "properties": {
      "schema": {
        "type": "string"
      },
      "data": {
        "type": "object"
      }
    },
    "required": ["schema", "data"]
  }
}
```

### Skill Schema

Validates skill definitions (`.skill.maia` files).

**Required fields:**
- `$type`: Must be `"skill"`
- `$id`: Unique identifier (pattern: `^skill_`)
- `actorType`: Actor type this skill describes
- `description`: High-level capability summary
- `stateEvents`: Events the actor can handle
- `queryableContext`: Context fields AI can read

**Optional fields:**
- `version`: Skill version
- `capabilities`: High-level capability categories
- `bestPractices`: Guidelines for AI agents
- `commonPatterns`: Reusable interaction sequences
- `examples`: Usage examples

**Example:**
```json
{
  "$type": "skill",
  "$id": "skill_todo_001",
  "actorType": "todo",
  "description": "Todo list manager",
  "stateEvents": {
    "CREATE_TODO": {
      "description": "Create a new todo",
      "payload": {
        "text": {
          "type": "string",
          "required": true
        }
      }
    }
  },
  "queryableContext": {
    "todos": {
      "type": "array",
      "description": "List of todos"
    }
  }
}
```

### Vibe Schema

Validates vibe definitions (`.vibe.maia` files).

**Required fields:**
- `$type`: Must be `"vibe"`
- `$id`: Unique identifier (pattern: `^vibe_`)
- `name`: Vibe name
- `description`: Vibe description
- `actor`: Path to actor definition file

**Example:**
```json
{
  "$type": "vibe",
  "$id": "vibe_todos_001",
  "name": "Todo List",
  "description": "A todo list application",
  "actor": "./vibe/vibe.actor.maia"
}
```

### Message Schema

Validates messages passed between actors.

**Required fields:**
- `type`: Message type/event name
- `timestamp`: Unix timestamp (number, minimum: 0)

**Optional fields:**
- `payload`: Message payload data (object)
- `from`: Sender actor ID (string)
- `id`: Optional message ID for deduplication (string)

**Example:**
```json
{
  "type": "CREATE_TODO",
  "payload": {
    "text": "Buy milk"
  },
  "from": "actor_user_001",
  "timestamp": 1234567890
}
```

## Common Definitions

The `common.schema.json` file defines shared patterns used across multiple schemas:

- **Expression**: Context reference (`$field`), item reference (`$$field`), or literal value
- **Guard**: Guard condition for state machine transitions
- **Action**: Tool invocation or context update
- **Transition**: State machine transition definition
- **MessagePayload**: Message payload definition

## Integration

Validation is automatically integrated into all engines:

- **ActorEngine**: Validates actor, context, and interface files on load
- **StateEngine**: Validates state machine files on load
- **ViewEngine**: Validates view files on load
- **StyleEngine**: Validates style files on load
- **ToolEngine**: Validates tool definition files on load
- **Kernel**: Validates vibe manifest files on load

## Error Messages

Validation errors include:

- `instancePath`: JSON path to the invalid field (e.g., `/properties/name`)
- `schemaPath`: JSON path in the schema (e.g., `/properties/name/type`)
- `keyword`: Validation keyword that failed (e.g., `required`, `type`)
- `message`: Human-readable error message
- `params`: Additional error parameters

**Example error:**
```json
{
  "instancePath": "/properties/name",
  "schemaPath": "#/properties/name/type",
  "keyword": "type",
  "message": "must be string",
  "params": {
    "type": "string"
  }
}
```

## Performance

- Schemas are compiled once and cached
- Validation is fast (< 1ms per file typically)
- Validation only occurs on file load, not at runtime

## Extending Schemas

To add a new schema:

1. Create `src/schemata/newtype.schema.json`
2. Add schema to `src/schemata/index.js` exports
3. Update `validation.helper.js` to load the new schema
4. Add validation calls in the appropriate engine

## Best Practices

1. **Be permissive initially**: Start with schemas that accept current data, tighten later
2. **Use clear descriptions**: Add `title` and `description` fields for better error messages
3. **Reuse common definitions**: Extract shared patterns into `common.schema.json`
4. **Test against real data**: Use integration tests to validate all existing files
5. **Version schemas**: Include `$schema` field pointing to JSON Schema spec

---

# TOOLS

*Source: developers/tools.md*

# Tools Guide (Developer)

**For developers** who want to create custom tools and tool modules to extend MaiaOS functionality.

## What Are Tools?

Tools are **executable functions** that state machines invoke to perform actions. They are the ONLY place where imperative code lives in MaiaOS.

### Tool Characteristics

- ✅ **Pure functions** - Same input → same output
- ✅ **Context mutation** - Modify `actor.context`
- ✅ **Async operations** - API calls, database queries
- ✅ **Schema-agnostic** - Work with any data model
- ✅ **AI-compatible** - Defined with JSON schemas

## Tool Structure

Each tool consists of **two files**:

### 1. Tool Definition (`*.tool.maia`)
AI-compatible metadata in JSON format:

```json
{
  "$type": "tool",
  "$id": "tool_notify_001",
  "name": "@custom/notify",
  "description": "Shows a notification to the user",
  "parameters": {
    "type": "object",
    "properties": {
      "message": {
        "type": "string",
        "description": "Notification message",
        "required": true
      },
      "type": {
        "type": "string",
        "enum": ["info", "success", "error", "warning"],
        "description": "Notification type",
        "default": "info"
      },
      "duration": {
        "type": "number",
        "description": "Duration in milliseconds",
        "default": 3000
      }
    },
    "required": ["message"]
  }
}
```

### 2. Tool Function (`*.tool.js`)
Executable JavaScript:

```javascript
export default {
  async execute(actor, payload) {
    const { message, type = 'info', duration = 3000 } = payload;
    
    // Validate inputs
    if (!message) {
      throw new Error('Message is required');
    }
    
    // Mutate context
    if (!actor.context.notifications) {
      actor.context.notifications = [];
    }
    
    const notification = {
      id: Date.now().toString(),
      message,
      type,
      timestamp: Date.now()
    };
    
    actor.context.notifications.push(notification);
    
    // Auto-clear after duration
    setTimeout(() => {
      actor.context.notifications = actor.context.notifications.filter(
        n => n.id !== notification.id
      );
      actor.actorEngine.rerender(actor);
    }, duration);
    
    console.log(`📬 Notification: ${message} (${type})`);
  }
};
```

## Creating a Tool Module

### Step 1: Organize Tool Files

```
o/tools/
└── notifications/
    ├── show.tool.maia
    ├── show.tool.js
    ├── clear.tool.maia
    ├── clear.tool.js
    ├── clearAll.tool.maia
    └── clearAll.tool.js
```

### Step 2: Create Tool Definitions

**`o/tools/notifications/show.tool.maia`:**
```json
{
  "$type": "tool",
  "$id": "tool_notifications_show",
  "name": "@notifications/show",
  "description": "Display a notification",
  "parameters": {
    "type": "object",
    "properties": {
      "message": {"type": "string", "required": true},
      "type": {"type": "string", "enum": ["info", "success", "error"]},
      "duration": {"type": "number", "default": 3000}
    }
  }
}
```

**`o/tools/notifications/clear.tool.maia`:**
```json
{
  "$type": "tool",
  "$id": "tool_notifications_clear",
  "name": "@notifications/clear",
  "description": "Clear a specific notification by ID",
  "parameters": {
    "type": "object",
    "properties": {
      "id": {"type": "string", "required": true}
    }
  }
}
```

### Step 3: Implement Tool Functions

**`o/tools/notifications/show.tool.js`:**
```javascript
export default {
  async execute(actor, payload) {
    const { message, type = 'info', duration = 3000 } = payload;
    
    if (!actor.context.notifications) {
      actor.context.notifications = [];
    }
    
    const notification = {
      id: Date.now().toString(),
      message,
      type,
      timestamp: Date.now()
    };
    
    actor.context.notifications.push(notification);
    
    setTimeout(() => {
      actor.context.notifications = actor.context.notifications.filter(
        n => n.id !== notification.id
      );
      actor.actorEngine.rerender(actor);
    }, duration);
    
    console.log(`✅ [notifications/show] ${message} (${type})`);
  }
};
```

**`o/tools/notifications/clear.tool.js`:**
```javascript
export default {
  async execute(actor, payload) {
    const { id } = payload;
    
    if (!actor.context.notifications) return;
    
    const before = actor.context.notifications.length;
    actor.context.notifications = actor.context.notifications.filter(
      n => n.id !== id
    );
    const after = actor.context.notifications.length;
    
    console.log(`✅ [notifications/clear] Cleared notification ${id} (${before - after} removed)`);
  }
};
```

**`o/tools/notifications/clearAll.tool.js`:**
```javascript
export default {
  async execute(actor, payload) {
    const count = actor.context.notifications?.length || 0;
    actor.context.notifications = [];
    console.log(`✅ [notifications/clearAll] Cleared ${count} notifications`);
  }
};
```

### Step 4: Create Module Definition

**`o/modules/notifications.module.js`:**
```javascript
export class NotificationsModule {
  static async register(registry, toolEngine) {
    const tools = ['show', 'clear', 'clearAll'];
    
    console.log(`[NotificationsModule] Registering ${tools.length} tools...`);
    
    for (const tool of tools) {
      await toolEngine.registerTool(
        `notifications/${tool}`,      // Tool path (relative to o/tools/)
        `@notifications/${tool}`       // Tool name (namespace + name)
      );
    }
    
    registry.registerModule('notifications', NotificationsModule, {
      version: '1.0.0',
      description: 'User notification system',
      namespace: '@notifications',
      tools: tools.map(t => `@notifications/${t}`)
    });
    
    console.log('[NotificationsModule] Registration complete');
  }
}

export default NotificationsModule;
```

### Step 5: Load Module at Boot

```javascript
// In your app's index.html or boot script
const os = await MaiaOS.boot({
  modules: ['core', 'mutation', 'dragdrop', 'notifications']
});
```

### Step 6: Use in State Machine

```json
{
  "states": {
    "idle": {
      "on": {
        "CREATE_TODO": "creating"
      }
    },
    "creating": {
      "entry": [
        {
          "tool": "@mutation/create",
          "payload": {
            "schema": "todos",
            "data": {"text": "$newTodoText", "done": false}
          }
        },
        {
          "tool": "@notifications/show",
          "payload": {
            "message": "Todo created!",
            "type": "success",
            "duration": 2000
          }
        }
      ],
      "on": {
        "SUCCESS": "idle"
      }
    }
  }
}
```

## Advanced Tool Patterns

### Tool with External API

```javascript
// o/tools/api/fetchWeather.tool.js
export default {
  async execute(actor, payload) {
    const { city } = payload;
    
    try {
      const response = await fetch(
        `https://api.weather.com/v1/current?city=${city}`
      );
      
      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Store in context
      actor.context.weather = {
        city,
        temperature: data.temp,
        condition: data.condition,
        timestamp: Date.now()
      };
      
      console.log(`✅ [api/fetchWeather] Got weather for ${city}: ${data.temp}°`);
    } catch (error) {
      console.error(`❌ [api/fetchWeather] Failed:`, error);
      throw error; // Will trigger ERROR event in state machine
    }
  }
};
```

### Tool with Database Integration

```javascript
// o/tools/db/saveToDatabase.tool.js
export default {
  async execute(actor, payload) {
    const { collection, data } = payload;
    
    try {
      // Use IndexedDB, localStorage, or external DB
      const db = await openDB('myapp', 1);
      const tx = db.transaction(collection, 'readwrite');
      const store = tx.objectStore(collection);
      
      const id = await store.add(data);
      
      // Update context with saved ID
      if (actor.context[collection]) {
        const item = actor.context[collection].find(i => i.id === data.id);
        if (item) {
          item.dbId = id;
        }
      }
      
      await tx.done;
      console.log(`✅ [db/saveToDatabase] Saved to ${collection}: ${id}`);
    } catch (error) {
      console.error(`❌ [db/saveToDatabase] Failed:`, error);
      throw error;
    }
  }
};
```

### Tool with Complex Validation

```javascript
// o/tools/validation/validateEmail.tool.js
export default {
  async execute(actor, payload) {
    const { email, field = 'email' } = payload;
    
    // Validation logic
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(email);
    
    // Store validation result in context
    if (!actor.context.validation) {
      actor.context.validation = {};
    }
    
    actor.context.validation[field] = {
      value: email,
      isValid,
      error: isValid ? null : 'Invalid email format',
      timestamp: Date.now()
    };
    
    if (!isValid) {
      throw new Error('Invalid email format');
    }
    
    console.log(`✅ [validation/validateEmail] Valid: ${email}`);
  }
};
```

### Tool with Side Effects (Analytics)

```javascript
// o/tools/analytics/trackEvent.tool.js
export default {
  async execute(actor, payload) {
    const { event, properties = {} } = payload;
    
    // Send to analytics service
    if (window.gtag) {
      window.gtag('event', event, properties);
    }
    
    // Log to console in development
    if (import.meta.env.DEV) {
      console.log(`📊 [analytics/trackEvent] ${event}`, properties);
    }
    
    // Store in context for debugging
    if (!actor.context.analyticsEvents) {
      actor.context.analyticsEvents = [];
    }
    
    actor.context.analyticsEvents.push({
      event,
      properties,
      timestamp: Date.now()
    });
    
    // Keep only last 50 events
    if (actor.context.analyticsEvents.length > 50) {
      actor.context.analyticsEvents.shift();
    }
  }
};
```

## Generic vs Specific Tools

### Generic Tool Pattern
Works with any schema/data:

```javascript
// @mutation/create (generic)
export default {
  async execute(actor, payload) {
    const { schema, data } = payload;
    const entity = { id: Date.now().toString(), ...data };
    actor.context[schema].push(entity);
  }
};
```

Usage:
```json
{"tool": "@mutation/create", "payload": {"schema": "todos", "data": {...}}}
{"tool": "@mutation/create", "payload": {"schema": "notes", "data": {...}}}
```

### Specific Tool Pattern
Hardcoded for one use case:

```javascript
// @todos/createTodo (specific)
export default {
  async execute(actor, payload) {
    const { text } = payload;
    const todo = {
      id: Date.now().toString(),
      text,
      done: false,
      createdAt: Date.now()
    };
    actor.context.todos.push(todo);
  }
};
```

**When to use which:**
- **Generic** - Library tools (core, mutation, dragdrop)
- **Specific** - App-specific business logic

## Tool Best Practices

### ✅ DO:

- **Validate inputs** - Check required fields
- **Handle errors gracefully** - Try/catch and meaningful messages
- **Log operations** - Help debugging
- **Keep pure** - No global state, only `actor.context`
- **Be async** - Even if synchronous (consistency)
- **Document parameters** - Clear JSON schema
- **Use schema-agnostic patterns** - When possible

### ❌ DON'T:

- **Don't mutate actor properties** - Only `context` is safe
- **Don't call other tools directly** - Use state machine
- **Don't store state in tool** - Stateless functions only
- **Don't block** - Async operations should be fast
- **Don't use globals** - Pass everything via payload
- **Don't hardcode** - Parameterize when possible

## Testing Tools

```javascript
// test-notification-tool.js
import notifyTool from './o/tools/notifications/show.tool.js';

describe('Notification Tool', () => {
  it('should add notification to context', async () => {
    const mockActor = {
      context: {},
      actorEngine: {
        rerender: jest.fn()
      }
    };
    
    const payload = {
      message: 'Test notification',
      type: 'info',
      duration: 1000
    };
    
    await notifyTool.execute(mockActor, payload);
    
    expect(mockActor.context.notifications).toHaveLength(1);
    expect(mockActor.context.notifications[0].message).toBe('Test notification');
  });
  
  it('should auto-clear after duration', async () => {
    const mockActor = {
      context: {},
      actorEngine: { rerender: jest.fn() }
    };
    
    await notifyTool.execute(mockActor, {
      message: 'Test',
      type: 'info',
      duration: 100
    });
    
    expect(mockActor.context.notifications).toHaveLength(1);
    
    await new Promise(resolve => setTimeout(resolve, 150));
    
    expect(mockActor.context.notifications).toHaveLength(0);
  });
});
```

## Module Configuration

Advanced module with configuration:

```javascript
export class DatabaseModule {
  static config = {
    dbName: 'myapp',
    version: 1,
    stores: ['todos', 'notes', 'users']
  };
  
  static async register(registry, toolEngine) {
    // Initialize database
    const db = await this._initDatabase();
    
    // Pass db instance to tools (via closure)
    const tools = ['save', 'load', 'delete'];
    
    for (const tool of tools) {
      const toolPath = `db/${tool}`;
      const toolName = `@db/${tool}`;
      
      // Load and augment tool with db instance
      const toolModule = await import(`../tools/${toolPath}.tool.js`);
      toolModule.db = db;
      
      await toolEngine.registerTool(toolPath, toolName);
    }
    
    registry.registerModule('database', DatabaseModule, {
      version: '1.0.0',
      namespace: '@db',
      tools: tools.map(t => `@db/${t}`),
      config: this.config
    });
  }
  
  static async _initDatabase() {
    // IndexedDB initialization
    return await openDB(this.config.dbName, this.config.version, {
      upgrade(db) {
        for (const store of DatabaseModule.config.stores) {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: 'id', autoIncrement: true });
          }
        }
      }
    });
  }
}
```

## Next Steps

- Read [Engines Guide](./engines.md) - Creating custom engines
- Read [DSL Guide](./dsl.md) - Defining new DSL types
- Read [MaiaOS Guide](./maiaos.md) - Understanding the system

---

