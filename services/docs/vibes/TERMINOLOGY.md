# MaiaOS Terminology & Concepts

> **Living Document:** This terminology reference will evolve as the architecture matures.
> Last Updated: 2026-01-11

---

## Core Philosophy

**MaiaOS** is an operating system where everything is defined as JSON and rendered by specialized engines. No hardcoded UI, no eval(), pure declarative configuration.

---

## Architectural Layers

```
┌─────────────────────────────────────────┐
│  Vibe (App Experience Layer)            │
│  Collection of orchestrated Actors      │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Actor (Universal Atom Layer)           │
│  UI Components + Pure Services          │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  View (Tree Structure Layer)            │
│  Composites (containers) + Leafs (ends) │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  MaiaScript (Expression Language Layer) │
│  Secure JSON-based logic                │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Engine (Execution Layer)               │
│  JSON → Running System                  │
└─────────────────────────────────────────┘
```

---

## 1. Vibe Layer (App Experience)

### **Vibe**
**Definition:** A top-level application module that orchestrates a collection of Actors to create one cohesive user experience.

**Synonyms:** AppContainer, Feature Module, Domain Module

**Role:** 
- Groups related Actors together
- Defines a single "app" within MaiaOS
- Examples: "Todos" vibe, "Humans" vibe, "Vibes" vibe

**Key Characteristics:**
- Has a root Actor (entry point)
- Contains multiple child Actors
- Registered in VibesRegistry (Jazz entity)
- User switches between Vibes via navigation

**Files:**
- `services/me/src/lib/vibes/todo/createTodosActors.ts`
- `services/me/src/lib/vibes/humans/createHumansActors.ts`
- `services/me/src/lib/vibes/vibes/createVibesActors.ts`

---

## 2. Actor Layer (Universal Atoms)

### **Actor**
**Definition:** The universal atomic unit in MaiaOS. Can be a UI component (visible), a pure service (invisible), or both combined.

**Role:**
- **UI Actors:** Render visual components (buttons, lists, cards)
- **Service Actors:** Background logic (API clients, data processors)
- **Hybrid Actors:** UI + service combined

**Key Characteristics:**
- Autonomous (has own state via `context`)
- Jazz entity (stored in database)
- Has a View (CompositeNode or LeafNode)
- Can have child Actors (dependencies)
- Communicates via events/messages

**Properties:**
- `id`: Unique identifier (Jazz CoValue ID)
- `type`: Actor type (e.g., "todo.root", "human.card")
- `context`: Local state (e.g., `{ newTodoText: "", error: null }`)
- `view`: ViewNode (Composite or Leaf)
- `dependencies`: Child Actors
- `skills`: Event handlers (e.g., `@todo/create`, `@input/updateContext`)

**Examples:**
- `todosRootActor`: Root UI container for todos vibe
- `todoItemActor`: Individual todo card (UI)
- `syncServiceActor`: Background sync service (invisible)

**Files:**
- `services/me/src/lib/compositor/actors/ActorRenderer.svelte`
- `services/me/src/lib/vibes/*/createXxxActors.ts`

---

## 3. View Layer (Tree Structure)

### **ViewNode**
**Definition:** Generic tree node type. Can be either a Composite (container) or a Leaf (endpoint).

**Role:** Union type for tree structure

**In Jazz CoValue Reality:**
- Just a **relation link** to a CompositeNode or LeafNode (stored in Jazz)
- The verbose TypeScript definition below is for type safety and multiple resolution paths

**Type Definition:**
```typescript
interface ViewNode {
  slot: string;
  composite?: CompositeNode;  // Inline composite definition
  compositeId?: string;        // Reference to registered composite
  leaf?: LeafNode;             // Inline leaf definition
  leafId?: string;             // Reference to registered leaf
}

// Note: CompositeNode and LeafNode are complex structures themselves:
// - CompositeNode: { container, children[], elements[], events, bindings }
// - LeafNode: { tag, classes, attributes, elements[], events, bindings }
// Both can have multiple HTML elements (via elements[] array)
```

---

### **Composite** (Container Node)
**Definition:** A node that **can contain children**. Used for layout, grouping, and recursive nesting.

**Role:** Container/parent in the tree

