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
- **DBEngine** - Unified database operation engine (query, create, update, delete, toggle, seed)
- **SubscriptionEngine** - Context-driven reactive subscriptions
- **MessageQueue** - Actor-to-actor message passing
- **ModuleRegistry** - Manages dynamic module loading
- **MaiaScriptEvaluator** - Evaluates DSL expressions

### Tool
An executable function (`.tool.js` + `.tool.maia`). The ONLY place imperative code lives. Tools mutate actor context or execute operations based on payloads.

**Structure:**
- `.tool.maia` - JSON schema (AI-compatible metadata)
- `.tool.js` - JavaScript function (execution logic)

**Example:**
```javascript
// db.tool.js - Database operations
export default {
  async execute(actor, payload) {
    const os = actor.actorEngine.os;
    return await os.db(payload); // {op: "create", schema: "co_z...", data: {...}}
  }
};
```

### Module
A collection of related tools (`.module.js`). Modules register tools with the ToolEngine at boot time.

**Built-in Modules:**
- `db` - Database operations (unified API: `@db`)
- `core` - UI utilities (modals, focus, preventDefault)
- `dragdrop` - Drag-and-drop handlers
- `interface` - Interface validation

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
Database operations don't know about specific data types. They work with generic `schema` (co-ids) and `data` parameters.

**Example:**
```javascript
@db { op: "create", schema: "co_z...", data: {...} }
@db { op: "update", schema: "co_z...", id: "co_z...", data: {...} }
@db { op: "delete", schema: "co_z...", id: "co_z..." }
```

Same tool, different schema. Zero hardcoded domain knowledge. All schemas are co-ids (CoJSON IDs).

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
