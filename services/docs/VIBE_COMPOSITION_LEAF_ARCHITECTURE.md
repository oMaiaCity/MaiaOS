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

A **Composite** is a layout container node that:
- Defines layout strategy (grid, flex, stack, overlay)
- Contains child nodes (other composites or leaves)
- Handles positioning and styling of children

```typescript
interface CompositeConfig {
  type: "grid" | "flex" | "stack" | "overlay";
  grid?: GridTemplate;
  flex?: FlexProperties;
  container?: ContainerStyles;
  children: ViewNode[];
}
```

### Leaf

A **Leaf** is a content node that:
- Defines actual UI elements (buttons, inputs, text, etc.)
- Handles data bindings (`value`, `text`, `visible`, `foreach`)
- Maps DOM events to state machine events
- Is fully JSON-driven (no hardcoded component logic)

```typescript
interface LeafNode {
  tag: string; // HTML tag or "icon"
  attributes?: Record<string, string | boolean | number>;
  classes?: string[]; // Tailwind CSS classes
  children?: (LeafNode | string)[];
  bindings?: LeafBindings;
  events?: {
    click?: EventConfig;
    input?: EventConfig;
    // ... other DOM events
  };
}
```

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

### Composite Layout Types

#### 1. Stack Layout (Flex Column)

```typescript
const rootComposite: CompositeConfig = {
  type: "stack",
  container: {
    padding: "1.5rem",
    background: "rgb(248 250 252)",
  },
  children: [
    { slot: "header", composite: headerComposite },
    { slot: "content", composite: contentComposite },
  ],
};
```

#### 2. Flex Layout

```typescript
const headerComposite: CompositeConfig = {
  type: "flex",
  flex: {
    direction: "row",
    justify: "space-between",
    align: "center",
    gap: "1rem",
  },
  children: [
    { slot: "title", leaf: titleLeaf },
    { slot: "viewButtons", leaf: viewButtonsLeaf },
  ],
};
```

#### 3. Grid Layout

```typescript
const kanbanComposite: CompositeConfig = {
  type: "grid",
  grid: {
    columns: "repeat(3, 1fr)",
    gap: "1rem",
  },
  children: [
    { slot: "todoColumn", composite: todoColumnComposite },
    { slot: "inProgressColumn", composite: inProgressColumnComposite },
    { slot: "doneColumn", composite: doneColumnComposite },
  ],
};
```

#### 4. Overlay Layout (for modals)

```typescript
const modalComposite: CompositeConfig = {
  type: "overlay",
  container: {
    class: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center",
  },
  children: [
    { slot: "modalContent", leaf: modalContentLeaf },
  ],
};
```

### Child Positioning

Children can be positioned within their parent composite:

```typescript
{
  slot: "header",
  position: {
    type: "sticky",
    top: "0",
    zIndex: 10,
  },
  flex: {
    grow: 0,
    shrink: 0,
  },
  composite: headerComposite,
}
```

---

## 🍃 Leaf Nodes (JSON-Driven UI)

Leaf nodes define UI elements entirely in JSON. They support:

### Basic Elements

```typescript
// Simple text
const titleLeaf: LeafNode = {
  tag: "h1",
  classes: ["text-2xl", "font-bold", "text-slate-900"],
  children: ["My Todo App"],
};

// Button
const buttonLeaf: LeafNode = {
  tag: "button",
  attributes: { type: "button" },
  classes: ["px-4", "py-2", "bg-blue-500", "text-white", "rounded"],
  events: {
    click: {
      event: "ADD_TODO",
      payload: { text: "New todo" },
    },
  },
  children: ["Add Todo"],
};
```

### Data Bindings

#### Value Binding (for inputs)

```typescript
const inputLeaf: LeafNode = {
  tag: "input",
  attributes: { type: "text", placeholder: "Add a new todo..." },
  classes: ["px-4", "py-2", "border", "rounded"],
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
  classes: ["text-slate-700"],
  bindings: {
    text: "data.title", // Displays data.title
  },
};
```

#### Visibility Binding

```typescript
const errorLeaf: LeafNode = {
  tag: "div",
  classes: ["text-red-500", "text-sm"],
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
  classes: ["flex", "flex-col", "gap-2"],
  bindings: {
    foreach: {
      items: "data.todos", // Array to iterate over
      key: "id", // Property to use as key
      leaf: {
        // Template for each item
        tag: "div",
        classes: ["px-4", "py-2", "bg-white", "rounded"],
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
  classes: ["p-2", "rounded-full", "hover:bg-slate-100"],
  children: [
    {
      tag: "icon",
      icon: {
        name: "mingcute:check-2-line", // Iconify icon name
        classes: ["w-5", "h-5", "text-green-500"],
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
  classes: ["text-xs", "text-slate-500"],
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
// ✅ Good - Clear separation
const headerComposite: CompositeConfig = {
  type: "flex",
  children: [
    { slot: "title", leaf: titleLeaf },
    { slot: "buttons", leaf: buttonsLeaf },
  ],
};

// ❌ Bad - Mixing concerns
const headerLeaf: LeafNode = {
  tag: "div",
  // Complex layout logic mixed with content
};
```

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

### 6. Organize by Feature

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
  type: "grid" | "flex" | "stack" | "overlay";
  grid?: GridTemplate;
  flex?: FlexProperties;
  container?: ContainerStyles;
  children: ViewNode[];
  height?: string;
  width?: string;
  overflow?: OverflowBehavior;
}
```

### LeafNode

```typescript
interface LeafNode {
  tag: string;
  attributes?: Record<string, string | boolean | number>;
  classes?: string[];
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
```

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

---

## 🎓 Conclusion

The Vibe/Composition/Leaf architecture provides a powerful, generic system for building JSON-driven UIs. By separating concerns into Vibes (configuration), Composites (layout), and Leafs (content), you can build sophisticated applications entirely from configuration files.

**Key Benefits:**
- ✅ 100% JSON-driven (AI-friendly)
- ✅ Fully generic (no hardcoded logic)
- ✅ Secure (whitelist-based validation)
- ✅ Reactive (Svelte-powered)
- ✅ Modular (composable components)

For examples, see `services/me/src/lib/vibes/todo/`.

