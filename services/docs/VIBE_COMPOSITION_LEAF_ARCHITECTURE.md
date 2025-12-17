# Vibe/Composition/Leaf Architecture

## ✅ Architecture Status: **PRODUCTION READY**

This document provides comprehensive documentation for the Vibe/Composition/Leaf architecture - a fully generic, JSON-driven UI system that enables building sophisticated applications entirely from configuration.

---

## 📐 Architecture Overview

The Vibe/Composition/Leaf architecture is a multi-layer system for building reactive, data-driven UIs with reusable design system components:

```
┌─────────────────────────────────────────────────────┐
│           VIBE (Application Layer)                  │
│  - State Machine Configuration                      │
│  - View Configuration                               │
│  - Skills Registry                                  │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│        SCHEMA (Design System Layer)                 │
│  - Reusable UI Component Definitions                │
│  - Parameter Schemas (Full JSON Schema)             │
│  - Leaf Schemas (Buttons, Inputs, Headers)          │
│  - Composite Schemas (Cards, Modals, Layouts)       │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│        COMPOSITE (Layout Layer)                      │
│  - Grid/Flex/Content layouts                        │
│  - Container styles                                 │
│  - Child positioning                                │
│  - Schema Instances (@schema + parameters)          │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│          LEAF (Content Layer)                       │
│  - JSON-driven UI definitions                       │
│  - Data bindings                                    │
│  - Event handlers                                   │
│  - Schema Instances (@schema + parameters)          │
│  - Fully generic, no hardcoded logic                │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│        PRE-RENDER LAYER (Schema Resolution)         │
│  - Resolves @schema references to definitions       │
│  - Validates & merges parameters with defaults      │
│  - Replaces placeholders ({{paramName}})            │
│  - Outputs pure LeafNode/CompositeConfig            │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│        RENDER ENGINE (Svelte Components)            │
│  - Leaf.svelte (renders LeafNode)                   │
│  - Composite.svelte (renders CompositeConfig)       │
│  - Schema-agnostic (never sees @schema)             │
│  - Pure reactivity & DOM generation                 │
└─────────────────────────────────────────────────────┘
```

### Key Principles

1. **100% JSON-Driven**: UI structure and behavior defined entirely in JSON
2. **Schema-Driven Design System**: Reusable UI components defined as schemas with parameterized data paths
3. **Full JSON Schema Compliance**: Parameter contracts use full JSON Schema specification (type, properties, required, default, description, etc.)
4. **Separation of Concerns**: Schema Definitions → Schema Instances → Pre-Render Resolution → Render Engine
5. **Fully Generic**: No hardcoded entity-specific logic (e.g., no `todoId`, just `id`)
6. **Security-First**: Whitelist-based validation for untrusted AI-generated configs
7. **Reactive**: Built on Svelte's reactivity system
8. **Modular**: Composable composites and reusable leaf nodes
9. **Pure Tailwind**: All styling via Tailwind classes (strings), no inline styles
10. **Pure Composition**: `Composite.svelte` handles only slot management and recursive rendering
11. **Container-Query Based**: Leaves adapt to their parent composite container size using container queries (`@md:`, `@lg:`, etc.), not viewport media queries
12. **Pre-Render Schema Resolution**: Schemas are resolved before rendering - render engine is schema-agnostic

---

## 🎨 Pure Tailwind Architecture

### Design Philosophy

The composite engine follows a **pure Tailwind approach** where:

1. **All styling is in Tailwind classes** - No inline styles, no custom style parsing
2. **Classes are strings** - Space-separated strings, never arrays
3. **Composite is pure composition** - `Composite.svelte` only handles slot management and recursive rendering
4. **Styling is delegated** - Styling lives in `leaf.classes` and `composite.container.class`

### Why Pure Tailwind?

- **Consistency**: All styling follows the same pattern
- **Security**: Tailwind classes are validated via whitelist
- **Performance**: No runtime style computation
- **Simplicity**: No wrapper divs or complex style logic in components
- **Maintainability**: All styling visible in config files

---

## 🎨 Schema-Driven Design System Architecture

### Overview

The Schema-Driven Design System enables true component reusability by separating **generic UI component definitions** (Schemas) from **specific data-bound instances** (Schema Instances). This architecture allows you to:

- Define reusable UI components once with parameterized placeholders
- Create multiple instances with different data paths and configurations
- Maintain a centralized design system that can be loaded from a database (future: CoValue-based)
- Ensure full JSON Schema compliance for parameter validation

### Architecture Layers

```
┌────────────────────────────────────────────────────────┐
│  1. SCHEMA DEFINITIONS (Design System Registry)        │
│     - Stored in hardcoded registry (future: CoValues)  │
│     - Contains: definition + parameterSchema           │
│     - Types: "Leaf" or "Composite"                     │
│     - Examples: design-system.title,                   │
│                 design-system.header,                  │
│                 design-system.inputForm                │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  2. SCHEMA INSTANCES (Vibe Configurations)             │
│     - References schema via @schema property           │
│     - Provides concrete values via parameters          │
│     - Example: { "@schema": "design-system.title",    │
│                  "parameters": { "text": "data...." } }│
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  3. PRE-RENDER LAYER (schema-resolver.ts)              │
│     - Loads schema definition from registry            │
│     - Validates parameters against JSON Schema         │
│     - Merges defaults from parameterSchema             │
│     - Replaces placeholders: {{param}} → value         │
│     - Outputs pure LeafNode or CompositeConfig         │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  4. RENDER ENGINE (Leaf.svelte, Composite.svelte)      │
│     - Schema-agnostic (never sees @schema)             │
│     - Receives pure LeafNode/CompositeConfig           │
│     - Handles bindings, events, reactivity             │
│     - Renders to DOM                                   │
└────────────────────────────────────────────────────────┘
```

### Schema Definition Structure

A schema definition includes:
1. **type**: `"Leaf"` or `"Composite"` (extends schema meta-schema)
2. **name**: Unique schema identifier (e.g., `"design-system.title"`)
3. **definition**: The LeafNode or CompositeConfig structure with placeholders
4. **parameterSchema**: Full JSON Schema for parameter validation

```typescript
// Example: Title Leaf Schema
export const titleSchemaDefinition: any = {
  type: 'Leaf',
  name: 'design-system.title',
  
  // LeafNode structure with placeholders
  definition: {
    tag: 'div',
    classes: 'text-center mb-3 flex items-center justify-center gap-3',
    children: [
      {
        tag: 'h1',
        classes: 'text-3xl font-bold text-slate-900',
        bindings: { 
          text: '{{text}}' // Placeholder - replaced at resolution time
        },
      },
    ],
  },
  
  // Full JSON Schema for parameters
  parameterSchema: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'Data path to title text (e.g., "data.queries.title")',
        default: 'data.queries.title',
      },
    },
    required: ['text'],
    additionalProperties: false,
  },
}
```

### Schema Instance Usage

Create instances by referencing the schema and providing parameters:

```typescript
// In your vibe configuration
export const titleLeaf: LeafNode = {
  id: 'todo.leaf.title',
  '@schema': 'design-system.title', // Reference to schema
  parameters: {
    text: 'data.queries.title', // Concrete data path
  },
}

// After pre-render resolution, this becomes:
// {
//   id: 'todo.leaf.title',
//   tag: 'div',
//   classes: 'text-center mb-3 flex items-center justify-center gap-3',
//   children: [
//     {
//       tag: 'h1',
//       classes: 'text-3xl font-bold text-slate-900',
//       bindings: { text: 'data.queries.title' }, // Placeholder replaced!
//     },
//   ],
// }
```

### Composite Schemas

Composites can also be schemas, enabling reusable layout patterns:

```typescript
// Example: Header Composite Schema
export const headerSchemaDefinition: any = {
  type: 'Composite',
  name: 'design-system.header',
  
  definition: {
    container: {
      layout: 'content',
      class: 'w-full p-0 bg-transparent sticky top-0 z-10',
    },
    children: [
      {
        slot: 'title',
        leaf: {
          '@schema': 'design-system.title', // Nested schema reference
          parameters: {
            text: '{{titleText}}', // Nested placeholder
          },
        },
      },
      {
        slot: 'viewButtons',
        leaf: {
          '@schema': 'design-system.viewButtons',
          parameters: {
            viewModePath: '{{viewModePath}}',
            setViewEvent: '{{setViewEvent}}',
          },
        },
      },
    ],
  },
  
  parameterSchema: {
    type: 'object',
    properties: {
      titleText: {
        type: 'string',
        description: 'Data path to title text',
        default: 'data.queries.title',
      },
      viewModePath: {
        type: 'string',
        description: 'Data path to view mode',
        default: 'data.view.viewMode',
      },
      setViewEvent: {
        type: 'string',
        description: 'Event name for view changes',
        default: 'SET_VIEW',
      },
    },
    required: [],
    additionalProperties: false,
  },
}

// Usage in vibe config
export const headerComposite: CompositeConfig = {
  id: 'todo.composite.header',
  '@schema': 'design-system.header',
  parameters: {
    titleText: 'data.queries.title',
    setViewEvent: 'SET_VIEW',
  },
}
```