**Key Characteristics:**
- **Has children** (other Composites or Leafs)
- Can be recursive (Composites inside Composites)
- Defines layout strategy (`grid`, `flex`, `content`)
- **Renders:** Container element (div, form, etc.) with classes, attributes, events
- **Delegates:** Child content rendering to children

**What Composites Render:**
- ✅ Container HTML element (`<div>`, `<form>`, etc.)
- ✅ CSS classes and attributes
- ✅ Event handlers
- ✅ Layout structure
- ✅ Multiple nested HTML elements (via `elements[]` array)
- ✅ ViewNode children (other Composites or Leafs)

**Distinction (CORRECTED):**
- ❌ NOT "layout vs content" (misleading - both can have HTML!)
- ❌ NOT "container vs content" (both can render HTML elements!)
- ✅ **Has ViewNode children vs no ViewNode children** (structural distinction)
- Both Composites and Leafs can have nested HTML via `elements[]`
- Only Composites can have ViewNode children (recursive tree structure)

**Properties:**
- `container`: Layout config (tag, class, layout type)
- `children`: Array of ViewNodes
- `foreach`: Iteration config (alternative to static children)
- `events`: Event handlers on container element
- `bindings`: Data bindings (visibility, disabled)

**Examples:**
- Root card container
- Kanban column
- Form wrapper
- Grid layout
- List container

**Files:**
- `services/me/src/lib/compositor/view/Composite.svelte` (current)
- `services/me/src/lib/factories/composites/*.json`

---

### **Leaf** (Endpoint Node)
**Definition:** A node that **cannot have ViewNode children**. The terminal/endpoint in the tree.

**Role:** Endpoint/leaf in the tree

**Key Characteristics:**
- **No ViewNode children** (tree endpoint)
- Renders HTML elements (single or nested via `elements[]`)
- Can have nested HTML structure (via `elements[]` array)
- Can iterate over data (via `bindings.foreach`)

**What Leafs Render:**
- ✅ HTML element (button, input, div, span, etc.)
- ✅ CSS classes and attributes
- ✅ Event handlers
- ✅ Multiple nested HTML elements (via `elements[]` array)
- ✅ Text content (directly or via bindings)
- ❌ NO ViewNode children (cannot contain other Composites or Leafs)

**Distinction (CORRECTED):**
- ❌ NOT "content only" (can have complex HTML structure!)
- ✅ **No ViewNode children** (structural endpoint)
- Both Composites and Leafs can have nested HTML via `elements[]`
- Only difference: Composites can have ViewNode children, Leafs cannot

**Properties:**
- `tag`: HTML element (`div`, `button`, `input`, etc.)
- `classes`: Tailwind CSS classes
- `attributes`: HTML attributes
- `elements`: Nested HTML (NOT ViewNodes)
- `bindings`: Data bindings (value, text, class, visible, disabled)
- `events`: Event handlers

**Examples:**
- Button
- Input field
- Text span
- Icon
- Badge
- Checkbox

**Files:**
- `services/me/src/lib/compositor/view/Leaf.svelte` (current)
- `services/me/src/lib/factories/leafs/*.json`

---

## 4. Factory System (Template Generation)

### **Factory**
**Definition:** A JSON template that generates ViewNodes at runtime by substituting parameters.

**Role:** Parameterized blueprint for reusable components

**Key Characteristics:**
- Pure JSON (no TypeScript)
- Contains `{{placeholders}}` for parameters
- Can have conditionals (regular `$if`, `$switch` MaiaScript operations)
- Loaded by FactoryEngine

**Structure:**
```json
{
  "$schema": "composite-factory",
  "parameters": {
    "text": { "type": "string", "required": true },
    "classes": { "type": "string", "default": "..." }
  },
  "factory": {
    "container": { ... },
    "children": [ ... ]
  }
}
```

**Examples:**
- `header.factory.json`: Reusable header component
- `button.factory.json`: Parameterized button
- `kanban.factory.json`: Kanban board with 3 columns

**Files:**
- `services/me/src/lib/factories/composites/*.json`
- `services/me/src/lib/factories/leafs/*.json`

---

### **FactoryEngine** (Renamed from "Universal Factory")
**Definition:** The engine that interprets Factory JSON and outputs ViewNodes.

**Role:** JSON → ViewNode transformer

