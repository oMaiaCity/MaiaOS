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