### Nested Schema Resolution

The pre-render layer correctly handles nested schema references:

1. **Outer schema resolved first**: `design-system.header` → CompositeConfig
2. **Nested schemas preserved**: Children with `@schema` kept intact
3. **Composite.svelte resolves nested**: Passes nested schemas through `resolveSchemaLeaf`
4. **Clean separation**: Each layer only resolves its own level

```typescript
// schema-resolver.ts - Only strips @schema at top level
function replacePlaceholders(obj: any, isTopLevel = true): any {
  if (obj && typeof obj === 'object') {
    const result: any = {}
    for (const [key, value] of Object.entries(obj)) {
      // Only skip @schema and parameters at TOP LEVEL
      // Preserve them in nested children for later resolution
      if (isTopLevel && (key === '@schema' || key === 'parameters')) {
        continue
      }
      result[key] = replacePlaceholders(value, false)
    }
    return result
  }
  return obj
}
```

### Full JSON Schema Compliance

Parameter schemas must be **full JSON Schema** compliant:

```typescript
// ✅ CORRECT - Full JSON Schema
parameterSchema: {
  type: 'object',
  properties: {
    text: {
      type: 'string',
      description: 'Data path to title text',
      default: 'data.queries.title',
    },
    visible: {
      type: 'string',
      description: 'Data path for visibility',
      default: 'data.view.showTitle',
    },
  },
  required: ['text'],
  additionalProperties: false,
}

// ❌ WRONG - Not JSON Schema compliant
_templateSchema: { // Wrong property name
  text: {
    type: 'string',
    required: true, // Wrong location - should be in parent 'required' array
  }
}
```

### Design System Registry

Schemas are registered in a centralized hardcoded registry (future: CoValue-based):

```typescript
// libs/hominio-db/src/schemas/schema-registry.ts
import { leafTypeSchemas } from './data/leaf-types.js'
import { compositeTypeSchemas } from './data/composite-types.js'

const schemaRegistry: Record<string, any> = {
  // Entity schemas
  Human: humanEntityTypeSchema,
  Todo: todoEntityTypeSchema,
  
  // Design system schemas
  ...leafTypeSchemas,      // All leaf schemas
  ...compositeTypeSchemas, // All composite schemas
}
```

```typescript
// services/me/src/lib/vibes/design-system/index.ts
import { registerJsonSchema } from '@hominio/db'
import { titleSchemaDefinition, headerSchemaDefinition, ... } from './schemas'

export function registerDesignSystemSchemas() {
  // Leaf schemas
  registerJsonSchema('design-system.title', titleSchemaDefinition)
  registerJsonSchema('design-system.error', errorSchemaDefinition)
  registerJsonSchema('design-system.inputForm', inputFormSchemaDefinition)
  
  // Composite schemas
  registerJsonSchema('design-system.header', headerSchemaDefinition)
  registerJsonSchema('design-system.modal', modalSchemaDefinition)
  registerJsonSchema('design-system.rootCard', rootCardSchemaDefinition)
}

// Auto-register on import (side effect)
registerDesignSystemSchemas()
```

### Schema Types Extended

The schema type system now includes `"Leaf"` and `"Composite"`:

```typescript
// libs/hominio-db/src/schemas/schema-meta-schema.ts
export const SchemaMetaSchema = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['Entity', 'Relation', 'Leaf', 'Composite'], // Extended!
    },
    name: { type: 'string' },
    definition: { type: 'object' },
    parameterSchema: { type: 'object' }, // Full JSON Schema
  },
  required: ['name', 'definition', 'type'],
}
```

### Future: CoValue-Based Schemas

Currently, schemas are hardcoded in the registry. The future architecture will store them as CoValues:

```typescript
// Future: Schema stored as CoValue
const titleSchema = await ensureSchema(me, {
  type: 'Leaf',
  name: 'design-system.title',
  definition: { /* LeafNode */ },
  parameterSchema: { /* JSON Schema */ },
})

// Future: Instance references CoValue
export const titleLeaf: LeafNode = {
  id: 'todo.leaf.title',
  '@schema': titleSchema.id, // CoValue reference
  parameters: {
    text: 'data.queries.title',
  },
}
```

### Benefits of Schema-Driven Architecture

1. **True Reusability**: Define once, use everywhere with different data
2. **Type Safety**: Full JSON Schema validation for parameters
3. **Centralized Design System**: All UI components in one registry
4. **Database-Ready**: Can load entire design system from database
5. **AI-Friendly**: Schemas can be generated by AI with full validation
6. **Maintainability**: Update schema definition once, affects all instances
7. **Testability**: Schema definitions can be unit tested independently

---

## 🎯 Core Concepts

### Vibe

A **Vibe** is a complete application configuration that combines:
- **State Machine**: Defines application state, transitions, and actions
- **View**: Defines the UI structure using Composite/Leaf pattern
- **Skills**: Reusable action functions (loaded from registry)

```typescript
interface VibeConfig {
  stateMachine: StateMachineConfig;
  view: ViewConfig;
  actions?: Record<string, Action>; // Optional: override registry
}
```

### Composite

A **Composite** is a pure container node that:
- Contains child nodes (other composites or leaves)
- Pure composition: Only handles slot management and recursive rendering
- All styling via `container.class` (Tailwind classes) - no layout generation logic
- **Explicit layout types**: Must specify `layout: 'grid' | 'flex' | 'content'`
- **Automatic container queries**: All composites automatically get `@container` for Tailwind container query support
- **Can be schema instances**: Reference design system schemas via `@schema` + `parameters`

```typescript
interface CompositeConfig {
  id?: string; // Unique identifier for registry
  
  // Schema instance properties
  '@schema'?: string; // Schema name (e.g., "design-system.header")
  parameters?: Record<string, string>; // Concrete values for schema placeholders
  
  // Container (optional when @schema present, resolved from schema definition)
  container?: {
    /**
     * Explicit container layout type (REQUIRED if @schema not provided)
     * - 'grid': Structural grid container (gets h-full w-full overflow-hidden grid @container)
     * - 'flex': Structural flex container (gets h-full w-full overflow-hidden flex @container)
     * - 'content': Content container (no structural defaults, flows naturally, gets @container)
     */
    layout: 'grid' | 'flex' | 'content'
    
    /**
     * Tailwind CSS classes (space-separated string)
     * Defaults applied based on layout type
     * All composites automatically get @container for container query support
     */
    class?: string
  };
  children?: ViewNode[];
}
```

**Important**: The `style` property has been removed. All styling must use Tailwind classes via `container.class`.

### Leaf

A **Leaf** is a content node that:
- Defines actual UI elements (buttons, inputs, text, etc.)
- Handles data bindings (`value`, `text`, `visible`, `foreach`)
- Maps DOM events to state machine events
- Is fully JSON-driven (no hardcoded component logic)
- **Pure Tailwind styling**: All styling via `classes` string (space-separated)
- **Can be schema instances**: Reference design system schemas via `@schema` + `parameters`

```typescript
interface LeafNode {
  id?: string; // Unique identifier for registry
  tag?: string; // HTML tag or "icon" (optional when @schema present)
  attributes?: Record<string, string | boolean | number>;
  classes?: string; // Tailwind CSS classes (space-separated string)
  children?: (LeafNode | string)[];
  icon?: IconConfig; // For icon tag
  bindings?: LeafBindings;
  events?: {
    click?: EventConfig;
    input?: EventConfig;
    // ... other DOM events
  };
  
  // Schema instance properties
  '@schema'?: string; // Schema name (e.g., "design-system.title")
  parameters?: Record<string, string>; // Concrete values for schema placeholders
}

interface IconConfig {
  name: string; // Iconify icon name (e.g., "solar:check-circle-bold")
  classes?: string; // Tailwind classes (space-separated string, NOT array)
  color?: string; // Optional color
}
```

**CRITICAL**: `classes` must always be a **string** (space-separated), never an array.

Example: `classes: "px-4 py-2 bg-blue-500 text-white rounded"`

---

## 🔄 State Machine

The state machine defines:
- **States**: Application states (e.g., `idle`, `loading`, `error`)
- **Transitions**: State changes triggered by events
- **Actions**: Skills executed during transitions
- **Data**: Unified reactive data store

### Example State Machine

```typescript
export const todoStateMachine: StateMachineConfig = {
  initial: "idle",
  data: {
    todos: [],
    newTodoText: "",
    viewMode: "list",
    showModal: false,
    error: null,
  },
  states: {
    idle: {
      on: {
        ADD_TODO: {
          target: "idle",
          actions: ["@todo/validateTodo", "@todo/addTodo", "@ui/clearInput"],
        },
        TOGGLE_TODO: {
          target: "idle",
          actions: ["@todo/toggleTodo"],
        },
        SET_VIEW: {
          target: "idle",
          actions: ["@ui/setView"],
        },
      },
    },
    loading: {
      on: {
        SUCCESS: "idle",
        ERROR: "error",
      },
    },
    error: {
      on: {
        RETRY: "idle",
        CLEAR_ERROR: "idle",
      },
    },
  },
};
```

