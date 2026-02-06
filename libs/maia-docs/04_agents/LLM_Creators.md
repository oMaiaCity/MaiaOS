# MaiaOS Documentation for Creators

**Auto-generated:** 2026-02-06T13:59:28.862Z
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
1. Browser loads `o/kernel.js` (single entry point)
2. Kernel initializes engines (Actor, View, State, Tool, DB, Subscription, etc.)
3. Kernel loads modules (db, core, dragdrop)
4. Kernel seeds database with configs, schemas, and tool definitions
5. Kernel loads `.maia` files via `fetch()` or database queries
6. Engines interpret and execute
7. Shadow DOM renders isolated UI
8. Done!

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
- `DBEngine` - Unified database operations (query, create, update, delete, toggle)
- `SubscriptionEngine` - Context-driven reactive subscriptions
- `MessageQueue` - Actor-to-actor communication

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

### Context

Runtime data for an actor (`.context.maia`). All state lives here: collections, UI state, form values, etc. Can be inline or separate file.

### State Machine

Behavior flow definition (`.state.maia`). XState-like state machine with states, transitions, guards, and actions. Defines WHAT happens WHEN.

### View

UI structure definition (`.view.maia`). Declarative DOM tree with expressions, loops, conditionals, and event handlers. Renders to Shadow DOM.

### Style

Appearance definition (`.style.maia`). Design tokens + component styles. Compiles to CSS and injects into Shadow DOM.

**Types:**

- **Brand** (`brand.style.maia`) - Shared design system
- **Local** (`actor.style.maia`) - Actor-specific overrides

### Skill

AI agent interface specification (`.skill.maia`). Describes actor capabilities, events, context schema, and usage patterns for LLM orchestration.

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

### Module

A collection of related tools (`.module.js`). Modules register tools with the ToolEngine at boot time.

**Built-in Modules:**

- `db` - Database operations (unified API: `@db`)
- `core` - UI utilities (modals, preventDefault, publishMessage)
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

### Payload

Data passed with an event. Can contain expressions that are evaluated at runtime.

**Expression Types:**

- `$field` - Context reference (`actor.context.field`)
- `$$field` - Item reference (in loops: `item.field`)
- `@inputValue` - DOM value reference (`input.value`)

### Guard

A condition that determines if a transition should occur. Evaluated before state change.

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

Database operations don't know about specific data types. They work with generic `schema` (co-ids) and `data` parameters. Same tool, different schema. Zero hardcoded domain knowledge. All schemas are co-ids (CoJSON IDs).

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

| Term      | Type       | Purpose                  |
| --------- | ---------- | ------------------------ |
| **Actor** | Definition | Component configuration |
| **Context** | Definition | Runtime data |
| **State** | Definition | Behavior flow |
| **View** | Definition | UI structure |
| **Style** | Definition | Appearance |
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
- **core** - UI utilities (modals, preventDefault, publishMessage)
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

### Clone the Repository

```bash
# Clone
git clone https://github.com/oMaiaCity/MaiaOS.git
cd MaiaOS

# Install dependencies (from root - installs for all workspaces)
bun install

# Start dev server (from root or specific service)
bun dev:app  # Main app service (port 4202)
# OR
cd libs/maia-script
bun dev  # MaiaScript dev server

# Open browser
open http://localhost:4202/  # or appropriate port
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
        "tool": "@db",
        "payload": {
          "op": "create",
          "schema": "co_z...",
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

**Note:** The `schema` field must be a co-id (CoJSON ID like `co_z...`). Schema references are resolved during vibe loading/seeding.

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

- [Vibecreators Docs](../02_creators/) - Learn to build apps
- [Examples](../../maia-vibes/src/todos/) - See complete working app
- [Developers Docs](../03_developers/) - Extend MaiaOS core

## Resources

- **Examples:** `libs/maia-vibes/src/todos/`
- **Kernel:** `libs/maia-script/src/o/kernel.js`
- **Engines:** `libs/maia-script/src/o/engines/`
- **Tools:** `libs/maia-script/src/o/tools/`
- **Modules:** `libs/maia-script/src/o/modules/`
- **Docs:** `libs/maia-docs/`

## Support

- GitHub Issues: [Report bugs](https://github.com/oMaiaCity/MaiaOS/issues)

---

# OVERVIEW

*Source: creators/00-overview.md*

# MaiaOS Creator Documentation

Creator-facing documentation for building with MaiaOS.

## Documentation Order

Read the documentation in the following order for a complete understanding:

### 1. [Vibes](./01-vibes.md)
**Understanding the Vibe System**
- What are Vibes?
- **Agent-first development pattern** (ALWAYS create agent service actor first!)
- Vibe composition and structure
- Vibe ecosystem

### 2. [Kernel](./02-kernel.md)
**MaiaOS Kernel Fundamentals**
- Kernel architecture
- Core concepts
- System initialization

### 3. [Actors](./03-actors.md)
**Actor-Based Component System**
- What are Actors?
- **Architectural roles:** State machine defines transitions, context contains data, view renders from context
- **Single source of truth:** Everything persisted to CoValues, accessed via ReactiveStore
- **Agent-first development** (create agent service actor first!)
- Actor lifecycle
- Actor composition
- Co-id references and seeding transformation
- Brand/style separation (`brand` required, `style` optional)

### 4. [Context](./04-context.md)
**Context Management**
- Context system (ReactiveStore pattern)
- Universal `read()` API - Every CoValue accessible as ReactiveStore
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

### 7. [Operations](./07-operations.md)
**Database Operations API**
- Universal `read()` API - Every CoValue accessible as ReactiveStore
- Unified database operations (`maia.db()`)
- Query, create, update, delete, toggle operations
- Reactive subscriptions via ReactiveStore pattern
- Co-id usage and schema transformation

### 8. [Views](./08-views.md)
**View System**
- View structure
- View composition
- View-to-DOM rendering
- Reactive updates

### 9. [Brand](./09-brand.md)
**Brand System (Shared Design System)**
- Brand definitions (`brand.style.maia`)
- Brand tokens (colors, spacing, typography)
- Brand components (shared UI patterns)
- **Required** - All actors reference brand via `brand` property

### 10. [Style](./10-style.md)
**Style System (Actor-Specific Overrides)**
- Local style definitions (`{name}.style.maia`)
- Actor-specific customization
- **Optional** - Actors can override brand via `style` property
- StyleEngine merges brand + style (brand first, style overrides)

### 11. [Best Practices](./11-best-practices.md)
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
- **Architectural roles:** State machine defines transitions, context contains data, view renders from context
- **Single source of truth:** Everything is persisted to CoValues, accessed reactively via universal `read()` API

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

# VIBES

*Source: creators/01-vibes.md*

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

### Default Pattern: Agent Service Actor Entry Point

**Every vibe MUST have an "agent" service actor** as its entry point. This orchestrating service actor is called the **agent** and handles all business logic, data management, and coordination.

**Best Practice:** Always define the agent service actor first when creating a vibe.

```
Vibe → Agent (Service Actor) → Composite Actor → UI Actors
```

**Why "agent"?**
- Clear naming convention: the agent orchestrates everything
- Consistent across all vibes: every vibe has an `@actor/agent`
- AI-friendly: agents understand this pattern
- Best practice: start with the agent, then build UI actors

This pattern ensures:
- ✅ Clear separation of concerns (service logic vs. UI)
- ✅ Scalable architecture (add UI actors as needed)
- ✅ Message-based communication (loose coupling)
- ✅ Consistent structure across all vibes
- ✅ Agent-first development (define orchestrator first)

## Vibe Structure

Create a file named `manifest.vibe.maia`:

```json
{
  "$schema": "@schema/vibe",
  "$id": "@vibe/todos",
  "name": "Todo List",
  "description": "A complete todo list application",
  "actor": "@actor/agent"
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `$schema` | string | Schema reference (`@schema/vibe`) - transformed to co-id during seeding |
| `$id` | string | Unique vibe identifier (`@vibe/todos`) - transformed to co-id during seeding |
| `name` | string | Display name for marketplace |
| `description` | string | Brief description of the app |
| `actor` | string | Reference to agent service actor (`@actor/agent`) - transformed to co-id during seeding |

### Field Details

**`$schema`:** Schema reference (`@schema/vibe`) - identifies this as a vibe manifest and is transformed to co-id during seeding.

**`$id`:** Unique vibe identifier (`@vibe/todos`) - transformed to co-id during seeding. Used for internal references.

**`name`:** The human-readable name that appears in marketplace listings, app launchers, etc.

**`description`:** A brief (1-3 sentence) description of what the app does. This appears in marketplace cards and search results.

**`actor`:** Co-id reference to the agent service actor (`@actor/agent`) - transformed to co-id during seeding. When loading from file, the path is resolved relative to the vibe manifest location.

## Creating a Vibe

### Best Practice: Agent-First Development

**Always create the agent service actor first.** This is your app's orchestrator and entry point.

**Why Agent-First?**
1. **Clear Architecture** - Agent defines the app's structure and data flow
2. **Data First** - Agent handles all data operations before UI concerns
3. **UI Second** - UI actors receive data from agent, keeping them simple
4. **Consistent Pattern** - Every vibe follows the same structure
5. **AI-Friendly** - LLMs understand this pattern and can generate vibes correctly

**Development Order:**
1. ✅ **Create agent service actor** (`agent/agent.actor.maia`) - ALWAYS FIRST
2. ✅ Create vibe manifest (`manifest.vibe.maia`) - References agent
3. ✅ Create composite actor (`composite/composite.actor.maia`) - First UI actor
4. ✅ Create UI actors (`list/list.actor.maia`, etc.) - Leaf components

### Step 1: Organize Your App

Structure your app directory:

```
todos/
├── manifest.vibe.maia    # Vibe manifest
├── agent/                # Agent service actor (ALWAYS CREATE FIRST)
│   ├── agent.actor.maia
│   ├── agent.context.maia
│   ├── agent.state.maia
│   ├── agent.view.maia
│   ├── agent.inbox.maia
│   └── brand.style.maia
├── composite/            # Composite actor (first UI actor)
│   ├── composite.actor.maia
│   └── ...
├── list/                 # UI actors
│   ├── list.actor.maia
│   └── ...
└── agent/                # Brand style (shared design system)
    └── brand.style.maia
```

### Step 2: Create the Vibe Manifest

**`manifest.vibe.maia`:**
```json
{
  "$schema": "@schema/vibe",
  "$id": "@vibe/todos",
  "name": "Todo List",
  "description": "A simple todo list with drag-and-drop organization",
  "actor": "@actor/agent"
}
```

**Note:** The `actor` field references `@actor/agent` - this is the agent service actor that orchestrates the entire vibe.

### Step 3: Create Your Agent Service Actor (ALWAYS FIRST!)

**Best Practice:** Always define the agent service actor first. This is your app's orchestrator.

**`agent/agent.actor.maia` (Agent Service Actor):**
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/agent",
  "role": "agent",
  "context": "@context/agent",
  "state": "@state/agent",
  "view": "@view/agent",
  "brand": "@style/brand",
  "inbox": "@inbox/agent"
}
```

**Note:** Children are defined in `agent.context.maia` via `@actors` system property. See [Actors](./03-actors.md#system-properties-in-context) for details.

**Agent Responsibilities:**
- Orchestrate data queries and mutations
- Manage application-level state
- Coordinate between UI actors via messages
- Handle business logic
- Load composite actor as first child

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

The agent orchestrates the application and loads UI actors as children. See [Actors](./02-actors.md#default-vibe-pattern-service--composite--ui) for the complete pattern.

**Why Start with Agent?**
1. **Clear Architecture** - Agent defines the app's structure
2. **Data First** - Agent handles all data operations
3. **UI Second** - UI actors receive data from agent
4. **Best Practice** - Always define orchestrator before components

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
    import { MaiaOS } from '@MaiaOS/kernel';
    
    async function boot() {
      // Boot MaiaOS
      const os = await MaiaOS.boot({
        modules: ['db', 'core', 'dragdrop']
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
- Validates that it's a proper vibe (`$schema: "@schema/vibe"`)
- Resolves the actor path relative to the vibe location (when loading from file)
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
├── manifest.vibe.maia      # App manifest (references @actor/agent)
├── index.html              # App launcher
├── agent/                  # Agent service actor (ALWAYS CREATE FIRST)
│   ├── agent.actor.maia    # Agent actor definition
│   ├── agent.context.maia  # Agent context (defines children via @actors)
│   ├── agent.state.maia    # Agent state machine
│   ├── agent.view.maia    # Minimal view (renders child)
│   ├── agent.inbox.maia   # Inbox costream
│   └── brand.style.maia   # Shared design system
├── composite/              # Composite actor (first UI actor)
│   ├── composite.actor.maia
│   ├── composite.context.maia
│   ├── composite.state.maia
│   ├── composite.view.maia
│   └── composite.inbox.maia
├── list/                   # UI actor
│   ├── list.actor.maia
│   ├── list.context.maia
│   ├── list.state.maia
│   ├── list.view.maia
│   └── list.inbox.maia
└── kanban/                 # UI actor
    ├── kanban.actor.maia
    ├── kanban.context.maia
    ├── kanban.state.maia
    ├── kanban.view.maia
    └── kanban.inbox.maia
```

**Note:** The agent directory is created first and contains the orchestrating service actor that all other actors depend on.

### Vibe Manifest

**`manifest.vibe.maia`:**
```json
{
  "$schema": "@schema/vibe",
  "$id": "@vibe/todos",
  "name": "Todo List",
  "description": "A complete todo list application with state machines, drag-drop kanban view, and AI-compatible tools. Showcases MaiaOS actor system, message passing, and declarative UI.",
  "actor": "@actor/agent"
}
```

