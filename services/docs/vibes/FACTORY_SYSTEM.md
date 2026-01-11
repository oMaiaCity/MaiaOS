# Factory System

**Parameterized Templates for Reusable ViewNodes**

---

## 🎯 Overview

The **Factory System** provides a template mechanism for creating reusable, parameterized ViewNodes (Composites and Leafs). Factories are JSON templates with `{{placeholders}}` and conditional logic (`$if`, `$switch`), evaluated by the **factoryEngine**.

### Key Features

- **Parameter Substitution**: `{{placeholder}}` → actual value
- **Conditional Templates**: `$if`, `$switch`, `$map` for dynamic structures
- **Type-Safe**: Parameter definitions with types, defaults, and validation
- **MaiaScript Integration**: Conditionals use MaiaScript DSL
- **Engine-Powered**: Evaluated by factoryEngine at actor creation time

---

## 📐 Factory Structure

### Universal Factory Definition

```typescript
interface UniversalFactoryDef {
  $schema: 'composite-factory' | 'leaf-factory' | 'view-factory'
  
  parameters?: Record<string, {
    type: string          // 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any'
    required?: boolean    // Default: false
    default?: any         // Default value if not provided
  }>
  
  maps?: Record<string, Record<string, any>>  // Key-value mappings
  
  factory: ViewNode | FactoryConditional  // Template structure
}
```

### Example: Button Factory

```json
{
  "$schema": "leaf-factory",
  "parameters": {
    "text": { "type": "string", "required": true },
    "variant": { "type": "string", "default": "primary" },
    "disabled": { "type": "boolean", "default": false }
  },
  "factory": {
    "tag": "button",
    "attributes": {
      "type": "button"
    },
    "classes": {
      "$switch": {
        "on": "{{variant}}",
        "cases": {
          "primary": "bg-blue-500 text-white",
          "secondary": "bg-gray-500 text-white",
          "danger": "bg-red-500 text-white"
        },
        "default": "bg-slate-500 text-white"
      }
    },
    "bindings": {
      "disabled": "{{disabled}}"
    },
    "elements": ["{{text}}"]
  }
}
```

---

## 🔧 factoryEngine API

### Core Functions

```typescript
// Generic factory creation
function createFromFactory<T extends ViewNode>(
  factoryDef: UniversalFactoryDef,
  params: Record<string, any>
): T

// Type-safe helpers
function createComposite(
  factoryDef: UniversalFactoryDef,
  params: Record<string, any>
): CompositeNode

function createLeaf(
  factoryDef: UniversalFactoryDef,
  params: Record<string, any>
): LeafNode

// Async loader (for dynamic imports)
async function createFromFactoryAsync<T extends ViewNode>(
  factoryPath: string,
  params: Record<string, any>
): Promise<T>
```

### Usage

```typescript
import { createComposite, createLeaf } from '$lib/compositor/engines/factoryEngine'
import buttonFactory from './button.factory.json'

// Create button with parameters
const button = createLeaf(buttonFactory, {
  text: 'Click Me',
  variant: 'primary'
})

// Result: Fully resolved LeafNode
// {
//   tag: 'button',
//   classes: 'bg-blue-500 text-white',
//   elements: ['Click Me']
// }
```

---

## 📝 Parameter Substitution

### Basic Substitution

```json
{
  "$schema": "leaf-factory",
  "parameters": {
    "text": { "type": "string", "required": true }
  },
  "factory": {
    "tag": "span",
    "elements": ["{{text}}"]
  }
}
```

Usage:
```typescript
createLeaf(factory, { text: 'Hello World' })
// → { tag: 'span', elements: ['Hello World'] }
```

### String Interpolation

```json
{
  "$schema": "leaf-factory",
  "parameters": {
    "size": { "type": "string", "default": "4" }
  },
  "factory": {
    "tag": "div",
    "classes": "px-{{size}} py-{{size}}"
  }
}
```

Usage:
```typescript
createLeaf(factory, { size: '8' })
// → { tag: 'div', classes: 'px-8 py-8' }
```

