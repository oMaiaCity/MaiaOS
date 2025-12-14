# Vibe/Composition/Leaf Architecture

## ✅ Architecture Status: **PRODUCTION READY**

This document provides comprehensive documentation for the Vibe/Composition/Leaf architecture - a fully generic, JSON-driven UI system that enables building sophisticated applications entirely from configuration.

---

## 📐 Architecture Overview

The Vibe/Composition/Leaf architecture is a three-layer system for building reactive, data-driven UIs:

```
┌─────────────────────────────────────────┐
│           VIBE (Top Level)             │
│  - State Machine Configuration         │
│  - View Configuration                  │
│  - Skills Registry                      │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│        COMPOSITE (Layout Layer)          │
│  - Grid/Flex/Stack/Overlay layouts      │
│  - Container styles                     │
│  - Child positioning                    │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│          LEAF (Content Layer)           │
│  - JSON-driven UI definitions           │
│  - Data bindings                        │
│  - Event handlers                       │
│  - Fully generic, no hardcoded logic    │
└─────────────────────────────────────────┘
```

### Key Principles

1. **100% JSON-Driven**: UI structure and behavior defined entirely in JSON
2. **Fully Generic**: No hardcoded entity-specific logic (e.g., no `todoId`, just `id`)
3. **Security-First**: Whitelist-based validation for untrusted AI-generated configs
4. **Reactive**: Built on Svelte's reactivity system
5. **Modular**: Composable composites and reusable leaf nodes
6. **Pure Tailwind**: All styling via Tailwind classes (strings), no inline styles
7. **Pure Composition**: `Composite.svelte` handles only slot management and recursive rendering
8. **Container-Query Based**: Leaves adapt to their parent composite container size using container queries (`@md:`, `@lg:`, etc.), not viewport media queries

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

**Important**: The `style` property has been removed. All styling must use Tailwind classes via `container.class`.

### Leaf

A **Leaf** is a content node that:
- Defines actual UI elements (buttons, inputs, text, etc.)
- Handles data bindings (`value`, `text`, `visible`, `foreach`)
- Maps DOM events to state machine events
- Is fully JSON-driven (no hardcoded component logic)
- **Pure Tailwind styling**: All styling via `classes` string (space-separated)

```typescript
interface LeafNode {
  tag: string; // HTML tag or "icon"
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

#### 5. Overlay Layout (for modals)

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

### 8. Organize by Feature

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

---

## 🎓 Conclusion

The Vibe/Composition/Leaf architecture provides a powerful, generic system for building JSON-driven UIs. By separating concerns into Vibes (configuration), Composites (layout), and Leafs (content), you can build sophisticated applications entirely from configuration files.

**Key Benefits:**
- ✅ 100% JSON-driven (AI-friendly)
- ✅ Fully generic (no hardcoded logic)
- ✅ Secure (whitelist-based validation)
- ✅ Reactive (Svelte-powered)
- ✅ Modular (composable components)
- ✅ Pure Tailwind (no inline styles, all styling via classes)
- ✅ Container-query responsive (leaves adapt to container size, not viewport)

**Architecture Principles:**
- **Pure Tailwind**: All styling via Tailwind classes (strings), no inline styles
- **Pure Composition**: `Composite.svelte` handles only slot management and recursive rendering
- **String-based Classes**: All `classes` properties are space-separated strings, never arrays
- **Delegated Styling**: Styling lives in `leaf.classes` and `composite.container.class`, not in wrapper divs
- **Explicit Layout Types**: All composites must specify `layout: 'grid' | 'flex' | 'content'` for clarity and consistency
- **Container Query Support**: All composites automatically get `@container` for Tailwind container query support
- **Smart Defaults**: Structural defaults (`h-full w-full overflow-hidden grid/flex`) are applied automatically based on layout type, with intelligent overrides
- **Container-Responsive Leaves**: Leaves adapt to their parent composite container size using container queries (`@md:`, `@lg:`, etc.), enabling true component-based responsive design

For examples, see `services/me/src/lib/vibes/todo/`.

