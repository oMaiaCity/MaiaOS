# MaiaOS Architecture Overview

**Version:** 0.4  
**Last Updated:** January 2026

## Philosophy

MaiaOS is a **declarative operating system** for building AI-composable applications. It separates concerns into three layers:

1. **Definition Layer** (Actors, Skills, State Machines, Views) - WHAT to do
2. **Execution Layer** (Engines, Tools) - HOW to do it  
3. **Intelligence Layer** (LLM Agents via Skills) - WHY and WHEN to do it

### Core Principle

> Actors are pure declarative specifications. Engines are the execution machinery. Skills are the interface for AI agents to orchestrate actors.

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

## Three Layers Explained

### 1. Definition Layer (Declarative)

**Actors** - Autonomous UI/service components with:
- `actor.maia` - Identity, references (contextRef, stateRef, viewRef, etc.)
- `context.maia` - Initial runtime data (optional, can be inline)
- `state.maia` - State machine (behavior flow)
- `view.maia` - UI representation (optional)
- `style.maia` - Styling (optional)
- `skill.maia` - AI agent interface (NEW in v0.5)

**Example:**
```json
{
  "$type": "actor",
  "id": "actor_todo_001",
  "contextRef": "todo",    // ← References todo.context.maia
  "stateRef": "todo",
  "viewRef": "todo",
  "skillRef": "todo"
}
```

Actors are **declarative configurations**. They don't contain logic - they reference it. Context can be defined inline or in a separate `.context.maia` file for cleaner organization.

### 2. Execution Layer (Imperative)

**Engines** - Core execution machinery:
- `ActorEngine` - Orchestrates actors, manages lifecycle
- `StateEngine` - Interprets state machines, executes transitions
- `ViewEngine` - Renders views to Shadow DOM
- `ToolEngine` - Executes tool actions
- `StyleEngine` - Compiles styles to CSS
- `ModuleRegistry` - Manages dynamic module loading
- `MaiaScriptEvaluator` - Evaluates DSL expressions

**Tools** - Executable functions organized by module:
- `@mutation/*` - Generic CRUD (create, update, delete, toggle)
- `@core/*` - UI utilities (modals, view modes)
- `@dragdrop/*` - Drag-and-drop handlers
- `@context/*` - Context manipulation

Tools are **imperative implementations**. They execute actions.

### 3. Intelligence Layer (AI Orchestration)

**Skills** - Interface specifications for LLM agents:
- Describe what an actor can do
- Define events and payloads
- Document context schema
- Provide usage patterns and best practices

**Example:**
```json
{
  "$type": "skill",
  "actorType": "todo",
  "capabilities": {
    "taskManagement": "Create, complete, delete todos"
  },
  "stateEvents": {
    "CREATE_TODO": {
      "payload": {"text": "string"},
      "when": "User wants to add a task"
    }
  }
}
```

Skills are **metadata for AI agents**. They enable discovery and orchestration.

## Data Flow

### 1. User Interaction Flow
```
User Input
  ↓
ViewEngine (handles event)
  ↓
StateEngine.send(EVENT_NAME, payload)
  ↓
StateEngine evaluates guards & transitions
  ↓
ToolEngine.execute(toolName, actor, payload)
  ↓
Tool mutates actor.context
  ↓
ActorEngine.rerender(actor)
  ↓
ViewEngine renders updated UI
```

### 2. AI Agent Interaction Flow
```
LLM Agent receives user intent
  ↓
Agent queries SkillEngine for available actors
  ↓
Agent reads skill definitions
  ↓
Agent generates appropriate events + payloads
  ↓
Agent sends events to actors via StateEngine
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
│   │   ├── core.module.js      # UI tools
│   │   ├── mutation.module.js  # CRUD tools
│   │   └── dragdrop.module.js  # Drag-drop tools
│   ├── tools/                  # Tool implementations
│   │   ├── core/
│   │   ├── mutation/
│   │   ├── dragdrop/
│   │   └── context/
│   └── skills/                 # AI agent interfaces (v0.5)
│       └── todo.skill.maia
│
├── examples/                   # Example applications
│   └── todos/
│       ├── index.html          # App entry point
│       ├── todo.actor.maia     # Actor definition (references only)
│       ├── todo.context.maia   # Initial runtime data
│       ├── todo.state.maia     # State machine
│       ├── todo.view.maia      # UI template
│       ├── todo.style.maia     # Local styles
│       ├── brand.style.maia    # Design system
│       └── todo.skill.maia     # AI interface (v0.5)
│
└── docs/                       # Documentation
    ├── ARCHITECTURE.md         # This file
    ├── vibecreators/           # User-facing docs (for app builders)
    │   ├── 01-kernel.md
    │   ├── 02-actors.md
    │   ├── 03-skills.md
    │   ├── 04-context.md
    │   ├── 05-state.md
    │   ├── 06-tools.md
    │   ├── 07-views.md        # UI first
    │   ├── 08-brand.md        # Then styling
    │   └── 09-style.md
    ├── developers/             # Developer docs (for engine/tool builders)
    │   ├── maiaos.md
    │   ├── engines.md
    │   ├── tools.md
    │   └── dsl.md
    └── agents/                 # LLM-optimized docs (auto-generated)
        ├── LLM_Vibecreator.md  # ARCHITECTURE + vibecreators
        └── LLM_Developers.md   # ARCHITECTURE + developers
```

## Key Concepts

### Actors Are Declarative Specifications
Actors contain **zero embedded logic**. They are lightweight configuration files that:
- Reference a context (initial runtime data, optional)
- Reference a state machine (behavior)
- Reference a view (UI)
- Reference a style (appearance)
- Reference a skill (AI interface)

Logic lives in **state machines** and **tools**, not actors. Data lives in **context files** (or inline). This separation makes actors simple, composable, and AI-friendly.

### Everything Is Modular
- Tools are grouped into modules (`@core/*`, `@mutation/*`)
- Modules are loaded dynamically at boot
- Engines are pluggable (future: add ThreeJS renderer)
- Skills describe capabilities without implementation

### Schema-Agnostic By Design
Tools don't know about "todos" or "notes". They work with:
```javascript
@mutation/create {schema: "todos", data: {...}}
@mutation/create {schema: "notes", data: {...}}
```

Same tool, different schema. Zero hardcoded domain knowledge.

### AI-First Architecture
Skills make actors **discoverable and orchestratable** by AI:
- LLM reads skill → understands capabilities
- LLM generates events → actor executes
- LLM queries context → reads state
- No hardcoded workflows required

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

→ Read [VIBE Documentation](./vibe/) for building applications  
→ Read [Developer Documentation](./developers/) for extending MaiaOS  
→ See [examples/todos/](../examples/todos/) for a complete example