### Object Preservation

When the entire value is a single parameter, the type is preserved:

```json
{
  "$schema": "leaf-factory",
  "parameters": {
    "bindings": { "type": "object", "default": {} }
  },
  "factory": {
    "tag": "div",
    "bindings": "{{bindings}}"
  }
}
```

Usage:
```typescript
createLeaf(factory, {
  bindings: {
    text: { "$": "item.name" },
    visible: { "$eq": [{ "$": "item.status" }, "done"] }
  }
})
// → { tag: 'div', bindings: { text: { $: 'item.name' }, ... } }
// MaiaScript objects preserved!
```

### Required vs Optional

```json
{
  "$schema": "leaf-factory",
  "parameters": {
    "text": { "type": "string", "required": true },
    "classes": { "type": "string", "default": "px-4 py-2" }
  },
  "factory": {
    "tag": "button",
    "classes": "{{classes}}",
    "elements": ["{{text}}"]
  }
}
```

Usage:
```typescript
// ✅ Valid - required parameter provided
createLeaf(factory, { text: 'Click' })

// ❌ Error - missing required parameter
createLeaf(factory, { classes: 'px-2' })
// → Error: Required parameter missing: text
```

---

## 🔀 Conditional Templates

Factories support conditional structures using MaiaScript DSL operations.

### `$if` Conditional

```json
{
  "$schema": "leaf-factory",
  "parameters": {
    "variant": { "type": "string", "default": "primary" }
  },
  "factory": {
    "tag": "button",
    "classes": {
      "$if": {
        "test": { "$eq": ["{{variant}}", "primary"] },
        "then": "bg-blue-500 text-white hover:bg-blue-600",
        "else": "bg-gray-500 text-white hover:bg-gray-600"
      }
    }
  }
}
```

**Evaluation**:
1. `{{variant}}` is substituted first: `"{{variant}}"` → `"primary"`
2. MaiaScript expression is evaluated: `{ $eq: ["primary", "primary"] }` → `true`
3. `then` branch is selected
4. Result: `"bg-blue-500 text-white hover:bg-blue-600"`

### `$switch` Multi-way Branch

```json
{
  "$schema": "leaf-factory",
  "parameters": {
    "status": { "type": "string", "required": true }
  },
  "factory": {
    "tag": "span",
    "classes": {
      "$switch": {
        "on": "{{status}}",
        "cases": {
          "todo": "bg-slate-100 text-slate-700",
          "in-progress": "bg-blue-100 text-blue-700",
          "done": "bg-green-100 text-green-700",
          "archived": "bg-gray-100 text-gray-500"
        },
        "default": "bg-red-100 text-red-700"
      }
    }
  }
}
```

**Evaluation**:
```typescript
createLeaf(factory, { status: 'done' })
// → { tag: 'span', classes: 'bg-green-100 text-green-700' }

createLeaf(factory, { status: 'unknown' })
// → { tag: 'span', classes: 'bg-red-100 text-red-700' }  // default case
```

### `$map` Lookup

Maps provide key-value lookups for parameter values:

```json
{
  "$schema": "leaf-factory",
  "parameters": {
    "size": { "type": "string", "default": "md" }
  },
  "maps": {
    "sizeClasses": {
      "sm": "px-2 py-1 text-sm",
      "md": "px-4 py-2 text-base",
      "lg": "px-6 py-3 text-lg"
    }
  },
  "factory": {
    "tag": "button",
    "classes": {
      "$map": {
        "name": "sizeClasses",
        "param": "size",
        "default": "px-4 py-2"
      }
    }
  }
}
```

**Evaluation**:
```typescript
createLeaf(factory, { size: 'lg' })
// → { tag: 'button', classes: 'px-6 py-3 text-lg' }
```

### Nested Conditionals

Conditionals can be nested for complex logic:

```json
{
  "$schema": "leaf-factory",
  "parameters": {
    "variant": { "type": "string", "default": "primary" },
    "size": { "type": "string", "default": "md" }
  },
  "factory": {
    "tag": "button",
    "classes": {
      "$if": {
        "test": { "$eq": ["{{variant}}", "primary"] },
        "then": {
          "$switch": {
            "on": "{{size}}",
            "cases": {
              "sm": "bg-blue-500 px-2 py-1 text-sm",
              "md": "bg-blue-500 px-4 py-2 text-base",
              "lg": "bg-blue-500 px-6 py-3 text-lg"
            }
          }
        },
        "else": {
          "$switch": {
            "on": "{{size}}",
            "cases": {
              "sm": "bg-gray-500 px-2 py-1 text-sm",
              "md": "bg-gray-500 px-4 py-2 text-base",
              "lg": "bg-gray-500 px-6 py-3 text-lg"
            }
          }
        }
      }
    }
  }
}
```

---

## 📦 Real-World Examples

### Example 1: Title Factory

**File**: `services/me/src/lib/compositor/factories/leafs/title.factory.json`

```json
{
  "$schema": "leaf-factory",
  "parameters": {
    "text": { "type": "string", "required": true },
    "tag": { "type": "string", "default": "h1" }
  },
  "factory": {
    "tag": "{{tag}}",
    "classes": "text-2xl @xs:text-3xl @sm:text-4xl @md:text-5xl font-bold text-[#001a42] tracking-tight",
    "elements": ["{{text}}"]
  }
}
```

**Usage**:
```typescript
import titleFactory from './title.factory.json'

const title = createLeaf(titleFactory, {
  text: 'Todos',
  tag: 'h2'
})
// → { tag: 'h2', classes: '...', elements: ['Todos'] }
```

### Example 2: Input Section Factory

**File**: `services/me/src/lib/compositor/factories/composites/inputSection.factory.json`

```json
{
  "$schema": "composite-factory",
  "parameters": {
    "valuePath": { "type": "string", "required": true },
    "inputEvent": { "type": "string", "required": true },
    "submitEvent": { "type": "string", "required": true },
    "submitPayload": { "type": "any", "default": {} },
    "placeholder": { "type": "string", "default": "Enter text..." },
    "buttonText": { "type": "string", "default": "Add" }
  },
  "factory": {
    "container": {
      "class": "bg-slate-50 p-4 shrink-0"
    },
    "children": [
      {
        "slot": "input.value",
        "composite": {
          "container": {
            "tag": "form",
            "class": "flex flex-row gap-3"
          },
          "events": {
            "submit": {
              "event": "{{submitEvent}}",
              "payload": "{{submitPayload}}"
            }
          },
          "children": [
            {
              "slot": "input",
              "leaf": {
                "tag": "input",
                "attributes": {
                  "type": "text",
                  "placeholder": "{{placeholder}}"
                },
                "classes": "flex-1 px-5 py-3 rounded-2xl",
                "bindings": {
                  "value": "{{valuePath}}"
                },
                "events": {
                  "input": {
                    "event": "{{inputEvent}}"
                  }
                }
              }
            },
            {
              "slot": "button",
              "leaf": {
                "tag": "button",
                "attributes": { "type": "submit" },
                "classes": "px-7 py-3 bg-[#001a42] text-white rounded-full",
                "elements": ["{{buttonText}}"]
              }
            }
          ]
        }
      }
    ]
  }
}
```

**Usage** (from todos.ts):
```typescript
import inputSectionFactory from './inputSection.factory.json'

const inputSectionActor = await createActorEntity(account, {
  context: {
    visible: true,
    newTodoText: ''
  },
  view: createComposite(inputSectionFactory, {
    valuePath: 'context.newTodoText',
    inputEvent: '@context/update',
    submitEvent: '@core/createEntity',
    submitPayload: {
      schemaName: 'Todo',
      entityData: {
        name: 'context.newTodoText',
        status: 'todo',
        endDate: { "$toISOString": [...] }
      }
    },
    placeholder: 'Add a new todo...',
    buttonText: 'Add'
  }),
  role: 'todos-input-section'
}, group)
```

### Example 3: View Switcher Factory