### Skills (Actions)

Skills are reusable action functions loaded from a registry:

```typescript
// Skill definition
const toggleTodoSkill: Skill = {
  metadata: {
    id: "@todo/toggleTodo",
    name: "Toggle Todo",
    description: "Toggles the completion status of a todo item",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", required: true },
      },
    },
  },
  execute: (data: Data, payload?: unknown) => {
    const { id } = (payload as { id?: string }) || {};
    if (!id) return;

    const todos = (data.todos as Array<{ id: string; status?: string }>) || [];
    data.todos = todos.map((todo) =>
      todo.id === id
        ? { ...todo, status: todo.status === "done" ? "todo" : "done" }
        : todo
    );
  },
};
```

**Key Points:**
- Skills use standardized `id` property (not entity-specific like `todoId`)
- Skills operate on unified `Data` type
- Skills are referenced by ID in state machine: `"@todo/toggleTodo"`

---

## 🎨 View Structure

### Composite Examples

#### 1. Stack Layout (Flex Column)

```typescript
const rootComposite: CompositeConfig = {
  container: {
    layout: 'flex', // Explicit layout type (REQUIRED)
    class: "max-w-6xl mx-auto flex-col p-6", // h-full w-full overflow-hidden flex added automatically
  },
  children: [
    { slot: "header", composite: headerComposite },
    { slot: "content", composite: contentComposite },
  ],
};
```

#### 2. Flex Layout (Horizontal)

```typescript
const headerComposite: CompositeConfig = {
  container: {
    layout: 'flex', // Explicit layout type (REQUIRED)
    class: "flex-row justify-between items-center gap-4 p-0 bg-transparent", // h-full w-full overflow-hidden flex added automatically
  },
  children: [
    { slot: "title", leaf: titleLeaf },
    { slot: "viewButtons", leaf: viewButtonsLeaf },
  ],
};
```

**Note**: All layout logic is handled via Tailwind classes in `container.class`. Composite is a pure container div. The `layout` property determines which structural defaults are applied.

#### 3. Grid Layout

```typescript
const kanbanComposite: CompositeConfig = {
  container: {
    layout: 'grid', // Explicit layout type (REQUIRED)
    class: "grid-cols-3 gap-4 min-h-[100px]", // h-full w-full overflow-hidden grid added automatically
  },
  children: [
    { slot: "todoColumn", composite: todoColumnComposite },
    { slot: "inProgressColumn", composite: inProgressColumnComposite },
    { slot: "doneColumn", composite: doneColumnComposite },
  ],
};
```

**Note**: For arbitrary grid template columns, use Tailwind arbitrary values: `class: "[grid-template-columns:repeat(auto-fill,minmax(280px,1fr))] gap-[0.75rem]"`

#### 4. Content Container (No Structural Defaults)

```typescript
const contentComposite: CompositeConfig = {
  container: {
    layout: 'content', // Explicit layout type (REQUIRED)
    class: "pt-6 bg-slate-50", // Only @container added automatically, no structural defaults
  },
  children: [
    { slot: "list", leaf: todoListLeaf },
  ],
};
```

**Note**: Use `layout: 'content'` when you want a container that flows naturally without structural constraints. Perfect for content blocks within structural containers.

#### 5. Schema Instance (Reusable Design System Component)

```typescript
// Use a design system schema for reusable components
const headerComposite: CompositeConfig = {
  id: 'todo.composite.header',
  '@schema': 'design-system.header', // Reference to schema definition
  parameters: {
    titleText: 'data.queries.title',       // Concrete data path
    viewModePath: 'data.view.viewMode',    // Concrete data path
    setViewEvent: 'SET_VIEW',               // Concrete event name
  },
}

// After pre-render resolution, this becomes a full CompositeConfig:
// {
//   id: 'todo.composite.header',
//   container: {
//     layout: 'content',
//     class: 'w-full p-0 bg-transparent sticky top-0 z-10',
//   },
//   children: [
//     {
//       slot: 'title',
//       leaf: {
//         tag: 'div',
//         classes: 'text-center mb-3...',
//         children: [
//           {
//             tag: 'h1',
//             bindings: { text: 'data.queries.title' }, // Placeholder replaced!
//           },
//         ],
//       },
//     },
//     {
//       slot: 'viewButtons',
//       leaf: { /* ... resolved viewButtons leaf */ },
//     },
//   ],
// }
```

**Benefits of Schema Instances:**
- **Reusability**: Same schema, different data bindings
- **Maintainability**: Update schema once, affects all instances
- **Type Safety**: Parameters validated via JSON Schema
- **Database-Ready**: Can load from database (future)

#### 6. Overlay Layout (for modals)

```typescript
const modalComposite: CompositeConfig = {
  container: {
    layout: 'flex', // Explicit layout type (REQUIRED)
    class: "fixed inset-0 bg-black bg-opacity-50 items-center justify-center", // h-full w-full overflow-hidden flex added automatically
  },
  children: [
    { slot: "modalContent", leaf: modalContentLeaf },
  ],
};
```

### Layout Type Defaults

The `layout` property determines which structural defaults are automatically applied:

- **`layout: 'grid'`**: Adds `h-full w-full overflow-hidden grid @container`
- **`layout: 'flex'`**: Adds `h-full w-full overflow-hidden flex @container`
- **`layout: 'content'`**: Adds only `@container` (no structural defaults)

**Smart Defaults**: The system intelligently avoids adding defaults if you've already specified them:
- Won't add `h-full` if you use `flex-grow` or `flex-1`
- Won't add `overflow-hidden` if you've specified `overflow-auto`, `overflow-scroll`, or `overflow-visible`
- Won't duplicate `grid` or `flex` if already present

**Container Queries**: All composites automatically get `@container` for Tailwind container query support. Use `@md:`, `@lg:`, etc. in your leaf components instead of media queries.

---

## 📦 Container Queries: Responsive Design Based on Container Size

### Philosophy: Composites Provide Space, Leaves Adapt

The architecture follows a clear separation of concerns:

- **Composites**: Provide the room and space (structural containers)
- **Leaves**: Work with the full room and space given, adjusting themselves based on available space

This means:
- Each leaf manages its own positioning and sizing based on its parent composite container
- If a leaf is inside a larger container (e.g., full-width card), it can display more content, larger fonts, more spacing
- If a leaf is inside a small container (e.g., 10rem × 6rem sidebar), it can hide elements, use tiny fonts, compact spacing, etc.
- **Use container queries (`@md:`, `@lg:`, etc.) instead of media queries** - leaves adapt to their container, not the viewport

### Container Size Reference

By default, Tailwind includes container sizes ranging from 16rem (256px) to 80rem (1280px):

| Variant | Minimum width | CSS |
|---------|--------------|-----|
| `@3xs` | 16rem (256px) | `@container (width >= 16rem) { … }` |
| `@2xs` | 18rem (288px) | `@container (width >= 18rem) { … }` |
| `@xs` | 20rem (320px) | `@container (width >= 20rem) { … }` |
| `@sm` | 24rem (384px) | `@container (width >= 24rem) { … }` |
| `@md` | 28rem (448px) | `@container (width >= 28rem) { … }` |
| `@lg` | 32rem (512px) | `@container (width >= 32rem) { … }` |
| `@xl` | 36rem (576px) | `@container (width >= 36rem) { … }` |
| `@2xl` | 42rem (672px) | `@container (width >= 42rem) { … }` |
| `@3xl` | 48rem (768px) | `@container (width >= 48rem) { … }` |
| `@4xl` | 56rem (896px) | `@container (width >= 56rem) { … }` |
| `@5xl` | 64rem (1024px) | `@container (width >= 64rem) { … }` |
| `@6xl` | 72rem (1152px) | `@container (width >= 72rem) { … }` |
| `@7xl` | 80rem (1280px) | `@container (width >= 80rem) { … }` |

### Example: Adaptive Button Leaf

```typescript
// Button that adapts to container size
const adaptiveButtonLeaf: LeafNode = {
  tag: "button",
  attributes: { type: "button" },
  classes: `
    px-2 py-1 text-xs
    @xs:px-3 @xs:py-1.5 @xs:text-sm
    @sm:px-4 @sm:py-2 @sm:text-base
    @md:px-6 @md:py-3 @md:text-lg
    bg-blue-500 text-white rounded
  `.trim().replace(/\s+/g, ' '), // Clean up whitespace
  children: ["Click Me"],
  events: {
    click: {
      event: "BUTTON_CLICKED",
    },
  },
};
```

**Behavior:**
- **Small container (< 20rem)**: Tiny button with `px-2 py-1 text-xs`
- **XS container (≥ 20rem)**: Small button with `px-3 py-1.5 text-sm`
- **SM container (≥ 24rem)**: Medium button with `px-4 py-2 text-base`
- **MD container (≥ 28rem)**: Large button with `px-6 py-3 text-lg`

### Example: Adaptive Card with Conditional Content