**Key Responsibilities:**
- Load Factory JSON
- Validate parameters
- Substitute `{{placeholders}}`
- Delegate to DSLEngine for conditionals (regular `$if`, `$switch`)
- Return fully resolved ViewNode

**Architecture Decision:**
- **Factory conditionals reuse core MaiaScript operations** (no special operations needed)
- FactoryEngine delegates to MaiaScriptEngine for `$if`/`$switch` evaluation
- Same operations, different timing (factory-load vs runtime)
- All `$` operations managed by MaiaScript modules

**API:**
```typescript
createComposite(factoryDef, params): CompositeNode
createLeaf(factoryDef, params): LeafNode
```

**Files:**
- `services/me/src/lib/factories/runtime/universal-factory.ts` → Rename to `factory-engine.ts`

---

### **Factory Conditional**
**Definition:** Regular MaiaScript operations (`$if`, `$switch`) evaluated at factory-load time instead of runtime.

**Role:** Template branching during factory expansion

**Architecture:**
- **No special operations needed** - reuses core MaiaScript (`$if`, `$switch`)
- Evaluated during factory loading by MaiaScriptEngine (not at render time)
- Same evaluator as runtime MaiaScript (unified system)
- Different timing, same operations

**Key Insight:**
- ❌ NOT separate `$factoryIf`/`$factorySwitch` operations
- ✅ Just `$if`/`$switch` used at factory-load time (before rendering)

**Example:**
```json
{
  "$if": {
    "test": { "$eq": ["{{variant}}", "primary"] },
    "then": { "classes": "bg-blue-500" },
    "else": { "classes": "bg-gray-500" }
  }
}
```

**Note:** Same `$if` operation as runtime, just evaluated at different time.

**Distinction from Runtime MaiaScript:**
- **Factory-level:** Evaluated once during factory loading (before rendering)
- **Runtime-level:** Evaluated every time data changes (reactive during render)

---

## 5. MaiaScript Layer (Expression Language)

### **MaiaScript** (Domain Specific Language)
**Definition:** MaiaOS's secure JSON-based expression language for runtime logic.

**Role:** Safe alternative to `eval()` / `new Function()`

**Technical Name:** DSL (Domain Specific Language)

**Alternative Names:**
- **Expression Language**
- **JSON Logic**
- **Secure Expressions**

**Brand Identity:** MaiaScript is the official name for MaiaOS's expression language

**Key Characteristics:**
- Pure JSON syntax
- No code execution (sandboxed)
- Whitelisted operations only
- Prefix: `$` for operations

**Example:**
```json
{
  "$if": {
    "test": { "$eq": [{ "$": "item.status" }, "done"] },
    "then": "bg-green-100",
    "else": "bg-gray-100"
  }
}
```

---

### **MaiaScript Expression**
**Definition:** A JSON object representing a computation or logic operation.

**Role:** Individual unit of runtime logic

**Types:**
- **Data Access:** `{ "$": "item.name" }`
- **Comparison:** `{ "$eq": [a, b] }`
- **Logical:** `{ "$and": [...] }`
- **Control Flow:** `{ "$if": {...} }`
- **String:** `{ "$concat": [...] }`
- **Date:** `{ "$formatDate": [...] }`

**Files:**
- `services/me/src/lib/compositor/dsl/types.ts`

---

### **MaiaScript Operation**
**Definition:** A single primitive function in MaiaScript (e.g., `$eq`, `$if`, `$formatDate`).

**Role:** Atomic MaiaScript function

**Structure:**
```typescript
interface MaiaScriptOperation {
  name: string;
  evaluate: (args: any[], ctx: EvaluationContext) => unknown;
  validate?: (args: any[]) => ValidationResult;
}
```

**Examples:**
- `$eq`: Equality comparison
- `$formatDate`: Date formatting
- `$concat`: String concatenation

---

### **MaiaScriptEngine** (Evaluation Engine)
**Definition:** The sandboxed interpreter that executes MaiaScript expressions safely.

**Alternative Names:** MaiaScript Evaluator, Expression Engine

**Technical Name:** DSLEngine (legacy code reference)

**Role:** MaiaScript JSON → Computed values (secure execution engine)

**Key Responsibilities:**
- Parse MaiaScript expression JSON
- Validate against whitelist
- Execute in sandboxed context
- Return computed result