**File**: `services/me/src/lib/compositor/factories/composites/viewSwitcher.factory.json`

```json
{
  "$schema": "composite-factory",
  "parameters": {
    "viewsPath": { "type": "string", "default": "context.views" },
    "currentViewPath": { "type": "string", "default": "dependencies.content.context.viewMode" }
  },
  "factory": {
    "container": {
      "class": "flex flex-row gap-2 items-center justify-center flex-wrap"
    },
    "foreach": {
      "items": "{{viewsPath}}",
      "key": "id",
      "leaf": {
        "tag": "button",
        "classes": "px-4 py-2 rounded-lg text-sm font-semibold",
        "bindings": {
          "text": { "$": "item.label" },
          "class": {
            "$if": {
              "test": { "$eq": [
                { "$": "dependencies.content.context.viewMode" },
                { "$": "item.id" }
              ]},
              "then": "!bg-[#001a42] !text-white",
              "else": ""
            }
          }
        },
        "events": {
          "click": {
            "event": "@context/swapActors",
            "payload": { "viewMode": "item.id" }
          }
        }
      }
    }
  }
}
```

**Usage**:
```typescript
import viewSwitcherFactory from './viewSwitcher.factory.json'

const viewSwitcherActor = await createActorEntity(account, {
  context: {
    visible: true,
    views: [
      { id: 'list', label: 'List' },
      { id: 'timeline', label: 'Timeline' },
      { id: 'kanban', label: 'Kanban' }
    ]
  },
  view: createComposite(viewSwitcherFactory, {
    viewsPath: 'context.views',
    currentViewPath: 'dependencies.content.context.viewMode'
  }),
  dependencies: {
    content: contentActor.$jazz.id
  },
  role: 'todos-view-switcher'
}, group)
```

---

## 🔄 Factory vs Runtime Evaluation

### Factory-Time Evaluation

Conditionals in factories are evaluated **once** when the factory is expanded:

```json
{
  "$schema": "leaf-factory",
  "parameters": {
    "variant": { "type": "string", "default": "primary" }
  },
  "factory": {
    "tag": "button",
    "classes": {
      "$if": {
        "test": { "$eq": ["{{variant}}", "primary"] },
        "then": "bg-blue-500",
        "else": "bg-gray-500"
      }
    }
  }
}
```

**Timeline**:
1. Actor created with factory
2. factoryEngine.createLeaf(factory, { variant: 'primary' })
3. Conditional evaluated: `variant === 'primary'` → `true`
4. Result: `{ tag: 'button', classes: 'bg-blue-500' }`
5. Stored in actor.view (static)

### Runtime Evaluation

Bindings in the resolved ViewNode are evaluated **every render**:

```json
{
  "tag": "button",
  "classes": "bg-blue-500",
  "bindings": {
    "class": {
      "$if": {
        "test": { "$eq": [{ "$": "item.status" }, "done"] },
        "then": "opacity-50",
        "else": ""
      }
    }
  }
}
```

**Timeline**:
1. ViewEngine renders button
2. For each render cycle:
   - Evaluate binding: `item.status === 'done'`
   - Apply result: `opacity-50` or ``
3. UI updates reactively when `item.status` changes

### Comparison

| Aspect | Factory-Time | Runtime |
|--------|-------------|---------|
| **When** | Actor creation | Every render |
| **Context** | Factory parameters | Actor data (context, item, dependencies) |
| **Output** | Static ViewNode structure | Dynamic values |
| **Reactivity** | No (evaluated once) | Yes (re-evaluated on data change) |
| **Use Case** | Template variants, structure | Data bindings, conditional rendering |

---

## 🎨 Design Patterns

### Pattern 1: Variant-Based Styling

```json
{
  "$schema": "leaf-factory",
  "parameters": {
    "variant": { "type": "string", "default": "default" }
  },
  "maps": {
    "variantStyles": {
      "default": "bg-gray-100 text-gray-700",
      "primary": "bg-blue-500 text-white",
      "success": "bg-green-500 text-white",
      "danger": "bg-red-500 text-white"
    }
  },
  "factory": {
    "tag": "button",
    "classes": {
      "$map": {
        "name": "variantStyles",
        "param": "variant",
        "default": "bg-gray-100"
      }
    }
  }
}
```