```typescript
// Card that shows/hides content based on container size
const adaptiveCardLeaf: LeafNode = {
  tag: "div",
  classes: "bg-white rounded-lg p-2 @sm:p-4 @md:p-6",
  children: [
    {
      tag: "h2",
      classes: "text-sm @sm:text-base @md:text-xl font-bold mb-1 @sm:mb-2 @md:mb-4",
      children: ["Card Title"],
    },
    {
      tag: "p",
      classes: "text-xs @sm:text-sm @md:text-base text-slate-600 hidden @sm:block",
      children: ["This description only shows in containers ≥ 24rem (sm)"],
    },
    {
      tag: "div",
      classes: "flex flex-col @md:flex-row gap-2 @md:gap-4",
      children: [
        {
          tag: "button",
          classes: "px-2 py-1 @md:px-4 @md:py-2 text-xs @md:text-base",
          children: ["Action 1"],
        },
        {
          tag: "button",
          classes: "px-2 py-1 @md:px-4 @md:py-2 text-xs @md:text-base",
          children: ["Action 2"],
        },
      ],
    },
  ],
};
```

**Behavior:**
- **Small container (< 24rem)**: Compact card, no description, vertical button layout
- **SM container (≥ 24rem)**: Description appears, still vertical buttons
- **MD container (≥ 28rem)**: Larger padding, horizontal button layout, larger text

### Example: Adaptive Grid Layout

```typescript
// Grid that adapts columns based on container size
const adaptiveGridLeaf: LeafNode = {
  tag: "div",
  classes: `
    grid grid-cols-1 gap-2
    @xs:grid-cols-2 @xs:gap-3
    @sm:grid-cols-2 @sm:gap-4
    @md:grid-cols-3 @md:gap-4
    @lg:grid-cols-4 @lg:gap-6
  `.trim().replace(/\s+/g, ' '),
  children: [
    // Grid items...
  ],
};
```

**Behavior:**
- **Small container (< 20rem)**: 1 column, small gap
- **XS container (≥ 20rem)**: 2 columns, medium gap
- **SM container (≥ 24rem)**: 2 columns, larger gap
- **MD container (≥ 28rem)**: 3 columns
- **LG container (≥ 32rem)**: 4 columns, large gap

### Best Practices for Container Queries

1. **Always use container queries in leaves, not media queries**
   ```typescript
   // ✅ Good - Adapts to container
   classes: "text-sm @md:text-lg"
   
   // ❌ Bad - Adapts to viewport (not what we want)
   classes: "text-sm md:text-lg"
   ```

2. **Start with mobile-first (smallest) styles, then scale up**
   ```typescript
   // ✅ Good - Mobile-first approach
   classes: "px-2 @sm:px-4 @md:px-6"
   
   // ❌ Bad - Desktop-first (harder to maintain)
   classes: "@md:px-6 @sm:px-4 px-2"
   ```

3. **Hide/show content based on container size**
   ```typescript
   // Hide in small containers, show in larger ones
   classes: "hidden @md:block"
   
   // Show in small containers, hide in larger ones
   classes: "block @md:hidden"
   ```

4. **Adjust spacing, typography, and layout together**
   ```typescript
   classes: `
     p-2 text-xs gap-2
     @sm:p-4 @sm:text-sm @sm:gap-4
     @md:p-6 @md:text-base @md:gap-6
   `.trim().replace(/\s+/g, ' ')
   ```

5. **Test with different container sizes**
   - Use browser DevTools to resize the container (not the viewport)
   - Test with containers ranging from 16rem to 80rem+
   - Ensure content remains readable and usable at all sizes

### Why Container Queries Over Media Queries?

- **Reusability**: Same leaf works in different contexts (sidebar, modal, full-width card)
- **Component-based**: Each component adapts to its own space, not global viewport
- **Better UX**: Content adapts to actual available space, not screen size
- **Easier maintenance**: Changes to one container don't affect others

---

### Child Styling (Pure Tailwind)

All styling must be in `leaf.classes` or `composite.container.class` using Tailwind classes.

**For leaf nodes**, add classes directly to `leaf.classes`:

```typescript
{
  slot: "header",
  leaf: {
    ...titleLeaf,
    classes: titleLeaf.classes ? `${titleLeaf.classes} sticky top-0 z-10 h-auto` : "sticky top-0 z-10 h-auto",
  },
}
```

**For composite nodes**, add classes to `composite.container.class`:

```typescript
{
  slot: "content",
  composite: {
    ...contentComposite,
    container: {
      ...contentComposite.container,
      class: contentComposite.container?.class 
        ? `${contentComposite.container.class} flex-grow flex-shrink flex-basis-0 min-h-0 overflow-auto`
        : "flex-grow flex-shrink flex-basis-0 min-h-0 overflow-auto",
    },
  },
}
```

**Common Tailwind classes for layout:**
- Flex: `flex-grow`, `flex-shrink`, `flex-basis-0`, `min-h-0`
- Overflow: `overflow-auto`, `overflow-hidden`, `overflow-x-auto`, `overflow-y-auto`
- Position: `sticky`, `top-0`, `z-10`
- Size: `h-auto`, `min-h-[120px]`, `w-full`

---

## 🍃 Leaf Nodes (JSON-Driven UI)

Leaf nodes define UI elements entirely in JSON. They support:

**Key Principle**: Each leaf manages its own positioning and sizing based on its parent composite container. Use container queries (`@md:`, `@lg:`, etc.) to make leaves adapt to the available space. See the [Container Queries](#-container-queries-responsive-design-based-on-container-size) section for details.

### Basic Elements

```typescript
// Simple text (with container query adaptation)
const titleLeaf: LeafNode = {
  tag: "h1",
  classes: "text-lg @sm:text-xl @md:text-2xl font-bold text-slate-900", // Adapts to container size
  children: ["My Todo App"],
};

// Button (with container query adaptation)
const buttonLeaf: LeafNode = {
  tag: "button",
  attributes: { type: "button" },
  classes: "px-3 py-1.5 @sm:px-4 @sm:py-2 @md:px-6 @md:py-3 bg-blue-500 text-white rounded text-sm @sm:text-base", // Adapts to container size
  events: {
    click: {
      event: "ADD_TODO",
      payload: { text: "New todo" },
    },
  },
  children: ["Add Todo"],
};
```

**CRITICAL**: 
- Always use space-separated strings for `classes`.
- Use container queries (`@md:`, `@lg:`, etc.) instead of media queries (`md:`, `lg:`, etc.) so leaves adapt to their container, not the viewport.

### Data Bindings

#### Value Binding (for inputs)

```typescript
const inputLeaf: LeafNode = {
  tag: "input",
  attributes: { type: "text", placeholder: "Add a new todo..." },
  classes: "px-4 py-2 border rounded", // String, not array
  bindings: {
    value: "data.newTodoText", // Binds to data.newTodoText
  },
  events: {
    input: {
      event: "UPDATE_INPUT",
      payload: "data.newTodoText", // Automatically wraps as { text: value }
    },
  },
};
```

#### Text Binding

```typescript
const textLeaf: LeafNode = {
  tag: "span",
  classes: "text-slate-700", // String, not array
  bindings: {
    text: "data.title", // Displays data.title
  },
};
```

#### Visibility Binding

**Important**: Use `visible` binding only for conditional content display (e.g., error messages, optional UI elements). For view switching or major UI state changes, use `swapViewNode` instead (see [Dynamic View Node Swapping](#dynamic-view-node-swapping)).

```typescript
const errorLeaf: LeafNode = {
  tag: "div",
  classes: "text-red-500 text-sm", // String, not array
  bindings: {
    visible: "data.error !== null", // Only visible when error exists
    text: "data.error",
  },
};
```

**When NOT to use visibility binding:**
- ❌ View mode switching (list/kanban/timeline) - Use `swapViewNode` instead
- ❌ Collapsible sections - Use `swapViewNode` to swap between expanded/collapsed configs
- ❌ Major UI state changes - Use `swapViewNode` to swap entire configs

**When to use visibility binding:**
- ✅ Conditional error messages
- ✅ Optional UI hints or tooltips
- ✅ Simple show/hide based on boolean state

#### Foreach Binding (List Rendering)

```typescript
const todoListLeaf: LeafNode = {
  tag: "div",
  classes: "flex flex-col gap-2", // String, not array
  bindings: {
    foreach: {
      items: "data.todos", // Array to iterate over
      key: "id", // Property to use as key
      leaf: {
        // Template for each item
        tag: "div",
        classes: "px-4 py-2 bg-white rounded", // String, not array
        children: [
          {
            tag: "span",
            bindings: {
              text: "item.text", // Access current item
            },
          },
        ],
      },
    },
  },
};
```

### Event Handlers

Events map DOM interactions to state machine events:

```typescript
const todoItemLeaf: LeafNode = {
  tag: "div",
  classes: ["flex", "items-center", "gap-2"],
  children: [
    {
      tag: "button",
      events: {
        click: {
          event: "TOGGLE_TODO",
          payload: "item.id", // Automatically wrapped as { id: "..." }
        },
      },
      children: ["Toggle"],
    },
    {
      tag: "button",
      events: {
        click: {
          event: "REMOVE_TODO",
          payload: "item.id",
        },
      },
      children: ["Delete"],
    },
  ],
};
```

### Icon Support (Iconify)

```typescript
const iconButtonLeaf: LeafNode = {
  tag: "button",
  classes: "p-2 rounded-full hover:bg-slate-100", // String, not array
  children: [
    {
      tag: "icon",
      icon: {
        name: "mingcute:check-2-line", // Iconify icon name
        classes: "w-5 h-5 text-green-500", // String, not array
      },
    },
  ],
  events: {
    click: {
      event: "TOGGLE_TODO",
      payload: "item.id",
    },
  },
};
```

### Drag and Drop

```typescript
// Draggable item
const draggableItemLeaf: LeafNode = {
  tag: "div",
  attributes: { draggable: true },
  classes: ["cursor-move", "p-4", "bg-white", "rounded"],
  events: {
    dragstart: {
      event: "UPDATE_TODO_STATUS", // Event name (not executed, just stores ID)
      payload: "item.id", // Stored in dataTransfer
    },
  },
  children: [
    {
      tag: "span",
      bindings: { text: "item.text" },
    },
  ],
};

// Drop zone
const dropZoneLeaf: LeafNode = {
  tag: "div",
  classes: ["min-h-[200px]", "bg-slate-50", "rounded-lg", "p-2"],
  events: {
    dragover: {
      event: "UPDATE_TODO_STATUS", // Allows drop
      payload: { status: "todo" },
    },
    drop: {
      event: "UPDATE_TODO_STATUS",
      payload: { status: "todo" }, // Combined with dragged ID
    },
  },
  bindings: {
    foreach: {
      items: "data.todos",
      key: "id",
      leaf: {
        tag: "div",
        bindings: {
          visible: "item.status === 'todo'",
        },
        children: [draggableItemLeaf],
      },
    },
  },
};
```

### Date Formatting

```typescript
const dateLeaf: LeafNode = {
  tag: "span",
  classes: "text-xs text-slate-500", // String, not array
  bindings: {
    text: "item.endDate|date", // Pipe syntax for formatting
  },
};
```

### Dynamic View Node Swapping

**CRITICAL**: For view switching, collapsible sections, or any major UI state changes, use `swapViewNode` instead of visibility hacks. This ensures clean, maintainable code and proper reactivity.

#### View Node Registry

All view nodes (composites and leaves) must be registered with unique IDs in the `viewNodeRegistry`:

```typescript
import { viewNodeRegistry } from '../../compositor/view/view-node-registry'

// Register composites and leaves
viewNodeRegistry.registerAll([
  listContentComposite,
  kanbanContentComposite,
  timelineContentComposite,
  expandedColumnLeaf,
  collapsedColumnLeaf,
  // ... more nodes
])
```

#### Using compositeId and leafId

Reference registered nodes by ID using `compositeId` or `leafId`:

```typescript
// Reference a composite by ID
const rootComposite: CompositeConfig = {
  container: {
    layout: 'grid',
    class: 'grid-cols-1',
  },
  children: [
    {
      slot: 'content',
      compositeId: 'data.view.contentCompositeId', // Resolved from state
    },
  ],
}

// Reference a leaf by ID
const kanbanContentComposite: CompositeConfig = {
  container: {
    layout: 'grid',
    class: 'grid-cols-3 gap-4',
  },
  children: [
    {
      slot: 'todo-column',
      leafId: 'data.view.kanbanColumnIds.todo', // Resolved from state
    },
    {
      slot: 'in-progress-column',
      leafId: 'data.view.kanbanColumnIds.in-progress',
    },
    {
      slot: 'done-column',
      leafId: 'data.view.kanbanColumnIds.done',
    },
  ],
}
```

#### swapViewNode Action

Use the `@ui/swapViewNode` skill to dynamically swap view nodes:

```typescript
// State machine action
const swapViewNodeSkill: Skill = {
  metadata: {
    id: '@ui/swapViewNode',
    name: 'Swap View Node',
    description: 'Swaps any view node config (composite or leaf) by ID',
    parameters: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', required: true },
        targetPath: { type: 'string', required: true },
        nodeType: { type: 'string', required: false },
      },
    },
  },
  execute: (data: Data, payload?: unknown) => {
    const { nodeId, targetPath } = (payload as { nodeId?: string; targetPath?: string }) || {}
    if (!nodeId || !targetPath) return
    
    // Update the target path with the new node ID
    const pathParts = targetPath.split('.')
    let target: Data = data
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i]
      if (!target[part]) {
        target[part] = {}
      }
      target = target[part] as Data
    }
    target[pathParts[pathParts.length - 1]] = nodeId
    
    // Ensure reactivity
    if (data.view) {
      data.view = { ...(data.view as Data) }
    }
  },
}
```

#### Example: View Mode Switching

```typescript
// State machine
const todoStateMachine: StateMachineConfig = {
  initial: 'idle',
  data: {
    view: {
      viewMode: 'list',
      contentCompositeId: 'todo.composite.content.list', // Active content composite
    },
  },
  states: {
    idle: {
      on: {
        SET_VIEW: {
          target: 'idle',
          actions: ['@ui/setView'], // Uses swapViewNode internally
        },
      },
    },
  },
}

// setView skill (uses swapViewNode internally)
const setViewSkill: Skill = {
  metadata: {
    id: '@ui/setView',
    name: 'Set View',
    description: 'Sets the view mode and swaps the content composite',
  },
  execute: (data: Data, payload?: unknown) => {
    const viewMode = (payload as { viewMode?: string })?.viewMode
    if (!viewMode) return
    
    const compositeIdMap: Record<string, string> = {
      list: 'todo.composite.content.list',
      kanban: 'todo.composite.content.kanban',
      timeline: 'todo.composite.content.timeline',
    }
    
    const compositeId = compositeIdMap[viewMode]
    if (compositeId) {
      // Use swapViewNode to swap the composite
      swapViewNodeSkill.execute(data, {
        nodeId: compositeId,
        targetPath: 'view.contentCompositeId',
        nodeType: 'composite',
      })
      // Update viewMode for button visibility
      const view = data.view as Data
      view.viewMode = viewMode
      data.view = { ...view }
    }
  },
}

// View button leaf
const viewButtonLeaf: LeafNode = {
  tag: 'button',
  classes: 'px-4 py-2 rounded',
  events: {
    click: {
      event: 'SET_VIEW',
      payload: { viewMode: 'kanban' },
    },
  },
  children: ['Kanban'],
}
```

#### Example: Collapsible Sections

```typescript
// Expanded column leaf
const expandedColumnLeaf: LeafNode = {
  id: 'todo.leaf.kanbanColumn.todo.expanded',
  tag: 'div',
  classes: 'flex flex-col gap-2 h-full border rounded-lg p-2',
  children: [
    {
      tag: 'div',
      classes: 'flex items-center justify-between',
      children: [
        { tag: 'h3', classes: 'text-sm font-semibold', children: ['Todo'] },
        {
          tag: 'button',
          classes: 'p-1 rounded hover:bg-slate-100',
          events: {
            click: {
              event: 'SWAP_VIEW_NODE',
              payload: (data: unknown) => {
                const view = (data as Record<string, unknown>).view as Record<string, unknown>
                const currentId = view.kanbanColumnIds?.todo as string
                const isExpanded = currentId?.includes('.expanded')
                return {
                  nodeId: isExpanded
                    ? 'todo.leaf.kanbanColumn.todo.collapsed'
                    : 'todo.leaf.kanbanColumn.todo.expanded',
                  targetPath: 'view.kanbanColumnIds.todo',
                  nodeType: 'leaf',
                }
              },
            },
          },
          children: [
            {
              tag: 'icon',
              icon: { name: 'mdi:chevron-down', classes: 'w-4 h-4' },
            },
          ],
        },
      ],
    },
    // ... column content
  ],
}

// Collapsed column leaf (thin vertical column)
const collapsedColumnLeaf: LeafNode = {
  id: 'todo.leaf.kanbanColumn.todo.collapsed',
  tag: 'div',
  classes: 'flex flex-col items-center justify-between h-full w-12 border rounded-lg p-2',
  children: [
    {
      tag: 'div',
      classes: 'flex flex-col items-center gap-2',
      children: [
        {
          tag: 'h3',
          classes: 'text-sm font-semibold writing-vertical-rl',
          children: ['Todo'],
        },
        {
          tag: 'button',
          classes: 'p-1 rounded hover:bg-slate-100',
          events: {
            click: {
              event: 'SWAP_VIEW_NODE',
              payload: (data: unknown) => {
                // Toggle back to expanded
                return {
                  nodeId: 'todo.leaf.kanbanColumn.todo.expanded',
                  targetPath: 'view.kanbanColumnIds.todo',
                  nodeType: 'leaf',
                }
              },
            },
          },
          children: [
            {
              tag: 'icon',
              icon: { name: 'mdi:chevron-left', classes: 'w-4 h-4' },
            },
          ],
        },
      ],
    },
    {
      tag: 'div',
      classes: 'text-lg font-bold',
      bindings: {
        text: 'data.queries.todos.filter(t => t.status === "todo").length',
      },
    },
  ],
}

// State machine
const todoStateMachine: StateMachineConfig = {
  initial: 'idle',
  data: {
    view: {
      kanbanColumnIds: {
        todo: 'todo.leaf.kanbanColumn.todo.expanded',
        'in-progress': 'todo.leaf.kanbanColumn.in-progress.expanded',
        done: 'todo.leaf.kanbanColumn.done.expanded',
      },
    },
  },
  states: {
    idle: {
      on: {
        SWAP_VIEW_NODE: {
          target: 'idle',
          actions: ['@ui/swapViewNode'],
        },
      },
    },
  },
}
```

**Key Benefits of swapViewNode:**
- ✅ Clean separation: Each state has its own config
- ✅ Better performance: No hidden DOM elements
- ✅ Easier maintenance: Configs are explicit and testable
- ✅ Fully generic: Works for any view node type
- ✅ Database-ready: Configs can be stored and loaded dynamically

**Anti-Pattern: Visibility Hacks**

```typescript
// ❌ BAD - Using visibility to hide/show different views
const contentComposite: CompositeConfig = {
  container: { layout: 'grid' },
  children: [
    {
      slot: 'list',
      leaf: listLeaf,
      visible: 'data.view.viewMode === "list"', // Visibility hack
    },
    {
      slot: 'kanban',
      leaf: kanbanLeaf,
      visible: 'data.view.viewMode === "kanban"', // Visibility hack
    },
  ],
}

// ✅ GOOD - Using swapViewNode to swap entire configs
const rootComposite: CompositeConfig = {
  container: { layout: 'grid' },
  children: [
    {
      slot: 'content',
      compositeId: 'data.view.contentCompositeId', // Swapped dynamically
    },
  ],
}
```

---

## 📁 File Organization

A Vibe is typically organized into a modular folder structure:

```
vibes/todo/
├── config.ts                    # Main config (pulls everything together)
├── stateMachine.ts              # State machine configuration
├── composites/                  # Composite (layout) configurations
│   ├── index.ts
│   ├── root.ts                  # Root composite
│   ├── header.ts                # Header composite
│   ├── inputSection.ts          # Input section composite
│   └── content.ts               # Content area composite
├── leafs/                       # Leaf (content) components
│   ├── index.ts
│   ├── title.ts                 # Title leaf
│   ├── description.ts           # Description leaf
│   ├── viewButtons.ts           # View button leaves
│   ├── inputForm.ts             # Input form leaf
│   ├── error.ts                 # Error message leaf
│   ├── todoItem.ts             # Single todo item leaf
│   ├── todoList.ts             # Todo list leaf
│   ├── kanbanView.ts           # Kanban view leaf
│   ├── timelineView.ts         # Timeline view leaf
│   └── modal.ts                # Modal leaf
└── views/                       # View configurations
    └── index.ts                # Main view
```

### Example: Complete Vibe Config

```typescript
// vibes/todo/config.ts
import type { VibeConfig } from "../../compositor/types";
import { todoStateMachine } from "./stateMachine";
import { todoView } from "./views";

export const todoVibeConfig: VibeConfig = {
  stateMachine: todoStateMachine,
  view: todoView,
};
```

```typescript
// vibes/todo/views/index.ts
import type { ViewConfig } from "../../../compositor/view/types";
import { rootComposite } from "../composites";
import { modalLeaf } from "../leafs";

export const todoView: ViewConfig = {
  composite: {
    ...rootComposite,
    children: [
      ...rootComposite.children,
      {
        slot: "modal",
        leaf: modalLeaf,
      },
    ],
  },
};
```

---

## 🔒 Security: Whitelisting

The system uses strict whitelisting to prevent malicious code injection from untrusted JSON configs:

### Allowed Tags

```typescript
const ALLOWED_TAGS = new Set([
  "div", "span", "button", "input", "form", "ul", "li",
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "label", "a",
  "svg", "path", "pre", "code", "section", "article",
  "header", "footer", "nav", "main", "aside", "img", "br", "hr",
  "icon", // Special tag for Iconify icons
]);
```

### Allowed Attributes

Attributes are whitelisted per tag:

```typescript
const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  _universal: new Set([
    "class", "id", "role", "tabindex",
    "aria-label", "aria-labelledby", "aria-describedby",
    "draggable", // For drag and drop
  ]),
  input: new Set(["type", "placeholder", "disabled", "required"]),
  button: new Set(["type", "disabled"]),
  // ... more tag-specific attributes
};
```

### Tailwind CSS Class Validation

Tailwind classes are validated using regex patterns:

```typescript
const TAILWIND_PATTERNS = [
  /^p[tblrxy]?-\d+$/, // Padding
  /^m[tblrxy]?-\d+$/, // Margin
  /^bg-\w+(-\d+)?$/, // Background colors
  /^text-\w+(-\d+)?$/, // Text colors
  /^border(-\d+)?$/, // Borders
  /^rounded(-\w+)?$/, // Border radius
  /^flex$/, /^grid$/, // Layout
  /^hover:\w+$/, /^focus:\w+$/, // Pseudo-classes
  // ... many more patterns
];
```

**Important**: Arbitrary values (e.g., `bg-[#001a42]`) and gradient classes are also supported.

---

## 🎯 Best Practices

### 1. Standardize on `id` Property

Always use `id` as the property name, not entity-specific names like `todoId`:

```typescript
// ✅ Good
payload: "item.id" // Automatically wrapped as { id: "..." }

// ❌ Bad
payload: "item.todoId" // Requires custom handling
```

### 2. Keep Leafs Small and Focused

Break down complex UIs into smaller, reusable leaf nodes:

```typescript
// ✅ Good - Modular
export const todoItemLeaf: LeafNode = { /* ... */ };
export const todoListLeaf: LeafNode = {
  bindings: {
    foreach: {
      items: "data.todos",
      leaf: todoItemLeaf, // Reuse
    },
  },
};

// ❌ Bad - Monolithic
export const todoListLeaf: LeafNode = {
  // 200+ lines of nested structure
};
```

### 3. Use Composites for Layout, Leafs for Content

```typescript
// ✅ Good - Clear separation with explicit layout
const headerComposite: CompositeConfig = {
  container: {
    layout: 'flex', // Explicit layout type (REQUIRED)
    class: "flex-row justify-between items-center gap-4 p-0 bg-transparent", // Pure Tailwind
  },
  children: [
    { slot: "title", leaf: titleLeaf },
    { slot: "buttons", leaf: buttonsLeaf },
  ],
};

// ❌ Bad - Missing layout property
const headerComposite: CompositeConfig = {
  container: {
    class: "flex flex-row justify-between items-center p-0 bg-transparent",
    // Missing required layout property!
  },
  children: [/* ... */],
};

// ❌ Bad - Mixing concerns
const headerLeaf: LeafNode = {
  tag: "div",
  // Complex layout logic mixed with content
};
```

**Important**: 
- `Composite.svelte` is a pure composition engine - it only handles slot management and recursive rendering.
- All styling must be in `container.class` (composites) or `leaf.classes` (leafs).
- **Always specify `layout`**: Use `'grid'` for structural grid layouts, `'flex'` for structural flex layouts, and `'content'` for content containers that flow naturally.
- **Don't duplicate defaults**: The system automatically adds `h-full w-full overflow-hidden grid/flex @container` based on layout type, so you don't need to specify these unless you want to override them.

### 4. Leverage Data Bindings

Use bindings instead of manual data access:

```typescript
// ✅ Good - Reactive binding
bindings: {
  visible: "data.showModal",
  text: "data.selectedTodo.text",
}

// ❌ Bad - Manual access
// (Not possible in pure JSON config, but avoid in programmatic configs)
```

### 5. Use Skills for Business Logic

Keep leaf nodes focused on UI, delegate logic to skills:

```typescript
// ✅ Good - Logic in skill
events: {
  click: {
    event: "TOGGLE_TODO",
    payload: "item.id",
  },
}

// Skill handles the toggle logic
const toggleTodoSkill: Skill = {
  execute: (data, payload) => {
    // Business logic here
  },
};

// ❌ Bad - Logic in leaf
// (Not possible in pure JSON, but avoid complex expressions)
```

### 6. Choose the Right Layout Type

Always explicitly specify the layout type based on your container's purpose:

```typescript
// ✅ Good - Structural grid container
const rootComposite: CompositeConfig = {
  container: {
    layout: 'grid', // Structural container that fills space
    class: "grid-cols-1 gap-4",
  },
  // ...
};

// ✅ Good - Structural flex container
const headerComposite: CompositeConfig = {
  container: {
    layout: 'flex', // Structural container that fills space
    class: "flex-row justify-center gap-4",
  },
  // ...
};

// ✅ Good - Content container (flows naturally)
const contentBlockComposite: CompositeConfig = {
  container: {
    layout: 'content', // Content block, no structural constraints
    class: "p-6 bg-white rounded-lg",
  },
  // ...
};
```

**Guidelines:**
- Use `'grid'` for 2D structural layouts (e.g., main app container, kanban board)
- Use `'flex'` for 1D structural layouts (e.g., header with buttons, vertical stack)
- Use `'content'` for content blocks that should flow naturally (e.g., text blocks, cards within a grid)

### 7. Use Container Queries in Leaves

Always use container queries (`@md:`, `@lg:`, etc.) instead of media queries (`md:`, `lg:`, etc.) so leaves adapt to their container size, not the viewport:

```typescript
// ✅ Good - Adapts to container
const adaptiveLeaf: LeafNode = {
  tag: "div",
  classes: "p-2 text-xs @sm:p-4 @sm:text-sm @md:p-6 @md:text-base",
  // ...
};

// ❌ Bad - Adapts to viewport (not what we want)
const viewportLeaf: LeafNode = {
  tag: "div",
  classes: "p-2 text-xs sm:p-4 sm:text-sm md:p-6 md:text-base",
  // ...
};
```

**Why?**
- Leaves should adapt to the space provided by their parent composite
- Same leaf can work in different contexts (sidebar, modal, full-width card)
- Better component reusability and maintainability

See the [Container Queries](#-container-queries-responsive-design-based-on-container-size) section for detailed examples and container size reference.

### 8. Create Schema Definitions for Reusable Components

When you have a component that needs to be used in multiple places with different data, create a schema:

```typescript
// ✅ Good - Reusable schema definition
export const buttonSchemaDefinition: any = {
  type: 'Leaf',
  name: 'design-system.button',
  definition: {
    tag: 'button',
    attributes: { type: 'button' },
    classes: 'px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600',
    events: {
      click: {
        event: '{{clickEvent}}', // Parameterized
      },
    },
    children: ['{{buttonText}}'], // Parameterized
  },
  parameterSchema: {
    type: 'object',
    properties: {
      clickEvent: {
        type: 'string',
        description: 'Event name to trigger on click',
      },
      buttonText: {
        type: 'string',
        description: 'Text to display on button',
        default: 'Click Me',
      },
    },
    required: ['clickEvent'],
    additionalProperties: false,
  },
}

// Register schema
registerJsonSchema('design-system.button', buttonSchemaDefinition)

// Use schema in multiple places with different data
const submitButton: LeafNode = {
  id: 'form.button.submit',
  '@schema': 'design-system.button',
  parameters: {
    clickEvent: 'SUBMIT_FORM',
    buttonText: 'Submit',
  },
}

const cancelButton: LeafNode = {
  id: 'form.button.cancel',
  '@schema': 'design-system.button',
  parameters: {
    clickEvent: 'CANCEL',
    buttonText: 'Cancel',
  },
}

// ❌ Bad - Duplicating button definition everywhere
const submitButton: LeafNode = {
  tag: 'button',
  classes: 'px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600',
  events: { click: { event: 'SUBMIT_FORM' } },
  children: ['Submit'],
}
// ... repeat for every button
```

**When to create a schema:**
- Component used in 3+ places with different data
- Want to update styling/behavior across all instances
- Building a design system for your app
- Component will be loaded from database (future)

**When NOT to create a schema:**
- One-off components specific to a single vibe
- Complex, highly customized components
- During rapid prototyping (create schemas later)

### 9. Organize by Feature

Group related composites and leafs together:

```
vibes/todo/
├── composites/
│   ├── header.ts        # Header-related layouts
│   └── content.ts       # Content-related layouts
└── leafs/
    ├── todoItem.ts      # Todo item UI
    └── todoList.ts      # Todo list UI
```

---

## 📝 Tutorial: Creating a New Schema

### Step 1: Define the Schema

Create a new file in `services/me/src/lib/vibes/design-system/schemas/`:

```typescript
// services/me/src/lib/vibes/design-system/schemas/alert.schema.ts

export const alertSchemaDefinition: any = {
  type: 'Leaf',
  name: 'design-system.alert',
  
  // LeafNode structure with placeholders
  definition: {
    tag: 'div',
    classes: 'p-4 rounded-lg border flex items-center gap-3 {{colorClasses}}',
    bindings: {
      visible: '{{visible}}', // Placeholder for visibility
    },
    children: [
      {
        tag: 'icon',
        icon: {
          name: '{{iconName}}', // Placeholder for icon
          classes: 'w-5 h-5',
        },
      },
      {
        tag: 'div',
        classes: 'flex-1',
        children: [
          {
            tag: 'h4',
            classes: 'font-semibold mb-1',
            bindings: {
              text: '{{titlePath}}', // Placeholder for title data path
            },
          },
          {
            tag: 'p',
            classes: 'text-sm',
            bindings: {
              text: '{{messagePath}}', // Placeholder for message data path
            },
          },
        ],
      },
    ],
  },
  
  // Full JSON Schema for parameters
  parameterSchema: {
    type: 'object',
    properties: {
      visible: {
        type: 'string',
        description: 'Data path or expression for visibility (e.g., "data.view.showAlert")',
        default: 'true',
      },
      titlePath: {
        type: 'string',
        description: 'Data path to alert title',
      },
      messagePath: {
        type: 'string',
        description: 'Data path to alert message',
      },
      iconName: {
        type: 'string',
        description: 'Iconify icon name',
        default: 'mdi:information',
      },
      colorClasses: {
        type: 'string',
        description: 'Tailwind color classes for alert variant',
        default: 'bg-blue-50 border-blue-200 text-blue-800',
      },
    },
    required: ['titlePath', 'messagePath'],
    additionalProperties: false,
  },
}
```

### Step 2: Export and Register the Schema

```typescript
// services/me/src/lib/vibes/design-system/schemas/index.ts
export { alertSchemaDefinition } from './alert.schema'

// services/me/src/lib/vibes/design-system/index.ts
import { alertSchemaDefinition } from './schemas'

export function registerDesignSystemSchemas() {
  // ... existing schemas
  registerJsonSchema('design-system.alert', alertSchemaDefinition)
}
```

### Step 3: Add to Schema Registry

```typescript
// libs/hominio-db/src/schemas/data/leaf-types.ts
import { alertSchemaDefinition } from '../../../../services/me/src/lib/vibes/design-system/schemas/alert.schema'

export const leafTypeSchemas: Record<string, any> = {
  // ... existing schemas
  'design-system.alert': alertSchemaDefinition,
}
```

### Step 4: Create Schema Instances

Now use the schema in your vibe with different data paths:

```typescript
// Success alert
export const successAlertLeaf: LeafNode = {
  id: 'todo.leaf.alert.success',
  '@schema': 'design-system.alert',
  parameters: {
    visible: 'data.view.showSuccessAlert',
    titlePath: 'data.view.successTitle',
    messagePath: 'data.view.successMessage',
    iconName: 'mdi:check-circle',
    colorClasses: 'bg-green-50 border-green-200 text-green-800',
  },
}

// Error alert
export const errorAlertLeaf: LeafNode = {
  id: 'todo.leaf.alert.error',
  '@schema': 'design-system.alert',
  parameters: {
    visible: 'data.view.showErrorAlert',
    titlePath: 'data.view.errorTitle',
    messagePath: 'data.view.errorMessage',
    iconName: 'mdi:alert-circle',
    colorClasses: 'bg-red-50 border-red-200 text-red-800',
  },
}

// Warning alert
export const warningAlertLeaf: LeafNode = {
  id: 'todo.leaf.alert.warning',
  '@schema': 'design-system.alert',
  parameters: {
    visible: 'data.view.showWarningAlert',
    titlePath: 'data.view.warningTitle',
    messagePath: 'data.view.warningMessage',
    iconName: 'mdi:alert',
    colorClasses: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  },
}
```

### Step 5: Use in Your View

```typescript
// Add to your composite
const rootComposite: CompositeConfig = {
  container: {
    layout: 'grid',
    class: 'grid-cols-1 gap-4',
  },
  children: [
    {
      slot: 'successAlert',
      leafId: 'todo.leaf.alert.success',
    },
    {
      slot: 'errorAlert',
      leafId: 'todo.leaf.alert.error',
    },
    // ... other children
  ],
}
```

### Step 6: Update State Machine

```typescript
// Initialize alert data in state machine
const todoStateMachine: StateMachineConfig = {
  initial: 'idle',
  data: {
    view: {
      showSuccessAlert: false,
      successTitle: '',
      successMessage: '',
      showErrorAlert: false,
      errorTitle: '',
      errorMessage: '',
    },
  },
  states: {
    idle: {
      on: {
        SHOW_SUCCESS: {
          target: 'idle',
          actions: ['@ui/showSuccessAlert'],
        },
        SHOW_ERROR: {
          target: 'idle',
          actions: ['@ui/showErrorAlert'],
        },
      },
    },
  },
}
```

### Benefits Achieved

1. **Single Source of Truth**: Update alert styling once, affects all instances
2. **Type Safety**: Parameters validated via JSON Schema
3. **Consistency**: All alerts share the same structure
4. **Flexibility**: Each instance can have different data paths and styling
5. **Maintainability**: Easy to add new alert types without duplication

---

## 🚀 Example: Complete Todo App

See `services/me/src/lib/vibes/todo/` for a complete, production-ready example:

- **State Machine**: `stateMachine.ts`
- **View Structure**: `views/index.ts`
- **Composites**: `composites/` (root, header, inputSection, content)
- **Leafs**: `leafs/` (title, description, viewButtons, inputForm, todoItem, todoList, kanbanView, timelineView, modal)

### Key Features Demonstrated

1. ✅ Multiple view modes (list, kanban, timeline)
2. ✅ Drag and drop (kanban board)
3. ✅ Modal detail view
4. ✅ Form input with validation
5. ✅ Conditional rendering
6. ✅ Icon integration (Iconify)
7. ✅ Date formatting
8. ✅ Event handling

---

## 📚 API Reference

### VibeConfig

```typescript
interface VibeConfig {
  stateMachine: StateMachineConfig;
  view: ViewConfig;
  actions?: Record<string, Action>;
}
```

### CompositeConfig

```typescript
interface CompositeConfig {
  container: {
    /**
     * Explicit container layout type (REQUIRED)
     * - 'grid': Structural grid container (gets h-full w-full overflow-hidden grid @container)
     * - 'flex': Structural flex container (gets h-full w-full overflow-hidden flex @container)
     * - 'content': Content container (no structural defaults, flows naturally, gets @container)
     */
    layout: 'grid' | 'flex' | 'content'
    
    /**
     * Tailwind CSS classes (space-separated string)
     * Defaults applied based on layout type
     * All composites automatically get @container for container query support
     */
    class?: string
  };
  children: ViewNode[];
}
```

**Note**: 
- Composite is a pure container div. All layout logic is handled via Tailwind classes in `container.class`.
- The `layout` property is **REQUIRED** and determines which structural defaults are applied.
- The `style` property has been removed - all styling must use Tailwind classes.
- All composites automatically get `@container` for Tailwind container query support.

### LeafNode

```typescript
interface LeafNode {
  tag: string;
  attributes?: Record<string, string | boolean | number>;
  classes?: string; // Tailwind classes (space-separated string)
  children?: (LeafNode | string)[];
  icon?: IconConfig;
  bindings?: LeafBindings;
  events?: {
    click?: EventConfig;
    input?: EventConfig;
    change?: EventConfig;
    submit?: EventConfig;
    dragstart?: EventConfig;
    dragover?: EventConfig;
    drop?: EventConfig;
    // ... more events
  };
}

interface IconConfig {
  name: string; // Iconify icon name (e.g., "solar:check-circle-bold")
  classes?: string; // Tailwind classes (space-separated string)
  color?: string; // Optional color
}
```

**CRITICAL**: `classes` must always be a **string** (space-separated).

Example: `classes: "px-4 py-2 bg-blue-500 text-white rounded"`

### LeafBindings

```typescript
interface LeafBindings {
  value?: string;      // Data path for input value
  text?: string;      // Data path for text content
  visible?: string;   // Boolean expression for visibility
  foreach?: {
    items: string;    // Data path to array
    leaf: LeafNode;   // Template for each item
    key?: string;     // Key property (defaults to index)
  };
}
```

### EventConfig

```typescript
interface EventConfig {
  event: string;      // State machine event name
  payload?: Record<string, unknown> | string | ((data: unknown) => unknown);
}
```

---

## 🔍 Debugging

### Validation Errors

Invalid leaf configurations are logged to console:

```
Invalid leaf configuration: root.children[0]: Attribute 'onclick' is not allowed on tag 'div'
```

### Reactivity Issues

Ensure data access triggers reactivity:

```typescript
// ✅ Good - Accesses data properties
bindings: {
  visible: "data.showModal",
}

// ✅ Good - Accesses item properties in foreach
bindings: {
  visible: "item.status === 'done'",
}
```

### Common Issues

1. **Modal not opening**: Check payload resolution (should be `{ id: "..." }`)
2. **Drag and drop not working**: Ensure `draggable: true` attribute and proper event handlers
3. **List not updating**: Verify array reference is updated in skill (create new array)
4. **Expression not evaluating**: Check syntax (use `===` not `==`, access `data.property` not `property`)
5. **Classes validation error**: Ensure `classes` is a string: `classes: "px-4 py-2"`
6. **Layout not working**: All styling must be in `leaf.classes` or `composite.container.class` using Tailwind classes
7. **Build fails with env vars**: Use `$env/dynamic/public` instead of `$env/static/public` for runtime environment variables
8. **Composite missing layout property**: All composites must specify `container.layout: 'grid' | 'flex' | 'content'`. This is required and will throw an error if missing.
9. **Unexpected structural defaults**: If you don't want `h-full w-full overflow-hidden`, use `layout: 'content'` instead of `'grid'` or `'flex'`.
10. **Container queries not working**: Ensure your composite has a `layout` property (all composites automatically get `@container`). Use `@md:`, `@lg:`, etc. in leaf components instead of media queries.
11. **View switching not working**: Use `swapViewNode` instead of visibility hacks. Register all view nodes with unique IDs and reference them via `compositeId` or `leafId`.
12. **Invalid leaf configuration with leafId**: Ensure the leaf is registered in `viewNodeRegistry` before the component tries to use it. Check that `resolveDataPath` correctly resolves the path to a valid leaf ID.
13. **Style attribute not allowed**: Never use inline `style` attributes. Use Tailwind classes instead (e.g., `writing-vertical-rl` for vertical text).
14. **Schema not found**: Ensure the schema is registered in the design system registry before creating instances. Call `registerDesignSystemSchemas()` in your vibe config.
15. **Unknown parameter error**: Parameter names in schema instances must match the `parameterSchema` definition. Check that all parameters are defined in the schema's `parameterSchema.properties`.
16. **Nested schema not resolving**: The pre-render layer only resolves the top level. Nested schemas in children are preserved and resolved by `Composite.svelte` or `Leaf.svelte`. This is by design for clean separation.
17. **Parameters not replacing placeholders**: Ensure placeholders use double curly braces: `{{paramName}}`, not single braces or other formats.
18. **Schema missing definition**: All schemas must have a `definition` property containing the LeafNode or CompositeConfig structure.
19. **additionalProperties validation**: If `parameterSchema.additionalProperties: false`, you cannot pass parameters not defined in `properties`. Remove extra parameters or add them to the schema.

---

## 🎓 Conclusion

The Vibe/Composition/Leaf architecture provides a powerful, generic system for building JSON-driven UIs. By separating concerns into Vibes (configuration), Composites (layout), and Leafs (content), you can build sophisticated applications entirely from configuration files.

**Key Benefits:**
- ✅ 100% JSON-driven (AI-friendly)
- ✅ Schema-driven design system (true component reusability)
- ✅ Full JSON Schema compliance (parameter validation)
- ✅ Fully generic (no hardcoded logic)
- ✅ Secure (whitelist-based validation)
- ✅ Reactive (Svelte-powered)
- ✅ Modular (composable components)
- ✅ Pure Tailwind (no inline styles, all styling via classes)
- ✅ Container-query responsive (leaves adapt to container size, not viewport)
- ✅ Database-ready (schemas can be loaded dynamically)

**Architecture Principles:**
- **Schema-Driven**: Reusable UI components defined as schemas with parameterized data paths
- **Separation of Concerns**: Schema Definitions → Schema Instances → Pre-Render Resolution → Render Engine
- **JSON Schema Compliance**: All parameter contracts use full JSON Schema specification
- **Pure Tailwind**: All styling via Tailwind classes (strings), no inline styles
- **Pure Composition**: `Composite.svelte` handles only slot management and recursive rendering
- **String-based Classes**: All `classes` properties are space-separated strings, never arrays
- **Delegated Styling**: Styling lives in `leaf.classes` and `composite.container.class`, not in wrapper divs
- **Explicit Layout Types**: All composites must specify `layout: 'grid' | 'flex' | 'content'` for clarity and consistency
- **Container Query Support**: All composites automatically get `@container` for Tailwind container query support
- **Smart Defaults**: Structural defaults (`h-full w-full overflow-hidden grid/flex`) are applied automatically based on layout type, with intelligent overrides
- **Container-Responsive Leaves**: Leaves adapt to their parent composite container size using container queries (`@md:`, `@lg:`, etc.), enabling true component-based responsive design
- **Dynamic View Node Swapping**: Use `swapViewNode` for view switching and collapsible sections instead of visibility hacks. All view nodes must be registered with unique IDs in `viewNodeRegistry` and referenced via `compositeId` or `leafId`.
- **Pre-Render Schema Resolution**: Schemas are resolved before rendering - render engine never sees `@schema` or `parameters` properties, ensuring clean separation and proper nested schema handling.

For examples, see `services/me/src/lib/vibes/todo/`.