**Fits Engine Pattern:**
- ✅ Takes JSON MaiaScript input
- ✅ Outputs entities (computed values)
- ✅ Named `MaiaScriptEngine` for brand consistency

**Files:**
- `services/me/src/lib/compositor/dsl/evaluator.ts` (contains MaiaScriptEngine logic)
- Export as `MaiaScriptEngine` or keep internal name as `evaluate()` function

---

### **MaiaScript Validator**
**Definition:** Security checker that validates MaiaScript expressions before evaluation.

**Role:** Pre-execution security gate

**Key Responsibilities:**
- Check for forbidden operations
- Validate data path roots (`item`, `context`, `dependencies`)
- Prevent prototype pollution
- Block unsafe property access

**Files:**
- `services/me/src/lib/compositor/dsl/validator.ts`

---

### **MaiaScript Module**
**Definition:** A pluggable extension that adds new operations to MaiaScript.

**Role:** Extends MaiaScript with domain-specific features

**Structure:**
```typescript
interface MaiaScriptModule {
  name: string;
  version: string;
  operations: Record<string, MaiaScriptOperation>;
}
```

**Examples:**
- **Builtin Module:** Core operations (`$eq`, `$if`, etc.)
- **DragDrop Module:** Drag-drop operations (future)
- **Security Module:** Validation operations (future)

**Files:**
- `services/me/src/lib/compositor/dsl/modules/` (planned)

---

### **MaiaScript Module Registry**
**Definition:** Central registry for discovering and loading MaiaScript modules.

**Role:** Plugin discovery system

**API:**
```typescript
register(module: MaiaScriptModule): void
getOperation(name: string): MaiaScriptOperation | undefined
listModules(): MaiaScriptModule[]
```

**Files:**
- `services/me/src/lib/compositor/dsl/modules/registry.ts` (planned)

---

## 6. Engine Layer (Execution)

### **Engine Pattern**
**Definition:** A component that takes JSON config and transforms it into running entities.

**Role:** JSON → Execution transformer

**Naming Convention:** `*Engine` suffix

**Core Principle:** Anything that takes JSON and outputs entities is an Engine.

**All Engines:**

#### **ActorEngine** ✅ Implemented
- **Input:** Actor ID (Jazz CoValue)
- **Output:** Rendered DOM + reactive state + message processing
- **File:** `services/me/src/lib/compositor/engines/ActorEngine.svelte`
- **Role:** Actor orchestration, query resolution, message processing, view rendering

#### **ToolEngine** ✅ Implemented
- **Input:** Tool ID + Payload (with MaiaScript)
- **Output:** Executed business logic
- **File:** `services/me/src/lib/compositor/engines/ToolEngine.ts`
- **Role:** Tool execution with MaiaScript DSL payload evaluation and security

#### **ViewEngine** ✅ Implemented
- **Input:** ViewNode JSON (Composite or Leaf)
- **Output:** Rendered HTML elements + event bindings
- **File:** `services/me/src/lib/compositor/engines/ViewEngine.svelte`
- **Role:** Unified Composite + Leaf rendering with data bindings

#### **factoryEngine** ✅ Implemented
- **Input:** Factory JSON + parameters
- **Output:** Resolved ViewNode (template expansion)
- **File:** `services/me/src/lib/compositor/engines/factoryEngine.ts`
- **Role:** Factory template expansion with conditionals

#### **queryEngine** ✅ Implemented
- **Input:** Schema name + query options
- **Output:** Reactive entity list (plain objects)
- **File:** `services/me/src/lib/compositor/engines/queryEngine.svelte.ts`
- **Role:** Jazz-native reactive entity queries

#### **seedingEngine** ✅ Implemented
- **Input:** Vibe name
- **Output:** Actor tree (seeded in Jazz)
- **File:** `services/me/src/lib/compositor/engines/seedingEngine.ts`
- **Role:** Vibe initialization and actor tree creation

**See:** [Engine Architecture](./ENGINE_ARCHITECTURE.md) for complete documentation.

---

## 7. Tool System (Business Logic)

### **Tool** (Renamed from "Skill")
**Definition:** Reusable business logic function with metadata and execute function.

**Alternative Names:** Action, Skill (legacy)

