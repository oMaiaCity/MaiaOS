# MaiaOS Documentation for Creators

**Auto-generated:** 2026-01-19T23:44:45.783Z
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

# VIBES

*Source: creators/00-vibes.md*

# Vibes (App Manifests)

**Vibes** are marketplace-ready app manifests that describe a MaiaOS application. They provide metadata for discovery and reference the root actor that powers the app.

## What is a Vibe?

A vibe is a JSON manifest file (`.vibe.maia`) that serves as an "app store listing" for your MaiaOS application. Think of it as the packaging around your actor-based app that makes it discoverable and installable.

**What vibes provide:**
- App metadata (name, description)
- Reference to the root actor (always a **service actor**)
- Marketplace/catalog integration
- Single entry point for loading apps

**What vibes are NOT:**
- Not the app itself (that's the actor)
- Not execution logic (that's in state machines and tools)
- Not UI definitions (that's in views)

> **Analogy:** If actors are the "executable," vibes are the "app store listing" that describes and loads them.

### Default Pattern: Service Actor Entry Point

**By default, every vibe loads a service actor** as its entry point. This service actor orchestrates the application and loads UI actors as children.

```
Vibe → Service Actor → Composite Actor → UI Actors
```

This pattern ensures:
- ✅ Clear separation of concerns (service logic vs. UI)
- ✅ Scalable architecture (add UI actors as needed)
- ✅ Message-based communication (loose coupling)
- ✅ Consistent structure across all vibes

## Vibe Structure

Create a file named `{name}.vibe.maia`:

```json
{
  "$type": "vibe",
  "$id": "vibe_myapp_001",
  "name": "My App",
  "description": "A description of what this app does",
  "actor": "./myapp.actor.maia"
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `$type` | string | Always `"vibe"` |
| `$id` | string | Unique identifier for this vibe |
| `name` | string | Display name for marketplace |
| `description` | string | Brief description of the app |
| `actor` | string | Relative path to root actor file |

### Field Details

**`$type`:** Discriminator field that identifies this as a vibe manifest.

**`$id`:** Unique identifier following the pattern `vibe_{name}_{number}`. Used for internal references.

**`name`:** The human-readable name that appears in marketplace listings, app launchers, etc.

**`description`:** A brief (1-3 sentence) description of what the app does. This appears in marketplace cards and search results.

**`actor`:** Relative path to the root actor file. The path is resolved relative to the vibe manifest location.

## Creating a Vibe

### Step 1: Organize Your App

Structure your app directory:

```
my-app/
├── myapp.vibe.maia       # Vibe manifest
├── myapp.actor.maia      # Root actor
├── myapp.context.maia    # Runtime data
├── myapp.state.maia      # State machine
├── myapp.view.maia       # UI definition
└── myapp.style.maia      # Styling (optional)
```

### Step 2: Create the Vibe Manifest

**`myapp.vibe.maia`:**
```json
{
  "$type": "vibe",
  "$id": "vibe_myapp_001",
  "name": "My Todo App",
  "description": "A simple todo list with drag-and-drop organization",
  "actor": "./myapp.actor.maia"
}
```

### Step 3: Create Your Root Service Actor

The actor referenced in the vibe is your app's entry point - **always a service actor**:

**`myapp.actor.maia` (Service Actor):**
```json
{
  "$type": "actor",
  "$id": "actor_myapp_001",
  "id": "actor_myapp_001",
  "role": "service",
  "contextRef": "myapp",
  "stateRef": "myapp",
  "viewRef": "myapp",      // ← Minimal view (only renders child)
  "styleRef": "brand",
  "children": {
    "composite": "actor_composite_001"  // ← Loads first UI actor
  }
}
```

**Service Actor View (Minimal):**
```json
{
  "$type": "view",
  "container": {
    "tag": "div",
    "class": "service-container",
    "$slot": "$composite"  // ← Only renders child actor
  }
}
```

The service actor orchestrates the application and loads UI actors as children. See [Actors](./02-actors.md#default-vibe-pattern-service--composite--ui) for the complete pattern.

## Loading Vibes

### In HTML Applications

```html
<!DOCTYPE html>
<html>
<head>
  <title>My App</title>
</head>
<body>
  <div id="app-container"></div>
  
  <script type="module">
    import { MaiaOS } from './o/kernel.js';
    
    async function boot() {
      // Boot MaiaOS
      const os = await MaiaOS.boot({
        modules: ['db', 'core', 'dragdrop', 'interface']
      });
      
      // Load vibe
      const { vibe, actor } = await os.loadVibe(
        './vibes/myapp/myapp.vibe.maia',
        document.getElementById('app-container')
      );
      
      console.log('Loaded vibe:', vibe.name);
      console.log('Actor ready:', actor.id);
    }
    
    boot();
  </script>
</body>
</html>
```

### What Happens When You Load a Vibe?

```
os.loadVibe(path, container)
  ↓
1. Fetch vibe manifest
  ↓
2. Validate vibe structure
  ↓
3. Resolve actor path (relative to vibe)
  ↓
4. Load and create actor
  ↓
5. Return { vibe, actor }
```

The `loadVibe()` method:
- Fetches the vibe manifest from the specified path
- Validates that it's a proper vibe (`$type: "vibe"`)
- Resolves the actor path relative to the vibe location
- Calls `os.createActor()` with the resolved path
- Returns both the vibe metadata and the created actor

## Vibe vs Actor vs View

Understanding the hierarchy:

```
Vibe (App Manifest)
  └── Actor (Component)
        ├── Context (Runtime Data)
        ├── State (Behavior)
        ├── View (UI)
        └── Style (Appearance)
```

**Vibe:**
- Marketplace metadata
- Entry point reference
- What users see in app store

**Actor:**
- Component definition
- References to behavior and UI
- What the app actually is

**View:**
- UI structure
- What users see when running the app

> **Think of it like this:**
> - **Vibe** = App Store listing
> - **Actor** = Installed application
> - **View** = Application window

## Example: Complete Todo App

### Directory Structure

```
vibes/todos/
├── todos.vibe.maia         # App manifest
├── index.html              # App launcher
├── vibe/                   # Service actor (entry point)
│   ├── vibe.actor.maia    # Service actor definition
│   ├── vibe.context.maia   # Service actor context
│   ├── vibe.state.maia     # Service actor state machine
│   ├── vibe.view.maia      # Minimal view (renders child)
│   └── vibe.interface.maia # Message interface
├── composite/              # Composite actor (first UI actor)
│   ├── composite.actor.maia
│   ├── composite.context.maia
│   ├── composite.state.maia
│   ├── composite.view.maia
│   └── composite.interface.maia
├── list/                   # UI actor
│   ├── list.actor.maia
│   ├── list.context.maia
│   ├── list.state.maia
│   ├── list.view.maia
│   └── list.interface.maia
├── kanban/                 # UI actor
│   ├── kanban.actor.maia
│   ├── kanban.context.maia
│   ├── kanban.state.maia
│   ├── kanban.view.maia
│   └── kanban.interface.maia
└── brand.style.maia        # Shared design system
```

### Vibe Manifest

**`todos.vibe.maia`:**
```json
{
  "$type": "vibe",
  "$id": "vibe_todos_001",
  "name": "Todo List",
  "description": "A complete todo list application with state machines, drag-drop kanban view, and AI-compatible tools. Showcases MaiaOS actor system, message passing, and declarative UI.",
  "actor": "./vibe/vibe.actor.maia"
}
```

**Note:** The vibe references a **service actor** (`vibe/vibe.actor.maia`) which orchestrates the application and loads UI actors as children.

### Launcher HTML

**`index.html`:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Todos</title>
</head>
<body>
  <div id="actor-todo"></div>
  
  <script type="module">
    import { MaiaOS } from '../../o/kernel.js';
    
    async function boot() {
      const os = await MaiaOS.boot({
        modules: ['db', 'core', 'dragdrop', 'interface']
      });
      
      // Load the vibe
      const { vibe, actor } = await os.loadVibe(
        './todos.vibe.maia',
        document.getElementById('actor-todo')
      );
      
      console.log('✅ Vibe loaded:', vibe.name);
      
      // Expose for debugging
      window.vibe = vibe;
      window.actor = actor;
    }
    
    boot();
  </script>
</body>
</html>
```

## Best Practices

### ✅ DO:

- **Keep descriptions concise** - 1-3 sentences max
- **Use semantic naming** - `todos.vibe.maia`, not `app.vibe.maia`
- **Match vibe and actor names** - `todos.vibe.maia` → `todo.actor.maia`
- **Use relative paths** - `"./actor.maia"` not absolute paths
- **One vibe per app** - Each app gets its own vibe manifest

### ❌ DON'T:

- **Don't hardcode absolute paths** - Use relative paths
- **Don't include logic** - Vibes are metadata only
- **Don't duplicate actor properties** - Vibe references actor, doesn't contain it
- **Don't skip validation** - Always include `$type: "vibe"`
- **Don't nest actors** - Reference one root actor only

## Marketplace Integration (Future)

Vibes are designed to support future marketplace features:

**Planned Fields (v0.5+):**
- `icon` - Path to app icon
- `screenshots` - Array of screenshot paths
- `tags` - Array of category tags
- `category` - Primary app category
- `license` - License type (MIT, GPL, etc.)
- `repository` - Source code URL
- `homepage` - App website URL

**Example Future Vibe:**
```json
{
  "$type": "vibe",
  "$id": "vibe_todos_001",
  "name": "Todo List",
  "description": "A complete todo list application...",
  "actor": "./todo.actor.maia",
  "icon": "./icon.svg",
  "screenshots": ["./screenshots/list.png", "./screenshots/kanban.png"],
  "tags": ["productivity", "task-management"],
  "category": "productivity",
  "license": "MIT",
  "repository": "https://github.com/MaiaOS/todos",
  "homepage": "https://maiaos.dev/vibes/todos"
}
```

## Debugging Vibes

### Accessing Vibe Data

```javascript
// After loading
const { vibe, actor } = await os.loadVibe('./app.vibe.maia', container);

// Inspect vibe
console.log(vibe.name);        // "My App"
console.log(vibe.description); // "App description"
console.log(vibe.actor);       // "./myapp.actor.maia"
console.log(vibe.$id);         // "vibe_myapp_001"

// Inspect actor (as usual)
console.log(actor.id);         // "actor_myapp_001"
console.log(actor.context);    // Runtime state
```

### Common Issues

**Error: "Failed to load vibe"**
- Check that the vibe file exists at the specified path
- Verify the path is correct relative to your HTML file

**Error: "Invalid vibe manifest: $type must be 'vibe'"**
- Ensure your JSON has `"$type": "vibe"`
- Check for typos in the $type field

**Error: "Vibe manifest missing 'actor' field"**
- Add the `"actor"` field with path to your actor file
- Verify the actor path is relative to the vibe location

**Actor fails to load**
- Check that the actor file exists at the path specified in the vibe
- Verify the path is relative to the vibe location (not the HTML file)

## Next Steps

- Learn about [Kernel](./01-kernel.md) - How to boot MaiaOS and load vibes
- Understand [Actors](./02-actors.md) - What vibes reference
- Explore [State Machines](./05-state.md) - Actor behavior
- Create [Views](./07-views.md) - Actor UI

---

**Remember:** Vibes are the "app store wrapper" around your actors. They make your apps discoverable, installable, and marketplace-ready!

---

# KERNEL

*Source: creators/01-kernel.md*

# Kernel Loader (Getting Started)

The **Kernel** is the single entry point for MaiaOS. It boots the operating system, loads modules, and creates your first actor.

## Quick Start

### 1. Basic HTML Setup

```html
<!DOCTYPE html>
<html>
<head>
  <title>My First MaiaOS App</title>
</head>
<body>
  <!-- Actor container -->
  <div id="actor-todo"></div>

  <!-- Import MaiaOS Kernel -->
  <script type="module">
    import { MaiaOS } from '../../o/kernel.js';
    
    async function boot() {
      // Boot the operating system
      const os = await MaiaOS.boot({
        modules: ['db', 'core', 'dragdrop', 'interface']
      });
      
      // Create an actor
      const actor = await os.createActor(
        './maia/todo.actor.maia',
        document.getElementById('actor-todo')
      );
      
      console.log('✅ App booted!', actor);
    }
    
    boot();
  </script>
</body>
</html>
```

### 2. Boot Configuration

```javascript
const os = await MaiaOS.boot({
  // Modules to load (default: ['db', 'core', 'dragdrop', 'interface'])
  modules: ['db', 'core', 'dragdrop', 'interface']
});
```

## What Happens During Boot?

1. **Initialize Module Registry** - Prepares dynamic module loading
2. **Initialize Engines** - Boots all execution engines:
   - `ActorEngine` - Manages actor lifecycle
   - `StateEngine` - Interprets state machines
   - `ViewEngine` - Renders views
   - `ToolEngine` - Executes tools
   - `StyleEngine` - Compiles styles
   - `MaiaScriptEvaluator` - Evaluates DSL expressions
3. **Load Modules** - Dynamically loads specified modules
4. **Register Tools** - Each module registers its tools

## Available Modules

### Database Module (`db`)
Unified database operations through a single `@db` tool:
- All operations use `op` parameter (`create`, `update`, `delete`, `toggle`, `query`, `seed`)
- Example: `{ tool: "@db", payload: { op: "create", schema: "@schema/todos", data: {...} } }`
- Reactive query objects automatically keep data in sync
- See [State Machines](./05-state.md) for data patterns

### Core Module (`core`)
UI utilities and message publishing:
- `@core/publishMessage` - Publish messages to subscribed actors
- `@core/noop` - No-operation (for testing)
- `@core/preventDefault` - Prevent default events
- `@core/openModal` - Open modal dialogs (if using modals)
- `@core/closeModal` - Close modals (if using modals)

### Drag-Drop Module (`dragdrop`)
Generic drag-and-drop for any schema/field:
- `@dragdrop/start` - Start drag operation
- `@dragdrop/end` - End drag operation
- `@dragdrop/drop` - Handle drop with field update
- `@dragdrop/dragEnter` - Visual feedback on enter
- `@dragdrop/dragLeave` - Visual feedback on leave

### Interface Module (`interface`)
Actor interface validation:
- `@interface/validate` - Validate actor message contracts
- Ensures actors communicate with correct message structures

## Creating Actors

### Direct Actor Creation

```javascript
// Create a single actor
const todoActor = await os.createActor(
  './maia/todo.actor.maia',      // Actor definition path
  document.getElementById('app')  // Container element
);

// Create multiple actors
const actors = await Promise.all([
  os.createActor('./maia/todo.actor.maia', document.getElementById('todos')),
  os.createActor('./maia/notes.actor.maia', document.getElementById('notes')),
  os.createActor('./maia/calendar.actor.maia', document.getElementById('cal'))
]);
```

### Loading Vibes (Recommended)

**Vibes** are app manifests that provide marketplace metadata and reference the root actor. This is the recommended way to load applications:

```javascript
// Load a vibe (app manifest)
const { vibe, actor } = await os.loadVibe(
  './vibes/todos/todos.vibe.maia',
  document.getElementById('app')
);

console.log('Loaded vibe:', vibe.name);        // "Todo List"
console.log('Description:', vibe.description); // App description
console.log('Actor:', actor);                  // Created actor instance
```

**What's the difference?**
- `createActor()` - Direct actor creation (low-level)
- `loadVibe()` - Load app via manifest (recommended, marketplace-ready)

**Learn more:** See [Vibes](./00-vibes.md) for complete documentation on app manifests.

## Accessing the OS

The booted OS instance provides:

```javascript
// Get an actor by ID
const actor = os.getActor('actor_todo_001');

// Send a message to an actor
os.sendMessage('actor_todo_001', {
  type: 'notification',
  data: {text: 'Task completed!'}
});

// Access engines for debugging
const engines = os.getEngines();
console.log(engines.stateEngine, engines.toolEngine);

// Expose globally for debugging (optional)
window.os = os;
window.engines = engines;
```

## File Structure

Your project should be organized like this:

```
my-app/
├── index.html              # Your app entry point
└── maia/                   # Actor definitions
    ├── todo.actor.maia     # Actor config
    ├── todo.state.maia     # State machine
    ├── todo.view.maia      # UI definition
    ├── todo.style.maia     # Styling (optional)
    └── brand.style.maia    # Design system (optional)
```

## Development Server

For development with hot reload:

```bash
cd libs/maia-script
bun dev
```

Then navigate to `http://localhost:4200/examples/todos/`

## Console Output

On successful boot, you'll see:

```
🚀 Booting MaiaOS v0.4...
📦 Kernel: Module-based architecture
🤖 State Machines: AI-compatible actor coordination
📨 Message Passing: Actor-to-actor communication
🔧 Tools: Dynamic modular loading
📦 Loading 4 modules...
[DBModule] Registering 1 tool (@db)...
[CoreModule] Registering 5 tools...
[DragDropModule] Registering 5 tools...
[InterfaceModule] Registering 1 tool...
✅ Loaded 4 modules
✅ Registered 12 tools
✅ MaiaOS booted successfully
```

## Next Steps

- Learn about [Actors](./02-actors.md) - The building blocks
- Understand [State Machines](./05-state.md) - Actor behavior
- Explore [Tools](./06-tools.md) - Executable actions
- Add [Views](./07-views.md) - UI representation

## Troubleshooting

### Module not loading
```
Error: Failed to load module "dragdrop"
```
**Solution:** Check that the module file exists at `o/modules/dragdrop.module.js`

### Tool not found
```
[ToolEngine] Tool not found: @db
```
**Solution:** Ensure the `db` module is loaded in boot config

### Actor fails to load
```
Failed to load actor: ./maia/todo.actor.maia
```
**Solution:** Check file path is relative to your `index.html` location

---

# ACTORS

*Source: creators/02-actors.md*

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

MaiaOS distinguishes between two fundamental actor types based on their responsibilities and whether they render UI:

### Service Actors

**Service actors** are orchestrating actors responsible for business logic, data management, and coordination. They typically have **no view** (or a minimal view that only renders child actors).

**Characteristics:**
- ✅ Orchestrate data queries and mutations
- ✅ Manage application-level state
- ✅ Coordinate between UI actors
- ✅ Handle message routing and business logic
- ❌ No direct UI rendering (or minimal container view)

**Example: Vibe Service Actor (Default Entry Point)**
```json
{
  "$type": "actor",
  "$id": "actor_vibe_001",
  "role": "service",
  "contextRef": "vibe/vibe",
  "viewRef": "vibe/vibe",      // ← Minimal view (only renders child)
  "stateRef": "vibe/vibe",
  "interfaceRef": "vibe/vibe",
  "children": {
    "composite": "actor_composite_001"  // ← Loads first UI actor
  },
  "subscriptions": [
    "actor_composite_001",
    "actor_list_001",
    "actor_kanban_001"
  ]
}
```

**Service Actor View (Minimal):**
```json
{
  "$type": "view",
  "container": {
    "tag": "div",
    "class": "service-container",
    "$slot": "$composite"  // ← Only renders child actor
  }
}
```

**Use cases:**
- **Vibe entry points** (default pattern - every vibe loads a service actor)
- Data synchronization services
- Background workers
- API coordinators
- Business logic orchestration

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
  "$type": "actor",
  "$id": "actor_list_001",
  "role": "ui",
  "viewRef": "list/list",      // ← Full UI view
  "stateRef": "list/list",
  "contextRef": "list/list",
  "subscriptions": ["actor_vibe_001"]  // ← Subscribes to service actor
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
  "$type": "actor",
  "$id": "actor_composite_001",
  "role": "composite-view",
  "viewRef": "composite/composite",
  "stateRef": "composite/composite",
  "children": {
    "list": "actor_list_001",      // ← Child UI actors
    "kanban": "actor_kanban_001"
  },
  "subscriptions": ["actor_vibe_001"]  // ← Subscribes to service actor
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

### Step 1: Vibe Loads Service Actor

Every vibe's entry point is a **service actor** that orchestrates the application:

**`todos.vibe.maia`:**
```json
{
  "$type": "vibe",
  "$id": "vibe_todos_001",
  "name": "Todo List",
  "description": "A todo list application",
  "actor": "./vibe/vibe.actor.maia"  // ← Service actor
}
```

### Step 2: Service Actor Loads Composite

The service actor loads a **composite actor** as its first child:

**`vibe.actor.maia` (Service Actor):**
```json
{
  "$type": "actor",
  "$id": "actor_vibe_001",
  "role": "service",
  "viewRef": "vibe/vibe",      // ← Minimal view
  "stateRef": "vibe/vibe",     // ← Orchestrates queries/mutations
  "children": {
    "composite": "actor_composite_001"  // ← First UI actor
  }
}
```

**Service Actor Responsibilities:**
- Orchestrate data queries (send `SUBSCRIBE_TO_TODOS` messages to UI actors)
- Handle mutations (`CREATE_BUTTON`, `TOGGLE_BUTTON`, `DELETE_BUTTON`)
- Manage application-level state
- Coordinate between UI actors via messages

### Step 3: Composite Actor Composes UI Actors

The composite actor provides shared UI structure and slots child UI actors:

**`composite.actor.maia`:**
```json
{
  "$type": "actor",
  "$id": "actor_composite_001",
  "role": "composite-view",
  "viewRef": "composite/composite",
  "children": {
    "list": "actor_list_001",      // ← UI actors
    "kanban": "actor_kanban_001"
  }
}
```

**Composite Actor Responsibilities:**
- Render shared UI (header, form, view switcher)
- Slot child UI actors based on context
- Forward UI events to service actor
- Receive state updates from service actor

### Step 4: UI Actors Render Components

Leaf UI actors render specific components:

**`list.actor.maia`:**
```json
{
  "$type": "actor",
  "$id": "actor_list_001",
  "role": "ui",
  "viewRef": "list/list",
  "stateRef": "list/list"
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

---

# CONTEXT

*Source: creators/04-context.md*

# Context (The Memory)

Think of context as your actor's **memory** - like a notebook where it writes things down!

**What's in the notebook?**
- What todos you have (`todos: [...]`)
- Whether a modal is open (`isModalOpen: false`)
- What text is in the input field (`newTodoText: "Buy milk"`)

Your actor looks at this notebook to know what to show and what to do!

## How It Works

```
1. You type "Buy milk" → Tool updates context: { newTodoText: "Buy milk" }
2. You click "Add" → Tool creates todo → Context updates: { todos: [...new todo] }
3. View looks at context → Sees new todo → Shows it on screen!
```

**The magic:** Your view automatically shows whatever is in context. Change the context, change what you see!

## Context Definition

Context can be defined inline in the actor file or in a separate `.context.maia` file.

### Option 1: Inline Context

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

### Option 2: Separate Context File (Recommended)

**`todo.context.maia`:**
```json
{
  "$type": "context",
  "$id": "context_todo_001",
  
  // Collections
  "todos": [],
  "notes": [],
  
  // Derived/filtered data
  "todosTodo": [],
  "todosDone": [],
  
  // UI state
  "viewMode": "list",
  "isModalOpen": false,
  
  // Form state
  "newTodoText": "",
  "editingId": null,
  
  // Drag-drop state
  "draggedItemId": null,
  "draggedItemSchema": null,
  "draggedItemIds": {},           // Item lookup object for conditional styling
  
  // Computed boolean flags (for conditional styling)
  "listButtonActive": true,
  "kanbanButtonActive": false
}
```

**`todo.actor.maia`:**
```json
{
  "$type": "actor",
  "id": "actor_todo_001",
  "contextRef": "todo",  // ← References todo.context.maia
  "stateRef": "todo"
}
```

**Benefits of Separate Files:**
- ✅ Cleaner actor definitions
- ✅ Easier to maintain large contexts
- ✅ Better separation of concerns
- ✅ Context can be shared or versioned independently

## Context Types

### 1. Reactive Data (Query Objects) ⭐

**Query objects** are special objects that tell MaiaOS "I want this data, and keep me updated when it changes."

**Format:**
```json
{
  "todos": {
    "schema": "@schema/todos",
    "filter": null
  }
}
```

**What this means:** "Give me all items from the 'todos' collection, and automatically update me when they change."

**How it works:**
1. You declare the query object in context
2. MaiaOS automatically subscribes to the database
3. When data changes, MaiaOS updates your context
4. Your view automatically re-renders

**Think of it like:** Subscribing to a newsletter - you tell them what you want, they send you updates automatically.

**Examples:**

```json
{
  "context": {
    // All todos (no filter)
    "todos": {
      "schema": "@schema/todos",
      "filter": null
    },
    
    // Only incomplete todos
    "todosTodo": {
      "schema": "@schema/todos",
      "filter": { "done": false }
    },
    
    // Only completed todos
    "todosDone": {
      "schema": "@schema/todos",
      "filter": { "done": true }
    }
  }
}
```

**When to use:**
- ✅ When you need data from the database
- ✅ When you want automatic updates
- ✅ When data can change (todos, notes, messages, etc.)

**Best practices:**
- Use descriptive names (`todosTodo`, not `t1`)
- Use filters to get only what you need
- Don't manually update these arrays (MaiaOS does it automatically)

See [Reactive Data System](../developers/06_reactive-queries.md) for detailed examples.

### 2. Collections (Arrays)
Static array data (not reactive):

```json
{
  "colors": ["red", "green", "blue"],
  "options": ["option1", "option2"]
}
```

**When to use:**
- Static configuration data
- Hardcoded options (not from database)
- Local temporary collections

**Best practices:**
- Use query objects for database data (reactive)
- Use arrays for static/local data only
- Keep entities flat when possible

### 3. UI State
View-related state:

```json
{
  "viewMode": "list",           // "list" | "kanban" | "grid"
  "isModalOpen": false,
  "selectedId": null,
  "activeTab": "all"
}
```

### 4. Form State
Input field values:

```json
{
  "newTodoText": "",
  "searchQuery": "",
  "filterTerm": ""
}
```

### 5. Transient State
Temporary runtime data:

```json
{
  "draggedItemId": null,
  "hoveredItemId": null,
  "loadingState": "idle"
}
```

### 6. Computed Boolean Flags
State machine computes boolean flags for conditional styling (no `$if` in views!):

```json
{
  "listButtonActive": true,        // Computed: viewMode === "list"
  "kanbanButtonActive": false,     // Computed: viewMode === "kanban"
  "isModalOpen": false             // Computed: modalState === "open"
}
```

**Pattern:** State machine computes → Context stores → View references → CSS styles

### 7. Item Lookup Objects
For item-specific conditional styling in lists:

```json
{
  "draggedItemIds": {              // Object mapping item IDs to boolean states
    "item-123": true,              // This item is being dragged
    "item-456": false              // This item is not being dragged
  },
  "selectedItemIds": {             // Multiple selections
    "item-123": true,
    "item-789": true
  }
}
```

**Pattern:** State machine maintains lookup object → View uses `"$draggedItemIds.$$id"` → ViewEngine looks up value → CSS styles

## Accessing Context

### From State Machines
Use `$` prefix to reference context fields:

```json
{
  "guard": {"$ne": ["$newTodoText", ""]},
  "payload": {
    "text": "$newTodoText",
    "mode": "$viewMode"
  }
}
```

### From Views
Use `$` prefix in expressions:

```json
{
  "tag": "input",
  "attrs": {
    "value": "$newTodoText",
    "placeholder": "What needs to be done?"
  }
}
```

### From JavaScript
Direct property access:

```javascript
// Read context
console.log(actor.context.todos);
console.log(actor.context.viewMode);

// Mutate context (via tools only!)
// ❌ Don't do this:
// actor.context.todos.push({...});

// ✅ Do this instead:
actor.actorEngine.stateEngine.send(
  actor.machine.id,
  'CREATE_TODO',
  {text: 'New todo'}
);
```

## Context Updates

### Via Tools
The ONLY way to mutate context:

```javascript
// @db tool with op: "create"
export default {
  async execute(actor, payload) {
    const { op, schema, data } = payload;
    if (op === "create") {
      const entity = { id: Date.now().toString(), ...data };
      actor.context[schema].push(entity);
    }
  }
};
```

### Via @context/update
Generic context field update:

```json
{
  "tool": "@context/update",
  "payload": {
    "newTodoText": "$$newTodoText",
    "viewMode": "kanban"
  }
}
```

JavaScript equivalent:

```javascript
export default {
  async execute(actor, payload) {
    Object.assign(actor.context, payload);
  }
};
```

## Context Best Practices

### ✅ DO:

- **Initialize all fields** - Avoid `undefined` values
- **Keep flat** - Avoid deeply nested objects
- **Use clear names** - `newTodoText` not `text` or `input`
- **Separate concerns** - Collections, UI state, form state
- **Store serializable data** - No functions, DOM refs, or classes
- **Use consistent naming** - `todosTodo`, `notesTodo` (pattern: `{schema}Todo`)
- **Compute boolean flags** - State machine computes, context stores, views reference
- **Use item lookup objects** - For item-specific conditional styling (e.g., `draggedItemIds`)

### ❌ DON'T:

- **Don't mutate directly** - Always use tools
- **Don't store UI elements** - No DOM references
- **Don't store functions** - Only JSON-serializable data
- **Don't mix concerns** - Separate data from UI state
- **Don't use reserved keys** - Avoid `$type`, `$id`, `inbox`, etc.
- **Don't compute in views** - All computation happens in state machine

## Context Schema Design

### Example: Todo Application

```json
{
  "context": {
    // Reactive data (query objects)
    "todos": {
      "schema": "@schema/todos",
      "filter": null
    },
    
    // Derived/filtered reactive data
    "todosTodo": {
      "schema": "@schema/todos",
      "filter": { "done": false }
    },
    "todosDone": {
      "schema": "@schema/todos",
      "filter": { "done": true }
    },
    
    // UI state
    "viewMode": "list",             // "list" | "kanban"
    "isModalOpen": false,           // boolean
    
    // Form state
    "newTodoText": "",              // string
    
    // Transient drag-drop state
    "draggedItemId": null,          // string | null
    "draggedItemSchema": null,      // string | null
    "draggedItemIds": {},           // { [itemId: string]: boolean } - Item lookup object
    
    // Computed boolean flags (for conditional styling)
    "listButtonActive": true,       // Computed by state machine
    "kanbanButtonActive": false     // Computed by state machine
  }
}
```

**Entity schema:**
```typescript
interface Todo {
  id: string;           // Auto-generated by @db tool
  text: string;         // User input
  done: boolean;        // Completion status
  createdAt?: number;   // Optional timestamp
}
```

### Example: Notes Application

```json
{
  "context": {
    "notes": [],                    // Array<Note>
    "selectedNoteId": null,         // string | null
    "searchQuery": "",              // string
    "filteredNotes": [],            // Array<Note> (search results)
    "editorContent": "",            // string
    "isSaving": false               // boolean
  }
}
```

## Context Reactivity

MaiaOS automatically updates your UI when data changes. There are two types of reactivity:

### 1. Reactive Data (Query Objects) - Automatic ✨

When you use **query objects** in context, MaiaOS automatically keeps them up to date:

```
User creates a todo (via @db tool)
  ↓
Database stores the new todo
  ↓
Database notifies observers: "Data changed!"
  ↓
SubscriptionEngine receives notification
  ↓
SubscriptionEngine updates context.todos = [new data]
  ↓
SubscriptionEngine schedules re-render (batched)
  ↓
ActorEngine.rerender(actor)
  ↓
ViewEngine re-renders with new context
  ↓
User sees new todo in the list! ✨
```

**Key insight:** You never manually update `context.todos`. SubscriptionEngine does it automatically when the database changes.

### 2. UI State - Manual (via Tools)

When you update **UI state** (like form inputs, view modes, etc.), you explicitly update context via tools:

```
Tool mutates context (via @context/update)
  ↓
Tool completes successfully
  ↓
StateEngine sends SUCCESS event
  ↓
State machine transitions
  ↓
ActorEngine.rerender(actor)
  ↓
ViewEngine re-renders with new context
  ↓
User sees updated UI
```

**Example:**

```json
{
  "tool": "@context/update",
  "payload": {
    "newTodoText": "",
    "viewMode": "kanban"
  }
}
```

### Summary

- **Query objects** → Automatic reactivity (MaiaOS watches for changes)
- **UI state** → Manual updates (you explicitly update via tools)
- **Both trigger re-renders** → Your view stays in sync

See [Reactive Data System](../developers/06_reactive-queries.md) for detailed examples.

## Derived Data Patterns

### Pattern 1: Filtered Query Objects (Recommended) ⭐

Use **query objects with filters** to get filtered data automatically:

```json
{
  "context": {
    "todosTodo": {
      "schema": "@schema/todos",
      "filter": { "done": false }
    },
    "todosDone": {
      "schema": "@schema/todos",
      "filter": { "done": true }
    }
  }
}
```

**What happens:**
- MaiaOS automatically fetches filtered data
- When a todo is toggled, it automatically moves between lists
- No manual filtering needed!

### Pattern 2: Compute Aggregates

Use computed values for counts, percentages, etc.:

```json
{
  "states": {
    "idle": {
      "entry": {
        "tool": "@context/update",
        "payload": {
          "todosCount": { "$length": "$todos" },
          "completedCount": { "$length": "$todosDone" },
          "progressPercent": {
            "$divide": [
              { "$multiply": ["$completedCount", 100] },
              "$todosCount"
            ]
          }
        }
      }
    }
  }
}
```

**Or compute in a custom tool:**

```javascript
// In custom @compute/stats tool
export default {
  async execute(actor, payload) {
    const todos = actor.context.todos;
    const completed = todos.filter(t => t.done);
    
    Object.assign(actor.context, {
      todosCount: todos.length,
      completedCount: completed.length,
      progressPercent: (completed.length / todos.length) * 100
    });
  }
};
```

### Pattern 3: Client-Side Filtering (For Search/Sort)

Use client-side filtering for dynamic UI filtering (search, sort):

```json
{
  "container": {
    "tag": "ul",
    "$each": {
      "items": {
        "$filter": {
          "items": "$todos",
          "condition": {
            "$contains": ["$$item.text", "$searchQuery"]
          }
        }
      },
      "template": {
        "tag": "li",
        "text": "$$item.text"
      }
    }
  }
}
```

**When to use each:**
- ✅ **Query object filters** - For persistent filters (incomplete vs. completed)
- ✅ **Client-side filters** - For temporary UI filters (search, sort)
- ✅ **Computed values** - For calculations (counts, percentages)

## Context Debugging

```javascript
// Expose actor globally
window.actor = actor;

// Inspect context
console.log(actor.context);

// Watch for changes
const originalRerender = actor.actorEngine.rerender;
actor.actorEngine.rerender = function(actor) {
  console.log('Context changed:', actor.context);
  return originalRerender.call(this, actor);
};

// Serialize context
console.log(JSON.stringify(actor.context, null, 2));
```

## Context Persistence

Context can be serialized and persisted:

```javascript
// Save to localStorage
localStorage.setItem(
  `actor_${actor.id}`,
  JSON.stringify(actor.context)
);

// Restore from localStorage
const saved = localStorage.getItem(`actor_${actor.id}`);
if (saved) {
  Object.assign(actor.context, JSON.parse(saved));
  actor.actorEngine.rerender(actor);
}

// Export/import
function exportContext(actor) {
  return JSON.stringify(actor.context);
}

function importContext(actor, jsonString) {
  Object.assign(actor.context, JSON.parse(jsonString));
  actor.actorEngine.rerender(actor);
}
```

## Context Validation

You can validate context structure:

```javascript
function validateContext(context, schema) {
  for (const [key, type] of Object.entries(schema)) {
    const value = context[key];
    
    if (type === 'array' && !Array.isArray(value)) {
      throw new Error(`Expected ${key} to be array`);
    }
    if (type === 'string' && typeof value !== 'string') {
      throw new Error(`Expected ${key} to be string`);
    }
    if (type === 'boolean' && typeof value !== 'boolean') {
      throw new Error(`Expected ${key} to be boolean`);
    }
  }
}

// Usage
validateContext(actor.context, {
  todos: 'array',
  newTodoText: 'string',
  viewMode: 'string',
  isModalOpen: 'boolean'
});
```

## Next Steps

- Learn about [State Machines](./05-state.md) - How context is orchestrated
- Explore [Tools](./06-tools.md) - How context is mutated
- Understand [Views](./07-views.md) - How context is rendered
- Read [Skills](./03-skills.md) - How AI queries context

---

# STATE

*Source: creators/05-state.md*

# State Machines (The Brain)

Imagine a traffic light:
- It has **states**: Green, Yellow, Red
- It **changes states**: Green → Yellow → Red → Green
- **Rules** decide when to change: "After 30 seconds, go to next state"

**That's a state machine!** Your actor has states too, and rules for when to change them.

## A Simple Example: Creating a Todo

Your todo app might have these states:
- **idle**: Waiting for you to do something
- **creating**: Adding a new todo to the database
- **error**: Something went wrong

**What happens when you click "Add Todo":**

```
State: idle
  ↓
User clicks "Add Todo" button
  ↓
State machine says: "Go to 'creating' state"
  ↓
State: creating
  ↓
Tool creates the todo in database
  ↓
Tool says: "SUCCESS!"
  ↓
State machine says: "Go back to 'idle' state"
  ↓
State: idle (with your new todo!)
```

The state machine is like a traffic controller - it decides what happens next!

## Basic Structure

Create a file named `{name}.state.maia`:

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
          "guard": {"$ne": ["$newTodoText", ""]}
        }
      }
    },
    "creating": {
      "entry": {
        "tool": "@db",
        "payload": {
          "op": "create",
          "schema": "@schema/todos",
          "data": {"text": "$newTodoText", "done": false}
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

## State Definition

```json
{
  "stateName": {
    "entry": {...},      // Action(s) when entering state
    "exit": {...},       // Action(s) when leaving state
    "on": {              // Event handlers
      "EVENT_NAME": {...}
    }
  }
}
```

### Entry/Exit Actions

```json
{
  "creating": {
    "entry": {
      "tool": "@db",
      "payload": { "op": "create", ... }
    }
  }
}
```

Or multiple actions:

```json
{
  "creating": {
    "entry": [
      {"tool": "@core/showLoading", "payload": {}},
      {"tool": "@db", "payload": { "op": "create", ... }}
    ]
  }
}
```

## Transitions

### Simple Transition
```json
{
  "on": {
    "CANCEL": "idle"  // Just target state
  }
}
```

### Guarded Transition
```json
{
  "on": {
    "SUBMIT": {
      "target": "submitting",
      "guard": {"$ne": ["$formData.email", ""]}  // Only if email not empty
    }
  }
}
```

### Self-Transition (No State Change)
```json
{
  "on": {
    "UPDATE_INPUT": {
      "target": "idle",  // Stay in same state
      "actions": [{"tool": "@context/update", "payload": {...}}]
    }
  }
}
```

## Guards (Conditions)

Guards determine if a transition should occur:

```json
{
  "guard": {"$ne": ["$field", ""]}  // Field not empty
}

{
  "guard": {"$eq": ["$status", "ready"]}  // Status equals "ready"
}

{
  "guard": {
    "$and": [
      {"$ne": ["$email", ""]},
      {"$gt": ["$email.length", 5]}
    ]
  }
}
```

### Guard Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `$eq` | Equal | `{"$eq": ["$status", "active"]}` |
| `$ne` | Not equal | `{"$ne": ["$text", ""]}` |
| `$gt` | Greater than | `{"$gt": ["$count", 0]}` |
| `$lt` | Less than | `{"$lt": ["$count", 100]}` |
| `$gte` | Greater/equal | `{"$gte": ["$age", 18]}` |
| `$lte` | Less/equal | `{"$lte": ["$length", 500]}` |
| `$and` | Logical AND | `{"$and": [guard1, guard2]}` |
| `$or` | Logical OR | `{"$or": [guard1, guard2]}` |
| `$not` | Logical NOT | `{"$not": guard}` |

## Payload Resolution

Use MaiaScript expressions in payloads:

### Context Variables (`$`)
```json
{
  "payload": {
    "text": "$newTodoText",      // From actor.context.newTodoText
    "mode": "$viewMode"
  }
}
```

### Event Payload (`$$`)
```json
{
  "payload": {
    "id": "$$id",                // From event payload (e.g., {id: "123"})
    "value": "$$value"
  }
}
```

### Nested Objects (Recursive Evaluation)
```json
{
  "payload": {
    "schema": "todos",
    "data": {
      "text": "$newTodoText",    // Evaluated recursively
      "done": false,             // Literal value
      "timestamp": "$now"
    }
  }
}
```

## Computing Boolean Flags for Conditional Styling

**Views contain zero conditional logic.** State machines compute boolean flags that views reference:

```json
{
  "SWITCH_VIEW": {
    "target": "idle",
    "actions": [{
      "tool": "@context/update",
      "payload": {
        "viewMode": "$$viewMode",
        "listButtonActive": {"$eq": ["$$viewMode", "list"]},      // Compute flag
        "kanbanButtonActive": {"$eq": ["$$viewMode", "kanban"]},   // Compute flag
        "currentView": {
          "$if": {
            "condition": {"$eq": ["$$viewMode", "list"]},
            "then": "@list",
            "else": "@kanban"
          }
        }
      }
    }]
  }
}
```

**View references:**
```json
{
  "attrs": {
    "data": "$listButtonActive"  // Simple reference, no conditionals!
  }
}
```

## Managing Item Lookup Objects

For item-specific conditional styling, tools maintain lookup objects in context:

```json
{
  "DRAG_START": {
    "target": "dragging",
    "actions": [{
      "tool": "@dragdrop/start",
      "payload": {"schema": "$$schema", "id": "$$id"}
    }]
  }
}
```

**Tool maintains lookup object:**
```javascript
// In @dragdrop/start tool
actor.context.draggedItemIds = actor.context.draggedItemIds || {};
actor.context.draggedItemIds[id] = true;  // Set this item as dragged
```

**View uses item lookup:**
```json
{
  "attrs": {
    "data": {
      "isDragged": "$draggedItemIds.$$id"  // Looks up draggedItemIds[item.id]
    }
  }
}
```

## Working with Data (Automatic Reactive Queries)

MaiaOS automatically keeps your data in sync - no tools needed! Just define what data you want in your context, and MaiaOS handles the rest.

### Think of it like a spreadsheet:
- You write formulas that reference other cells
- When you change a cell, all formulas update automatically
- You never have to manually "refresh" the spreadsheet

**That's how reactive queries work!**

### Quick Start: Getting Data

In your context file, define **query objects** that tell MaiaOS what data you want:

**`todos.context.maia`:**
```json
{
  "$type": "context",
  "todos": {
    "schema": "@schema/todos",
    "filter": null
  },
  "newTodoText": ""
}
```

**What happens:**
1. MaiaOS sees `todos` is a query object (has `schema` property)
2. MaiaOS automatically subscribes to the database
3. Data flows into `context.todos`
4. When data changes, MaiaOS updates `context.todos` automatically
5. Your view re-renders with fresh data

**No tools, no manual subscriptions - it just works!**

### Filtering Data

Want only incomplete todos? Use a filter:

```json
{
  "todos": {
    "schema": "@schema/todos",
    "filter": null
  },
  "todosTodo": {
    "schema": "@schema/todos",
    "filter": { "done": false }
  },
  "todosDone": {
    "schema": "@schema/todos",
    "filter": { "done": true }
  }
}
```

**Result:**
- `context.todos` = All todos
- `context.todosTodo` = Only incomplete todos (`done: false`)
- `context.todosDone` = Only completed todos (`done: true`)

All three automatically update when you create, update, or delete a todo!

### Creating, Updating, Deleting Data

Use the `@db` tool with different `op` values:

#### Create

```json
{
  "tool": "@db",
  "payload": {
    "op": "create",
    "schema": "@schema/todos",
    "data": {
      "text": "$newTodoText",
      "done": false
    }
  }
}
```

#### Update

```json
{
  "tool": "@db",
  "payload": {
    "op": "update",
    "schema": "@schema/todos",
    "id": "$$id",
    "data": {
      "text": "Updated text"
    }
  }
}
```

#### Delete

```json
{
  "tool": "@db",
  "payload": {
    "op": "delete",
    "schema": "@schema/todos",
    "id": "$$id"
  }
}
```

#### Toggle

```json
{
  "tool": "@db",
  "payload": {
    "op": "toggle",
    "schema": "@schema/todos",
    "id": "$$id",
    "field": "done"
  }
}
```

### Complete Example: Todo List

**Context:**
```json
{
  "todos": {
    "schema": "@schema/todos",
    "filter": null
  },
  "todosTodo": {
    "schema": "@schema/todos",
    "filter": { "done": false }
  },
  "todosDone": {
    "schema": "@schema/todos",
    "filter": { "done": true }
  },
  "newTodoText": "",
  "viewMode": "list"
}
```

**State Machine:**
```json
{
  "initial": "idle",
  "states": {
    "idle": {
      "on": {
        "UPDATE_INPUT": {
          "target": "idle",
          "actions": [{
            "tool": "@context/update",
            "payload": { "newTodoText": "$$value" }
          }]
        },
        "CREATE_TODO": {
          "target": "creating",
          "guard": {"$ne": ["$newTodoText", ""]}
        }
      }
    },
    "creating": {
      "entry": [
        {
          "tool": "@db",
          "payload": {
            "op": "create",
            "schema": "@schema/todos",
            "data": {
              "text": "$newTodoText",
              "done": false
            }
          }
        },
        {
          "tool": "@context/update",
          "payload": { "newTodoText": "" }
        }
      ],
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

**View:**
```json
{
  "children": [
    {
      "tag": "input",
      "attrs": {
        "value": "$newTodoText",
        "placeholder": "What needs to be done?"
      },
      "$on": {
        "input": {
          "send": "UPDATE_INPUT",
          "payload": { "value": "@inputValue" }
        },
        "keydown": {
          "send": "CREATE_TODO",
          "key": "Enter"
        }
      }
    },
    {
      "$each": {
        "items": "$todos",
        "template": {
          "tag": "div",
          "text": "$$text"
        }
      }
    }
  ]
}
```

### Best Practices

**✅ DO:**
- Define query objects in context (with `schema` property)
- Use `@db` tool for all data changes
- Use descriptive names (`todosTodo`, not `data1`)
- Filter in context, not in views
- Test with empty data (handle empty arrays gracefully)

**❌ DON'T:**
- Don't manually modify `context.todos` directly
- Don't use old `@mutation/*` or `@query/*` tools (deprecated)
- Don't filter data in views (use context filters instead)
- Don't forget to handle SUCCESS/ERROR events

### Troubleshooting

**Data Not Appearing:**
1. Is your context property a query object? (has `schema` property)
2. Check browser console for errors
3. Is the schema name correct? (e.g., `@schema/todos`)

**Data Not Updating:**
1. Are you using `@db` tool to modify data?
2. Is the schema name consistent between context and tool?
3. Check console logs for SUCCESS/ERROR events

## Complete Example: Todo State Machine

```json
{
  "$type": "state",
  "$id": "state_todo_001",
  "initial": "idle",
  
  "states": {
    "idle": {
      "on": {
        "UPDATE_INPUT": {
          "target": "idle",
          "actions": [{
            "tool": "@context/update",
            "payload": {"newTodoText": "$$newTodoText"}
          }]
        },
        "CREATE_TODO": {
          "target": "creating",
          "guard": {"$ne": ["$newTodoText", ""]}
        },
        "TOGGLE_TODO": {
          "target": "toggling",
          "guard": {"$ne": ["$$id", null]}
        },
        "DELETE_TODO": {
          "target": "deleting"
        },
        "SWITCH_VIEW": {
          "target": "idle",
          "actions": [{
            "tool": "@context/update",
            "payload": {
              "viewMode": "$$viewMode",
              "listButtonActive": {"$eq": ["$$viewMode", "list"]},
              "kanbanButtonActive": {"$eq": ["$$viewMode", "kanban"]},
              "currentView": {
                "$if": {
                  "condition": {"$eq": ["$$viewMode", "list"]},
                  "then": "@list",
                  "else": "@kanban"
                }
              }
            }
          }]
        }
      }
    },
    
    "creating": {
      "entry": {
        "tool": "@db",
        "payload": {
          "op": "create",
          "schema": "@schema/todos",
          "data": {"text": "$newTodoText", "done": false}
        }
      },
      "on": {
        "SUCCESS": "idle",
        "ERROR": "error"
      }
    },
    
    "toggling": {
      "entry": {
        "tool": "@db",
        "payload": {
          "op": "toggle",
          "schema": "@schema/todos",
          "id": "$$id",
          "field": "done"
        }
      },
      "on": {
        "SUCCESS": "idle",
        "ERROR": "error"
      }
    },
    
    "deleting": {
      "entry": {
        "tool": "@db",
        "payload": {
          "op": "delete",
          "schema": "@schema/todos",
          "id": "$$id"
        }
      },
      "on": {
        "SUCCESS": "idle",
        "ERROR": "error"
      }
    },
    
    "error": {
      "on": {
        "RETRY": "idle",
        "DISMISS": "idle"
      }
    }
  }
}
```

## Event Flow

```
User clicks button
  ↓
ViewEngine captures event
  ↓
StateEngine.send("CREATE_TODO", {text: "..."})
  ↓
StateEngine checks current state's "on" handlers
  ↓
Evaluates guard (if present)
  ↓
Executes exit actions (if leaving state)
  ↓
Transitions to target state
  ↓
Executes entry actions (tool invocations)
  ↓
Tool mutates actor.context
  ↓
StateEngine sends SUCCESS/ERROR event (auto)
  ↓
Handles SUCCESS/ERROR transition
  ↓
ActorEngine.rerender() (if state changed)
```

## Automatic Tool Events

When a tool executes in an `entry` action:
- Tool succeeds → StateEngine auto-sends `SUCCESS` event
- Tool fails → StateEngine auto-sends `ERROR` event

Handle these in your state definition:

```json
{
  "creating": {
    "entry": {"tool": "@db", "payload": { "op": "create", ... }},
    "on": {
      "SUCCESS": "idle",  // ← Automatic on tool success
      "ERROR": "error"    // ← Automatic on tool failure
    }
  }
}
```

## Best Practices

### ✅ DO:

- Keep states focused (single responsibility)
- Use guards to validate transitions
- Handle both SUCCESS and ERROR events
- Name states as nouns (idle, creating, loading)
- Name events as verbs (CREATE_TODO, TOGGLE_TODO)
- Use `$$` for event payloads, `$` for context
- **Compute boolean flags** - State machine computes, context stores, views reference
- **Maintain item lookup objects** - For item-specific conditional styling

### ❌ DON'T:

- Put logic in state machines (use tools)
- Create deeply nested states (keep flat)
- Forget error handling
- Use `$` for event payload fields
- Create cycles without exit conditions
- **Don't put conditionals in views** - Compute flags in state machine instead

## Debugging State Machines

```javascript
// Access state machine
actor.machine.currentState  // "idle", "creating", etc.

// Send events manually
actor.actorEngine.stateEngine.send(
  actor.machine.id,
  'CREATE_TODO',
  {text: 'Test todo'}
);

// View state definition
actor.machine.definition
```

## Next Steps

- Explore [Tools](./06-tools.md) - Actions state machines invoke
- Learn about [Views](./07-views.md) - How UI sends events
- Understand [Context](./04-context.md) - Data state machines manipulate
- Build a [Kanban Board](../examples/kanban-board.md) - See queries in action

---

# TOOLS

*Source: creators/06-tools.md*

# Tools (The Hands)

Think of tools as your actor's **hands** - they do the actual work!

**Your state machine says:** "Now is the time to create a todo!"

**The tool responds:** "Got it! Let me add that to the database for you."

## What Tools Do

Tools are where the actual work happens:
- Create a todo? That's a tool! (`@db` with `op: "create"`)
- Delete an item? That's a tool! (`@db` with `op: "delete"`)
- Send a message? That's a tool! (`@core/publishMessage`)

Your actor can't do anything without tools - they're the only way to actually make things happen.

## How It Works Together

```
State Machine (The Brain)  →  "Create a todo!"
     ↓
Tool (The Hands)          →  Actually creates it in the database
     ↓
Context (The Memory)      →  Updates with the new todo
     ↓
View (The Face)           →  Shows the new todo to the user
```

## Tool Structure

Each tool consists of two files:

### 1. Tool Definition (`.tool.maia`)
AI-compatible metadata describing the tool:

```json
{
  "$type": "tool",
  "$id": "tool_db_001",
  "name": "@db",
  "description": "Unified database operation tool",
  "parameters": {
    "type": "object",
    "properties": {
      "schema": {
        "type": "string",
        "description": "Collection name (e.g., 'todos', 'notes')"
      },
      "data": {
        "type": "object",
        "description": "Entity data (without ID, auto-generated)"
      }
    },
    "required": ["schema", "data"]
  }
}
```

### 2. Tool Function (`.tool.js`)
Executable JavaScript function:

```javascript
export default {
  async execute(actor, payload) {
    const { schema, data } = payload;
    
    // Create entity
    const entity = {
      id: Date.now().toString(),
      ...data
    };
    
    // Add to collection
    actor.context[schema].push(entity);
    
    console.log(`✅ Created ${schema}:`, entity);
  }
};
```

## Available Tools

### Database Module (`@db`)

The `@db` tool is a unified database operation tool that handles all CRUD operations through an `op` parameter.

#### Create Operation
```json
{
  "tool": "@db",
  "payload": {
    "op": "create",
    "schema": "@schema/todos",
    "data": {"text": "Buy milk", "done": false}
  }
}
```

#### Update Operation
```json
{
  "tool": "@db",
  "payload": {
    "op": "update",
    "schema": "@schema/todos",
    "id": "123",
    "data": {"text": "Buy milk and eggs"}
  }
}
```

#### Delete Operation
```json
{
  "tool": "@db",
  "payload": {
    "op": "delete",
    "schema": "@schema/todos",
    "id": "123"
  }
}
```

#### Toggle Operation
```json
{
  "tool": "@db",
  "payload": {
    "op": "toggle",
    "schema": "@schema/todos",
    "id": "123",
    "field": "done"
  }
}
```

#### Query Operation
```json
{
  "tool": "@db",
  "payload": {
    "op": "query",
    "schema": "@schema/todos",
    "filter": {"done": false}
  }
}
```

#### Seed Operation
```json
{
  "tool": "@db",
  "payload": {
    "op": "seed",
    "schema": "@schema/todos",
    "data": [
      {"text": "First todo", "done": false},
      {"text": "Second todo", "done": true}
    ]
  }
}
```

### Core Module (`@core/*`)

#### `@core/setViewMode`
```json
{
  "tool": "@core/setViewMode",
  "payload": {"viewMode": "kanban"}
}
```

#### `@core/openModal`
```json
{
  "tool": "@core/openModal",
  "payload": {}
}
```

#### `@core/closeModal`
```json
{
  "tool": "@core/closeModal",
  "payload": {}
}
```

### Drag-Drop Module (`@dragdrop/*`)

#### `@dragdrop/start`
```json
{
  "tool": "@dragdrop/start",
  "payload": {
    "schema": "todos",
    "id": "123"
  }
}
```

#### `@dragdrop/drop`
```json
{
  "tool": "@dragdrop/drop",
  "payload": {
    "schema": "todos",
    "field": "done",
    "value": true
  }
}
```

### Context Module (`@context/*`)

#### `@context/update`
```json
{
  "tool": "@context/update",
  "payload": {
    "newTodoText": "Updated value",
    "someField": "new value"
  }
}
```

## Creating Custom Tools

### 1. Create Tool Definition

`o/tools/custom/notify.tool.maia`:
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
        "description": "Notification message"
      },
      "type": {
        "type": "string",
        "enum": ["info", "success", "error"],
        "description": "Notification type"
      }
    },
    "required": ["message"]
  }
}
```

### 2. Create Tool Function

`o/tools/custom/notify.tool.js`:
```javascript
export default {
  async execute(actor, payload) {
    const { message, type = 'info' } = payload;
    
    // Add notification to context
    if (!actor.context.notifications) {
      actor.context.notifications = [];
    }
    
    actor.context.notifications.push({
      id: Date.now().toString(),
      message,
      type,
      timestamp: Date.now()
    });
    
    // Auto-clear after 3 seconds
    setTimeout(() => {
      actor.context.notifications = actor.context.notifications.filter(
        n => n.id !== id
      );
      actor.actorEngine.rerender(actor);
    }, 3000);
    
    console.log(`📬 Notification: ${message}`);
  }
};
```

### 3. Register in Module

`o/modules/custom.module.js`:
```javascript
export class CustomModule {
  static async register(registry, toolEngine) {
    await toolEngine.registerTool('custom/notify', '@custom/notify');
    
    registry.registerModule('custom', CustomModule, {
      version: '1.0.0',
      namespace: '@custom',
      tools: ['@custom/notify']
    });
  }
}

export async function register(registry) {
  const toolEngine = registry._toolEngine;
  await CustomModule.register(registry, toolEngine);
}
```

### 4. Load Module at Boot

```javascript
const os = await MaiaOS.boot({
  modules: ['db', 'core', 'dragdrop', 'interface', 'custom']
});
```

## Tool Best Practices

### ✅ DO:

- **Be schema-agnostic** - Don't hardcode collection names
- **Validate inputs** - Check required fields
- **Handle errors gracefully** - Use try/catch
- **Log actions** - Help debugging
- **Keep pure** - Minimize side effects
- **Document well** - Clear parameter descriptions

### ❌ DON'T:

- **Don't mutate actor properties** (except `context`)
- **Don't call other tools directly** (use state machine)
- **Don't store state in tool** (use actor.context)
- **Don't make assumptions** about schema structure
- **Don't block** - Keep async operations fast

## Tool Execution Flow

```
State machine entry action
  ↓
StateEngine._invokeTool()
  ↓
StateEngine._evaluatePayload() (resolve $ and $$ references)
  ↓
ToolEngine.execute(toolName, actor, evaluatedPayload)
  ↓
ToolEngine finds tool by name
  ↓
Tool function executes
  ↓
Tool mutates actor.context
  ↓
Tool succeeds → StateEngine sends SUCCESS event
Tool fails → StateEngine sends ERROR event
  ↓
State machine handles SUCCESS/ERROR
  ↓
ActorEngine.rerender() (if state changed)
```

## Error Handling in Tools

```javascript
export default {
  async execute(actor, payload) {
    const { schema, id } = payload;
    
    // Validate inputs
    if (!schema) {
      throw new Error('Schema is required');
    }
    
    // Check collection exists
    if (!actor.context[schema]) {
      throw new Error(`Schema "${schema}" not found`);
    }
    
    try {
      // Perform operation
      const entity = actor.context[schema].find(e => e.id === id);
      if (!entity) {
        console.warn(`Entity ${id} not found in ${schema}`);
        return; // Graceful failure
      }
      
      // Mutate
      entity.updated = Date.now();
      
      console.log(`✅ Updated ${schema}/${id}`);
    } catch (error) {
      console.error(`❌ Failed to update ${schema}/${id}:`, error);
      throw error; // Re-throw to trigger ERROR event
    }
  }
};
```

## Testing Tools

```javascript
// Manual tool execution for testing
const mockActor = {
  context: {
    todos: []
  },
  actorEngine: null
};

const payload = {
  schema: 'todos',
  data: {text: 'Test', done: false}
};

await createTool.execute(mockActor, payload);
console.log(mockActor.context.todos); // [{id: "...", text: "Test", done: false}]
```

## Next Steps

- Learn about [State Machines](./05-state.md) - How tools are invoked
- Understand [Context](./04-context.md) - What tools manipulate
- Explore [Developers/Tools](../developers/tools.md) - Creating tool modules

---

# VIEWS

*Source: creators/07-views.md*

# Views (UI Representation)

**Views** define the UI representation of an actor. They are declarative JSON structures that the ViewEngine renders to Shadow DOM.

## Philosophy

> Views are the EYES of an actor. They visualize context and capture user events.

- **Views** define WHAT to render (declarative, zero logic)
- **ViewEngine** handles HOW to render (imperative)
- **Context** provides the DATA to display
- **State Machine** computes all conditional values (no `$if` in views!)
- **CSS** handles conditional styling via data-attributes
- **Events** trigger state machine transitions

## View Definition

Create a file named `{name}.view.maia`:

```json
{
  "$type": "view",
  "$id": "view_todo_001",
  
  "root": {
    "tag": "div",
    "attrs": {
      "class": "todo-app"
    },
    "children": [
      {
        "tag": "h1",
        "text": "My Todos"
      },
      {
        "tag": "input",
        "attrs": {
          "type": "text",
          "value": "$newTodoText",
          "placeholder": "What needs to be done?"
        },
        "$on": {
          "input": {
            "send": "UPDATE_INPUT",
            "payload": {"newTodoText": "@inputValue"}
          },
          "keydown": {
            "send": "CREATE_TODO",
            "key": "Enter"
          }
        }
      }
    ]
  }
}
```

## Element Structure

```json
{
  "tag": "div",                    // HTML tag name
  "class": "my-class",             // CSS class (static or "$contextKey")
  "attrs": {...},                  // HTML attributes
  "text": "Static text",           // Text content
  "children": [...],               // Child elements
  "$on": {...},                    // Event handlers (use $on, not on)
  "$each": {...},                  // List rendering
  "$slot": "$contextKey"           // Actor composition (use $slot, not slot)
}
```

**Important:** Views contain **zero conditional logic**. All conditionals are handled by:
- **State Machine** → computes boolean flags → stores in context
- **View** → references context values → maps to data-attributes
- **CSS** → matches data-attributes → applies conditional styles

## HTML Tags

All standard HTML tags are supported:

```json
{"tag": "div"}
{"tag": "span"}
{"tag": "button"}
{"tag": "input"}
{"tag": "textarea"}
{"tag": "select"}
{"tag": "ul"}
{"tag": "li"}
{"tag": "h1"}
{"tag": "p"}
{"tag": "a"}
{"tag": "img"}
```

## Attributes

### Static Attributes
```json
{
  "attrs": {
    "class": "btn btn-primary",
    "id": "submit-button",
    "type": "submit",
    "disabled": true
  }
}
```

### Dynamic Attributes (Context)
```json
{
  "attrs": {
    "value": "$newTodoText",           // From context
    "class": "$viewMode",               // From context
    "data-id": "$selectedId",           // From context
    "data": "$dragOverColumn"           // Maps to data-drag-over-column attribute
  }
}
```

### Data-Attribute Mapping

Data-attributes are the primary mechanism for conditional styling. The state machine computes values, and views map them to data-attributes:

**String Shorthand:**
```json
{
  "attrs": {
    "data": "$dragOverColumn"  // Maps to data-drag-over-column="todo"
  }
}
```

**Object Syntax (Multiple Attributes):**
```json
{
  "attrs": {
    "data": {
      "dragOver": "$dragOverColumn",
      "itemId": "$draggedItemId"
    }
  }
}
```

**Item Lookup Syntax (for `$each` loops):**
```json
{
  "$each": {
    "items": "$todos",
    "template": {
      "attrs": {
        "data": {
          "isDragged": "$draggedItemIds.$$id"  // Looks up draggedItemIds[item.id]
        }
      }
    }
  }
}
```

**How it works:**
1. State machine computes `draggedItemIds: { "item-123": true }` in context
2. View references `"$draggedItemIds.$$id"` for each item
3. ViewEngine looks up `draggedItemIds[item.id]` → sets `data-is-dragged="true"`
4. CSS matches `[data-is-dragged="true"]` → applies styles

### Special Attributes
```json
{
  "attrs": {
    "draggable": true,
    "contenteditable": true,
    "data-*": "custom data",
    "aria-label": "Accessibility label"
  }
}
```

## Text Content

### Static Text
```json
{
  "tag": "h1",
  "text": "Welcome to MaiaOS"
}
```

### Dynamic Text (Context)
```json
{
  "tag": "span",
  "text": "$userName"                  // From context.userName
}
```

### Interpolated Text
```json
{
  "tag": "p",
  "text": "You have $todosCount tasks"  // Evaluates context.todosCount
}
```

## Event Handlers (`$on`)

**Note:** Always use `$on` (not `on`) for consistency with other DSL operations.

### Simple Event
```json
{
  "$on": {
    "click": {
      "send": "DELETE_TODO",
      "payload": {"id": "$$id"}
    }
  }
}
```

### Event with Key Filter
```json
{
  "$on": {
    "keydown": {
      "send": "CREATE_TODO",
      "key": "Enter"
    }
  }
}
```

### Multiple Events
```json
{
  "$on": {
    "click": {"send": "SELECT_ITEM", "payload": {"id": "$$id"}},
    "dblclick": {"send": "EDIT_ITEM", "payload": {"id": "$$id"}},
    "mouseover": {"send": "HOVER_ITEM", "payload": {"id": "$$id"}}
  }
}
```

### Input Events
```json
{
  "$on": {
    "input": {
      "send": "UPDATE_INPUT",
      "payload": {"newTodoText": "@inputValue"}
    }
  }
}
```

**Special payload values:**
- `@inputValue` - Input element value
- `@checked` - Checkbox/radio checked state
- `@selectedValue` - Select element value

## Conditional Styling (No `$if` in Views!)

**Views contain zero conditional logic.** All conditionals are handled by the state machine and CSS:

### Pattern: State Machine → Context → Data-Attributes → CSS

**1. State Machine computes boolean flags:**
```json
{
  "tool": "@context/update",
  "payload": {
    "listButtonActive": {"$eq": ["$$viewMode", "list"]},
    "kanbanButtonActive": {"$eq": ["$$viewMode", "kanban"]}
  }
}
```

**2. View references context values:**
```json
{
  "tag": "button",
  "class": "button-view-switch",
  "attrs": {
    "data": "$listButtonActive"  // Simple context reference
  }
}
```

**3. CSS matches data-attributes:**
```json
{
  "buttonViewSwitch": {
    "data": {
      "listButtonActive": {
        "true": {
          "background": "{colors.primary}",
          "color": "white"
        }
      }
    }
  }
}
```

**Result:** Button automatically styles when `listButtonActive` is `true` - no template conditionals needed!

## List Rendering (`$each`)

### Basic List
```json
{
  "$each": {
    "items": "$todos",
    "template": {
      "tag": "li",
      "text": "$$text",
      "attrs": {"data-id": "$$id"}
    }
  }
}
```

**Note:** Inside `$each` templates:
- `$$fieldName` accesses item properties (e.g., `$$id`, `$$text`)
- `$fieldName` accesses actor context (e.g., `$viewMode`, `$draggedItemId`)

### List with Events
```json
{
  "$each": {
    "items": "$todos",
    "template": {
      "tag": "button",
      "text": "$$text",
      "$on": {
        "click": {
          "send": "DELETE_TODO",
          "payload": {"id": "$$id"}
        }
      }
    }
  }
}
```

### List with Item-Specific Data-Attributes

For item-specific conditional styling, use item lookup syntax:

```json
{
  "$each": {
    "items": "$todos",
    "template": {
      "tag": "div",
      "class": "card",
      "attrs": {
        "data-id": "$$id",
        "data": {
          "isDragged": "$draggedItemIds.$$id"  // Looks up draggedItemIds[item.id]
        }
      }
    }
  }
}
```

**How it works:**
1. State machine maintains `draggedItemIds: { "item-123": true }` in context
2. For each item, ViewEngine evaluates `draggedItemIds[item.id]`
3. If found, sets `data-is-dragged="true"` on that item's element
4. CSS matches `[data-is-dragged="true"]` → applies dragging styles

### Nested Lists
```json
{
  "$each": {
    "items": "$categories",
    "template": {
      "tag": "div",
      "children": [
        {
          "tag": "h2",
          "text": "$$name"
        },
        {
          "$each": {
            "items": "$$items",
            "template": {
              "tag": "li",
              "text": "$$title"
            }
          }
        }
      ]
    }
  }
}
```

## Actor Composition (`$slot`)

Use `$slot` to compose child actors into parent views. The state machine sets the context value, and the view renders the appropriate child actor.

**Note:** Always use `$slot` (not `slot`) for consistency with other DSL operations.

### Basic Slot
```json
{
  "tag": "main",
  "class": "content-area",
  "$slot": "$currentView"  // Renders child actor referenced by context.currentView
}
```

**How it works:**
1. State machine sets `currentView: "@list"` or `currentView: "@kanban"` in context
2. ViewEngine resolves `@list` → finds child actor with name `list`
3. Attaches child actor's container to the slot element

### Slot with Wrapper Styling
```json
{
  "tag": "main",
  "class": "content-area",
  "attrs": {
    "data-view": "$viewMode"
  },
  "$slot": "$currentView"
}
```

The wrapper element (with tag, class, attrs) wraps the child actor, allowing you to style the container.

## Drag and Drop

### Draggable Element with Data-Attributes
```json
{
  "$each": {
    "items": "$todos",
    "template": {
      "tag": "div",
      "class": "card",
      "attrs": {
        "draggable": true,
        "data-id": "$$id",
        "data": {
          "isDragged": "$draggedItemIds.$$id"  // Conditional styling via CSS
        }
      },
      "$on": {
        "dragstart": {
          "send": "DRAG_START",
          "payload": {"schema": "todos", "id": "$$id"}
        },
        "dragend": {
          "send": "DRAG_END",
          "payload": {}
        }
      }
    }
  }
}
```

### Drop Zone with Data-Attributes
```json
{
  "tag": "div",
  "class": "kanban-column-content",
  "attrs": {
    "data-column": "todo",
    "data": "$dragOverColumn"  // Maps to data-drag-over-column for CSS styling
  },
  "$on": {
    "dragover": {
      "send": "DRAG_OVER",
      "payload": {}
    },
    "drop": {
      "send": "DROP",
      "payload": {"schema": "todos", "field": "done", "value": false}
    },
    "dragenter": {
      "send": "DRAG_ENTER",
      "payload": {"column": "@dataColumn"}
    },
    "dragleave": {
      "send": "DRAG_LEAVE",
      "payload": {"column": "@dataColumn"}
    }
  }
}
```

## Complete Example: Todo View

```json
{
  "$type": "view",
  "$id": "view_todo_001",
  
  "root": {
    "tag": "div",
    "class": "todo-app",
    "children": [
      {
        "tag": "div",
        "class": "header",
        "children": [
          {
            "tag": "h1",
            "text": "My Todos"
          },
          {
            "tag": "div",
            "class": "input-row",
            "children": [
              {
                "tag": "input",
                "class": "input",
                "attrs": {
                  "type": "text",
                  "placeholder": "What needs to be done?"
                },
                "value": "$newTodoText",
                "$on": {
                  "input": {
                    "send": "UPDATE_INPUT",
                    "payload": {"newTodoText": "@inputValue"}
                  },
                  "keydown": {
                    "send": "CREATE_TODO",
                    "key": "Enter"
                  }
                }
              },
              {
                "tag": "button",
                "class": "button",
                "text": "Add",
                "$on": {
                  "click": {
                    "send": "CREATE_TODO",
                    "payload": {}
                  }
                }
              }
            ]
          }
        ]
      },
      {
        "tag": "div",
        "class": "todos-list",
        "$each": {
          "items": "$todosTodo",
          "template": {
            "tag": "div",
            "class": "card",
            "attrs": {
              "data-id": "$$id",
              "data-done": "$$done",
              "data": {
                "isDragged": "$draggedItemIds.$$id"
              }
            },
            "children": [
              {
                "tag": "span",
                "class": "body",
                "text": "$$text"
              },
              {
                "tag": "button",
                "class": "button-small",
                "text": "✓",
                "$on": {
                  "click": {
                    "send": "TOGGLE_TODO",
                    "payload": {"id": "$$id"}
                  }
                }
              },
              {
                "tag": "button",
                "class": "button-small button-danger",
                "text": "✕",
                "$on": {
                  "click": {
                    "send": "DELETE_TODO",
                    "payload": {"id": "$$id"}
                  }
                }
              }
            ]
          }
        }
      }
    ]
  }
}
```

**Key patterns:**
- ✅ Uses `$each` for list rendering
- ✅ Uses `$on` for event handlers
- ✅ Uses `data` attribute mapping for conditional styling
- ✅ Uses `$draggedItemIds.$$id` for item-specific lookups
- ✅ No `$if` conditionals - all handled by state machine + CSS

## View Best Practices

### ✅ DO:

- **Keep views declarative** - Zero logic, only structure
- **Use semantic HTML** - `<button>` not `<div onclick>`
- **Structure hierarchically** - Logical parent-child relationships
- **Use clear event names** - `CREATE_TODO` not `submit` or `click`
- **Use data-attributes for styling** - State machine computes, CSS styles
- **Use `$each` for lists** - Don't manually duplicate structures
- **Use `$on` for events** - Consistent with other DSL operations
- **Use `$slot` for composition** - Consistent with other DSL operations
- **Reference context values directly** - `"data": "$listButtonActive"`

### ❌ DON'T:

- **Don't use `$if` in views** - All conditionals handled by state machine + CSS
- **Don't put logic in views** - Use state machines to compute boolean flags
- **Don't hardcode data** - Use context references
- **Don't duplicate structures** - Use `$each` loops
- **Don't use `on` (use `$on`)** - Maintain DSL consistency
- **Don't use `slot` (use `$slot`)** - Maintain DSL consistency
- **Don't create deep nesting** - Extract to sub-views (future feature)
- **Don't mix concerns** - Separate layout from data

## Shadow DOM Isolation

Each actor renders into its own Shadow DOM:

```html
<div id="actor-todo">
  #shadow-root (open)
    <style>/* Actor styles */</style>
    <div class="todo-app">
      <!-- View rendered here -->
    </div>
</div>
```

**Benefits:**
- ✅ Style isolation (no CSS leakage)
- ✅ DOM encapsulation (clean inspector)
- ✅ Multiple instances (no ID conflicts)

## Accessing DOM Elements

Views are rendered to Shadow DOM, accessible via:

```javascript
// Get shadow root
const shadowRoot = actor.container.shadowRoot;

// Query elements
const input = shadowRoot.querySelector('input');
const buttons = shadowRoot.querySelectorAll('button');

// Inspect in DevTools
// Click actor container → Expand #shadow-root
```

## View Debugging

```javascript
// Expose actor globally
window.actor = actor;

// Inspect view definition
console.log(actor.viewDef);

// Trigger manual re-render
actor.actorEngine.rerender(actor);

// Log events
const originalSend = actor.actorEngine.stateEngine.send;
actor.actorEngine.stateEngine.send = function(machineId, event, payload) {
  console.log('Event sent:', event, payload);
  return originalSend.call(this, machineId, event, payload);
};
```

## Expression Syntax

### Context References (`$`)
```json
{"value": "$newTodoText"}        // context.newTodoText
{"class": "$viewMode"}            // context.viewMode
{"data": "$listButtonActive"}     // Maps to data-list-button-active attribute
```

### Item References (`$$`) (in `$each` loops)
```json
{"text": "$$text"}                // item.text
{"data-id": "$$id"}               // item.id
```

### Item Lookup Syntax (`$contextObject.$$itemKey`)
```json
{"data": {"isDragged": "$draggedItemIds.$$id"}}  // Looks up draggedItemIds[item.id]
```

**How it works:**
- `$draggedItemIds` → context object `{ "item-123": true, "item-456": false }`
- `$$id` → current item's ID (e.g., `"item-123"`)
- ViewEngine evaluates `draggedItemIds["item-123"]` → `true`
- Sets `data-is-dragged="true"` on element

### Special Event Values (`@`)
```json
{"payload": {"text": "@inputValue"}}     // input.value
{"payload": {"checked": "@checked"}}      // input.checked
{"payload": {"column": "@dataColumn"}}   // element.getAttribute("data-column")
```

## Allowed Operations

Views support only these operations:

| Operation | Syntax | Purpose |
|-----------|--------|---------|
| `$each` | `{"$each": {"items": "$todos", "template": {...}}}` | List rendering |
| `$on` | `{"$on": {"click": {...}}}` | Event handlers |
| `$slot` | `{"$slot": "$currentView"}` | Actor composition |
| `$contextKey` | `"$viewMode"`, `"$$id"` | Variable references |

**Removed Operations:**
- ❌ `$if` - Use state machine + data-attributes + CSS instead
- ❌ `slot` - Migrated to `$slot` for consistency
- ❌ `on` - Migrated to `$on` for consistency

## Next Steps

- Learn about [State Machines](./05-state.md) - How views trigger events
- Explore [Context](./04-context.md) - What views display
- Understand [Brand](./08-brand.md) - Design system for views
- Read [Style](./09-style.md) - Additional styling

---

# BRAND

*Source: creators/08-brand.md*

# Brand (Design System)

**Brand** is a shared design system that defines the visual language across all actors. It provides consistent tokens for colors, typography, spacing, and component styles.

## Philosophy

> Brand is the IDENTITY of your application. It ensures visual consistency across all actors.

- **Brand** defines design tokens (colors, spacing, typography)
- **StyleEngine** compiles brand definitions to CSS
- **Actors** reference brand via `styleRef`
- **Actors** can also have local styles for customization

## Brand Definition

Create a file named `brand.style.maia`:

```json
{
  "$type": "style",
  "$id": "style_brand_001",
  
  "tokens": {
    "colors": {
      "primary": "#3b82f6",
      "secondary": "#8b5cf6",
      "success": "#10b981",
      "danger": "#ef4444",
      "warning": "#f59e0b",
      "background": "#ffffff",
      "surface": "#f3f4f6",
      "text": "#1f2937",
      "textMuted": "#6b7280",
      "border": "#e5e7eb"
    },
    "spacing": {
      "xs": "0.25rem",
      "sm": "0.5rem",
      "md": "1rem",
      "lg": "1.5rem",
      "xl": "2rem",
      "2xl": "3rem"
    },
    "typography": {
      "fontFamily": "'Inter', sans-serif",
      "fontSizeBase": "16px",
      "fontSizeSmall": "14px",
      "fontSizeLarge": "18px",
      "fontSizeH1": "2rem",
      "fontSizeH2": "1.5rem",
      "fontSizeH3": "1.25rem",
      "lineHeight": "1.5",
      "fontWeight": "400",
      "fontWeightBold": "600"
    },
    "borderRadius": {
      "none": "0",
      "sm": "0.25rem",
      "md": "0.5rem",
      "lg": "0.75rem",
      "full": "9999px"
    },
    "shadows": {
      "sm": "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
      "md": "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
      "lg": "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
      "xl": "0 20px 25px -5px rgba(0, 0, 0, 0.1)"
    }
  },
  
  "components": {
    "todoApp": {
      "fontFamily": "var(--font-family)",
      "maxWidth": "800px",
      "margin": "0 auto",
      "padding": "var(--spacing-xl)"
    },
    "button": {
      "padding": "var(--spacing-sm) var(--spacing-md)",
      "borderRadius": "var(--border-radius-md)",
      "border": "none",
      "cursor": "pointer",
      "fontWeight": "var(--font-weight-bold)",
      "transition": "all 0.2s"
    },
    "buttonPrimary": {
      "backgroundColor": "var(--color-primary)",
      "color": "white",
      ":hover": {
        "opacity": "0.9"
      }
    },
    "input": {
      "padding": "var(--spacing-sm) var(--spacing-md)",
      "border": "1px solid var(--color-border)",
      "borderRadius": "var(--border-radius-md)",
      "fontSize": "var(--font-size-base)",
      "width": "100%",
      ":focus": {
        "outline": "none",
        "borderColor": "var(--color-primary)",
        "boxShadow": "var(--shadow-sm)"
      }
    }
  },
  "selectors": {
    "h1": {
      "fontSize": "var(--font-size-h1)",
      "fontWeight": "var(--font-weight-bold)",
      "color": "var(--color-text)",
      "marginBottom": "var(--spacing-lg)"
    }
  }
}
```

## Design Tokens

### Colors
Define your color palette:

```json
{
  "colors": {
    "primary": "#3b82f6",          // Main brand color
    "secondary": "#8b5cf6",        // Secondary actions
    "success": "#10b981",          // Success states
    "danger": "#ef4444",           // Errors/destructive actions
    "warning": "#f59e0b",          // Warnings
    "info": "#06b6d4",             // Informational
    
    "background": "#ffffff",        // Main background
    "surface": "#f3f4f6",          // Cards, panels
    "overlay": "rgba(0,0,0,0.5)",  // Modals, overlays
    
    "text": "#1f2937",             // Primary text
    "textMuted": "#6b7280",        // Secondary text
    "textInverse": "#ffffff",       // Text on dark backgrounds
    
    "border": "#e5e7eb",           // Default borders
    "borderDark": "#d1d5db"        // Darker borders
  }
}
```

### Spacing
Consistent spacing scale:

```json
{
  "spacing": {
    "xs": "0.25rem",    // 4px
    "sm": "0.5rem",     // 8px
    "md": "1rem",       // 16px
    "lg": "1.5rem",     // 24px
    "xl": "2rem",       // 32px
    "2xl": "3rem",      // 48px
    "3xl": "4rem"       // 64px
  }
}
```

### Typography
Font styles:

```json
{
  "typography": {
    "fontFamily": "'Inter', 'Helvetica Neue', sans-serif",
    "fontFamilyMono": "'Fira Code', monospace",
    
    "fontSizeBase": "16px",
    "fontSizeSmall": "14px",
    "fontSizeLarge": "18px",
    "fontSizeH1": "2rem",
    "fontSizeH2": "1.5rem",
    "fontSizeH3": "1.25rem",
    "fontSizeH4": "1.125rem",
    
    "lineHeight": "1.5",
    "lineHeightTight": "1.25",
    "lineHeightLoose": "1.75",
    
    "fontWeight": "400",
    "fontWeightMedium": "500",
    "fontWeightBold": "600",
    "fontWeightExtraBold": "700"
  }
}
```

### Border Radius
Rounded corners:

```json
{
  "borderRadius": {
    "none": "0",
    "sm": "0.25rem",
    "md": "0.5rem",
    "lg": "0.75rem",
    "xl": "1rem",
    "full": "9999px"
  }
}
```

### Shadows
Elevation shadows:

```json
{
  "shadows": {
    "none": "none",
    "sm": "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    "md": "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
    "lg": "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
    "xl": "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
    "2xl": "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
  }
}
```

## Using Tokens in Styles

Tokens are compiled to CSS custom properties:

```css
/* Generated from tokens */
:host {
  --color-primary: #3b82f6;
  --color-secondary: #8b5cf6;
  --spacing-md: 1rem;
  --font-family: 'Inter', sans-serif;
  --border-radius-md: 0.5rem;
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
```

Reference in styles:

```json
{
  "styles": {
    ".button": {
      "backgroundColor": "var(--color-primary)",
      "padding": "var(--spacing-sm) var(--spacing-md)",
      "borderRadius": "var(--border-radius-md)",
      "boxShadow": "var(--shadow-sm)"
    }
  }
}
```

## Component Styles

Define reusable component styles. Use nested `data` syntax for conditional styling:

```json
{
  "components": {
    "button": {
      "padding": "var(--spacing-sm) var(--spacing-md)",
      "borderRadius": "var(--border-radius-md)",
      "border": "none",
      "cursor": "pointer",
      "fontWeight": "var(--font-weight-bold)",
      "transition": "all 0.2s",
      "fontSize": "var(--font-size-base)",
      ":hover": {
        "opacity": "0.9"
      }
    },
    "buttonViewSwitch": {
      "padding": "var(--spacing-xs) var(--spacing-md)",
      "background": "transparent",
      "color": "var(--colors-textSecondary)",
      "border": "1px solid var(--colors-border)",
      "borderRadius": "var(--radii-sm)",
      "cursor": "pointer",
      "transition": "all 0.2s ease",
      "data": {
        "active": {
          "true": {
            "background": "var(--colors-primary)",
            "color": "white",
            "borderColor": "var(--colors-primary)",
            "fontWeight": "600"
          }
        }
      }
    },
    "card": {
      "display": "flex",
      "alignItems": "center",
      "padding": "var(--spacing-sm) var(--spacing-md)",
      "background": "var(--colors-surface)",
      "borderRadius": "0",
      "border": "1px solid var(--colors-border)",
      "transition": "all 0.2s ease",
      "data": {
        "isDragged": {
          "true": {
            "opacity": "0.3",
            "pointerEvents": "none"
          }
        },
        "done": {
          "true": {
            "opacity": "0.6",
            "background": "rgba(0, 0, 0, 0.02)"
          }
        }
      }
    },
    "kanbanColumnContent": {
      "display": "flex",
      "flexDirection": "column",
      "padding": "var(--spacing-sm)",
      "border": "2px dashed var(--colors-border)",
      "borderRadius": "var(--radii-md)",
      "background": "rgba(255, 255, 255, 0.2)",
      "transition": "all 0.2s ease",
      "data": {
        "dragOverColumn": {
          "todo": {
            "background": "rgba(143, 168, 155, 0.15)",
            "borderColor": "var(--colors-primary)",
            "borderWidth": "2px",
            "borderStyle": "dashed"
          },
          "done": {
            "background": "rgba(143, 168, 155, 0.15)",
            "borderColor": "var(--colors-primary)",
            "borderWidth": "2px",
            "borderStyle": "dashed"
          }
        }
      }
    },
    "input": {
      "padding": "var(--spacing-sm) var(--spacing-md)",
      "border": "1px solid var(--color-border)",
      "borderRadius": "var(--border-radius-md)",
      "fontSize": "var(--font-size-base)",
      "width": "100%",
      ":focus": {
        "outline": "none",
        "borderColor": "var(--color-primary)",
        "boxShadow": "0 0 0 3px rgba(59, 130, 246, 0.1)"
      }
    }
  }
}
```

**Nested Data-Attribute Syntax:**
- `data.dragOverColumn.todo` → Generates `.kanban-column-content[data-drag-over-column="todo"]`
- `data.isDragged.true` → Generates `.card[data-is-dragged="true"]`
- Supports multiple data-attributes and nested combinations
- Automatically converts camelCase to kebab-case

## Linking Brand to Actors

In your actor definition:

```json
{
  "$type": "actor",
  "id": "actor_todo_001",
  "styleRef": "brand",    // ← References brand.style.maia
  "viewRef": "todo",
  "stateRef": "todo"
}
```

## Dark Mode Support

Add dark mode tokens:

```json
{
  "tokens": {
    "colors": {
      "primary": "#3b82f6",
      "background": "#ffffff",
      "text": "#1f2937"
    },
    "colorsDark": {
      "primary": "#60a5fa",
      "background": "#1f2937",
      "text": "#f3f4f6"
    }
  },
  "styles": {
    ":host": {
      "backgroundColor": "var(--color-background)",
      "color": "var(--color-text)"
    },
    "@media (prefers-color-scheme: dark)": {
      ":host": {
        "--color-primary": "var(--color-primary-dark)",
        "--color-background": "#1f2937",
        "--color-text": "#f3f4f6"
      }
    }
  }
}
```

## Responsive Design

Add responsive breakpoints:

```json
{
  "tokens": {
    "breakpoints": {
      "sm": "640px",
      "md": "768px",
      "lg": "1024px",
      "xl": "1280px"
    }
  },
  "styles": {
    ".container": {
      "padding": "var(--spacing-md)"
    },
    "@media (min-width: 768px)": {
      ".container": {
        "padding": "var(--spacing-xl)",
        "maxWidth": "800px",
        "margin": "0 auto"
      }
    }
  }
}
```

## Nested Data-Attribute Syntax

For conditional styling, use nested `data` syntax in component definitions:

```json
{
  "components": {
    "buttonViewSwitch": {
      "padding": "var(--spacing-xs) var(--spacing-md)",
      "background": "transparent",
      "data": {
        "active": {
          "true": {
            "background": "var(--colors-primary)",
            "color": "white"
          }
        }
      }
    },
    "kanbanColumnContent": {
      "border": "2px dashed var(--colors-border)",
      "data": {
        "dragOverColumn": {
          "todo": {
            "background": "rgba(143, 168, 155, 0.15)",
            "borderColor": "var(--colors-primary)"
          },
          "done": {
            "background": "rgba(143, 168, 155, 0.15)",
            "borderColor": "var(--colors-primary)"
          }
        }
      }
    }
  }
}
```

**Generated CSS:**
```css
.button-view-switch[data-active="true"] {
  background: var(--colors-primary);
  color: white;
}

.kanban-column-content[data-drag-over-column="todo"] {
  background: rgba(143, 168, 155, 0.15);
  border-color: var(--colors-primary);
}
```

**Pattern:** State machine sets context → View maps to data-attributes → CSS matches selectors

## Best Practices

### ✅ DO:

- **Use tokens consistently** - Don't hardcode colors/spacing
- **Keep tokens semantic** - `primary` not `blue`
- **Define component patterns** - Reusable components in `components` section
- **Use nested data syntax** - For conditional styling via data-attributes
- **Support dark mode** - Add `colorsDark` tokens
- **Use CSS custom properties** - Easy runtime theming
- **Document your tokens** - Add comments explaining usage

### ❌ DON'T:

- **Don't hardcode values** - Use tokens
- **Don't create too many tokens** - Keep scale manageable
- **Don't mix units** - Use rem/em consistently
- **Don't duplicate styles** - Extract common patterns
- **Don't use inline styles** - Define in brand/style files
- **Don't use class-based conditionals** - Use data-attributes instead (`.active`, `.dragging`, etc.)

## Example: Complete Brand System

```json
{
  "$type": "style",
  "$id": "style_brand_001",
  
  "tokens": {
    "colors": {
      "primary": "#3b82f6",
      "secondary": "#8b5cf6",
      "success": "#10b981",
      "danger": "#ef4444",
      "background": "#ffffff",
      "surface": "#f9fafb",
      "text": "#111827",
      "textMuted": "#6b7280",
      "border": "#e5e7eb"
    },
    "spacing": {
      "xs": "0.25rem",
      "sm": "0.5rem",
      "md": "1rem",
      "lg": "1.5rem",
      "xl": "2rem"
    },
    "typography": {
      "fontFamily": "'Inter', sans-serif",
      "fontSize": "16px",
      "lineHeight": "1.5"
    },
    "borderRadius": {
      "sm": "0.25rem",
      "md": "0.5rem",
      "lg": "0.75rem"
    },
    "shadows": {
      "sm": "0 1px 2px rgba(0, 0, 0, 0.05)",
      "md": "0 4px 6px rgba(0, 0, 0, 0.1)"
    }
  },
  
  "components": {
    "button": {
      "padding": "var(--spacing-sm) var(--spacing-md)",
      "borderRadius": "var(--border-radius-md)",
      "border": "none",
      "cursor": "pointer",
      "transition": "all 0.2s"
    },
    "buttonPrimary": {
      "backgroundColor": "var(--color-primary)",
      "color": "white",
      ":hover": {
        "opacity": "0.9"
      }
    },
    "input": {
      "padding": "var(--spacing-sm)",
      "border": "1px solid var(--color-border)",
      "borderRadius": "var(--border-radius-md)",
      ":focus": {
        "outline": "none",
        "borderColor": "var(--color-primary)"
      }
    }
  },
  "selectors": {
    ":host": {
      "fontFamily": "var(--font-family)",
      "fontSize": "var(--font-size)",
      "lineHeight": "var(--line-height)",
      "color": "var(--color-text)"
    }
  }
}
```

## Next Steps

- Learn about [Style](./09-style.md) - Actor-specific styling
- Explore [Views](./07-views.md) - How to use brand classes
- Understand [Actors](./02-actors.md) - Linking brand to actors

---

# STYLE

*Source: creators/09-style.md*

# Style (Local Styling)

**Style** files provide actor-specific styling that extends or overrides the shared brand design system. They allow customization without affecting other actors.

## Philosophy

> Style is the PERSONALITY of an individual actor. It customizes appearance while respecting the brand foundation.

- **Brand** provides the foundation (design system)
- **Style** adds actor-specific customization
- **Shadow DOM** ensures style isolation
- **StyleEngine** compiles both brand and local styles

## When to Use Style vs Brand

### Use Brand For:
- Design tokens (colors, spacing, typography)
- Component patterns (buttons, inputs, cards)
- Global application theme
- Shared styles across all actors

### Use Style For:
- Actor-specific layouts
- Custom component variations
- Unique styling needs
- Overrides for specific actors

## Style Definition

Create a file named `{name}.style.maia`:

```json
{
  "$type": "style",
  "$id": "style_todo_001",
  
  "components": {
    "todoItem": {
      "display": "flex",
      "alignItems": "center",
      "padding": "var(--spacing-sm)",
      "borderBottom": "1px solid var(--color-border)",
      "gap": "var(--spacing-sm)",
      ":hover": {
        "backgroundColor": "var(--color-surface)"
      },
      "data": {
        "done": {
          "true": {
            "opacity": "0.6",
            "textDecoration": "line-through"
          }
        }
      }
    },
    "deleteBtn": {
      "marginLeft": "auto",
      "padding": "var(--spacing-xs)",
      "color": "var(--color-danger)",
      "backgroundColor": "transparent",
      "border": "none",
      "cursor": "pointer",
      "fontSize": "1.5rem",
      "lineHeight": "1",
      ":hover": {
        "backgroundColor": "rgba(239, 68, 68, 0.1)"
      }
    }
  }
}
```

**Note:** Use `components` section (not `styles`) for component definitions with nested data-attribute syntax. Use `selectors` section for advanced CSS selectors.

## Linking Style to Actors

In your actor definition:

```json
{
  "$type": "actor",
  "id": "actor_todo_001",
  "styleRef": "brand",         // ← Brand foundation
  "localStyleRef": "todo",     // ← Actor-specific styles (optional)
  "viewRef": "todo",
  "stateRef": "todo"
}
```

**Note:** Currently MaiaOS uses `styleRef` for brand. In v0.5, we'll add `localStyleRef` for actor-specific styles. For now, you can combine them in a single style file.

## Style Compilation

Styles are compiled to CSS and injected into the actor's Shadow DOM:

```
Brand tokens → CSS custom properties
  ↓
Brand styles → CSS rules
  ↓
Local styles → CSS rules (override/extend)
  ↓
Inject into Shadow DOM
```

## Common Patterns

### Layout Styles
```json
{
  "styles": {
    ".todo-app": {
      "display": "flex",
      "flexDirection": "column",
      "gap": "var(--spacing-lg)",
      "maxWidth": "800px",
      "margin": "0 auto"
    },
    ".kanban-board": {
      "display": "grid",
      "gridTemplateColumns": "repeat(2, 1fr)",
      "gap": "var(--spacing-md)"
    },
    ".column": {
      "backgroundColor": "var(--color-surface)",
      "borderRadius": "var(--border-radius-lg)",
      "padding": "var(--spacing-md)"
    }
  }
}
```

### State Styles (Using Data-Attributes)

**No class-based conditionals!** Use data-attributes instead:

```json
{
  "components": {
    "todoItem": {
      "transition": "all 0.2s",
      "data": {
        "done": {
          "true": {
            "opacity": "0.6",
            "textDecoration": "line-through"
          }
        },
        "isEditing": {
          "true": {
            "backgroundColor": "var(--color-primary)",
            "color": "white"
          }
        },
        "isDragged": {
          "true": {
            "opacity": "0.5",
            "cursor": "move"
          }
        }
      }
    }
  }
}
```

**View sets data-attributes:**
```json
{
  "attrs": {
    "data": {
      "done": "$$done",
      "isEditing": "$editingItemId.$$id",
      "isDragged": "$draggedItemIds.$$id"
    }
  }
}
```

**Pattern:** State machine computes → Context stores → View maps → CSS styles

### Interactive Styles (Using Data-Attributes)

```json
{
  "components": {
    "draggable": {
      "cursor": "grab",
      "transition": "transform 0.2s",
      ":active": {
        "cursor": "grabbing",
        "transform": "scale(1.05)"
      }
    },
    "dropzone": {
      "border": "2px dashed var(--color-border)",
      "minHeight": "100px",
      "transition": "all 0.2s",
      "data": {
        "dragOverColumn": {
          "todo": {
            "borderColor": "var(--color-primary)",
            "backgroundColor": "rgba(59, 130, 246, 0.05)"
          },
          "done": {
            "borderColor": "var(--color-primary)",
            "backgroundColor": "rgba(59, 130, 246, 0.05)"
          }
        }
      }
    }
  }
}
```

### Animation Styles
```json
{
  "styles": {
    "@keyframes fadeIn": {
      "from": {"opacity": "0", "transform": "translateY(-10px)"},
      "to": {"opacity": "1", "transform": "translateY(0)"}
    },
    ".todo-item": {
      "animation": "fadeIn 0.3s ease-out"
    },
    ".delete-btn": {
      "transition": "transform 0.2s"
    },
    ".delete-btn:hover": {
      "transform": "scale(1.2)"
    }
  }
}
```

## Overriding Brand Styles

Local styles can override brand styles:

```json
{
  "styles": {
    ".btn-primary": {
      "backgroundColor": "#ef4444",  // Override brand primary color
      "borderRadius": "0"             // Override brand border radius
    },
    ".input": {
      "fontSize": "18px",             // Larger input text
      "padding": "1rem"               // More padding
    }
  }
}
```

## Using CSS Custom Properties

Reference brand tokens:

```json
{
  "styles": {
    ".custom-element": {
      "color": "var(--color-primary)",
      "padding": "var(--spacing-md)",
      "borderRadius": "var(--border-radius-lg)",
      "boxShadow": "var(--shadow-md)"
    }
  }
}
```

Define local custom properties:

```json
{
  "styles": {
    ":host": {
      "--local-accent": "#f59e0b",
      "--local-spacing": "0.75rem"
    },
    ".custom-element": {
      "color": "var(--local-accent)",
      "padding": "var(--local-spacing)"
    }
  }
}
```

## Responsive Styles

```json
{
  "styles": {
    ".todo-app": {
      "padding": "var(--spacing-md)"
    },
    "@media (min-width: 768px)": {
      ".todo-app": {
        "padding": "var(--spacing-xl)"
      },
      ".kanban-board": {
        "gridTemplateColumns": "repeat(3, 1fr)"
      }
    },
    "@media (min-width: 1024px)": {
      ".todo-app": {
        "maxWidth": "1200px"
      }
    }
  }
}
```

## Pseudo-classes and Pseudo-elements

```json
{
  "styles": {
    ".todo-item:hover": {
      "backgroundColor": "var(--color-surface)"
    },
    ".todo-item:first-child": {
      "borderTopLeftRadius": "var(--border-radius-md)",
      "borderTopRightRadius": "var(--border-radius-md)"
    },
    ".todo-item:last-child": {
      "borderBottom": "none"
    },
    ".input::placeholder": {
      "color": "var(--color-text-muted)",
      "fontStyle": "italic"
    },
    ".checkbox:checked": {
      "backgroundColor": "var(--color-primary)"
    }
  }
}
```

## Nested Data-Attribute Syntax

For conditional styling, use nested `data` syntax in component definitions:

```json
{
  "components": {
    "card": {
      "display": "flex",
      "padding": "var(--spacing-sm)",
      "data": {
        "isDragged": {
          "true": {
            "opacity": "0.3",
            "pointerEvents": "none"
          }
        },
        "done": {
          "true": {
            "opacity": "0.6",
            "textDecoration": "line-through"
          }
        }
      }
    },
    "kanbanColumnContent": {
      "border": "2px dashed var(--colors-border)",
      "data": {
        "dragOverColumn": {
          "todo": {
            "background": "rgba(143, 168, 155, 0.15)",
            "borderColor": "var(--colors-primary)"
          },
          "done": {
            "background": "rgba(143, 168, 155, 0.15)",
            "borderColor": "var(--colors-primary)"
          }
        }
      }
    }
  }
}
```

**Generated CSS:**
```css
.card[data-is-dragged="true"] {
  opacity: 0.3;
  pointer-events: none;
}

.card[data-done="true"] {
  opacity: 0.6;
  text-decoration: line-through;
}

.kanban-column-content[data-drag-over-column="todo"] {
  background: rgba(143, 168, 155, 0.15);
  border-color: var(--colors-primary);
}
```

**Pattern:** State machine computes → Context stores → View maps to data-attributes → CSS matches selectors

## Best Practices

### ✅ DO:

- **Use brand tokens** - Reference CSS custom properties
- **Use `components` section** - For component definitions with nested data syntax
- **Use `selectors` section** - For advanced CSS selectors
- **Keep styles scoped** - Shadow DOM provides isolation
- **Use semantic names** - `todoItem` not `item123`
- **Leverage transitions** - Smooth state changes
- **Support responsive** - Use media queries
- **Use nested data syntax** - For conditional styling via data-attributes

### ❌ DON'T:

- **Don't use class-based conditionals** - Use data-attributes instead (`.active`, `.dragging`, etc.)
- **Don't use IDs** - Use classes for styling
- **Don't use `!important`** - Shadow DOM provides isolation
- **Don't hardcode colors** - Use brand tokens
- **Don't create global styles** - Shadow DOM is isolated
- **Don't use inline styles** - Keep in style files
- **Don't put conditionals in views** - All conditionals handled by state machine + CSS

## Example: Complete Todo Style

```json
{
  "$type": "style",
  "$id": "style_todo_001",
  
  "components": {
    "todoApp": {
      "display": "flex",
      "flexDirection": "column",
      "gap": "var(--spacing-lg)",
      "padding": "var(--spacing-xl)",
      "maxWidth": "800px",
      "margin": "0 auto"
    },
    "header": {
      "marginBottom": "var(--spacing-lg)"
    },
    "inputRow": {
      "display": "flex",
      "gap": "var(--spacing-sm)"
    },
    "todosList": {
      "display": "flex",
      "flexDirection": "column"
    },
    "card": {
      "display": "flex",
      "alignItems": "center",
      "padding": "var(--spacing-sm)",
      "borderBottom": "1px solid var(--color-border)",
      "gap": "var(--spacing-sm)",
      "transition": "all 0.2s",
      ":hover": {
        "backgroundColor": "var(--color-surface)"
      },
      "data": {
        "done": {
          "true": {
            "opacity": "0.6"
          }
        },
        "isDragged": {
          "true": {
            "opacity": "0.3",
            "pointerEvents": "none"
          }
        }
      }
    },
    "body": {
      "flex": "1",
      "color": "var(--color-text)"
    },
    "buttonSmall": {
      "marginLeft": "auto",
      "padding": "var(--spacing-xs) var(--spacing-sm)",
      "color": "var(--color-danger)",
      "backgroundColor": "transparent",
      "border": "none",
      "cursor": "pointer",
      "fontSize": "1.25rem",
      "borderRadius": "var(--border-radius-sm)",
      "transition": "background-color 0.2s",
      ":hover": {
        "backgroundColor": "rgba(239, 68, 68, 0.1)"
      }
    }
  },
  "selectors": {
    "h1": {
      "fontSize": "var(--font-size-h1)",
      "fontWeight": "var(--font-weight-bold)",
      "color": "var(--color-text)",
      "marginBottom": "var(--spacing-md)"
    },
    ".card[data-done=\"true\"] .body": {
      "textDecoration": "line-through",
      "color": "var(--color-text-muted)"
    }
  }
}
```

## Debugging Styles

```javascript
// Inspect actor styles
console.log(actor.styleDef);

// View compiled CSS
const shadowRoot = actor.container.shadowRoot;
const styleElement = shadowRoot.querySelector('style');
console.log(styleElement.textContent);

// Test style changes
styleElement.textContent += `
  .todo-item { background: red; }
`;
```

## Next Steps

- Learn about [Brand](./08-brand.md) - Design system foundation
- Explore [Views](./07-views.md) - How to use style classes
- Understand [Actors](./02-actors.md) - Linking styles to actors

---

# 10_OPERATIONS

*Source: creators/10_operations.md*

# Operations-Based Architecture

> ⚠️ **ADVANCED TOPIC - Jazz/CoJSON Integration**
>
> This document describes the advanced operations architecture for Jazz/CoJSON integration.
> For basic database operations with the `@db` tool, see [State Machines](./05-state.md) and [Tools](./06-tools.md).

## Overview

MaiaOS uses a **unified operations-based API** where all database interactions (read, write, schema management) are expressed as JSON-configurable operations through a single entry point: `o.db({ op })`.

This architecture provides:
- **JSON-native**: All operations are pure JSON configurations
- **LLM-analyzable**: Each operation has a formal JSON Schema DSL
- **Composable**: Operations can be nested (batch operations)
- **Type-safe**: Runtime validation against operation schemas
- **Uniform**: Single API for all database interactions

> Note: Basic MaiaOS applications use the simpler `@db` tool (create, update, delete, toggle, query). This document covers the more advanced operations engine for Jazz/CoJSON integration.

## Core Concept

Instead of multiple method APIs (`db.create()`, `db.read()`, etc.), everything flows through:

```javascript
await o.db({ op: "operationName", ...params })
```

Where:
- `o` = MaiaOS context object
- `db()` = Operations engine dispatcher
- `{ op, ...params }` = JSON operation configuration

## Available Operations

### Schema Operations

#### `registerSchema`
Register a new JSON Schema in the registry.

```javascript
const result = await o.db({
  op: "registerSchema",
  name: "Post",
  definition: {
    type: "co-map",
    properties: {
      title: { type: "string" },
      content: { type: "string" },
      author: { 
        type: "co-id",
        $ref: "https://maia.city/co_zAuthorSchemaId"
      }
    },
    required: ["title", "content"]
  }
});
// Returns: { schemaId: "co_z...", name: "Post" }
```

#### `loadSchema`
Load a schema definition by ID.

```javascript
const schema = await o.db({
  op: "loadSchema",
  schemaId: "co_z..."
});
// Returns: { $schema, $id, type, properties, ... }
```

#### `listSchemas`
List all registered schemas.

```javascript
const result = await o.db({
  op: "listSchemas"
});
// Returns: { schemas: [{ id, name, definition }, ...] }
```

### Data Operations

#### `create`
Create a new CoValue with schema validation.

```javascript
const result = await o.db({
  op: "create",
  schema: "co_zPostSchemaId",
  data: {
    title: "Hello World",
    content: "My first post",
    author: "co_zAuthorId",
    likes: 0
  }
});
// Returns: { id: "co_z...", coValue: {...} }
```

The created CoValue automatically gets a `$schema` property pointing to the schema ID.

#### `read`
Read a CoValue with optional deep resolution.

**Basic read:**
```javascript
const post = await o.db({
  op: "read",
  target: { id: "co_zPostId" }
});
```

**Deep resolution:**
```javascript
const post = await o.db({
  op: "read",
  target: { id: "co_zPostId" },
  resolve: {
    author: {}, // Resolve author reference
    comments: { // Resolve nested list
      each: {   // Resolve each comment
        author: {} // Resolve each comment's author
      }
    }
  }
});
```

**Resolution options:**
- `{}`: Resolve one level
- `each: {}`: Resolve each item in a CoList
- `onError: "null"`: Return null on resolution failure (default: throw)
- Depth limit: 10 levels (configurable via MAX_DEPTH)

#### `update`
Update a CoValue (CoMap or CoList).

**CoMap update:**
```javascript
await o.db({
  op: "update",
  target: { id: "co_zPostId" },
  changes: {
    title: "Updated Title",
    likes: { op: "increment", by: 1 }
  }
});
```

**Nested operations:**
- `{ op: "set", value: X }`: Set value
- `{ op: "increment", by: N }`: Increment number
- `{ op: "decrement", by: N }`: Decrement number
- `{ op: "delete" }`: Delete property

**CoList update:**
```javascript
await o.db({
  op: "update",
  target: { id: "co_zListId" },
  changes: {
    items: [
      { op: "push", value: "co_zNewItemId" },
      { op: "splice", index: 2, deleteCount: 1 },
      { op: "set", index: 0, value: "co_zUpdatedId" }
    ]
  }
});
```

**List operations:**
- `push`: Append to end
- `unshift`: Prepend to start
- `set`: Update at index
- `splice`: Insert/delete items
- `pop`: Remove last item
- `shift`: Remove first item
- `remove`: Remove by predicate or index
- `retain`: Keep only matching items

#### `delete`
Delete a CoValue (soft or hard).

**Soft delete (clear content):**
```javascript
await o.db({
  op: "delete",
  target: { id: "co_zPostId" }
});
```

**Hard delete (unmount from memory):**
```javascript
await o.db({
  op: "delete",
  target: { id: "co_zPostId" },
  hard: true
});
```

### Inspection Operations

#### `allLoaded`
List all currently loaded CoValues in memory (debug tool).

```javascript
const result = await o.db({
  op: "allLoaded",
  filter: { type: "comap" } // Optional filter
});
// Returns: {
//   coValues: [{ id, type, schema, properties, size, loadedAt }, ...],
//   totalCount: 12,
//   totalSize: "4.1 KB",
//   byType: { comap: 11, colist: 1 },
//   bySchema: { Post: 2, Author: 1 }
// }
```

### Composite Operations

#### `batch`
Execute multiple operations in sequence or parallel.

**Sequential batch:**
```javascript
await o.db({
  op: "batch",
  mode: "sequential",
  operations: [
    { op: "create", schema: authorSchemaId, data: {...} },
    { op: "create", schema: postSchemaId, data: {...} },
    { op: "update", target: {...}, changes: {...} }
  ]
});
```

**Parallel batch:**
```javascript
await o.db({
  op: "batch",
  mode: "parallel",
  operations: [
    { op: "read", target: { id: "co_z1" } },
    { op: "read", target: { id: "co_z2" } },
    { op: "read", target: { id: "co_z3" } }
  ]
});
```

**Error handling:**
```javascript
await o.db({
  op: "batch",
  mode: "sequential",
  continueOnError: true, // Don't stop on errors
  operations: [...]
});
```

## Operation DSL Schemas

Each operation type has a formal JSON Schema definition that validates the operation configuration. These DSL schemas are located at:

```
libs/maia-schemata/src/operations/
  - register-schema.operation.json
  - load-schema.operation.json
  - list-schemas.operation.json
  - read.operation.json
  - create.operation.json
  - update-map.operation.json
  - update-list.operation.json
  - delete.operation.json
  - all-loaded.operation.json
  - batch.operation.json
```

> Note: Operations schemas are not currently implemented. The `@db` tool uses simpler operation validation.

All schemas use the `$id` format: `https://maia.city/operations/{name}`

### Example DSL Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://maia.city/operations/read",
  "title": "Read Operation Schema",
  "type": "object",
  "properties": {
    "op": { "const": "read" },
    "target": {
      "type": "object",
      "properties": {
        "id": { "type": "string", "pattern": "^co_z[a-zA-Z0-9]+$" }
      },
      "required": ["id"]
    },
    "resolve": { "type": "object" }
  },
  "required": ["op", "target"],
  "additionalProperties": false
}
```

## Operations Engine Architecture

```
o.db({ op })
    ↓
OperationsEngine
    ↓
OperationsValidator (validates against DSL schema)
    ↓
Operation Handler (executes operation)
    ↓
Kernel (SchemaStore, Node, SubscriptionCache)
    ↓
cojson (raw CRDTs)
```

### Components

**OperationsEngine** (`operations-engine.engine.js`)
- Central dispatcher for all operations
- Registers operation handlers
- Exposes itself to kernel for nested operations

**OperationsValidator** (`operations-validator.js`)
- Loads all DSL schemas at initialization
- Validates operations before execution
- Provides detailed error messages

**Operation Handlers** (`handlers/`)
- `schema-handler.js`: registerSchema, loadSchema, listSchemas
- `read-handler.js`: read + deep resolution
- `create-handler.js`: create with validation
- `update-map-handler.js`: CoMap updates
- `update-list-handler.js`: CoList updates
- `delete-handler.js`: soft/hard delete
- `inspector-handler.js`: allLoaded
- `batch-handler.js`: composite operations
- `resolver.js`: Deep resolution engine

## Read-Only Wrappers

The `maia-cojson` kernel provides read-only wrapper classes around raw cojson CRDTs:

```javascript
import { CoMap, CoList, CoStream } from "@maiaos/maia-cojson";

// Wrappers provide convenient read access:
const post = CoMap.fromRaw(rawCoMap);
console.log(post.title);  // Read property
console.log(post.keys()); // Get all keys

// But ALL mutations go through operations:
await o.db({
  op: "update",
  target: { id: post.$id },
  changes: { title: "New Title" }
});
```

**Key points:**
- Wrappers are **read-only** proxies
- They provide `$id`, `$type`, `$schema` metadata
- All mutations MUST use `o.db({ op: "update" })`
- Automatic subscription management via `SubscriptionCache`

## Best Practices

### 1. Always Use Operations

```javascript
// ❌ Direct mutation (not possible)
post.title = "New Title";

// ✅ Update operation
await o.db({
  op: "update",
  target: { id: post.$id },
  changes: { title: "New Title" }
});
```

### 2. Leverage Deep Resolution

```javascript
// ❌ Multiple read operations
const post = await o.db({ op: "read", target: { id: postId } });
const author = await o.db({ op: "read", target: { id: post.author } });

// ✅ Single read with deep resolution
const post = await o.db({
  op: "read",
  target: { id: postId },
  resolve: { author: {} }
});
```

### 3. Use Batch for Multiple Operations

```javascript
// ❌ Sequential awaits
const r1 = await o.db({ op: "read", target: { id: "co_z1" } });
const r2 = await o.db({ op: "read", target: { id: "co_z2" } });

// ✅ Parallel batch
const results = await o.db({
  op: "batch",
  mode: "parallel",
  operations: [
    { op: "read", target: { id: "co_z1" } },
    { op: "read", target: { id: "co_z2" } }
  ]
});
```

### 4. Store $schema Reference

When creating CoMaps, the `$schema` property is automatically added:

```javascript
// The create handler automatically sets:
rawCoMap.set("$schema", schemaId);
rawCoMap.set("title", data.title);
rawCoMap.set("content", data.content);
```

This enables:
- Runtime validation
- Schema introspection
- Inspector schema resolution

## Migration from Method-Based API

**Old API** (deprecated):
```javascript
const post = await db.create({ schema: schemaId, data });
const loaded = await db.read({ id: postId });
await db.update({ id: postId, changes: { title: "New" } });
await db.delete({ id: postId });
```

**New API** (operations-based):
```javascript
const post = await o.db({ op: "create", schema: schemaId, data });
const loaded = await o.db({ op: "read", target: { id: postId } });
await o.db({ op: "update", target: { id: postId }, changes: { title: "New" } });
await o.db({ op: "delete", target: { id: postId } });
```

## Testing

All operation handlers have comprehensive test coverage:

```bash
cd libs/maia-script
bun test
```

Tests include:
- DSL schema validation
- CRUD operations against real CRDTs
- Deep resolution with circular reference detection
- Batch operations (sequential/parallel)
- Error handling and edge cases
- Zero mocks policy (all tests use real cojson)

## Example: Blog Application

See the complete example at `libs/maia-vibes/src/todos/`:

```javascript
// Initialize MaiaOS
const o = await createMaiaOS({ ... });

// Register schemas
await o.db({
  op: "registerSchema",
  name: "Post",
  definition: { ... }
});

// Create post
const post = await o.db({
  op: "create",
  schema: postSchemaId,
  data: { title: "Hello", content: "World", likes: 0 }
});

// Like post (increment operation)
await o.db({
  op: "update",
  target: { id: post.id },
  changes: { likes: { op: "increment", by: 1 } }
});

// Read with author resolution
const fullPost = await o.db({
  op: "read",
  target: { id: post.id },
  resolve: { author: {} }
});
```

## Future Enhancements

Potential future operations:
- `subscribe`: Explicit subscription management
- `unsubscribe`: Remove subscriptions
- `migrate`: Schema migration operations
- `export`: Export CoValues to JSON
- `import`: Import JSON into CoValues
- `query`: Advanced filtering/querying
- `transaction`: Multi-operation atomicity

## References

- Operations Engine: `libs/maia-script/src/o/engines/operations-engine/`
- Schemas: `libs/maia-schemata/src/`
- Example Vibe: `libs/maia-vibes/src/todos/`
- Tests: `libs/maia-script/src/o/engines/operations-engine/handlers/*.test.js`

---

# BEST PRACTICES

*Source: creators/11-best-practices.md*

# Best Practices: Actor Architecture

**Comprehensive guide to building scalable, maintainable MaiaOS applications**

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

#### Layer 1: Vibe Service Actor (Business Logic)

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
  "$type": "context",
  "composite": "@composite"
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
  "$type": "context",
  "title": "Todo List",                    // UI presentation
  "inputPlaceholder": "Add a new todo...", // UI presentation
  "addButtonText": "Add",                  // UI presentation
  "viewMode": "list",                      // UI orchestration
  "currentView": "@list",                  // UI orchestration
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
  "$type": "context",
  "todosTodo": [],        // Filtered data (query result)
  "todosDone": [],       // Filtered data (query result)
  "draggedItemId": null, // Component-specific UI state
  "dragOverColumn": null // Component-specific UI state
}
```

**List Actor:**
```json
{
  "$type": "context",
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
  "$type": "actor",
  "children": {
    "todos": "actor_todos_001",
    "notes": "actor_notes_001"
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
  "$type": "actor",
  "$id": "actor_todos_service_001",
  "role": "service",
  "stateRef": "todos-service",
  "contextRef": "todos-service"
}
```

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
  "$type": "actor",
  "$id": "actor_todos_feature_001",
  "role": "composite",
  "viewRef": "todos-feature",
  "stateRef": "todos-feature",
  "children": {
    "list": "actor_todos_list_001",
    "kanban": "actor_todos_kanban_001"
  }
}
```

---

## 9. Anti-Patterns to Avoid

### ❌ Don't: Put UI State in Service Actor

**Bad:**
```json
{
  "$type": "context",
  "viewMode": "list",        // ❌ UI state in service
  "listButtonActive": true,  // ❌ UI state in service
  "newTodoText": ""          // ❌ Form state in service
}
```

**Good:**
```json
{
  "$type": "context",
  "composite": "@composite"  // ✅ Only business logic references
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
  "$type": "actor",
  "role": "service",
  "stateRef": "monolithic-service"  // ❌ Everything in one service
}
```

**Good:**
```json
{
  "$type": "actor",
  "role": "service",
  "children": {
    "todos": "actor_todos_service_001",    // ✅ Domain separation
    "notes": "actor_notes_service_001",   // ✅ Domain separation
    "calendar": "actor_calendar_service_001"  // ✅ Domain separation
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

---

# README

*Source: creators/README.md*

# MaiaOS Creator Documentation

Creator-facing documentation for building with MaiaOS.

## Documentation Order

Read the documentation in the following order for a complete understanding:

### 0. [Vibes](./00-vibes.md)
**Understanding the Vibe System**
- What are Vibes?
- Vibe composition and structure
- Vibe ecosystem

### 1. [Kernel](./01-kernel.md)
**MaiaOS Kernel Fundamentals**
- Kernel architecture
- Core concepts
- System initialization

### 2. [Actors](./02-actors.md)
**Actor-Based Component System**
- What are Actors?
- Actor lifecycle
- Actor composition
- Actor references and identity

### 3. ~~[Skills](../future/03-skills.md)~~ *(Future Feature - v0.5+)*
**AI Agent Skills** *(Not yet implemented)*
- Skill definitions
- How to create skills
- Skill composition
- LLM integration

### 4. [Context](./04-context.md)
**Context Management**
- Context system
- Context passing
- Context composition
- Data flow

### 5. [State](./05-state.md)
**State Management**
- State machines
- State transitions
- Event handling
- Reactive state

### 6. [Tools](./06-tools.md)
**Tool System**
- Tool definitions
- Tool execution
- Tool composition
- Custom tools

### 7. [Views](./07-views.md)
**View System**
- View structure
- View composition
- View-to-DOM rendering
- Reactive updates

### 8. [Brand](./08-brand.md)
**Brand System**
- Brand definitions
- Brand tokens
- Brand composition
- Theme system

### 9. [Style](./09-style.md)
**Style System**
- Style definitions
- CSS generation
- Style composition
- Responsive design

### 10. [Best Practices](./10-best-practices.md)
**Best Practices and Patterns**
- Recommended patterns
- Common pitfalls
- Performance tips
- Maintainability

---

## Who This Is For

This documentation is for **creators** who want to:
- Build applications with MaiaOS
- Create vibes (component definitions)
- Compose features using the declarative DSL
- Integrate AI agents into applications
- Design and style user interfaces

## What You'll Learn

- How to use MaiaScript (`.maia` files)
- How to compose actors, state machines, views, and styles
- How to create AI-powered features with skills
- How to manage state and context
- How to build reactive, collaborative applications

---

## Related Documentation

- [Developer Documentation](../developers/) - Technical implementation details
- [Getting Started](../getting-started/) - Quick start guides
- [Agent Documentation](../agents/) - Auto-generated LLM agent docs

---

## Contributing

When updating these docs:
- ✅ Keep content user-friendly and example-driven
- ✅ Focus on "how to use" rather than "how it works"
- ✅ Include practical examples
- ❌ **DO NOT** update `docs/agents/LLM_*.md` files (auto-generated)

To regenerate agent docs after updating:
```bash
bun run generate:llm-docs
```

---