### Pattern 2: Conditional Structure

```json
{
  "$schema": "composite-factory",
  "parameters": {
    "showHeader": { "type": "boolean", "default": true }
  },
  "factory": {
    "container": { "class": "flex flex-col" },
    "children": {
      "$if": {
        "test": "{{showHeader}}",
        "then": [
          { "slot": "header", "leaf": {...} },
          { "slot": "content", "leaf": {...} }
        ],
        "else": [
          { "slot": "content", "leaf": {...} }
        ]
      }
    }
  }
}
```

### Pattern 3: Parameterized Events

```json
{
  "$schema": "leaf-factory",
  "parameters": {
    "event": { "type": "string", "required": true },
    "payload": { "type": "any", "default": {} }
  },
  "factory": {
    "tag": "button",
    "events": {
      "click": {
        "event": "{{event}}",
        "payload": "{{payload}}"
      }
    }
  }
}
```

---

## 🚀 Best Practices

### 1. Use Descriptive Parameter Names

```typescript
// ✅ GOOD - Clear intent
{
  "parameters": {
    "submitEvent": { "type": "string" },
    "valuePath": { "type": "string" }
  }
}

// ❌ BAD - Unclear
{
  "parameters": {
    "e": { "type": "string" },
    "p": { "type": "string" }
  }
}
```

### 2. Provide Sensible Defaults

```typescript
// ✅ GOOD - Most common use case is default
{
  "parameters": {
    "variant": { "type": "string", "default": "primary" },
    "size": { "type": "string", "default": "md" }
  }
}
```

### 3. Use `$switch` for Multiple Cases

```typescript
// ✅ GOOD - Clean with switch
{
  "$switch": {
    "on": "{{status}}",
    "cases": {
      "todo": "...",
      "in-progress": "...",
      "done": "..."
    }
  }
}

// ❌ BAD - Nested ifs are messy
{
  "$if": {
    "test": { "$eq": ["{{status}}", "todo"] },
    "then": "...",
    "else": {
      "$if": {
        "test": { "$eq": ["{{status}}", "in-progress"] },
        "then": "...",
        "else": "..."
      }
    }
  }
}
```

### 4. Preserve MaiaScript Objects

```typescript
// ✅ GOOD - Object parameter preserved
{
  "parameters": {
    "bindings": { "type": "object", "default": {} }
  },
  "factory": {
    "bindings": "{{bindings}}"  // Full object substitution
  }
}

// ❌ BAD - Can't preserve complex objects
{
  "factory": {
    "bindings": {
      "text": "{{textBinding}}"  // Only string values
    }
  }
}
```

### 5. Document Factory Purpose

```json
{
  "$schema": "composite-factory",
  "_description": "Input section with form, text input, and submit button. Used for creating new entities.",
  "parameters": {
    "valuePath": {
      "type": "string",
      "required": true,
      "_description": "Path to input value in actor context (e.g., 'context.newTodoText')"
    }
  }
}
```

---

## 📚 Related Documentation

- **[Engine Architecture](./ENGINE_ARCHITECTURE.md)** - factoryEngine overview
- **[MaiaScript DSL](./MAIASCRIPT_DSL.md)** - Conditional evaluation
- **[View Layer](./view/README.md)** - ViewNode architecture
- **[Todos Example](../../../services/me/src/lib/vibes/todos.ts)** - Real-world factory usage

---

## ✅ Summary

The Factory System provides:

- **Reusability**: Create once, use many times with different parameters
- **Type Safety**: Parameter validation and defaults
- **Flexibility**: Conditionals for dynamic structures
- **Maintainability**: Change template, update all instances
- **Performance**: Evaluated once at actor creation

**Core Innovation**: Parameterized templates with MaiaScript DSL conditionals, enabling truly reusable UI components without hardcoded structures.