**Role:** Executes business logic, mutates Jazz CoValues

**Structure:**
```typescript
interface Tool {
  metadata: ToolMetadata
  execute: ToolFunction
}

type ToolFunction = (
  actor: any,            // Actor reference
  payload?: unknown,     // Event payload
  accountCoState?: any   // Jazz account
) => void | Promise<void>
```

**Categories:**
- `@core/*` - Generic CRUD and database operations
- `@context/*` - UI state and context management
- `@ai/*` - AI and LLM interactions
- `@human/*` - Domain-specific convenience tools

**Examples:**
- `@core/createEntity` - Create any entity
- `@core/updateEntity` - Update any entity
- `@context/update` - Update actor context
- `@context/swapActors` - Swap actor IDs for view switching

**See:** [Tools System](./skills/README.md) for complete documentation.

---

### **Tool Module**
**Definition:** A pluggable extension that groups related tools together.

**Role:** Tool organization and discovery

**Structure:**
```typescript
interface ToolModule {
  name: string              // Module name (e.g., 'core')
  version: string           // Version (e.g., '1.0.0')
  builtin?: boolean         // True for core modules
  tools: Record<string, Tool>  // Tool registry
}
```

**Built-in Modules:**
- `core` - Generic CRUD and database operations (10 tools)
- `context` - UI state and context management (9 tools)

**Optional Modules:**
- `ai` - AI interactions (1 tool)
- `human` - Domain-specific tools (1 tool)

**Files:**
- `services/me/src/lib/compositor/tools/core.module.ts`
- `services/me/src/lib/compositor/tools/context.module.ts`
- `services/me/src/lib/compositor/tools/ai.module.ts`
- `services/me/src/lib/compositor/tools/human.module.ts`

---

### **Tool Module Registry**
**Definition:** Central registry for discovering and loading tool modules.

**Role:** Tool lookup and module management

**API:**
```typescript
interface ToolModuleRegistry {
  register(module: ToolModule): void
  get(moduleName: string): ToolModule | undefined
  getAll(): ToolModule[]
  getTool(toolId: string): Tool | undefined
}
```

**Usage:**
```typescript
import { toolModuleRegistry } from '$lib/compositor/tools'

// Register custom module
toolModuleRegistry.register(myAppModule)

// Get tool
const tool = toolModuleRegistry.getTool('@core/createEntity')
```

**File:** `services/me/src/lib/compositor/tools/module-registry.ts`

---

## 8. Data & Context

### **Context**
**Definition:** Actor's local transient state (UI state, form values, loading flags).

**Role:** Per-actor mutable state

**Examples:**
- `context.newTodoText`: Current input value
- `context.error`: Error message
- `context.isDragging`: Drag state

**Scope:** Accessible in MaiaScript via `{ "$": "context.propertyName" }`

---

### **Dependencies**
**Definition:** Child Actors that belong to a parent Actor.

**Role:** Actor tree structure (parent-child relationships)

**Examples:**
- `todosRootActor.dependencies = [headerActor, inputActor, listActor]`

**Note:** Keep term "dependencies" (user preference)

**Scope:** Accessible in MaiaScript via `{ "$": "dependencies[0].context.value" }` (if needed)

---

### **Item**
**Definition:** Current iteration variable in `foreach` loops.

**Role:** Loop context variable

**Examples:**
- `foreach.items = "data.todos"` → each iteration has `item = oneTodo`
- Accessible via `{ "$": "item.name" }`

**Scope:** Only available inside `foreach` templates

---

### **Data Path**
**Definition:** Dot-notation string for accessing nested properties (e.g., `"item.status"`, `"context.newTodoText"`).

**Role:** Property accessor syntax

**Rules:**
- Must start with allowed root: `item`, `context`, or `dependencies`
- Supports nested access: `item.nested.property`
- Prevents prototype pollution: blocks `__proto__`, `constructor`, `prototype`

---

### **Evaluation Context**
**Definition:** The data scope available to MaiaScript expressions during evaluation.

**Structure:**
```typescript
interface EvaluationContext {
  item?: Record<string, unknown>;
  context?: Record<string, unknown>;
  dependencies?: Record<string, unknown>;
}
```

**Role:** MaiaScript execution scope

---

## 9. Binding & Events

