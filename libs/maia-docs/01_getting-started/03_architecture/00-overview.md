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