**Note:** The vibe references the **agent service actor** (`@actor/agent`) which orchestrates the application and loads UI actors as children. The agent is always defined first.

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
    import { MaiaOS } from '@MaiaOS/kernel';
    
    async function boot() {
      const os = await MaiaOS.boot({
        modules: ['db', 'core', 'dragdrop']
      });
      
      // Load the vibe
      const { vibe, actor } = await os.loadVibe(
        './manifest.vibe.maia',
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

- **Always create agent first** - Define `@actor/agent` before any UI actors
- **Use schema references** - `@schema/vibe`, `@actor/agent` (transformed to co-ids during seeding)
- **Keep descriptions concise** - 1-3 sentences max
- **Use semantic naming** - `manifest.vibe.maia`, `agent/agent.actor.maia`
- **Reference agent in vibe** - Always use `"actor": "@actor/agent"` in vibe manifest
- **One vibe per app** - Each app gets its own vibe manifest

### ❌ DON'T:

- **Don't skip the agent** - Every vibe MUST have an agent service actor
- **Don't use file paths** - Use schema references (`@actor/agent`, not `"./agent.actor.maia"`)
- **Don't include logic** - Vibes are metadata only
- **Don't duplicate actor properties** - Vibe references actor, doesn't contain it
- **Don't skip schema** - Always include `$schema: "@schema/vibe"`
- **Don't nest actors** - Reference one root actor only (the agent)

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
  "$schema": "@schema/vibe",
  "$id": "@vibe/todos",
  "name": "Todo List",
  "description": "A complete todo list application...",
  "actor": "@actor/agent",
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
console.log(vibe.$id);         // "@vibe/todos" (or co-id after seeding)

// Inspect actor (as usual)
console.log(actor.id);         // "actor_myapp_001"
console.log(actor.context);    // Runtime state
```

### Common Issues

**Error: "Failed to load vibe"**
- Check that the vibe file exists at the specified path
- Verify the path is correct relative to your HTML file

**Error: "Invalid vibe manifest"**
- Ensure your JSON has `"$schema": "@schema/vibe"`
- Check for typos in the $schema field

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

*Source: creators/02-kernel.md*

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
    import { MaiaOS } from '@MaiaOS/kernel';
    
    async function boot() {
      // Boot the operating system
      const os = await MaiaOS.boot({
        modules: ['db', 'core']  // Default modules
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
  // Modules to load (default: ['db', 'core'])
  modules: ['db', 'core']  // Add 'dragdrop' if needed
});
```

## What Happens During Boot?

1. **Initialize Database** - Sets up database backend (CoJSON or IndexedDB)
2. **Initialize Module Registry** - Prepares dynamic module loading
3. **Initialize Engines** - Boots all execution engines:
   - `ActorEngine` - Manages actor lifecycle
   - `StateEngine` - Interprets state machines
   - `ViewEngine` - Renders views
   - `ToolEngine` - Executes tools
   - `StyleEngine` - Compiles styles
   - `MaiaScriptEvaluator` - Evaluates DSL expressions
   - `DBEngine` - Unified database operations (universal `read()` API)
4. **Load Modules** - Dynamically loads specified modules (default: `['db', 'core']`)
5. **Register Tools** - Each module registers its tools

## Available Modules

### Database Module (`db`)
Unified database operations through a single `@db` tool:
- All operations use `op` parameter (`create`, `update`, `delete`, `toggle`, `read`, `seed`)
- **Universal `read()` API** - Every CoValue is accessible as a reactive store
- Example: `{ tool: "@db", payload: { op: "create", schema: "co_z...", data: {...} } }`
- **Note:** Schema must be a co-id (`co_z...`) - schema references (`@schema/todos`) are transformed to co-ids during seeding
- All `read()` operations return ReactiveStore with `.value` and `.subscribe()` methods
- See [Operations](./07-operations.md) for the universal read() API pattern

### Core Module (`core`)
UI utilities and message publishing:
- `@core/publishMessage` - Publish messages to subscribed actors
- `@core/noop` - No-operation (for testing)
- `@core/preventDefault` - Prevent default events

### Drag-Drop Module (`dragdrop`)
Generic drag-and-drop for any schema/field:
- `@dragdrop/start` - Start drag operation
- `@dragdrop/end` - End drag operation
- `@dragdrop/drop` - Handle drop with field update
- `@dragdrop/dragEnter` - Visual feedback on enter
- `@dragdrop/dragLeave` - Visual feedback on leave

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

**Vibes** are app manifests that provide marketplace metadata and reference the agent service actor. This is the recommended way to load applications:

```javascript
// Load a vibe (app manifest)
const { vibe, actor } = await os.loadVibe(
  './vibes/todos/manifest.vibe.maia',
  document.getElementById('app')
);

console.log('Loaded vibe:', vibe.name);        // "Todo List"
console.log('Description:', vibe.description); // App description
console.log('Actor:', actor);                  // Created agent actor instance
```

**What's the difference?**
- `createActor()` - Direct actor creation (low-level)
- `loadVibe()` - Load app via manifest (recommended, marketplace-ready)
  - Always loads the agent service actor (`@actor/agent`)
  - Agent orchestrates the entire application

**Best Practice:** Always create the agent service actor first, then reference it in the vibe manifest.

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
✅ Loaded 3 modules
✅ Registered 11 tools
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

*Source: creators/03-actors.md*

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

## Architectural Roles: Single Source of Truth

**CRITICAL:** MaiaOS follows a strict single source of truth architecture. Everything is persisted to CoValues under the hood, accessed reactively via the universal `read()` API.

### Clear Separation of Responsibilities

**State Machine** → Defines ALL state transitions
- ✅ **Single source of truth** for behavior
- ✅ Defines when and how state changes
- ✅ All transitions flow through state machine
- ✅ Never bypassed - all changes go through state machine

**Context** → Contains ALL data and current state
- ✅ **Single source of truth** for data
- ✅ Stores runtime data (todos, form values, UI state)
- ✅ Always persisted to CoValue under the hood
- ✅ Accessed reactively via ReactiveStore (universal `read()` API)
- ✅ Never mutated directly - always through state machine

**View** → Renders from context variables
- ✅ **Read-only** - only reads from context
- ✅ Sends events to state machine (never updates context directly)
- ✅ Automatically re-renders when context changes
- ✅ Pure presentation - no business logic

### Single Source of Truth: CoValue Under the Hood

**CRITICAL PRINCIPLE:** Everything is persisted to CoValues under the hood. No in-memory mutation hacks!

**How it works:**
```
State Machine Action
  ↓
updateContextCoValue() → Persists to Context CoValue (CRDT)
  ↓
Context ReactiveStore automatically updates
  ↓
View subscribes to ReactiveStore → Re-renders
```

**Key Points:**
- ✅ **Context is a CoValue** - Always persisted, never in-memory only
- ✅ **Accessed via ReactiveStore** - Universal `read()` API pattern
- ✅ **No mutation hacks** - Everything goes through persisted CoValues
- ✅ **Automatic reactivity** - ReactiveStore notifies subscribers when CoValue changes
- ✅ **Single source of truth** - CoValue is the authoritative data store

**Example Flow:**
```json
// State machine defines transition
{
  "idle": {
    "on": {
      "UPDATE_INPUT": {
        "target": "idle",
        "actions": [
          {
            "updateContext": { "newTodoText": "$$newTodoText" }
          }
        ]
      }
    }
  }
}
```

**What happens:**
1. View sends `UPDATE_INPUT` event → inbox → state machine
2. State machine executes `updateContext` action
3. `updateContextCoValue()` persists to Context CoValue (CRDT)
4. Context ReactiveStore automatically updates (read-only derived data)
5. View subscribes to ReactiveStore → sees update → re-renders

**No shortcuts, no hacks:**
- ❌ Never mutate context directly: `actor.context.field = value`
- ❌ Never bypass CoValue persistence
- ❌ Never use in-memory only data structures
- ✅ Always go through persisted CoValues
- ✅ Always access via ReactiveStore (universal `read()` API)

**Visual Flow:**
```
┌─────────────────────────────────────────────────────────┐
│                    USER INTERACTION                      │
│              (clicks button, types text)                │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                      VIEW (Read-Only)                    │
│  • Reads from context ReactiveStore                      │
│  • Sends events to state machine                         │
│  • Never mutates context directly                        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼ (sends event)
┌─────────────────────────────────────────────────────────┐
│                  INBOX COSTREAM                         │
│  • Single source of truth for ALL events                │
│  • Routes events to state machine                        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼ (processes event)
┌─────────────────────────────────────────────────────────┐
│                 STATE MACHINE                            │
│  • Defines ALL state transitions                         │
│  • Executes updateContext action                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼ (persists to CoValue)
┌─────────────────────────────────────────────────────────┐
│              CONTEXT COVALUE (CRDT)                      │
│  ← SINGLE SOURCE OF TRUTH                               │
│  • Always persisted                                      │
│  • Never in-memory only                                  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼ (accessed via ReactiveStore)
┌─────────────────────────────────────────────────────────┐
│            CONTEXT REACTIVESTORE                        │
│  • Reactive access layer                                │
│  • Notifies subscribers when CoValue changes             │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼ (subscribes)
┌─────────────────────────────────────────────────────────┐
│                      VIEW                                │
│  • Re-renders automatically                              │
└─────────────────────────────────────────────────────────┘
```

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
  "brand": "@style/brand",
  "style": "@style/todo",
  "inbox": "@inbox/todo"
}
```

**Note:** All references (`context`, `view`, `state`, `brand`, `style`, `inbox`) use schema/instance references (like `@context/todo`) that are transformed to co-ids (`co_z...`) during seeding. The `$schema` and `$id` properties also use schema references.

### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `$schema` | string | Yes | Schema reference (`@schema/actor`) - transformed to co-id during seeding |
| `$id` | string | Yes | Unique actor identifier (`@actor/todo`) - transformed to co-id during seeding |
| `role` | string | No | Actor role (e.g., `"agent"`, `"composite"`, `"todo-list"`) |
| `context` | string | No | Co-id reference to context (`@context/todo`) - transformed during seeding |
| `state` | string | Yes | Co-id reference to state machine (`@state/todo`) - transformed during seeding |
| `view` | string | No | Co-id reference to view (`@view/todo`) - optional for service actors |
| `brand` | string | Yes | Co-id reference to brand style (`@style/brand`) - shared design system |
| `style` | string | No | Co-id reference to local style (`@style/todo`) - actor-specific overrides |
| `inbox` | string | No | Co-id reference to inbox costream (`@inbox/todo`) - message inbox for events |

**Note:** Children are defined in context files via the `@actors` system property, not in the actor schema. See [Children Architecture](#system-properties-in-context) below.

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
  "brand": "@style/brand",
  "inbox": "@inbox/agent"
}
```

**Note:** Children are defined in the context file via `@actors` system property, not in the actor definition. See [Children Architecture](#system-properties-in-context) below.

**Best Practice:** Always define the agent service actor first when creating a vibe. This is your app's orchestrator.

**Agent View (Minimal):**
```json
{
  "$schema": "@schema/view",
  "$id": "@view/agent",
  "root": {
    "tag": "div",
    "attrs": { "class": "agent-container" },
    "$slot": "$currentView"  // ← Only renders child actor
  }
}
```

**Agent Context:**
```json
{
  "$schema": "@schema/context",
  "$id": "@context/agent",
  "currentView": "@composite",  // ← Context property (CRDT CoValue) - references active child
  "@actors": {
    "composite": "@actor/composite"  // ← System property (like $schema/$id) - defines children
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
  "brand": "@style/brand",
  "inbox": "@inbox/list"
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
  "brand": "@style/brand",
  "inbox": "@inbox/composite"
}
```

**Note:** Children are defined in the context file via `@actors` system property. See the context example below.

**Composite View:**
```json
{
  "$schema": "@schema/view",
  "$id": "@view/composite",
  "content": {
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

**Composite Context:**
```json
{
  "$schema": "@schema/context",
  "$id": "@context/composite",
  "currentView": "@list",  // ← Context property (CRDT CoValue) - references active child
  "@actors": {
    "list": "@actor/list",      // ← System property (like $schema/$id) - defines children
    "kanban": "@actor/kanban"
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

### Context Updates: State Machine as Single Source of Truth

**CRITICAL:** All context updates must flow through state machines.

**Pattern:**
1. View sends event to state machine (via inbox)
2. State machine uses `updateContext` action (infrastructure, not a tool)
3. `updateContextCoValue()` persists to context CoValue (CRDT)
4. Context ReactiveStore automatically updates (read-only derived data)
5. View re-renders with new context

**Example:**
```json
{
  "idle": {
    "on": {
      "UPDATE_INPUT": {
        "target": "idle",
        "actions": [
          {
            "updateContext": { "newTodoText": "$$newTodoText" }
          }
        ]
      }
    }
  }
}
```

**Never:**
- ❌ Mutate context directly: `actor.context.field = value`
- ❌ Update context from views
- ❌ Use `@context/update` tool (removed - use `updateContext` infrastructure action)

**Always:**
- ✅ Update context via state machine actions
- ✅ Use `updateContext` infrastructure action for context updates
- ✅ Handle errors via state machine ERROR events

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
  "brand": "@style/brand",
  "inbox": "@inbox/agent"
}
```

**Note:** Children are defined in `agent.context.maia` via `@actors` system property. See [Children Architecture](#system-properties-in-context) below.

**Agent Service Actor Responsibilities:**
- Orchestrate data queries using universal `read()` API
- Handle mutations (`CREATE_BUTTON`, `TOGGLE_BUTTON`, `DELETE_BUTTON`)
- Manage application-level state
- Coordinate between UI actors via messages (inbox costream)
- Load composite actor as first child (defined in context)

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
  "brand": "@style/brand",
  "inbox": "@inbox/composite"
}
```

**Note:** Children are defined in `composite.context.maia` via `@actors` system property. See the context example below.

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
  "brand": "@style/brand",
  "inbox": "@inbox/list"
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

### System Properties in Context

Context files can contain **system properties** (like `$schema` and `$id`) that are used by the actor engine:

**`@actors` - Child Actor Definitions:**
- **System property** (like `$schema`, `$id`) - clearly indicates it's not user-defined context data
- Defines which child actors exist (used by actor engine to create children)
- Contains external references (`@actor/composite`, `@actor/list`, etc.)
- Format: `"@actors": { "namekey": "@actor/instance", ... }`

**Example:**
```json
{
  "$schema": "@schema/context",
  "$id": "@context/agent",
  "currentView": "@composite",  // ← Context property (CRDT CoValue) - references active child
  "@actors": {
    "composite": "@actor/composite"  // ← System property - defines children
  }
}
```

**Key Points:**
- `context["@actors"]` is a **system property** - defines which children exist
- `context.currentView` is a **context property** (CRDT CoValue) - references the active child actor
- Slot resolution: `"$slot": "$currentView"` → looks up `context.currentView` → extracts namekey → finds `actor.children[namekey]`
- **Unified pattern**: All actors use `currentView` for slot resolution (even if they only have one child)

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

**Note:** Context is always in a separate file. The `context` property references it via co-id (`@context/todo`), which gets transformed to an actual co-id (`co_z...`) during seeding. **Context is always persisted to a CoValue under the hood - accessed reactively via ReactiveStore. No in-memory mutation hacks!**

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
  "draggedItemIds": {}
}
```

### Context Best Practices

✅ **DO:**
- Keep context flat when possible
- Use clear, descriptive names
- Initialize all fields (avoid `undefined`)
- Store only serializable data (no functions)
- **Update context via state machines** - State machines are the single source of truth
- **Use `updateContext` infrastructure action** - Always update context through state machine actions
- **Always go through CoValue persistence** - Everything must be persisted, no in-memory hacks
- **Access via ReactiveStore** - Context is a ReactiveStore backed by persisted CoValue

❌ **DON'T:**
- Store UI elements or DOM references
- Put logic in context (use tools instead)
- Mix concerns (separate data from UI state)
- **Don't mutate context directly** - Always use state machines and tools
- **Don't update context from views** - Views send events, state machines update context
- **Don't bypass CoValue persistence** - Never mutate `actor.context.value` directly
- **Don't use in-memory mutation hacks** - Everything must go through persisted CoValues

## Actor Lifecycle

### Service Actors vs UI Actors

MaiaOS differentiates between **service actors** and **UI actors** for lifecycle management:

**Service Actors:**
- **Persist** throughout the vibe lifecycle
- Created once when vibe loads
- Destroyed only when vibe is unloaded
- Examples: Agent orchestrators, data services

**UI Actors:**
- **Created on-demand** when their view is active (referenced by `context.currentView`)
- **Destroyed** when switching to a different view
- Examples: List views, kanban views, form components

### Lifecycle Flow

**Service Actor Lifecycle:**
```
┌─────────────┐
│   Created   │  ← createActor() called (once per vibe)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Booting    │  ← State machine initialized
└──────┬──────┘      View rendered (minimal, only slots)
       │            Styles applied
       ▼
┌─────────────┐
│   Active    │  ← Processes events (persists)
└──────┬──────┘      Processes messages
       │            Re-renders on state changes
       │            (Lifecycle continues until vibe unloads)
       ▼
┌─────────────┐
│  Destroyed  │  ← destroyActor() called (only on vibe unload)
└─────────────┘
```

**UI Actor Lifecycle:**
```
┌─────────────┐
│   Created   │  ← createActor() called lazily (when referenced by context.currentView)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Booting    │  ← State machine initialized
└──────┬──────┘      View rendered (full UI)
       │            Styles applied
       ▼
┌─────────────┐
│   Active    │  ← Processes events
└──────┬──────┘      Processes messages
       │            Re-renders on state changes
       │            (Active while context.currentView references this actor)
       ▼
┌─────────────┐
│  Destroyed  │  ← destroyActor() called (when switching to different view)
└─────────────┘
```

### Lazy Child Actor Creation

Child actors are **created lazily** - only when they're referenced by `context.currentView`:

- **Before**: All child actors were created immediately (wasteful)
- **After**: Only the active child actor is created (efficient)

When switching views:
1. Previously active UI child actor is destroyed
2. New child actor is created lazily (if not already exists)
3. Service child actors persist (not destroyed)

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

## Message Passing & Event Flow

**CRITICAL:** Actor inbox is the **single source of truth** for ALL events (internal, external, SUCCESS, ERROR).

**Unified Event Flow:**
- ✅ View events → inbox → state machine
- ✅ External messages → inbox → state machine  
- ✅ Tool SUCCESS/ERROR → inbox → state machine
- ✅ All events appear in inbox log for traceability

**Event Flow Pattern:**
```
View Event → sendInternalEvent() → inbox → processMessages() → StateEngine.send()
External Message → inbox → processMessages() → StateEngine.send()
Tool SUCCESS → sendInternalEvent() → inbox → processMessages() → StateEngine.send()
Tool ERROR → sendInternalEvent() → inbox → processMessages() → StateEngine.send()
```

**Why inbox for all events:**
- **Unified Event Log:** Complete traceability of all events
- **Per-Message Processed Flags:** Each message has a `processed` boolean flag (distributed CRDT-native deduplication)
- **Consistent Handling:** All events follow same path
- **Better Debugging:** Can inspect inbox to see all events

### Sending Messages

**External messages** (actor-to-actor):

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

**Internal events** (from views) automatically route through inbox via `sendInternalEvent()`.

### Receiving Messages

Messages are sent to actors via their inbox costream. Actors automatically process messages from their inbox and route them to their state machine. No explicit subscription configuration is needed - messages are sent directly to the target actor's inbox.

### Processing Messages

Messages are processed via the actor's state machine. The inbox is automatically processed, and events are routed to state machines:

```json
{
  "idle": {
    "on": {
      "MESSAGE_RECEIVED": {
        "target": "processingMessage"
      },
      "SUCCESS": {
        "target": "idle"
      },
      "ERROR": {
        "target": "error"
      }
    }
  }
}
```

**Note:** All events (including SUCCESS/ERROR from tools) flow through inbox and are processed by `processMessages()`, which routes them to the state machine.

## Shadow DOM Isolation

Each actor with a view renders into its own **Shadow DOM**, providing:

✅ **Style isolation** - Actor styles don't leak  
✅ **Encapsulation** - Internal DOM is private  
✅ **Reusability** - Multiple instances don't conflict  
✅ **Automatic container queries** - `:host` automatically has `container-type: inline-size` enabled

```html
<div id="actor-todo">
  #shadow-root
    <style>
      :host {
        container-type: inline-size;
        container-name: actor-todo;
        /* ... other styles ... */
      }
    </style>
    <div>/* Actor UI */</div>
</div>
```

**Container Queries:** Every actor's `:host` element automatically becomes a container, enabling responsive components that adapt to their container size (not just viewport size). Use `@container` queries in your style files with breakpoint tokens like `{containers.xs}`, `{containers.sm}`, etc. See [Style Guide](./10-style.md#container-queries-responsive-design) for details.

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
  "brand": "@style/brand",
  "style": "@style/todo",
  "inbox": "@inbox/todo"
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
  "$schema": "@schema/actor",
  "$id": "@actor/todo-input",
  "role": "todo-input",
  "context": "@context/todo-input",
  "view": "@view/todo-input",
  "state": "@state/todo-input",
  "brand": "@style/brand",
  "inbox": "@inbox/todo-input"
}
```

**Leaf View: `todo_input.view.maia`**
```json
{
  "$schema": "@schema/view",
  "$id": "@view/todo-input",
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

**Example: `agent.actor.maia`**
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/agent",
  "role": "agent",
  "context": "@context/agent",
  "view": "@view/agent",
  "state": "@state/agent",
  "brand": "@style/brand",
  "inbox": "@inbox/agent"
}
```

**Note:** Children are defined in the context file, not in the actor definition. See the context example below.

**Composite View: `app.view.maia`**
```json
{
  "$schema": "@schema/view",
  "$id": "@view/app",
  "root": {
    "tag": "div",
    "attrs": {
      "class": "app-layout"
    },
    "children": [
      {
        "tag": "header",
        "$slot": "$header"  // Renders child actor from @actors.header
      },
      {
        "tag": "main",
        "$slot": "$input"   // Renders child actor from @actors.input
      },
      {
        "tag": "section",
        "$slot": "$currentView"    // Renders active child actor
      }
    ]
  }
}
```

### How Slots Work

**Slots** are placeholders where child actors get rendered.

**Syntax:**
- Use `$slot` with a context value (e.g., `"$slot": "$currentView"`)
- Context property contains `@namekey` reference (e.g., `currentView: "@list"`)
- ViewEngine extracts `namekey` from `@namekey` → finds child actor in `actor.children[namekey]`
- Attaches child actor's container to the slot element

**Unified Pattern:**
All slot resolution works the same way - no differentiation between "static" and "dynamic" slots. Everything is a CRDT CoValue.

**Example Context:**
```json
{
  "$schema": "@schema/context",
  "$id": "@context/composite",
  "currentView": "@list",  // ← Context property (CRDT CoValue) - references active child
  "@actors": {
    "list": "@actor/list",      // ← System property (like $schema/$id) - defines children
    "kanban": "@actor/kanban"
  }
}
```

**View with slots:**
```json
{
  "$schema": "@schema/view",
  "$id": "@view/composite",
  "content": {
    "tag": "div",
    "children": [
      {
        "tag": "main",
        "$slot": "$currentView"  // ← Resolves: context.currentView = "@list" → namekey "list" → actor.children["list"]
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
      "on": {
        "SWITCH_VIEW": {
          "target": "idle",
          "actions": [
            {
              "updateContext": {
                "currentView": "@list"  // ← Updates context property (CRDT CoValue)
              }
            }
          ]
        }
      }
    }
  }
}
```

**Key Points:**
- `context["@actors"]` is a **system property** (like `$schema`, `$id`) that defines which children exist
- `context.currentView` is a **context property** (CRDT CoValue) that references the active child actor
- Slot resolution is **unified** - same logic for all slots, whether they reference one child or switch between multiple

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
  "$schema": "@schema/actor",
  "$id": "@actor/app",
  "role": "composite",
  "context": "@context/app",
  "view": "@view/app",
  "state": "@state/app",
  "brand": "@style/brand",
  "inbox": "@inbox/app"
}
```

**`app.context.maia`** (defines children):
```json
{
  "$schema": "@schema/context",
  "$id": "@context/app",
  "@actors": {
    "header": "@actor/header",
    "input": "@actor/input",
    "list": "@actor/list",
    "footer": "@actor/footer"
  },
  "currentView": "@list"
}
```

**`app.view.maia`**
```json
{
  "$schema": "@schema/view",
  "$id": "@view/app",
  "root": {
    "tag": "div",
    "attrs": {
      "class": "app"
    },
    "children": [
      {
        "tag": "header",
        "$slot": "$header"
      },
      {
        "tag": "main",
        "$slot": "$input"
      },
      {
        "tag": "section",
        "$slot": "$currentView"
      },
      {
        "tag": "footer",
        "$slot": "$footer"
      }
    ]
  }
}
```

**`app.state.maia`** - Sets context values for slots:
```json
{
  "$schema": "@schema/state",
  "$id": "@state/app",
  "initial": "idle",
  "states": {
    "idle": {
      "entry": {
        "updateContext": {
          "currentView": "@list"
        }
      }
    }
  }
}
```

**Note:** The `@actors` system property in context defines which children exist. The `currentView` context property references which child to display.

### Message Passing Between Actors

Actors communicate via **messages** sent to inbox costreams, not props.

#### Sending Messages

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

#### Receiving Messages

Messages are automatically processed from the actor's inbox costream and routed to the state machine. Actors handle messages by defining event handlers in their state machines.

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
  "$schema": "@schema/view",
  "$id": "@view/layout",
  "root": {
    "tag": "div",
    "children": [
      {
        "tag": "header",
        "$slot": "$header"
      },
      {
        "tag": "main",
        "$slot": "$currentView"
      },
      {
        "tag": "footer",
        "$slot": "$footer"
      }
    ]
  }
}
```

#### List with Items
```json
{
  "$schema": "@schema/view",
  "$id": "@view/list",
  "root": {
    "tag": "ul",
    "$each": {
      "items": "$todos",
      "template": {
        "tag": "li",
        "text": "$$item.text"
      }
    }
  }
}
```

#### Conditional View Switching
```json
{
  "$schema": "@schema/view",
  "$id": "@view/composite",
  "root": {
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
  "$schema": "@schema/state",
  "$id": "@state/composite",
  "initial": "idle",
  "states": {
    "idle": {
      "on": {
        "SWITCH_VIEW": {
          "target": "idle",
          "actions": [
            {
              "updateContext": {
                "currentView": "$viewMode === 'list' ? '@list' : '@kanban'"  // ← Updates context property (CRDT CoValue)
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
- Send messages via inbox costreams for actor-to-actor communication
- Keep context internal (don't expose)
- Use state machine to set slot context values
- Define children in context files via `@actors` system property

**❌ DON'T:**
- Don't create giant monolithic actors
- Don't use prop drilling
- Don't expose context directly
- Don't create circular dependencies
- Don't put conditional logic in views (use state machine instead)
- Don't define children in actor schema (use context `@actors` instead)

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
actor.context           // Runtime data (ReactiveStore)
actor.context.value     // Current context value
actor.machine          // State machine instance
actor.machine.currentState  // Current state
actor.inbox            // Inbox costream (messages)

// Inspect Shadow DOM
// In DevTools: click the actor container, expand #shadow-root
```

---

# CONTEXT

*Source: creators/04-context.md*

# Context (The Memory)

Think of context as your actor's **memory** - like a notebook where it writes things down!

**CRITICAL:** Context is the **realtime reactive snapshot** of the current reflection of state. It's automatically updated when the state machine changes state.

**What's in the notebook?**
- What todos you have (`todos: [...]`)
- Whether a modal is open (`isModalOpen: false`)
- What text is in the input field (`newTodoText: "Buy milk"`)

**The Architecture:**
- **State Machine** → Defines the state (all logic and transitions)
- **Context** → Realtime reactive snapshot of current state reflection
- **View Template** → Dumb template that just renders context (zero logic)

Your actor looks at this notebook to know what to show and what to do!

## How It Works

```
1. You type "Buy milk" → Tool updates context: { newTodoText: "Buy milk" }
2. You click "Add" → Tool creates todo → Context updates: { todos: [...new todo] }
3. View looks at context → Sees new todo → Shows it on screen!
```

**The magic:** Your view automatically shows whatever is in context. Change the context, change what you see!

## Architectural Roles: Single Source of Truth

**CRITICAL PRINCIPLE:** MaiaOS follows a strict single source of truth architecture. Everything is persisted to CoValues under the hood, accessed reactively via the universal `read()` API.

### Clear Separation of Responsibilities

**State Machine** → Defines ALL state transitions
- ✅ **Single source of truth** for behavior
- ✅ Defines when and how state changes
- ✅ All transitions flow through state machine

**Context** → Contains ALL data and current state
- ✅ **Single source of truth** for data
- ✅ Always persisted to CoValue under the hood
- ✅ Accessed reactively via ReactiveStore (universal `read()` API)
- ✅ Never mutated directly - always through state machine

**View** → Dumb template that renders from context variables
- ✅ **Read-only** - only reads from context
- ✅ **Zero logic** - pure declarative structure, no conditionals
- ✅ Sends events to state machine (never updates context directly)
- ✅ Automatically re-renders when context changes (realtime reactive snapshot)

### Single Source of Truth: CoValue Under the Hood

**CRITICAL:** Everything is persisted to CoValues under the hood. No in-memory mutation hacks!

**How it works:**
```
State Machine Action
  ↓
updateContextCoValue() → Persists to Context CoValue (CRDT)
  ↓
Context ReactiveStore automatically updates
  ↓
View subscribes to ReactiveStore → Re-renders
```

**Key Points:**
- ✅ **Context is a CoValue** - Always persisted, never in-memory only
- ✅ **Accessed via ReactiveStore** - Universal `read()` API pattern
- ✅ **No mutation hacks** - Everything goes through persisted CoValues
- ✅ **Automatic reactivity** - ReactiveStore notifies subscribers when CoValue changes
- ✅ **Single source of truth** - CoValue is the authoritative data store

## State Machine as Single Source of Truth

**CRITICAL PRINCIPLE:** State machines are the **single source of truth** for all context changes.

**What this means:**
- ✅ All context updates MUST flow through state machines
- ✅ State machines use `updateContext` action (infrastructure, not a tool) to update context
- ✅ Views send events to state machines, never update context directly
- ✅ Context updates are infrastructure - pure CRDT persistence via ReactiveStore pattern

**Universal read() API Pattern (read-only reactive):**
- ✅ **Every CoValue is accessible as ReactiveStore** via universal `read()` API
- ✅ Query objects use `read()` internally - automatic reactivity
- ✅ Context itself is a ReactiveStore - automatic updates when data changes
- ✅ All updates are read-only derived data (reactive subscriptions via ReactiveStore)

**Why this matters:**
- **Predictable:** All context changes happen in one place (state machines)
- **Debuggable:** Easy to trace where context changes come from
- **Testable:** State machines define clear contracts for context updates
- **AI-friendly:** LLMs can understand and generate correct patterns

**Correct Pattern (Single Source of Truth):**
```
User clicks button
  ↓
View sends event to state machine (via inbox)
  ↓
State machine uses updateContext action (infrastructure)
  ↓
updateContextCoValue() persists to Context CoValue (CRDT) ← SINGLE SOURCE OF TRUTH
  ↓
Context ReactiveStore automatically updates (read-only derived data)
  ↓
View subscribes to ReactiveStore → sees update → re-renders
```

**No shortcuts, no hacks:**
- ❌ Never mutate context directly: `actor.context.field = value`
- ❌ Never bypass CoValue persistence
- ❌ Never use in-memory only data structures
- ✅ Always go through persisted CoValues
- ✅ Always access via ReactiveStore (universal `read()` API)

**Anti-Patterns (DON'T DO THIS):**
- ❌ Direct context mutation: `actor.context.field = value` (bypasses CoValue persistence)
- ❌ In-memory mutation hacks: `actor.context.value.todos.push(...)` (bypasses CoValue)
- ❌ Using `@context/update` tool (removed - context updates are infrastructure)
- ❌ Calling `ActorEngine.updateContextCoValue()` directly from views
- ❌ Setting error context directly in ToolEngine (should use ERROR events)
- ❌ Mutating context outside of state machines
- ❌ Bypassing CoValue persistence - everything must go through persisted CoValues

**Error Handling:**
When tools fail, state machines receive ERROR events (via inbox) and can update context accordingly:
```json
{
  "creating": {
    "entry": {
      "tool": "@db",
      "payload": { "op": "create", ... }
    },
    "on": {
      "ERROR": {
        "target": "error",
        "actions": [
          {
            "updateContext": { "error": "$$error" }
          }
        ]
      }
    }
  }
}
```

**Note:** `updateContext` is infrastructure (not a tool). It directly calls `updateContextCoValue()` to persist changes to the context CoValue (CRDT).

## Context Definition

Context can be defined inline in the actor file or in a separate `.context.maia` file.

### Option 1: Inline Context

```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/todo",
  "state": "@state/todo",
  
  "context": {
    "todos": [],
    "newTodoText": "",
    "viewMode": "list"
  }
}
```

**Note:** Inline context is rarely used. It's recommended to use separate context files.

### Option 2: Separate Context File (Recommended)

**`todo.context.maia`:**
```json
{
  "$schema": "@schema/context",
  "$id": "@context/todo",
  
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
  "$schema": "@schema/actor",
  "$id": "@actor/todo",
  "context": "@context/todo",  // ← References todo.context.maia (co-id reference)
  "state": "@state/todo"
}
```

**Benefits of Separate Files:**
- ✅ Cleaner actor definitions
- ✅ Easier to maintain large contexts
- ✅ Better separation of concerns
- ✅ Context can be shared or versioned independently

## Universal read() API Pattern: Single Source of Truth

**CRITICAL:** Every CoValue in MaiaOS is accessible as a ReactiveStore via the universal `read()` API. This is the foundational pattern for all data access. **Everything is persisted to CoValues under the hood - no in-memory mutation hacks!**

**How it works:**
```javascript
// Read any CoValue as ReactiveStore
const store = await dbEngine.execute({
  op: 'read',
  schema: 'co_zTodos123',  // Schema co-id (co_z...)
  key: 'co_zItem456'       // Item co-id (optional - omit for collections)
});

// Access current value (read-only!)
console.log('Current data:', store.value);

// Subscribe to updates (automatic when CoValue changes)
const unsubscribe = store.subscribe((data) => {
  console.log('Data updated:', data);
});
```

**Key Points:**
- ✅ **Every CoValue → ReactiveStore** - Single, unified pattern
- ✅ **CoValue is single source of truth** - Always persisted, never in-memory only
- ✅ **ReactiveStore is access layer** - Read-only reactive interface to CoValue
- ✅ **Automatic reactivity** - Subscribe once, get updates forever when CoValue changes
- ✅ **Progressive loading** - Store has initial value, updates as data loads
- ✅ **Context is a ReactiveStore** - `actor.context` is itself a ReactiveStore backed by Context CoValue
- ✅ **Query objects use read() internally** - They're just a convenient way to declare queries
- ✅ **No mutation hacks** - Everything goes through persisted CoValues

**This pattern applies to:**
- Context (actor runtime data) - Persisted to Context CoValue
- Database collections (todos, notes, etc.) - Persisted to Collection CoValues
- Individual items (single todo, single note) - Persisted to Item CoValues
- Configs (actor definitions, views, states) - Persisted to Config CoValues
- Schemas (schema definitions) - Persisted to Schema CoValues
- Everything! Every CoValue is accessible this way.

**Single Source of Truth Flow:**
```
CoValue (persisted, CRDT) ← SINGLE SOURCE OF TRUTH
  ↓
Universal read() API
  ↓
ReactiveStore (reactive access layer)
  ↓
Context/View (read-only, subscribes to ReactiveStore)
```

See [Operations](./07-operations.md) for complete documentation on the universal `read()` API.

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

**How it works internally:**
1. You declare the query object in context
2. MaiaOS uses universal `read()` API to get a ReactiveStore for that data
3. The ReactiveStore automatically updates when data changes
4. Context ReactiveStore subscribes to the data ReactiveStore
5. Your view subscribes to context ReactiveStore and re-renders automatically

**Think of it like:** Subscribing to a newsletter - you tell them what you want, they send you updates automatically. The universal `read()` API is like the subscription service - every CoValue becomes a reactive store you can subscribe to.

**Behind the scenes:** Query objects are just a convenient way to declare queries. They use the universal `read()` API internally, which:
1. Reads from persisted CoValue (single source of truth)
2. Returns a ReactiveStore (reactive access layer)
3. Automatically keeps your context updated when CoValue changes
4. **No in-memory mutation hacks** - everything goes through persisted CoValues

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
- Use generic reusable names that fit your view template slots (e.g., `list` for list views, `messages` for message logs)

See [Reactive Data System](../developers/06_reactive-queries.md) for detailed examples.

#### Map Transformations in Query Objects ⭐ PRIMARY PATTERN

**CRITICAL:** Map transformations are defined **directly in context query objects** using the `options.map` syntax. This is the **PRIMARY and RECOMMENDED** pattern for data transformations.

**Map transformations** let you reshape data when reading it. Think of it like a translator - you take data in one format and transform it into the format your views need.

**Format (in context file):**
```json
{
  "messages": {
    "schema": "@schema/message",
    "options": {
      "map": {
        "fromRole": "$$source.role",
        "toRole": "$$target.role",
        "fromId": "$$source.id",
        "toId": "$$target.id"
      }
    }
  }
}
```

**What this means:** "Give me all messages, but transform each item so that `source.role` becomes `fromRole`, `target.role` becomes `toRole`, etc."

**Key Rules:**
- ✅ **Strict `$$` syntax required** - All map expressions MUST use `$$` prefix (e.g., `$$source.role`, not `source.role`)
- ✅ **Generic placeholder names** - Use reusable names that fit your view template slots (e.g., `fromRole`, `toRole`, `fromId`, `toId` for log entries)
- ✅ **Works with any property path** - You can map nested properties like `$$nested.deep.property`

**Example: Log View with Generic Placeholders**

**Context:**
```json
{
  "messages": {
    "schema": "@schema/message",
    "options": {
      "map": {
        "fromRole": "$$source.role",
        "toRole": "$$target.role",
        "fromId": "$$source.id",
        "toId": "$$target.id"
      }
    }
  },
  "payloadLabel": "payload"
}
```

**View:**
```json
{
  "$each": {
    "items": "$messages",
    "template": {
      "tag": "div",
      "children": [
        {
          "tag": "span",
          "text": "$$fromRole"
        },
        {
          "tag": "span",
          "text": "$$toRole"
        },
        {
          "tag": "summary",
          "text": "$payloadLabel"
        }
      ]
    }
  }
}
```

**Why this pattern?**
- ✅ **Generic reusable names** - `fromRole`/`toRole` work for any log entry, not just messages
- ✅ **No hardcoded strings** - `payloadLabel` is extracted to context variable
- ✅ **Consistent template slots** - View template variables match context keys
- ✅ **Strict syntax** - `$$` prefix ensures consistency with MaiaScript expressions

**Common Patterns:**

**1. Flattening nested structures:**
```json
{
  "list": {
    "schema": "@schema/todos",
    "options": {
      "map": {
        "authorName": "$$author.name",
        "authorEmail": "$$author.email"
      }
    }
  }
}
```

**2. Renaming for generic template slots:**
```json
{
  "list": {
    "schema": "@schema/todos",
    "options": {
      "map": {
        "itemText": "$$text",
        "itemId": "$$id",
        "isComplete": "$$done"
      }
    }
  }
}
```

**3. Combining with filters:**
```json
{
  "messages": {
    "schema": "@schema/message",
    "options": {
      "filter": { "type": "notification" },
      "map": {
        "fromRole": "$$source.role",
        "toRole": "$$target.role"
      }
    }
  }
}
```

**Best Practices:**
- ✅ Use generic placeholder names (`fromRole`, `toRole`, `list`, `messages`) that fit your view template slots
- ✅ Extract hardcoded strings to context variables (`payloadLabel`, `toggleButtonText`, etc.)
- ✅ Always use strict `$$` syntax in map expressions
- ✅ Keep mapped property names consistent across your app
- ✅ Use descriptive names that indicate the perspective (e.g., `fromRole`/`toRole` for log entries)

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
Context is a ReactiveStore - access current value and subscribe to changes:

```javascript
// Read current context value (read-only!)
console.log(actor.context.value.todos);
console.log(actor.context.value.viewMode);

// Subscribe to context changes
const unsubscribe = actor.context.subscribe((context) => {
  console.log('Context updated:', context);
});

// Mutate context (via state machines only - goes through CoValue persistence!)
// ❌ Don't do this (bypasses CoValue persistence):
// actor.context.value.todos.push({...});
// actor.context.value.newTodoText = "New text";

// ✅ Do this instead (goes through persisted CoValue):
actor.actorEngine.stateEngine.send(
  actor.machine.id,
  'CREATE_TODO',
  {text: 'New todo'}
);
```

**Key Pattern:** 
- Context is a ReactiveStore backed by a persisted CoValue
- Use `.value` to read current data (read-only!)
- Use `.subscribe()` to watch for changes
- **Never mutate `.value` directly** - always go through state machine → CoValue persistence
- This is the universal pattern - every CoValue is accessible as a ReactiveStore via `read()` API
- **Single source of truth** - CoValue is the authoritative data store, ReactiveStore is the reactive access layer

## Context Updates

### Universal read() API Pattern

**CRITICAL:** Every CoValue is accessible as a ReactiveStore via the universal `read()` API:

```javascript
// Read any CoValue as ReactiveStore
const store = await dbEngine.execute({
  op: 'read',
  schema: 'co_zTodos123',  // Schema co-id
  key: 'co_zItem456'       // Item co-id (optional)
});

// Access current value
console.log('Current data:', store.value);

// Subscribe to updates
const unsubscribe = store.subscribe((data) => {
  console.log('Data updated:', data);
});
```

**This is the foundational pattern** - all data access uses this unified API. Context itself is a ReactiveStore, query objects use `read()` internally, and all CoValues are accessible this way.

### Via updateContext (Infrastructure Action)
Generic context field update (infrastructure, not a tool):

```json
{
  "updateContext": {
    "newTodoText": "$$newTodoText",
    "viewMode": "kanban"
  }
}
```

**Note:** `updateContext` is infrastructure that directly calls `updateContextCoValue()` to persist changes to the context CoValue (CRDT). It's not a tool - it's pure infrastructure.

**How it works:**
1. State machine action evaluates payload (resolves `$` and `$$` references)
2. Calls `actor.actorEngine.updateContextCoValue(actor, updates)` directly
3. Persists changes to context CoValue (CRDT)
4. Context ReactiveStore automatically updates (read-only derived data)
5. Views subscribe to context ReactiveStore and re-render automatically

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
- **Always go through CoValue persistence** - Everything must be persisted, no in-memory hacks
- **Access via ReactiveStore** - Use universal `read()` API pattern
- **Use generic reusable context keys** - Names like `list`, `messages` that fit view template slots
- **Extract hardcoded strings** - Put all UI text in context variables (e.g., `toggleButtonText`, `payloadLabel`)
- **Use strict `$$` syntax** - All map expressions must use `$$` prefix for item properties

### ❌ DON'T:

- **Don't mutate directly** - Always use `updateContext` action in state machines
- **Don't bypass CoValue persistence** - Never mutate `actor.context.value` directly
- **Don't use in-memory mutation hacks** - Everything must go through persisted CoValues
- **Don't use `@context/update` tool** - Removed, use `updateContext` infrastructure action instead
- **Don't store UI elements** - No DOM references
- **Don't store functions** - Only JSON-serializable data
- **Don't mix concerns** - Separate data from UI state
- **Don't use reserved keys** - Avoid `$schema`, `$id`, `@actors`, `inbox`, etc.
- **Don't compute in views** - All computation happens in state machine
- **Don't hardcode strings in views** - Extract all UI text to context variables
- **Don't use specific names** - Avoid `todos`, `allMessages` - use generic `list`, `messages` instead
- **Don't skip `$$` prefix** - Map expressions must use strict `$$` syntax (e.g., `$$source.role`, not `source.role`)

## Extracting Hardcoded Strings to Context Variables

**CRITICAL:** Never hardcode strings in views. Always extract them to context variables!

**Why?**
- ✅ **Reusable** - Same view can work with different text
- ✅ **Maintainable** - Change text in one place (context)
- ✅ **Consistent** - Same variable names across your app
- ✅ **AI-friendly** - LLMs can understand and generate correct patterns

**Example: List View**

**Context:**
```json
{
  "list": {
    "schema": "@schema/todos"
  },
  "toggleButtonText": "✓",
  "deleteButtonText": "✕"
}
```

**View:**
```json
{
  "$each": {
    "items": "$list",
    "template": {
      "children": [
        {
          "tag": "button",
          "text": "$toggleButtonText"
        },
        {
          "tag": "button",
          "text": "$deleteButtonText"
        }
      ]
    }
  }
}
```

**Example: Agent View with Labels**

**Context:**
```json
{
  "listViewLabel": "List",
  "logsViewLabel": "Logs",
  "inputPlaceholder": "Add a new todo...",
  "addButtonText": "Add"
}
```

**View:**
```json
{
  "children": [
    {
      "tag": "button",
      "text": "$listViewLabel"
    },
    {
      "tag": "button",
      "text": "$logsViewLabel"
    },
    {
      "tag": "input",
      "attrs": {
        "placeholder": "$inputPlaceholder"
      }
    },
    {
      "tag": "button",
      "text": "$addButtonText"
    }
  ]
}
```

**Pattern:**
- ✅ Extract all UI text to context variables
- ✅ Use descriptive names (`toggleButtonText`, not `btn1`)
- ✅ Keep variable names consistent across views
- ✅ Use generic names that can be reused (`listViewLabel`, not `todoListViewLabel`)

## Context Schema Design

### Example: Todo Application

```json
{
  "context": {
    // Reactive data (query objects) - use generic names
    "list": {
      "schema": "@schema/todos",
      "filter": null
    },
    
    // Derived/filtered reactive data
    "listTodo": {
      "schema": "@schema/todos",
      "filter": { "done": false }
    },
    "listDone": {
      "schema": "@schema/todos",
      "filter": { "done": true }
    },
    
    // UI text (extracted from views)
    "toggleButtonText": "✓",
    "deleteButtonText": "✕",
    "addButtonText": "Add",
    "inputPlaceholder": "Add a new todo...",
    
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
Database ReactiveStore notifies subscribers: "Data changed!"
  ↓
Context ReactiveStore (from query object) receives update
  ↓
Context ReactiveStore updates context.todos = [new data]
  ↓
ViewEngine re-renders (batched via ReactiveStore subscriptions)
  ↓
User sees new todo in the list! ✨
```

**Key insight:** You never manually update `context.todos`. The universal `read()` API:
1. Reads from persisted CoValue (single source of truth)
2. Returns a ReactiveStore that automatically updates when the CoValue changes
3. Context ReactiveStore subscribes to the data ReactiveStore
4. View subscribes to context ReactiveStore and re-renders

**Everything is persisted to CoValues under the hood - no in-memory mutation hacks!** Every CoValue is accessible as a reactive store via `read()` API.

### 2. UI State - Manual (via Tools)

When you update **UI state** (like form inputs, view modes, etc.), you explicitly update context via tools:

```
State machine uses updateContext action (infrastructure)
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
        "updateContext": {
  "payload": {
    "newTodoText": "",
    "viewMode": "kanban"
  }
}
```

### Summary

- **Query objects** → Automatic reactivity via universal `read()` API (ReactiveStore watches for changes)
- **UI state** → Manual updates (you explicitly update via `updateContext` infrastructure action)
- **Both trigger re-renders** → Your view stays in sync
- **Universal Pattern** → Every CoValue is accessible as ReactiveStore via `read()` API

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
        "updateContext": {
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

// Inspect context (ReactiveStore)
console.log('Current context:', actor.context.value);

// Subscribe to context changes
const unsubscribe = actor.context.subscribe((context) => {
  console.log('Context changed:', context);
});

// Serialize context
console.log(JSON.stringify(actor.context.value, null, 2));
```

## Context Persistence

Context can be serialized and persisted:

```javascript
// Save to localStorage
localStorage.setItem(
  `actor_${actor.id}`,
  JSON.stringify(actor.context.value)
);

// Restore from localStorage
const saved = localStorage.getItem(`actor_${actor.id}`);
if (saved) {
  // Update context via state machine, not direct mutation
  actor.actorEngine.stateEngine.send(
    actor.machine.id,
    'RESTORE_CONTEXT',
    JSON.parse(saved)
  );
}

// Export/import
function exportContext(actor) {
  return JSON.stringify(actor.context.value);
}

function importContext(actor, jsonString) {
  // Update context via state machine, not direct mutation
  actor.actorEngine.stateEngine.send(
    actor.machine.id,
    'RESTORE_CONTEXT',
    JSON.parse(jsonString)
  );
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
validateContext(actor.context.value, {
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

**CRITICAL ARCHITECTURE:**
- **State Machines define the state** - All logic, computation, and state transitions
- **Context is the realtime reactive snapshot** - Current reflection of state, automatically updated
- **Templates are "dumb"** - Pure declarative structure, zero logic, just render context

## State Machine Responsibility: Single Source of Truth

**CRITICAL:** State machines are the **single source of truth** for all context changes.

**Your state machine is responsible for:**
- ✅ All context updates (via `updateContext` infrastructure action)
- ✅ All data mutations (via `@db` tool)
- ✅ All error handling (via ERROR event handlers)
- ✅ All UI state changes (view mode, button states, form values)

**State machines update context by:**
1. Receiving events from inbox (unified event flow)
2. Using `updateContext` action (infrastructure, not a tool) to update context
3. Handling tool success/failure via SUCCESS/ERROR events (routed through inbox)

## Separation of Concerns: Context vs State Machine

**CRITICAL PRINCIPLE:** Clean separation between **data storage** (context) and **logic/computation** (state machine).

### Context = Pure Data Storage

**Context files (`*.context.maia`) should contain:**
- ✅ Simple values (strings, numbers, booleans)
- ✅ Simple references (`@actor/list`, `@view/kanban`)
- ✅ Default/initial values
- ❌ **NO complex MaiaScript expressions** (`$if`, `$eq`, nested logic)
- ❌ **NO computation or conditional logic**

**Example - Good Context:**
```json
{
  "$schema": "@schema/context",
  "$id": "@context/composite",
  "viewMode": "list",
  "currentView": "@list",
  "listButtonActive": true,
  "kanbanButtonActive": false,
  "newTodoText": ""
}
```

### State Machine = All Logic & Computation

**State machines (`*.state.maia`) handle:**
- ✅ All conditional logic (`$if`, `$eq`, `$and`, `$or`)
- ✅ All value computation
- ✅ All expressions that determine what values to set
- ✅ Complex nested logic

**When updating context, structure actions for clarity:**

**❌ Bad - Complex expressions in one action:**
```json
{
  "updateContext": {
    "viewMode": "$$viewMode",
    "currentView": {
      "$if": {
        "condition": { "$eq": ["$$viewMode", "list"] },
        "then": "@list",
        "else": { /* nested $if */ }
      }
    },
    "listButtonActive": { "$eq": ["$$viewMode", "list"] },
    "kanbanButtonActive": { "$eq": ["$$viewMode", "kanban"] }
  }
}
```

**✅ Good - Separate actions, one expression per update:**
```json
{
  "actions": [
    {
      "updateContext": { "viewMode": "$$viewMode" }
    },
    {
      "updateContext": {
        "currentView": {
          "$if": {
            "condition": { "$eq": ["$$viewMode", "list"] },
            "then": "@list",
            "else": { /* nested $if */ }
          }
        }
      }
    },
    {
      "updateContext": {
        "listButtonActive": { "$eq": ["$$viewMode", "list"] }
      }
    },
    {
      "updateContext": {
        "kanbanButtonActive": { "$eq": ["$$viewMode", "kanban"] }
      }
    }
  ]
}
```

**Why this matters:**
- **Clear separation:** Context = data, State = logic
- **Easier debugging:** Each action computes one value
- **Better readability:** One expression per action is easier to understand
- **Maintainable:** Changes to logic don't affect context structure
- **Testable:** Can test state machine logic independently

**Remember:** Expressions ARE evaluated in the state machine (that's fine!), but structure them clearly with separate actions for each computed value.

## Inbox as Single Source of Truth for Events

**CRITICAL PRINCIPLE:** Actor inbox is the **single source of truth** for ALL events (internal, external, SUCCESS, ERROR).

**What this means:**
- ✅ All events MUST flow through actor inbox
- ✅ View events → inbox → state machine
- ✅ External messages → inbox → state machine
- ✅ Tool SUCCESS/ERROR → inbox → state machine
- ✅ StateEngine.send() only called from processMessages()

**Event Flow Pattern:**
```
User clicks button
  ↓
View sends event → sendInternalEvent()
  ↓
Event added to inbox
  ↓
processMessages() processes inbox
  ↓
StateEngine.send() receives event
  ↓
State machine transitions
  ↓
Tool executes (SUCCESS/ERROR)
  ↓
SUCCESS/ERROR routed through inbox
  ↓
processMessages() processes SUCCESS/ERROR
  ↓
State machine handles SUCCESS/ERROR
```

**Why this matters:**
- **Unified Event Log:** All events appear in inbox for complete traceability
- **Consistent Pattern:** Single source of truth for all events
- **Better Debugging:** Can trace all events through inbox log
- **Per-Message Processed Flags:** Each message has a `processed` boolean flag (distributed CRDT-native deduplication)
- **AI-Friendly:** LLMs can understand complete event flow

**Anti-Patterns:**
- ❌ Calling StateEngine.send() directly (bypasses inbox)
- ❌ Sending SUCCESS/ERROR directly to state machine
- ❌ Bypassing inbox for any events

**Example:**
```json
{
  "idle": {
    "on": {
      "UPDATE_INPUT": {
        "target": "idle",
        "actions": [
          {
            "updateContext": { "newTodoText": "$$newTodoText" }
          }
        ]
      }
    }
  }
}
```

**Note:** `updateContext` is infrastructure (not a tool). It directly calls `updateContextCoValue()` to persist changes to the context CoValue (CRDT).

**Batching:** All `updateContext` actions in a single transition are batched together and written to the context CoValue once at the end. This ensures efficient CRDT updates.

**Why this matters:**
- **Predictable:** All context changes happen in state machines
- **Debuggable:** Easy to trace context changes
- **Testable:** State machines define clear contracts
- **AI-friendly:** LLMs understand this pattern
- **Efficient:** Batched updates reduce CRDT write operations

**Remember:** Views send events, state machines update context, tools execute operations. Never update context directly from views or tools!

## Deterministic State Machines: Sequential Processing

**CRITICAL PRINCIPLE:** State machines are **deterministic** - only ONE state at a time, transitions happen sequentially.

**What this means:**
- ✅ Events are processed **one at a time** (sequential, not parallel)
- ✅ State machine always has a **single current state**
- ✅ Transitions happen **sequentially** - one completes before the next starts
- ✅ **No parallel states** - impossible to be in multiple states simultaneously

**How it works:**
- Generic sequential processing handled in engines (ActorEngine, StateEngine)
- Processing guard prevents concurrent execution
- Events queue in inbox and process sequentially
- **You don't need to handle this in your state configs** - engines handle it generically

**Unhandled Events:**
- Events not handled by current state are **processed and removed** (marked `processed: true`)
- They are **not rejected** - just removed from queue
- This ensures clean inbox management without errors

**Example - Simplified Kanban Flow:**
```json
{
  "idle": {
    "on": {
      "DRAG_START": { "target": "dragging" }
    }
  },
  "dragging": {
    "on": {
      "DRAG_ENTER": { "target": "dragOver" },
      "DRAG_END": { "target": "idle" },
      "DROP": { "target": "dropping" }
    }
  },
  "dragOver": {
    "on": {
      "DRAG_LEAVE": { "target": "dragging" },
      "DROP": { "target": "dropping" }
    }
  },
  "dropping": {
    "entry": { "tool": "@dragdrop/drop" },
    "exit": {
      "updateContext": {
        "draggedItemId": null,
        "dragOverColumn": null
      }
    },
    "on": {
      "SUCCESS": { "target": "idle" }
    }
  }
}
```

**Key Points:**
- Linear flow: idle → dragging → dragOver → dropping → idle
- No self-transitions (no "what if already in dragging" logic)
- Cleanup in exit actions (not separate cleanup states)
- Sequential processing handled generically - you just define the flow

**Anti-Patterns:**
- ❌ Handling events "while already in this state" (engines handle sequential processing)
- ❌ Creating cleanup states (use exit actions instead)
- ❌ Self-transitions for parallel state handling (not needed with sequential processing)

## Basic Structure

Create a file named `{name}.state.maia`:

```json
{
  "$schema": "@schema/state",
  "$id": "@state/todo",
  
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
          "schema": "co_z...",
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

**Note:** 
- `$schema` and `$id` use schema references (`@schema/state`, `@state/todo`) that are transformed to co-ids during seeding
- The `schema` field in tool payloads must be a co-id (`co_z...`) - schema references (`@schema/todos`) are transformed to co-ids during seeding
- In your source files, you can use schema references, but at runtime they become co-ids

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

Entry and exit actions can be:
- **Single action object** - One tool or updateContext action
- **Array of actions** - Multiple actions executed in order
- **Co-id reference** - Reference to an action CoValue

**Single action:**
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

**Multiple actions (array):**
```json
{
  "creating": {
    "entry": [
      {"tool": "@core/showLoading", "payload": {}},
      {"tool": "@db", "payload": { "op": "create", ... }},
      {"updateContext": { "newTodoText": "" }}
    ]
  }
}
```

**Important:** All `updateContext` actions in a single transition are batched together and written to the context CoValue once at the end. This ensures efficient CRDT updates.

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
      "actions": [{"updateContext": {...}}]
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
      "updateContext": {
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

## Working with Data (Reactive Queries)

**CRITICAL:** Reactive data queries are defined **directly in context files**, not in state machines. State machines handle **mutations** (create, update, delete), while **queries** are declared in context.

### The Correct Pattern: Query Objects in Context

**✅ DO:** Define query objects directly in your context file (`.context.maia`):

```json
{
  "$schema": "@schema/context",
  "$id": "@context/todo",
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

**What happens:**
1. Query objects are declared in context (`.context.maia` file)
2. MaiaOS automatically creates reactive query stores from these declarations
3. Stores are stored in `actor._queryStores[contextKey]`
4. Stores are marked in `context.@stores` for ViewEngine discovery
5. ViewEngine subscribes to stores and re-renders when data changes

**Accessing data in views:**
```json
{
  "$each": {
    "items": "$todos",
    "template": {
      "tag": "div",
      "text": "$$text"
    }
  }
}
```

**Important:**
- Query objects are defined in **context files**, not state machines
- State machines handle **mutations only** (create, update, delete via `@db` tool)
- Schema can be a schema reference (`@schema/todos`) or co-id (`co_z...`) - references are resolved automatically
- Query stores are ReactiveStore objects (can't be stored in CoValues)
- Stores are stored in `actor._queryStores` and marked in `context.@stores`

**See [Context - Reactive Data](./04-context.md#1-reactive-data-query-objects-) for complete documentation on query objects.**

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

#### Toggle (Using Update with Expression)

Toggle is not a separate operation. Use `update` with an expression:

```json
{
  "tool": "@db",
  "payload": {
    "op": "update",
    "id": "$$id",
    "data": {
      "done": { "$not": "$existing.done" }
    }
  }
}
```

**Note:** For `update` and `delete` operations, `schema` is not required - it's extracted from the CoValue's headerMeta automatically.

### Complete Example: Todo List

**Context (`todo.context.maia`):**
```json
{
  "$schema": "@schema/context",
  "$id": "@context/todo",
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

**State Machine (`todo.state.maia`):**
```json
{
  "$schema": "@schema/state",
  "$id": "@state/todo",
  "initial": "idle",
  "states": {
    "idle": {
      "on": {
        "UPDATE_INPUT": {
          "target": "idle",
          "actions": [{
            "updateContext": { "newTodoText": "$$value" }
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
          "updateContext": { "newTodoText": "" }
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

**What happens:**
1. Query objects (`todos`, `todosTodo`, `todosDone`) are declared in context file
2. MaiaOS automatically creates reactive query stores from these declarations
3. Stores are stored in `actor._queryStores` and marked in `context.@stores`
4. ViewEngine subscribes to stores and re-renders when data changes
5. When creating a todo via `@db` tool, all query stores automatically update

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
- Define query objects **in context files** (`.context.maia`), not state machines
- Use `@db` tool in state machines for all data mutations (create, update, delete)
- Use descriptive names (`todosTodo`, not `data1`)
- Filter in query objects (context), not in views
- Test with empty data (handle empty arrays gracefully)
- Use schema references (`@schema/todos`) in context - they're resolved automatically

**❌ DON'T:**
- Don't define queries in state machines (use context files instead)
- Don't manually modify query stores directly
- Don't use state machines for queries (only for mutations)
- Don't filter data in views (use query object filters in context instead)
- Don't forget to handle SUCCESS/ERROR events for mutations
- Don't use `mapData` action in state machines (deprecated pattern)

### Troubleshooting

**Data Not Appearing:**
1. Are query objects defined in your context file (`.context.maia`)?
2. Check browser console for errors
3. Is the schema reference correct? (`@schema/todos` or `co_z...`)

**Data Not Updating:**
1. Are you using `@db` tool in state machines to modify data?
2. Are query stores properly subscribed? (check `context.@stores`)
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
            "updateContext": {"newTodoText": "$$newTodoText"}
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
            "updateContext": {
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
          "op": "update",
          "id": "$$id",
          "data": {
            "done": { "$not": "$existing.done" }
          }
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
- Tool succeeds → StateEngine auto-sends `SUCCESS` event with tool result in payload
- Tool fails → StateEngine auto-sends `ERROR` event

Handle these in your state definition:

```json
{
  "creating": {
    "entry": {"tool": "@db", "payload": { "op": "create", ... }},
    "on": {
      "SUCCESS": {
        "target": "idle",
        "actions": [
          {
            "tool": "@core/publishMessage",
            "payload": {
              "type": "TODO_CREATED",
              "payload": {
                "id": "$$result.id",      // ← Access tool result via $$result
                "text": "$$result.text"   // ← Tool result is available in SUCCESS handler
              }
            }
          }
        ]
      },
      "ERROR": "error"
    }
  }
}
```

**Accessing Tool Results:**
- Tool results are available in SUCCESS event payload as `$$result`
- Use `$$result.propertyName` to access specific result properties
- Example: `$$result.id`, `$$result.text`, `$$result.draggedItemId`

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
- **Update context via infrastructure** - Always use `updateContext` action, never mutate directly
- **Handle errors in state machines** - Use ERROR event handlers to update error context

### ❌ DON'T:

- Put logic in state machines (use tools)
- Create deeply nested states (keep flat)
- Forget error handling
- Use `$` for event payload fields
- Create cycles without exit conditions
- **Don't put conditionals in views** - Compute flags in state machine instead
- **Don't mutate context directly** - Always use `updateContext` infrastructure action
- **Don't update context from views** - Views send events, state machines update context
- **Don't update context from tools** - Tools are invoked by state machines, not the other way around

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
    
    // Execute operation (e.g., database operation)
    const result = await someOperation(data);
    
    // Return result - state machines handle context updates via updateContext actions
    // Tools should NOT directly manipulate context - all updates flow through state machines
    return result;
  }
};
```

**CRITICAL:** Tools should return results, not manipulate context directly. State machines handle all context updates via `updateContext` actions in SUCCESS handlers.

## Available Tools

### Database Module (`@db`)

The `@db` tool is a unified database operation tool that handles all CRUD operations through an `op` parameter.

#### Create Operation
```json
{
  "tool": "@db",
  "payload": {
    "op": "create",
    "schema": "co_z...",
    "data": {"text": "Buy milk", "done": false}
  }
}
```

**Note:** The `schema` field must be a co-id (`co_z...`). Schema references (`@schema/todos`) are transformed to co-ids during seeding. In your source state machine files, you can use schema references, but they get transformed to co-ids before execution.

**Tool Results:**
The `@db` tool returns the created/updated/deleted record. Access the result in SUCCESS handlers via `$$result`:

```json
{
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
              "payload": {
                "id": "$$result.id",      // ← Tool result available here
                "text": "$$result.text"
              }
            }
          }
        ]
      }
    }
  }
}
```

#### Update Operation
```json
{
  "tool": "@db",
  "payload": {
    "op": "update",
    "id": "co_z...",
    "data": {"text": "Buy milk and eggs"}
  }
}
```

**Note:** For `update` and `delete` operations, `schema` is not required. The schema is automatically extracted from the CoValue's headerMeta internally by the operation.

#### Delete Operation
```json
{
  "tool": "@db",
  "payload": {
    "op": "delete",
    "id": "co_z..."
  }
}
```

**Note:** For `update` and `delete` operations, `schema` is not required. The schema is automatically extracted from the CoValue's headerMeta internally by the operation.

#### Toggle (Using Update with Expression)

Toggle is not a separate operation. Use `update` with an expression:

```json
{
  "tool": "@db",
  "payload": {
    "op": "update",
    "id": "co_z...",
    "data": {
      "done": { "$not": "$existing.done" }
    }
  }
}
```

**Note:** For `update` and `delete` operations, `schema` is not required - it's extracted from the CoValue's headerMeta automatically.

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


### Drag-Drop Module (`@dragdrop/*`)

#### `@dragdrop/start`
```json
{
  "tool": "@dragdrop/start",
  "payload": {
    "id": "co_z..."
  }
}
```

**Note:** Schema is not required. The schema is automatically extracted from the CoValue's headerMeta internally by update/delete operations when needed.

**Tool Result:** Returns drag state object. Update context in SUCCESS handler:

```json
{
  "dragging": {
    "entry": {
      "tool": "@dragdrop/start",
      "payload": { "id": "$$id" }
    },
    "on": {
      "SUCCESS": {
        "target": "dragging",
        "actions": [
          {
            "updateContext": {
              "draggedItemId": "$$result.draggedItemId",
              "draggedItemIds": "$$result.draggedItemIds"
            }
          }
        ]
      }
    }
  }
}
```

#### `@dragdrop/drop`
```json
{
  "tool": "@dragdrop/drop",
  "payload": {
    "field": "done",
    "value": true
  }
}
```

**Note:** Schema is not required. The schema is automatically extracted from the CoValue's headerMeta internally by the update operation.

**Tool Result:** Returns update result. Access via `$$result` in SUCCESS handler.

### Context Updates (Infrastructure, Not Tools)

**Note:** Context updates are infrastructure (not tools). Use `updateContext` action in state machines:

```json
{
  "updateContext": {
    "newTodoText": "Updated value",
    "someField": "new value"
  }
}
```

**How it works:**
- `updateContext` is infrastructure that directly calls `updateContextCoValue()` 
- Persists changes to context CoValue (CRDT)
- Context ReactiveStore automatically updates (read-only derived data)

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
  modules: ['db', 'core', 'dragdrop', 'custom']
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

- **Don't mutate context directly** - Return results, let state machines update context
- **Don't call other tools directly** (use state machine)
- **Don't store state in tool** - Return results instead
- **Don't make assumptions** about schema structure
- **Don't block** - Keep async operations fast
- **Don't update context from tools** - All context updates flow through state machines

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
Tool returns result (does NOT mutate context directly)
  ↓
Tool succeeds → StateEngine sends SUCCESS event with result in payload
Tool fails → StateEngine sends ERROR event
  ↓
State machine handles SUCCESS/ERROR
  ↓
State machine updates context via updateContext action (if needed)
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

# OPERATIONS

*Source: creators/07-operations.md*

# Database Operations API

MaiaOS uses a **flexible, composable database operations API** through a single unified entry point: `maia.db({op: ...})`.

## Core Concept

All database operations flow through one simple API:

```javascript
await maia.db({ op: "operationName", ...params })
```

Where:
- `maia` = MaiaOS instance (from `MaiaOS.boot()`)
- `db()` = Unified database operation router
- `{ op, ...params }` = Operation configuration (pure JSON)

**Why this design?**
- ✅ **Simple** - One API for everything
- ✅ **Composable** - Easy to extend with new operations
- ✅ **JSON-native** - Perfect for declarative configs
- ✅ **Type-safe** - Runtime validation against schemas
- ✅ **Flexible** - Swappable backends (IndexedDB, CoJSON, etc.)

## Available Operations

### `read` - Load Data (Always Reactive)

Load data, configs, or schemas from the database. **Always returns a reactive store** that you can subscribe to.

**Load a specific config:**
```javascript
const store = await maia.db({
  op: "read",
  schema: "co_zActor123",  // Schema co-id (co_z...)
  key: "co_zAgent456"      // Config co-id (co_z...)
});

// Store has current value immediately
console.log('Current config:', store.value);

// Subscribe to updates
const unsubscribe = store.subscribe((data) => {
  console.log('Config updated:', data);
});
```

**Read a collection:**
```javascript
const store = await maia.db({
  op: "read",
  schema: "co_zTodos123"  // Schema co-id (co_z...)
});

// Store has current value immediately
console.log('Current todos:', store.value);

// Subscribe to updates
const unsubscribe = store.subscribe((todos) => {
  console.log('Todos updated:', todos);
});
```

**Read with filter:**
```javascript
const store = await maia.db({
  op: "read",
  schema: "co_zTodos123",  // Schema co-id (co_z...)
  filter: { done: false }
});

// Store has filtered results immediately
console.log('Incomplete todos:', store.value);

// Subscribe to updates (filter is automatically applied)
const unsubscribe = store.subscribe((todos) => {
  console.log('Incomplete todos updated:', todos);
});
```

**Important Notes:** 
- **All schemas must be co-ids** (`co_z...`) at runtime - human-readable IDs (`@schema/...`) are transformed to co-ids during seeding
- **Always returns a reactive store** - use `store.value` for current value and `store.subscribe()` for updates
- **No callbacks** - the store pattern replaces callback-based subscriptions

**Parameters:**
- `schema` (required) - Schema co-id (`co_z...`) - MUST be a co-id, not `@schema/...`
- `key` (optional) - Specific key (co-id) for single item lookups
- `filter` (optional) - Filter criteria object (e.g., `{done: false}`)

**Returns:**
- `ReactiveStore` - Always returns a reactive store with:
  - `store.value` - Current data value (available immediately)
  - `store.subscribe(callback)` - Subscribe to updates, returns unsubscribe function

### `create` - Create New Records

Create a new record with schema validation.

```javascript
const newTodo = await maia.db({
  op: "create",
  schema: "co_z...",  // Co-id (transformed from @schema/todos during seeding)
  data: {
    text: "Buy groceries",
    done: false
  }
});

console.log("Created:", newTodo.id); // Auto-generated ID (co-id)
```

**Parameters:**
- `schema` (required) - Co-id (`co_z...`) for data collections. Schema references (`@schema/todos`) are transformed to co-ids during seeding
- `data` (required) - Data object to create

**Returns:**
- Created record with auto-generated `id` and all fields

**Validation:**
- Automatically validates against the schema definition
- Throws error if validation fails

### `update` - Update Existing Records

Update an existing record with partial validation. Supports MaiaScript expressions in data.

```javascript
const updated = await maia.db({
  op: "update",
  id: "co_z...",  // Co-id of record to update
  data: {
    text: "Buy groceries and cook dinner",
    done: { "$not": "$existing.done" }  // Toggle using expression
  }
});
```

**Parameters:**
- `id` (required) - Co-id of record to update
- `data` (required) - Partial data object (only fields to update)
- `schema` (optional) - **Not required** - Schema is extracted from CoValue headerMeta automatically

**Returns:**
- Updated record

**Validation:**
- Validates only the fields you're updating (partial validation)
- Doesn't require all schema fields
- Supports MaiaScript expressions (e.g., `{"$not": "$existing.done"}` for toggling)
- Throws error if validation fails

**Toggle Example:**
Toggle is not a separate operation. Use `update` with an expression:

```javascript
const updated = await maia.db({
  op: "update",
  id: "co_z...",
  data: {
    done: { "$not": "$existing.done" }  // Toggles boolean field
  }
});
```

### `delete` - Delete Records

Delete a record from the database.

```javascript
const deleted = await maia.db({
  op: "delete",
  id: "co_z..."  // Co-id of record to delete
});

console.log("Deleted:", deleted); // true
```

**Parameters:**
- `id` (required) - Co-id of record to delete
- `schema` (optional) - **Not required** - Schema is extracted from CoValue headerMeta automatically

**Returns:**
- `true` if deleted successfully

### `seed` - Seed Database (Dev Only)

Reseed the database with initial data. **Idempotent** - can be called multiple times safely.

**Behavior:**
- **First seed**: Creates all schemata, configs, and data from scratch
- **Reseed**: Preserves schemata (updates if definitions changed), deletes and recreates all configs and data
- **Idempotent**: Safe to call multiple times - schemata co-ids remain stable across reseeds

```javascript
await maia.db({
  op: "seed",
  configs: {
    "vibe/vibe": { /* vibe config */ },
    "vibe/vibe.actor": { /* actor config */ }
  },
  schemas: {
    "@schema/todos": { /* schema definition */ }
  },
  data: {
    "@schema/todos": [
      { text: "First todo", done: false },
      { text: "Second todo", done: true }
    ]
  }
});
```

**Parameters:**
- `configs` (optional) - Config objects keyed by path
- `schemas` (optional) - Schema definitions keyed by schema ID
- `data` (optional) - Data arrays keyed by schema ID

**Returns:**
- `true` when seeding completes

**Idempotent Seeding:**
- **Schemata**: Checked against `account.os.schematas` registry - if exists, updated in-place (preserves co-id); if not, created new
- **Configs & Data**: Always deleted and recreated (ensures clean state)
- **Schema Index Colists**: Automatically managed - deleted co-values are removed from indexes, new co-values are added to indexes

**Note:** Use only in development! Reseeding preserves schemata but recreates all configs and data.

### `schema` - Load Schema Definitions

Load schema definitions by co-id, schema name, or from CoValue headerMeta.

```javascript
const schemaStore = await maia.db({
  op: "schema",
  coId: "co_zActor123"  // Co-id of schema or CoValue
});

// Or resolve from human-readable ID (during seeding only)
const schemaStore = await maia.db({
  op: "schema",
  humanReadableKey: "@schema/actor"
});
```

**Parameters:**
- `coId` (optional) - Co-id of schema or CoValue
- `humanReadableKey` (optional) - Human-readable schema ID (only during seeding)

**Returns:**
- `ReactiveStore` containing schema definition

### `resolve` - Resolve Human-Readable Keys to Co-IDs

Resolve human-readable keys (like `@schema/todos`) to co-ids. **Only for use during seeding.**

```javascript
const coId = await maia.db({
  op: "resolve",
  humanReadableKey: "@schema/todos"
});

console.log("Resolved:", coId); // "co_zTodos123..."
```

**Parameters:**
- `humanReadableKey` (required) - Human-readable key to resolve

**Returns:**
- Co-id string (`co_z...`)

**Note:** At runtime, all IDs should already be co-ids. This operation is primarily for seeding/transformation.

### `append` - Append to CoList

Append items to a CoList (ordered array).

```javascript
const result = await maia.db({
  op: "append",
  id: "co_zList123",  // Co-id of CoList
  items: ["item1", "item2"]
});
```

**Parameters:**
- `id` (required) - Co-id of CoList
- `items` (required) - Array of items to append

**Returns:**
- Updated CoList

### `push` - Append to CoStream

Append items to a CoStream (append-only stream). This is an alias for `append` with `cotype: "costream"`.

```javascript
const result = await maia.db({
  op: "push",
  id: "co_zStream123",  // Co-id of CoStream
  items: ["message1", "message2"]
});
```

**Parameters:**
- `id` (required) - Co-id of CoStream
- `items` (required) - Array of items to append

**Returns:**
- Updated CoStream

### `processInbox` - Process Actor Inbox

Process messages in an actor's inbox with session-based watermarks.

```javascript
const processed = await maia.db({
  op: "processInbox",
  actorId: "co_zActor123",
  sessionId: "session-abc"
});
```

**Parameters:**
- `actorId` (required) - Co-id of actor
- `sessionId` (required) - Session identifier for watermark tracking

**Returns:**
- Number of messages processed

**Note:** This is typically handled automatically by ActorEngine. Manual use is rare.

## Tool Invocation Pattern

**CRITICAL:** Tools are invoked BY state machines, never directly from views or other engines.

**Pattern:**
1. View sends event to state machine
2. State machine invokes tool (in entry actions or transition actions)
3. Tool executes operation and returns result
4. State machine receives SUCCESS event with tool result in payload
5. State machine updates context via `updateContext` action using `$$result`

**Why this matters:**
- **Single source of truth:** All operations flow through state machines
- **Predictable:** Easy to trace where operations come from
- **Error handling:** State machines handle SUCCESS/ERROR events
- **Context updates:** State machines update context via `updateContext` infrastructure action
- **Tool results accessible:** Tool results available via `$$result` in SUCCESS handlers

**Never:**
- ❌ Invoke tools directly from views
- ❌ Invoke tools from other engines
- ❌ Update context directly in tools (tools should return results, not manipulate context)
- ❌ Tools calling `updateContextCoValue()` directly

**Always:**
- ✅ Invoke tools from state machine actions
- ✅ Handle SUCCESS/ERROR events in state machines
- ✅ Update context via state machine actions using `updateContext` infrastructure action
- ✅ Tools return results - state machines handle context updates

## Usage in State Machines

Use the `@db` tool in your state machine definitions:

```json
{
  "states": {
    "creating": {
      "entry": {
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
      "on": {
        "SUCCESS": {
          "target": "idle",
          "actions": [
            {
              "tool": "@core/publishMessage",
              "payload": {
                "type": "TODO_CREATED",
                "payload": {
                  "id": "$$result.id",      // ← Access tool result
                  "text": "$$result.text"  // ← Tool result available in SUCCESS handler
                }
              }
            }
          ]
        },
        "ERROR": "error"
      }
    },
    "toggling": {
      "entry": {
        "tool": "@db",
        "payload": {
          "op": "update",
          "id": "$$id",
          "data": {
            "done": { "$not": "$existing.done" }
          }
        }
      },
      "on": {
        "SUCCESS": "idle"
      }
    }
  }
}
```

**Accessing Tool Results:**
- Tool results are included in SUCCESS event payload as `result`
- Access via `$$result.propertyName` in SUCCESS handlers
- Example: `$$result.id`, `$$result.text`, `$$result.draggedItemId`

## Architecture

```
@db tool (in state machine)
  ↓
maia.db({op: ...})
  ↓
DBEngine.execute()
  ↓
Operation Handler (query/create/update/delete/toggle/seed)
  ↓
Backend (IndexedDB, CoJSON, etc.)
  ↓
Database
```

**Key Components:**

1. **DBEngine** (`libs/maia-script/src/o/engines/maiadb/db.engine.js`)
   - Routes operations to handlers
   - Supports swappable backends

2. **Operation Handlers** (`libs/maia-operations/src/operations/`)
   - `read.js` - Read operation handler (always returns reactive store)
   - `create.js` - Create operation handler
   - `update.js` - Update operation handler (supports MaiaScript expressions)
   - `delete.js` - Delete operation handler
   - `seed.js` - Seed operation handler
   - `schema.js` - Schema loading operation handler
   - `resolve.js` - Co-id resolution operation handler
   - `append.js` - CoList/CoStream append operation handler
   - `process-inbox.js` - Inbox processing operation handler

3. **Backend** (`libs/maia-script/src/engines/db-engine/backend/`)
   - `indexeddb/` - IndexedDB backend (current)
   - Future: CoJSON CRDT backend

## Best Practices

### 1. Tools Are Invoked by State Machines

**✅ DO:** Invoke tools from state machine actions

```json
{
  "idle": {
    "on": {
      "CREATE_TODO": {
        "target": "creating",
        "actions": [
          {
            "tool": "@db",
            "payload": {
              "op": "create",
              "schema": "@schema/todos",
              "data": {...}
            }
          }
        ]
      }
    }
  }
}
```

**❌ DON'T:** Invoke tools directly from views or other engines

```javascript
// ❌ Don't do this - tools should be invoked by state machines
actor.actorEngine.toolEngine.execute('@db', actor, payload);
```

### 2. Define Query Objects in Context (Not State Machines)

**✅ DO:** Define query objects directly in your context file (`.context.maia`)

```json
{
  "$schema": "@schema/context",
  "$id": "@context/todo",
  "todos": {
    "schema": "@schema/todos",
    "filter": null
  },
  "todosTodo": {
    "schema": "@schema/todos",
    "filter": { "done": false }
  }
}
```

**❌ DON'T:** Define queries in state machines or call read operations in tools

```json
{
  "entry": {
    "tool": "@db",
    "payload": {
      "op": "read",
      "schema": "co_zTodos123"
      // Don't do this - define query objects in context instead!
    }
  }
}
```

**Why:** Query objects in context automatically create reactive query stores that are subscribed to by ViewEngine. State machines should only handle mutations (create, update, delete), not queries.

**See [Context - Reactive Data](./04-context.md#1-reactive-data-query-objects-) for complete documentation on query objects.**

### 3. Always Use Operations for Mutations

**✅ DO:** Use `@db` tool for all data changes (invoked by state machines)

```json
{
  "tool": "@db",
  "payload": {
    "op": "create",
    "schema": "@schema/todos",
    "data": {...}
  }
}
```

**❌ DON'T:** Modify reactive query data directly

```json
{
  "updateContext": {
    "todos": [...] // Don't mutate reactive data directly!
  }
```

### 4. Handle Errors in State Machines

**✅ DO:** Handle SUCCESS/ERROR events and update context via state machine

```json
{
  "creating": {
    "entry": {
      "tool": "@db",
      "payload": {...}
    },
    "on": {
      "SUCCESS": "idle",
      "ERROR": {
        "target": "error",
        "actions": [
          {
            "updateContext": { "error": "$$error" }
          }
        ]
      }
    }
  },
  "error": {
    "on": {
      "RETRY": "creating",
      "DISMISS": "idle"
    }
  }
}
```

**❌ DON'T:** Set error context directly in tools

```javascript
// ❌ Don't do this - errors should be handled by state machines
actor.context.error = error.message;
```

### 5. Toggle Boolean Fields with Update Expression

**✅ DO:** Use `update` operation with expression to toggle boolean fields

```json
{
  "tool": "@db",
  "payload": {
    "op": "update",
    "id": "$$id",
    "data": {
      "done": { "$not": "$existing.done" }
    }
  }
}
```

**❌ DON'T:** Use non-existent toggle operation

```json
{
  "tool": "@db",
  "payload": {
    "op": "toggle",  // ❌ Toggle is not a separate operation
    "id": "$$id",
    "field": "done"
  }
}
```

## Examples

### Complete Todo List Example

**Context (`todo.context.maia`):**
```json
{
  "$schema": "@schema/context",
  "$id": "@context/todo",
  "todos": {
    "schema": "@schema/todos",
    "filter": null
  },
  "newTodoText": ""
}
```

**State Machine (`todo.state.maia`):**
```json
{
  "$schema": "@schema/state",
  "$id": "@state/todo",
  "initial": "idle",
  "states": {
    "idle": {
      "on": {
        "CREATE_TODO": {
          "target": "creating",
          "guard": {"$ne": ["$newTodoText", ""]}
        },
        "TOGGLE_TODO": {
          "target": "toggling"
        },
        "DELETE_TODO": {
          "target": "deleting"
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
          "updateContext": {"newTodoText": ""}
        }
      ],
      "on": {
        "SUCCESS": "idle",
        "ERROR": "error"
      }
    },
    "toggling": {
      "entry": {
        "tool": "@db",
        "payload": {
          "op": "update",
          "id": "$$id",
          "data": {
            "done": { "$not": "$existing.done" }
          }
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

## Operation Schema

The `@db` tool validates operations against this schema:

```json
{
  "op": {
    "type": "string",
    "enum": ["read", "create", "update", "delete", "seed", "schema", "resolve", "append", "push", "processInbox"]
  },
  "schema": {
    "type": "string",
    "description": "Schema co-id (co_z...) - Required for create, optional for update/delete (extracted from CoValue)"
  },
  "key": {
    "type": "string",
    "description": "Optional: Specific key (co-id) for read queries"
  },
  "keys": {
    "type": "array",
    "description": "Optional: Array of co-ids for batch reads"
  },
  "filter": {
    "type": "object",
    "description": "Optional: Filter criteria for read queries"
  },
  "id": {
    "type": "string",
    "description": "Co-id for update/delete/append/push operations"
  },
  "data": {
    "type": "object",
    "description": "Data for create/update operations (supports MaiaScript expressions)"
  },
  "items": {
    "type": "array",
    "description": "Items to append/push to CoList/CoStream"
  },
  "coId": {
    "type": "string",
    "description": "Co-id for schema operation"
  },
  "humanReadableKey": {
    "type": "string",
    "description": "Human-readable key for resolve/schema operations (seeding only)"
  },
  "actorId": {
    "type": "string",
    "description": "Actor co-id for processInbox operation"
  },
  "sessionId": {
    "type": "string",
    "description": "Session ID for processInbox operation"
  }
}
```

## References

- **DBEngine:** `libs/maia-operations/src/engine.js`
- **Operation Handlers:** `libs/maia-operations/src/operations/`
- **Backend:** `libs/maia-script/src/backends/indexeddb/`
- **Tool Definition:** `libs/maia-tools/src/db/db.tool.js`
- **Example Vibe:** `libs/maia-vibes/src/todos/`

## Future Enhancements

Potential future operations:
- `batch` - Execute multiple operations atomically
- `transaction` - Multi-operation transactions
- `migrate` - Schema migration operations
- `export` - Export data to JSON
- `import` - Import JSON into database

---

# VIEWS

*Source: creators/08-views.md*

# Views (UI Representation)

**Views** define the UI representation of an actor. They are declarative JSON structures that the ViewEngine renders to Shadow DOM.

## Philosophy

> Views are the EYES of an actor. They visualize context and capture user events.

**CRITICAL ARCHITECTURE:**
- **Templates are "dumb"** - Pure declarative structure, zero logic, zero conditionals
- **State Machines define the state** - All logic, computation, and state transitions happen here
- **Context is the realtime reactive snapshot** - The current reflection of state, automatically updated when state changes
- **ViewEngine** handles HOW to render (imperative)
- **CSS** handles conditional styling via data-attributes (no `$if` in views!)
- **Events** trigger state machine transitions

**The Flow:**
```
State Machine (defines state) 
  ↓
Updates Context (realtime reactive snapshot)
  ↓
View Template (dumb, just renders context)
  ↓
CSS (handles conditional styling via data-attributes)
```

## View Definition

Create a file named `{name}.view.maia`:

```json
{
  "$schema": "@schema/view",
  "$id": "@view/todo",
  
  "content": {
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

**Note:** `$schema` and `$id` use schema references (`@schema/view`, `@view/todo`) that are transformed to co-ids (`co_z...`) during seeding.

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

**CRITICAL:** Views are **"dumb" templates** - they contain **zero conditional logic**. All conditionals are handled by:
- **State Machine** → defines state, computes boolean flags → stores in context
- **Context** → realtime reactive snapshot of current state reflection
- **View** → dumb template, just references context values → maps to data-attributes
- **CSS** → matches data-attributes → applies conditional styles

**Remember:** Templates don't think, they just render. State machines think. Context reflects.

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

**CRITICAL:** Views are **"dumb" templates** - they contain **zero conditional logic**. All conditionals are handled by the state machine and CSS:

**Architecture:**
- **State Machine** → Defines state, computes boolean flags
- **Context** → Realtime reactive snapshot of current state reflection  
- **View Template** → Dumb, just references context → maps to data-attributes
- **CSS** → Handles conditional styling via data-attributes

### Pattern: State Machine → Context → Data-Attributes → CSS

**1. State Machine computes boolean flags:**
```json
{
  "updateContext": {
    "listButtonActive": {"$eq": ["$$viewMode", "list"]},
    "kanbanButtonActive": {"$eq": ["$$viewMode", "kanban"]}
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
- `$$fieldName` accesses item properties (e.g., `$$id`, `$$text`, `$$fromRole`, `$$toRole`)
- `$fieldName` accesses actor context (e.g., `$viewMode`, `$draggedItemId`, `$toggleButtonText`)

**Generic Template Variables:**
When using map transformations in query objects, use generic placeholder names that fit your view template slots:
- `$$fromRole`, `$$toRole` - For log entries (generic "from/to" perspective)
- `$$fromId`, `$$toId` - For log entry IDs
- `$$itemText`, `$$itemId` - For list items (generic item properties)

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
  
  "content": {
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
- **Extract hardcoded strings** - Use context variables for all UI text (e.g., `"text": "$toggleButtonText"`)
- **Use generic template variables** - Match context key names (e.g., `$$fromRole`, `$$toRole` for log entries)

### ❌ DON'T:

- **Don't use `$if` in views** - All conditionals handled by state machine + CSS
- **Don't put logic in views** - Use state machines to compute boolean flags
- **Don't hardcode data** - Use context references
- **Don't duplicate structures** - Use `$each` loops
- **Don't use `on` (use `$on`)** - Maintain DSL consistency
- **Don't use `slot` (use `$slot`)** - Maintain DSL consistency
- **Don't create deep nesting** - Extract to sub-views (future feature)
- **Don't mix concerns** - Separate layout from data
- **Don't hardcode strings** - Extract all UI text to context variables (e.g., don't use `"text": "✓"`, use `"text": "$toggleButtonText"`)
- **Don't use specific names** - Use generic template variable names that match context keys

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
- ❌ `$if` - **Templates are dumb!** Use state machine + data-attributes + CSS instead
- ❌ `slot` - Migrated to `$slot` for consistency
- ❌ `on` - Migrated to `$on` for consistency

**Remember the Architecture:**
- **State Machines** → Define state (all logic)
- **Context** → Realtime reactive snapshot of current state reflection
- **Templates** → Dumb, just render context (zero logic)

## Next Steps

- Learn about [State Machines](./05-state.md) - How views trigger events
- Explore [Context](./04-context.md) - What views display
- Understand [Brand](./08-brand.md) - Design system for views
- Read [Style](./09-style.md) - Additional styling

---

# BRAND

*Source: creators/09-brand.md*

# Brand (Design System)

**Brand** is a shared design system that defines the visual language across all actors. It provides consistent tokens for colors, typography, spacing, and component styles.

## Philosophy

> Brand is the IDENTITY of your application. It ensures visual consistency across all actors.

- **Brand** defines design tokens (colors, spacing, typography) and shared component styles
- **StyleEngine** compiles brand definitions to CSS
- **Actors** reference brand via `brand` property (required)
- **Actors** can also have local styles via `style` property (optional) for customization
- **StyleEngine merges** brand + style at runtime (brand first, style overrides)

## Brand Definition

Create a file named `brand.style.maia`:

```json
{
  "$schema": "@schema/style",
  "$id": "@style/brand",
  
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

## Selectors Section

The `selectors` section allows you to define CSS selector-based styles (typically used in brand styles for global element styling).

**Use selectors for:**
- Global element styles (`h1`, `p`, `button`, etc.)
- Pseudo-classes (`:host`, `:hover`, `:focus`)
- Media queries (`@media (min-width: 768px)`)
- Advanced CSS selectors

**Example:**
```json
{
  "selectors": {
    ":host": {
      "fontFamily": "var(--font-family)",
      "fontSize": "var(--font-size-base)",
      "color": "var(--color-text)"
    },
    "h1": {
      "fontSize": "var(--font-size-h1)",
      "fontWeight": "var(--font-weight-bold)",
      "marginBottom": "var(--spacing-lg)"
    },
    "button:hover": {
      "opacity": "0.9"
    },
    "@media (min-width: 768px)": {
      "h1": {
        "fontSize": "var(--font-size-h1-large)"
      }
    }
  }
}
```

**Note:** The `selectors` section is typically used in brand styles for global application styling. Actor-specific styles usually use the `components` section with nested data-attribute syntax.

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
  "$schema": "@schema/actor",
  "$id": "@actor/todo",
  "brand": "@style/brand",  // ← Required: shared design system
  "style": "@style/todo",   // ← Optional: actor-specific overrides
  "view": "@view/todo",
  "state": "@state/todo"
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
- **Use `selectors` section** - For global element styles and advanced CSS selectors
- **Use nested data syntax** - For conditional styling via data-attributes in `components`
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
  "$schema": "@schema/style",
  "$id": "@style/brand",
  
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

*Source: creators/10-style.md*

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
  "$schema": "@schema/style",
  "$id": "@style/todo",
  
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

**Note:** 
- Use `components` section for component definitions with nested data-attribute syntax (e.g., `.todoItem`, `.card`)
- Use `selectors` section for advanced CSS selectors (e.g., `:host`, `h1`, `@media` queries)
- The old `styles` section is deprecated - use `components` or `selectors` instead

## Linking Style to Actors

In your actor definition:

```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/todo",
  "brand": "@style/brand",  // ← Required: shared design system
  "style": "@style/todo",   // ← Optional: actor-specific overrides
  "view": "@view/todo",
  "state": "@state/todo"
}
```

**Note:** 
- `brand` is **required** - shared design system (tokens, components) used by all actors
- `style` is **optional** - actor-specific style overrides that merge with brand
- StyleEngine merges brand + style at runtime (brand first, style overrides)
- Both use co-id references (`@style/brand`, `@style/todo`) that are transformed to co-ids during seeding

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

## Components vs Selectors

**Components Section:**
- Use for component definitions (e.g., `.todoItem`, `.card`, `.button`)
- Supports nested data-attribute syntax for conditional styling
- Component names map to CSS classes (camelCase → kebab-case automatically)

**Selectors Section:**
- Use for advanced CSS selectors (e.g., `:host`, `h1`, `button:hover`)
- Use for pseudo-classes, pseudo-elements, and media queries
- Typically used in brand styles for global element styling
- **Class selectors are automatically converted** from camelCase to kebab-case (e.g., `.todoCategory` → `.todo-category`) to match DOM class names
- Special selectors (`:host`, `@container`, `@media`) are preserved without conversion

## Common Patterns

### Layout Styles (Components Section)
```json
{
  "components": {
    "todoApp": {
      "display": "flex",
      "flexDirection": "column",
      "gap": "var(--spacing-lg)",
      "maxWidth": "800px",
      "margin": "0 auto"
    },
    "kanbanBoard": {
      "display": "grid",
      "gridTemplateColumns": "repeat(2, 1fr)",
      "gap": "var(--spacing-md)"
    },
    "column": {
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

### Animation Styles (Selectors Section)
```json
{
  "selectors": {
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

## Container Queries (Responsive Design)

**Container queries** allow elements to respond to their parent container's size, not just the viewport size. This is perfect for responsive components that work anywhere.

### How It Works

Every actor's shadow host **automatically** has `container-type: inline-size` and a unique `container-name` enabled via the StyleEngine. This means:

- Your actor's root element (`:host`) becomes a container automatically
- All elements inside can use `@container` queries
- Works in ALL contexts: maia-city, standalone apps, embedded actors
- **Zero configuration required** - it just works everywhere
- Breakpoint tokens are automatically available to all actors

### Mobile-First Breakpoint Tokens

Use these standard mobile-first breakpoint tokens in your container queries (automatically injected by StyleEngine):

- `{containers.xs}` - 240px (small phones)
- `{containers.sm}` - 360px (standard phones)
- `{containers.md}` - 480px (large phones/small tablets)
- `{containers.lg}` - 640px (tablets)
- `{containers.xl}` - 768px (large tablets/small desktop)
- `{containers.2xl}` - 1024px (desktop)

**Note:** These tokens are automatically available to all actors. Brands can override them if needed, but all actors get these defaults.

### Example: Responsive Card Grid

```json
{
  "components": {
    "cardGrid": {
      "display": "grid",
      "gridTemplateColumns": "repeat(4, 1fr)",
      "gap": "1rem"
    },
    "card": {
      "padding": "1.5rem",
      "fontSize": "1rem"
    }
  },
  "selectors": {
    "@container (max-width: {containers.lg})": {
      ".card-grid": {
        "gridTemplateColumns": "repeat(3, 1fr)"
      }
    },
    "@container (max-width: {containers.md})": {
      ".card-grid": {
        "gridTemplateColumns": "repeat(2, 1fr)"
      },
      ".card": {
        "padding": "1rem"
      }
    },
    "@container (max-width: {containers.xs})": {
      ".card-grid": {
        "gridTemplateColumns": "1fr"
      },
      ".card": {
        "padding": "0.75rem",
        "fontSize": "0.875rem"
      }
    }
  }
}
```

### Example: Responsive Form Layout

```json
{
  "components": {
    "form": {
      "display": "flex",
      "flexDirection": "row",
      "gap": "1rem"
    },
    "input": {
      "padding": "0.75rem",
      "fontSize": "1rem"
    },
    "button": {
      "padding": "0.75rem 1.5rem",
      "fontSize": "1rem"
    }
  },
  "selectors": {
    "@container (max-width: {containers.sm})": {
      ".form": {
        "flexDirection": "column",
        "gap": "0.5rem"
      },
      ".input": {
        "padding": "0.5rem",
        "fontSize": "0.875rem"
      },
      ".button": {
        "padding": "0.5rem 1rem",
        "fontSize": "0.875rem",
        "width": "100%"
      }
    }
  }
}
```

### Nested Containers (Advanced)

If you need a nested element to be its own container (e.g., for a sidebar), set `containerType: "inline-size"` in the component definition:

```json
{
  "components": {
    "sidebar": {
      "containerType": "inline-size",
      "width": "300px",
      "display": "flex",
      "flexDirection": "column"
    },
    "sidebarItem": {
      "display": "flex",
      "alignItems": "center",
      "gap": "0.5rem"
    }
  },
  "selectors": {
    "@container (max-width: 250px)": {
      ".sidebar-item": {
        "flexDirection": "column",
        "alignItems": "flex-start"
      }
    }
  }
}
```

### Best Practices

- **Use semantic breakpoints** - `{containers.xs}` instead of hardcoded values like `32rem`
- **Mobile-first approach** - Define base styles for mobile, then override for larger sizes
- **Scale everything** - Not just layout, but also padding, gap, font sizes, etc.
- **Test at all sizes** - Resize your browser from mobile (320px) to desktop (1920px)

## Overriding Brand Styles

Local styles can override brand styles:

```json
{
  "components": {
    "buttonPrimary": {
      "backgroundColor": "#ef4444",  // Override brand primary color
      "borderRadius": "0"             // Override brand border radius
    },
    "input": {
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
  "components": {
    "customElement": {
      "color": "var(--color-primary)",
      "padding": "var(--spacing-md)",
      "borderRadius": "var(--border-radius-lg)",
      "boxShadow": "var(--shadow-md)"
    }
  }
}
```

Define local custom properties (use selectors for `:host`):

```json
{
  "selectors": {
    ":host": {
      "--local-accent": "#f59e0b",
      "--local-spacing": "0.75rem"
    }
  },
  "components": {
    "customElement": {
      "color": "var(--local-accent)",
      "padding": "var(--local-spacing)"
    }
  }
}
```

## Responsive Styles (Selectors Section)

```json
{
  "components": {
    "todoApp": {
      "padding": "var(--spacing-md)"
    },
    "kanbanBoard": {
      "gridTemplateColumns": "repeat(2, 1fr)"
    }
  },
  "selectors": {
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

## Pseudo-classes and Pseudo-elements (Selectors Section)

```json
{
  "selectors": {
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
- **Use `components` section** - For component definitions with nested data-attribute syntax
- **Use `selectors` section** - For advanced CSS selectors (pseudo-classes, media queries, `:host`)
- **Keep styles scoped** - Shadow DOM provides isolation
- **Use semantic names** - `todoItem` not `item123` (camelCase → kebab-case in CSS)
- **Leverage transitions** - Smooth state changes
- **Support responsive** - Use media queries in `selectors` section
- **Use nested data syntax** - For conditional styling via data-attributes in `components`

### ❌ DON'T:

- **Don't use `styles` section** - Use `components` or `selectors` instead
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
  "$schema": "@schema/style",
  "$id": "@style/todo",
  
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

# SCHEMATA

*Source: creators/11-schemata.md*

# MaiaOS Schemata System

The MaiaOS schemata system provides a JSON Schema-based type system for CoJSON types (comap, colist, costream) with co-id-based references, seeding, and runtime validation.

## Core Principles

### 1. Every Schema Must Have a Co-Type

**CRITICAL RULE**: Every schema or instance **must** be one of three CoJSON types:

- **`cotype: "comap"`** - CRDT map (key-value pairs with properties)
- **`cotype: "colist"`** - CRDT list (ordered array with items)
- **`cotype: "costream"`** - CRDT stream (append-only list with items)

**Example:**
```json
{
  "$schema": "@schema/meta",
  "$id": "@schema/actor",
  "title": "Actor Definition",
  "cotype": "comap",  // ← REQUIRED: Must be comap, colist, or costream
  "properties": {
    // ...
  }
}
```

### 2. Use `$co` for CoValue References, `$ref` Only for Internal Definitions

**CRITICAL RULE**: 
- **Use `$co`** to reference **separate CoValue entities** (other schemas, actors, views, etc.)
- **Use `$ref`** **ONLY** for internal schema definitions (within `$defs`)

**Why?**
- `$co` indicates a property value is a **co-id reference** to another CoValue
- `$ref` is for JSON Schema internal references (like `#/$defs/viewNode`)
- Never use `$ref` to reference external schemas - always use `$co`

**✅ CORRECT:**
```json
{
  "properties": {
    "context": {
      "$co": "@schema/context",  // ← References separate CoValue
      "description": "Co-id reference to context definition"
    },
    "children": {
      "type": "array",
      "items": {
        "$co": "@schema/actor"  // ← Each item is a co-id reference
      }
    }
  },
  "$defs": {
    "viewNode": {
      "type": "object",
      "properties": {
        "children": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/viewNode"  // ← OK: Internal reference
          }
        }
      }
    }
  }
}
```

**❌ WRONG:**
```json
{
  "properties": {
    "context": {
      "$ref": "@schema/context"  // ← WRONG: Use $co for CoValue references
    }
  }
}
```

## Schema Structure

### Required Fields

Every schema must have:

1. **`$schema`** - Reference to meta-schema (usually `"@schema/meta"`)
2. **`$id`** - Unique schema identifier (human-readable like `"@schema/actor"` or co-id like `"co_z..."`)
3. **`title`** - Human-readable schema title
4. **`cotype`** - CoJSON type: `"comap"`, `"colist"`, or `"costream"`

### Schema Examples

#### Example 1: Actor Schema (comap)
```json
{
  "$schema": "@schema/meta",
  "$id": "@schema/actor",
  "title": "@schema/actor",
  "description": "Pure declarative actor specification",
  "cotype": "comap",
  "indexing": true,
  "properties": {
    "role": {
      "type": "string",
      "description": "Actor role (e.g., 'kanban-view', 'vibe', 'composite', 'leaf')"
    },
    "context": {
      "$co": "@schema/context",  // ← CoValue reference
      "description": "Co-id reference to context definition"
    },
    "view": {
      "$co": "@schema/view",  // ← CoValue reference
      "description": "Co-id reference to view definition"
    },
    "state": {
      "$co": "@schema/state",  // ← CoValue reference
      "description": "Co-id reference to state machine definition"
    },
    "brand": {
      "$co": "@schema/style",  // ← CoValue reference
      "description": "Co-id reference to brand style definition"
    },
    "style": {
      "$co": "@schema/style",  // ← CoValue reference
      "description": "Co-id reference to local style definition"
    },
    "inbox": {
      "$co": "@schema/inbox",  // ← CoValue reference
      "description": "Co-id reference to message inbox costream"
    }
  }
}
```

#### Example 2: Inbox Schema (costream)
```json
{
  "$schema": "@schema/meta",
  "$id": "@schema/inbox",
  "title": "Inbox CoStream",
  "cotype": "costream",  // ← Append-only stream
  "properties": {
    "$id": {
      "type": "string",
      "pattern": "^co_z[a-zA-Z0-9]+$"
    },
    "items": {
      "type": "array",
      "description": "Array of message co-id references",
      "items": {
        "$co": "@schema/message",  // ← Each item is a co-id reference
        "description": "Each item is a co-id reference to a message"
      }
    }
  },
  "required": ["items"]
}
```

#### Example 3: Guard Schema (comap - accepts any MaiaScript expression)
```json
{
  "$schema": "@schema/meta",
  "$id": "@schema/guard",
  "title": "@schema/guard",
  "description": "Guard condition for state machine transitions",
  "cotype": "comap",
  "indexing": true,
  "properties": {},
  "additionalProperties": true  // ← Accepts any MaiaScript expression properties
}
```

**Note**: The `guard` schema accepts any properties (via `additionalProperties: true`), allowing any MaiaScript expression to be used as a guard condition. Guards are validated against the MaiaScript expression schema at runtime.

#### Example 4: View Schema (comap with internal $defs)
```json
{
  "$schema": "@schema/meta",
  "$id": "@schema/view",
  "title": "@schema/view",
  "description": "UI structure definition with DOM tree, expressions, loops, and event handlers",
  "cotype": "comap",
  "indexing": true,
  "properties": {
    "content": {
      "type": "object",
      "description": "View content structure (recursive viewNode)",
      "$ref": "#/$defs/viewNode"  // ← OK: Internal reference to $defs
    }
  },
  "$defs": {
    "viewNode": {
      "type": "object",
      "description": "Recursive DOM node structure",
      "properties": {
        "tag": { "type": "string" },
        "class": { "type": "string" },
        "text": {
          "anyOf": [
            { "type": "string", "pattern": "^\\$\\$" },
            { "type": "string", "pattern": "^@" },
            { "type": "string", "pattern": "^\\$[^$]" },
            { "type": "string" },
            { "type": "number" },
            { "type": "boolean" },
            { "type": "null" }
          ]
        },
        "children": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/viewNode"  // ← OK: Recursive internal reference
          }
        },
        "$on": {
          "type": "object",
          "additionalProperties": {
            "type": "object",
            "properties": {
              "send": { "type": "string" },
              "payload": { "type": "object", "additionalProperties": true },
              "key": { "type": "string" }
            },
            "required": ["send"]
          }
        },
        "$each": {
          "type": "object",
          "properties": {
            "items": { "anyOf": [/* expression patterns */] },
            "template": { "$ref": "#/$defs/viewNode" }
          },
          "required": ["items", "template"]
        },
        "$slot": {
          "anyOf": [/* expression patterns */]
        }
      },
      "additionalProperties": false
    }
  },
  "additionalProperties": false
}
```

#### Example 5: MaiaScript Expression Schema (comap with recursive $ref)
```json
{
  "$schema": "@schema/meta",
  "$id": "@schema/maia-script-expression",
  "title": "MaiaScript Expression",
  "cotype": "comap",
  "anyOf": [
    { "type": ["number", "boolean", "null"] },
    { "type": "string" },
    { "$ref": "#/$defs/expressionObject" }  // ← OK: Internal reference
  ],
  "$defs": {
    "expressionObject": {
      "type": "object",
      "oneOf": [
        {
          "properties": {
            "$eq": {
              "type": "array",
              "items": {
                "$ref": "#"  // ← OK: Self-reference (recursive)
              }
            }
          }
        }
      ]
    }
  }
}
```

## Seeding Process

The seeding process transforms human-readable schema IDs (like `"@schema/actor"`) into co-ids (like `"co_zABC123..."`) and stores everything in IndexedDB.

### Phase 1: Co-ID Generation

1. **Generate co-ids for all schemas**
   - Each unique schema `$id` gets a deterministic co-id
   - Co-ids are stored in a registry: `Map<human-readable-id, co-id>`

```javascript
// Example: Schema "@schema/actor" → co-id "co_zABC123..."
const schemaCoIdMap = new Map();
for (const schema of schemas) {
  const coId = generateCoIdForSchema(schema);
  schemaCoIdMap.set(schema.$id, coId);
}
```

### Phase 2: Schema Transformation

2. **Transform all schemas** (replace human-readable refs with co-ids)
   - `$schema: "@schema/meta"` → `$schema: "co_zMeta123..."`
   - `$id: "@schema/actor"` → `$id: "co_zABC123..."`
   - `$co: "@schema/context"` → `$co: "co_zContext456..."`
   - `$ref` values are **NOT** transformed (only for internal definitions)

```javascript
// Transform schema
const transformed = transformSchemaForSeeding(schema, schemaCoIdMap);
// Result: All $co references now use co-ids
```

### Phase 2.5: Schema Validation After Transformation

2.5. **Validate transformed schemas** (ensure transformation didn't introduce errors)
   - Each transformed schema validated against its `$schema` meta-schema
   - Meta-schema loaded from in-memory map or database
   - Ensures data integrity before storage
   - Throws error if validation fails

```javascript
// Validate transformed schema
const result = await validationEngine.validateSchemaAgainstMeta(transformedSchema);
if (!result.valid) {
  throw new Error(`Schema validation failed: ${result.errors}`);
}
```

### Phase 3: Schema Storage

3. **Store validated schemas in IndexedDB**
   - Schemas stored with co-id as key
   - Already validated in Phases 1 and 2.5

### Phase 4: Instance Transformation

4. **Transform all instances** (actors, views, contexts, etc.)
   - `$schema: "@schema/actor"` → `$schema: "co_zABC123..."`
   - `$id: "actor/001"` → `$id: "co_zInstance789..."`
   - Property values with `$co` references are transformed
   - Query objects (`{schema: "@schema/todos", filter: {...}}`) are transformed

```javascript
// Transform instance
const transformed = transformInstanceForSeeding(instance, coIdMap);
// Result: All references now use co-ids
```

### Phase 4.5: Instance Validation After Transformation

4.5. **Validate transformed instances** (ensure transformation didn't introduce errors)
   - Each transformed instance validated against its `$schema` schema
   - Schema loaded from database (seeded in Phase 3)
   - Ensures data integrity before storage
   - Throws error if validation fails

```javascript
// Validate transformed instance
const schema = await dbEngine.getSchema(instance.$schema);
await validateAgainstSchemaOrThrow(schema, instance, context);
```

### Phase 5: Instance Storage

5. **Store validated instances in IndexedDB**
   - Instances stored with co-id as key
   - Already validated in Phase 4.5
   - Also validated on load (runtime check)

## Code Generation

Currently, schemas are **not** compiled to TypeScript or other code. They remain as JSON Schema definitions that are:

1. **Validated** against the meta-schema during seeding (before and after transformation)
2. **Transformed** from human-readable IDs to co-ids
3. **Validated again** after transformation to ensure integrity
3. **Stored** in IndexedDB for runtime resolution
4. **Used** for runtime validation via AJV

Future code generation could:
- Generate TypeScript types from schemas
- Generate runtime validators
- Generate serialization/deserialization code

## Runtime Resolution and Validation

### Schema Resolution

At runtime, schemas are resolved from IndexedDB using co-ids:

```javascript
// Resolve schema by co-id
const schema = await schemaResolver("co_zABC123...");
// Returns full schema definition
```

### Validation Process

1. **Load schema** from IndexedDB using co-id
2. **Resolve dependencies**:
   - `$schema` references (meta-schema)
   - `$co` references (other schemas)
   - `$ref` references (internal definitions)
3. **Register schemas** in AJV registry
4. **Validate instance** against schema

```javascript
const validationEngine = new ValidationEngine();
await validationEngine.initialize();

// Validate instance against schema
const result = await validationEngine.validate(
  instance,
  schemaCoId
);
```

### $co Reference Resolution

When validating, `$co` references are resolved:

1. **Extract `$co` value** (co-id or human-readable ID)
2. **Resolve schema** from IndexedDB
3. **Register schema** in AJV for validation
4. **Validate** that the referenced value conforms to the schema

```javascript
// Property definition
{
  "context": {
    "$co": "co_zContext456..."  // ← Resolved to context schema
  }
}

// Runtime validation
// 1. Load context schema: co_zContext456...
// 2. Validate instance.context value against context schema
// 3. Ensure instance.context is a valid co-id string
```

### Validation Rules

- **Co-ID validation**: Properties with `$co` must contain valid co-id strings (`co_z...`)
- **Schema conformance**: Referenced CoValues must conform to their schema
- **Type checking**: All properties validated against their schema definitions
- **Required fields**: Required properties must be present

## Common Patterns

### Pattern 1: Referencing Other Schemas

```json
{
  "properties": {
    "view": {
      "$co": "@schema/view"  // ← Always use $co for schema references
    }
  }
}
```

### Pattern 2: Arrays of CoValue References

```json
{
  "properties": {
    "children": {
      "type": "array",
      "items": {
        "$co": "@schema/actor"  // ← Each item is a co-id reference
      }
    }
  }
}
```

### Pattern 3: Recursive Internal Definitions

```json
{
  "$defs": {
    "viewNode": {
      "type": "object",
      "properties": {
        "children": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/viewNode"  // ← OK: Internal recursive reference
          }
        }
      }
    }
  }
}
```

### Pattern 4: Expression References

```json
{
  "properties": {
    "text": {
      "$co": "@schema/maia-script-expression"  // ← Expression schema reference
    },
    "value": {
      "$co": "@schema/maia-script-expression"  // ← Expression schema reference
    }
  }
}
```

### Pattern 5: Nested Objects with $co

```json
{
  "properties": {
    "attrs": {
      "type": "object",
      "additionalProperties": {
        "anyOf": [
          {
            "$co": "@schema/maia-script-expression"  // ← Expression in attributes
          },
          {
            "type": "object",
            "additionalProperties": {
              "$co": "@schema/maia-script-expression"  // ← Nested expression
            }
          }
        ]
      }
    }
  }
}
```

## Validation Rules Summary

### ✅ DO:

1. **Always specify `cotype`** - Every schema must be `comap`, `colist`, or `costream`
2. **Use `$co` for CoValue references** - References to other schemas, actors, views, etc.
3. **Use `$ref` for internal definitions** - Only within `$defs` or for self-references
4. **Include `$id` pattern validation** - Validate co-id format: `^co_z[a-zA-Z0-9]+$`
5. **Transform during seeding** - All human-readable IDs become co-ids

### ❌ DON'T:

1. **Don't use `$ref` for external schemas** - Always use `$co` instead
2. **Don't nest co-types** - Properties cannot have `cotype`, use `$co` to reference separate CoValues
3. **Don't mix `$co` and `$ref`** - Use `$co` for CoValues, `$ref` only for internal definitions
4. **Don't skip `cotype`** - Every schema/instance must specify its CoJSON type
5. **Don't use human-readable IDs at runtime** - All IDs must be co-ids after seeding

### Special Contexts: `additionalProperties` and `oneOf`

**`additionalProperties` and Dynamic Keys:**
- `additionalProperties` defines the schema for dynamic object keys
- When referencing external schemas, **use `$co`** for CoValue references
- Example: `guard.schema.json` uses `additionalProperties: true` to accept any MaiaScript expression properties

**`oneOf` and Schema Alternatives:**
- `oneOf` allows a value to match one of several schema alternatives
- Used in `action.schema.json` to support tool invocations, context updates, or data mapping
- Each alternative can use `$co` for CoValue references

**Consistency**: All schemas in the codebase consistently use `$co` for external CoValue references. Use `$ref` only for internal schema definitions within `$defs`.

## Examples from Codebase

### Action Schema
```json
{
  "$schema": "@schema/meta",
  "$id": "@schema/action",
  "title": "Action",
  "cotype": "comap",
  "properties": {
    "$id": {
      "type": "string",
      "pattern": "^co_z[a-zA-Z0-9]+$"
    },
    "tool": { "type": "string" },
    "payload": {
      "type": "object",
      "additionalProperties": {
        "$co": "@schema/maia-script-expression"  // ← Uses $co for schema reference
      }
    }
  },
  "required": ["tool"]
}
```

**Note**: The `action` schema correctly uses `$co` in `additionalProperties` to reference the expression schema. This ensures dynamic payload properties are validated against the expression schema.

### Context Schema
```json
{
  "$schema": "@schema/meta",
  "$id": "@schema/context",
  "title": "Context Definition",
  "cotype": "comap",
  "properties": {
    "$id": {
      "type": "string",
      "pattern": "^co_z[a-zA-Z0-9]+$"
    },
    "todos": {
      "type": "object",
      "properties": {
        "schema": {
          "type": "string",
          "description": "Schema reference (e.g., '@schema/todos')"
        },
        "filter": {
          "oneOf": [
            {"type": "object"},
            {"type": "null"}
          ]
        }
      },
      "required": ["schema"]
    }
  },
  "additionalProperties": {
    "anyOf": [
      {
        "type": "object",
        "properties": {
          "schema": { "type": "string" },
          "filter": { "oneOf": [{"type": "object"}, {"type": "null"}] }
        },
        "required": ["schema"]
      },
      {
        "type": ["string", "number", "boolean", "null", "array", "object"]
      }
    ]
  }
}
```

### State Schema
```json
{
  "$schema": "@schema/meta",
  "$id": "@schema/state",
  "title": "State Machine Definition",
  "cotype": "comap",
  "properties": {
    "initial": { "type": "string" },
    "states": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "entry": {
            "oneOf": [
              { "type": "object" },
              { "type": "array" },
              { "$co": "@schema/action" },  // ← CoValue reference
              {
                "type": "array",
                "items": { "$co": "@schema/action" }  // ← Array of CoValue references
              }
            ]
          },
          "on": {
            "type": "object",
            "additionalProperties": {
              "oneOf": [
                { "type": "string" },
                {
                  "type": "object",
                  "properties": {
                    "target": { "type": "string" },
                    "guard": {
                      "$co": "@schema/maia-script-expression"  // ← Expression reference
                    },
                    "actions": {
                      "type": "array",
                      "items": {
                        "oneOf": [
                          { "type": "object" },
                          { "$co": "@schema/action" }  // ← CoValue reference
                        ]
                      }
                    }
                  }
                },
                { "$co": "@schema/transition" }  // ← CoValue reference
              ]
            }
          }
        }
      }
    }
  },
  "required": ["initial", "states"]
}
```

## Summary

The MaiaOS schemata system provides:

1. **Type safety** via JSON Schema validation
2. **CoJSON integration** via `cotype` specification
3. **CoValue references** via `$co` keyword
4. **Seeding** transforms human-readable IDs to co-ids
5. **Runtime validation** resolves and validates all references
6. **Strict rules**: `$co` for CoValues, `$ref` only for internal definitions, every schema must have `cotype`

This ensures type-safe, validated, and properly referenced CoJSON data structures throughout the MaiaOS runtime.

---

# BEST PRACTICES

*Source: creators/12-best-practices.md*

# Best Practices: Actor Architecture

**Comprehensive guide to building scalable, maintainable MaiaOS applications**

## Agent-First Development

**Always create the agent service actor first when building a vibe.**

**Why?**
- **Clear Architecture** - Agent defines the app's structure and data flow
- **Data First** - Agent handles all data operations before UI concerns
- **UI Second** - UI actors receive data from agent, keeping them simple
- **Consistent Pattern** - Every vibe follows the same structure
- **AI-Friendly** - LLMs understand this pattern and can generate vibes correctly

**Development Order:**
1. ✅ **Create agent service actor** (`agent/agent.actor.maia`) - ALWAYS FIRST
2. ✅ Create vibe manifest (`manifest.vibe.maia`) - References `@actor/agent`
3. ✅ Create composite actor (`composite/composite.actor.maia`) - First UI actor
4. ✅ Create UI actors (`list/list.actor.maia`, etc.) - Leaf components

## Table of Contents

1. [State Separation Pattern](#1-state-separation-pattern)
2. [Service vs UI Actor Responsibilities](#2-service-vs-ui-actor-responsibilities)
3. [Composite/Leaf Pattern](#3-compositeleaf-pattern)
4. [Message Flow Patterns](#4-message-flow-patterns)
5. [Scalability Strategies](#5-scalability-strategies)
6. [Performance Optimization](#6-performance-optimization)
7. [Domain Separation](#7-domain-separation)
8. [Feature Modules](#8-feature-modules)
9. [Schema Definitions](#9-schema-definitions)
10. [Anti-Patterns to Avoid](#10-anti-patterns-to-avoid)
11. [Real-World Examples](#11-real-world-examples)

---

## 1. State Separation Pattern

### Principle: Co-location & Single Responsibility

**Rule of thumb:** State should be co-located with the component that renders it and uses it.

### Context Updates: State Machine as Single Source of Truth

**CRITICAL PRINCIPLE:** State machines are the **single source of truth** for all context changes.

**All context updates MUST:**
- ✅ Flow through state machines
- ✅ Use `updateContext` infrastructure action (never mutate directly)
- ✅ Be triggered by events from inbox (never directly)

**The ONLY exception:**
- ✅ Universal `read()` API automatically updates reactive query objects (infrastructure)
- ✅ Query objects use `read()` internally - returns ReactiveStore that auto-updates

**Correct Pattern:**
```json
{
  "idle": {
    "on": {
      "UPDATE_INPUT": {
        "target": "idle",
        "actions": [
          {
            "updateContext": { "newTodoText": "$$newTodoText" }
          }
        ]
      }
    }
  }
}
```

**Anti-Patterns:**
- ❌ Direct mutation: `actor.context.field = value`
- ❌ Updating from views
- ❌ Updating from tools (unless invoked by state machine)
- ❌ Setting error context directly in ToolEngine

### Event Flow: Inbox as Single Source of Truth

**CRITICAL PRINCIPLE:** Actor inbox is the **single source of truth** for ALL events.

**All events MUST flow through inbox:**
- ✅ View events → inbox → state machine
- ✅ External messages → inbox → state machine
- ✅ Tool SUCCESS/ERROR → inbox → state machine
- ✅ StateEngine.send() only called from processMessages()

**Event Flow Pattern:**
```
View Event → sendInternalEvent() → inbox → processMessages() → StateEngine.send()
Tool SUCCESS → sendInternalEvent() → inbox → processMessages() → StateEngine.send()
Tool ERROR → sendInternalEvent() → inbox → processMessages() → StateEngine.send()
```

**Why this matters:**
- **Unified Event Log:** All events appear in inbox for traceability
- **Per-Message Processed Flags:** Each message has a `processed` boolean flag (distributed CRDT-native deduplication)
- **Consistent Handling:** All events follow same path
- **Better Debugging:** Can inspect inbox to see complete event history

**Event Scoping Guarantee:**
- ✅ Events are **always scoped** to the actor that rendered the element
- ✅ The `actorId` parameter comes from the closure when the event handler was attached
- ✅ This ensures events are always routed to the correct actor's inbox

**Anti-Patterns:**
- ❌ Calling StateEngine.send() directly (bypasses inbox)
- ❌ Sending SUCCESS/ERROR directly to state machine
- ❌ Bypassing inbox for any events

### Three-Layer Architecture

#### Layer 1: Agent Service Actor (Business Logic)

**Best Practice:** Always create the agent service actor first. This is your app's orchestrator.

**Lifecycle:** Service actors **persist** throughout the vibe lifecycle - created once, destroyed only on vibe unload.

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
  "$schema": "@schema/context",
  "$id": "@context/agent",
  "composite": "@actor/composite"
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
  "$schema": "@schema/context",
  "$id": "@context/composite",
  "title": "Todo List",                    // UI presentation
  "inputPlaceholder": "Add a new todo...", // UI presentation
  "addButtonText": "Add",                  // UI presentation
  "viewMode": "list",                      // UI orchestration
  "currentView": "@actor/list",            // UI orchestration
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
  "$schema": "@schema/context",
  "$id": "@context/kanban",
  "todosTodo": [],        // Filtered data (query result)
  "todosDone": [],       // Filtered data (query result)
  "draggedItemId": null, // Component-specific UI state
  "dragOverColumn": null // Component-specific UI state
}
```

**List Actor:**
```json
{
  "$schema": "@schema/context",
  "$id": "@context/list",
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
  "$schema": "@schema/actor",
  "$id": "@actor/composite",
  "children": {
    "todos": "@actor/todos",
    "notes": "@actor/notes"
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
  "$schema": "@schema/actor",
  "$id": "@actor/agent",
  "role": "agent",
  "context": "@context/agent",
  "state": "@state/agent",
  "view": "@view/agent",
  "brand": "@style/brand",
  "inbox": "@inbox/agent"
}
```

**Note:** Always create the agent service actor first. This is your app's orchestrator.

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
  "$schema": "@schema/actor",
  "$id": "@actor/composite",
  "role": "composite",
  "context": "@context/composite",
  "view": "@view/composite",
  "state": "@state/composite",
  "brand": "@style/brand",
  "inbox": "@inbox/composite"
}
```

**Note:** Children are defined in `composite.context.maia` via `@actors` system property. See [Actors](./03-actors.md#system-properties-in-context) for details.
```

---

## 9. Schema Definitions

### Core Principles

#### Every Schema Must Have a Co-Type

**CRITICAL RULE**: Every schema or instance **must** be one of three CoJSON types:

- **`cotype: "comap"`** - CRDT map (key-value pairs with properties)
- **`cotype: "colist"`** - CRDT list (ordered array with items)
- **`cotype: "costream"`** - CRDT stream (append-only list with items)

**Example:**
```json
{
  "$schema": "@schema/meta",
  "$id": "@schema/actor",
  "title": "Actor Definition",
  "cotype": "comap",  // ← REQUIRED: Must be comap, colist, or costream
  "properties": {
    // ...
  }
}
```

#### Use `$co` for CoValue References, `$ref` Only for Internal Definitions

**CRITICAL RULE**: 
- **Use `$co`** to reference **separate CoValue entities** (other schemas, actors, views, etc.)
- **Use `$ref`** **ONLY** for internal schema definitions (within `$defs`)

**Why?**
- `$co` indicates a property value is a **co-id reference** to another CoValue
- `$ref` is for JSON Schema internal references (like `#/$defs/viewNode`)
- Never use `$ref` to reference external schemas - always use `$co`

**✅ CORRECT:**
```json
{
  "properties": {
    "context": {
      "$co": "@schema/context",  // ← References separate CoValue
      "description": "Co-id reference to context definition"
    },
    "children": {
      "type": "array",
      "items": {
        "$co": "@schema/actor"  // ← Each item is a co-id reference
      }
    }
  },
  "$defs": {
    "viewNode": {
      "type": "object",
      "properties": {
        "children": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/viewNode"  // ← OK: Internal reference
          }
        }
      }
    }
  }
}
```

**❌ WRONG:**
```json
{
  "properties": {
    "context": {
      "$ref": "@schema/context"  // ← WRONG: Use $co for CoValue references
    }
  }
}
```

### Required Schema Fields

Every schema must have:

1. **`$schema`** - Reference to meta-schema (usually `"@schema/meta"`)
2. **`$id`** - Unique schema identifier (human-readable like `"@schema/actor"` or co-id like `"co_z..."`)
3. **`title`** - Human-readable schema title
4. **`cotype`** - CoJSON type: `"comap"`, `"colist"`, or `"costream"`

### Common Schema Patterns

#### Pattern 1: Referencing Other Schemas

**Always use `$co` for schema references:**
```json
{
  "properties": {
    "view": {
      "$co": "@schema/view"  // ← Always use $co for schema references
    }
  }
}
```

#### Pattern 2: Arrays of CoValue References

**Each array item is a co-id reference:**
```json
{
  "properties": {
    "children": {
      "type": "array",
      "items": {
        "$co": "@schema/actor"  // ← Each item is a co-id reference
      }
    }
  }
}
```

#### Pattern 3: Recursive Internal Definitions

**Use `$ref` for recursive internal structures:**
```json
{
  "$defs": {
    "viewNode": {
      "type": "object",
      "properties": {
        "children": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/viewNode"  // ← OK: Internal recursive reference
          }
        }
      }
    }
  }
}
```

#### Pattern 4: Expression References

**Reference expression schemas with `$co`:**
```json
{
  "properties": {
    "text": {
      "$co": "@schema/maia-script-expression"  // ← Expression schema reference
    },
    "value": {
      "$co": "@schema/maia-script-expression"  // ← Expression schema reference
    }
  }
}
```

#### Pattern 5: Schema Composition with `allOf`

**Use `$co` in `allOf` to extend schemas:**
```json
{
  "$schema": "@schema/meta",
  "$id": "@schema/guard",
  "title": "Guard",
  "cotype": "comap",
  "properties": {
    "$id": {
      "type": "string",
      "pattern": "^co_z[a-zA-Z0-9]+$"
    }
  },
  "allOf": [
    {
      "$co": "@schema/maia-script-expression"  // ← Uses $co for schema reference
    }
  ]
}
```

#### Pattern 6: Dynamic Properties with `additionalProperties`

**Use `$co` in `additionalProperties` for dynamic keys:**
```json
{
  "properties": {
    "payload": {
      "type": "object",
      "additionalProperties": {
        "$co": "@schema/maia-script-expression"  // ← Uses $co for schema reference
      }
    }
  }
}
```

### Schema Validation Rules

#### ✅ DO:

1. **Always specify `cotype`** - Every schema must be `comap`, `colist`, or `costream`
2. **Use `$co` for CoValue references** - References to other schemas, actors, views, etc.
3. **Use `$ref` for internal definitions** - Only within `$defs` or for self-references
4. **Include `$id` pattern validation** - Validate co-id format: `^co_z[a-zA-Z0-9]+$`
5. **Transform during seeding** - All human-readable IDs become co-ids

#### ❌ DON'T:

1. **Don't use `$ref` for external schemas** - Always use `$co` instead
2. **Don't nest co-types** - Properties cannot have `cotype`, use `$co` to reference separate CoValues
3. **Don't mix `$co` and `$ref`** - Use `$co` for CoValues, `$ref` only for internal definitions
4. **Don't skip `cotype`** - Every schema/instance must specify its CoJSON type
5. **Don't use human-readable IDs at runtime** - All IDs must be co-ids after seeding

### Schema Examples

#### Example 1: Actor Schema (comap)
```json
{
  "$schema": "@schema/meta",
  "$id": "@schema/actor",
  "title": "Actor Definition",
  "cotype": "comap",
  "properties": {
    "$id": {
      "type": "string",
      "pattern": "^co_z[a-zA-Z0-9]+$"
    },
    "context": {
      "$co": "@schema/context",  // ← CoValue reference
      "description": "Co-id reference to context definition"
    },
    "view": {
      "$co": "@schema/view",  // ← CoValue reference
      "description": "Co-id reference to view definition"
    },
    "children": {
      "type": "object",
      "additionalProperties": {
        "$co": "@schema/actor"  // ← Each child is a co-id reference
      }
    }
  }
}
```

#### Example 2: Inbox Schema (costream)
```json
{
  "$schema": "@schema/meta",
  "$id": "@schema/inbox",
  "title": "Inbox CoStream",
  "cotype": "costream",  // ← Append-only stream
  "properties": {
    "$id": {
      "type": "string",
      "pattern": "^co_z[a-zA-Z0-9]+$"
    },
    "items": {
      "type": "array",
      "description": "Array of message co-id references",
      "items": {
        "$co": "@schema/message",  // ← Each item is a co-id reference
        "description": "Each item is a co-id reference to a message"
      }
    }
  },
  "required": ["items"]
}
```

#### Example 3: View Schema (comap with internal $defs)
```json
{
  "$schema": "@schema/meta",
  "$id": "@schema/view",
  "title": "View Definition",
  "cotype": "comap",
  "properties": {
    "tag": { "type": "string" },
    "text": {
      "$co": "@schema/maia-script-expression"  // ← CoValue reference
    },
    "children": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/viewNode"  // ← OK: Internal reference to $defs
      }
    }
  },
  "$defs": {
    "viewNode": {
      "type": "object",
      "properties": {
        "children": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/viewNode"  // ← OK: Recursive internal reference
          }
        }
      }
    }
  }
}
```

### Reading Schema Definitions

When reading and understanding schema definitions:

1. **Identify the Co-Type** - Check `cotype` field first to understand the data structure
2. **Follow `$co` References** - These point to separate CoValue entities that need to be resolved
3. **Understand `$ref` Scope** - These are internal to the schema, defined in `$defs`
4. **Check Required Fields** - Look for `required` array to understand mandatory properties
5. **Validate Patterns** - Check `pattern` fields for string validation rules (especially co-id patterns)

**Best Practice:** When working with schemas, always:
- Start with the `cotype` to understand the structure
- Trace `$co` references to understand relationships
- Use `$defs` for reusable internal structures
- Keep schemas focused and single-purpose

---

## 10. Anti-Patterns to Avoid

### ❌ Don't: Put UI State in Service Actor

**Bad:**
```json
{
  "$schema": "@schema/context",
  "$id": "@context/agent",
  "viewMode": "list",        // ❌ UI state in service
  "listButtonActive": true,  // ❌ UI state in service
  "newTodoText": ""          // ❌ Form state in service
}
```

**Good:**
```json
{
  "$schema": "@schema/context",
  "$id": "@context/agent",
  "composite": "@actor/composite"  // ✅ Only business logic references
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
// Service Actor Context
{
  "currentView": "@composite",  // ✅ Context property (CRDT CoValue) - references active child
  "@actors": {
    "composite": "@actor/composite"  // ✅ System property (like $schema/$id) - defines children
  }
}

// Composite Actor Context
{
  "viewMode": "list",  // ✅ Single source of truth
  "currentView": "@list",  // ✅ Context property - references active child
  "@actors": {
    "list": "@actor/list",
    "kanban": "@actor/kanban"
  }
}
```

### ❌ Don't: Create Monolithic Service Actors

**Bad:**
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/agent",
  "role": "agent",
  "state": "@state/monolithic-service"  // ❌ Everything in one service
}
```

**Good:**
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/agent",
  "role": "agent",
  "children": {
    "todos": "@actor/todos-service",    // ✅ Domain separation
    "notes": "@actor/notes-service",   // ✅ Domain separation
    "calendar": "@actor/calendar-service"  // ✅ Domain separation
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

## 11. Real-World Examples

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
- [ ] **State machines are single source of truth** - All context updates flow through state machines
- [ ] **Use `updateContext` infrastructure action** - Always update context via state machine actions
- [ ] **Handle errors in state machines** - Use ERROR event handlers to update error context

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

### ✅ Schema Definitions

- [ ] Every schema has a `cotype` (comap, colist, or costream)
- [ ] Use `$co` for CoValue references (external schemas, actors, views)
- [ ] Use `$ref` only for internal definitions (within `$defs`)
- [ ] Include required fields: `$schema`, `$id`, `title`, `cotype`
- [ ] Validate co-id patterns: `^co_z[a-zA-Z0-9]+$`
- [ ] Keep schemas focused and single-purpose

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