### **Binding**
**Definition:** Reactive connection from data to UI (one-way: data → UI).

**Role:** Declarative data display

**Types:**
- `value`: Input value binding
- `text`: Text content binding
- `class`: Dynamic CSS classes
- `visible`: Show/hide element
- `disabled`: Enable/disable state

**Example:**
```json
{
  "bindings": {
    "text": { "$": "item.name" },
    "class": { "$if": {...} }
  }
}
```

---

### **Binding Resolver**
**Definition:** Module that evaluates bindings to concrete values.

**Role:** Binding → Value transformer

**Responsibilities:**
- Resolve data paths
- Evaluate MaiaScript expressions
- Return primitive values (strings, booleans, numbers)

**Files:**
- `services/me/src/lib/compositor/view/binding-resolver.ts` (planned)

---

### **Event Config**
**Definition:** Declaration of an event (name + payload) that should be triggered on user interaction.

**Role:** DOM event → Actor message mapping

**Structure:**
```json
{
  "events": {
    "click": {
      "event": "@todo/delete",
      "payload": { "id": "item.id" }
    }
  }
}
```

---

### **Event Handler**
**Definition:** Module that creates DOM event listeners from Event Configs.

**Role:** EventConfig → DOM listener transformer

**Responsibilities:**
- Resolve payload (data paths → values)
- Create event listener function
- Call actor's `onEvent` callback

**Files:**
- `services/me/src/lib/compositor/view/event-handler.ts` (planned)

---

### **Payload**
**Definition:** Data sent with an event to the actor's skill handler.

**Role:** Event context/arguments

**Types:**
- **Static:** `{ "status": "done" }`
- **Dynamic:** `{ "id": "item.id" }` (resolved at runtime)
- **Mixed:** `{ "status": "done", "id": "item.id" }`

---

## 10. Security

### **Security Rules** (Renamed from "Whitelist")
**Definition:** JSON configuration defining allowed tags, classes, and attributes.

**Role:** Security policy for untrusted JSON

**Structure:**
```json
{
  "allowedTags": ["div", "span", "button", ...],
  "allowedClassPatterns": [
    "^(p|m|px|py)-\\d+$",
    "^bg-(slate|gray|...)-\\d+$"
  ],
  "blockedPatterns": ["javascript:", "on\\w+\\s*="]
}
```

**Note:** "Whitelist" → "AllowList" or "Security Rules" (inclusive language)

**Files:**
- `services/me/src/lib/compositor/view/whitelist.ts` → Deprecate/rename
- `services/me/src/lib/compositor/dsl/modules/security.rules.json` (planned)

---

### **Security Module**
**Definition:** MaiaScript module that provides validation operations.

**Role:** Pluggable security validation

**Operations:**
- `$validateTag(tag)`: Check if tag is allowed
- `$validateClass(class)`: Check if class is safe
- `$validateAttribute(attr, value)`: Check if attribute is safe

**Files:**
- `services/me/src/lib/compositor/dsl/modules/security.module.ts` (planned)

---

## 11. Schema System (Advanced)

### **Schema**
**Definition:** Reusable design system component with type-validated parameters.

**Role:** Design system template (more rigid than Factory)

**Distinction from Factory:**
- **Schema:** Design system (static, immutable, type-validated)
- **Factory:** Dynamic template (runtime parameters, flexible)

**Example:**
```json
{
  "@schema": "design-system.button",
  "parameters": {
    "text": "data.submitLabel",
    "variant": "primary"
  }
}
```

**Files:**
- `services/me/src/lib/compositor/view/schema-resolver.ts`

**Note:** Keep Schema + Factory as separate concepts (user preference)

---

## Naming Conventions Summary

### Engines (JSON MaiaScript → Entities)
- `ActorEngine` (Actor JSON → Rendered DOM + state)
- `ViewEngine` (ViewNode JSON → HTML elements)
- `FactoryEngine` (Factory JSON → Resolved ViewNodes)
- `MaiaScriptEngine` (MaiaScript expression JSON → Computed values)

### Modules (Pluggable Extensions)
- `MaiaScript Module` (extends MaiaScript operations)
- `Binding Resolver` (resolves bindings)
- `Event Handler` (handles events)

### Data Structures (JSON Configs)
- `Actor` (universal atom)
- `ViewNode` (tree node)
- `Composite` (container node)
- `Leaf` (endpoint node)
- `Factory` (template)
- `MaiaScript Expression` (runtime logic)

---

## Glossary (Alphabetical)

| Term | Layer | Definition |
|------|-------|------------|
| **Actor** | Core | Universal atom (UI or service) |
| **ActorEngine** | Engine | Orchestrates actors, messages, queries, rendering |
| **Binding** | Data | Reactive data → UI connection |
| **Binding Resolver** | Module | Evaluates bindings to values |
| **Composite** | View | Container node with children |
| **Context** | Data | Actor's local state |
| **Data Path** | Data | Dot-notation property accessor |
| **Dependencies** | Data | Child Actors |
| **Event Config** | Data | Event declaration (name + payload) |
| **Event Handler** | Module | Creates DOM event listeners |
| **Factory** | Data | JSON template for ViewNodes |
| **Factory Conditional** | Data | Compile-time template branching |
| **factoryEngine** | Engine | Factory template expansion with conditionals |
| **Item** | Data | Loop variable in `foreach` |
| **Leaf** | View | Endpoint node (no children) |
| **MaiaScript** | Core | Secure JSON expression language (DSL) |
| **MaiaScript Expression** | Data | Single MaiaScript computation |
| **MaiaScript Module** | Module | Pluggable MaiaScript extension |
| **MaiaScript Operation** | Data | Atomic MaiaScript function |
| **Payload** | Data | Event arguments/context |
| **queryEngine** | Engine | Jazz-native reactive entity queries |
| **Schema** | Advanced | Design system component |
| **Security Rules** | Security | Allowed tags/classes/attributes |
| **seedingEngine** | Engine | Vibe initialization and actor tree creation |
| **Tool** | Core | Reusable business logic function (renamed from Skill) |
| **Tool Module** | Module | Group of related tools |
| **ToolEngine** | Engine | Executes tools with MaiaScript DSL evaluation |
| **Tool Module Registry** | Module | Central registry for tool discovery |
| **Vibe** | Core | App experience (orchestrated Actors) |
| **ViewEngine** | Engine | Unified Composite+Leaf renderer |
| **ViewNode** | View | Generic tree node (Composite or Leaf) |

---

## Decisions Made

### Resolved Decisions

1. **Factory Conditionals Reuse Core MaiaScript:** ✅ YES
   - Factory conditionals just use regular `$if` and `$switch` operations
   - No special `$factoryIf`/`$factorySwitch` operations needed
   - Managed by MaiaScriptEngine (unified system)
   - Same operations, different evaluation timing (factory-load vs runtime)

2. **ActorRenderer → ActorEngine:** ✅ YES
   - Rename: `ActorRenderer.svelte` → `ActorEngine.svelte`
   - Consistent with Engine pattern
   - Clear role: Actor JSON → Running system

3. **Universal Factory → FactoryEngine:** ✅ YES
   - Rename: `universal-factory.ts` → `factory-engine.ts`
   - Consistent with Engine pattern
   - More descriptive name

4. **Rebranding: DSL → MaiaScript:** ✅ YES
   - Official Name: **MaiaScript** (branded, user-facing)
   - Technical Name: DSL (Domain Specific Language) for code/docs
   - Engine Rename: `DSLEngine` → `MaiaScriptEngine`
   - Fits Engine pattern: MaiaScript JSON → Computed values
   - File: `evaluator.ts` (internal name can stay)

---

## References

- [Architecture Summary](./ARCHITECTURE_SUMMARY.md)
- [Engine Architecture](./ENGINE_ARCHITECTURE.md) ⭐ NEW
- [MaiaScript DSL](./MAIASCRIPT_DSL.md) ⭐ NEW
- [Factory System](./FACTORY_SYSTEM.md) ⭐ NEW
- [Context Architecture](./CONTEXT_ARCHITECTURE.md)
- [Tools System](./skills/README.md)
- [Vibes Overview](./vibes/README.md)
- [Actors Documentation](./actors/README.md)
- [View System](./view/README.md)
- [Jazz Integration](./jazz/README.md)

---

**Document Status:** Living Document
**Next Review:** After Phase 1 completion
**Maintainer:** Architecture Team
